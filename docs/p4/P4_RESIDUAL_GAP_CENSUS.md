# QANDEEL — P4 Residual Gap Census

**Status:** `P4-C1 SYNCHRONIZED CENSUS — EVIDENCE TABLE — P4 ACTIVE, NOT CLOSED`

| | |
|---|---|
| Track | P4 — Remaining Product / Visual Gaps Census & Closure, task P4-A |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` |
| P4-B synchronization | on `576b010dcf78276c982f5052cfee7dd1bcbfcbcb`: `P4-GAP-057` reclassified `ALREADY CLOSED / SUPERSEDED` by the CW2-08A controlled amendment |
| P4-C1 synchronization | Product Owner decisions resolve `P4-GAP-001` … `005`; the dedicated Live Context surface is retired; new runtime/architecture residue is recorded as `P4-GAP-065` and admitted to the canonical backlog as `QAN-BL-CTX-01` |
| Role | the authoritative **evidence table** of the P4 census candidate. It records where each residual stands. It freezes nothing, and it chooses no option |
| Decisions | genuinely open choices are handed to the [Product Owner Decision Queue](P4_PRODUCT_OWNER_DECISION_QUEUE.md) (`P4-DQ-nn`). Future work that is not a P4 decision is in the [Carry-Forward Matrix](P4_CARRY_FORWARD_MATRIX.md) |

---

## 1. Method

The census was repository-wide and authority-aware. It did not paste every `OPEN` string it found. For each
candidate it did the following:

1. found the exact source;
2. recorded the unresolved statement, verbatim or closely summarized;
3. identified the authority class;
4. traced every later amendment or closure that could supersede it: the later G-series, P1, P2, P3, T-12, the
   artifact index's "Later amendments" table, and Current State §4;
5. stated the current truth;
6. classified it;
7. decided whether P4 must settle it before the End-to-End Product Experience Completeness Audit.

**Sources swept.** Entry points (AGENTS, Current State, Project Map, Roadmap); the full canonical backlog; the
Canonical Authority Index; the Canonical Artifact Index; the three closed P-track closures; I-08A4; I-08N-01; G1.1;
G1.2; G2 and its G3 readiness handoff; G2.3; G3. Also:

- the C3 freeze record, closure record, iconography contract and headroom contract;
- the I-08B2.5 brand provenance, review manifest and asset report;
- T-14 and T-12 §9;
- the Phase V V10 freeze;
- the VI-01 foundation, copy patterns and README;
- the VI-02 README and its open-items document;
- the local-only artifact audit;
- the P3-A copy table.

For APP-OPS-01, the sweep added the telemetry, outbox, startup-recovery and health records, the Model Router,
FAST / DEEP v2, the Safety Runtime, CW2-02, CW2-03, CW2-04 and CW2-08.

**Keywords searched.** `NOT FROZEN`, `PROOF ONLY`, `OPEN COPY`, `OPEN`, `DIRECTION`, `provisional`, `deferred`,
`later Product`, `future Product`, `craft`, `not decided`, `not answered`, `unresolved`, `P4`, and domain terms
(splash, lantern, app icon, Settings, Understanding, waveform, speaking indicator, moderation, human review,
telemetry).

**Volume.** About 800 keyword and heading hits were inspected across about 40 records. That count is approximate:
hits were reviewed in context, not tallied by a tool. They reduce to the rows below.

**Rule of evidence.** A keyword hit is not authority. Each row's "Later authority" column names what was checked
for supersession. Where nothing later answers the item, the column says **none**.

**Classification vocabulary.** The twelve classes are exactly those of the P4-A Task Contract §5. One convention:

- where a **named later owner other than the End-to-End audit** already holds an item (for example Connected
  Worlds `I-08`), the P4 classification is `NO ACTION` and the Downstream owner column names that owner;
- `END-TO-END AUDIT OWNED` is reserved for items the roadmap assigns to the audit.

---

## 2. Summary

| Classification | Rows |
|---|---:|
| `P4 — VISUAL DECISION REQUIRED` | 1 |
| `P4 — VISUAL EXECUTION / PROOF REQUIRED` | 3 |
| `P4 — COPY EXECUTION / PROOF REQUIRED` | 4 |
| `P4 — CLOSURE / INDEPENDENT REVIEW REQUIRED` | 1 |
| `ALREADY CLOSED / SUPERSEDED` | 18 |
| `IMPLEMENTATION ONLY — NOT P4` | 13 |
| `DEVICE / RELEASE VALIDATION — NOT P4` | 1 |
| `END-TO-END AUDIT OWNED` | 7 |
| `BACKLOG OWNED` | 3 |
| `DEPENDENCY-GATED — CANNOT CLOSE YET` | 6 |
| `HISTORICAL / EVIDENCE ONLY` | 2 |
| `NO ACTION` | 7 |
| **Total** | **66** |

There are 65 `P4-GAP` rows (`P4-GAP-001` … `P4-GAP-065`) plus `APP-OPS-01`.

**Only one Product Owner decision remains open:** `P4-DQ-06`, narrowly asking whether the lantern gateway moment is in v1 (`P4-GAP-019`). Several P4-owned execution / proof items remain, but they are no longer undecided Product questions.

## 3. Census table

Column key:

- **Canonical ID** — an existing identifier, if any. `P4-GAP` IDs are this package's own. They never reuse a
  backlog ID.
- **P4 action** — what P4 does with the row.
- **Proof needed** — the evidence a closure of the row requires.

### 3.1 Shell / small chrome / placement

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-001 | — | shell placement | [P1 §8](../qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) (one General Settings destination, "secondary Global Shell utility", I-08A4 §7) | where the General Settings **entry** sits in the shell is undecided | [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) selects **S-B** | **resolved:** one global Settings destination; entry from Personal QANDEEL | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-01` resolved | Product Owner | P4-C comparative proof completed | Production Integration (shell) |
| P4-GAP-002 | — | shell placement / visual | P1 §11: Understanding has "a stable, discoverable entry from Personal QANDEEL. The exact visual placement is later design work"; P1 §16.1 "entry-control visual" | the entry's placement and control form | [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) selects **U-A** | **resolved:** persistent Personal-QANDEEL row beneath the upper chrome | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-02` resolved | Product Owner | P4-C comparative proof completed | Production Integration |
| P4-GAP-003 | — | brand in chrome | [C3 iconography contract §8](../design/canonical-artifacts/living-brass/i-08b3.1-c3/docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md): "The canonical Q stands on every screen… It is a **placement** question" | whether the canonical Q appears on every screen, and where | [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) selects **Q-A**; G2.3 Matching placement remains | **resolved:** no persistent shell Q; Q only at named identity moments; normal QANDEEL conversation opening is one; DQ-06 still owns launch/gateway composition | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-03` resolved | Product Owner | P4-C comparative proof completed | Production Integration |
| P4-GAP-004 | — | small chrome | [C3 freeze record](../design/canonical-artifacts/living-brass/i-08b3.1-c3/docs/C3_FREEZE_RECORD.md) §2; [I-08A4 §21](../canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md); P2 §5 selected-state law | Global Switcher container form, tab depth and active-indicator geometry | [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) selects **SW-3 Keyed Seam** | **resolved**; P2 / E1R state channels remain unchanged | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-04A` resolved | Product Owner | P4-C comparative proof completed | Production Integration |
| P4-GAP-005 | G3.1 N3 | Analysis chrome / historical Live Context | [G3 §G](../design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) left «سياق الكلام» placement to VI-01 / Product | where the Live-context label sits in the Analysis | [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) retires the dedicated Live Context surface/control and narrowly supersedes the older placement obligation | **resolved by deletion of the dedicated Product surface.** No X-A / X-B / X-C placement remains. Underlying Context Activation and Live Focus are preserved | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-04B` resolved | Product Owner | P4-C Board 06 retained as comparison evidence only | none for a Live Context surface |
| P4-GAP-006 | Q-LIGHT-SHELL | Analysis shell | [G2 §F, §G 7](../design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md) "Q-LIGHT-SHELL remains open" | the non-Analysis / Analysis shell appearance | G3 §C.1 and the G2 / F2 amendment; P1 §12 (Dark / Light / System, default Dark; the Analysis always dark) | closed. Implementation open (G3 §F) | `ALREADY CLOSED / SUPERSEDED` | none | — | — | Production Integration |
| P4-GAP-007 | — | shell | I-08A4 §21 "Explicitly NOT Frozen": logo, app icon, colours, typography, material, iconography, notification presentation, detailed motion | these were not frozen by I-08A4 | brand I-08B2.4 / B2.5; the I-08B canon (C3, D2R, E1R, F2, E3, B4R); P2; P3; P2 §9 / P3 §16 | closed by later records. Timing values stay craft (P4-GAP-050) | `ALREADY CLOSED / SUPERSEDED` | none | — | — | — |
| P4-GAP-008 | S-06, S-07 | Return | G3 §G: "Exact Return / Back restoring a PINNED stance … confirmation for the T-07 / T-08 owners; not reopened" | the owners confirm existing runtime behavior | T-07 / T-08 are implemented and unchanged | a conformance check against frozen runtime law, not a Product choice | `IMPLEMENTATION ONLY — NOT P4` | none | — | owner confirmation during the port | Production Integration (T-07 / T-08 owners) |
| P4-GAP-009 | S-09, S-10 | numerals / port | G3 §G: seams S-09 / S-10 "unchanged, with their owners" (VI-01 / port) | the world's digits against the chrome's digits | [T-12 §9](../final-living-analysis-map-integration-v1.md) pins `latn` in both languages; `QAN-BL-T12-02` tombstoned | the v1 numeral policy is closed. Applying it in the ported world is port work | `IMPLEMENTATION ONLY — NOT P4` | none | — | port conformance | Production Integration |
| P4-GAP-010 | — | Return | G2.3 §4 declines "a new general semantic ranking of T-08's six Return acts beyond the reviewed Product contexts" | no general ranking exists | none | a scope boundary, not a deferral (BG-06) | `NO ACTION` | none | — | — | — |
| P4-GAP-011 | G3.2 N3 | motion | G3 §G: F2 timing into the proposal / Shared World "**not universalised**. Their existing Product / motion owners keep the timing" | — | none | the existing owners keep existing timing | `IMPLEMENTATION ONLY — NOT P4` | none | — | device tuning | Production Integration |

### 3.2 Brand entry / app icon / launch application

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-012 | I-08B2.5 | brand lifecycle | [brand SOURCE-PROVENANCE](../design/canonical-artifacts/brand/SOURCE-PROVENANCE.md) | the brand package lacked a standalone lifecycle record | [P4-C2](../canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md) ratifies I-08B2.5 | **resolved:** I-08B2.5 is the final Brand Authority | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-05` resolved | Product Owner | existing package / verification sufficient | Production Integration |
| P4-GAP-013 | L-1 | app icon | review manifest L-1: stale pre-freeze header comment inside the frozen icon SVG | whether to change bytes and break the frozen hash | P4-C2 chooses **keep bytes / keep hash** | **resolved:** stale comment remains historical metadata; P4-C2 is current lifecycle authority | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-05` resolved | Product Owner | no asset rewrite | Production Integration |
| P4-GAP-014 | — | app icon | asset report §13: Android 48 dp framing awaited Product confirmation | Android adaptive-icon framing | P4-C2 confirms **48 dp** | **resolved** | `ALREADY CLOSED / SUPERSEDED` | none — `P4-DQ-05` resolved | Product Owner | existing adaptive-icon evidence accepted; on-device release check remains | Release |
| P4-GAP-015 | L-5 | app icon | iOS dark / tinted variants were out of B2.5 scope | whether v1 ships dedicated variants | P4-C2: **not in v1; defer beyond v1** | v1 disposition resolved; any future variant needs a later Product direction | `NO ACTION` | none for v1 | — | — | future Product / Release if reopened |
| P4-GAP-016 | L-4, §13 | brand application | asset report L-4: masters "carry no clear space… production use must add its own"; §13: colour tokens "not frozen here" | clear space in use; no global brand colour token | none | these are production-application rules, and the icon values are presentation values | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-017 | — | app icon wiring | `apps/mobile/app.json` has no `icon`, `splash` or `adaptiveIcon` key | the assets are not applied | — | implementation gap | `IMPLEMENTATION ONLY — NOT P4` | none | — | build / device check | Production Integration |
| P4-GAP-018 | — | launch / splash / gateway | roadmap names launch-brand application in P4 and audit | sequencing between P4 and audit | P4-C2 selects **P4 closes the static launch / gateway brand application before the audit** | Product sequencing resolved; visual design / proof still required | `P4 — VISUAL EXECUTION / PROOF REQUIRED` | produce integrated launch / gateway brand proof | Product Owner no longer needed for sequencing | visual proof | Production Integration |
| P4-GAP-019 | — | gateway identity moment | C3 authorizes but does not design/freeze a lantern gateway moment | **whether the lantern gateway moment is in v1**; animation remains undesigned | P4-C2 deliberately makes no inference from the grouped approval | **one remaining Product Owner decision** | `P4 — VISUAL DECISION REQUIRED` | answer lantern-in-v1 yes/no → `P4-DQ-06`; then prove if adopted | Product Owner | motion / gateway proof if adopted | Production Integration |
| P4-GAP-020 | QAN-BL-AUTH-01 (tombstone) | account entry | T-14 §11 anti-scope: sign-up, password reset, onboarding, brand assets; backlog §7 | lifecycle journeys not designed | P1 §3 and §4 close the sign-in requirement and the sign-up fields; roadmap §3 "Complete Account / Authentication Lifecycle" goes to the audit | the Product requirements are partly closed. The journeys go to the audit | `END-TO-END AUDIT OWNED` | none | — | — | End-to-End audit |

### 3.3 Voice visual language

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-021 | — | Voice visual | G1.2 / P2 leave final Voice visual language open and forbid fake signal | what closes now vs runtime | P4-C2 selects **Split** | Product direction resolved. Non-signal visuals require P4 proof; signal-bearing morphology waits for `QAN-BL-VOICE-01` | `P4 — VISUAL EXECUTION / PROOF REQUIRED` | prove non-signal Voice / Live Call language in AR / EN | — | integrated visual proof | Production Integration; `QAN-BL-VOICE-01` |
| P4-GAP-022 | — | Voice history visual | G1.2 / P2 leave Voice Note and finished-call history representation unfrozen | static representation | P4-C2 assigns it to P4 non-signal visual closure | Product decision resolved; proof still required | `P4 — VISUAL EXECUTION / PROOF REQUIRED` | prove Voice Note + finished-call history representation | — | history visual proof | Production Integration |
| P4-GAP-023 | — | speaking indicator | [P2 §11.1](../qandeel-p2-final-iconography-canonical-closure.md): "A truthful future speaking indicator requires real call / audio runtime truth"; P2 creates "no duplicate backlog alias" | no indicator is frozen, and none may be faked | `QAN-BL-VOICE-01` requires "truthful microphone and route state" | gated on the Voice runtime | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | real runtime signal | `QAN-BL-VOICE-01` |
| P4-GAP-024 | — | Voice Note transcript | G1.2 §6: "whether committed Voice Notes later gain a machine transcript" | whether a transcript exists | none | depends on STT runtime and provider evidence (roadmap §3 benchmark). If it exists, APP-OPS-01 §6 bars it from Company Operations | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | provider / runtime evidence | Voice runtime track (`QAN-BL-VOICE-01`); End-to-End audit |
| P4-GAP-025 | — | native call behavior | G1.2 §6: speaker route, other-system-call hold / interruption UI, barge-in, Voice Note backgrounding, Recents privacy | native / runtime behavior and its presentation | none | needs the native call stack | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | device + runtime | `QAN-BL-VOICE-01` |
| P4-GAP-026 | — | spoken reply | G1.2 §6: "final QANDEEL spoken-reply control on ordinary text turns" | whether, and how, QANDEEL reads text replies aloud | none | a Product capability that depends on TTS / provider evidence | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | provider evidence | End-to-End audit (provider benchmark); `QAN-BL-VOICE-01` |
| P4-GAP-027 | QAN-BL-VOICE-01 | Voice runtime | G1.2 §8; [backlog §5](../qandeel-canonical-backlog-v1.md) | no Personal Voice / Live Call runtime, no durable audio source | — | `OPEN — UNASSIGNED` | `BACKLOG OWNED` | none | — | — | future Voice runtime task |

### 3.4 Copy

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-028 | — | core surface copy | G3 §G core Conversation / Analysis / Replay / Timeline / Live-edge copy remains open | exact AR / EN copy | P4-C2 assigns the cluster to **P4** | disposition resolved; actual copy and rendered proof still required | `P4 — COPY EXECUTION / PROOF REQUIRED` | author + prove in context | Product Owner (copy proof) | AR / EN in context | Production Integration |
| P4-GAP-029 | — | Matching copy | G3 §G Matching proof lines / English Matching copy are open | exact lines | P4-C2 hands the cluster to the End-to-End audit | sequencing resolved | `END-TO-END AUDIT OWNED` | audit language pass / later scoped closure | — | rendered context later | End-to-End audit; Connected Worlds `I-08` |
| P4-GAP-030 | — | notification copy | P3 §17 residual copy | exact copy / sequencing | P4-C2: copy on already-frozen P3 surfaces closes in P4; permission-education sheet goes to audit | disposition resolved; P4-owned copy still requires proof | `P4 — COPY EXECUTION / PROOF REQUIRED` | author P4-owned lines; carry education sheet to audit | Product Owner (copy proof) | copy in context | End-to-End audit / Production Integration |
| P4-GAP-031 | — | account / Understanding copy | P1 open copy: confidence states, Settings group names, Public ID warning, auth failure/help | exact copy / sequencing | P4-C2: confidence / Settings groups / Public ID warning close in P4; sign-in failure and Login ID help go to audit | disposition resolved; P4-owned copy still requires proof | `P4 — COPY EXECUTION / PROOF REQUIRED` | author P4-owned lines; audit owns auth copy | Product Owner (copy proof) | copy in context | End-to-End audit / Production Integration |
| P4-GAP-032 | VI-01 `PROPOSED` / `OPEN` rows | legacy copy | VI-01 carried residue | later rendered-language pass | P4-C2 hands the remaining residue to the End-to-End audit | sequencing resolved | `END-TO-END AUDIT OWNED` | audit rendered-language pass | — | rendered-surface review | End-to-End audit |
| P4-GAP-033 | — | brand casing | VI-01 orphaned Brand Integration owner; frozen English canon consistently uses QANDEEL | English casing | P4-C2 confirms **QANDEEL** | **resolved** | `ALREADY CLOSED / SUPERSEDED` | none — casing frozen | Product Owner | — | Production Integration |
| P4-GAP-034 | — | opener / welcome | G1.1 normal opener vs I-08A4 First Conversation Opening; English normal opener missing | relation + missing English copy | P4-C2 confirms they are separate moments and assigns the missing English normal opener to P4 | relation resolved; English copy / proof still required | `P4 — COPY EXECUTION / PROOF REQUIRED` | write + prove English normal opener | Product Owner (copy proof) | copy in context | End-to-End audit (first use) |
| P4-GAP-035 | VI-01 V01–V07 | Voice / call strings | G1.2 §6 "final Voice / call strings that VI-01 leaves provisional"; VI-01 "`PRINCIPLES = KEEP. EXACT STRINGS = PROVISIONAL / PHASE VII.`" | exact voice / realtime state strings. "A state string must name what the architecture actually does" | none. "Phase VII" is not a live track | gated on Voice runtime truth. The named owner is orphaned | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record, and name the re-ownership need (Carry-Forward Matrix) | — | runtime truth | `QAN-BL-VOICE-01` / Production Integration |
| P4-GAP-036 | — | fixtures | P3 §17: "every `FIXTURE` event sentence. They are synthetic event text, never Product copy" | — | — | not a copy candidate | `NO ACTION` | none | — | — | — |
| P4-GAP-037 | QAN-BL-T12-02 (tombstone) | numerals | VI-01 / VI-02 §6 "Numeral policy — OPEN" | — | T-12 §9: v1 `latn` in both languages | closed for v1 | `ALREADY CLOSED / SUPERSEDED` | none | — | — | — |
| P4-GAP-038 | — | gendered address | G2.3 §1 frozen Matching opener uses masculine address; VI-01 "never fall back to masculine" | apparent tension | [G2.3 §1](../design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md): "No gender-neutral rewrite is authorized by G2.3" — a later, explicit Product Owner freeze | the later explicit freeze binds for those strings. VI-01's principle stands elsewhere | `ALREADY CLOSED / SUPERSEDED` | none (observation recorded) | — | — | — |

### 3.5 Other explicit residual craft and owned remainders

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-039 | — | undrawn screens | P1 §8.1 "final order, visual hierarchy, icons and copy stay open"; P1 §16.1 "final Settings visual design", "sign-up visual design"; I-08A4 §21 "screen layouts / high-fidelity screens" | no high-fidelity design for the Settings screen, the Understanding surface, sign-up, the first-use welcome screen, or the Shared / Public surfaces | roadmap §3: the audit walks these moments and classifies each (`PARTIALLY DEFINED`, and so on) | open. Whether P4 or the audit takes them is a sequencing question | `P4 — PRODUCT DECISION REQUIRED` | decide the boundary → `P4-DQ-07` | Product Owner | — | End-to-End audit (recommended) |
| P4-GAP-040 | — | Shared conversation | G1.1 §5: "multi-human Shared-World attribution remains outside this task"; G3 §G "distinct Shared World titles" (Matching runtime §22) | how other humans' turns and multiple Shared World titles are presented | P1 §4 adds the Introduction First Name field | no Shared mobile surface exists (Current State §4) | `END-TO-END AUDIT OWNED` | include in `P4-DQ-07`'s boundary | — | — | End-to-End audit; Connected Worlds `I-08` for navigation surfaces |
| P4-GAP-041 | QAN-BL-NAV-02 | Replay surface | artifact index Replay rows: "OPEN — proof, not canonical" | selection, player, export, anchor | backlog current truth | `OPEN — UNASSIGNED` | `BACKLOG OWNED` | none | — | — | future Replay surface task |
| P4-GAP-042 | QAN-BL-VIS-01 | world density | G2 §G 8 | heavy-history stress proof | G3 §H admitted it | `OPEN — UNASSIGNED` | `BACKLOG OWNED` | none | — | — | future proof task |
| P4-GAP-043 | — | Matching / Introduction UI | G2 §G 9 "Final Introduction screen"; G3 §D post-call copy and timing; P1 §16.1 Matching UI | final Introduction screen, Matching onboarding, deferred-Matching presentation | Current State §7: Connected Worlds `I-08` owns them | owned by a named later task | `NO ACTION` | none | — | — | Connected Worlds `I-08` |
| P4-GAP-044 | CW2-08 §44 | launch policy | [CW2-08 §44](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md): `SIGNED_OUT_PUBLIC_VIEW_POLICY`, `SHARED_WORLD_BLOCK_POLICY`, `INTRODUCTION_BLOCK_POLICY`, `SHARED_HUMAN_LIVE_CALL_LEGAL_GATE`, moderation / report UX + appeals, Replay export monetization, Public discussion entitlement matrix | "intentionally open and machine-gated" | owned by Connected Worlds `I-09` / CW2-08 (Current State §7). Item 5 intersects `P4-GAP-057` | fail-closed launch requirements | `NO ACTION` | none (P4-GAP-057 covers item 5's human-access dimension) | — | — | Connected Worlds `I-09` / Release Hardening |
| P4-GAP-045 | — | Introduction image | P1 §14.2: "exact blur radius or algorithm… stay later craft"; P1 "not a Product question" | — | — | craft | `IMPLEMENTATION ONLY — NOT P4` | none | — | device render | Connected Worlds `I-08` / Production Integration |
| P4-GAP-046 | — | Public avatar | P1 §6 / §16.1: "Any future Public avatar is a separate, explicit choice" | — | — | a scope boundary (BG-06) | `NO ACTION` | none | — | — | — |
| P4-GAP-047 | — | identifiers | P1 §5.1, §6, §16: human-facing Shared ID / Public ID format; Login ID grammar | — | P1 §16 lists these as implementation carry-forwards | implementation | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-048 | — | account lifecycle | P1 §16.1 export, delete-account, password recovery, security flows | — | roadmap §3 | audit-owned | `END-TO-END AUDIT OWNED` | none | — | — | End-to-End audit |
| P4-GAP-049 | — | economy | P1 §8.1 Plan / Usage; CW2-08 §20–§23 | no formula, price or unit | roadmap §3 Plans / Credits / Usage Economy | audit-coupled | `END-TO-END AUDIT OWNED` | none | — | — | End-to-End audit |
| P4-GAP-050 | — | craft constants | P2 §7, §9 (aperture, notch, timings "reference craft values"); P3 §16 (ms, 6 s hold); G3 (`.88` falloff, 200 ms "device-tunable") | — | — | craft, "judged on a device" | `IMPLEMENTATION ONLY — NOT P4` | none | — | device | Production Integration |
| P4-GAP-051 | — | production ports | G3 §F; P2 §14 items 1–5, 7; P3 §18; P1 §16.2 | the I-08B1 native port, the icon port and `react-native-svg`, compact `ReturnControls`, the appearance preference, the Push runtime | — | no production code | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-052 | — | device gates | G1.1 §5, G1.2 §7, G3 §F, P2 §14.6, P3 §16 / §18; brand L-7 | VoiceOver / TalkBack, CallKit / Telecom, status bar, 320 pt large text, on-device icon rendering, real Push | — | not provable in proofs | `DEVICE / RELEASE VALIDATION — NOT P4` | none | — | physical devices | Release Hardening |
| P4-GAP-053 | I-08N-01 §21 | notification implementation | P3 §19.1: sub-budgets, storage, retention, pagination, scoring, relationship-style implementation, platform wording and channels | — | P3 §18 | implementation | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-054 | — | notification behaviour detail | P3 §8 exit tie-break; P3 §13 release of held items at 08:00; P3 §11 platform prompt wording | proof interpretation or platform work | P3 §18 | implementation | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-055 | I-08N-01 D18A / D18B | QANDEEL Voice style | P3 §17: per-user dialect and relationship style | — | D18A / D18B semantics are frozen; P3 §19.1 leaves the implementation open | implementation | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-056 | VI-02 §4, §5 | conditional | [VI-02 open items](../design/phase-vi/vi-02-analysis-navigation-density/VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md): exact-duplicate exposure edge ("Trigger: a real shipping exposure path"); chip-scale reading label "`DEFERRED POSSIBILITY — NOT REQUESTED`" | — | none | wait on a trigger | `DEPENDENCY-GATED — CANNOT CLOSE YET` | none | — | trigger evidence | Production Integration |
| P4-GAP-058 | — | Phase V residue | [Phase V](../design/phase-v/README.md) V10 "Open for Final Visual Design" items (app-bar subtitle, Live Context final form, nominal-mark graphic language, second surface value) | — | Current State §3.5: superseded by I-08B1 and the G-series | historical. Surviving parts are P4-GAP-005 and P4-GAP-028 | `HISTORICAL / EVIDENCE ONLY` | none | — | — | — |
| P4-GAP-059 | — | VI-02 / VI-03 | [VI-02 README](../design/phase-vi/vi-02-analysis-navigation-density/README.md) "`FINAL VISUAL MORPHOLOGY REMAINS OPEN`" (owner VI-03) | — | Current State §3.5: VI-03 "superseded by I-08B1" | historical. The VI-02 behaviour clauses still bind | `HISTORICAL / EVIDENCE ONLY` | none | — | — | — |
| P4-GAP-060 | — | G1.2 icons | G1.2 §6 "current small icon/glyph shapes; final iconography system" | — | P2 §13.1 | closed by P2 | `ALREADY CLOSED / SUPERSEDED` | none | — | — | — |
| P4-GAP-061 | I-08N-01 §21 | notification UI | I-08N-01 §21 UI / visual deferrals and numeric frequency rules | — | P3 §3–§16, §19.1 | closed by P3 | `ALREADY CLOSED / SUPERSEDED` | none | — | — | — |
| P4-GAP-062 | — | first use | G1.1 §1 "post-registration Welcome remains a separate copy moment"; G1.1-R3 "not found in any canonical source" | — | I-08A4 §12–§15 freeze the first-use model, the Welcome and the First Conversation Opening | closed by I-08A4. Only the opener relation stays (P4-GAP-034) | `ALREADY CLOSED / SUPERSEDED` | none | — | — | — |
| P4-GAP-063 | — | sign-in requirement | T-14 Email-only; "Email or password is incorrect." | — | P1 §3: `Login ID OR Email` + Password, generic failure | closed by P1. Wording is P4-GAP-031 | `ALREADY CLOSED / SUPERSEDED` | none | — | — | Production Integration |
| P4-GAP-064 | — | notification future channels | I-08N-01 §21: Email, SMS and WhatsApp channels | — | P3 §19.1 | each needs its own Product contract. Not requested | `NO ACTION` | none | — | — | — |
| P4-GAP-065 | V10 A22 / P4-C1 §6 | contextual relevance runtime | [V10 A22/A23](../design/phase-v/QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md) reserves runtime-backed contextual relevance; [P4-C1](../canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md) retires the dedicated Live Context surface but preserves/re-owns the capability | no unified runtime/client authority supplies item-level relatedness to the current conversation across Living Analysis material | T-03D Live Focus supplies current conversational attention; explicit Context Activation supplies user-chosen bindings; Memory/HIM/Hypothesis/Question each have narrower authorities. None is the general item-level relevance contract | Product requirement preserved; runtime/architecture contract and production integration are absent. No relevance-driven spatialization may be claimed until that contract exists | `IMPLEMENTATION ONLY — NOT P4` | admit / carry → `QAN-BL-CTX-01` | `QAN-CTX-01 — Conversational Relevance Runtime` | runtime + integration proof in its future task; accessible non-spatial parity if visualized | `QAN-CTX-01` |

`P4-GAP-057` is in §3.6 below. It was found during the APP-OPS-01 reconciliation. It is not a residual of the
Product / visual canon.

### 3.6 APP-OPS-01 — the one explicit cross-cutting exception

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **APP-OPS-01** | — | App ↔ Company Operations | Product Owner designation + P4-C2 | no canonical closure yet defines the released App ↔ Company Operations contract | P4-C2 resolves `P4-DQ-11` … `17`; CW2-08A resolves DQ-10 | Product Owner decisions are complete. Candidate still requires independent review and later P4 closure; no implementation is authorized | `P4 — CLOSURE / INDEPENDENT REVIEW REQUIRED` | independent review → closure reconciliation | Product Owner decisions complete + independent review | authority reconciliation | End-to-End audit (two fields); Production Integration |
| P4-GAP-057 | CW2-08 §8, H7 | Safety / moderation | [CW2-08 §8](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md): `CASE_SCOPED_MODERATION_ACCESS` bound to exact case, **evidence scope**, purpose, authorized role/service/**person**, validity and audit; "No blanket private-World browsing follows from the moderator role itself". §7 supplies protected `REPORT_CASE` evidence | historical: that wording let an authorized **person** reach case-scoped evidence and limited only blanket private-World browsing, so where scoped evidence was private conversation content it permitted human review, contrary to `PO-OPS-02` | [CW2-08A controlled amendment](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08A_NO_HUMAN_REVIEW_CONTROLLED_AMENDMENT_v1.0.md) (P4-B), binding on merge in its named scope: §8 actor / access wording, H7, the §44 item 5 boundary | closed. No human role or person may receive, inspect or review private QANDEEL conversation content under Safety / Moderation authority; automated Safety processing stays allowed; Public moderation is not decided. The original CW2-08 stays frozen, historical and byte-identical. No replacement moderation mechanism chosen | `ALREADY CLOSED / SUPERSEDED` | none; `P4-DQ-10` is a resolved record | — | — | Connected Worlds `I-09` / CW2-08 for any future moderation / report work, which must obey CW2-08A |

---

## 4. Items proven superseded or implementation-only

The following look open in their source but are **not** P4 decisions.

**Superseded (9):**

| Row | Superseded by |
|---|---|
| P4-GAP-006 Q-LIGHT-SHELL | G3 §C.1, P1 §12 |
| P4-GAP-007 I-08A4 §21 visual list | the I-08B canon, P2, P3 |
| P4-GAP-037 numerals | T-12 §9 |
| P4-GAP-038 gendered Matching address | G2.3 §1, an explicit Product Owner freeze |
| P4-GAP-060 G1.2 icons | P2 |
| P4-GAP-061 I-08N-01 UI | P3 |
| P4-GAP-062 the first-use Welcome | I-08A4 §12–§15 |
| P4-GAP-063 T-14 sign-in requirement | P1 §3 |
| P4-GAP-057 CW2-08 §8 / H7 human case-evidence access | CW2-08A controlled amendment (P4-B), in its named scope |

**Implementation only (12):** production application, ports, craft constants and conformance checks against frozen
runtime law. See §5 for the rows.

**Device / release (1):** P4-GAP-052.

**Dependency-gated (6):** Voice runtime truth (P4-GAP-023 … 026, 035), and one VI-02 trigger (P4-GAP-056).

**Backlog owned (3):** `QAN-BL-VOICE-01`, `QAN-BL-NAV-02`, `QAN-BL-VIS-01`. They are unchanged, and P4-A adds no
duplicate alias for them.

**Owned by a named later task, so `NO ACTION` for P4:**

- Connected Worlds `I-08`: P4-GAP-043;
- Connected Worlds `I-09` / CW2-08: P4-GAP-044. P4-GAP-057 is not here: it is `ALREADY CLOSED / SUPERSEDED` by
  CW2-08A (above).

---

## 5. Count reconciliation

Counted row by row from §3. There are 66 rows: `APP-OPS-01` and `P4-GAP-001` … `P4-GAP-065`.

`P4-GAP-057` sits in §3.6, beside APP-OPS-01, because it was found by the APP-OPS reconciliation.

| Classification | Rows | Count |
|---|---|---:|
| `P4 — VISUAL DECISION REQUIRED` | 019 | 1 |
| `P4 — VISUAL EXECUTION / PROOF REQUIRED` | 018, 021, 022 | 3 |
| `P4 — COPY EXECUTION / PROOF REQUIRED` | 028, 030, 031, 034 | 4 |
| `P4 — CLOSURE / INDEPENDENT REVIEW REQUIRED` | APP-OPS-01 | 1 |
| `ALREADY CLOSED / SUPERSEDED` | 001, 002, 003, 004, 005, 006, 007, 012, 013, 014, 033, 037, 038, 057, 060, 061, 062, 063 | 18 |
| `IMPLEMENTATION ONLY — NOT P4` | 008, 009, 011, 016, 017, 045, 047, 050, 051, 053, 054, 055, 065 | 13 |
| `DEVICE / RELEASE VALIDATION — NOT P4` | 052 | 1 |
| `END-TO-END AUDIT OWNED` | 020, 029, 032, 039, 040, 048, 049 | 7 |
| `BACKLOG OWNED` | 027, 041, 042 | 3 |
| `DEPENDENCY-GATED — CANNOT CLOSE YET` | 023, 024, 025, 026, 035, 056 | 6 |
| `HISTORICAL / EVIDENCE ONLY` | 058, 059 | 2 |
| `NO ACTION` | 010, 015, 036, 043, 044, 046, 064 | 7 |
| **Total** | | **66** |

**One Product Owner decision remains open:** `P4-DQ-06` for `P4-GAP-019` (lantern-in-v1).
