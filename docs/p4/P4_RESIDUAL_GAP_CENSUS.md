# QANDEEL — P4 Residual Gap Census

**Status:** `P4-A CENSUS CANDIDATE — EVIDENCE TABLE — NOT A CLOSURE — DECIDES NOTHING`

| | |
|---|---|
| Track | P4 — Remaining Product / Visual Gaps Census & Closure, task P4-A |
| Canonical baseline | `94aa015deaef1079e2dbbe59b97ed7e5b37c1250` |
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
| `P4 — PRODUCT DECISION REQUIRED` | 6 |
| `P4 — VISUAL DECISION REQUIRED` | 8 |
| `P4 — COPY DECISION REQUIRED` | 7 |
| `P4 — PRODUCT/ARCHITECTURE DECISION REQUIRED` | 2 |
| `ALREADY CLOSED / SUPERSEDED` | 8 |
| `IMPLEMENTATION ONLY — NOT P4` | 12 |
| `DEVICE / RELEASE VALIDATION — NOT P4` | 1 |
| `END-TO-END AUDIT OWNED` | 4 |
| `BACKLOG OWNED` | 3 |
| `DEPENDENCY-GATED — CANNOT CLOSE YET` | 6 |
| `HISTORICAL / EVIDENCE ONLY` | 2 |
| `NO ACTION` | 6 |
| **Total** | **65** |

That is 64 `P4-GAP` rows (`P4-GAP-001` … `P4-GAP-064`) plus `APP-OPS-01`. §5 lists every row by class, so the
count can be checked.

**Current residual gaps needing a P4 decision: 23 rows.** Those are the four `P4 — …` classes. They reduce to 17
Decision Queue rows:

- `P4-DQ-01` … `P4-DQ-09` for the residual Product / visual / copy canon;
- `P4-DQ-10` … `P4-DQ-17` for APP-OPS-01, including `CONTROLLED AMENDMENT REQUIRED — CW2-08`.

Several census rows share one queue row.

---

## 3. Census table

Column key:

- **Canonical ID** — an existing identifier, if any. `P4-GAP` IDs are this package's own. They never reuse a
  backlog ID.
- **P4 action** — what P4 does with the row.
- **Proof needed** — the evidence a closure of the row requires.

