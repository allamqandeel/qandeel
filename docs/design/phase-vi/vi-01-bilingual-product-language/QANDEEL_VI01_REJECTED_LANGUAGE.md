# QANDEEL — VI-01 · REJECTED LANGUAGE LOG

**Status:** `FREEZE CANDIDATE — FIX-03 CONSISTENCY SEAL APPLIED. SYSTEM + SEMANTIC CONTRACTS FROZEN; VOCABULARY APPROVED; MICROCOPY PROPOSED / OPEN AS MARKED`
**Canonical authority:** `docs/design/phase-v/` @ `4e83b1ce2d854f1ba49a6de15572f1025d196647`

**No term in this log is rejected on taste.** Every entry carries a semantic, structural or
truth-boundary reason. A term rejected because someone disliked it would reappear the moment
that person changed their mind; a term rejected because it makes a claim the runtime cannot
support stays rejected.

Classification: `REJECT` (must not ship) · `REPLACE` (concept survives, word does not) ·
`INTERNAL ONLY` (legitimate, but never user-facing) · `RETAIN`.

## Four authorities of rejection — and why the difference matters

*(FIX-01 §13 established that not every rejection carries the same weight. FIX-03 §4 corrected the
map: an earlier version filed **engineering vocabulary, reviewer chrome and peer-labelling
schemes** under the truth ban — which contradicted that class's own definition, since none of them
is a false statement.)*

| | **A · `SEMANTIC / TRUTH HARD BAN`** | **B · `INTERNAL ONLY`** | **C · `PRODUCT / STRUCTURAL REJECTION`** | **D · `CURRENT-VOCABULARY PREFERENCE`** |
|---|---|---|---|---|
| **What it is** | The statement is **false or unsupported** under the current contract | **True**, but an implementation or reviewer concept users should not need | The wording or scheme conflicts with the chosen experience, creates ambiguity, scales badly, or risks implying rank — **not** a false statement | Not false; mis-sets the register for today's surfaces and voice |
| **Authority** | **Hard ban.** May never be written | Barred as *product copy* | Rejected **for the current architecture** | **Preference** for today's voice |
| **Revisitable?** | Only via a runtime contract that makes it true | If it becomes a genuine user concept | By a later architecture decision | By a later voice or capability decision |
| **Sections** | §4A, §7, §7.1 | §2, §3 | §1.1, §1.2, §8 | §4B, §5, §6 |

**The test for A:** would writing this sentence tell the user something **untrue about what the
system knows or did**? If yes, hard ban. If the term is merely internal, it is B. If the *scheme*
is wrong for the architecture, it is C. If it merely sounds wrong for QANDEEL, it is D.

**Nothing in this log forbids a legitimate future QANDEEL capability.** Advisory and
recommendation language is D, governed by the product/runtime contract for that capability if and
when it exists — not by this document.

---

# 1. The two named prototype terms

## 1.1 «المشهد» — `REPLACE` → the container is left unnamed; contents named «القراءات»

**Five product reasons, none of which depends on a Phase V prohibition:**

1. **It is an unnecessary metaphor the user must learn** before the surface gives them anything.
   «افتح المشهد» — *open the scene* — is abstract in a product whose stated personality is that
   it *speaks simply*.

2. **It is already ambiguous in-product.** The same word names both the surface and a layout
   region — the pager's accessible name is «مساحات المشهد», *the scene's spaces*. One word, two
   referents, in shipped markup.

3. **The product does not need a container noun.** The contents («القراءات») and the user's own
   subject already provide orientation.

4. **It risks making the interface feel theatrical and conceptual instead of direct.**

5. **Removing the noun increases restraint and shrinks product vocabulary** — the direction the
   naming framework pushes everywhere.

> **Correction (Product Direction, FIX-01 §3.1).** An earlier version of this log argued that
> «المشهد» "imports a spatial metaphor into the one surface where spatial meaning is forbidden
> (**A15**)" and that it "contradicts **A19**". **Both are overstatements and are withdrawn.**
> A15 bars visual dimensions from encoding *confidence, rank, strength, certainty or importance*
> — it does not forbid spatial meaning as such, and canonical Phase V deliberately **preserves**
> a gated future contextual-relevance semantic (**A22**). A19 preserves object identity across
> depths; it does not categorically forbid naming a surface. The five reasons above stand
> without either claim.

