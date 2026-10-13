# QANDEEL — LANG-01 Arabic Language Authority & Fixed Copy — Controlled Amendment v1.0

**Status:** `CANONICAL PRODUCT DECISION RECORD / CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE`
**Date:** 2026-10-13
**Workstream / task:** LANG — `LANG-01 — Arabic Language Authority & Fixed Copy Correction`
([task record](../../../e2e/QANDEEL_LANG_01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CORRECTION_RECORD_v1.md))
**Authority:**
- the Product Owner's binding QANDEEL-wide language rule and its D4 default for generated conversation
  ([Stage 6 WP0 record](../../../e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14.1, §14.14);
- the Product Owner's editorial approval register of 2026-10-13: 109 units, 27 approved individually by the Product
  Owner and 82 approved under the Product Owner's explicit editorial delegation, 39 of them with an explicit final
  wording. It is committed byte-for-byte at
  [`docs/e2e/lang-01/QANDEEL_LANG_Approval_Register_2026-10-13.json`](../../../e2e/lang-01/QANDEEL_LANG_Approval_Register_2026-10-13.json)
  (SHA-256 `6ba3bc62e72938998a067e32f8c87b69c01f102f6d3c3fa98b342081cff16785`). The human-readable Word record
  `QANDEEL_LANG_Arabic_Copy_Approval_2026-10-13.docx` (SHA-256
  `3eb9c4a17a36011f3a0c79898adf6cc5bf9d1681087f2a58134cda630167f17c`) carries the same 39 wordings, byte for byte;
- the LANG-01 Task Contract (Product Owner, 2026-10-13), Work Package A.

**Resolved text:** every replacement below is copied from the
[resolved approval manifest](../../../e2e/lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json): the register's
`final_text` when it is non-null, otherwise the exact «Proposed» text of the same unit in the
[pinned census](../../../e2e/QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md) at
`af94748de73cca744c466d8db526984427b94b38`. Nothing is paraphrased. The LANG-01 static contract re-derives every
replacement from those two sources and checks it against this document.

---

## 0. How to read this amendment

- **Additive.** Every authority named below stays byte-identical as the historical record of what was approved and
  when. No frozen record, copy-gate record, provenance pin or byte-preserved proof is edited. For the wording and
  language-register questions below, this later controlled amendment is authoritative, as the
  [W1B-01 amendment](../w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md)
  is for I-08A4 §14–§15.
- **Wording only.** It changes no Product meaning, privacy guarantee, consent, permission, data flow, runtime
  behaviour, ownership boundary or architecture. Every replacement says what its original said, in neutral or
  simplified Modern Standard Arabic and without addressing the reader, or a named person, by one gender.
- **Arabic only.** No English copy changes. Where a unit's English counterpart has its own defect, that defect stays
  separately tracked (§4).
- **Merged is not implemented.** This amendment authorizes the wording. The production strings change in LANG-01
  Work Package B (fixed copy) and Work Package C (the model-facing D4 guidance). Until those merge, the running
  product still shows the original bytes.
- **Matching copy** (M-01 … M-03) is amended beside G2.3, in the
  [G2.3 LANG-01 controlled amendment](../../../design/i-08b3.1-g2.3/G2_3_LANG01_MATCHING_COPY_CONTROLLED_AMENDMENT.md),
  on the pattern of the T-11 amendment that already sits there. LANG owns that amendment; the S6 tasks consume it.

---

## 1. Language authorities

The census §3 recorded fifteen places where QANDEEL's language authorities disagree with the Product Owner's rule.
Each is settled here. Quoted text is the authority's own.

### LA-01 — VI-01 T2 · Voice

- **Authority:** [VI-01 Foundation](../../../design/phase-vi/vi-01-bilingual-product-language/QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md)
  §1.5 and the §3.1 tier table, row T2; VI-01 [README](../../../design/phase-vi/vi-01-bilingual-product-language/README.md).
- **Said:** "QANDEEL's conversational voice uses restrained Egyptian for the launch experience"; T2 · Voice =
  **Restrained Egyptian** for "QANDEEL's conversational turns".
- **Amended:** T2 is split.
  - **T2a · Generated voice** — QANDEEL's genuinely generated turns, spoken or written. Rule A and D4 apply: an
    explicitly chosen language or dialect first; otherwise the user's dialect when it is reasonably clear from the
    conversation; otherwise neutral simplified Modern Standard Arabic. No Arabic user is defaulted to Egyptian.
    Restrained Egyptian is used when it is chosen or is clearly the user's own dialect, within the §3.4 bounds
    (LA-04).
  - **T2b · Scripted voice** — every prewritten QANDEEL line: openers, the first-use Welcome, guided-conversation
    messages, deterministic command replies (memory control, interaction preferences, safety replies), and every
    scripted line in a chat bubble. Rule B applies: neutral or simplified Modern Standard Arabic, natural, concise,
    welcoming and gender-considerate. The first person and the warmth stay; dialect does not carry them.
- **Kept:** "one Arabic product language" (§1.5, §3.3); the first-person rule (§3.5); the addressee gender policy
  (§3.6); every truth and semantic guardrail.

### LA-02 — VI-01 T3b · Analysis prose

- **Said:** T3b, "reading statements, assumptions, review conditions, the body of a named unknown", is
  **Restrained Egyptian, flat**.
- **Amended:** fixed analysis templates and every deterministic analysis sentence are neutral or simplified Modern
  Standard Arabic, flat. Analysis prose that is genuinely generated follows T2a. The flatness constraint stays in full:
  no hedging, no intensifiers, no epistemic dialect words.

### LA-03 — VI-01 §3.2 · "neutral contemporary Arabic" and the two gates

- **Said:** neutral contemporary Arabic is "**not** MSA-by-default"; gate G2 (fixed-copy flavour) is a "**Review
  preference**"; «مش» and «لسه» "are treated case-by-case rather than banned".
- **Amended:** for fixed copy — T1 chrome, T2b scripted voice, T3a analysis chrome, fixed T3b templates and T4 system —
  the register **is** neutral or simplified Modern Standard Arabic, and G2 is a **binding** gate: a word that locates
  the product in one market («مش»، «لسه»، «دلوقتي»، «دي»، «اللي»، «مفيش»، «تمام» as "OK", and their kind) is not used in
  fixed copy. A G2 failure is resolved by a natural simplified-MSA rewrite, never by demoting the string to a dialect.
- **Kept:** the G1 comprehension / ambiguity gate on every tier; "G2 may never produce bureaucratic copy", which now
  reads as the drafting obligation of every rewrite; the word-level G1 verdicts («شغّال» stays barred).

### LA-04 — VI-01 §3.4 · how far Egyptian may go in T2

- **Amended:** §3.4 now bounds generated Egyptian output only (T2a, when Egyptian is chosen or clearly the user's
  dialect). It admits nothing into fixed copy.

### LA-05 — VI-01 §14 and P4-C3's `RUNTIME_GATED` voice / call rows

- **Said:** voice and call strings are `PROVISIONAL / PHASE VII`, with Egyptian examples («بسمعك», «بجهّز الرد»).
- **Amended:** when `QAN-BL-VOICE-01` authors the Voice / call strings, they are fixed copy and are authored in neutral or
  simplified Modern Standard Arabic. V-01 … V-03 are the Product Owner's approved editorial references for that Copy
  Gate (§3). §14's vocabulary principles stay unchanged.

### LA-06 — VI-01 Copy Patterns P11

- **Said:** "the colloquial «جرّب تاني» stays available to QANDEEL's conversational voice".
- **Amended:** to generated turns (T2a) only. A scripted retry is fixed copy and uses a masdar or «يمكنك …», as the
  approved replacements in §2 do.

### LA-07 — G2.3 §1 "No gender-neutral rewrite is authorized by G2.3"

- **Amended:** by the [G2.3 LANG-01 controlled amendment](../../../design/i-08b3.1-g2.3/G2_3_LANG01_MATCHING_COPY_CONTROLLED_AMENDMENT.md),
  for the wording of M-01 … M-03 only.

### LA-08 — G1.1 §1, P4-C4 `opener`, P4-C3 check C-COPY-1

- **Amended:** the opener row only, by CA-01. P4-C4's other 103 rows stay as approved. P4-C3's check C-COPY-1
  (`openerdrift`) is evidence of the historical P4-C3 proof package and keeps certifying that package's bytes; it is
  not edited. The production pins move with the production string in Work Package B.

### LA-09 — W1B-01 §3.1–§3.2 and its §4 opener row

- **Amended:** by CA-01 and CA-02. The §4 statement that the normal opener "needs no amendment" is superseded by CA-01.
  Everything else W1B-01 decided (one coherent first-use surface, the start act, `{display_name}`, the separate
  First Conversation Opening) stays.

### LA-10 — A3-02 Product Copy Gate §24a

- **Amended:** by CA-05. The Product Owner's own edit «خلّيني» in the A3-02 gate is recorded as history; the register
  of 2026-10-13 supersedes it.

### LA-11 — W3-MEGA-M §6: "Egyptian conversational" Arabic for every memory-control reply

- **Said:** [record](../../../e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md) §6 and
  `memory-control.copy.ts` header: "Arabic is Egyptian conversational".
- **Amended:** memory-control replies are T2b scripted voice: neutral simplified Modern Standard Arabic, first person,
  gender-considerate (CA-03, CA-04). W3-MEGA-M's other copy principles stay: the words follow the outcome the database
  commits, quote the remembered words, never show an id, status or score, and frame a failure as the process's.

### LA-12 — MEM-AR-01 locked copy (Task Contract §9.1), CQ-1, L-10, L-11

- **Amended:** by CA-04. The subject-answer recogniser is a **recogniser, not copy**: it keeps every answer it
  recognises today, Egyptian included, and adds only the narrow Modern Standard Arabic answers that echo the amended
  question and labels («عن شخص آخر»، «شخص آخر»، «عني أنا»). No permission, subject rule, inference or third-party
  fact handling changes.

### LA-13 — I-08B3.1-E1R Arabic copy contract §1

- **Said:** [E1R](../../../design/canonical-artifacts/interaction-semantic-color/i-08b3.1-e1r/docs/E1_ARABIC_COPY_CONTRACT.md)
  "onboarding, empty states, nudges | warm; light colloquial is welcome".
- **Amended:** that row reads "warm, in simplified Modern Standard Arabic; warmth comes from wording, never from
  dialect". The errors / consent row is unchanged.

### LA-14 — I-08A4 §11 "Conversational voice"

- **Said:** [I-08A4](../i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md)
  §11: "Restrained Egyptian-compatible warmth may remain the current/default conversational profile where
  appropriate."
- **Amended:** superseded by D4 for the default. Restrained Egyptian is a generated profile used when chosen or clearly
  the user's dialect, never the default. §11's "locale/profile dependent and separately localizable" stays.

### LA-15 — the `ar-EG` proof-page language tag

- **Settled, no change:** no production fixed copy carries a regional language tag. The `ar-EG` tags live on
  historical proof pages (P4-C3, g3.2), which are evidence and are not edited. The HSE Energy instrument's `ar-EG`
  locale (`apps/api/src/human-model/hse-energy.model.ts`) is an approved measurement-instrument contract, not a copy
  tag, and is outside this amendment.

### LA-16 — T-14 §5 and the sign-in copy module's register claim

- **Said:** [T-14](../../../mobile-product-sign-in-gateway-v1.md) §5 calls its strings "gender-neutral"; the
  `product-sign-in-copy.ts` module comment says «أدخل» is permitted by VI-01 §3.6.
- **Amended:** «أدخل»، «حاول»، «تأكد»، «سجّل» are masculine imperatives and are not gender-neutral (VI-01 §3.6.3). CA-06 and
  CA-08 replace them. T-14's structural claims (one interface, both packs, no Arabic in the component) stay.

### LA-17 — D4 in the model-facing guidance

- **Authority:** D4 (WP0 record §14.14) and WP0 blocker 22: the approved guidance states no fallback.
- **Amended:** the model-facing guidance gains exactly one line per world type. The frozen Text v1 lines, the approved
  personality core (ACE-01) and its world-neutral form (ACE-SP-01), and the interaction-preference block (IP-IMP-01
  CA-2) stay byte-identical; the line is appended after the core.
  - **Personal conversation:**

    > When you reply in Arabic and neither an explicit request, a standing reply-language preference, nor a reasonably clear dialect in the user's own messages settles which Arabic to use, reply in neutral simplified Modern Standard Arabic. Never default to Egyptian Arabic or any other regional dialect.

  - **Shared World and Public World QANDEEL replies:**

    > When you reply in Arabic and neither an explicit current request nor a reasonably clear dialect in the message you are answering settles which Arabic to use, reply in neutral simplified Modern Standard Arabic. Never default to Egyptian Arabic or any other regional dialect, and never treat one participant's language or dialect as a standing preference for anyone else.

  The Shared / Public line reads only the message being answered, as ACE-SP-01 CG-1 requires: no participant's
  personal preference reaches another participant. The Personal precedence is unchanged: Safety, then an explicit
  current request, then the standing preference (IP-IMP-01), then the conversation. These lines are model-facing
  guidance, not user-visible copy, and they add no model call, classifier or dialect detector.

---

## 2. Copy amendments

Each section names the authority whose approved wording it supersedes, keeps that approval as history, and gives the
replacement verbatim. "Realized in" names the production source the Work Package B change edits; every reuse changes
with its source.

### CA-01 — the normal new-conversation opener

- **Supersedes the wording of:** [G1.1](../../../design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md) §1;
  [P4-C4](../p4/QANDEEL_P4C4_FINAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md) §2 row `opener`; W1B-01 §4's opener row.
- **Kept:** the three beats, the spaced ellipses and the `${isolate(displayName)}` placeholder (`{display_name}`);
  approved explicitly by the Product Owner.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| Q-01 | «اهلا يا ${isolate(displayName)} ... انا في انتظارك ... يلا نبدأ» | «أهلًا يا ${isolate(displayName)} ... أنا في انتظارك ... هيا نبدأ» | register `final_text` | `mobile: account/copy.ts` FIRST_USE_AR.normalOpener |

### CA-02 — First-use Welcome and First Conversation Opening

- **Supersedes the wording of:** [W1B-01](../w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md)
  §3.1 lines 2–3 and §3.2 line 2. Lines «أهلًا يا {display_name}.» and «أنا معك يا {display_name}.» are unchanged.
- **Kept:** Q-03 is still the start act and its accessible label; approved explicitly by the Product Owner.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| Q-02 | «أنا قنديل. كل ما نتكلم أكثر، أفهمك أكثر وأتذكر ما يهمك، علشان أساعدك تشوف نفسك وحياتك بشكل أوضح.» | «أنا قنديل. كلما تحدثنا أكثر، فهمتك أكثر وتذكّرت ما يهمك، لأساعدك على رؤية نفسك وحياتك بوضوح أكبر.» | register `final_text` | `mobile: account/copy.ts` FIRST_USE_AR.welcome[1] |
| Q-03 | «ابدأ بما يشغلك الآن.» | «لنبدأ بما يشغلك الآن.» | register `final_text` | `mobile: account/copy.ts` FIRST_USE_AR.welcome[2] |
| Q-04 | «ابدأ بما يشغلك الآن… حتى لو كان شيئًا لا تعرف كيف تصفه بعد. ونبدأ من هناك.» | «لنبدأ بما يشغلك الآن… حتى إن كان من الصعب وصفه. ومن هناك ننطلق.» | register `final_text` | `mobile: account/copy.ts` FIRST_USE_AR.firstOpening[1] |

### CA-03 — Conversational memory-control replies

- **Supersedes the wording of:** [W3-MEGA-M record](../../../e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md)
  §6 / §10 (task-approved delegated copy).
- **Kept:** every outcome and the exact meaning of remember, inspect, correct, forget, do-not-rely and clarify. The
  `quoteMemory(language, …)` placeholders are unchanged. The «رقمها يكفي.» line is unchanged.
- **Coupling:** the "no preceding section" form of MEM-03 drops its leading «و»: «وهناك …» → «هناك …», in place of
  today's `«وفيه» → «فيه»` derivation.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| MEM-01 | «ده اللي فاكره من كلامنا:» | «هذا ما أتذكّره من محادثاتنا:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.inspectIntro |
| MEM-02 | «وفيه حاجات أقدم كمان.» | «وهناك أشياء أقدم أيضًا.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.inspectOlder |
| MEM-03 | «وفيه حاجات لسه فاكرها، بس مش بعتمد عليها بناءً على طلبك:» | «وهناك أشياء ما زلت أتذكّرها، لكنني لا أعتمد عليها بناءً على طلبك:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.inspectKeptNotRelied (and its first-section derivation in inspectReply) |
| MEM-04 | «لسه مش فاكر عنك حاجة محددة.» | «لا أتذكّر عنك شيئًا محددًا حتى الآن.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.nothingRemembered |
| MEM-05 | «تمام، هفتكر ده:» | «حسنًا، سأتذكّر هذا:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.remembered |
| MEM-06 | «فاكر ده أصلًا:» | «أتذكّر هذا بالفعل:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.alreadyRemembered |
| MEM-07 | «دي معلومة حساسة، زي كلمة سر أو كود أو رقم هوية، ومش بحتفظ بالحاجات دي.» | «هذه معلومة حساسة، مثل كلمة مرور أو رمز أو رقم هوية، ولا أحتفظ بمثل هذه المعلومات.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.declinedSensitive |
| MEM-08 | «فاكرها كده أصلًا:» | «أتذكّرها بهذا الشكل بالفعل:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.alreadyCorrect |
| MEM-09 | «مش لاقي حاجة زي كده في اللي فاكره.» | «لا أجد شيئًا كهذا فيما أتذكّره.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.targetNotFound |
| MEM-10 | «تقصد أنهي معلومة بالظبط؟» | «ما المعلومة المقصودة تحديدًا؟» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.targetNotSpecified |
| MEM-11 | «المعلومة دي اتغيّرت قبل ما أعدّلها، فماغيّرتش حاجة.» | «تغيّرت هذه المعلومة قبل أن أعدّلها، لذلك لم أغيّر شيئًا.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.targetChanged |
| MEM-12 | «تمام، ماغيّرتش حاجة.» | «حسنًا، لم أغيّر شيئًا.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.declined |
| MEM-13 | «تقصد أنهي واحدة؟» | «أيّ هذه المعلومات هي المقصودة؟» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.whichOne |
| MEM-14 | «خلّينا ناخدهم واحدة واحدة. تقصد أنهي واحدة الأول؟» | «لنتناولها واحدة تلو الأخرى. بأيّها نبدأ؟» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.oneAtATime |
| MEM-20 | «تمام، صحّحتها. بقيت فاكر ${quoteMemory(language, current)} بدل ${quoteMemory(language, previous)}.» | «حسنًا، صحّحتها. أصبحت أتذكّر ${quoteMemory(language, current)} بدلًا من ${quoteMemory(language, previous)}.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` correctedReply (ar template) |
| MEM-21 | «تمام، نسيت ${quoteMemory(language, content)} ومش هرجع له تاني.» | «حسنًا، نسيت ${quoteMemory(language, content)} ولن أعود إليه مرة أخرى.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` forgottenReply (ar template) |
| MEM-22 | «تمام، مش هعتمد على ${quoteMemory(language, content)} في كلامنا، بس هفضل فاكرها.» | «حسنًا، لن أعتمد على ${quoteMemory(language, content)} في محادثاتنا، لكنني سأظل أتذكّرها.» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` disabledReply (ar template) |
| MEM-23 | «تقصد ${quoteMemory(language, options[0])}؟» | «هل المقصود ${quoteMemory(language, options[0])}؟» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` clarificationReply single option (ar template) |

### CA-04 — Memory subject question, sections and labels

- **Supersedes the wording of:** [MEM-AR-01 record](../../../e2e/QANDEEL_MEM_AR_01_MEMORY_CORRECTION_ARABIC_ACQUISITION_IMPLEMENTATION_RECORD_v1.md)
  §14 L-10 and L-11, the Task Contract §9.1 locked copy and CQ-1.
- **Kept:** CQ-1's rule in its new form: the first-section heading MEM-17 drops «أيضًا» as its original dropped «كمان».
  L-10's rule: labels appear only on otherwise identical options with different established subjects. The question
  MEM-15 is the register's explicit wording.
- **Recogniser (LA-12):** the answer set gains «عن شخص آخر» and «شخص آخر» (OTHER) and «عني أنا» (SELF), and loses
  nothing.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| MEM-15 | «المعلومة دي عنك إنت، ولا عن حد تاني؟» | «أهذه المعلومة عنك أنت، أم عن شخص آخر؟» | register `final_text` | `api: memory/memory-control.copy.ts` LINES.subjectQuestion |
| MEM-16 | «وفيه كمان حاجات حكيتلي عنها تخص ناس تانية:» | «وهناك أيضًا أشياء أخبرتني بها عن أشخاص آخرين:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.inspectAboutOthers |
| MEM-17 | «فيه حاجات حكيتلي عنها تخص ناس تانية:» | «هناك أشياء أخبرتني بها عن أشخاص آخرين:» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.inspectAboutOthersFirst |
| MEM-18 | «عنك إنت» | «عنك أنت» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.aboutYou |
| MEM-19 | «عن حد تاني» | «عن شخص آخر» | census «Proposed», verbatim | `api: memory/memory-control.copy.ts` LINES.aboutSomeoneElse |

### CA-05 — Push permission education

- **Supersedes the wording of:** [A3-02 record](../../../e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md)
  §24a, rows `eduTitle`, `eduBody`, `eduNotNow`, `notNowNote`. «السماح بالإشعارات» is unchanged.
- **Kept:** no re-engagement nudges; notifications can be reduced or turned off; Activity stays inside the app.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| P-01 | «خلّيني أوصلك لما يكون في حاجة تستاهل» | «إشعارات لما يهمّك فقط» | register `final_text` | `mobile: push/copy.ts` PUSH_COPY_GATE.rows.eduTitle |
| P-02 | «مش هبعتلك إشعار لمجرد إني أرجعك للتطبيق. هستخدم الإشعارات بس لما يكون في حاجة مهمة ليك، وتقدر تقللها أو توقفها في أي وقت.» | «لن أرسل إليك إشعارًا لمجرد إعادتك إلى التطبيق. سأستخدم الإشعارات فقط عندما يكون هناك ما يهمّك، ويمكنك تقليلها أو إيقافها في أي وقت.» | census «Proposed», verbatim | `mobile: push/copy.ts` PUSH_COPY_GATE.rows.eduBody |
| P-03 | «مش دلوقتي» | «ليس الآن» | census «Proposed», verbatim | `mobile: push/copy.ts` PUSH_COPY_GATE.rows.eduNotNow |
| P-04 | «تمام. النشاط هيفضل يظهر هنا جوه التطبيق.» | «حسنًا. سيظل النشاط يظهر هنا داخل التطبيق.» | census «Proposed», verbatim | `mobile: push/copy.ts` PUSH_COPY_GATE.rows.notNowNote |

### CA-06 — T-14 frozen sign-in copy and its reuses

- **Supersedes the wording of:** [T-14](../../../mobile-product-sign-in-gateway-v1.md) §5's network, password and
  unexpected-failure strings, and every reuse of them: the W1B-01 and W2-01 copy, Settings Public ID, and
  W3-MEGA-S `enterPassword`.
- **Kept:** the sign-in semantics and the non-enumerating failure meaning; approved explicitly by the Product Owner.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| A-07 | «تعذّر الاتصال. حاول مرة أخرى.» | «تعذّر الاتصال. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: integration/auth-gateway/product-sign-in-copy.ts` ARABIC.network<br>`mobile: account/copy.ts` ENTRY_AR.network<br>`mobile: account/access/copy.ts` ACCESS_AR.network<br>`mobile: settings/copy.ts` AR_BASE.publicId.network |
| A-18 | «أدخل كلمة المرور.» | «كلمة المرور مطلوبة.» | register `final_text` | `mobile: integration/auth-gateway/product-sign-in-copy.ts` ARABIC.missingPassword<br>`mobile: settings/copy.ts` APPROVED_W3_MEGA_S.ar.enterPassword |
| A-20 | «تعذّر تسجيل الدخول الآن. حاول مرة أخرى.» | «تعذّر تسجيل الدخول الآن. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: integration/auth-gateway/product-sign-in-copy.ts` ARABIC.unexpected |

### CA-07 — Account creation and email verification

- **Supersedes the wording of:** [W1B-01 record](../../../e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md) §2.1–§2.2.
- **Kept:** the Login ID grammar (3 to 30 English letters or digits, with . - _ between them), the
  `${isolate(email)}` placeholder (`{email}`), A-09 still not displayed today; approved explicitly by the Product Owner.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| A-01 | «معرّف خاص تستخدمه لتسجيل الدخول إلى قنديل. احتفظ به؛ لن يظهر للآخرين.» | «معرّف خاص لتسجيل الدخول إلى قنديل. من المهم الاحتفاظ به، ولن يظهر للآخرين.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.loginIdHelp |
| A-02 | «أدخل الاسم.» | «الاسم مطلوب.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.emptyName |
| A-03 | «أدخل معرّف الدخول.» | «معرّف الدخول مطلوب.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.emptyLoginId |
| A-04 | «استخدم من 3 إلى 30 حرفًا أو رقمًا بالإنجليزية. ويمكن استخدام . أو - أو _ بين الحروف والأرقام.» | «يتكوّن معرّف الدخول من 3 إلى 30 حرفًا أو رقمًا باللغة الإنجليزية، ويمكن استخدام الرموز . أو - أو _ بين الحروف والأرقام.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.malformedLoginId |
| A-05 | «أدخل بريدًا إلكترونيًا صحيحًا.» | «يُرجى إدخال بريد إلكتروني صحيح.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.invalidEmail<br>`mobile: account/access/copy.ts` ACCESS_AR.invalidEmail |
| A-06 | «معرّف الدخول هذا غير متاح. اختر معرّفًا آخر.» | «معرّف الدخول هذا غير متاح. يُرجى اختيار معرّف آخر.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.loginIdUnavailable |
| A-08 | «أرسلنا رمزًا إلى ${isolate(email)}. أدخل الرمز لتأكيد بريدك.» | «أرسلنا رمزًا إلى ${isolate(email)}. يُرجى إدخال الرمز لتأكيد بريدك.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.verifyInstruction |
| A-09 | «انتهت صلاحية رمز التأكيد. أرسل رمزًا جديدًا.» | «انتهت صلاحية رمز التأكيد. يمكنك طلب رمز جديد.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.codeExpired |
| A-10 | «تعذّر إرسال رمز التأكيد. حاول مرة أخرى.» | «تعذّر إرسال رمز التأكيد. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.resendFailed |
| A-11 | «تعذّر تأكيد البريد الإلكتروني الآن. حاول مرة أخرى.» | «تعذّر تأكيد البريد الإلكتروني الآن. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: account/copy.ts` ENTRY_AR.verifyFailed |

### CA-08 — Account access and recovery

- **Supersedes the wording of:** [W2-01 record](../../../e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md) §2.1, §2.4 and
  its copy gate rows N1, N6, N7 and N12.
- **Kept:** an incomplete code is not called incorrect (N6); the verify-linked-email instruction still names no email
  address; a failed sign-in still says nothing about whether an account exists; approved explicitly by the Product
  Owner.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| A-12 | «أدخل رمز إعادة التعيين المكوّن من 6 أرقام.» | «رمز إعادة التعيين يتكوّن من 6 أرقام.» | register `final_text` | `mobile: account/access/copy.ts` ACCESS_AR.codeShape |
| A-13 | «تعذّر التحقق من الرمز. تأكد منه أو أرسل رمزًا جديدًا.» | «تعذّر التحقق من الرمز. يُرجى التأكد منه أو طلب رمز جديد.» | register `final_text` | `mobile: account/access/copy.ts` ACCESS_AR.codeRejected |
| A-14 | «تعذّر تغيير كلمة المرور الآن. حاول مرة أخرى.» | «تعذّر تغيير كلمة المرور الآن. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: account/access/copy.ts` ACCESS_AR.updateFailed |
| A-15 | «تعذّر التحقق من جلستك الآن. تحقق من اتصالك وحاول مرة أخرى.» | «تعذّر التحقق من جلستك الآن. يُرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.» | register `final_text` | `mobile: account/access/copy.ts` ACCESS_AR.sessionUnverified |
| A-16 | «أدخل رمز التأكيد الذي أُرسل إلى البريد الإلكتروني المرتبط بحسابك.» | «يُرجى إدخال رمز التأكيد المُرسل إلى البريد الإلكتروني المرتبط بحسابك.» | register `final_text` | `mobile: account/access/copy.ts` ACCESS_AR.verifyLinkedEmailInstruction |
| A-17 | «أدخل معرّف الدخول أو البريد الإلكتروني.» | «يُرجى إدخال معرّف الدخول أو البريد الإلكتروني.» | register `final_text` | `mobile: integration/auth-gateway/product-sign-in-copy.ts` ARABIC.missingIdentifier |
| A-19 | «تعذّر تسجيل الدخول بهذه البيانات. تأكد منها وحاول مرة أخرى.» | «تعذّر تسجيل الدخول بهذه البيانات. يمكنك مراجعتها والمحاولة مرة أخرى.» | register `final_text` | `mobile: integration/auth-gateway/product-sign-in-copy.ts` ARABIC.invalidCredentials |
| A-21 | «انتهت جلستك. سجّل الدخول للمتابعة.» | «انتهت جلستك. يمكنك تسجيل الدخول للمتابعة.» | register `final_text` | `mobile: integration/auth-gateway/product-sign-in-copy.ts` ARABIC.sessionEnded |

### CA-09 — Public ID

- **Supersedes the wording of:** [W3-02 record](../../../e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate rows `invalid` and `unavailable`. «المعرّف العام» stays the frozen product term.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| A-22 | «أدخل معرّفًا عامًا صالحًا.» | «يُرجى إدخال معرّف عام صالح.» | register `final_text` | `mobile: settings/copy.ts` AR_BASE.publicId.invalid |
| A-23 | «المعرّف العام هذا غير متاح. اختر معرّفًا آخر.» | «هذا المعرّف العام غير متاح. يُرجى اختيار معرّف آخر.» | register `final_text` | `mobile: settings/copy.ts` AR_BASE.publicId.unavailable |

### CA-10 — Interaction Preferences

- **Supersedes the wording of:** [IP-IMP-01 record](../../../e2e/QANDEEL_IP_IMP_01_INTERACTION_PREFERENCES_IMPLEMENTATION_RECORD_v1.md)
  R1 UI copy rows `notSaved` and `loadFailed`, and CA-1's STALE reply, which reuses `notSaved`.
- **Kept:** CA-1's rule that a conversation reply is composed only of approved strings; the Settings notice and the
  conversation reply stay one string.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| IP-01 | «لم يُحفظ التغيير. حاول مرة أخرى.» | «لم يُحفظ التغيير. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: settings/interaction-preferences-copy.ts` INTERACTION_PREFERENCES_COPY_GATE.ar.notSaved<br>`api: interaction-preferences/interaction-preference.copy.ts` NOT_SAVED.ar |
| IP-02 | «تعذّر تحميل تفضيلاتك. حاول مرة أخرى.» | «تعذّر تحميل تفضيلاتك. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: settings/interaction-preferences-copy.ts` INTERACTION_PREFERENCES_COPY_GATE.ar.loadFailed |

### CA-11 — Notifications & Activity settings

- **Supersedes the wording of:** [A3-01 record](../../../e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate row `saveFailed`. Its first sentence is unchanged.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| AC-01 | «تعذّر حفظ التغيير. حاول مرة أخرى.» | «تعذّر حفظ التغيير. يمكنك المحاولة مرة أخرى.» | register `final_text` | `mobile: activity/copy.ts` ACTIVITY_COPY_GATE.rows.saveFailed |

### CA-12 — Shared World reachability

- **Supersedes the wording of:** [S4-01 record](../../../e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate rows `invitation`, `invalidSharedId` (itself a Product Owner amendment, kept as history),
  `sharedIdPrivacy` and `regenerateWarning`.
- **Kept:** the Shared ID's privacy meaning (anyone who holds it can invite the reader) and the regenerate
  consequences; the dual «بينكما».

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| SW-01 | «{0} يدعوك لإنشاء عالم مشترك بينكما ومع قنديل.» | «دعوة من {0} لإنشاء عالم مشترك بينكما ومع قنديل.» | census «Proposed», verbatim | `mobile: shared-world/copy.ts` AR.invitation |
| SW-02 | «تأكد من المعرّف المشترك وحاول مرة أخرى.» | «يُرجى التأكد من المعرّف المشترك والمحاولة مرة أخرى.» | census «Proposed», verbatim | `mobile: shared-world/copy.ts` AR.invalidSharedId |
| SW-03 | «معرّفك المشترك خاص. شاركه فقط مع من تريد أن يستطيع دعوتك إلى عالم مشترك.» | «معرّفك المشترك خاص. مشاركته تعني السماح لمن يحصل عليه بدعوتك إلى عالم مشترك.» | census «Proposed», verbatim | `mobile: shared-world/copy.ts` AR.sharedIdPrivacy |
| SW-04 | «سيتوقف معرّفك الحالي عن العمل، ولن تصل إليك الدعوات المرسلة إليه التي لم تقبلها بعد. عوالمك المشتركة الحالية لن تتأثر.» | «سيتوقف معرّفك الحالي عن العمل، ولن تصل إليك الدعوات المرسلة إليه التي لم تُقبَل بعد. عوالمك المشتركة الحالية لن تتأثر.» | census «Proposed», verbatim | `mobile: shared-world/copy.ts` AR.regenerateWarning |

### CA-13 — Shared World lifecycle and governance

- **Supersedes the wording of:** [S4-03 record](../../../e2e/QANDEEL_S4_03_SHARED_LIFECYCLE_GOVERNANCE_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate rows (CW2-03 §21, §23–§25), and the byte-exact S4-04 reuse of `memberRequestAdd` and
  `memberRequestRejoin` in the Shared Activity copy.
- **Kept:** every governance meaning: all other members approve a removal and the removed member does not; earlier
  words stay under their author's name; history sharing needs the required approvals; the exact preview scope; a
  former member's approval does not return them to the World; leaving is immediate and earlier words stay deletable
  from Settings.
- **SW-07:** the replacement has one `{0}`. The separately recorded `fill()` defect, which leaves a second `{0}`
  unreplaced, is not fixed by this wording and stays tracked (§4).

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| SW-05 | «{0} يقترح انضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.» | «اقتراح من {0} بانضمامك إلى عالم مشترك، وقد وافق عليه كل أعضائه.» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.memberRequestAdd<br>`api: shared-world/shared-activity-copy.ts` SHARED_ACTIVITY_COPY.memberRequestAdd |
| SW-06 | «{0} يقترح عودتك إلى عالم مشترك كنت فيه، وقد وافق عليها كل أعضائه.» | «اقتراح من {0} بعودتك إلى عالم مشترك كنت فيه، وقد وافق عليه كل أعضائه.» | register `final_text` | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.memberRequestRejoin<br>`api: shared-world/shared-activity-copy.ts` SHARED_ACTIVITY_COPY.memberRequestRejoin |
| SW-07 | «تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين. لا يحتاج {0} إلى الموافقة، ويبقى كلامه السابق باسمه.» | «تحتاج إزالة {0} موافقة جميع الأعضاء الآخرين، ولا تُطلب موافقة العضو المقترح إزالته. ويبقى الكلام السابق في هذا العالم باسم صاحبه.» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.removeExplain |
| SW-08 | «الانضمام إلى العالم لا يفتح كل تاريخه السابق تلقائيًا. يمكنك اقتراح مشاركة رسائل سابقة معه، ولا تتم مشاركة أي رسالة إلا بعد اكتمال الموافقات المطلوبة عليها.» | «الانضمام إلى العالم لا يفتح كل تاريخه السابق تلقائيًا. يمكنك اقتراح مشاركة رسائل سابقة مع هذا العضو، ولا تتم مشاركة أي رسالة إلا بعد اكتمال الموافقات المطلوبة عليها.» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.shareExplain |
| SW-09 | «سيرى {0} هذه الرسائل فقط:» | «ستظهر هذه الرسائل فقط لـ{0}:» | register `final_text` | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.previewHeading |
| SW-10 | «اقتراح بأن يرى {0} الرسائل السابقة التالية:» | «اقتراح بمشاركة الرسائل السابقة التالية مع {0}:» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.shareRequest |
| SW-11 | «اقتراح بأن يرى عضو في عالم مشترك لم تعد عضوًا فيه كلامك السابق هذا. موافقتك لا تعيدك إلى العالم:» | «اقتراح بإتاحة كلامك السابق هذا لعضو في عالم مشترك انتهت عضويتك فيه. موافقتك لا تعيدك إلى العالم:» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.formerShareRequest |
| SW-12 | «ستغادر فورًا، ولن تتمكن من رؤية هذا العالم وأنت خارجه. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات.» | «المغادرة فورية، ولن يظهر لك هذا العالم ما دمت خارجه. يبقى كلامك السابق فيه، ويمكنك حذفه لاحقًا من الإعدادات ← الخصوصية والبيانات.» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.leaveExplain |
| SW-13 | «كلامك في عوالم مشتركة لم تعد عضوًا فيها» | «كلامك في عوالم مشتركة انتهت عضويتك فيها» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.formerRow |
| SW-14 | «لا يوجد لك كلام في عوالم مشتركة لم تعد عضوًا فيها.» | «لا يوجد لك كلام في عوالم مشتركة انتهت عضويتك فيها.» | census «Proposed», verbatim | `mobile: shared-world/lifecycle-copy.ts` AR_OWN.formerEmpty |

### CA-14 — Shared Activity

- **Supersedes the wording of:** [S4-04 record](../../../e2e/QANDEEL_S4_04_SHARED_ACTIVITY_NOTIFICATIONS_DIRECT_ENTRY_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate row `joined` (JOINED and BIRTH sentences, Activity and push body).
- **Kept:** a completed fact, distinct from the pending proposal row «انضمام شخص جديد إلى هذا العالم». Activity rows
  already delivered keep the words they were delivered with.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| SW-15 | «انضم {0} إلى هذا العالم.» | «تمّ انضمام {0} إلى هذا العالم.» | census «Proposed», verbatim | `api: shared-world/shared-activity-copy.ts` SHARED_ACTIVITY_COPY.joined |

### CA-15 — Public authoring

- **Supersedes the wording of:** [S5-02 record](../../../e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate rows `chooseHeading` and `chooseHint`.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| PW-01 | «اختر ما سيصبح عامًا» | «اختيار ما سيصبح عامًا» | census «Proposed», verbatim | `mobile: public-authoring/copy.ts` chooseHeading |
| PW-02 | «من كلامك في قنديل، ومما تراه في عوالمك المشتركة. حتى 20 عنصرًا.» | «من كلامك في قنديل، ومما يظهر لك في عوالمك المشتركة. حتى 20 عنصرًا.» | census «Proposed», verbatim | `mobile: public-authoring/copy.ts` chooseHint |

### CA-16 — Public semantic review

- **Supersedes the wording of:** [S5-03A record](../../../e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate rows `ask`, `correctionScope` and `limited`.
- **Kept:** a correction concerns meaning and never lets the publisher choose the place (CW2-04 §13 / D15).

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| PW-03 | «اطلب فهم قنديل لهذه التجربة» | «طلب فهم قنديل لهذه التجربة» | census «Proposed», verbatim | `mobile: public-authoring/semantic-copy.ts` ask |
| PW-04 | «التصحيح يخص المعنى فقط، ولا ينقل التجربة إلى مكان تختاره.» | «التصحيح يخص المعنى فقط، ولا يتيح اختيار مكان التجربة.» | census «Proposed», verbatim | `mobile: public-authoring/semantic-copy.ts` correctionScope |
| PW-05 | «وصلت هذه التجربة إلى الحد المسموح اليوم. حاول لاحقًا.» | «وصلت هذه التجربة إلى الحد المسموح اليوم. يمكنك المحاولة لاحقًا.» | census «Proposed», verbatim | `mobile: public-authoring/semantic-copy.ts` limited |

### CA-17 — Public semantic field

- **Supersedes the wording of:** [S5-03B record](../../../e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate rows `searchLabel` (the Product Owner's own R1 wording, kept as history; one source, two surfaces),
  `sharedBy` and `placeAsk`.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| PW-06 | «ابحث عن تجربة أو شعور أو معنى» | «البحث عن تجربة أو شعور أو معنى» | census «Proposed», verbatim | `mobile: public-world/field/field-copy.ts` searchLabel |
| PW-07 | «شاركها {0}» | «مشاركة من {0}» | census «Proposed», verbatim | `mobile: public-world/field/field-copy.ts` sharedBy |
| PW-08 | «اطلب من قنديل تحديد مكانها» | «طلب تحديد مكان التجربة من قنديل» | register `final_text` | `mobile: public-world/field/field-copy.ts` placeAsk |

### CA-18 — Public discussion

- **Supersedes the wording of:** [S5-04 record](../../../e2e/QANDEEL_S5_04_PUBLIC_DISCUSSION_QANDEEL_FINAL_INTEGRATION_IMPLEMENTATION_RECORD_v1.md)
  Product Copy Gate row `invokeHint`.
- **Kept:** the U+200E LEFT-TO-RIGHT MARK immediately before `@qandeel`, the `@qandeel` token and the "its answer is
  public" disclosure. The replacement carries the mark exactly as the original does.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| PW-09 | «اكتب ‎@qandeel لتسأل قنديل هنا، وردّه يظهر للجميع.» | «يمكنك كتابة ‎@qandeel لتوجيه سؤال إلى قنديل هنا، وردّه يظهر للجميع.» | census «Proposed», verbatim | `mobile: public-world/field/discussion-copy.ts` invokeHint |

### CA-19 — Personal chrome and analysis language

- **Supersedes the wording of:** [W1A-01 record](../../../e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md) — the Product
  Owner's T-08 supersession «تتابع المحادثة الآن.» and the analysis-language package row "Moment-number hint".
- **Kept:** PC-01 stays a **state**, distinct from the act «العودة لمتابعة المحادثة». Per the W1A-01 record, the T-08
  stance slot keeps the full stop and the other surface does not: `orientation-chrome/product-copy.ts` carries
  «متابعة المحادثة مفعّلة الآن.» and `analysis-language/analysis-copy.ts` carries «متابعة المحادثة مفعّلة الآن». The
  `${digits(max)}` placeholder of PC-02 is unchanged. The vendored T-08 canon copies in the proof packages are not
  edited.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| PC-01 | «تتابع المحادثة الآن.» | «متابعة المحادثة مفعّلة الآن.» | register `final_text` | `mobile: orientation-chrome/product-copy.ts` AR.temporal FOLLOW_LIVE + liveHeadEstablished (T-08 slot: with its full stop)<br>`mobile: analysis-language/analysis-copy.ts` AR.followingConversation (no full stop, W1A-01 record :258) |
| PC-02 | «أدخل رقمًا من 1 إلى ${digits(max)}. ستظهر نظرة مؤقتة على اللحظة دون الانتقال إليها.» | «يمكنك إدخال رقم من 1 إلى ${digits(max)}. ستظهر نظرة مؤقتة على اللحظة دون الانتقال إليها.» | census «Proposed», verbatim | `mobile: analysis-language/analysis-copy.ts` AR.momentNumberHint |

### CA-20 — Product naming

- **Supersedes the wording of:** [I-08A4](../i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md)
  §8, the Arabic name of the row "Ask QANDEEL". The other 36 rows are unchanged.
- **Realization:** no production surface carries this name today. A future surface that names the capability uses the
  amended name.

| Unit | Superseded wording (approved original, kept as history) | Approved replacement (exact) | Source of the replacement | Realized in |
|---|---|---|---|---|
| N-01 | «اسأل قنديل» | «سؤالك لقنديل» | census «Proposed», verbatim | — |

---

## 3. Approved units this amendment does not put into force

| Units | Status | Owner |
|---|---|---|
| S-01 … S-06, the deterministic safety replies | editorially approved; **no** copy approval record ever existed for the in-force originals, and production integration needs an independent safety review first. Not amended here | LANG-01 Work Package D, blocked until the safety gate passes |
| M-04 … M-12, M-14 … M-16 | approved editorial references for not-yet-approved proof, fixture and Product Vision lines; no amendment is needed | the owning S6 Copy Gates, per the manifest |
| M-13 | approved editorial reference, **never** to be implemented or promoted: it names pre-Match identity and compatibility reasons, which G2 §D and G2.3 §2 forbid | S6-04's Copy Gate decides privacy-safe proposal copy |
| V-01 … V-03 | approved editorial references for the runtime-gated Voice / call strings | `QAN-BL-VOICE-01`, when it authors them (LA-05) |

The byte-preserved proof and vendored canon copies (for example
`docs/design/canonical-artifacts/product-proofs/g2/g2.3/README.md` and
`docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs`) stay as historical evidence and are
not edited.

## 4. Defects outside this amendment

- **SW-07 `fill()`.** `apps/mobile/src/shared-world/copy.ts` `fill()` replaces only the first `{0}`. The Arabic
  replacement has one `{0}`, so Arabic no longer shows a literal placeholder once Work Package B lands; the unchanged
  English `removeExplain` still has two and still shows one. This is a code defect, not a wording question, and stays
  separately tracked by the LANG-01 record.