### 3.1 Shell / small chrome / placement

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-001 | — | shell placement | [P1 §8](../qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) (one General Settings destination, "secondary Global Shell utility", I-08A4 §7) | where the General Settings **entry** sits in the shell is undecided | [P2 §11](../qandeel-p2-final-iconography-canonical-closure.md) hands it to "the P4 census for remaining placement"; [P3 §17, §19.5](../qandeel-p3-notification-activity-final-realization-canonical-closure.md) "still open"; [artifact index](../design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md) "stay open for P4" | open; explicitly handed to P4 by three closed records | `P4 — PRODUCT DECISION REQUIRED` | decide → `P4-DQ-01` | Product Owner | integrated visual proof in the non-Analysis upper chrome beside P3's Activity entry, AR / EN, RTL / LTR | Production Integration (shell) |
| P4-GAP-002 | — | shell placement / visual | P1 §11: Understanding has "a stable, discoverable entry from Personal QANDEEL. The exact visual placement is later design work"; P1 §16.1 "entry-control visual" | the entry's placement and control form | [P2 §11, §13.5](../qandeel-p2-final-iconography-canonical-closure.md); P3 §19.6 names it "P4" | the Product rule is frozen (P1). Placement and visual are open | `P4 — VISUAL DECISION REQUIRED` | decide → `P4-DQ-02` | Product Owner | visual proof on Personal QANDEEL | Production Integration |
| P4-GAP-003 | — | brand in chrome | [C3 iconography contract §8](../design/canonical-artifacts/living-brass/i-08b3.1-c3/docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md): "The canonical Q stands on every screen… It is a **placement** question" | whether the canonical Q appears on every screen, and where | P2 §13.2 "**not answered by P2**"; P3 §19.6 "P4"; artifact index "stay open for P4". Partial: [G2.3 §1](../design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md) fixes the Q at the Matching attention moment only | open in general. One placement is frozen | `P4 — VISUAL DECISION REQUIRED` | decide → `P4-DQ-03` | Product Owner | visual proof across the shell surfaces | Production Integration |
| P4-GAP-004 | — | small chrome | [C3 freeze record](../design/canonical-artifacts/living-brass/i-08b3.1-c3/docs/C3_FREEZE_RECORD.md) §2: "Final selected-tab design", "Tab geometry, tab container form, tab depth" → "Product/UI integration"; [I-08A4 §21](../canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md) "final physical Global Switcher form" not frozen | Global Switcher container form, tab depth and active-indicator geometry | P2 §5 freezes the navigation glyph family, glyph above word, and SELECTED carried by the E1R marker and word weight. No record freezes the container form | glyphs and state channels closed. Container form and indicator geometry open. This is the roadmap's "final small chrome" | `P4 — VISUAL DECISION REQUIRED` | decide → `P4-DQ-04` | Product Owner | integrated shell proof | Production Integration |
| P4-GAP-005 | G3.1 N3 | Analysis chrome | [G3 §G](../design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md): «سياق الكلام» placement in the Analysis — "Product copy placement. VI-01 / Product; not decided" | where the Live-context label sits in the Analysis | none | open | `P4 — PRODUCT DECISION REQUIRED` | decide → `P4-DQ-04` | Product Owner | Analysis proof, AR / EN | Production Integration |
| P4-GAP-006 | Q-LIGHT-SHELL | Analysis shell | [G2 §F, §G 7](../design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md) "Q-LIGHT-SHELL remains open" | the non-Analysis / Analysis shell appearance | G3 §C.1 and the G2 / F2 amendment; P1 §12 (Dark / Light / System, default Dark; the Analysis always dark) | closed. Implementation open (G3 §F) | `ALREADY CLOSED / SUPERSEDED` | none | — | — | Production Integration |
| P4-GAP-007 | — | shell | I-08A4 §21 "Explicitly NOT Frozen": logo, app icon, colours, typography, material, iconography, notification presentation, detailed motion | these were not frozen by I-08A4 | brand I-08B2.4 / B2.5; the I-08B canon (C3, D2R, E1R, F2, E3, B4R); P2; P3; P2 §9 / P3 §16 | closed by later records. Timing values stay craft (P4-GAP-050) | `ALREADY CLOSED / SUPERSEDED` | none | — | — | — |
| P4-GAP-008 | S-06, S-07 | Return | G3 §G: "Exact Return / Back restoring a PINNED stance … confirmation for the T-07 / T-08 owners; not reopened" | the owners confirm existing runtime behavior | T-07 / T-08 are implemented and unchanged | a conformance check against frozen runtime law, not a Product choice | `IMPLEMENTATION ONLY — NOT P4` | none | — | owner confirmation during the port | Production Integration (T-07 / T-08 owners) |
| P4-GAP-009 | S-09, S-10 | numerals / port | G3 §G: seams S-09 / S-10 "unchanged, with their owners" (VI-01 / port) | the world's digits against the chrome's digits | [T-12 §9](../final-living-analysis-map-integration-v1.md) pins `latn` in both languages; `QAN-BL-T12-02` tombstoned | the v1 numeral policy is closed. Applying it in the ported world is port work | `IMPLEMENTATION ONLY — NOT P4` | none | — | port conformance | Production Integration |
| P4-GAP-010 | — | Return | G2.3 §4 declines "a new general semantic ranking of T-08's six Return acts beyond the reviewed Product contexts" | no general ranking exists | none | a scope boundary, not a deferral (BG-06) | `NO ACTION` | none | — | — | — |
| P4-GAP-011 | G3.2 N3 | motion | G3 §G: F2 timing into the proposal / Shared World "**not universalised**. Their existing Product / motion owners keep the timing" | — | none | the existing owners keep existing timing | `IMPLEMENTATION ONLY — NOT P4` | none | — | device tuning | Production Integration |