**What replaces it: less, not a synonym.** The surface gets **no product noun of its own**. Its
visible heading is the user's own subject; «القراءات» — already the user's word — serves as the
route label and the region's accessible name. One name is deleted. *(Foundation §7.1.)*

**Rejected alternatives:** «التفصيل» / "The breakdown" is generic and says nothing about the kind
of detail. **"Deep Analysis" is rejected independently on the English side:** it is generic
AI-product vocabulary, and "Deep" is an unnecessary self-claim about the product's own depth.
→ `INTERNAL ONLY`. *(An earlier version also argued that "Analysis" inherently implies a
conclusion. That is too broad — withdrawn. See §5, Authority D: "Analysis" is avoided in the current
vocabulary, not banned in every possible future context.)*

## 1.2 «الشغّال دلوقتي» — `REJECT` → AR «سياق الكلام» `APPROVED` · EN wording `OPEN`

**Four independent reasons:**

1. **Category error, with a live collision — the decisive one.** «الشغّال» is the word for a
   *machine that is running*. Applied to material extracted from a person's own words, it is
   mechanical and slightly industrial — and it **collides with «شغل» = work/job**, which is
   literally the user's subject in the product's own fixture («قرار الشغل الجديد»).
   «الشغّال دلوقتي» inside a conversation about «الشغل» is genuinely ambiguous, and ambiguity
   fails the comprehension gate in **every** register, not just in fixed copy.

2. **It is Egypt-locked slang in fixed chrome.** v1's fixed UI, analysis and system copy use
   neutral contemporary Arabic (Foundation §3.1); «دلوقتي» belongs to the conversational voice,
   not to a label read hundreds of times. *(An earlier version made this a structural argument
   about a required `AR-NEUTRAL` profile. **That framing is withdrawn** — v1 ships one Arabic
   product language, and the term fails on its own terms without it.)*

3. **It is a sentence wearing a noun's clothes.** This is why every use of it reads awkwardly:
   «شيلها من الشغّال»، «فتحت الشغّال دلوقتي»، «اقفل الشغّال دلوقتي». Labels must be nameable; this
   one has to be re-parsed each time.

**What replaces it, and the argument that decides it: unification.** The product currently uses
**two words for one idea** — the panel is «الشغّال دلوقتي» while the thing inside it is already
«السياق» («سياق انت فعّلته»، «فعّلت السياق»، «لغيت تفعيل السياق»). «سياق الكلام» does not import a
new word; it **removes a redundant one** and lets the existing user-facing term name its own
container. It is also a real Arabic collocation — *the context of what is being said* — which is
what a person would call this, not what an engineer would.

**"Live Context" → `INTERNAL ONLY`, and English does not mirror the Arabic.** "Live" is rejected
here as **technical AI-product vocabulary, ambiguous against realtime behaviour, and unnecessary
once the product concept is clear** — an **Authority D** current-vocabulary rejection, **not a claim that
"live" is inherently false** *(FIX-02 §4.2; exact realtime/call usage remains Phase VII-dependent)*.
"Context" in 2026 English reads as a model's context window, so literal **"Current context" is
rejected**. This is the package's model case
for transcreation over translation: the same concept is safe to name «سياق» in Arabic and unsafe
to name "context" in English.

**The English replacement is `OPEN`, not decided.** "In play" / "In play now" are the leading
candidates but carry a faintly idiomatic business/sports flavour and must be judged against the
real interaction (Foundation §7.2). **The concept is not reopened**, and "Live Context" does not
return as user-facing English unless later evidence defeats this direction.

---

# 2. Engineering terms — `INTERNAL ONLY`

Legitimate internally; must never appear in product copy, accessible names, error text or
QANDEEL's voice.

runtime / «الرَنتايم» · `MAX_ACTIVE_HYPOTHESES` · hypothesis · HIM · orchestrator · **peer** ·
peer reading · **material** · material selection · recency window · **provenance** · **subject
anchor** · **disconfirming condition** · context field · foreground · recede · snapshot · token ·
embedding · prompt · model · LLM · evidence layer · structural grammar · non-equivalence law ·
every `A`/`B`/`C`/`D` freeze identifier.

**Highest-risk five**, because each has a plausible-sounding Arabic or English rendering that
would read as product copy: «مادة» for *material*, «مصدرية» for *provenance*, «نظير» for *peer*,
«مرساة» for *anchor*, and "context" in English.

---

