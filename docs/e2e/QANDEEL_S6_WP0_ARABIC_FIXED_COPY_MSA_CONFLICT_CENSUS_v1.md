# QANDEEL — Stage 6 WP0 — Fixed Arabic Copy Language Census and Proposed Controlled Copy Amendments — v1

**Authority:** the Product Owner's binding QANDEEL-wide language and localization rule (2026-10-13). It is recorded in
the [Stage 6 WP0 record](QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14.1 and summarized there in
§14.8.
**Baseline:** `main = 135142004097136336d586e5d5ff6cfd119cd864`, read on branch `s6/s6-wp0-matching-introductions-census`
(Draft PR #335).
**Status:** `PROPOSED — CENSUS AND DRAFT CONTROLLED COPY AMENDMENTS — NOT APPROVED — NOTHING IMPLEMENTED`.

> **LANG-01 note (2026-10-13).** The status line above records this census as published. The Product Owner's editorial
> approval register of 2026-10-13 has since approved all 109 units: 39 with an explicit final wording, 70 as the
> «Proposed» below, verbatim. Each unit's exact approved text and disposition is in the
> [LANG-01 resolved manifest](lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json). The controlled amendments
> are the [LANG-01 controlled amendment](../canonical-authority/final-product-experience/lang/QANDEEL_LANG01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CONTROLLED_AMENDMENT_v1.0.md)
> and the [G2.3 one](../design/i-08b3.1-g2.3/G2_3_LANG01_MATCHING_COPY_CONTROLLED_AMENDMENT.md); the
> [LANG-01 record](QANDEEL_LANG_01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CORRECTION_RECORD_v1.md) tracks what is
> implemented. No unit, original or proposal below is changed: the LANG-01 static contract derives the approved texts
> from them.

> This document changes no copy. Every original below keeps its approval as history. No replacement is applied to code,
> tests, frozen records or proofs until the Product Owner approves it in a Copy Gate, unit by unit or family by family.
> The task that would apply an approved amendment is not named here. Every proposed Arabic sentence is a draft for the
> Product Owner's review, written by read-only reviewers, and is not approved copy. English copy is reviewed separately
> and is out of scope.

---

## 1. The rule this census applies

The Product Owner's decision of 2026-10-13 distinguishes two kinds of Arabic:

- **A. Dynamic QANDEEL conversation.** Genuinely generated conversational responses, spoken or written, adapt to the
  user's preferred language, dialect and interaction preferences.
- **B. Fixed Arabic application copy.** All static Arabic copy uses neutral Modern Standard Arabic or simplified Modern
  Standard Arabic, understandable across the Arab world. It covers:
  - navigation and screen titles;
  - buttons, labels and settings;
  - onboarding and guided setup;
  - prewritten QANDEEL messages in guided conversations;
  - consent and privacy explanations;
  - Matching proposals and system notices;
  - Activity and Push notifications;
  - error, success and empty states;
  - accessibility labels and instructional copy;
  - Introduction lifecycle and disclosure messages.

  No Egyptian or other regional dialect is the default for fixed strings. The Arabic is natural, concise, welcoming and
  **gender-considerate**. A scripted message in a chat bubble is not generated content, so it follows rule B.

Where frozen G2 / G2.3 or other approved Arabic copy conflicts with the rule:
1. identify the exact conflict;
2. propose a controlled Copy Amendment that shows the original and the recommended replacement;
3. keep the original approval as history;
4. never rewrite frozen text silently;
5. implement no replacement before approval.

This census does steps 1 and 2 for every conflict found. Steps 3–5 are commitments that it keeps.

## 2. Method and coverage

Seven read-only reviewers worked on 2026-10-13, in parallel and on disjoint scopes. Each fixed string was read in place,
with its provenance (CANON, APPROVED, PROOF or FIXTURE, none stated) taken from the code comment or the record that
approved it.

| Scope | Strings reviewed | Conform | Conflict rows |
|---|---:|---:|---:|
| Personal chrome, conversation, understanding, analysis language, temporal navigation, timeline (mobile; also every other Arabic-bearing mobile file outside the scopes below) | 163 | 160 | 3 |
| Public World and Public authoring (mobile and API) | 86 | 77 | 9 |
| Activity, attention, notifications and push (mobile and API) | 139 | 131 | 8 |
| Shared World (mobile and API, except the Shared Activity copy) | 106 | 92 | 14 |
| Server-side messages in `apps/api/src`: safety replies, memory control, interaction preferences | 53 | 23 | 30 |
| Settings, account, access and sign-in (mobile) | 148 | 114 | 34 |
| Design and canonical copy authorities: G2 / G2.3 / G3, VI-01, I-08A4, I-08N-01, P3 / P4, W1B-01 and the e2e Copy Gate records | 230 | 179 | 49 |
| **Total** | **925** | **776** | **147** |

Two more design strings are historical (I-08A4 §14–§15, superseded by W1B-01) and are neither conforming nor in
conflict. The scopes overlap by design: a code string and the record that approved it are both counted. After that
overlap is merged, **the 147 rows are 109 amendment units (§4)**.

**Verification.** Every quoted original (147 rows) was checked verbatim against its cited file at the baseline by
script. Arabic-bearing files outside the scopes were checked too:
- `apps/mobile/src/runtime-entry/*` holds Arabic in comments only;
- `apps/mobile/scripts/*` are proof generators;
- migrations hold no Arabic copy (one digit-normalization set and one comment);
- the `database/verify-*` files are tests.

**Excluded, because they are not fixed copy under the rule:**
- input recognisers and cue lists (for example the Egyptian acquisition cues of MEM-AR-01). They recognise what people
  say and are never shown;
- tests, fixtures, golden and evaluation suites;
- model prompts and personality cores. They instruct the model and are consistent with rule A;
- generated output, code comments and English copy;
- dialect names used as option labels (for example «مصري», «شامي» in Interaction Preferences), which are MSA labels;
- frozen product names («قنديل», «التعارف», «العالم المشترك»), which are unchanged.

**Conflict kinds:**
- `DIALECT`: Egyptian or other colloquial vocabulary or grammar;
- `GENDER`: a masculine-only address to the reader where a natural neutral form exists, or masculine agreement with a
  named person who may be a woman;
- `DIALECT+GENDER`: both;
- `REGISTER`: none was found.

The replacements use VI-01 §3.6.2's techniques, which are already approved:
- the verbal noun (masdar), as in «يُرجى إدخال…» and «إعادة المحاولة»;
- the unvowelled `-ك` suffix, which is neutral in script;
- object-first or state sentences;
- the dual for the matched pair.

## 3. The language authorities

The rule also meets the documents that set QANDEEL's language. Those documents are not copy, but they are why the
copy is as it is. (The `LANG-` ids are this census's own. They are unrelated to the `LA-VIS-01` / `LA-SCALE-01` task ids, and IP-IMP-01's Copy Addendum decisions are written "CA-1" / "CA-2" in full where cited.)

**Precedence until the amendments are approved.** The Product Owner's rule binds every new or amended fixed string at every Copy Gate. The conflicting frozen language authorities below stay in force as written until their controlled amendments are approved, and nothing frozen is superseded by this census.

| ID | Authority | Classification | What it says today | Recommendation |
|---|---|---|---|---|
| LANG-01 | VI-01 T2 · Voice (`QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md:104-105`, `:207`; README `:47-48`) | CONFLICT | QANDEEL's conversational turns use restrained Egyptian for the launch experience, scripted or not | One controlled VI-01 amendment. It splits T2 into generated turns (rule A, adapting through ACE-01 / IP-IMP-01, with the §3.4 bounds when Egyptian is used) and scripted turns (rule B: neutral MSA, gender-considerate) |
| LANG-02 | VI-01 T3b · Analysis prose (`:209`) | CONFLICT | Analysis statements are restrained Egyptian | In the same amendment: fixed analysis templates become MSA, generated reading prose follows rule A, and flatness is kept |
| LANG-03 | VI-01 §3.2 (`:225`, `:258`, `:272-275`) | CONFLICT | "Neutral" is "not MSA-by-default". The fixed-copy flavour gate is a review preference, and «مش» / «لسه» are case by case | In the same amendment: the gate is binding for T1, T3a, T4 and scripted voice. The comprehension test and the "no bureaucratic copy" principle are kept |
| LANG-04 | VI-01 §3.4 (`:299-313`) | REFINED | How far Egyptian may go in T2 | Scope it to generated Egyptian output only |
| LANG-05 | VI-01 §14 (`:954`, `:967-970`) and P4-C3's `RUNTIME_GATED` rows | REFINED | Voice and call strings are provisional, with Egyptian examples | They are authored in MSA when `QAN-BL-VOICE-01` writes them (units V-01 … V-03) |
| LANG-06 | VI-01 Copy Patterns P11 (`QANDEEL_VI01_COPY_PATTERNS.md:296-297`) | REFINED | The colloquial «جرّب تاني» stays available to the voice | True for generated turns only; a scripted retry is MSA |
| LANG-07 | G2.3 §1 (`QANDEEL_G2_3_CANONICAL_CLOSURE.md:31`) | CONFLICT | "No gender-neutral rewrite is authorized by G2.3" | A controlled Copy Amendment beside G2.3, on the pattern of [the T11 controlled amendment](../design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md) that already sits there. It quotes the three originals (units M-01 … M-03) and supersedes only their wording and `:31`. G2.3's bytes and its §8 approval stay as history; the §2 copy-only clarification carries forward; G2 §D then points to the amended wording. The byte-preserved proof copies are not edited |
| LANG-08 | G1.1 §1 and P4-C4's `opener` row (`QANDEEL_P4C4_FINAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md:54-58`); P4-C3 check C-COPY-1 | CONFLICT | The opener's colloquial «يلا» and hamza-less spelling are frozen, and a proof check rejects any letter change | Amend the `opener` row only (unit Q-01). P4-C4's other 103 rows are MSA and stay untouched. The check and code pins change only with the approved amendment |
| LANG-09 | W1B-01 (`…_CONTROLLED_AMENDMENT_v1.0.md:77-79`, `:91-92`, `:107`) | CONFLICT | The approved Welcome and First Conversation Opening are Egyptian or masculine, and the opener "needs no amendment" | An additive copy amendment to W1B-01 §3.1–§3.2 that keeps W1B-01's bytes, coordinated with LANG-08 (units Q-02 … Q-04) |
| LANG-10 | A3-02 Copy Gate §24a (`QANDEEL_A3_02_…_RECORD_v1.md:416-428`) | CONFLICT | The push education sheet is approved in Egyptian, including the Product Owner's own edit «خلّيني» | Units P-01 … P-04. The amendment records that the dialect was a deliberate Product Owner edit |
| LANG-11 | W3-MEGA-M §6 (`QANDEEL_W3_MEGA_M_…_RECORD_v1.md:185-186`) | CONFLICT | "Egyptian conversational" Arabic for every memory-control reply | Units MEM-01 … MEM-23 |
| LANG-12 | MEM-AR-01 L-10 / L-11 (`QANDEEL_MEM_AR_01_…_RECORD_v1.md:700-709`) | CONFLICT | The locked subject question and labels are Egyptian | Units MEM-15, MEM-18 and MEM-19. They are byte-pinned, and the recogniser coupling is in §5 |
| LANG-13 | E1R Arabic copy contract (`E1_ARABIC_COPY_CONTRACT.md:17`) | CONFLICT | "onboarding, empty states, nudges: warm; light colloquial is welcome" | Amend that row to simplified MSA, carrying warmth in wording and not dialect. The errors / consent row is already consistent |
| LANG-14 | I-08A4 §11 (`:337`) | REFINED | "Restrained Egyptian-compatible warmth may remain the current/default conversational profile where appropriate" | Valid for generated replies only. The default when no preference is stated is an open question (§6) |
| LANG-15 | The proof root language tag `ar-EG` (`P4C_ACCESSIBILITY_RTL.md:42`; g3.2 `content.mjs:26`) | REFINED | An Egypt region tag on proof pages | An engineering question: whether production fixed copy is tagged `ar` |

**Consistent with the rule, and unchanged:**
- VI-01 T1 / T3a / T4 ("neutral contemporary Arabic": MSA lexicon, contemporary syntax);
- VI-01 §3.3 (one Arabic product language), §3.6 (addressee gender policy) and §16 rule 3;
- I-08A4 §11 (fixed chrome);
- I-08N-01 D18 and D18A ("no hard-coded Egyptian"; a neutral fallback);
- the P3 closure; the P4-C3 register line;
- IP-IMP-01 CA-2 (the dialect preference itself);
- the ACE-01 and ACE-SP-01 personality cores; Conversational Personality v1;
- the Behavioral Runtime;
- the T-14 register. Its §5 claim that its strings are gender-neutral is contradicted by «حاول مرة أخرى» (unit A-07).

## 4. Amendment units

Each unit is one distinct string, merged across every place it is defined or approved. Its status is one of:
- *CONTROLLED COPY AMENDMENT REQUIRED*: approved or frozen copy in force;
- *IN FORCE WITHOUT A RECORDED COPY APPROVAL*: the six safety replies. They need Product Owner copy approval and a safety
  review;
- *NOT YET APPROVED COPY*: OPEN proof lines, fixtures, Product Vision examples and provisional voice strings. They need
  no amendment and are authored in MSA at the owning Copy Gate.

"Where" lists every definition and approving record. "Notes" carries the test pins and code couplings the reviewers
found. The implementing task must re-verify them.

| Family | Units | Amendment required | In force, no approval record | Author in MSA (not yet approved) |
|---|---:|---:|---:|---:|
| M — Matching and Introductions | 16 | 3 | 0 | 13 |
| Q — Prewritten QANDEEL messages (opener, first use) | 4 | 4 | 0 | 0 |
| S — Deterministic safety replies | 6 | 0 | 6 | 0 |
| MEM — Conversational memory control | 23 | 23 | 0 | 0 |
| P — Push permission education | 4 | 4 | 0 | 0 |
| A — Account, access, sign-in, Settings identity | 23 | 23 | 0 | 0 |
| IP — Interaction Preferences | 2 | 2 | 0 | 0 |
| AC — Activity settings | 1 | 1 | 0 | 0 |
| SW — Shared World | 15 | 15 | 0 | 0 |
| PW — Public World and Public authoring | 9 | 9 | 0 | 0 |
| PC — Personal chrome and analysis language | 2 | 2 | 0 | 0 |
| N — Product naming | 1 | 1 | 0 | 0 |
| V — Provisional voice and call strings | 3 | 0 | 0 | 3 |
| **Total** | **109** | **87** | **6** | **16** |

By kind: 34 `DIALECT`, 57 `GENDER` (9 of them third-person agreement with a named person) and 18 `DIALECT+GENDER`.

An independent Arabic-quality review read every unit before publication. It corrected 16 proposals and 5 claims in
"Why" lines; each corrected unit says so in its Notes.

### M — Matching and Introductions (Stage 6 scope)

**M-01 · G2.3 §1 Matching opening (attention cue)** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «قنديل شايف إن في شخص يستحق إنك تتعرف عليه. بناءً على فهمه لكل منكما، شايف إن بينكم مساحة تستحق إنكم تكتشفوها سوا.»
- Proposed: «يرى قنديل أن هناك شخصًا يستحق التعرّف إليه. وبناءً على فهمه لكلٍّ منكما، يرى أن بينكما مساحة تستحق أن تكتشفاها معًا.»
- Where: `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` line 20 (§1 Matching opening copy); line 31 says no gender-neutral rewrite is authorized
- Surface: QANDEEL message: the prewritten Matching attention cue next to the completed Q mark. The cue's accessible name begins with this text (G2.3 proof check C3, product-proofs/g2/g2.3/README.md:109).
- Provenance: CANON I-08B3.1-G2.3 §1. The PO approved the exact opening (§8, lines 168-171). CLOSED / FROZEN, merged in PR #266 (a55af616).
- Why: Egyptian forms: «شايف» (twice), the existential «في», «إن/إنك/إنكم» followed by a bare imperfect verb, «تكتشفوها» and «سوا». Gender: «إنك تتعرف عليه» is masculine singular; the feminine is «تتعرفي». The sentence also mixes registers. «بناءً على فهمه لكل منكما» is MSA in the dual, while «بينكم/تكتشفوها» is the Egyptian plural (VI-01 :219 bars mixing tiers in one sentence). Line 31 of G2.3 withholds any authority for a gender-neutral rewrite, so only a controlled amendment can replace this text.
- Notes: The masdar «التعرّف» carries no addressee gender. The second-person dual «تكتشفاها» is gender-neutral and matches the existing «منكما». The third-person 'QANDEEL sees' framing is kept, and every frozen semantic stays (no score, no reason, no candidate detail). These byte-preserved evidence copies must not be edited: docs/design/canonical-artifacts/product-proofs/g2/g2.3/README.md:41 and product-proofs/g3/g3.2/source/src/content.mjs:82. The G2.3 approval stays as history, and nothing is implemented before PO approval.

**M-02 · G2.3 §2 QANDEEL view in the private proposal** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «قنديل شايف إن بينكم نقاط اتفاق كثيرة، وفي نفس الوقت في اختلافات تستحق إنكم تفهموها بهدوء. لو قررتوا تبدأوا التعارف، قنديل هيكون معاكم يساعدكم تفهموا بعض، ويتكلم معاكم عن نقاط الاتفاق والاختلاف في الوقت المناسب.»
- Proposed: «يرى قنديل أن بينكما نقاط اتفاق كثيرة، وفي الوقت نفسه اختلافات تستحق أن تفهماها بهدوء. وإذا قررتما بدء التعارف، فسيكون قنديل معكما، يساعد كلًّا منكما على فهم الآخر، ويتحدث معكما عن نقاط الاتفاق والاختلاف في الوقت المناسب.»
- Where: `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` line 39 (§2 QANDEEL-view / proposal paragraph)
- Surface: Matching proposal: a prewritten QANDEEL message in the private proposal
- Provenance: CANON I-08B3.1-G2.3 §2. The PO approved the exact QANDEEL-view copy (§8, line 171). CLOSED / FROZEN.
- Why: The whole paragraph is Egyptian: «شايف», «إن بينكم», the existential «في اختلافات», «إنكم تفهموها», «لو قررتوا تبدأوا», the future «هيكون», «معاكم», «تفهموا بعض» and «ويتكلم معاكم». The pair is addressed with the Egyptian plural, which carries no gender in Egyptian. The MSA dual keeps that neutrality.
- Notes: The G2.3 §2 copy-only clarification (lines 48-56) must carry over unchanged: «في الوقت المناسب» still creates no capability. The replacement names no specific agreement or difference (G2 §D). Evidence copies, not to be edited: product-proofs/g2/g2.3/README.md:42 and g3.2/source/src/content.mjs:85.

**M-03 · G2.3 §2 privacy paragraph in the private proposal** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «خصوصيتك محفوظة. بياناتك وتحليلاتك الخاصة لن تُعرض على الطرف الآخر، ولن يُشارك منها شيء إلا ما تختار أنت مشاركته. وقنديل هيكون معك خطوة بخطوة لحد ما تكون مرتاح ومطمئن.»
- Proposed: «خصوصيتك محفوظة. لن تُعرض بياناتك وتحليلاتك الخاصة على الطرف الآخر، ولن يُشارَك منها شيء إلا باختيارك. وسيكون قنديل معك خطوة بخطوة، حتى تكتمل راحتك وطمأنينتك.»
- Where: `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` line 41 (§2 privacy paragraph)
- Surface: Consent and privacy explanation in the private Matching proposal
- Provenance: CANON I-08B3.1-G2.3 §2. The PO approved the exact privacy copy (§8, line 171). CLOSED / FROZEN.
- Why: Sentences 1-2 are MSA and use the neutral -ك possessives. However, «ما تختار أنت مشاركته» is masculine singular; the feminine is «تختارين». Sentence 3 is Egyptian («هيكون», «لحد ما») and masculine: «تكون مرتاح ومطمئن», where the feminine is «تكوني مرتاحة ومطمئنة». MSA would also require «مرتاحًا ومطمئنًا».
- Notes: «باختيارك» is VI-01's reader-agency technique (VI-01 Foundation :391-395). The replacement does not weaken the privacy sentence (G2.3 :55-56). Evidence copies: product-proofs/g2/g2.3/README.md:43 and g3.2/source/src/content.mjs:86. — Corrected by the independent Arabic-quality review before publication. It keeps the original's comfort («مرتاح») as «راحتك».

**M-04 · Matching cue action label (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «ليه؟»
- Proposed: «لماذا؟»
- Where: `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` line 133 (§6). The same label appears in G2 closure :259 (§G item 1), G3 closure :196, G3 handoff :133 and g3.2 content.mjs:83 (matchCueAct).
- Surface: Button: Matching cue action label
- Provenance: None stated: PROOF COPY — OPEN (G2.3 §6; G2 §G item 1; G3 §G 'OPEN COPY')
- Why: «ليه» is colloquial Egyptian/Levantine for 'why'.
- Notes: Not frozen, so no controlled amendment is needed. The S6 Matching Copy Gate (WP0 GATE-28) must author it in MSA. A fuller control label such as «لماذا هذا الاقتراح؟» may read better.

**M-05 · First-recipient explanatory line (OPEN proof copy)** — DIALECT+GENDER — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «لو كمّلت، هيتعرض التعارف على الطرف التاني.»
- Proposed: «عند المتابعة، سيُعرض التعارف على الطرف الآخر.»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 87 (key propNextA)
- Surface: Matching proposal: the first-recipient explanatory line ('continuing approves forwarding')
- Provenance: None stated: PROOF COPY — OPEN (G3.2 final proof; G3 closure :196)
- Why: Egyptian: «لو», «كمّلت», the future «هيتعرض» and «التاني». Gender: the Egyptian perfect «كمّلت» is masculine, and the feminine «كمّلتي» is written out (VI-01 §3.6.1 :347).
- Notes: This is proof copy, so the file must not be edited (byte-preserved). Ratifying it at the S6 Copy Gate requires MSA.

**M-06 · Second-accepter explanatory line (OPEN proof copy)** — DIALECT+GENDER — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «لو كمّلت، هيتفتح لكم عالم مشترك للتعارف على طول.»
- Proposed: «عند المتابعة، سيُفتح لكما عالم مشترك للتعارف فورًا.»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 88 (key propNextB; G2 §G item 4, the second-accepter explanatory copy)
- Surface: Matching proposal: second-accepter explanatory line (Introduction lifecycle)
- Provenance: None stated: PROOF COPY — OPEN (G2 §G item 4; G3 :196)
- Why: Egyptian: «لو», «هيتفتح», «لكم» used for a pair, and «على طول». The masculine «كمّلت» is gender-marked.
- Notes: Proof-only. It must be MSA when authored at the S6 Copy Gate.

**M-07 · Decline act (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «لأ، شكراً»
- Proposed: «لا، شكرًا»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 89 (key notNow)
- Surface: Button: decline act in the private proposal
- Provenance: None stated: PROOF COPY — OPEN (the decline act and its copy are open)
- Why: «لأ» is colloquial negation.
- Notes: «أكمّل» (key proceed, same line) is first person and acceptable in MSA. It is counted as OK.

**M-08 · First-accepter acknowledgement (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «وصل ردّك لقنديل، ولو جدّ جديد هيقولك.»
- Proposed: «وصل ردّك إلى قنديل، وسيُخبرك إذا استجدّ شيء.»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 90 (key ack; G2 §G item 2)
- Surface: System notice: first-accepter acknowledgement
- Provenance: None stated: PROOF COPY — OPEN (G2 §G item 2)
- Why: Egyptian: the conditional «لو» and the future «هيقولك».
- Notes: Proof-only.

**M-09 · Neutral unavailable state (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «التعارف ده مبقاش متاح.»
- Proposed: «لم يعد هذا التعارف متاحًا.»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 91 (key unavailable; G2 §G item 3)
- Surface: System notice: neutral unavailable state
- Provenance: None stated: PROOF COPY — OPEN (G2 §G item 3)
- Why: Egyptian: «ده» and «مبقاش».
- Notes: The Matching Product Definition's neutral example «الترشيح لم يكتمل.» (QANDEEL_MATCHING_PRODUCT_DEFINITION_v1.md:276) is already MSA.

**M-10 · Dismissing the ended state (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «تمام»
- Proposed: «حسنًا»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 92 (key endedAct)
- Surface: Button: dismissing the ended / unavailable state
- Provenance: None stated: PROOF COPY — OPEN
- Why: Colloquial «تمام» used as 'OK'.
- Notes: Proof-only.

**M-11 · First-accepter later arrival (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «الطرفين وافقوا على التعارف»
- Proposed: «وافق الطرفان على التعارف.»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 93 (key arrivalLine; G2 §G item 5)
- Surface: Introduction lifecycle message: first-accepter later arrival
- Provenance: None stated: PROOF COPY — OPEN (G2 §G item 5)
- Why: Colloquial case and agreement. MSA requires «وافق الطرفان».
- Notes: «عالمكم المشترك» (arrivalAct, line 94) is MSA and counted as OK. The dual «عالمكما المشترك» would be more exact.

**M-12 · Introduction-phase welcome in the Shared World (OPEN proof copy)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «أهلاً بيكم. أنا هنا معاكم في البداية، وكل واحد فيكم يقرر يشارك إيه وإمتى.»
- Proposed: «أهلًا بكما. أنا معكما في البداية، ولكلٍّ منكما أن يقرّر ماذا يشارك ومتى.»
- Where: `docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs` line 100 (key welcome; G2 §G item 6)
- Surface: QANDEEL message: prewritten Shared World / INTRODUCTION welcome
- Provenance: None stated: PROOF COPY — OPEN (G2 §G item 6)
- Why: Egyptian: «بيكم», «معاكم», «يقرر يشارك», «إيه» and «إمتى».
- Notes: Proof-only. Under the PO decision, a scripted message in a chat bubble follows the static-copy rule.

**M-13 · Product Vision example of a proposal message (illustrative only)** — DIALECT+GENDER — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «هدير ممكن تكون ترشيح قوي ليك. أنا شايف إن بينكم تقارب في جوانب نفسية وشخصية وقيم معينة، وفي جوانب عندها ممكن تكمل احتياجات مهمة عندك. لو حابب، أقدر أبعت لها ترشيح عنك ونشوف هل في إمكانية للتعارف.»
- Proposed: «قد تكون هدير ترشيحًا مناسبًا لك. أرى أن بينكما تقاربًا في جوانب نفسية وشخصية وفي بعض القيم، وأن لديها جوانب قد تكمّل احتياجات مهمة لديك. إذا رغبت، يمكنني أن أرسل إليها ترشيحًا عنك، لنرى إن كانت هناك إمكانية للتعارف.»
- Where: `docs/canonical-authority/connected-worlds-v2/product-vision/QANDEEL_MATCHING_PRODUCT_DEFINITION_v1.md` line 184 (§12; introduced at line 182 as an example)
- Surface: Matching proposal: QANDEEL proposal message (vision example)
- Provenance: None stated: a Product Vision example. Not frozen copy; the frozen proposal copy is G2.3 §2.
- Why: Egyptian: «ممكن تكون», «ليك», «شايف», «في جوانب عندها», «أقدر أبعت لها» and «نشوف هل في». Gender: «لو حابب» is masculine; the feminine is «حابة».
- Notes: Illustrative only and not to be adopted as fixed copy. Separately, the example names reason categories, which G2 §D (:136-142) and G2.3 §2 (:43-46) forbid before the Introduction. That content conflict is outside this census.

**M-14 · Product Vision example of a neutral END notice (illustrative only)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «التعارف انتهى، ومش هنكمل فيه.»
- Proposed: «انتهى هذا التعارف، ولن يُستأنف.»
- Where: `docs/canonical-authority/connected-worlds-v2/product-vision/QANDEEL_MATCHING_PRODUCT_DEFINITION_v1.md` line 441 (§29; introduced at line 439 as an example of neutral wording)
- Surface: Introduction lifecycle message: neutral END notice to the counterpart
- Provenance: None stated: Product Vision example
- Why: Egyptian: «مش هنكمل».
- Notes: The carrier and the copy are open (WP0 GATE-34). — Corrected by the independent Arabic-quality review before publication. «ولن يستمر» after «انتهى» was a tautology.

**M-15 · P3 / P4-C3 fixture: Introductions proposal sentence (FIXTURE_ONLY)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «فيه تعارف جديد في انتظارك»
- Proposed: «هناك تعارف جديد في انتظارك.»
- Where: `docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_DECISION_TABLE.md` lines 268-270 and 294 (keys p3fx.EV.introProposal.text/bounded/preview, p3fx.FEED.F5.text); also P3-A data/COPY_TABLE.md:177-179, :203
- Surface: Push / Activity notification: the Introductions proposal sentence (L2 fixture)
- Provenance: None stated: FIXTURE_ONLY. P4-C4 §10 :185 'does not approve fixture text as Product copy'.
- Why: Uses the Egyptian existential «فيه».
- Notes: Not copy, and it must not be promoted as written. Introductions default to L0 (I-08N-01 D15 :503, :508-510). Any L1/L2 sentence is System Voice, i.e. neutral Product language (D18 :595-599).

**M-16 · P3 / P4-C3 fixture: mutual acceptance preview (FIXTURE_ONLY)** — GENDER — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «قَبِل الطرفان التعارف. افتح التعارف لتكمل.»
- Proposed: «قَبِل الطرفان التعارف. يمكنك فتح التعارف للمتابعة.»
- Where: `docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_DECISION_TABLE.md` line 273 (key p3fx.EV.introAccept.preview); also P3-A data/COPY_TABLE.md:182
- Surface: Push notification preview: mutual acceptance (Introduction lifecycle)
- Provenance: None stated: FIXTURE_ONLY
- Why: «افتح … لتكمل» is a masculine imperative and masculine singular; the feminine is «افتحي … لتكملي». The first sentence is MSA and neutral.
- Notes: Fixture-only, and it must not be promoted as written.


### Q — Prewritten QANDEEL messages in the Conversation and first use

**Q-01 · Normal new-conversation opener (G1.1 §1 / P4-C4 `opener`)** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اهلا يا ${isolate(displayName)} ... انا في انتظارك ... يلا نبدأ»
- Proposed: «أهلًا يا ${isolate(displayName)} ... أنا في انتظارك ... هيّا نبدأ»
- Alternative draft: «أهلًا يا ${isolate(displayName)} ... أنا في انتظارك ... لنبدأ»
- Where: `apps/mobile/src/account/copy.ts` line 139, FIRST_USE_AR.normalOpener; `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md` line 37 (§1 normal Arabic new-conversation opener). It also appears in P4-C3 COPY_DECISION_TABLE.md:57 (key opener), in P4-C4 §2 lines 54-58, and is reaffirmed as unchanged in W1B-01 line 107.
- Surface: Normal new-conversation opener: a prewritten QANDEEL message in an empty conversation (ConversationOpening.tsx:40)
- Provenance: CANON G1.1 §1 and P4-C4 `opener`: docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C4_FINAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md:54-58 (2026-09-27, FROZEN ON MERGE). Restated as unchanged at QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md:107
- Why: «يلا» is a colloquial interjection (Egyptian/Levantine/Gulf), not MSA. «اهلا» and «انا» also drop the hamza (informal spelling), which mixes register with the Welcome's own «أهلًا»/«أنا».
- Notes: Keeps the ellipsis rhythm and the ${isolate(displayName)} placeholder ({display_name}). Gender: «انتظارك» is script-neutral. — The three beats and the spaced ellipses are kept. P4-C3 check C-COPY-1 ('openerdrift', P4C3_PRODUCT_PROOF_REPORT.md:32) rejects any letter change. That check, and any code pin, may change only together with the approved amendment. — Corrected by the independent Arabic-quality review before publication. «هيّا» is MSA, has no gender, and keeps the warmth and rhythm of «يلا».

**Q-02 · First-use Welcome, QANDEEL self-introduction (W1B-01 §3.1)** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أنا قنديل. كل ما نتكلم أكثر، أفهمك أكثر وأتذكر ما يهمك، علشان أساعدك تشوف نفسك وحياتك بشكل أوضح.»
- Proposed: «أنا قنديل. كلما تحدّثنا أكثر، فهمتك أكثر وتذكّرت ما يهمّك، لأساعدك على رؤية نفسك وحياتك بوضوح أكبر.»
- Where: `apps/mobile/src/account/copy.ts` line 134, FIRST_USE_AR.welcome[1] (definition); `docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md` line 78 (§3.1 first-use Welcome, line 2)
- Surface: First-use Welcome body text: QANDEEL's prewritten self-introduction (WelcomeSurface.tsx:55-56)
- Provenance: CANON W1B-01 controlled amendment to I-08A4 §14: docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md:78 (EFFECTIVE / FROZEN ON MERGE, 2026-09-28). Also QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:69
- Why: Egyptian colloquial features: «علشان» ('so that'); «تشوف» (colloquial 'see'); «أساعدك تشوف» (drops the MSA «على/أن»); «كل ما نتكلم» (colloquial form of «كلما تحدثنا»). «تشوف» is also a masculine 2nd-person form, since Egyptian writes the feminine تشوفي out.
- Notes: A prewritten QANDEEL line, so the static-copy rule applies. The -ك suffixes are script-neutral. The frozen product name «قنديل» is unchanged. — W1B-01 §5 :115 says the copy is implemented in apps/mobile/src/account/copy.ts. The same text appears in the W1B-01 implementation record :69.

**Q-03 · First-use Welcome start act (W1B-01 §3.1)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «ابدأ بما يشغلك الآن.»
- Proposed: «لنبدأ بما يشغلك الآن.»
- Where: `apps/mobile/src/account/copy.ts` line 135, FIRST_USE_AR.welcome[2] (start act); `docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md` line 79 (§3.1 Welcome last line, which is also the start act per :103)
- Surface: Welcome start button: visible text and accessibilityLabel (WelcomeSurface.tsx:61,66)
- Provenance: CANON W1B-01 controlled amendment to I-08A4 §14, QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md:79, 2026-09-28
- Why: «ابدأ» is a masculine-singular imperative (feminine: ابدئي).
- Notes: The first-person plural QANDEEL voice is neutral and more welcoming. — The same sentence appears in the superseded I-08A4 §14 :395 (historical; no action) and in the W1B-01 implementation record :70.

**Q-04 · First Conversation Opening, line 2 (W1B-01 §3.2)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «ابدأ بما يشغلك الآن… حتى لو كان شيئًا لا تعرف كيف تصفه بعد. ونبدأ من هناك.»
- Proposed: «لنبدأ بما يشغلك الآن… حتى لو كان شيئًا لم يتّضح لك وصفه بعد. ومن هناك ننطلق.»
- Alternative draft: «لنبدأ بما يشغلك الآن… حتى لو كان شيئًا يصعب وصفه بعد. ومن هناك ننطلق.»
- Where: `apps/mobile/src/account/copy.ts` line 138, FIRST_USE_AR.firstOpening[1] (invitation); `docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md` line 92 (§3.2 First Conversation Opening, line 2)
- Surface: First Conversation Opening: a prewritten QANDEEL message on QANDEEL's side of the conversation, announced as a QANDEEL turn (ConversationOpening.tsx:40-59)
- Provenance: CANON W1B-01 controlled amendment to I-08A4 §15, QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md:92, 2026-09-28
- Why: «ابدأ» is a masculine imperative. «لا تعرف» (feminine: لا تعرفين) and «تصفه» (feminine: تصفينه) are masculine 2nd-person imperfects.
- Notes: The register is MSA. Only the gender marking conflicts. A scripted message in a chat bubble falls under the static-copy rule. — The conversational-personality record :46 treats this opening as frozen copy after which adaptation starts. That is consistent with the static-copy rule. The same text is in the W1B-01 implementation record :77. — Corrected by the independent Arabic-quality review before publication. «بعدُ» meaning 'yet' belongs with a negative verb, and the reader-centred meaning is kept.


### S — Deterministic safety replies (Conversation, Shared and Public)

**S-01 · Self-harm or suicide** — DIALECT+GENDER — *IN FORCE WITHOUT A RECORDED COPY APPROVAL — PO COPY APPROVAL AND SAFETY REVIEW REQUIRED*
- Original: «مش هقدر أساعد في طرق لإيذاء نفسك. لو ممكن تنفّذ دلوقتي، ابعد عن أي حاجة ممكن تستخدمها واتصل بالطوارئ المحلية أو بشخص موثوق يفضل معاك حالًا.»
- Proposed: «لا أستطيع المساعدة في طرق لإيذاء نفسك. إن كنت في خطر الآن، فالأهم هو الابتعاد عن أي شيء قد يؤذيك، والاتصال فورًا بالطوارئ المحلية أو بشخص موثوق يمكنه البقاء معك.»
- Where: `apps/api/src/conversation/safety-response-gate.service.ts` line 10, RESPONSES.SELF_HARM_OR_SUICIDE.ar
- Surface: QANDEEL message: prewritten deterministic safety reply, rendered as the assistant turn when the Safety gate BLOCKs (conversation-orchestrator.service.ts:171). The same reply also flows into Shared World (shared-world/shared-conversation-reply.generator.ts:37) and Public World (public-world/public-qandeel-reply.service.ts:40) replies.
- Provenance: none stated (no comment in the file; a repo-wide search for «الطوارئ المحلية» / «ابعد عن أي» found only this file, so no copy record exists)
- Why: Egyptian forms: «مش هقدر», «لو ممكن», «دلوقتي», «حاجة», «يفضل معاك». Masculine second-person forms addressed to the reader: «تنفّذ», «ابعد», «تستخدمها», «اتصل», «معاك».
- Notes: This is safety-critical copy. The verbal nouns «الابتعاد» and «الاتصال» keep the urgent instruction while removing gendered imperatives. Unvoweled «نفسك» and «معك» read for either gender. The amendment needs safety review as well as copy approval. safety-response-gate.service.spec.ts:102 asserts the reply contains 'مش هقدر' and must be updated in the same change. :182 asserts 'لإيذاء نفسك', which the proposal keeps. English (line 9) is out of scope. — Corrected by the independent Arabic-quality review before publication. «احتمال للتنفيذ» was cold and opaque; the English "who can stay with you" is restored. Safety review decides.

**S-02 · Violence or harm to others** — DIALECT+GENDER — *IN FORCE WITHOUT A RECORDED COPY APPROVAL — PO COPY APPROVAL AND SAFETY REVIEW REQUIRED*
- Original: «مش هقدر أساعد في التخطيط لإيذاء حد أو تنفيذه. ابعد عن أي سلاح وعن الشخص المعني، ولو في خطر فوري اتصل بالطوارئ المحلية. أقدر أساعدك تهدّي الموقف بأمان.»
- Proposed: «لا أستطيع المساعدة في التخطيط لإيذاء أي شخص أو تنفيذه. الأهم الآن هو الابتعاد عن أي سلاح وعن الشخص المعني، وإن كان هناك خطر فوري فيجب الاتصال بالطوارئ المحلية. يمكنني المساعدة في تهدئة الموقف بأمان.»
- Where: `apps/api/src/conversation/safety-response-gate.service.ts` line 14, RESPONSES.VIOLENCE_OR_HARM_TO_OTHERS.ar
- Surface: QANDEEL message: prewritten deterministic safety reply (BLOCK)
- Provenance: none stated
- Why: Egyptian forms: «مش هقدر», «حد», «لو في خطر», «أقدر أساعدك تهدّي». Masculine imperatives addressed to the reader: «ابعد», «اتصل». («تهدّي» has one form for both genders in Egyptian.)
- Notes: Impersonal «يجب الاتصال» and verbal nouns replace the gendered imperatives. Meaning and the three-sentence structure are kept. Needs safety review.

**S-03 · Sexual content involving minors** — DIALECT — *IN FORCE WITHOUT A RECORDED COPY APPROVAL — PO COPY APPROVAL AND SAFETY REVIEW REQUIRED*
- Original: «مش هقدر أساعد في إنشاء أو إيجاد أو وصف محتوى جنسي يتعلق بقاصرين.»
- Proposed: «لا أستطيع المساعدة في إنشاء أو إيجاد أو وصف محتوى جنسي يتعلق بقاصرين.»
- Where: `apps/api/src/conversation/safety-response-gate.service.ts` line 18, RESPONSES.SEXUAL_CONTENT_MINOR.ar
- Surface: QANDEEL message: prewritten deterministic safety reply (BLOCK)
- Provenance: none stated
- Why: «مش هقدر» is Egyptian negation plus the هـ future prefix. The rest of the sentence is already MSA.
- Notes: A minimal change. The original has no gendered address to the reader.

**S-04 · Severe illegal actionable harm** — DIALECT — *IN FORCE WITHOUT A RECORDED COPY APPROVAL — PO COPY APPROVAL AND SAFETY REVIEW REQUIRED*
- Original: «مش هقدر أقدّم تعليمات تمكّن ضررًا جسيمًا أو جريمة. أقدر أساعد ببدائل قانونية أو وقائية تركّز على الأمان.»
- Proposed: «لا أستطيع تقديم تعليمات تُمكّن من إحداث ضرر جسيم أو ارتكاب جريمة. يمكنني المساعدة ببدائل قانونية أو وقائية تركّز على الأمان.»
- Where: `apps/api/src/conversation/safety-response-gate.service.ts` line 22, RESPONSES.SEVERE_ILLEGAL_ACTIONABLE_HARM.ar
- Surface: QANDEEL message: prewritten deterministic safety reply (BLOCK)
- Provenance: none stated
- Why: «مش هقدر» (Egyptian negation plus future) and «أقدر أساعد» (colloquial: no «أن») are dialect forms. «تمكّن ضررًا» is also an ungrammatical collocation.
- Notes: QANDEEL speaks in the first person, and the reader is not addressed with any gender.

**S-05 · High-stakes medical crisis** — DIALECT+GENDER — *IN FORCE WITHOUT A RECORDED COPY APPROVAL — PO COPY APPROVAL AND SAFETY REVIEW REQUIRED*
- Original: «دي ممكن تكون حالة طبية طارئة. اتصل بالطوارئ المحلية أو اطلب رعاية طبية عاجلة حضوريًا دلوقتي، وما تستناش تشخيصًا أونلاين.»
- Proposed: «قد تكون هذه حالة طبية طارئة. يجب الاتصال بالطوارئ المحلية أو طلب رعاية طبية عاجلة حضوريًا الآن، دون انتظار تشخيص عبر الإنترنت.»
- Where: `apps/api/src/conversation/safety-response-gate.service.ts` line 26, RESPONSES.HIGH_STAKES_MEDICAL_CRISIS.ar
- Surface: QANDEEL message: prewritten deterministic safety reply (BLOCK)
- Provenance: none stated
- Why: Egyptian forms: «دي», «دلوقتي», «ما تستناش», plus the colloquial loanword «أونلاين». Masculine imperatives: «اتصل», «اطلب», «ما تستناش».
- Notes: «يجب» plus verbal nouns keeps the urgency without gendered imperatives. Needs safety review.

**S-06 · Third-party facilitation** — DIALECT+GENDER — *IN FORCE WITHOUT A RECORDED COPY APPROVAL — PO COPY APPROVAL AND SAFETY REVIEW REQUIRED*
- Original: «مش هقدر أساعد في طرق تنهي أو تأذي حياة حد. لو ممكن ينفّذ قريب، اتصل بالطوارئ المحلية حالًا وشجّعه يتكلم مع متخصص أو خط مساعدة. أقدر أساعدك تلاقي طرق آمنة تكون جنبه بيها.»
- Proposed: «لا أستطيع المساعدة في طرق لإنهاء حياة شخص أو إيذائه. إن كان هذا الشخص قد يُقدِم على ذلك قريبًا، فيجب الاتصال بالطوارئ المحلية فورًا وتشجيعه على التحدث مع مختص أو خط مساعدة. يمكنني المساعدة في إيجاد طرق آمنة للوقوف إلى جانبه.»
- Where: `apps/api/src/conversation/safety-response-gate.service.ts` line 34, THIRD_PARTY_FACILITATION_RESPONSES.ar
- Surface: QANDEEL message: prewritten deterministic safety reply (BLOCK, third-party facilitation)
- Provenance: none stated
- Why: Egyptian forms: «مش هقدر», «حد», «لو ممكن», «قريب» (meaning 'soon'), «شجّعه يتكلم», «أقدر أساعدك تلاقي», «تكون جنبه بيها». Masculine imperatives and second-person verbs addressed to the reader: «اتصل», «شجّعه», «تكون». («تلاقي» has one form for both genders in Egyptian.)
- Notes: The masculine pronoun for the at-risk third party is kept as the generic form agreeing with «هذا الشخص». No neutral natural alternative exists, and the English uses 'they'. The proposal must not contain 'لإيذاء نفسك' (asserted absent at safety-response-gate.service.spec.ts:182), and it does not. Needs safety review. — Corrected by the independent Arabic-quality review before publication. «حياة أي شخص» left «هذا الشخص» without an antecedent.


### MEM — Conversational memory control (W3-MEGA-M; MEM-AR-01)

**MEM-01 · Inspect reply heading** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «ده اللي فاكره من كلامنا:»
- Proposed: «هذا ما أتذكّره من محادثاتنا:»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 25, LINES.inspectIntro.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 190 (§6 outcome inspect)
- Surface: QANDEEL message: deterministic reply heading to 'what do you remember about me'
- Provenance: APPROVED — W3-MEGA-M §10 'TASK-APPROVED DELEGATED COPY' (memory-control.copy.ts:8), recorded at docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:183,190. The record is MERGED/CLOSED via PR #293 (:7). No approval date is stated.
- Why: «ده», «اللي» and «فاكره» (an Egyptian participle) are colloquial.
- Notes: The W3-MEGA-M design note at memory-control.copy.ts:5 and record :185-186 deliberately chose 'Egyptian conversational' Arabic for all these lines. An amendment supersedes that choice for future copy and keeps the historical approval. Route specs pin these replies, for example conversation/conversation-memory-control.route.spec.ts. — Record :185-186 states the rule 'Egyptian conversational Arabic' for this whole table.

**MEM-02 · Inspect: older items** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «وفيه حاجات أقدم كمان.»
- Proposed: «وهناك أشياء أقدم أيضًا.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 26, LINES.inspectOlder.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 191 (§6 outcome older)
- Surface: QANDEEL message: inspect reply line
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:191
- Why: «فيه» (existential), «حاجات» and «كمان» are Egyptian.

**MEM-03 · Inspect: kept but not relied on** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «وفيه حاجات لسه فاكرها، بس مش بعتمد عليها بناءً على طلبك:»
- Proposed: «وهناك أشياء ما زلت أتذكّرها، لكنني لا أعتمد عليها بناءً على طلبك:»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 28, LINES.inspectKeptNotRelied.ar (and its derived first-section variant at line 88); `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 192 (§6 outcome kept, not relied on)
- Surface: QANDEEL message: inspect reply section heading (memories kept but not relied on)
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:192
- Why: Egyptian forms: «فيه», «حاجات», «لسه», «فاكرها», «بس», «مش بعتمد» (بـ-imperfect).
- Notes: Code coupling: line 88 derives the 'no preceding section' variant with .replace(/^وفيه/u, 'فيه'). If only the string changes, that regex silently stops matching and the heading keeps a dangling «و». The amendment must also change the derivation to «وهناك»→«هناك», or add an explicit first-form line as CQ-1 did.

**MEM-04 · Nothing remembered** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «لسه مش فاكر عنك حاجة محددة.»
- Proposed: «لا أتذكّر عنك شيئًا محددًا حتى الآن.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 31, LINES.nothingRemembered.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 193 (§6 outcome nothing)
- Surface: QANDEEL message: empty state, nothing remembered
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:193
- Why: «لسه», «مش فاكر» and «حاجة» are Egyptian.
- Notes: «فاكر» was QANDEEL's own self-reference, not the reader's gender. The proposal uses the verb «أتذكّر», which avoids a gendered participle.

**MEM-05 · Remembered** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تمام، هفتكر ده:»
- Proposed: «حسنًا، سأتذكّر هذا:»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 32, LINES.remembered.ar (composed at line 95 as '<line> «…»'); `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 194 (§6 outcome remembered)
- Surface: QANDEEL message: success confirmation after a remember command
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:194
- Why: «تمام» (colloquial OK), «هفتكر» (the هـ future prefix) and «ده» are Egyptian.

**MEM-06 · Already remembered** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «فاكر ده أصلًا:»
- Proposed: «أتذكّر هذا بالفعل:»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 33, LINES.alreadyRemembered.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 195 (§6 outcome already)
- Surface: QANDEEL message: no-op confirmation (already remembered)
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:195
- Why: «فاكر» and «ده» are Egyptian, and «أصلًا» here carries the colloquial sense 'already'.

**MEM-07 · Sensitive data declined** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «دي معلومة حساسة، زي كلمة سر أو كود أو رقم هوية، ومش بحتفظ بالحاجات دي.»
- Proposed: «هذه معلومة حساسة، مثل كلمة مرور أو رمز أو رقم هوية، ولا أحتفظ بمثل هذه المعلومات.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 35, LINES.declinedSensitive.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 196 (§6 outcome sensitive)
- Surface: QANDEEL message: decline (sensitive data not kept)
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:196
- Why: Egyptian forms: «دي», «زي», «مش بحتفظ», «الحاجات دي». Also the colloquial loanword «كود».
- Notes: This is a privacy explanation, which the PO lists explicitly.

**MEM-08 · Already correct** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «فاكرها كده أصلًا:»
- Proposed: «أتذكّرها بهذا الشكل بالفعل:»
- Alternative draft: «أتذكرها هكذا بالفعل: «…»»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 38, LINES.alreadyCorrect.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 198 (§6 outcome already correct; reused by MEM-AR-01 :624, :772)
- Surface: QANDEEL message: no-op confirmation (already correct)
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:198
- Why: «فاكرها» and «كده» are Egyptian.
- Notes: The MSA verb also removes QANDEEL's own masculine participle.

**MEM-09 · Target not found** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «مش لاقي حاجة زي كده في اللي فاكره.»
- Proposed: «لا أجد شيئًا كهذا فيما أتذكّره.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 39, LINES.targetNotFound.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 204 (§6 outcome not found)
- Surface: QANDEEL message: not-found state
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:204
- Why: Egyptian forms: «مش لاقي», «حاجة», «زي كده», «اللي فاكره».

**MEM-10 · Target not specified** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تقصد أنهي معلومة بالظبط؟»
- Proposed: «ما المعلومة المقصودة تحديدًا؟»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 40, LINES.targetNotSpecified.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 205 (§6 outcome not specified)
- Surface: QANDEEL message: clarification question
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:205
- Why: «أنهي» and «بالظبط» are Egyptian. «تقصد» addresses the reader in the masculine second person; the feminine would be «تقصدين».
- Notes: The passive participle «المقصودة» removes the gendered verb naturally.

**MEM-11 · Target changed (nothing changed)** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «المعلومة دي اتغيّرت قبل ما أعدّلها، فماغيّرتش حاجة.»
- Proposed: «تغيّرت هذه المعلومة قبل أن أعدّلها، لذلك لم أغيّر شيئًا.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 42, LINES.targetChanged.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 206 (§6 outcome changed)
- Surface: QANDEEL message: error (stale target, nothing changed)
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:206
- Why: Egyptian forms: «دي», «اتغيّرت» (the اتـ passive), «قبل ما», «ماغيّرتش» (the ما…ش negation), «حاجة».
- Notes: This keeps the W3-MEGA-M principle that a failure is framed as the process's (copy.ts:6), not as a confession.

**MEM-12 · Clarification declined** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تمام، ماغيّرتش حاجة.»
- Proposed: «حسنًا، لم أغيّر شيئًا.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 45, LINES.declined.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 207 (§6 outcome declined)
- Surface: QANDEEL message: confirmation that nothing changed (clarification declined)
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:207
- Why: «تمام», «ماغيّرتش» and «حاجة» are Egyptian.

**MEM-13 · Which one** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تقصد أنهي واحدة؟»
- Proposed: «أيّ هذه المعلومات هي المقصودة؟»
- Alternative draft: «أيّ واحدة منها المقصودة؟»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 46, LINES.whichOne.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 201 (§6 outcome which one; reused by MEM-AR-01 :774)
- Surface: QANDEEL message: clarification question before a numbered list
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:201
- Why: «أنهي» is Egyptian, and «تقصد» is a masculine second-person verb addressed to the reader.
- Notes: The numbered options and 'رقمها يكفي.' (line 48, judged OK) follow this line. — Corrected by the independent Arabic-quality review before publication. «أيّها المقصودة؟» is easily misread as the vocative «أيها».

**MEM-14 · One at a time** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «خلّينا ناخدهم واحدة واحدة. تقصد أنهي واحدة الأول؟»
- Proposed: «لنتناولها واحدة تلو الأخرى. بأيّها نبدأ؟»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 47, LINES.oneAtATime.ar; `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 203 (§6 outcome one at a time)
- Surface: QANDEEL message: clarification question
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:203
- Why: Egyptian forms: «خلّينا ناخدهم», «واحدة واحدة», «أنهي», «الأول» (meaning 'first'). «تقصد» is a masculine second-person verb.
- Notes: Corrected by the independent Arabic-quality review before publication. The same vocative misreading as MEM-13 is avoided.

**MEM-15 · Subject question (MEM-AR-01 locked copy)** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «المعلومة دي عنك إنت، ولا عن حد تاني؟»
- Proposed: «هذه المعلومة عنك أنت، أم عن شخص آخر؟»
- Alternative draft: «أهذه المعلومة عنك أنت، أم عن شخص آخر؟»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 50, LINES.subjectQuestion.ar; `docs/e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md` line 709 (§14 L-11, the existing locked subject question; see also :435-439)
- Surface: QANDEEL message: subject clarification question asked when a remember or correct request does not say whom it is about
- Provenance: APPROVED — 'MEM-AR-01C — PRODUCT OWNER LOCKED COPY (Task Contract §9.1). Exact bytes' (memory-control.copy.ts:49). The contract was approved 2026-10-11 (docs/e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md:14). Byte-pinned at tests/mem-ar-01-memory-subject-identity-contract.test.mjs:128.
- Why: Egyptian forms: «دي», «إنت», «ولا» (meaning 'or'), «حد تاني». «إنت» is also the masculine form: Egyptian writes the feminine out («إنتي»).
- Notes: This is PO-locked and byte-pinned, so the amendment must update tests/mem-ar-01-memory-subject-identity-contract.test.mjs:128 and the fixtures at database/verify-migration-0152.mjs:570-571,860. Recognizer coupling: readSubjectAnswer (memory-control.interpreter.ts:329-331) knows only colloquial answers such as «عن حد تاني» and «حد تاني». An MSA echo such as «عن شخص آخر» would not be recognized. Extending the recognizer is a separate, non-copy change that needs its own approval, and the Egyptian coverage must stay. — Corrected by the independent Arabic-quality review before publication. Strict MSA pairs «أم» with «أ», not with «هل».

**MEM-16 · Inspect: about other people** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «وفيه كمان حاجات حكيتلي عنها تخص ناس تانية:»
- Proposed: «وهناك أيضًا أشياء أخبرتني بها عن أشخاص آخرين:»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 52, LINES.inspectAboutOthers.ar
- Surface: QANDEEL message: inspect reply section heading (memories about other people)
- Provenance: APPROVED — MEM-AR-01C Product Owner locked copy (Task Contract §9.1; copy.ts:49). Byte-pinned as 'the Product Owner's locked copy' at tests/mem-ar-01-memory-subject-identity-contract.test.mjs:126,129.
- Why: Egyptian forms: «فيه», «كمان», «حاجات», «حكيتلي», «ناس تانية». «حكيتلي» is also the masculine second-person past (the feminine would be «حكيتيلي»).
- Notes: Unvoweled «أخبرتني» reads for either gender. The byte pin at tests/...:129 must be updated.

**MEM-17 · Inspect: about other people, first-section form (CQ-1)** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «فيه حاجات حكيتلي عنها تخص ناس تانية:»
- Proposed: «هناك أشياء أخبرتني بها عن أشخاص آخرين:»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 57, LINES.inspectAboutOthersFirst.ar
- Surface: QANDEEL message: inspect reply section heading when no section precedes it
- Provenance: APPROVED — CQ-1 (Product Owner, 2026-10-11) per memory-control.copy.ts:55. Byte-pinned at tests/mem-ar-01-memory-subject-identity-contract.test.mjs:130.
- Why: Same as line 52: «فيه», «حاجات», «حكيتلي» (Egyptian, masculine second-person past), «ناس تانية».
- Notes: CQ-1's rule is that the first form drops «كمان». The MSA analogue drops «أيضًا». The mutation check at tests/mem-ar-01-memory-subject-identity-contract.test.mjs:258 ('the CQ-1 heading keeps «كمان»') must be rewritten for the new wording.

**MEM-18 · Subject label: about you (L-10)** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «عنك إنت»
- Proposed: «عنك أنت»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 61, LINES.aboutYou.ar; `docs/e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md` lines 701-702 (§14 L-10 clarification labels)
- Surface: QANDEEL message: subject label on an otherwise identical clarification option
- Provenance: APPROVED — L-10 (Product Owner, 2026-10-12) per memory-control.copy.ts:60; recorded at docs/e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md:695-702. Byte-pinned at tests/mem-ar-01-memory-subject-identity-contract.test.mjs:132.
- Why: «إنت» is the Egyptian spelling of the pronoun and its masculine form; Egyptian writes the feminine out («إنتي»). Unvowelled «أنت» is neutral in script.
- Notes: Must stay consistent with the subjectQuestion amendment (line 50). — Unvowelled «أنت» is gender-neutral in script (VI-01 §3.6.1).

**MEM-19 · Subject label: about someone else (L-10)** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «عن حد تاني»
- Proposed: «عن شخص آخر»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 62, LINES.aboutSomeoneElse.ar
- Surface: QANDEEL message: subject label on an otherwise identical clarification option
- Provenance: APPROVED — L-10 (Product Owner, 2026-10-12) per memory-control.copy.ts:60; record :695-702. Byte-pinned at tests/mem-ar-01-memory-subject-identity-contract.test.mjs:133.
- Why: «حد» (someone) and «تاني» (other) are Egyptian.
- Notes: Must stay consistent with line 50.

**MEM-20 · Corrected reply** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تمام، صحّحتها. بقيت فاكر ${quoteMemory(language, current)} بدل ${quoteMemory(language, previous)}.»
- Proposed: «حسنًا، صحّحتها. أصبحت أتذكّر ${quoteMemory(language, current)} بدلًا من ${quoteMemory(language, previous)}.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 104, correctedReply (ar template); `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 197 (§6 outcome corrected)
- Surface: QANDEEL message: success confirmation after a correction
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:197
- Why: «تمام» and «بقيت فاكر» are Egyptian.
- Notes: Placeholders are kept exactly.

**MEM-21 · Forgotten reply** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تمام، نسيت ${quoteMemory(language, content)} ومش هرجع له تاني.»
- Proposed: «حسنًا، نسيت ${quoteMemory(language, content)} ولن أعود إليه مرة أخرى.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 114, forgottenReply (ar template); `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 199 (§6 outcome forgotten)
- Surface: QANDEEL message: success confirmation after forget
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:199
- Why: «تمام», «مش هرجع» (negation plus هـ future) and «تاني» (meaning 'again') are Egyptian.
- Notes: Placeholder kept exactly.

**MEM-22 · Do-not-rely reply** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تمام، مش هعتمد على ${quoteMemory(language, content)} في كلامنا، بس هفضل فاكرها.»
- Proposed: «حسنًا، لن أعتمد على ${quoteMemory(language, content)} في محادثاتنا، لكنني سأظل أتذكّرها.»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 120, disabledReply (ar template); `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 200 (§6 outcome disabled)
- Surface: QANDEEL message: success confirmation after do-not-rely
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:200
- Why: Egyptian forms: «تمام», «مش هعتمد», «بس», «هفضل فاكرها».
- Notes: Placeholder kept exactly.

**MEM-23 · One-option confirmation question** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تقصد ${quoteMemory(language, options[0])}؟»
- Proposed: «هل المقصود ${quoteMemory(language, options[0])}؟»
- Where: `apps/api/src/memory/memory-control.copy.ts` line 134, clarificationReply single-option (ar template); `docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md` line 202 (§6 outcome one option)
- Surface: QANDEEL message: one-option confirmation question
- Provenance: APPROVED — W3-MEGA-M §10 task-approved delegated copy (copy.ts:8); record docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md:202
- Why: «تقصد» is valid MSA but addresses the reader in the masculine second person (the feminine would be «تقصدين»).
- Notes: A neutral construction exists through the passive participle. Placeholder kept exactly.


### P — Push permission education (A3-02)

**P-01 · Education sheet heading** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «خلّيني أوصلك لما يكون في حاجة تستاهل»
- Proposed: «أودّ أن أتواصل معك حين يستحق الأمر ذلك»
- Alternative draft: «سأصل إليك حين يكون هناك ما يستحق.»
- Where: `apps/mobile/src/push/copy.ts` line 29, PUSH_COPY_GATE.rows.eduTitle (p3.eduTitle); rendered at apps/mobile/src/push/PermissionEducationSheet.tsx:64; `docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md` line 424 (§24a key eduTitle)
- Surface: Heading of the push-permission education sheet: a prewritten QANDEEL first-person message
- Provenance: APPROVED by the A3-02 Product Copy Gate. The Product Owner approved it WITH EDITS: the Arabic «خلّيني» was the Owner's own edit (docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md:414-424; status apps/mobile/src/push/copy.ts:26). Before the gate the registry status was AUDIT_OWNED (tests/a3-02-native-push-platform-delivery-contract.test.mjs:175). The record states no date.
- Why: Egyptian colloquial throughout: «خلّيني» (let me), «لما» (meaning 'when'), «في حاجة» (there is something) and «تستاهل» (is worth it). The MSA calque «دعني» would add a masculine-only imperative, so the replacement uses QANDEEL's first-person future instead.
- Notes: The dialect was introduced by a deliberate Product Owner edit, so the amendment must record and preserve that historical approval. The bytes are pinned in tests/a3-02-native-push-platform-delivery-contract.test.mjs:162, which must change in the same controlled amendment. «معك» is gender-neutral as written. English is out of scope. — P3 closure §11 :401-402 and §17 :578 left this wording unfrozen, and P4-C2 §5 :69 made it audit-owned. A3-02 is the first approval. — Corrected by the independent Arabic-quality review before publication. The approved line is a request ("Let me reach you when it's worth it"), not a promise, and has no «فقط».

**P-02 · Education sheet body** — DIALECT+GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «مش هبعتلك إشعار لمجرد إني أرجعك للتطبيق. هستخدم الإشعارات بس لما يكون في حاجة مهمة ليك، وتقدر تقللها أو توقفها في أي وقت.»
- Proposed: «لن أرسل إليك إشعارًا لمجرد إعادتك إلى التطبيق. سأستخدم الإشعارات فقط عندما يكون هناك ما يهمّك، ويمكنك تقليلها أو إيقافها في أي وقت.»
- Where: `apps/mobile/src/push/copy.ts` line 32, PUSH_COPY_GATE.rows.eduBody (p3.eduBody); rendered at apps/mobile/src/push/PermissionEducationSheet.tsx:67; `docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md` line 425 (§24a key eduBody)
- Surface: Body of the push-permission education sheet: a prewritten QANDEEL first-person message
- Provenance: APPROVED by the A3-02 Product Copy Gate, with Product Owner edits to eduBody in both languages (docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md:416-425). The record states no date.
- Why: DIALECT: Egyptian «مش», the «هـ» future prefix in «هبعتلك» and «هستخدم», «إني», «بس», «لما», «في حاجة» and «ليك». GENDER: «ليك» and «وتقدر تقللها أو توقفها» are masculine second-person forms; the feminine would be «ليكي» and «وتقدري تقلليها أو توقفيها».
- Notes: Pinned in tests/a3-02-native-push-platform-delivery-contract.test.mjs:163. The replacement keeps QANDEEL's first-person voice. «إعادتك», «يهمّك» and «يمكنك» are gender-neutral as written. It keeps the meaning (no re-engagement nudges; notifications can be reduced or turned off) and roughly the same length. — The masdar after «يمكنك» removes the addressee gender.

**P-03 · Education sheet secondary act** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «مش دلوقتي»
- Proposed: «ليس الآن»
- Where: `apps/mobile/src/push/copy.ts` line 38, PUSH_COPY_GATE.rows.eduNotNow (p3.eduNotNow); rendered at apps/mobile/src/push/PermissionEducationSheet.tsx:74-76; `docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md` line 427 (§24a key eduNotNow)
- Surface: Button: the secondary act on the education sheet, also used as its accessibility label
- Provenance: APPROVED by the A3-02 Product Copy Gate, approved as proposed (docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md:416-426). The record states no date.
- Why: Egyptian «مش» (not) and «دلوقتي» (now).
- Notes: Pinned in tests/a3-02-native-push-platform-delivery-contract.test.mjs:166. The same Arabic is also quoted in code comments (PermissionEducationSheet.tsx:8, push-controller.ts:10, :48). Those are comments and need no copy amendment, though they may be updated for accuracy. — «السماح بالإشعارات» (eduAllow, :426) is MSA and is counted as OK.

**P-04 · Confirmation after «Not now»** — DIALECT — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تمام. النشاط هيفضل يظهر هنا جوه التطبيق.»
- Proposed: «حسنًا. سيظل النشاط يظهر هنا داخل التطبيق.»
- Where: `apps/mobile/src/push/copy.ts` line 40, PUSH_COPY_GATE.rows.notNowNote (p3.notNowNote); rendered at apps/mobile/src/settings/NotificationsSection.tsx:407-409; `docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md` line 428 (§24a key notNowNote)
- Surface: Confirmation note shown once after «Not now»: a prewritten QANDEEL message
- Provenance: APPROVED by the A3-02 Product Copy Gate, approved as proposed (docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md:416-427). The record states no date.
- Why: Uses colloquial «تمام» for 'okay', Egyptian «هيفضل» (the «هـ» future plus «يفضل», 'will keep') and Egyptian «جوه» ('inside').
- Notes: Pinned in tests/a3-02-native-push-platform-delivery-contract.test.mjs:167. The replacement matches the already-approved MSA phrasing of p3.osOff at apps/mobile/src/push/copy.ts:66 («وسيظل النشاط يظهر داخل التطبيق»).


### A — Account, access, sign-in and Settings identity copy (W1B-01, W2-01, T-14, W3-02, W3-MEGA-S)

**A-01 · Login ID field help** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «معرّف خاص تستخدمه لتسجيل الدخول إلى قنديل. احتفظ به؛ لن يظهر للآخرين.»
- Proposed: «معرّف خاص لتسجيل الدخول إلى قنديل. يُرجى الاحتفاظ به؛ لن يظهر للآخرين.»
- Where: `apps/mobile/src/account/copy.ts` line 74, ENTRY_AR.loginIdHelp
- Surface: Persistent field help and accessibilityHint for the Login ID field in Create account (EntryParts.tsx:124). Reused as Settings Login ID help (settings/copy.ts:184)
- Provenance: APPROVED W1B-01 task, docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:44 (§2.1). Merged PR #284 6b333df, 2026-09-28
- Why: «تستخدمه» is a 2nd-person masculine imperfect (feminine: تستخدمينه). «احتفظ» is a masculine imperative (feminine: احتفظي). Both visibly address a male reader.
- Notes: A natural neutral alternative exists. Changing it at the source also updates the Settings reuse.

**A-02 · Empty name** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل الاسم.»
- Proposed: «يُرجى إدخال الاسم.»
- Where: `apps/mobile/src/account/copy.ts` line 78, ENTRY_AR.emptyName
- Surface: Inline validation error in Create account. Reused in Settings name change (settings/copy.ts:191)
- Provenance: APPROVED W1B-01 task, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:48 (§2.1), 2026-09-28
- Why: «أدخل» is a masculine-singular imperative (feminine: أدخلي) in fixed copy.
- Notes: Neutral alternative exists (يُرجى + verbal noun). VI-01 §3.6.3 (docs/design/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md:402-407) already bars a single masculine form labelled neutral in fixed strings.

**A-03 · Empty Login ID** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل معرّف الدخول.»
- Proposed: «يُرجى إدخال معرّف الدخول.»
- Where: `apps/mobile/src/account/copy.ts` line 79, ENTRY_AR.emptyLoginId
- Surface: Inline validation error in Create account and Settings Login ID change
- Provenance: APPROVED W1B-01 copy gate, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:86 (§2.2), 2026-09-28
- Why: «أدخل» is a masculine-singular imperative.
- Notes: Neutral alternative exists.

**A-04 · Malformed Login ID** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «استخدم من 3 إلى 30 حرفًا أو رقمًا بالإنجليزية. ويمكن استخدام . أو - أو _ بين الحروف والأرقام.»
- Proposed: «يتكوّن المعرّف من 3 إلى 30 حرفًا أو رقمًا بالإنجليزية، ويمكن استخدام . أو - أو _ بين الحروف والأرقام.»
- Where: `apps/mobile/src/account/copy.ts` line 80, ENTRY_AR.malformedLoginId
- Surface: Inline validation error in Create account and Settings Login ID change
- Provenance: APPROVED W1B-01 copy gate, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:87 (§2.2), 2026-09-28
- Why: «استخدم» is a masculine-singular imperative (feminine: استخدمي). The second sentence is already impersonal.
- Notes: Describes the object instead of instructing the person (VI-01 §3.6.2 technique 1). Digits and the . - _ symbols are kept.

**A-05 · Invalid email** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل بريدًا إلكترونيًا صحيحًا.»
- Proposed: «يُرجى إدخال بريد إلكتروني صحيح.»
- Where: `apps/mobile/src/account/copy.ts` line 81, ENTRY_AR.invalidEmail; `apps/mobile/src/account/access/copy.ts` line 66, ACCESS_AR.invalidEmail
- Surface: Inline validation error in Create account and Settings email change
- Provenance: APPROVED W1B-01 task, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:49 (§2.1), 2026-09-28
- Why: «أدخل» is a masculine-singular imperative.
- Notes: The same text is duplicated at apps/mobile/src/account/access/copy.ts:66, so one amendment covers both. — Duplicate of account/copy.ts:81. Amend both together.

**A-06 · Login ID unavailable** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «معرّف الدخول هذا غير متاح. اختر معرّفًا آخر.»
- Proposed: «معرّف الدخول هذا غير متاح. يُرجى اختيار معرّف آخر.»
- Where: `apps/mobile/src/account/copy.ts` line 83, ENTRY_AR.loginIdUnavailable
- Surface: Inline error in Create account and Settings Login ID change
- Provenance: APPROVED W1B-01 task, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:51 (§2.1), 2026-09-28
- Why: «اختر» is a masculine-singular imperative (feminine: اختاري). It is the exact example named in the PO decision.
- Notes: Neutral alternative exists.

**A-07 · T-14 network sentence** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر الاتصال. حاول مرة أخرى.»
- Proposed: «تعذّر الاتصال. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts` line 93, ARABIC.network; `apps/mobile/src/account/copy.ts` line 85, ENTRY_AR.network; `apps/mobile/src/account/access/copy.ts` line 81, ACCESS_AR.network; `apps/mobile/src/settings/copy.ts` line 339, AR_BASE.publicId.network
- Surface: Sign-in network error notice
- Provenance: CANON T-14 frozen copy, docs/mobile-product-sign-in-gateway-v1.md:3 (CLOSED / FROZEN, PR #225)
- Why: «حاول» is a masculine-singular imperative.
- Notes: This is the origin of the T-14 network sentence. Amending it amends every reuse. — The T-14 sentence is duplicated in scope at access/copy.ts:81, product-sign-in-copy.ts:93 and settings/copy.ts:339, and is reused in other product areas. A softer option that matches the approved W3-MEGA-S siblings (settings/copy.ts:248-249) is «يمكنك المحاولة مرة أخرى». T-14 §5 (docs/mobile-product-sign-in-gateway-v1.md:188-190) claims these strings are gender-neutral, which the imperative contradicts. — One T-14 amendment covers all four in-scope duplicates. — Duplicate of the T-14 origin at product-sign-in-copy.ts:93.

**A-08 · Verify Email instruction** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أرسلنا رمزًا إلى ${isolate(email)}. أدخل الرمز لتأكيد بريدك.»
- Proposed: «أرسلنا رمزًا إلى ${isolate(email)}. يُرجى إدخال الرمز لتأكيد بريدك.»
- Where: `apps/mobile/src/account/copy.ts` line 88, ENTRY_AR.verifyInstruction
- Surface: Verify Email instruction text. Reused as the Settings email-change code instruction (settings/copy.ts:198)
- Provenance: APPROVED W1B-01 task, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:55 (§2.1), 2026-09-28
- Why: «أدخل» is a masculine-singular imperative.
- Notes: The ${isolate(email)} placeholder ({email} in the record) is kept exactly.

**A-09 · Verification code expired (approved, not displayed today)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «انتهت صلاحية رمز التأكيد. أرسل رمزًا جديدًا.»
- Proposed: «انتهت صلاحية رمز التأكيد. يمكنك طلب رمز جديد.»
- Where: `apps/mobile/src/account/copy.ts` line 94, ENTRY_AR.codeExpired
- Surface: Verify Email error state. Approved but deliberately NOT displayed today (account/copy.ts:51-55)
- Provenance: APPROVED W1B-01 task, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:61 (§2.1), 2026-09-28
- Why: «أرسل» is a masculine-singular imperative. It also has the reader 'send' a code that the reader actually requests.
- Notes: Not currently shown. Amend now so it is not shipped later as is.

**A-10 · Resend failed** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر إرسال رمز التأكيد. حاول مرة أخرى.»
- Proposed: «تعذّر إرسال رمز التأكيد. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/account/copy.ts` line 95, ENTRY_AR.resendFailed
- Surface: Verify Email error message
- Provenance: APPROVED W1B-01 task, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:62 (§2.1), 2026-09-28
- Why: «حاول» is a masculine-singular imperative.
- Notes: Neutral alternative exists.

**A-11 · Verify failed** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر تأكيد البريد الإلكتروني الآن. حاول مرة أخرى.»
- Proposed: «تعذّر تأكيد البريد الإلكتروني الآن. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/account/copy.ts` line 96, ENTRY_AR.verifyFailed
- Surface: Verify Email error message
- Provenance: APPROVED W1B-01 copy gate, QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md:88 (§2.2), 2026-09-28
- Why: «حاول» is a masculine-singular imperative.
- Notes: Neutral alternative exists.

**A-12 · Recovery code shape** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل رمز إعادة التعيين المكوّن من 6 أرقام.»
- Proposed: «يُرجى إدخال رمز إعادة التعيين المكوّن من 6 أرقام.»
- Where: `apps/mobile/src/account/access/copy.ts` line 70, ACCESS_AR.codeShape
- Surface: Password-recovery code validation message
- Provenance: APPROVED W2-01 copy gate N6 (PO-edited), QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:57, 2026-09-29
- Why: «أدخل» is a masculine-singular imperative.
- Notes: Keeps the PO's edited meaning: an incomplete code is not called incorrect.

**A-13 · Recovery code rejected** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر التحقق من الرمز. تأكد منه أو أرسل رمزًا جديدًا.»
- Proposed: «تعذّر التحقق من الرمز. يُرجى التأكد منه أو طلب رمز جديد.»
- Where: `apps/mobile/src/account/access/copy.ts` line 71, ACCESS_AR.codeRejected
- Surface: Password-recovery code error. Reused in Settings for the email-change code (settings/copy.ts:203)
- Provenance: APPROVED W2-01 copy gate N7, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:58, 2026-09-29
- Why: «تأكد» and «أرسل» are masculine-singular imperatives.
- Notes: «طلب» also fixes the reader 'sending' the code.

**A-14 · Password update failed** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر تغيير كلمة المرور الآن. حاول مرة أخرى.»
- Proposed: «تعذّر تغيير كلمة المرور الآن. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/account/access/copy.ts` line 78, ACCESS_AR.updateFailed
- Surface: Password-recovery new-password error
- Provenance: APPROVED W2-01 copy gate N12, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:63, 2026-09-29
- Why: «حاول» is a masculine-singular imperative.
- Notes: Neutral alternative exists.

**A-15 · Session could not be verified** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر التحقق من جلستك الآن. تحقق من اتصالك وحاول مرة أخرى.»
- Proposed: «تعذّر التحقق من جلستك الآن. يُرجى التأكد من اتصالك والمحاولة مرة أخرى.»
- Where: `apps/mobile/src/account/access/copy.ts` line 82, ACCESS_AR.sessionUnverified
- Surface: Unable-to-verify-session state text, also announced (SessionVerificationRecovery.tsx:57)
- Provenance: APPROVED W2-01 task, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:45 (§2.1), 2026-09-29
- Why: «تحقق» and «حاول» are masculine-singular imperatives.
- Notes: Uses «التأكد» to avoid repeating «التحقق». — Corrected by the independent Arabic-quality review before publication. Without «ـك», «الاتصال» can read as "the call".

**A-16 · Verify linked email instruction** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.»
- Proposed: «يُرجى إدخال رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.»
- Where: `apps/mobile/src/account/access/copy.ts` line 84, ACCESS_AR.verifyLinkedEmailInstruction
- Surface: Verify Email instruction after a Login ID sign-in
- Provenance: APPROVED W2-01 R1, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:91 (§2.4), 2026-09-29
- Why: «أدخل» is a masculine-singular imperative.
- Notes: Still names no email address, as the privacy rule requires.

**A-17 · Missing sign-in identifier** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل معرّف الدخول أو البريد الإلكتروني.»
- Proposed: «يُرجى إدخال معرّف الدخول أو البريد الإلكتروني.»
- Where: `apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts` line 90, ARABIC.missingIdentifier
- Surface: Sign-in validation notice (live region)
- Provenance: APPROVED W2-01 copy gate N1, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:52, 2026-09-29
- Why: «أدخل» is a masculine-singular imperative.
- Notes: The module comment (product-sign-in-copy.ts:27-30) claims «أدخل» is permitted by VI-01 §3.6. But VI-01 §3.6.3 (QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md:402-407) and QANDEEL_VI01_COPY_PATTERNS.md:306 reject gendered imperatives in fixed copy.

**A-18 · Enter password** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل كلمة المرور.»
- Proposed: «يُرجى إدخال كلمة المرور.»
- Where: `apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts` line 91, ARABIC.missingPassword; `apps/mobile/src/settings/copy.ts` line 264, APPROVED_W3_MEGA_S.ar.enterPassword
- Surface: Sign-in validation notice
- Provenance: CANON T-14 frozen copy (docs/mobile-product-sign-in-gateway-v1.md:3, §5 L188-190), reused by W2-01 per QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:78
- Why: «أدخل» is a masculine-singular imperative.
- Notes: Same text as settings/copy.ts:264 (enterPassword). Amend both together. — Same text as product-sign-in-copy.ts:91.

**A-19 · Invalid credentials** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر تسجيل الدخول بهذه البيانات. تأكد منها وحاول مرة أخرى.»
- Proposed: «تعذّر تسجيل الدخول بهذه البيانات. يُرجى التأكد منها والمحاولة مرة أخرى.»
- Where: `apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts` line 92, ARABIC.invalidCredentials
- Surface: Sign-in failure notice
- Provenance: APPROVED W2-01 task, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:40 (§2.1), 2026-09-29
- Why: «تأكد» and «حاول» are masculine-singular imperatives.
- Notes: Keeps the non-enumerating meaning: it says nothing about whether the account exists.

**A-20 · Unexpected sign-in failure** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر تسجيل الدخول الآن. حاول مرة أخرى.»
- Proposed: «تعذّر تسجيل الدخول الآن. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts` line 94, ARABIC.unexpected
- Surface: Sign-in unexpected-failure notice
- Provenance: CANON T-14 frozen copy (docs/mobile-product-sign-in-gateway-v1.md:3), reused per QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:80
- Why: «حاول» is a masculine-singular imperative.
- Notes: Neutral alternative exists.

**A-21 · Session ended** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «انتهت جلستك. سجّل الدخول للمتابعة.»
- Proposed: «انتهت جلستك. يُرجى تسجيل الدخول للمتابعة.»
- Where: `apps/mobile/src/integration/auth-gateway/product-sign-in-copy.ts` line 95, ARABIC.sessionEnded
- Surface: Session-ended notice on Sign in
- Provenance: APPROVED W2-01 task, QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md:44 (§2.1), 2026-09-29
- Why: «سجّل» is a masculine-singular imperative (feminine: سجّلي).
- Notes: Neutral alternative exists.

**A-22 · Invalid Public ID** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل معرّفًا عامًا صالحًا.»
- Proposed: «يُرجى إدخال معرّف عام صالح.»
- Where: `apps/mobile/src/settings/copy.ts` line 337, AR_BASE.publicId.invalid
- Surface: Settings Public ID change validation error
- Provenance: APPROVED W3-02 Product Copy Gate (APPROVED / FROZEN FOR W3-02): docs/e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md:89-93. Merged PR #288, 2026-09-29
- Why: «أدخل» is a masculine-singular imperative.
- Notes: «المعرّف العام» stays as the frozen product term.

**A-23 · Public ID unavailable** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «المعرّف العام هذا غير متاح. اختر معرّفًا آخر.»
- Proposed: «هذا المعرّف العام غير متاح. يُرجى اختيار معرّف آخر.»
- Where: `apps/mobile/src/settings/copy.ts` line 338, AR_BASE.publicId.unavailable
- Surface: Settings Public ID change error
- Provenance: APPROVED W3-02 Product Copy Gate, QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md:94, 2026-09-29
- Why: «اختر» is a masculine-singular imperative. Also, putting «هذا» after an adjectival phrase («المعرّف العام هذا») is awkward MSA word order.
- Notes: The word-order fix is minor polish that goes with the gender fix.


### IP — Interaction Preferences (IP-IMP-01)

**IP-01 · Change not saved (Settings notice and CA-1 conversation reply)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «لم يُحفظ التغيير. حاول مرة أخرى.»
- Proposed: «لم يُحفظ التغيير. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/settings/interaction-preferences-copy.ts` line 48, INTERACTION_PREFERENCES_COPY_GATE.ar.notSaved; `apps/api/src/interaction-preferences/interaction-preference.copy.ts` line 37, NOT_SAVED.ar; `docs/e2e/QANDEEL_IP_IMP_01_INTERACTION_PREFERENCES_IMPLEMENTATION_RECORD_v1.md` line 322 (§8 PO Copy Addendum CA-1, the STALE result)
- Surface: Settings Interaction Preferences result notice, announced for accessibility (InteractionPreferencesSection.tsx:82,110,133). Through CA-1 it is also QANDEEL's prewritten conversation command reply
- Provenance: APPROVED IP-IMP-01 R1 Task Contract, PO UI copy table (interaction-preferences-copy.ts:4-6,11). Record: docs/e2e/QANDEEL_IP_IMP_01_INTERACTION_PREFERENCES_IMPLEMENTATION_RECORD_v1.md:3 (merged PR #331, 2026-10-12); CA-1 at :322 (APPROVED 2026-10-12)
- Why: «حاول» is a masculine-singular imperative.
- Notes: An out-of-scope duplicate at apps/api/src/interaction-preferences/interaction-preference.copy.ts:37 (the CA-1 chat reply) must change in the same amendment. — CA-1 says the reply is 'composed only of approved strings'. This string is the same approved IP-IMP-01 Settings STALE message held in apps/mobile/src/settings/interaction-preferences-copy.ts (mobile scope). Both must be amended together, along with the spec pins in interaction-preferences.service.spec.ts and post-response-intelligence/interaction-preference-command.route.spec.ts. «حاول مرة أخرى» also appears in account/auth copy, which is outside this scope. — The same pattern appears in the IP-IMP-01 Settings string loadFailed «تعذّر تحميل تفضيلاتك. حاول مرة أخرى.» (apps/mobile/src/settings/interaction-preferences-copy.ts:49, approved under record :316). T-14's network sentence «تعذّر الاتصال. حاول مرة أخرى.» is reused across many e2e Copy Gates; see notes. VI-01 already approves the masdar «إعادة المحاولة» (T03).

**IP-02 · Preferences failed to load** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر تحميل تفضيلاتك. حاول مرة أخرى.»
- Proposed: «تعذّر تحميل تفضيلاتك. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/settings/interaction-preferences-copy.ts` line 49, INTERACTION_PREFERENCES_COPY_GATE.ar.loadFailed
- Surface: Settings Interaction Preferences load-failure and review-failure text, also a retry control's accessibilityLabel (InteractionPreferencesSection.tsx:119-121,166)
- Provenance: APPROVED IP-IMP-01 R1 Task Contract, PO UI copy table (interaction-preferences-copy.ts:4-6,11), 2026-10-12
- Why: «حاول» is a masculine-singular imperative.
- Notes: Neutral alternative exists.


### AC — Activity settings (A3-01)

**AC-01 · Change not confirmed by the server** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تعذّر حفظ التغيير. حاول مرة أخرى.»
- Proposed: «تعذّر حفظ التغيير. يُرجى المحاولة مرة أخرى.»
- Where: `apps/mobile/src/activity/copy.ts` line 46, ACTIVITY_COPY_GATE.rows.saveFailed; rendered at apps/mobile/src/settings/NotificationsSection.tsx:165, :207, :255
- Surface: Error message: a Notifications & Activity change the server did not confirm
- Provenance: APPROVED by the A3-01 Product Copy Gate (docs/e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md:467-489; status apps/mobile/src/activity/copy.ts:26). The record gives no approval date. A3-01 merged as PR #307 on 2026-10-04 (A3-02 record :22).
- Why: «حاول» is a masculine-only second-person imperative (the feminine is «حاولي»). A natural neutral construction exists.
- Notes: The first sentence is already neutral MSA and is kept byte-exact. Pinned in tests/a3-01-activity-attention-inapp-contract.test.mjs:228. The same «حاول مرة أخرى» wording occurs in other copy files outside this scope (for example apps/mobile/src/settings/copy.ts, apps/mobile/src/account/copy.ts); those are for the relevant domain census.


### SW — Shared World (S4-01, S4-03, S4-04)

**SW-01 · Invitation row** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «{0} يدعوك لإنشاء عالم مشترك بينكما ومع قنديل.»
- Proposed: «دعوة من {0} لإنشاء عالم مشترك بينكما ومع قنديل.»
- Where: `apps/mobile/src/shared-world/copy.ts` line 68, key AR.invitation
- Surface: Invitation row in the Shared World root (SharedWorldArea.tsx:317)
- Provenance: APPROVED — S4-01 §1.3, a meaning approved by the Product Owner in the S4-01 Task Contract (copy.ts:8-9); S4-01 Product Copy Gate CLOSED 2026-10-05 (copy.ts:18)
- Why: «يدعوك» is a masculine third-person verb that agrees with {0}, the inviter's real Name, and that person's gender is unknown. When the inviter is a woman the line should read «تدعوك». A verbal-noun construction avoids the agreement entirely.
- Notes: Minimal change, and the meaning plus the dual «بينكما» are kept. The test pin surfaces.test.tsx:218 asserts the original text.

**SW-02 · Invalid Shared ID** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تأكد من المعرّف المشترك وحاول مرة أخرى.»
- Proposed: «يُرجى التأكد من المعرّف المشترك والمحاولة مرة أخرى.»
- Where: `apps/mobile/src/shared-world/copy.ts` line 78, key AR.invalidSharedId
- Surface: Error / correction message under the Shared ID field: the invite form (SharedWorldArea.tsx:425) and add-member, reused at SharedManagePage.tsx:58
- Provenance: APPROVED — S4-01 Product Copy Gate (Product Owner amendment), gate CLOSED 2026-10-05 (copy.ts:10-12, 18, 20)
- Why: «تأكد» and «حاول» are masculine singular imperatives; the feminine forms would be «تأكدي» and «حاولي». A polite impersonal form with verbal nouns is natural here.
- Notes: This row already carries a Product Owner amendment, so the amendment must keep that approval history. Test pin: surfaces.test.tsx:210.

**SW-03 · Shared ID privacy explanation** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «معرّفك المشترك خاص. شاركه فقط مع من تريد أن يستطيع دعوتك إلى عالم مشترك.»
- Proposed: «معرّفك المشترك خاص. مشاركته تعني السماح لمن يحصل عليه بدعوتك إلى عالم مشترك.»
- Where: `apps/mobile/src/shared-world/copy.ts` line 94, key AR.sharedIdPrivacy
- Surface: Privacy explanation (instructional copy) in Settings → Shared ID (settings/SharedIdSection.tsx:109)
- Provenance: APPROVED — S4-01 Product Copy Gate, CLOSED 2026-10-05 (copy.ts:10-13, 18)
- Why: «شاركه» is a masculine imperative (the feminine is «شاركيه»), and «تريد» is the masculine second person (the feminine is «تريدين»). The unvocalized suffix «ـك» is neutral and is kept.
- Notes: The meaning is kept (only people allowed to invite should hold the ID), and the consequence is now stated explicitly. A shorter neutral option, if preferred: «معرّفك المشترك خاص، ويمكن لكل من يحصل عليه دعوتك إلى عالم مشترك.»

**SW-04 · Regenerate Shared ID warning** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «سيتوقف معرّفك الحالي عن العمل، ولن تصل إليك الدعوات المرسلة إليه التي لم تقبلها بعد. عوالمك المشتركة الحالية لن تتأثر.»
- Proposed: «سيتوقف معرّفك الحالي عن العمل، ولن تصل إليك الدعوات المرسلة إليه التي لم تُقبَل بعد. عوالمك المشتركة الحالية لن تتأثر.»
- Where: `apps/mobile/src/shared-world/copy.ts` line 98, key AR.regenerateWarning
- Surface: Confirmation warning before regenerating the Shared ID (settings/SharedIdSection.tsx:112)
- Provenance: APPROVED — S4-01 Product Copy Gate, CLOSED 2026-10-05 (copy.ts:10-13, 18)
- Why: «تقبلها» is a masculine second-person verb (the feminine is «تقبليها»). Every other second-person reference in the line is a neutral unvocalized suffix (معرّفك، إليك، عوالمك).
- Notes: A one-word change to the passive «لم تُقبَل»; the meaning is identical.

**SW-05 · Member request: add (root row and Activity / push sentence)** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «{0} يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.»
- Proposed: «اقتراح من {0} بانضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 150, key AR_OWN.memberRequestAdd; `apps/api/src/shared-world/shared-activity-copy.ts` line 48, SHARED_ACTIVITY_COPY.memberRequestAdd; used by apps/api/src/shared-world/shared-activity.producer.ts:77
- Surface: Member-request row in the Shared World root (SharedWorldArea.tsx:340)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
- Why: «يقترح» is a masculine verb that agrees with {0}, the proposer's real Name, whose gender is unknown (the feminine would be «تقترح»).
- Notes: This follows the already approved pattern «اقتراح من {0}» (lifecycle-copy.ts:138). The out-of-scope file apps/api/src/shared-world/shared-activity-copy.ts:48 has an identical Arabic row that should be amended in step; its test pin is shared-activity.spec.ts:137. — The replacement reuses the already-approved nominal pattern «اقتراح من {0}» (proposedBy, shared-activity-copy.ts:46; lifecycle-copy.ts:138). «عليه» now refers to the proposal. Because this is a REUSED row, the amendment must change the source (lifecycle-copy.ts:150) and the API copy together, and the S4-04 byte-exact pin. This is gender agreement with a third person, not address to the reader.

**SW-06 · Member request: rejoin (root row and Activity / push sentence)** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «{0} يقترح عودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه.»
- Proposed: «اقتراح من {0} بعودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه.»
- Alternative draft: «اقتراح من {0} بعودتك إلى عالم مشترك كنت فيه، وقد وافق عليه كل أعضائه.»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 151, key AR_OWN.memberRequestRejoin; `apps/api/src/shared-world/shared-activity-copy.ts` line 50, SHARED_ACTIVITY_COPY.memberRequestRejoin; used by apps/api/src/shared-world/shared-activity.producer.ts:77
- Surface: Member-request (rejoin) row in the Shared World root (SharedWorldArea.tsx:340)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05)
- Why: «يقترح» is a masculine verb that agrees with the proposer's Name {0}. The unvocalized «كنت» is neutral and is kept.
- Notes: The out-of-scope file apps/api/src/shared-world/shared-activity-copy.ts:50 has an identical row that should be amended in step. — Same nominal «اقتراح من {0}» pattern as the add row. In the Proposed text «عليها» still agrees with «عودتك»; in the Alternative draft «عليه» refers to the proposal. Change the source (lifecycle-copy.ts:151), the API reuse and the S4-04 pin together. This is third-person agreement, not address to the reader.

**SW-07 · Removal explanation** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين. لا يحتاج {0} إلى الموافقة، ويبقى كلامه السابق باسمه.»
- Proposed: «تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين، ولا تُطلب موافقة العضو المقترح إزالته. ويبقى الكلام السابق في هذا العالم باسم صاحبه.»
- Alternative draft: «تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين، ولا تُطلب موافقة {0}. ويبقى الكلام السابق في هذا العالم باسم صاحبه. (two `{0}`, so it needs the `fill()` fix of §6.1 first)»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 153, key AR_OWN.removeExplain
- Surface: Explanation in the removal confirmation (SharedManagePage.tsx:272)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — CW2-03 §25
- Why: «لا يحتاج {0}» is a masculine verb with a named member of unknown gender, and «كلامه» and «باسمه» are masculine pronouns referring to that same named person.
- Notes: Both {0} occurrences are kept as instructed, but there is a runtime defect: fill() at copy.ts:147-149 uses String.replace('{0}', value), which replaces only the FIRST occurrence. The second {0} therefore renders literally today, in both AR and EN. lifecycle.test.tsx:340 builds its expectation with the same fill(), so it cannot catch this. If fill() is not fixed, a single-{0} neutral option is: «تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين، ولا تُطلب موافقة العضو المقترح إزالته. ويبقى الكلام السابق في هذا العالم باسم صاحبه.»

**SW-08 · History-share explanation** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «الانضمام إلى العالم لا يفتح كل تاريخه السابق تلقائيًا. يمكنك اقتراح مشاركة رسائل سابقة معه، ولا تتم مشاركة أي رسالة إلا بعد اكتمال الموافقات المطلوبة عليها.»
- Proposed: «الانضمام إلى العالم لا يفتح كل تاريخه السابق تلقائيًا. يمكنك اقتراح مشاركة رسائل سابقة مع هذا العضو، ولا تتم مشاركة أي رسالة إلا بعد اكتمال الموافقات المطلوبة عليها.»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 155, key AR_OWN.shareExplain
- Surface: Explanation in the history-share panel for one named member (SharedManagePage.tsx:456)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05; review correction 2026-10-06)
- Why: «معه» is a masculine pronoun referring to the specific member the panel was opened for (memberName at SharedManagePage.tsx:442), whose gender is unknown. It also has no explicit antecedent in the sentence.
- Notes: «هذا العضو» is the standard generic noun, and it also fixes the missing antecedent. This is a minor flag.

**SW-09 · Share preview heading** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «سيرى {0} هذه الرسائل فقط:»
- Proposed: «ستظهر عند {0} هذه الرسائل فقط:»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 158, key AR_OWN.previewHeading
- Surface: Heading of the exact share preview (SharedManagePage.tsx:483)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05) — CW2-03 §21
- Why: «سيرى» is a masculine verb that agrees with the named grantee {0}, whose gender is unknown (the feminine would be «سترى»).
- Notes: «فقط» follows «هذه الرسائل», so the CW2-03 §21 scope "{0} will see only these messages" is kept. «عند {0}» also avoids «لـ» before a name that begins with «ال» («للعنود», not «لـالعنود»). — Corrected by the independent Arabic-quality review before publication.

**SW-10 · Share request row** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اقتراح بأن يرى {0} الرسائل السابقة التالية:»
- Proposed: «اقتراح بمشاركة الرسائل السابقة التالية مع {0}:»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 161, key AR_OWN.shareRequest
- Surface: Share-request row in Manage World (SharedManagePage.tsx:240)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05; review correction 2026-10-06)
- Why: «يرى» is a masculine verb that agrees with the named grantee {0}, whose gender is unknown.
- Notes: «مع {0}» avoids «التالية لـ» being read as "following {0}" and the «لـال» spelling. — Corrected by the independent Arabic-quality review before publication.

**SW-11 · Former-member share request** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اقتراح بأن يرى عضو في عالم مشترك لم تعد عضوًا فيه كلامك السابق هذا. موافقتك لا تعيدك إلى العالم:»
- Proposed: «اقتراح بإتاحة كلامك السابق هذا لعضو في عالم مشترك انتهت عضويتك فيه. موافقتك لا تعيدك إلى العالم:»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 162, key AR_OWN.formerShareRequest
- Surface: Share request on the former-member own-material page in Settings → Privacy & Data (settings/FormerSharedMaterialSection.tsx:84)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05; review correction 2026-10-06) — CW2-03 §24
- Why: «لم تعد عضوًا» addresses the reader with a masculine second-person verb (the feminine is «لم تعودي») and a masculine predicate «عضوًا» («عضوة»). The long interposed clause also makes the sentence hard to parse.
- Notes: «انتهت عضويتك فيه» is neutral and covers both leaving and removal. «لعضو» stays as the generic noun for an unnamed grantee (no grantee is named, per CW2-03 §24). The second sentence was already neutral and is unchanged.

**SW-12 · Leave explanation** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «ستغادر فورًا، ولن تتمكن من رؤية هذا العالم وأنت خارجه. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات.»
- Proposed: «المغادرة فورية، ولن يظهر لك هذا العالم ما دمت خارجه. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات.»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 166, key AR_OWN.leaveExplain
- Surface: Explanation in the leave confirmation (SharedManagePage.tsx:287)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05; review correction 2026-10-06) — CW2-03 §23-§24
- Why: «ستغادر» and «تتمكن» are masculine second-person verbs; the feminine forms would be «ستغادرين» and «تتمكني». The unvocalized «وأنت» and «يمكنك» are neutral in script.
- Notes: The consequence-before-the-act meaning and the Settings path are kept. «ما دمت» is unvocalized and neutral. — Corrected by the independent Arabic-quality review before publication. It avoids the stiff «تتم + verbal noun».

**SW-13 · Former-member material row and page title** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «كلامك في عوالم مشتركة لم تعد عضوًا فيها»
- Proposed: «كلامك في عوالم مشتركة انتهت عضويتك فيها»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 173, key AR_OWN.formerRow
- Surface: Settings → Privacy & Data row label and page title (settings/FormerSharedMaterialSection.tsx:40, 66)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05; review correction 2026-10-06) — E2E-G-18
- Why: «لم تعد عضوًا» is a masculine second-person verb with a masculine predicate, addressing the reader.
- Notes: Same construction as the formerShareRequest and formerEmpty proposals, so the three rows stay consistent.

**SW-14 · Former-member material empty state** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «لا يوجد لك كلام في عوالم مشتركة لم تعد عضوًا فيها.»
- Proposed: «لا يوجد لك كلام في عوالم مشتركة انتهت عضويتك فيها.»
- Where: `apps/mobile/src/shared-world/lifecycle-copy.ts` line 175, key AR_OWN.formerEmpty
- Surface: Empty state on the former-member own-material page (settings/FormerSharedMaterialSection.tsx:105)
- Provenance: APPROVED — S4-03 Product Copy Gate (Product Owner, 2026-10-05; review correction 2026-10-06)
- Why: «لم تعد عضوًا» is a masculine second-person verb with a masculine predicate, addressing the reader.
- Notes: Consistent with the formerRow proposal.

**SW-15 · A person joined (Activity / push sentence, JOINED and BIRTH)** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «انضم {0} إلى هذا العالم.»
- Proposed: «تمّ انضمام {0} إلى هذا العالم.»
- Where: `apps/api/src/shared-world/shared-activity-copy.ts` line 52, SHARED_ACTIVITY_COPY.joined; used for both JOINED and BIRTH at apps/api/src/shared-world/shared-activity.producer.ts:88, :96
- Surface: Activity row sentence, and the push notification body at L2/L3: a person joined the reader's Shared World
- Provenance: APPROVED by the S4-04 Product Copy Gate (Product Owner, 2026-10-06; reconciled after merge in S5-01 R1) per shared-activity-copy.ts:16-18, :51. Pinned in tests/s4-04-shared-activity-notifications-direct-entry-contract.test.mjs:148-150.
- Why: The masculine past verb «انضم» agrees with {0}, a person's own Name. A woman would need «انضمت». A verb form cannot be gender-neutral here, so the replacement uses a neutral nominal construction.
- Notes: «تمّ» marks this as a completed fact. That keeps it distinct from the approved proposal row «انضمام شخص جديد إلى هذا العالم» (proposalAdd, :42), which describes a pending proposal. If the Product Owner prefers the shorter «انضمام {0} إلى هذا العالم.», that risk of being read as a proposal applies. This is third-person agreement, not address to the reader.


### PW — Public World and Public authoring (S5-02, S5-03A, S5-03B, S5-04)

**PW-01 · Choose-sources heading** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اختر ما سيصبح عامًا»
- Proposed: «اختيار ما سيصبح عامًا»
- Where: `apps/mobile/src/public-authoring/copy.ts` line 93, key chooseHeading (rendered as the CHOOSE screen title, PublicAuthoringWorkspace.tsx:194)
- Surface: screen title / heading (authoring workspace, choose-sources step)
- Provenance: APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06), copy.ts:11-14, 26, 93; also recorded in docs/e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md
- Why: «اختر» is the masculine singular imperative addressed to the reader (feminine «اختاري»). A neutral verbal-noun heading exists and matches the sibling headings in the same file («مراجعة ما سيصبح عامًا», copy.ts:96).
- Notes: Same meaning and length; parallels review (copy.ts:96). No test pins this string. Original approval preserved; replacement not to be implemented before Copy Amendment approval.

**PW-02 · Choose-sources hint** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «من كلامك في قنديل، ومما تراه في عوالمك المشتركة. حتى 20 عنصرًا.»
- Proposed: «من كلامك في قنديل، ومما يظهر لك في عوالمك المشتركة. حتى 20 عنصرًا.»
- Where: `apps/mobile/src/public-authoring/copy.ts` line 94, key chooseHint (rendered at PublicAuthoringWorkspace.tsx:232)
- Surface: instructional hint line (authoring workspace, choose-sources step)
- Provenance: APPROVED — S5-02 Product Copy Gate (Product Owner, 2026-10-06), copy.ts:11-14, 26, 94; also recorded in docs/e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md
- Why: «تراه» is a second-person masculine verb (feminine «ترينه»), so the hint addresses the reader as male. «كلامك» and «عوالمك» are unmarked in writing and are fine.
- Notes: «يظهر لك» keeps the 'what you can see' meaning with an unmarked pronoun. No test pins this string.

**PW-03 · Ask QANDEEL to propose its understanding (button)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اطلب فهم قنديل لهذه التجربة»
- Proposed: «طلب فهم قنديل لهذه التجربة»
- Where: `apps/mobile/src/public-authoring/semantic-copy.ts` line 69, key ask (button label, PublicSemanticReview.tsx:125)
- Surface: button (ask QANDEEL to propose its understanding)
- Provenance: APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06), semantic-copy.ts:10-13, 23, 69; also recorded in docs/e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md
- Why: «اطلب» is the masculine singular imperative (feminine «اطلبي»). Action buttons elsewhere in this scope already use verbal nouns («طلب علاقة» relation-copy.ts:74, «تصحيح الفهم» semantic-copy.ts:75, «إرسال التصحيح» :80).
- Notes: Uses a verbal noun, as the sibling buttons do. No test pins this string.

**PW-04 · Semantic correction scope** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «التصحيح يخص المعنى فقط، ولا ينقل التجربة إلى مكان تختاره.»
- Proposed: «التصحيح يخص المعنى فقط، ولا يتيح اختيار مكان التجربة.»
- Where: `apps/mobile/src/public-authoring/semantic-copy.ts` line 76, key correctionScope (rendered at PublicSemanticReview.tsx:102)
- Surface: instructional / explanatory line (semantic correction form)
- Provenance: APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06), semantic-copy.ts:10-13, 23, 76; also recorded in docs/e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md
- Why: «تختاره» is a second-person masculine verb addressed to the publisher (feminine «تختارينه»).
- Notes: Keeps the CW2-04 §13 / D15 meaning (semantic-copy.ts:15-16): a correction concerns meaning and never lets the publisher choose the place. The impersonal verbal noun «اختيار» removes the gendered address. No test pins this string.

**PW-05 · Daily limit reached** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «وصلت هذه التجربة إلى الحد المسموح اليوم. حاول لاحقًا.»
- Proposed: «وصلت هذه التجربة إلى الحد المسموح اليوم. يمكنك المحاولة لاحقًا.»
- Where: `apps/mobile/src/public-authoring/semantic-copy.ts` line 87, key limited (rendered via PublicAuthoringWorkspace.tsx:52 for LIMITED)
- Surface: error / rate-limit message
- Provenance: APPROVED — S5-03A Product Copy Gate (Product Owner, 2026-10-06), semantic-copy.ts:10-13, 23, 87; also recorded in docs/e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md
- Why: «حاول» is the masculine singular imperative (feminine «حاولي»). The first sentence is neutral.
- Notes: «يمكنك» is unmarked in writing and already used in this scope (semantic-copy.ts:68, :84; copy.ts:95). A more formal alternative is «يُرجى المحاولة لاحقًا.». No test pins this string.

**PW-06 · Public search field (label, placeholder, accessible name)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «ابحث عن تجربة أو شعور أو معنى»
- Proposed: «البحث عن تجربة أو شعور أو معنى»
- Where: `apps/mobile/src/public-world/field/field-copy.ts` line 82, key searchLabel (label and placeholder of the Public search field, PublicLivingAnalysis.tsx:127; reused by relation-copy.ts:107 → PublicRelations.tsx:148)
- Surface: search field label + placeholder + accessibility label (Public field and relation request search)
- Provenance: APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07; text as revised by the Owner, R1), field-copy.ts:12-16, 32, 42, 82; also recorded in docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md
- Why: «ابحث» is the masculine singular imperative (feminine «ابحثي»). It is the accessible name as well as the visible placeholder.
- Notes: This row's text was revised by the Product Owner personally (R1; field-copy.ts:42), so the amendment must say it supersedes the Owner's own wording. It has one source and two surfaces (relation-copy.ts:107 reuses it). It is pinned by apps/mobile/src/public-world/field/__tests__/public-field.test.tsx:988, which changes only after approval.

**PW-07 · «Shared by {0}» metadata line** — GENDER (third-person agreement with a named person) — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «شاركها {0}»
- Proposed: «مشاركة من {0}»
- Where: `apps/mobile/src/public-world/field/field-copy.ts` line 85, key sharedBy (rendered at PublicLivingAnalysis.tsx:239 with {0} = publisher.label, a PSEUDONYM or REAL_NAME display, public-field.service.ts:16,129)
- Surface: metadata line in the Experience panel ('Shared by {0}')
- Provenance: APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07), field-copy.ts:12-16, 32, 85; also recorded in docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md
- Why: «شاركها» is a third-person masculine past verb whose subject is {0}, the publisher's display name, which may be a woman's real name or pseudonym. A female publisher grammatically requires «شاركتها», so the template is gender-dependent. The gendered form concerns a third party, not the reader.
- Notes: {0} is unchanged. «مشاركة» also means 'post' in the discussion copy (discussion-copy.ts:69, :70, :75). If the Product Owner wants to avoid that overlap, an equally neutral alternative is «نُشرت بواسطة {0}», but it sits next to «نُشرت في {0}» (PublicLivingAnalysis.tsx:242). No test pins this string.

**PW-08 · Ask QANDEEL to set the place (button)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اطلب من قنديل تحديد مكانها»
- Proposed: «طلب تحديد مكانها من قنديل»
- Where: `apps/mobile/src/public-world/field/field-copy.ts` line 89, key placeAsk (button text + accessibility label, PublicPlacePreparation.tsx:44,46)
- Surface: button + accessibility label (ask QANDEEL to set the Experience's place)
- Provenance: APPROVED — S5-03B Product Copy Gate (Product Owner, 2026-10-07), field-copy.ts:12-16, 32, 89; also recorded in docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md
- Why: «اطلب» is the masculine singular imperative (feminine «اطلبي»).
- Notes: Uses a verbal noun, consistent with the proposed ask replacement (semantic-copy.ts:69). «قنديل» (CANON) is unchanged. No test pins this string.

**PW-09 · Discussion composer hint** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اكتب ‎@qandeel لتسأل قنديل هنا، وردّه يظهر للجميع.»
- Proposed: «يمكنك كتابة ‎@qandeel لتوجيه سؤال إلى قنديل هنا، وردّه يظهر للجميع.»
- Where: `apps/mobile/src/public-world/field/discussion-copy.ts` line 73, key invokeHint (rendered at PublicDiscussion.tsx:102)
- Surface: instructional hint under the discussion composer
- Provenance: APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08), discussion-copy.ts:13-14, 25, 29, 73; also recorded in docs/e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md
- Why: «اكتب» is the masculine singular imperative (feminine «اكتبي»), and «لتسأل» is a second-person masculine verb (feminine «لتسألي»). Both address the reader as male.
- Notes: The U+200E LEFT-TO-RIGHT MARK before @qandeel in the original (verified with od at discussion-copy.ts:73) must be kept in the replacement, as written above. The @qandeel token and the 'its answer is public' disclosure are unchanged. No test pins this string. — Corrected by the independent Arabic-quality review before publication. «سؤال قنديل» could read as "QANDEEL's question". The U+200E mark before @qandeel is kept.


### PC — Personal chrome and analysis language (W1A-01)

**PC-01 · Following the conversation (stance sentence and live-edge state)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «تتابع المحادثة الآن.»
- Proposed: «متابعة المحادثة جارية الآن.»
- Where: `apps/mobile/src/orientation-chrome/product-copy.ts` line 411 (AR.temporal, FOLLOW_LIVE + liveHeadEstablished); exposed by temporalSentence() line 449; `apps/mobile/src/analysis-language/analysis-copy.ts` line 87 (AR.followingConversation); used at temporal-navigation/timeline-integration/TemporalTargetLayer.tsx:95 and temporal-navigation/accessibility/temporal-accessibility.ts:83
- Surface: Orientation chrome stance sentence: a visible status line and its accessible text, shown while the reader follows the ongoing conversation
- Provenance: APPROVED: W1A-01 Product Owner supersession. Cited in code at product-copy.ts:409 and recorded at docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md:250-258, which also requires the full stop in the T-08 slot (:258). Merged in PR #283 at 7c9ee5e, 2026-09-28. It replaces CANON T-08 «أنت عند آخر المحادثة» (record :255). The T-08 pack is also vendored as canon at docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/vendor/canon/product-copy.ts.
- Why: «تتابع» is a 2nd-person imperfect that addresses the reader as masculine; the feminine form is «تتابعين». The same file says the imperfect is the form that is NOT gender-neutral in unvowelled script, and that states should be written object-first or as verbal nouns (product-copy.ts:46-51). The PO supersession brought in the one 2nd-person imperfect in this pack. A neutral nominal construction exists.
- Notes: This is the same approved string as the analysis-copy.ts:87 entry and must change together with it. Per the W1A01 record :258, the T-08 slot keeps the full stop and other surfaces do not. «جارية» makes this read as a state, not an act, so it stays distinct from the act «العودة لمتابعة المحادثة» (product-copy.ts:346; analysis-copy.ts:88). The alternative «العرض يتابع المحادثة الآن» was rejected because the act's hint says «لا يتحرك العرض» (line 347). Comments that quote the original need updating once the amendment is approved: TemporalTargetLayer.tsx:89 and temporal-accessibility.ts:29. Tests and the vendored canon copy pin it too. Do not implement before approval. — This is the same supersession string as product-copy.ts:411 (here without the full stop, per the record :258). It has to stay a STATE, unmistakable next to the act label «العودة لمتابعة المحادثة», because both alternate on the same control (TemporalTargetLayer.tsx:95). A bare verbal noun such as «متابعة المحادثة الآن» could be misread as a command, so «جارية» is kept.

**PC-02 · Moment-number accessibility hint** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «أدخل رقمًا من 1 إلى ${digits(max)}. ستظهر نظرة مؤقتة على اللحظة دون الانتقال إليها.»
- Proposed: «يمكنك إدخال رقم من 1 إلى ${digits(max)}. ستظهر نظرة مؤقتة على اللحظة دون الانتقال إليها.»
- Where: `apps/mobile/src/analysis-language/analysis-copy.ts` line 93 (AR.momentNumberHint); used as accessibilityHint at temporal-navigation/accessibility/TemporalNavigator.tsx:170
- Surface: Accessibility hint / instructional copy on the moment-number input field
- Provenance: APPROVED: W1A-01 Analysis-language package, 'Approved package, verbatim' row 'Moment-number hint' at docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md:268. Merged in PR #283, 2026-09-28.
- Why: «أدخل» is a masculine singular imperative; the feminine form is «أدخلي». A gender-neutral construction exists and is natural here. The second sentence («ستظهر نظرة مؤقتة...») is already neutral.
- Notes: «يمكنك» is identical for both addressees in unvowelled script (the -ك possessive/object rule at product-copy.ts:47-48). It keeps the direct, welcoming address of the English 'Enter a number…'. The placeholder ${digits(max)} is unchanged. The plainer impersonal option «يمكن إدخال رقم من 1 إلى ${digits(max)}.» is also acceptable.


### N — Product naming

**N-01 · «Ask QANDEEL» name row (I-08A4 §8)** — GENDER — *CONTROLLED COPY AMENDMENT REQUIRED*
- Original: «اسأل قنديل»
- Proposed: «سؤالك لقنديل»
- Where: `docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md` line 232 (§8 naming row 'Ask QANDEEL')
- Surface: Label / Product name: 'Ask QANDEEL'
- Provenance: CANON I-08A4 §8 (CLOSED / CANONICAL FREEZE COMPLETE)
- Why: A masculine imperative; the feminine is «اسألي قنديل». The other 36 rows of I-08A4 §8, «التعارف» included, are neutral MSA nominals.
- Notes: If the noun phrase reads as constructed, VI-01 §3.6.3 (:402-407) requires an explicit AR-M / AR-F pair («اسأل قنديل» / «اسألي قنديل») based on a stored form-of-address preference, never a single masculine form. The approved S5-04 invokeHint «اكتب ‎@qandeel لتسأل قنديل هنا…» (docs/e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md:228) has the same issue. — Corrected by the independent Arabic-quality review before publication. «سؤال لقنديل» read as a content item rather than an inviting feature name.


### V — Provisional voice and call strings (runtime-gated, `QAN-BL-VOICE-01`)

**V-01 · Live Call microphone state (accessible name)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «الميكروفون شغّال»
- Proposed: «الميكروفون يعمل»
- Where: `docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_DECISION_TABLE.md` line 126 (key cA11yOn); also G1.2 closure :77 and g3.2 content.mjs:74
- Surface: Accessibility label: Live Call microphone state (accessibility-only)
- Provenance: None stated: RUNTIME_GATED / PROVISIONAL (P4-C2 §5 :71-72; VI-01 §14 :954-955 'EXACT STRINGS = PROVISIONAL / PHASE VII')
- Why: «شغّال» is Egyptian. VI-01 §3.2 :249 already rates «شغّال» as a G1 comprehension failure.
- Notes: G1.2 §4 (:75-82) forbids it as visible text, but it survives as an assistive string.

**V-02 · Live Call QANDEEL-speaking state (accessible name)** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «قنديل بيتكلم»
- Proposed: «قنديل يتحدث»
- Where: `docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md` line 79; also g3.2 content.mjs:76 (key qSpeaking, ACCESSIBILITY-ONLY)
- Surface: Accessibility label: Live Call QANDEEL-speaking state
- Provenance: None stated: PROVISIONAL / RUNTIME_GATED (VI-01 §14; QAN-BL-VOICE-01)
- Why: Uses the Egyptian «بـ» present tense «بيتكلم».
- Notes: Runtime-gated. It must be MSA when QAN-BL-VOICE-01 authors it.

**V-03 · Voice Note recording state** — DIALECT — *NOT YET APPROVED COPY — AUTHOR IN MSA AT THE OWNING COPY GATE (NO AMENDMENT)*
- Original: «بسجّل»
- Proposed: «جارٍ التسجيل»
- Where: `docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_DECISION_TABLE.md` line 114 (key vRecording); also VI-01 Copy Patterns :342 and g3.2 content.mjs:69
- Surface: Voice Note recording state (visible label)
- Provenance: None stated: RUNTIME_GATED / PROVISIONAL (VI-01 §14; P4-C2 §5)
- Why: An Egyptian first-person present form.
- Notes: Truth is gated separately: VI-01 §14 :957-958 warns that 'Recording' may be false.

## 5. What changes together, only after approval

An approved unit would change more than its string. These couplings were reported by the reviewers and must be
re-verified by the implementing task:

- **Test pins:**
  - `tests/a3-02-native-push-platform-delivery-contract.test.mjs:162-167` (P-01 … P-04);
  - `tests/a3-01-activity-attention-inapp-contract.test.mjs:228` (AC-01);
  - `tests/s4-04-shared-activity-notifications-direct-entry-contract.test.mjs:140`, `:148-150` (SW-05, SW-06, SW-15);
  - `apps/mobile/src/shared-world/__tests__/surfaces.test.tsx:210`, `:218` (SW-02, SW-01);
  - `apps/mobile/src/public-world/field/__tests__/public-field.test.tsx:988` (PW-06);
  - `tests/mem-ar-01-memory-subject-identity-contract.test.mjs:126-133` and the mutation check at `:258` (MEM-15 …
    MEM-19), with the `database/verify-migration-0152.mjs` fixtures;
  - `apps/api/src/conversation/safety-response-gate.service.spec.ts:102`, which asserts «مش هقدر» (S-01). `:182` asserts
    a phrase that the proposals keep;
  - the interaction-preference specs (IP-01).
- **Code couplings:**
  - `apps/api/src/memory/memory-control.copy.ts:88` derives a first-section heading with `.replace(/^وفيه/u, 'فيه')`
    (MEM-03);
  - `memory-control.interpreter.ts:329-331` recognises only colloquial subject answers (MEM-15, MEM-19). Recognition must
    keep the Egyptian answers and add MSA ones, which is a separate, approved change;
  - P4-C3 check C-COPY-1 (`openerdrift`) (Q-01);
  - reused rows change at their source and at every reuse together, for example the four T-14 network sentences (A-07)
    and the S4-03 rows that S4-04 reuses (SW-05, SW-06).
- **Never edited:** the byte-preserved proof and vendored canon copies, for example `product-proofs/g2/g2.3/README.md:41-43`
  and `g3/g3.2/source/src/content.mjs`. They stay as historical evidence.

## 6. Open questions and observations

- **Open question for the Product Owner.** Rule A does not say which dialect a generated reply uses when the user has
  stated no preference. I-08A4 §11 (`:337`) allows an Egyptian-compatible default, and I-08N-01 (`:651`) points to a
  neutral fallback. *(Answered by the Product Owner's D4, 2026-10-13: an explicitly chosen language or dialect, then the
  user's dialect when reasonably clear, then neutral simplified Modern Standard Arabic; never Egyptian by default.
  [WP0 record](QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14.14.)*
- **The «حاول مرة أخرى» family.** The masculine retry imperative also appears in approved e2e Copy Gate records:
  W1B-01, W2-01, A3-01, S5-01 and S5-03A. So do «أدخل», «اختر», «تأكد» and «لم تعد عضوًا». VI-01 already approves the verbal
  noun «إعادة المحاولة» (T03). One family-wide amendment would clear most of them. The records themselves stay as
  history.
- **Defect outside the language rule.** The Shared removal explanation (SW-07) contains `{0}` twice, but `fill()`
  (`apps/mobile/src/shared-world/copy.ts:147-149`) uses `String.replace`, which replaces only the first occurrence. The
  second `{0}` therefore renders literally today, in Arabic and English. `lifecycle.test.tsx:340` builds its expectation
  with the same `fill()`, so it cannot catch this. The primary proposal for SW-07 uses one `{0}` and so is safe either
  way. The defect is reported to the Product Owner, not fixed here.
- **Content outside the language rule.** The Matching Product Definition's example proposal (M-13) names reason
  categories, which G2 §D forbids before the Introduction.

## 7. What approval would look like

1. The Product Owner approves, edits or rejects units: one by one, by family, or by the language authority they depend
   on (LANG-01 … LANG-03 first, since they decide the scripted-voice tier).
2. Approved amendments are recorded as controlled Copy Amendments beside the authorities they supersede. The originals
   and their approvals stay as history.
3. A separately authorized task applies them to code, re-anchors the pins of §5 and validates proportionally. For the S6
   tasks this is inside their own Copy Gates: G2.3 (M-01 … M-03) comes before any S6-04 copy.
4. The 16 not-yet-approved strings need no amendment. Each owning Copy Gate authors them in MSA, and the drafts here are
   inputs.

Nothing in this document is approved, and nothing has been changed.