### 3.2 Brand entry / app icon / launch application

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-012 | I-08B2.5 | brand lifecycle | [brand SOURCE-PROVENANCE](../design/canonical-artifacts/brand/SOURCE-PROVENANCE.md): "**No standalone brand closure / freeze record exists on this host.**"; [review manifest](../design/canonical-artifacts/brand/i-08b2.5/docs/I-08B2.5_REVIEW_MANIFEST.md): "Not closed, not frozen, not canonical" | the brand package has no lifecycle record | artifact index: "Final production package. No standalone brand closure record". Consumed as authority by closed G1.1, C3, D2R, E1R, F1R2 and P2 §13.7. App icon Variant B was frozen at I-08B2.4 | used as canon downstream, never ratified. The lifecycle is not established | `P4 — PRODUCT DECISION REQUIRED` | decide ratification → `P4-DQ-05` | Product Owner | none beyond the existing package and its geometry verification | P4 closure (index update) |
| P4-GAP-013 | L-1 | app icon | review manifest L-1: the icon SVG header "still reads 'NOT approved, NOT frozen, NOT canonical'… Correcting it is a Product decision and will change the hash" | a stale self-label inside a frozen asset | none | open. It is a byte-identity trade-off | `P4 — PRODUCT DECISION REQUIRED` | decide → `P4-DQ-05` | Product Owner | hash record if the bytes change | P4 closure / Production Integration |
| P4-GAP-014 | — | app icon | [asset report](../design/canonical-artifacts/brand/i-08b2.5/docs/I-08B2.5_FINAL_ASSET_REPORT.md) §13: "The Android 48 dp framing choice… is reported… so Product can confirm or redirect it" | Android adaptive-icon framing | none | awaits Product confirmation | `P4 — VISUAL DECISION REQUIRED` | confirm or redirect → `P4-DQ-05` | Product Owner | adaptive-icon renders; on-device check later | Release |
| P4-GAP-015 | L-5 | app icon | asset report L-5: iOS 18 dark and tinted variants "would need their own Product direction" | whether v1 ships dark and tinted variants, and their direction | none | open | `P4 — VISUAL DECISION REQUIRED` | decide → `P4-DQ-05` | Product Owner | variant visual proof if adopted | Production Integration / Release |
| P4-GAP-016 | L-4, §13 | brand application | asset report L-4: masters "carry no clear space… production use must add its own"; §13: colour tokens "not frozen here" | clear space in use; no global brand colour token | none | these are production-application rules, and the icon values are presentation values | `IMPLEMENTATION ONLY — NOT P4` | none | — | — | Production Integration |
| P4-GAP-017 | — | app icon wiring | `apps/mobile/app.json` has no `icon`, `splash` or `adaptiveIcon` key | the assets are not applied | — | implementation gap | `IMPLEMENTATION ONLY — NOT P4` | none | — | build / device check | Production Integration |
| P4-GAP-018 | — | launch / splash / gateway | no canonical record defines the launch, splash or brand-entry moment. The roadmap §2 P4 examples name "app icon / launch-brand application"; roadmap §3 lists "app launch / splash / brand entry" for the audit | undecided, and the roadmap names it in both places | none | open. The sequencing is ambiguous between P4 and the audit | `P4 — PRODUCT DECISION REQUIRED` | decide sequencing and scope → `P4-DQ-06` | Product Owner | a visual proof of the launch brand application, if P4 closes it | End-to-End audit / Production Integration |
| P4-GAP-019 | — | gateway identity moment | [C3 headroom contract §4](../design/canonical-artifacts/living-brass/i-08b3.1-c3/docs/C3_EXPRESSIVE_HEADROOM_CONTRACT.md): a lantern "can appear at the gateway… **C3 does not design it, does not freeze its animation**"; C3 freeze record: "Lantern animation — later"; "Q-thread expression — later". [T-14 §7](../mobile-product-sign-in-gateway-v1.md): "No logo, no lantern…" | the gateway lantern moment and the Q-thread expression are authorized but undesigned | roadmap §3: T-14 "deliberately excludes logo/lantern/brand treatment" | open. The owner is "later", with no named task | `P4 — VISUAL DECISION REQUIRED` | decide whether it is in or out of v1, and its sequencing → `P4-DQ-06` | Product Owner | motion proof if adopted | End-to-End audit / Production Integration |
| P4-GAP-020 | QAN-BL-AUTH-01 (tombstone) | account entry | T-14 §11 anti-scope: sign-up, password reset, onboarding, brand assets; backlog §7 | lifecycle journeys not designed | P1 §3 and §4 close the sign-in requirement and the sign-up fields; roadmap §3 "Complete Account / Authentication Lifecycle" goes to the audit | the Product requirements are partly closed. The journeys go to the audit | `END-TO-END AUDIT OWNED` | none | — | — | End-to-End audit |