# 3. Reviewer terms already present in shipped markup — `INTERNAL ONLY`

**The highest-risk leak in the codebase**, because these are Arabic, well-written, and sit inside
the same document as product copy — they read like product copy:

«مُحاكى لاختبار التجربة» · «مدعوم من الرَنتايم» · «دفتر الصدق» · «ممنوع الاستنتاج» · «مُلخّص
للمراجعة» · «مسودة اختبار للثبات» · `Reviewer stress states` · `Replay state (R)` · `Truth
manifest` · `Mark simulated` · `Grayscale` · `Long Arabic` · `Reduced motion`.

**Simulated-only reviewer states must never enter product language** — this is a canonical
requirement, not a tidiness preference. A reviewer label that survives into production asserts
that a simulated capability is real.

---

# 4. Pseudo-intelligent terms — split by class

## 4A · Claims about what the system knows or did — **Authority A · truth hard ban**

«فهم عميق» · «قنديل بيفكّر» · "understands you" · "knows you" · "Thinking…"

**Reason:** each tells the user something untrue about the system's comprehension or its internal
state. "Thinking" asserts a deliberative process the product neither exposes nor evidences;
"understands you" and «فهم عميق» claim a depth of comprehension the runtime does not deliver.
**These are false, so they are hard-banned.**

## 4B · Self-congratulatory register — **Authority D · current-vocabulary preference**

**«ذكاء» · "intelligent" · "smart" · "insights" · «تحليل عميق» · "Deep Analysis" ·
"AI-powered" / «مدعوم بالذكاء الاصطناعي»**

**Reason:** these violate the product's defining sentence — *QANDEEL understands deeply, speaks
simply, and does not show off that it is intelligent* — and a product that asserts intelligence
sounds less intelligent than one that states its limits. **That is a personality judgement, not a
truth judgement.**

> **Correction (Product Direction, FIX-02 §4.1).** **"AI-powered" was previously classed as a
> capability overclaim. That was wrong: QANDEEL *is* an AI product, so the phrase is not false.**
> It is rejected from product copy as generic, self-congratulatory AI-product register — Authority D.
> «ذكاء», "intelligent" and "smart" moved with it for the same reason. **The Authority A test is
> whether the sentence would tell the user something untrue**, and applying it consistently means
> some things this log disliked are merely disliked.

---

# 5. Generic SaaS terms — **Authority D · current-vocabulary preference**

"Dashboard" · "Workspace" · "Overview" · "Summary" · "Analysis" · "Source" *(EN)* · "Get started" ·
"Explore" · "Dive in" · "Seamless" · "Powerful" · "Curated" · "Learn more" ·
"Something went wrong" · «لوحة التحكم» · «ابدأ الآن» · «اكتشف»

**None of these is false.** Each is avoided *now*, and each has a condition that would make it
correct:

| Term | Why avoided now | What would change it |
|---|---|---|
| "Summary" / «ملخّص» | On the current Deep Analysis surface it **can read as** a settled synthesis, and it is generic. **A summary can summarise alternatives without forcing a winner** — this is a style choice, not a semantic impossibility *(FIX-02 §5)* | A surface whose contract is genuinely to summarise |
| "Overview" | Implies completeness the bounded selection does not have | A view that really is complete |
| "Analysis" / «تحليل» | Generic AI-product vocabulary in the current framing | A capability where it is the accurate word |
| **"Live"** *(user-facing context panel)* | Technical AI-product vocabulary, ambiguous against realtime behaviour, and unnecessary once the product concept is clear. **Not inherently false in every usage** *(FIX-02 §4.2)* | A realtime surface where Phase VII establishes it as accurate |
| "Source" *(EN only)* | English "Source" reads as citation; **Arabic «مصدر» is approved and in use** | An English surface where citation is the meaning |
| "recommend" / "advice" / «ننصح» | Out of scope for Deep Analysis, which reports alternatives | **A future advisory capability with its own product/runtime contract** |
| The rest | Generic SaaS register | A deliberately different product voice |

**One entry is stronger than the rest:** "Something went wrong" is vague where errors must be
specific — that is a usability failure, not merely a register one, and it stays out regardless of
future capability.

---

# 6. Therapy and journaling terms — **Authority D · current-vocabulary preference**

«رحلتك» · «مساحتك الآمنة» · «تأمّل» · «خُد وقتك» · "your journey" · "safe space" · "check in
with yourself" · "reflect" · "growth" · "sit with this" · "I hear you" · "That sounds hard" ·
"I understand"

**Reason:** the brief bars the therapy register outright — a **personality** decision, and a
settled one, but not a truth one. The prototype's own line is the correct posture and the direct
contradiction of this family: «لسه بدري عليّا أقول لك إني فاهم الموضوع» — *it is too early for me
to say I understand this.*

**One qualification.** "I understand" / "I hear you" sit at the edge of Authority A: on a surface
where QANDEEL has recorded material but drawn no conclusion, they claim a comprehension it cannot
evidence. They are listed here because the word itself is not inherently false — a future surface
with a real basis for it could use it — but on today's surfaces they should be treated as if they
were hard-banned.

---

# 7. Truth-violating patterns — **Authority A · truth hard ban**

Rejected on canonical truth boundaries, not on style. **This is the section that may never be
revisited by a later task without a runtime contract that makes the claim true.** Full table in
Foundation §18.

**Ranking / weighting:** «القراءة الأرجح» · «القراءة الأساسية» · «الأقوى» · «دليل أقوى» · «قوة
العلاقة» · «وزن» · «درجة» · «ترتيب» · "primary reading" · "most likely" · "stronger evidence".

**Quantified confidence:** «نسبة ثقة» · «ثقة عالية» · «٧٠٪» · "70% confident" · "High
confidence" — *the quantity does not exist to render.*

**False memory claims:** «قلت بالحرف» · "You said, quote:" · "You said this in message 4" ·
**quotation marks or guillemets around recorded material** — a typographic verbatim claim that
contradicts the provenance sentence beside it.

**False causality:** «التصحيح اتطبّق» · "Correction applied" · «إجابتك قفلت الحاجة الناقصة» ·
"Your answer closed this gap" · «يوم ١٢ حصل» *(record date read as event date)*.

**False counts:** «القراءتين» as a fixed frame · "Both readings" · «قراءتين مختلفتين» /
"Two different readings" *(distinctness is not guaranteed)*.

**Unsupported *runtime-derived* relevance:** «الأقرب لموضوعك» · "Most relevant to this" ·
"nearby" · «الأقرب» — **any copy claiming that current memory or context items were selected,
ordered, positioned or surfaced by computed contextual relevance.** Production has no
client-readable relevance computation, and **A22** gates the capability
(`RESERVED FUTURE CAPABILITY / SIMULATED ONLY UNTIL RUNTIME SUPPORT EXISTS`). The **A15**
non-equivalence law stands: relevance may never alias importance, confidence, truth, evidence
strength, priority, rank, certainty or correctness.
*(Scoped by FIX-03 §5: **the ordinary word "relevant" is not globally banned** across unrelated
future QANDEEL capabilities — what is banned is the claim that this selection was computed by
relevance.)*

**Reading verdicts:** «مدعومة» · «ضعيفة» · «مرفوضة» · "Supported" · "Weak" · "Rejected" ·
"Retired" — forbidden states.

**Unknown refusal:** «مش هقول» · "I won't say" — an unknown is *missing*, never *withheld*.

## 7.1 Bounded-runtime claims — added after the canonical gate

Both directions are wrong, and the second is the subtle one:

- ❌ «قراءات من غير حد» / "as many readings as it needs" — **the runtime is bounded, not
  unlimited.** `MAX_ACTIVE_HYPOTHESES = 32`, per user.
- ❌ «لحد ٣٢ قراءة» / "up to 32 readings" — the cap is **per user, not per subject**, and **no
  per-subject cap was found**. Stating any ceiling for a subject asserts a fact the runtime does
  not supply, and a stated maximum invites the count to read as a score (**A14**).

*The local `prototypes/` Phase V copies still contain the stale claim that the runtime caps
nothing. That wording must never be re-imported.*

---

# 8. Peer-labelling schemes — **Authority C · product / structural rejection**

«قراءة أ / ب / ج» · «القراءة الأولى / التانية» · «القراءة التانية» *(= "the other")* · numbered
readings · "Reading A / B" · "first / second reading" · "the other reading" · "both readings" ·
left/right or يمين/شمال references.