### 3.3 Voice visual language

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-021 | — | Voice visual | [G1.2 §6](../design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md): "current audio strip / waveform / activity morphology; final Voice visual language… **PROOF ONLY — NOT A VISUAL FREEZE**" | the Voice visual language beyond the call controls | P2 §13.1 "**still not frozen**"; P2 §15 "stay governed by G1.2 §6 and the roadmap's P4 census"; P2 F-P2-05: no simulated level | open, under the binding "no fake speaking or activity signal" law (P2 §11.1) | `P4 — VISUAL DECISION REQUIRED` | decide the split → `P4-DQ-08` | Product Owner | integrated Voice / Live Call visual proof, AR / EN | Production Integration; `QAN-BL-VOICE-01` |
| P4-GAP-022 | — | Voice history visual | G1.2 §6 "final call-history material representation"; P2 §11 "call-history media representation" not frozen | how a Voice Note and a finished call appear in history | none | open. The static representation can be decided now; nothing here needs live audio | `P4 — VISUAL DECISION REQUIRED` *(folded into P4-GAP-021's decision)* | decide within `P4-DQ-08` | Product Owner | history visual proof | Production Integration |
| P4-GAP-023 | — | speaking indicator | [P2 §11.1](../qandeel-p2-final-iconography-canonical-closure.md): "A truthful future speaking indicator requires real call / audio runtime truth"; P2 creates "no duplicate backlog alias" | no indicator is frozen, and none may be faked | `QAN-BL-VOICE-01` requires "truthful microphone and route state" | gated on the Voice runtime | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | real runtime signal | `QAN-BL-VOICE-01` |
| P4-GAP-024 | — | Voice Note transcript | G1.2 §6: "whether committed Voice Notes later gain a machine transcript" | whether a transcript exists | none | depends on STT runtime and provider evidence (roadmap §3 benchmark). If it exists, APP-OPS-01 §6 bars it from Company Operations | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | provider / runtime evidence | Voice runtime track (`QAN-BL-VOICE-01`); End-to-End audit |
| P4-GAP-025 | — | native call behavior | G1.2 §6: speaker route, other-system-call hold / interruption UI, barge-in, Voice Note backgrounding, Recents privacy | native / runtime behavior and its presentation | none | needs the native call stack | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | device + runtime | `QAN-BL-VOICE-01` |
| P4-GAP-026 | — | spoken reply | G1.2 §6: "final QANDEEL spoken-reply control on ordinary text turns" | whether, and how, QANDEEL reads text replies aloud | none | a Product capability that depends on TTS / provider evidence | `DEPENDENCY-GATED — CANNOT CLOSE YET` | record only | — | provider evidence | End-to-End audit (provider benchmark); `QAN-BL-VOICE-01` |
| P4-GAP-027 | QAN-BL-VOICE-01 | Voice runtime | G1.2 §8; [backlog §5](../qandeel-canonical-backlog-v1.md) | no Personal Voice / Live Call runtime, no durable audio source | — | `OPEN — UNASSIGNED` | `BACKLOG OWNED` | none | — | — | future Voice runtime task |

### 3.4 Copy

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P4-GAP-028 | — | core surface copy | G3 §G: "Arabic Replay noun and entry names; the English Conversation → Analysis label; Timeline accessible name and preview routes; Live-edge wording while following Live — `OPEN COPY`, unchanged"; origins G1.1 §2, §5 | core labels of the Conversation / Analysis surfaces | [P3-A copy table](../design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/data/COPY_TABLE.md) still carries `door` (EN) and `replay` (AR) as `OPEN` | open. These are the "two `OPEN` strings" of P3 §17 | `P4 — COPY DECISION REQUIRED` | disposition → `P4-DQ-09` | Product Owner (copy) | AR / EN in context | End-to-End audit / Production Integration |
| P4-GAP-029 | — | Matching copy | G3 §G: Matching proof lines («ليه؟», acknowledgement, unavailable, second-accepter, later arrival, welcome) "`OPEN COPY`, unchanged. Product copy owner"; "English Matching copy — `OPEN COPY`. Nothing invented" | the Matching lines beyond G2.3's frozen opener and privacy line | none | open. The owner is "Product copy owner", not Connected Worlds `I-08` | `P4 — COPY DECISION REQUIRED` | disposition → `P4-DQ-09` | Product Owner (copy) | copy in context | Connected Worlds `I-08` (surfaces) |
| P4-GAP-030 | — | notification copy | [P3 §17](../qandeel-p3-notification-activity-final-realization-canonical-closure.md): `PROOF` help lines; «تنبيه أثناء المكالمة» / "Alert during your call"; «قنديل يبادر معايا»; the `DIRECTION` education sheet; the Arabic Snooze words (`PROOF`) — "belong to the roadmap's P4 … census, if P4 determines that they must close before the End-to-End audit" | not canonical | none | open, handed to P4 conditionally | `P4 — COPY DECISION REQUIRED` | decide whether each closes before the audit → `P4-DQ-09` | Product Owner (copy) | copy in context | End-to-End audit / Production Integration |
| P4-GAP-031 | — | account / Understanding copy | P1 §11.3: confidence-state wording "is open copy, in both languages"; P1 §19: Settings group names "explicitly labelled open copy"; P1 §6: the Public ID warning is required but not written; P1 §15.3 "the final failure wording is open copy"; P1 §2.1 Login ID help "microcopy is open" | P1's open copy | P3 §17 approves only «الإشعارات والنشاط» | open | `P4 — COPY DECISION REQUIRED` | disposition → `P4-DQ-09` | Product Owner (copy) | copy in context | End-to-End audit (account lifecycle) |
| P4-GAP-032 | VI-01 `PROPOSED` / `OPEN` rows | legacy copy | [VI-01 README](../design/phase-vi/vi-01-bilingual-product-language/README.md) carried table: "The 8 `PROPOSED` Arabic strings — native rendered-surface judgement"; `OPEN` rows (for example S03 EN "Live Context") | a "later rendered-language pass" with no named task | G1.1 §2 amends VI-01 naming narrowly; other rows untouched | open, with an orphaned owner | `P4 — COPY DECISION REQUIRED` | disposition → `P4-DQ-09` | Product Owner (copy) | rendered-surface review | End-to-End audit |
| P4-GAP-033 | — | brand casing | VI-01 README: "QANDEEL English casing — Brand Integration" (no such task exists) | the English casing of the name | frozen English canon uses "QANDEEL": I-08A4 §13–§15, P1 §10 ("QANDEEL Understanding"), P3 §12. Proofs mix in "Qandeel" | the evidence points one way, but no record states the rule | `P4 — COPY DECISION REQUIRED` | confirm → `P4-DQ-09` | Product Owner | — | Production Integration |
| P4-GAP-034 | — | opener / welcome | G1.1 §1: normal Arabic new-conversation opener «اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ», and "The exact post-registration Welcome remains a separate copy moment"; I-08A4 §14 First-Use Welcome and §15 First Conversation Opening «أنا معك يا {display_name}.» | how G1.1's normal opener relates to I-08A4 §15; G1.1 gives no English normal opener | none reconciles them | a compatible reading exists (first conversation vs later new conversations), but it is not stated | `P4 — COPY DECISION REQUIRED` | confirm → `P4-DQ-09` | Product Owner (copy) | — | End-to-End audit (first use) |
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

`P4-GAP-057` is in §3.6 below. It was found during the APP-OPS-01 reconciliation. It is not a residual of the
Product / visual canon.

### 3.6 APP-OPS-01 — the one explicit cross-cutting exception

| ID | Canonical ID | Domain | Source | Exact unresolved state | Later authority | Current truth | Classification | P4 action | Decision owner | Proof needed | Downstream owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **APP-OPS-01** | — | App ↔ Company Operations | Product Owner designation (P4-A Task Contract §0, §4, §7–§24) | no canonical record defines what the Company may receive from, and change in, the released App | consumes Telemetry v1, Outbox v1, Startup Recovery v1, Health v1, Model Router, FAST / DEEP v2, Safety Runtime, CW2-02 / 03 / 04 / 08 ([matrix](P4_AUTHORITY_COMPATIBILITY_MATRIX.md)) | contract **candidate** written: [APP_OPS_01 candidate](APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md). **NOT FROZEN** | `P4 — PRODUCT/ARCHITECTURE DECISION REQUIRED` | review; answer `P4-DQ-10` … `P4-DQ-17`; close in a later P4 change | Product Owner + independent review | none visual; authority reconciliation | End-to-End audit (two fields); Production Integration (implementation) |
| P4-GAP-057 | CW2-08 §8, H7 | Safety / moderation | [CW2-08 §8](../canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md): `CASE_SCOPED_MODERATION_ACCESS` bound to "evidence scope" and "authorized role/service/person"; "No blanket private-World browsing follows from the moderator role itself" | frozen canon permits exceptional, case-scoped **human** access to private-World evidence. `PO-OPS-02` forbids exceptional human review for safety monitoring | none | a real authority conflict: **`CONTROLLED AMENDMENT REQUIRED — CW2-08`**. Nothing is amended in P4-A | `P4 — PRODUCT/ARCHITECTURE DECISION REQUIRED` | record; stop before editing CW2-08 → `P4-DQ-10` | Product Owner (controlled change) | — | a controlled CW2-08 amendment task |

---

## 4. Items proven superseded or implementation-only

The following look open in their source but are **not** P4 decisions.

**Superseded (8):**

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

**Implementation only (12):** production application, ports, craft constants and conformance checks against frozen
runtime law. See §5 for the rows.

**Device / release (1):** P4-GAP-052.

**Dependency-gated (6):** Voice runtime truth (P4-GAP-023 … 026, 035), and one VI-02 trigger (P4-GAP-056).

**Backlog owned (3):** `QAN-BL-VOICE-01`, `QAN-BL-NAV-02`, `QAN-BL-VIS-01`. They are unchanged, and P4-A adds no
duplicate alias for them.

**Owned by a named later task, so `NO ACTION` for P4:**

- Connected Worlds `I-08`: P4-GAP-043;
- Connected Worlds `I-09` / CW2-08: P4-GAP-044.

---

## 5. Count reconciliation

Counted row by row from §3. There are 65 rows: `APP-OPS-01` and `P4-GAP-001` … `P4-GAP-064`.

`P4-GAP-057` sits in §3.6, beside APP-OPS-01, because it was found by the APP-OPS reconciliation.

| Classification | Rows | Count |
|---|---|---:|
| `P4 — PRODUCT DECISION REQUIRED` | 001, 005, 012, 013, 018, 039 | 6 |
| `P4 — VISUAL DECISION REQUIRED` | 002, 003, 004, 014, 015, 019, 021, 022 | 8 |
| `P4 — COPY DECISION REQUIRED` | 028, 029, 030, 031, 032, 033, 034 | 7 |
| `P4 — PRODUCT/ARCHITECTURE DECISION REQUIRED` | APP-OPS-01, 057 | 2 |
| `ALREADY CLOSED / SUPERSEDED` | 006, 007, 037, 038, 060, 061, 062, 063 | 8 |
| `IMPLEMENTATION ONLY — NOT P4` | 008, 009, 011, 016, 017, 045, 047, 050, 051, 053, 054, 055 | 12 |
| `DEVICE / RELEASE VALIDATION — NOT P4` | 052 | 1 |
| `END-TO-END AUDIT OWNED` | 020, 040, 048, 049 | 4 |
| `BACKLOG OWNED` | 027, 041, 042 | 3 |
| `DEPENDENCY-GATED — CANNOT CLOSE YET` | 023, 024, 025, 026, 035, 056 | 6 |
| `HISTORICAL / EVIDENCE ONLY` | 058, 059 | 2 |
| `NO ACTION` | 010, 036, 043, 044, 046, 064 | 6 |
| **Total** | | **65** |

**23 rows need a P4 decision.** They map onto 17 Decision Queue rows:

| Decision Queue row | Census rows |
|---|---|
| `P4-DQ-01` | 001 |
| `P4-DQ-02` | 002 |
| `P4-DQ-03` | 003 |
| `P4-DQ-04` | 004, 005 |
| `P4-DQ-05` | 012, 013, 014, 015 |
| `P4-DQ-06` | 018, 019 |
| `P4-DQ-07` | 039, and 040 by reference |
| `P4-DQ-08` | 021, 022 |
| `P4-DQ-09` | 028 … 034 |
| `P4-DQ-10` | 057, APP-OPS-01 |
| `P4-DQ-11` … `P4-DQ-17` | APP-OPS-01 |