**Rejected for the current architecture** — **not because any of them is a false runtime
statement** *(reclassified by FIX-03 §4; an earlier version filed this section under the truth
hard ban, which the class's own definition does not support)*.

**The product decision, stated at its actual width:**

> **QANDEEL will not use a user-facing reading identity whose sequence or order can be mistaken
> for hierarchy, breaks bilingual or accessible navigation, or becomes the identity itself.**

That preserves **A2** — peers are equal and unranked, with no order that means merit — **without
claiming that every sequence inherently equals rank**, which the canonical freeze does not say.

**The concrete failures behind the decision:** abjad letters lose intuitive ordering long before
the 32-per-user bound; "the other" and "both" are valid only at exactly two; positional references
break under RTL/LTR parity and are meaningless to screen-reader users.

**Boundedness does not rescue these.** It limits how badly an order-bearing identity fails; it
does not stop the order being read as hierarchy.

**VI-02 owns the replacement.** Nothing here prescribes the final identity mechanism.

---

# 9. Gendered-default patterns — `REJECT`

Under the addressee-gender policy (Foundation §3.6), these are rejected as *defaults*, not as
words — each is legitimate where a reliable, explicit preferred form of address exists.

Gendered imperatives in fixed chrome: «صحّح» · «ابعت» · «شوف» · «شيل» · «اكتب» · «جرّب» · «افتح».
Gendered second-person verbs and participles in fixed strings: «انت اللي رفعت» · «مضايقاك» ·
«تقدر تكمّل».

**Two hard rules:**

- **Never ship a single masculine form labelled "neutral."** Where a fixed string genuinely
  cannot be natural without inflection, ship an explicit `AR-M` / `AR-F` variant pair as a
  localization requirement.
- **Never infer gender** from name, avatar, voice or writing style, and never add a mandatory
  onboarding gender question to solve copy grammar.

**And one limit on the replacement technique.** The masdar convention Arabic UIs already use
handles most of these mechanically — but **the masdar is not mandatory, and neutrality is a
constraint rather than the copy objective.** Where the neutral rewrite turns constructed
(«تركيز العرض») or evaluative («استبعاد مؤقت»), **the string is marked `OPEN` and resolved with
the real interaction** — it is not shipped to protect a neutrality score. See Copy Patterns
**P-gender** step 6.

---

# 10. Terms retained after challenge

Recorded so the reasoning is not re-litigated. Each was reopened and survived on merit.

| Term | Why it survived |
|---|---|
| «الكلام» / "Conversation" | Plain, warm, transparent across markets, and the load-bearing referent for «سياق الكلام»، «داخلة مع الكلام»، «كمّل الكلام». Its plainness is the personality. |
| «قراءة» / "reading" | Carries exactly the needed meaning — an interpretation that could reasonably differ, with no truth claim. Non-ordinal, count-neutral, already the user's own word. **"Peer" never ships.** |
| Recorded material framed as *from the user's own words* · EN "from what you said" | The provenance is *inside the name* — the cheapest guard against both the verbatim trap and the authorship trap. **Exact Arabic is `PROPOSED`** — «اللي مسجّل من كلامك» vs «المسجّل من كلامك». |
| Role semantics: SUPPORTING / CONTRADICTING · EN "supports" / "contradicts" | Nominal, no magnitude. **A5**. «بتشدّ ضد» did **not** survive: the plainer term is clearer, flatter and less likely to imply strength — sufficient reason. *(An earlier claim that force metaphors necessarily violate A15 over-argued and is withdrawn.)* **Exact Arabic is `PROPOSED` after the FIX-02 register audit** — «تسند»/«تعارض» leading, «بتسند»/«بتعارض» incumbent. |
| Unknown pattern · EN "Not known: …" | States a gap without an agent — no refusal, no utility claim, no answer-driven closure. **Exact Arabic is `PROPOSED`** — «مش معروف …» vs «غير معروف: …» (Foundation §13). |
| «مفترضة إن» / "assumes that" | Flat and non-committal; reads as a stated premise, not a confidence qualifier. |
| «قنديل» | The product name. First person in voice; the name appears only where the system is described. |

---

**`REJECTION LOG — FIX-03 CONSISTENCY SEAL APPLIED. FOUR AUTHORITIES: A = FALSE (HARD BAN) ·
B = INTERNAL ONLY (TRUE, NOT USER-FACING) · C = PRODUCT / STRUCTURAL · D = CURRENT-VOCABULARY
PREFERENCE. ONLY A IS PERMANENT. NOTHING HERE FORBIDS A FUTURE QANDEEL CAPABILITY.`**
