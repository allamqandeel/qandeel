# QANDEEL — VI-01 · BILINGUAL PRODUCT LANGUAGE FOUNDATION

**Phase:** VI — Final Visual Design + Design Systemization
**Task:** VI-01 — Bilingual Product Language & UX Vocabulary Foundation
**Status:** `FREEZE CANDIDATE — FIX-03 CONSISTENCY SEAL APPLIED. SYSTEM + SEMANTIC CONTRACTS FROZEN; VOCABULARY APPROVED; MICROCOPY PROPOSED / OPEN AS MARKED`
**Workspace:** local / non-canonical · not committed
**Inherits:** Phase V structural grammar (A1–A23, B1–B12, D1–D7, Runtime/Truth Boundaries)
**Does not decide:** graphic language, palette, typography, iconography, motion, component styling, navigation design

---

## 0. Baseline note (read first)

**Authority source: canonical `docs/design/phase-v/` on remote `main` at
`4e83b1ce2d854f1ba49a6de15572f1025d196647`** (merge of PR #186,
`docs/phase-v-archival-checkpoint-v1`, 2026-09-01T03:09:11Z), read via the GitHub Contents
API because normal git transport is blocked on this machine by Windows Application Control
(`libcurl-4.dll`). Documents read, in the mandated authority order:

1. `QANDEEL_PHASE_V_Closure_Structural_Grammar_Freeze.md`
2. `QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md`
3. `QANDEEL_V10_COHERENCE_FREEZE_REPORT.md`
4. `QANDEEL_V7_COMPARATIVE_EVALUATION_REPORT.md`
5. `QANDEEL_V10_TRUTH_MANIFEST.md` — for truth-boundary detail
6. `ARCHIVE-MANIFEST.md` — for the record of post-review corrections

**VI-01 was initially drafted against the local `prototypes/` copies, which are stale.**
Those copies are the historical source workspace, not the canonical authority. The pre-flight
gate `VI-01 FIX-00` re-read the canonical archive and diffed it against them. Result: **four
of six documents differ, and every substantive difference is the same single correction** —
`PHASE V ARCHIVAL FIX-01`, the runtime peer-cap truth repair, applied during independent PR
review. `QANDEEL_V7_COMPARATIVE_EVALUATION_REPORT.md` and `QANDEEL_V9_DESIGN_RATIONALE.md`
are byte-identical.

**The corrected fact, and it matters to this task:**

> The runtime caps active hypotheses at **`MAX_ACTIVE_HYPOTHESES = 32`, enforced per user**.
> **No per-subject cap was found.** A single subject can therefore plausibly expose peer
> counts well beyond the six-control mobile pager ceiling — into double digits — but **the
> runtime is bounded, not unlimited**, and nothing claims all 32 belong to one subject.

The stale local wording said the opposite: *"the runtime caps nothing"* / *"any number of
readings"*. Two claims in this document were derived from that stale wording and have been
corrected (§10.2, §18); the correction also produced a **new guardrail** in §18 that the
stale source could not have produced. Everything else survived revalidation unchanged: the
canonical A15, A22, A23, D7 and the entire Contextual Relevance runtime gate are
byte-identical to what was originally read, so every conclusion resting on them stands.

**Live vocabulary was audited from the frozen V10 prototype itself**
(`prototypes/v10-coherence-freeze/index.html`) — canonically archived at
`docs/design/phase-v/evidence/v10-coherence-freeze/index.html`, SHA-256
`67e19a49…d47bbb`, confirmed **byte-identical** to the local copy by `ARCHIVE-MANIFEST.md`.
215 distinct Arabic strings extracted and reviewed. The vocabulary audit therefore needed no
revalidation.

**Live vocabulary was audited from the frozen V10 prototype itself**
(`prototypes/v10-coherence-freeze/index.html`), not from prose descriptions of it — 215
distinct Arabic strings extracted and reviewed.

**Material finding from that audit: QANDEEL has no English product language at all.** Every
English string in every prototype is reviewer chrome (`Reviewer stress states`,
`Replay state (R)`, `Truth manifest`, `Grayscale`, `Long Arabic`, `Mark simulated`,
`Reduced motion`). This is good news and it shapes this task: the English system is being
authored natively for the first time, with no legacy English to unlearn and no risk that
Arabic was derived from it. Arabic is the origin language; English is a peer built beside
it, not downstream of it.

---

## 1. Executive recommendation

**Ten recommendations, in priority order.**

1. **Retire «المشهد». Do not replace it with another surface noun.** Deep Analysis does not
   need a name for its container; it needs a name for its *contents*. The contents are
   already named and already understood by users: **القراءات**. «المشهد» is a metaphor the user
   must learn before receiving anything, it is already ambiguous in the prototype (the same
   word names a surface *and* a layout region), and it makes the interface read as theatrical
   rather than direct. Net effect: one product noun is deleted, not swapped.

2. **`REJECT` «الشغّال دلوقتي». Arabic direction `APPROVED`: «سياق الكلام».** Four reasons:
   a **meaning collision with «شغل»** — the user's literal subject in the product's own fixture;
   an **awkward sentence-like label** that has to be re-parsed at every use; an **unnecessary
   split** between the panel name and the «سياق» concept the product already exposes
   («سياق انت فعّلته»); and **excessive Egypt-specific flavour for a repeatedly-read fixed
   label**. *(An earlier draft made "no neutral-Arabic counterpart" the decisive argument. That
   framing was withdrawn in §3.3 and in the rejection log; the term fails on its own terms.)*

3. **English must diverge from literal "Context" — and its exact wording is `OPEN`.** «سياق» is
   ordinary Arabic; "context" is captured English — in 2026 an English reader parses "Current
   context" as a model's context window, so **literal "Current context" is rejected**.
   **"In play" / "In play now" are leading candidates only**; the exact English string is
   **`OPEN — VI-02/VI-03`** and must be judged against the real interaction (§7.2). The
   *divergence* is the frozen decision; the *word* is not.

4. **Adopt a register law keyed to accountability, not to surface.** Chrome, analysis and
   system language use **neutral contemporary Arabic**; QANDEEL's conversational voice uses
   **restrained Egyptian**. Admission to the neutral register is decided by an explicit
   **transparency test** (§3.2), not by taste and not by an MSA/dialect binary.

5. **Ship ONE Arabic product language in v1.** Fixed UI, analysis and system copy use neutral
   contemporary Arabic — clear, adult, modern, neither classical nor stuffed with Egypt-only
   slang, and allowed to sound naturally Arabic rather than artificially pan-Arab. QANDEEL's
   conversational voice uses restrained Egyptian for the launch experience while staying
   intelligible outside Egypt. **Do not pre-author a second Arabic product.** *(Product
   Direction, FIX-01 §2.2: an earlier draft of this document made dual `AR-EG` / `AR-NEUTRAL`
   chrome profiles a v1 shipping requirement. That was premature scope expansion and is
   withdrawn — it survives only as a future-localization principle, §3.3.)*

6. **Freeze what reading identity may never be; leave the solution to VI-02.** Frozen:
   **never ordinal as merit or rank**, **never first/second/"the other" as identity**, **never
   left/right positional identity**, and **every exposed reading stays reachable**.
   «قراءة أ / ب / ج» remains `REJECT` — using a letter sequence **as the user-facing
   identity** makes order salient, can be mistaken for hierarchy, scales poorly for
   bilingual/accessibility use, and risks the sequence becoming the identity itself (**A2**).
   **Content-derived identity, built from existing truthful reading content, is the first
   direction to test in VI-02** — it is not declared mandatory or final here, and a
   runtime-supplied short label remains `DEFERRED POSSIBILITY — NOT REQUESTED` (§10.2).

7. **Delete the count-switched label.** The prototype's shared-region accessible name switches
   on exactly two readings (`n===2 ? 'اللي في القراءتين' : 'اللي مشترك بين القراءات'`). Aggregate
   and region labels must be count-independent. Per-item labels may vary with count **only**
   if all three Arabic number forms are authored (§10).

8. **Stop typographically quoting recorded material.** The prototype wraps it in guillemets
   while the provenance line states it is not a transcription. The typography contradicts the
   copy, and the typography wins. Recorded material renders as plain text.

9. **Prefer naturally gender-neutral fixed Arabic — as a constraint, not as the objective.**
   The masdar convention Arabic UIs already use («حفظ»، «إرسال») carries no addressee
   inflection, and `-ك` possessives are invisible to gender in unvowelled script. These are the
   first tools to reach for, **not a rule that every control must be a masdar.** Where a neutral
   rewrite becomes bureaucratic, constructed or less understandable, the interaction is
   redesigned or the string stays open — «تركيز العرض» is the live example, and it is now
   `OPEN` rather than recommended (§9, §3.6).

10. **Freeze the system; keep the sentences editable.** The final policy, in three tiers (§20):
    **FROZEN** — the language system and its semantic contracts: register architecture, truth
    guardrails, naming-minimization, gender policy, peer-scaling constraints,
    provenance/correction semantics, accessibility invariants. **APPROVED** — the core vocabulary
    Product Direction has settled. **PROPOSED / OPEN** — exact microcopy, which stays editable in
    VI-02/VI-03 provided the semantic contract, runtime truth, accessibility and bilingual
    equivalence hold. **This is not an unfinished foundation; it is a system that survives
    rewording, which is the only kind worth freezing.**

---

## 2. Language philosophy

**The sentence the whole system serves:**

> QANDEEL understands deeply, speaks simply, and does not show off that it is intelligent.

Four operating consequences.

**QANDEEL does not manufacture certainty.** It does not rank peer readings, and it does not turn
incomplete evidence into a forced winner. **Deep Analysis** reports accountable alternatives and
named unknowns; the prototype already says this better than a guideline could — «قنديل بيعرض اللي
مسجّل عنده وبيحطّ القراءات جنب بعض. القرار مش عنده.» That is the thesis sentence *for this
surface* and it should survive Phase VI intact.

**Scope note (Product Direction, FIX-01 §11).** This is a rule about Deep Analysis and about
unsupported certainty — **not** a global prohibition on QANDEEL ever advising or recommending.
Advice or recommendation elsewhere in the product is governed by the product/runtime contract for
that capability, and VI-01 has no authority to remove a future capability from the product by
writing a copy rule. An earlier draft of this section said QANDEEL "does not conclude, rank,
recommend or resolve"; that was too broad and is withdrawn.

**Restraint is the personality, not a limit on it.** The distinctive thing about this voice is
what it declines to say. «لسه بدري عليّا أقول لك إني فاهم الموضوع» — *it is too early for me to
say I understand this* — is more characterful than any adjective the product could apply to
itself. A product that admits the boundary of its own understanding sounds more intelligent
than one that asserts intelligence, and it is the only honest register available given §9.

**Plainness is a truth mechanism, not a style preference.** Nearly every forbidden claim in
§18 enters through decorative language: a hedge becomes a confidence band, an intensifier
becomes evidence strength, a metaphor becomes a spatial rank. Flat language is the cheapest
available guard. This is why the analysis register is the *least* colloquial register in the
system, not the most.

**The user is the one who knows things.** The material is theirs, the words are theirs, the
decision is theirs. Language must never invert this.

**Scoped rule (Product Direction, FIX-02 §3.1):** **QANDEEL does not manufacture authority,
status or achievement.** It does not posture as an authority over the user's lived experience,
invent milestones, or hand out gamified praise. **Guidance and advice are permitted wherever the
product/runtime contract supports that capability**, and **acknowledgement or congratulation must
refer to a real user or product event, never generic validation.** *(An earlier draft said
QANDEEL "never grants, awards, unlocks, guides, or congratulates." That banned legitimate future
capability from inside a copy task and is withdrawn.)*

---

## 3. Arabic register system

Arabic is authored first and natively. Nothing in this section is derived from an English
string.

### 3.1 The register law

**Register follows accountability, not surface.** The more a sentence commits QANDEEL to a
claim, the flatter it is. The less it commits, the warmer it may be.

| Tier | Where | Register | Why |
|---|---|---|---|
| **T1 · Chrome** | navigation, controls, labels, region names, accessible names | **Neutral contemporary Arabic** | Read hundreds of times; must survive market expansion; must fit 375px. A regionalism here is a permanent tax, not a flourish. |
| **T2 · Voice** | QANDEEL's conversational turns | **Restrained Egyptian** | The one place a person is addressed directly. Distance here reads as coldness, and coldness is not the product. |
| **T3a · Analysis chrome** | region names, role labels, state labels, headings — the repeated furniture of the analysis surface | **Neutral contemporary Arabic, flat** | Read on every record and every reading. Maximum clarity, zero theatricality; colloquial hedging (يمكن، شكله، أكيد) smuggles in confidence semantics that §18 forbids. |
| **T3b · Analysis prose** | reading statements, assumptions, review conditions, the body of a named unknown — QANDEEL writing *about the user's own words* | **Restrained Egyptian, flat** | **Added by FIX-02.** These sentences restate a person's life back to them. Forced into MSA they read as a legal summary of the user, which is a worse product than a slightly local one. The *flatness* constraint still applies in full: no hedging, no intensifiers, no epistemic dialect words. |
| **T4 · System** | errors, permissions, retry, unavailability | **Neutral contemporary Arabic, accountable** | Process-framed, never confession-framed. |

**Why T3 was split (FIX-02 §6).** The single-tier version created a contradiction the package
could not survive: it declared all analysis copy neutral, then approved analysis strings written
in Egyptian («لسه ناقصة»، «مش معروف …»، «بتسند»). The resolution is **not** to force those
sentences into MSA — that produces exactly the bureaucratic copy §3.6.2 bars. It is to recognise
that the analysis surface holds two different kinds of text, and only one of them is furniture.
**Labels are neutral; sentences about the user's material may carry the voice.**

**The one hard rule across tiers:** no single sentence may mix tiers. A T1 button inside a T2
sentence is the most common way a bilingual product starts to sound assembled rather than
written.

### 3.2 What "neutral contemporary Arabic" means here — the transparency test

It is **not** فصحى تراثية and **not** MSA-by-default. It is the register of a well-made
contemporary Arabic product: MSA lexicon, contemporary syntax, short imperative verbs, no
classical particles (لقد، سوف، إنّ), no displayed case endings, no bookish lexis.

Admission is guided by one question, applied per word:

> **Would a reader in Cairo, Riyadh, Beirut and Casablanca all understand this word unaided,
> in this context?**

> **This is a review heuristic, not a linguistic classifier** *(Product Direction, FIX-02 §6.1)*.
> It is a prompt for a native-speaker judgement call, and the verdicts below are **reviewer
> opinions, not measured facts**. This package makes **no evidenced claim** that «مش» or any
> other word is objectively "pan-Arabic market-neutral" — no such study was run. Treat the table
> as a starting point for the native-product-language pass, and expect it to be revised.

| Word | Reviewer read | Note |
|---|---|---|
| سياق | comfortable | ordinary Arabic, not jargon; MSA lexeme |
| جرّب | comfortable | widely used across dialects |
| مش | *likely* comfortable | colloquial negation with broad reach — **not verified** |
| لسه | *likely* comfortable | close cognates in Egyptian/Levantine — **not verified** |
| دي / اللي / مفيش | Egypt-Levant flavoured | understandable widely; locates the product |
| دلوقتي | strongly Egypt-marking | the clearest flavour signal in the set |
| مظبوط | Egyptian | not transparent everywhere |
| شغّال *(the "running" sense)* | **ambiguous — G1 failure** | mechanical register **and** collides with شغل = job |
| هات / شيل | Egyptian imperatives | and gendered (§3.6) |

**The test has two gates, and they apply to different tiers of the *same* Arabic — not to two
different Arabics.**

| Gate | Question | Applies to | Authority |
|---|---|---|---|
| **G1 · Comprehension / ambiguity** | Would this be misunderstood, or does it mean two things at once? | **every tier** | **Hard gate.** A G1 failure is a defect and must be fixed. |
| **G2 · Fixed-copy flavour** | Does it locate the product in one market more than a repeatedly-read label should? | **T1 chrome, T3a analysis chrome, T4 system** | **Review preference.** A G2 flag triggers a rewrite **or** a demotion to `PROPOSED`/`OPEN` — **never a stiff string.** |

**G2 may never produce bureaucratic copy.** *(FIX-02 §6.1.)* If the neutral rewrite is worse than
what it replaces, the correct outcome is to leave the exact wording `PROPOSED` and freeze the
semantic pattern instead. Market-neutrality is a constraint, exactly like gender-neutrality — not
the copy objective.

**T2 voice and T3b analysis prose need only G1.** Warmth may be local; meaning may not. This is
what lets QANDEEL's sentences stay restrained-Egyptian while the labels stay neutral contemporary
— one Arabic, two registers, which is ordinary in any well-made Arabic product.

Applied: «سياق»، «جرّب» clear both gates. **«شغّال» *(running)* fails G1** — it is genuinely
ambiguous against «شغل» = job, which is why «الشغّال دلوقتي» cannot be rescued by reclassifying it
as voice; «مظبوط»، «هات»، «شيل» are barred from fixed copy on flavour and, for the last two, on
gender. **«دلوقتي»، «مفيش»، «دي»، «اللي» clear G1 and carry a G2 flag** — they belong to T2 voice
and T3b prose, and in T1/T3a/T4 they trigger either a rewrite («دلوقتي» → «حالياً») or a
`PROPOSED` demotion. **«مش»، «لسه» carry a weaker G2 flag** and are treated case-by-case rather
than banned; §6.2 of the stress test records where each landed.

### 3.3 Future localization — a principle, not a v1 deliverable

**v1 ships one Arabic product language** (§1.5). This section records only what the localization
architecture must leave *possible*, so that a later `ar-SA` or `ar-MA` variant is a locale
addition rather than a rewrite:

- Strings are addressed by **semantic key**, never by literal text, so a locale variant can
  override a key without touching callers.
- **G1 comprehension failures are locale-independent**: a word barred for ambiguity («شغّال» in
  the running sense) stays barred in every future locale, because the defect is meaning, not
  flavour.
- **G2 flavour judgements are locale-scoped**: they are exactly what a future variant would
  re-decide, so they must never be baked into a semantic key's name or into code.

**What is explicitly NOT required in v1:** authoring, reviewing or QA-ing a second Arabic
fixed-copy set. *(Product Direction, FIX-01 §2.2. An earlier draft made dual `AR-EG` /
`AR-NEUTRAL` profiles a v1 shipping requirement and used "has no neutral counterpart" as the
decisive argument against «الشغّال دلوقتي». Both are withdrawn — the term is rejected on the
grounds in §7.2 and in the rejection log, which stand on their own.)*

### 3.4 How far Egyptian may go in T2

**Admitted:** everyday verbs and connectors (بيقول، حاسس، مسجّل عندي، لسه، أول ما، عشان،
واقف مكانك), the existing conversational rhythm of the V10 fixtures.

**Barred, with reasons:**

- **Short-shelf-life slang** (جامد، تمام أوي، يا باشا) — dates the product within a year.
- **Diminutives and youth register** — the target personality is *adult*.
- **Region-locked idioms carrying meaning** rather than warmth — warmth may be local, meaning
  may not.
- **Any dialect word carrying an epistemic claim** (أكيد، مؤكد، طبعاً، أرجح) — these are the
  colloquial route into forbidden confidence language (§18). This is the sharpest bound: T2's
  freedom is a freedom of *warmth*, never of *certainty*.

**The T2 test:** would a Levantine reader understand this sentence unaltered? If no, and the
word is carrying meaning rather than warmth, rewrite it.

### 3.5 Two consistency defects found in the current Arabic

- **Person drift.** The prototype mixes first person («مسجّل عندي», «مش هرجّح») with third
  person («قنديل بيعرض اللي مسجّل عنده»). **Rule: QANDEEL speaks in the first person
  everywhere it speaks. The product name appears only where the system is being described to
  the user — onboarding, truth disclosure — never where it is speaking.**

- **Addressee gender was masculine-by-default.** All second-person Arabic in the prototype is
  masculine («مضايقاك»، «بتتعلم»). Product Direction has since issued a policy; it is applied
  in **§3.6**, and it is no longer an open decision.

### 3.6 Arabic addressee gender — applied policy

**Policy (issued by Product Direction, RESUME-01 §3, applied here):** fixed product copy is
**gender-neutral by default wherever natural Arabic permits**. Gendered wording in QANDEEL's
conversational voice is permitted **only** on a reliable, explicit, user-provided or
product-authorized preferred form of address. Gender is **never inferred** from name, avatar,
voice, or writing style, and **no mandatory onboarding gender question** may be introduced to
solve copy grammar. Absent a reliable preference, generated conversation prefers natural
neutral constructions rather than masculine-as-default. English is naturally non-gendered here
and needs no equivalent mechanism.

#### 3.6.1 The orthographic fact that makes this tractable

Arabic marks addressee gender in three places, and **they are not equally visible in
unvowelled text**:

| Site | Masculine | Feminine | Visible unvowelled? |
|---|---|---|---|
| Possessive/object suffix `-ك` | كلامَك | كلامِك | **No** — identical in script |
| MSA perfect verb | قلتَ | قلتِ | **No** — identical in script |
| MSA imperfect / imperative | تكتب / اكتب | تكتبين / اكتبي | **Yes** |
| Egyptian perfect verb | قلت | قلتي | **Yes** |
| Egyptian participle | مضايقاك | مضايقاكي | **Yes** |

**Consequence, and it is the important one:** MSA-leaning orthography is *already* largely
gender-neutral on the page, while Egyptian colloquial writes the feminine out. The gender
policy therefore pushes chrome toward exactly the register §3.1 already assigns it, and
concentrates the entire remaining problem in **T2, the conversational voice** — the one tier
where the policy also grants the most latitude. The two rules reinforce rather than fight.

#### 3.6.2 Technique — and the limit on it

> **Neutrality is a constraint, not the copy objective.** If a neutral rewrite becomes
> bureaucratic, constructed, or less understandable than the wording it replaced, the
> **interaction must be redesigned or the string remains open.** Arabic naturalness and action
> clarity come first. *(Product Direction, FIX-01 §5.)*

**The masdar is the first tool, not a rule.** Arabic UI convention already labels controls with
verbal nouns («حفظ»، «إلغاء»، «إرسال»، «بحث»), which carry **no addressee inflection at all** —
so where the masdar is *also* the natural word, neutrality costs nothing:

| Gendered imperative | Natural neutral form | Verdict |
|---|---|---|
| «صحّح» / «صحّحي» | **«تصحيح»** | ✅ conventional |
| «ابعت» / «ابعتي» | **«إرسال التصحيح»** | ✅ conventional |
| «جرّب تاني» / «جرّبي تاني» | **«إعادة المحاولة»** | ✅ conventional |
| «شوف دورها» / «شوفي دورها» | **«دورها في القراءات»** | ✅ noun phrase — no verb at all |
| «افتح» / «افتحي» | **«فتح»** | ✅ conventional |
| «اقفل» / «اقفلي» | **«إغلاق»** | ✅ conventional |
| «هاتها قدّام» | «تركيز العرض» | ❌ **constructed — `OPEN`** (§9) |
| «شيلها» / «شيليها» | «استبعاد مؤقت» | ❌ **evaluative overtone — `OPEN`** (§9) |

**The last two rows are the point of this table.** They are grammatically neutral and
product-language-wrong, and forcing them through would have bought a neutrality score at the cost
of copy quality. Where the masdar produces a constructed noun, the answer is to reopen the
wording alongside the interaction — not to ship the construction.

**Three supporting techniques:**

1. **Describe the object, not the person.** Most state copy already does: «لسه ناقصة»،
   «التصحيح وصل»، «مفيش قراءة اتكوّنت» — all neutral with no effort, because the subject is a
   thing.
2. **Prefer `-ك` possessives over verbs.** «كلامك»، «اختيارك»، «رسالتك»، «عندك» are all
   script-neutral. This keeps second-person intimacy without inflection — the key to *not*
   sounding stiff.
3. **Rewrite the agent out where a verb is unavoidable.** The foreground state sentence is the
   hard case, because **A9** requires it to say the reader did it. Gendered: «انت اللي رفعت
   الحاجة دي قدّام». Neutral, same meaning: **«الحاجة دي قدّام حالياً باختيارك. اللي اتغيّر هو
   العرض، مش حاجة عند قنديل.»** — «باختيارك» carries the reader-agency **A9** requires, with no
   inflected verb.

#### 3.6.3 Where neutrality is not achievable — the variant rule

**Fixed/reusable strings and generated turns are governed differently, and conflating them is
the mistake to avoid.**

- **Fixed strings (T1/T3/T4):** neutrality is achieved naturally in most strings here, and in
  **two cases it was not** — the foreground and removal actions, where the neutral candidate was
  constructed or evaluative. Those are now `OPEN` rather than forced (§9). Any future fixed
  string that cannot be written naturally without inflection must ship as an explicit
  **`AR-M` / `AR-F` variant pair**, declared as a localization requirement. **It may never be
  shipped as a single masculine form labelled "neutral".**
- **Generated turns (T2):** these are not a string table, so the policy is a **generation
  constraint**, not a lookup: absent a stored preferred form of address, prefer constructions
  that avoid addressee inflection — `-ك` possessives, nominal sentences, object-focused
  statements — and **do not** fall back to masculine. Where a preference exists, use it.

**Two honest limitations.** First, the prototype's most characteristic T2 lines lean on Egyptian
perfect verbs and participles addressed to the user («قلت»، «مضايقاك»)، which are the exact forms
Egyptian writes out; full neutrality in T2 is achievable but measurably narrows the voice's
warmth (§19.1). Second — and this corrects an earlier claim in this document — **neutrality did
carry a naturalness cost here.** An earlier draft asserted the package had proved otherwise. It
had not: two control labels were driven to constructed or evaluative forms, and they are now
`OPEN`.

---

## 4. English register system

Authored natively. No Arabic structure is carried across.

**Register:** plain contemporary English, second person, sentence case throughout. Contractions
are permitted in QANDEEL's voice and barred in chrome. No exclamation marks anywhere. No emoji
anywhere.

**Chrome:** verb-first, outcome-naming, ≤ 3 words where possible. The control says what will
happen, and **once an action label is approved, its resulting state preserves the same action
vocabulary wherever that is natural — unless doing so would create a false claim.** *(Stated as a
pattern rather than illustrated with a specific label: the removal action's wording is `OPEN`, so
it cannot serve as the canonical example — FIX-03 §11.)*

**Voice:** plain declaratives. Specifically barred:

- **Confidence adverbs** — *probably, likely, strongly, clearly, certainly*. Each is a
  confidence band in disguise (§18).
- **"I think" / "I believe"** — implies an opinion QANDEEL does not hold and a confidence it
  cannot express. Use "What I have is…", "I haven't…", "This isn't mine to decide."
- **Therapy register** — *I hear you, that sounds hard, I understand, your journey, safe
  space, sit with, unpack, check in.*
- **Startup register** — *let's dive in, explore, get started, powerful, seamless, curated,
  surface (as a verb), insights.*
- **AI-product register** — *analyze, process, intelligent, smart, context (as a noun), live,
  real-time, powered by.* **These are current voice/register preferences, not truth bans**
  (§17 D). "Live" and "real-time" are rejected for today's context panel; **their use in a future
  realtime surface is `PROVISIONAL / PHASE VII`** and depends on whether the architecture makes
  the wording accurate.

**Preserving parity without copying syntax.** English must carry the same intelligence,
humility, intimacy, semantic boundaries and trust posture — and reach them by English means.
Arabic gets its restraint from aspect and negation («لسه ما اتطبّقش», «مش هرجّح»); English gets
the same restraint from perfect tenses and plain refusal ("I haven't applied it", "I'm not
going to pick one"). Neither is a rendering of the other.

Worked parity check — the refusal, which is the product's most characteristic moment:

| | |
|---|---|
| AR | «دي مش وظيفتي هنا. بس فيه حاجة واحدة لو عرفتها هتفرق معايا: …» |
| EN | "That's not my part in this. There's one thing that would change what I can do, though: …" |
| ✗ literal EN | "This is not my job here. But there is one thing if I knew it would make a difference with me." |

Same refusal, same single follow-up question, same absence of apology. Different sentences.

---

## 5. Translation vs transcreation rules

**The semantic key is frozen. The surface string is authored per language.**

Equivalence between AR and EN is judged on five axes, and on nothing else:

1. **Same product claim** — the sentence asserts the same thing about the world.
2. **Same certainty level** — neither language hedges or firms up relative to the other.
3. **Same register tier** — a T1 string is T1 in both.
4. **Same action outcome** — the control does the same thing and says so.
5. **Same accessible-name completeness** — the full consequence reaches assistive technology
   in both.

Equivalence is **not** judged on word count, word order, part of speech, or literal
correspondence. A one-word Arabic label and a four-word English label are equivalent if the
five axes hold.

**Mandated divergences** (each is a decision, not an accident):

| Key | Arabic | English | Why they diverge |
|---|---|---|---|
| `context.panel` | «سياق الكلام» | *"In play now" — wording `OPEN`, §7.2* | «سياق» is ordinary Arabic; "context" is captured AI vocabulary in English. Mirroring would make English sound like an AI dashboard while Arabic sounds like a product. **The divergence is approved; the English string is not yet.** |
| `record.provenance` | «المصدر» | "Where this came from" | «مصدر» is unambiguous in Arabic at one word. English "Source" reads as citation/technical, so English spends words to buy the same plainness. |
| `readings.shared` | «المشترك بين القراءات» | "Shared across readings" | Arabic بين is count-safe from 2 upward; English "across" carries the same count-independence. Direct, no divergence needed — recorded to show the rule permits convergence. |
| `reading.count` | dual morphology («قراءتين») | "two readings" | Arabic encodes two in the noun; English cannot. English must **not** compensate with "both" (§10). |

**Direction rule (from A22's direction-independence clause):** where the grammar's meaning is
direction-dependent in one language, the two implementations must carry **equivalent product
meaning, never mirrored meaning.** No string may rely on يمين/شمال or left/right.

---

## 6. Naming decision framework

Applied to every concept in the matrix, in this order. The first three questions are attempts
to *avoid* a name.

1. **Can the user act without knowing this concept exists?** → If yes, `INTERNAL ONLY`.
2. **Is the concept fully carried by a sentence already on screen?** → If yes, no noun.
3. **Is it referenced only at the moment of acting?** → If yes, name the **action**, not the
   object.
4. **Is it referenced across surfaces, or must the user hold it in mind between screens?** →
   Only now does it earn a noun.
5. **If it earns a noun:** does it pass **G1 comprehension** (§3.2)? Does it survive 375px? Does
   it survive double-digit peers (§10)? Does it avoid every forbidden claim (§18)? And is it a
   word a person would actually use, or a construction that merely satisfies the constraints?

**Outcome of applying this framework.** The Terminology Matrix audits **59 concept rows** — one
row per concept, which is the single count both documents use. By visible-label need:
**41 `YES` · 6 `CONTEXTUAL` · 12 `NO`.** Eight of those carry the status `INTERNAL ONLY` —
legitimate internally, never user-facing at all. The product ends VI-01 with *fewer* names than
the prototype started with, which is the correct direction for a product whose personality is
restraint.

---

## 7. Core surface naming recommendations

### 7.1 Deep Analysis / «المشهد» — the highest-impact decision

**Concept:** the surface holding the readings, what each stands on, what is shared, and what is
missing.

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «القراءات» *(object plural doubles as route)* | «المشهد» *(retain)* | «التفصيل» |
| **English** | "Readings" | "Deep Analysis" *(retain)* | "The breakdown" |
| **Communicates** | you are going to see how this is being read | a composed scene you enter | there is more detail here |
| **Risks** | plural noun is awkward at exactly one reading (§10 handles this) | a metaphor the user must learn before receiving anything; already ambiguous in-product — «مساحات المشهد» names a *layout region* with the same word; makes the interface read as theatrical rather than direct | generic; reads like a settings sub-page; says nothing about what kind of detail |
| **UI length** | AR 8 / EN 8 | AR 6 / EN 13 | AR 7 / EN 13 |
| **Better unnamed?** | **partly — and that is the recommendation** | no | no |

**Why B fails on the Arabic side — five product reasons, none of them a Phase V prohibition:**

1. It is an **unnecessary metaphor** the user must learn before the surface gives them anything.
2. It is **already ambiguous in the prototype** — the same word names a surface *and* a layout
   region («مساحات المشهد»), in shipped markup.
3. The product **does not need a container noun**: the contents («القراءات») and the user's own
   subject already provide orientation.
4. It risks making the interface feel **theatrical and conceptual instead of direct**.
5. Removing the noun **increases restraint and shrinks product vocabulary**, which is the
   direction §6 pushes everywhere.

> **Correction (Product Direction, FIX-01 §3.1).** An earlier draft argued that «المشهد»
> "imports a spatial metaphor into the surface where **A15** forbids spatial meaning" and that
> naming a depth as a *place* violates **A19**. **Both were overstatements and are withdrawn.**
> A15 bars visual dimensions from encoding *confidence, rank, strength, certainty or importance*
> — it does not forbid spatial meaning as such, and canonical Phase V deliberately **preserves**
> a tightly-gated future contextual-relevance semantic in Live Context (**A22**). A19 preserves
> object identity across depths; it does not categorically forbid naming a surface. The five
> reasons above are sufficient and truthful, and they do not depend on either claim.

**Why "Deep Analysis" is rejected on the English side independently:** it is generic
AI-product vocabulary, and "Deep" is an unnecessary self-claim about the product's own depth.
It becomes `INTERNAL ONLY`. *(An earlier draft also argued that "Analysis" inherently implies a
conclusion. That is too broad — withdrawn.)*

> **`APPROVED` — Direction A, in its reduced form.** **The surface gets no product noun of its
> own.** «القراءات» / "Readings" is the *object* plural, serving as (a) the route control's label
> and (b) the surface region's accessible name. The surface's **visible heading is the user's own
> subject** («قرار الشغل الجديد»), not a product word. One name is deleted rather than replaced.
>
> Product Direction has approved rejecting «المشهد», leaving the container unnamed, and using
> «القراءات» / "Readings" for the contents, route and region. Matches the Matrix (S04, S06) and
> §20 Tier 2.

### 7.2 Live Context / «الشغّال دلوقتي»

**Concept:** the bounded, adjacent statement of which recorded things are in play with this
conversation right now, plus the activation and removal controls the runtime actually supports
(**A17**).

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «سياق الكلام» | «الشغّال دلوقتي» *(retain)* | «اللي معانا دلوقتي» |
| **English** | *"In play now" — **candidate**, wording `OPEN`* | "Live Context" *(retain)* | "Current context" |
| **Communicates** | the part of your words this conversation is drawing on | what is switched on right now | what is with us right now |
| **Risks** | «سياق» is adjacent to the internal term — mitigated: it is ordinary Arabic and *already user-facing* in the prototype («سياق انت فعّلته») | four independent failures (§`REJECTED_LANGUAGE`) | AR is a sentence, not a label, and Egypt-locked; EN "context" is captured AI vocabulary and "Live" claims real-time computation the runtime does not have |
| **UI length** | AR 11 / EN 11 | AR 16 / EN 12 | AR 17 / EN 15 |
| **Better unnamed?** | the panel needs an accessible name and a control label — but **not** a persistent visible title | | |

**The unification argument, which is decisive.** The product currently uses two words for one
idea: the panel is «الشغّال دلوقتي» and the thing inside it is «السياق» («سياق انت فعّلته»،
«فعّلت السياق»، «لغيت تفعيل السياق»). Direction A does not import a new word — it **removes a
redundant one** and lets the existing user-facing term name its own container.

**The English divergence, restated because it is the model case.** Arabic can use «سياق»
because «سياق الكلام» is a real Arabic collocation meaning *the context of what is being said*
— it is what a person would call this, not what an engineer would. English cannot use
"context": in 2026 it reads as the model's context window, which is both wrong and precisely
the AI-dashboard register §3 forbids. **The rejection of literal "Current context" is accepted
and final.**

> **CLAUDE RECOMMENDATION — Direction A, with the two languages at different confidence levels.**
>
> **Arabic «سياق الكلام»: APPROVED semantic direction** (Product Direction, FIX-01 §4).
> «الشغّال دلوقتي» stays rejected.
>
> **English: the exact wording is `OPEN — NARROW WORDING DECISION`.** "In play now" is competent
> English but carries a faintly idiomatic business/sports flavour, and it must be judged against
> the real visual interaction rather than on the page. Candidates carried forward: **"In play"**,
> **"In play now"**, or a better native-English phrase discovered in the final UI context.
> **The concept is not reopened**, and "Live Context" does not return as user-facing English
> unless later evidence defeats this direction.
>
> The panel keeps its existing honest explanatory sentence and gains no persistent visible title
> chip. «الشغّال دلوقتي» and "Live Context" remain `INTERNAL ONLY`.

### 7.3 Conversation / «الكلام» — retain

Passes every test: plain, warm, transparent across markets, already load-bearing («اكتب
لقنديل», «كمّل الكلام», «داخلة مع الكلام»), and it is what the thing actually is. English takes
**"Conversation"**, not "Chat" (too casual, too app-ish) and not "Thread" (engineering).

`RETAIN`.

### 7.4 Home — do not name

Home is **SIMULATED** per the freeze's truth boundaries. It is the place the app opens; a user
never needs to refer to it. No product noun. The root's accessible name is the product name.

`NO VISIBLE LABEL`.

### 7.5 Subject anchor — do not name

**A20** makes the anchor conditional on a runtime that may one day have it, and the object
itself is currently simulated. The user never needs the concept: they need the *subject*, which
is their own words («قرار الشغل الجديد»). It renders as a plain heading.

The term "subject anchor" / «مرساة الموضوع» is `INTERNAL ONLY`. This is framework question 2
working correctly — the sentence on screen already carries it.

Note the freeze's own open item 7: the app-bar subtitle duplicates the anchor and truncates at
375px («المشهد · قرار الش…»). With §7.1 applied the subtitle loses its product noun anyway;
**deletion is the recommendation**, consistent with the freeze's "probably deletion".

---

## 8. Understanding-object vocabulary

Full detail in `QANDEEL_VI01_TERMINOLOGY_MATRIX.md`. The reasoning behind the four decisions
that carry the most risk:

**Recorded material.** English "material" is engineering vocabulary and must not ship. The
honest description is *things you said that QANDEEL recorded*. Arabic already has this exactly
right — «مسجّل من كلامك» (collective) and «حاجة من كلامك» (countable) are in the prototype and
should be kept. English takes **"from what you said"** (collective) and **"something you said"**
(countable). "Notes" is rejected: it implies the user authored them deliberately, which is
false — extraction is deterministic and unrequested.

**Readings.** `RETAIN` in both. "A reading of the situation" is natural English carrying
exactly the needed meaning: an interpretation that could reasonably differ, with no claim of
truth. It is non-ordinal, count-neutral, and already the user's own word in Arabic.

**Roles — semantics `FROZEN`, exact Arabic `PROPOSED`.**

**Frozen:** role membership is **SUPPORTING** or **CONTRADICTING**, stated in words, **nominal
with no magnitude** (**A5**). **English is frozen: "supports" / "contradicts".** «بتشدّ ضد» /
"pulls against" stays rejected because the plainer term is clearer, flatter and less likely to
imply strength — sufficient reason on its own. *(An earlier draft argued a force metaphor
necessarily violates **A15**; that over-argues and is withdrawn.)* "Counts against" is avoided
because counting is the nearest thing to weighing.

**Arabic wording, after the FIX-02 register audit.** Role labels are **T3a** — repeated analysis
chrome — and the incumbent «بتسند» / «بتعارض» carries the colloquial `بـ-` present prefix, which
is a G2 flag in that tier. The leading neutral candidate is **«تسند» / «تعارض»**: it keeps the
precise «سند» sense (*this stands under that*) and is register-consistent. **«تدعم» was considered
and is not recommended** — in contemporary usage «دعم» leans toward funding, backing or
endorsement, which edges the label toward advocacy and away from the flat membership statement
**A5** requires.

> **`SEMANTICS FROZEN — EXACT ARABIC PROPOSED`.** «تسند» / «تعارض» is the leading candidate;
> «بتسند» / «بتعارض» is the incumbent. Neither is *clearly* superior on naturalness in a rendered
> product surface, and I will not manufacture confidence about which reads better to a native
> product ear. Resolve in the native-language pass.

**Disconfirming conditions.** The term never reaches users. The prototype's rendering is
excellent and should become the canonical pattern: a plain conditional sentence — «لو طلع إن…،
القراءة دي تبقى محتاجة مراجعة» / "If it turns out that…, this reading would need another look."
This is framework question 3: an abstract logical object rendered as a sentence, with no noun
introduced at all.

---

## 9. Action / control vocabulary

Full strings in `QANDEEL_VI01_COPY_PATTERNS.md`. Three decisions driven by truth rather than
by style:

**Removal from «سياق الكلام» must not sound destructive — because it is not.** Taking something
out of what is in play does not delete the record; the record is unchanged (**A10**), and the
effect is session-scoped. So «احذف» / "Delete" is barred outright, and even "Remove" is
discouraged: in most products "Remove" means gone.

> **`OPEN — MUST BE RESOLVED WITH THE FINAL INTERACTION IN VI-02/VI-03`**
> *(Product Direction, FIX-01 §7.)* **The semantics are approved and locked; the exact strings
> are not.** «استبعاد مؤقت» is **not frozen** — «استبعاد» can read as rejection or judgement,
> which is undesirable anywhere near **A15** semantics. English **"Take out"** is **not frozen**
> either — without surrounding context it is ambiguous.
>
> **Carried-forward requirement:** the final label must make the *temporary, current-context*
> scope clear without sounding destructive or evaluative. The accessible name completing the
> promise — *"…for now — this doesn't delete it"* — is the pattern to preserve whatever the
> visible label becomes.

**Correction must not sound like editing.** **A11** freezes correction to RECEIVED / PENDING;
material, readings, roles and unknowns are byte-identical before and after. «عدّل» / "Edit"
therefore describes something the product does not do and must be rejected. Entry is a
question — **«فيه حاجة غلط؟»** / "Something not right?" — matching the prototype's own
affordance with the Egypt-locked «مظبوط» repaired. Commit is **«ابعت التصحيح»** / "Send
correction".

**Foreground must not sound like importance or persistence.** **A9** fixes the meaning to *"I
am looking at this now"* — reader-initiated, reversible, non-semantic. This bars:

- «ابرزها» / "Highlight" — implies significance (**A15**).
- "Pin" / «ثبّتها» — implies persistence and stored state (**A10**).
- "Focus" — English "focus" carries priority.

> **`OPEN — MUST BE RESOLVED WITH THE FINAL INTERACTION IN VI-02/VI-03`**
> *(Product Direction, FIX-01 §6.)* **The semantic contract stays locked** — reader-driven,
> reversible, view-only, not importance, not rank, not persistence, not stored-state mutation.
> **The exact wording does not.**
>
> **«تركيز العرض» is rejected as final product copy** — it reads constructed and technical.
> **«إرجاع العرض» is not approved either.** No replacement synonym is invented here: forcing a
> third construction in VI-01 would repeat the mistake that produced the first two.
>
> English **"Bring to front" / "Put it back"** remain **candidates, not frozen strings**.
>
> **The interaction may carry part of this meaning.** Not every state needs a named product
> concept, and this is a strong candidate for one that does not — which is a VI-02/VI-03
> decision, made with the real interaction in hand.

The colloquial «خلّيها قدّامي» / «رجّعها زي ما كانت» remain available as **T2 voice** references
but are gendered imperatives and cannot serve as fixed chrome (§3.6.2).

The prototype's state sentence is semantically right and should survive, with its gendered verb
rewritten per §3.6.2: **«الحاجة دي قدّام حالياً باختيارك. اللي اتغيّر هو العرض، مش حاجة عند
قنديل.»** «باختيارك» carries the reader-agency **A9** requires with no inflected verb.

---

## 10. State / error vocabulary and peer scaling

### 10.1 The scaling rules (§10 of the brief — language only)

The phase's #1 open item is navigation; VI-01 owns only the terminology's ability to survive it.

1. **Identity is never ordinal.** Identity must not use an ordering scheme that can be mistaken
   for merit/hierarchy or become the reading's identity — **A2**. Letter/number series (أ/ب/ج,
   digits-as-names, "first/second reading") are rejected for the current architecture on that
   basis plus bilingual/accessibility scaling.
2. **Identity is never positional.** No "the one on the right", no يمين/شمال. Breaks under
   RTL/LTR parity and is meaningless to a screen-reader user.
3. **Never "the other".** «القراءة التانية» / "the other reading" is valid only at exactly two.
4. **Aggregate and region labels are count-independent.** «المشترك بين القراءات» holds at 2 and
   at 12. The prototype's `n===2` switch to «اللي في القراءتين» must be deleted.
5. **Per-item labels may vary with count — but only completely.** *(Refined during the critique
   gate; the earlier blanket ban was wrong for Arabic.)* Arabic has three grammatical numbers.
   A count-varying label is admissible **only** if singular, dual and plural are all authored
   and correct. Partial gating is the actual defect, not gating itself.
6. **Arabic duals are a standing trap.** Any string containing قراءتين / الاتنين / كلاهما is
   count-locked. Prefer eliminating the dual over gating it. English must not compensate with
   "both" or "either".
7. **Reference by content, then by the named set — never by a count.** This is **D2** already
   decided: naming which readings a record stands in beats telling the user how many and making
   them find which.
8. **Navigation position is not identity.** A screen-reader user needs to know where they are
   in a list; that is an accessibility requirement, not a product statement. Supply it through
   native `tablist` set-size/position semantics rather than authored copy, so no figure enters
   product language and **A14** ("counts are morphology, never figures") is untouched.

### 10.2 Reading identity — rejections, and a deferred possibility

**VI-01 owns the language constraints on reading identity. VI-02 owns the navigation solution.**
Nothing below prescribes a control architecture, an accessible-name formula, or a final identity
mechanism — doing so would pre-solve the phase's #1 open item from a copy task.

**What is frozen — six constraints:**

1. No identity **whose order can be mistaken for merit or rank**.
2. No **first / second / "the other"** as identity.
3. No **left / right positional** identity.
4. **No peer silently omitted, truncated away, or made unreachable** at any count.
5. **Navigation position is not semantic identity** — a screen-reader user's place in a list is an
   accessibility affordance, not a product statement about the reading.
6. **No runtime short-label contract is requested** (see below).

**Why «قراءة أ / ب / ج» is rejected under those constraints.** The runtime caps active hypotheses
at 32 per user with **no per-subject cap found**, so a subject's count is bounded but unknown at
design time and can plausibly reach double digits. An abjad series loses intuitive ordering long
before it runs out of letters, and — as a *user-facing identity* — its order is readily mistaken
for hierarchy. **The narrower claim is the accurate one: not that every sequence inherently means
rank, but that QANDEEL will not use a reading identity whose order can be read as hierarchy,
breaks bilingual or accessible navigation, or becomes the identity itself.** That preserves **A2**
without inventing a stronger canonical prohibition than the freeze contains.

**A short label per reading is not runtime-backed.** The canonical "backed by the runtime" list
covers readings as unranked peers — *"**more than two readings**, not exactly two — bounded by an
active-hypothesis cap of 32 per user with no per-subject cap found"* — plus role membership,
assumptions, disconfirming conditions and unknowns. It does **not** include a short label.

> **`OPEN — VI-02 OWNS THE NAVIGATION SOLUTION.`**
>
> **Rejections stand:** «قراءة أ / ب / ج», numeric IDs as user-facing identity, first/second/"the
> other", and left/right identity are all `REJECT` for the current architecture.
>
> **Carried forward as the first direction to test — a candidate, not a solution:** identifying a
> reading from **existing truthful reading content** (its opening statement, or other content
> already available). **VI-01 does not prescribe** that the opening statement is the final
> accessible name, that truncating it is the final visible identity, or any final control
> architecture. Those are VI-02's to determine against the real navigation problem.
>
> **A runtime-supplied short label is `DEFERRED POSSIBILITY — NOT REQUESTED`**
> *(Product Direction, FIX-01 §8.)* **VI-01 creates no backend dependency and asks for none.**
> VI-02 must first attempt large/double-digit peer navigation with currently available truthful
> data; only if that shows a short label is *materially necessary* may a later task propose a
> contract.

### 10.3 State language

Lifecycle states are stated in words, never inferred (**A7**), and never gain an agent that
runtime truth does not support.

| State | Arabic | English | Guard |
|---|---|---|---|
| Unknown · OPEN | «لسه ناقصة» | "Still open" | — |
| Unknown · RESOLVED | «بقت معروفة» | "This is known now" | **Agentless.** Answer-driven gap closure is forbidden — the prototype's «مفيش إجابة منك هي اللي غيّرت الحالة دي» must accompany. |
| Unknown · SUPERSEDED | «ما بقتش مطروحة» | "This no longer applies" | Must not read as resolved. |
| Correction · RECEIVED | «وصلني» | "I have this" | Never "applied". |
| Correction · PENDING | «لسه ما اتطبّقش» | "I haven't applied it" | Nothing downstream changed (**A11**). |
| No reading | «لسه مفيش قراءة اتكوّنت للموضوع ده.» | "No reading has formed for this yet." | **Stop there — no second sentence.** |
| One reading | «قراءة واحدة» | "One reading" | **No «لحد الآن» / "so far".** |
| Empty context | «مفيش حاجة داخلة مع الكلام.» | "Nothing is in play." | — |
| Failure | «تعذّر تحميل القراءات» | "The readings didn't load" | Process-framed, not «لم نتمكن» / "We couldn't". |
| Retry | «إعادة المحاولة» | "Try again" | — |

**Correction to the thin-data copy (Product Direction, FIX-01 §10).** An earlier draft appended
*"«لما حاجة تتكوّن هتلاقيها هنا.» / When one does, it'll be here."* to the no-reading state.
**That promises a future formation, which this document's own guardrail forbids** — a
self-inconsistency, and it is removed. The one-reading state likewise drops «لحد الآن» / "so far":
the temporal hedge was doing no work the state did not already do. **Restraint wins.** Re-add a
temporal qualifier only if a later product state genuinely needs to communicate openness.

---

## 11. Correction language

**A11** is the tightest constraint in the product: correction is RECEIVED or PENDING and
nothing else, and nothing on the correction path animates.

**Required:** the acknowledgement states receipt, states non-application, and states that the
recorded thing is unchanged. The prototype's line is already correct and should be preserved
semantically — «وصلني وكلامك ده موجود عندي هنا. بس أنا ما طبّقتوش على الحاجة المسجّلة».

**Barred, with reason:**

- «اتصحّح» / "Corrected", "Updated", "Applied" — claims downstream effect that does not exist.
- «هنراجع» / "We'll review this" — invents a process and a promise.
- «شكراً على التصحيح» / "Thanks for the correction" — **omitted as a tone/restraint choice, not a
  truth ban** *(scoped by FIX-03 §9)*. Thanking someone for a real act of sending a correction
  does not by itself claim the correction was applied. The recommendation stands — lead with
  receipt and non-application, and skip the thank-you — but **if gratitude is ever used it must
  refer only to the real act of sending**, must not replace the RECEIVED/PENDING language, and
  must not imply application, review or any downstream effect.
- Any animation-carried acknowledgement — **A11** and **D5**: motion may make a state legible,
  never *be* the state.

---

## 12. Provenance language

**A8** requires provenance to be discoverable at the record, one press away, stating that the
date is a **record date** and the text is **not a transcription**.

The word "provenance" / «مصدرية» never reaches users. The control is **«المصدر»** / **"Where
this came from"** — a documented length divergence (§5), because «مصدر» is unambiguous in one
Arabic word while English "Source" reads as citation.

The prototype's disclosure sentence is correct and should be preserved semantically:

> «التاريخ ده تاريخ تسجيل قنديل للحاجة دي، مش تاريخ حصولها. والكلام ده مأخوذ من كلامك انت، ومش
> نقل حرفي للي اتقال.»

> "This date is when I recorded it, not when it happened. And this is taken from your own
> words — it isn't a word-for-word record of what you said."

**Defect found and fixed during the critique gate.** The prototype renders recorded material
inside guillemets — «الحاجة المسجّلة: «…»» — while the provenance line states it is not a
transcription. Quotation marks are a verbatim claim, and when typography and copy disagree,
typography wins. **Recorded material must render as plain text, with no quotation marks in
either language.** This is a copy-and-typography rule that belongs in VI-01 because it is a
truth claim, not a styling choice.

---

## 13. Unknown / gap language

**A7:** an unknown is named, explicit, and occupies space while open.

**The semantic pattern is `FROZEN`:** state the gap as a **plain declarative naming the specific
thing that is not known**, with **no agent, no rank, no utility claim and no refusal**.
**English is frozen: "Not known: …"** — e.g. "Not known: what the new offer actually involves in
terms of learning."

**Arabic wording, after the FIX-02 register audit: `PROPOSED`.** The construction has two halves
in two tiers — a repeated **T3a** lead-in and a **T3b** body restating the user's own words —
and the seam between them is the whole question. «مش معروف …» keeps one register across both and
is warm; «غير معروف: …» is the cleaner neutral lead-in and is natural rather than stiff, but sets
up a neutral label followed by colloquial prose.

> **`PATTERN FROZEN — EXACT ARABIC PROPOSED`.** Both candidates are defensible, and which reads
> better depends on how the seam looks on the rendered surface — which is a native-product-ear
> judgement I cannot make from the page. English is frozen either way.

Three guards:

- **No refusal state.** The freeze bars "a refusal state for an unknown". An unknown is missing,
  never withheld — nothing may read as *QANDEEL won't say*.
- **No utility claim.** The freeze bars "question utility". Never «السؤال ده مهم» / "This is the
  important question".
- **No answer-driven closure.** A user's answer never closes a gap. Where a state changes, the
  disclaimer travels with it.

**What is frozen about QANDEEL's questions** *(scoped by Product Direction, FIX-02 §3.4)*: a
question must have a **concrete information purpose**, and must never be performative curiosity,
engagement bait, disguised judgement, or a utility/rank claim. Where a question exists to resolve
an information gap or materially improve what QANDEEL can understand or do, that purpose should
be evident when it helps. The prototype's «فيه حاجة واحدة لو عرفتها هتفرق معايا» is an excellent
instance of the shape — **not the only permitted shape.** *(An earlier draft claimed it was;
VI-01 does not own the Question Runtime and may not redefine it.)* The runtime truth stands
unchanged: **an answer does not itself cause durable gap closure.**

---

## 14. Voice / live-call vocabulary principles

> **`PRINCIPLES = KEEP. EXACT STRINGS = PROVISIONAL / PHASE VII.`**
> *(Product Direction, FIX-01 §12.)* **No V01–V07 string in this package is a freeze candidate.**
> Exact voice, mic and call state wording depends on the realtime architecture and its actual
> failure modes, which do not exist yet. Two concrete reasons the strings cannot be settled now:
> **"Recording" may simply be false** if realtime audio is not persistently recorded; and
> **"Listening" is not automatically a comprehension claim** — it may be a legitimate mechanical
> microphone/VAD state if the final voice architecture defines it as one.

**No voice runtime is invented here.** Realtime provider qualification is Phase VII. What follows
are vocabulary *constraints*, so that whatever ships later cannot overclaim.

1. **Do not claim understanding that the architecture does not deliver.** If the state is
   mechanical, name the mechanism; if it is comprehension, do not imply it without support.
   Whether «بسمعك» / "Listening" is admissible depends on what the final architecture makes it
   mean — Phase VII decides, not VI-01.
2. **Never anthropomorphize latency.** «قنديل بيفكّر» / "Thinking…" is a forbidden intelligence
   implication and an AI-product cliché. State the process: «بجهّز الرد» / "Working on it".
3. **"Live" is rejected for the user-facing context panel** — it is technical AI-product
   vocabulary, ambiguous against realtime behaviour, and unnecessary once the product concept is
   clearer. **It is not inherently false in every usage** *(FIX-02 §4.2)*: whether "live" is
   accurate for a realtime call depends on the Phase VII architecture, and that decision is not
   VI-01's. It is a current-vocabulary rejection, not a truth ban.
4. **Process-frame every failure.** «الاتصال انقطع. جاري إعادة الاتصال.» / "The call dropped.
   Reconnecting." Never "I lost you" — it anthropomorphizes and assigns fault. A dropped call is
   a system event, so it is impersonal T4; QANDEEL's first person is for what QANDEEL does, not
   for what the network did.
5. **Fallback always names the alternative.** «المكالمة وقفت. الكتابة متاحة.» / "The call isn't
   working. You can keep going in writing." *(«تقدر تكمّل» would be a gendered verb — §3.6.2.)*
6. **Voice input inherits every §18 guard.** Nothing spoken is verbatim-quotable; a voice note
   is recorded material with the same provenance sentence as typed material.
7. **Interruption is neutral.** Never «قاطعتني» / "You interrupted me".

Terms: current safe generic vocabulary includes «تسجيل صوتي» / "voice note" and «مكالمة» /
"call". Whether «مكالمة مباشرة» / "live call" is accurate or desirable is **PROVISIONAL / PHASE
VII** and depends on the actual realtime architecture.

---

## 15. Tone-of-voice rules

*(Rules 3, 4 and 5 were rewritten by Product Direction FIX-02 §3.2–3.4 — the earlier absolutes
would have made QANDEEL cold to avoid sounding like a therapy app, and would have banned
legitimate future behaviour from inside a copy task.)*

1. State what you have, then stop. **On Deep Analysis, do not force a winner** — that surface
   reports alternatives and named unknowns (§2).
2. Never claim more understanding than has been recorded.
3. **Do not pad routine failures with performative apology** — process-frame them instead. **But
   apology is not banned:** where QANDEEL actually caused user-impacting harm, gave incorrect
   information, or failed a request in a way accountability attaches to, **a brief, direct apology
   is appropriate.**
4. **Avoid reflexive praise, generic validation and gamified encouragement.** Acknowledge genuine
   effort, progress or a milestone **only when it is grounded in a real user or product event and
   it serves the conversation** — never as decoration.
5. **A question must have a concrete information purpose**, and must never be performative
   curiosity, engagement bait, disguised judgement, or a utility/rank claim. Make the purpose
   evident where that helps.
6. Where QANDEEL is not the decider, say so plainly, once, without softening —
   «القرار مش عنده». *(This is the Deep Analysis posture, not a global ban on QANDEEL ever
   advising — advice is governed by the contract for that capability.)*
7. No metaphor unless it is the shortest true statement available.
8. Sentence case. No exclamation marks. No emoji. No decorative motivation.
9. Length discipline: chrome ≤ 3 words where possible; helper text ≤ 2 sentences; QANDEEL's
   turns may run longer but may not pad.
10. First person in voice; the product name only where the system is described (§3.5).
11. Second person singular, **gender-neutral by default** (§3.6). Prefer `-ك` possessives and
    object-focused statements over inflected verbs; never fall back to masculine.
12. No sentence mixes register tiers (§3.1). A **T3a** label may sit beside **T3b** prose — that
    is the surface working as designed, not a mix.

---

## 16. Accessibility-language rules

1. **Every control has an accessible name stating the outcome**, not the icon.
2. **Label in Name (WCAG 2.5.3):** the accessible name must contain **the exact visible label
   text, in the same order**, and may then add clarification. Written as a pattern —
   `⟨visible label⟩ + clarifier` — so it holds for any label VI-02/VI-03 chooses:
   `⟨label⟩ → "⟨label⟩ for now — this doesn't delete it"` ✓.
   **Arabic worked example:** «المصدر» → **«المصدر — للحاجة دي»** ✓ *(the label appears intact
   before the clarifier)*.
   **✗ «المصدر» → «مصدر الحاجة دي»** — this **fails**, because the definite «المصدر» is not
   present as a contiguous string; «مصدر» alone is a different token. *(This exact failure was
   shipped in an earlier draft of this document and is corrected here — FIX-03 §6. Arabic makes
   the trap easy to miss: prefixing «ال» or entering an iḍāfa construction silently breaks the
   substring the rule requires.)*
   **Arabic-specific rule that follows:** an Arabic accessible name must repeat the label in its
   **exact surface form** — definite article included — and add the clarifier **after** it, rather
   than absorbing the label into a construct phrase.
3. **Accessible names sit in the same register tier as their visible label.** A T1 label with a
   T2 accessible name is a voice break that only screen-reader users hear.
4. **Announcements are full sentences, polite, and arrive after the state** — never before
   (**B4**, **D5**). Correctness may not depend on an animation frame.
5. **No meaning may be carried by position or proximity alone (A23).** Every spatial statement
   needs a sentence carrying the same meaning, intact under reduced motion. This binds the
   reserved contextual-relevance capability in advance: if it ships, its non-spatial equivalent
   is a *language* deliverable.
6. **Never use «فوق / تحت / قدّام» or "above / below" as the only locator** — they break under
   RTL/LTR and are meaningless to a screen-reader user. Name the thing.
7. **Inline foreign terms carry `lang` and `dir`.** An English term inside Arabic copy needs
   `lang="en" dir="ltr"` on an inline span or the screen reader mispronounces it and bidi
   scrambles it.
8. **`lang="ar"` matters as much as `dir="rtl"`** — it drives Arabic font fallback and
   screen-reader voice selection.
9. **One numeral system per user, everywhere — including accessible names.** The numeral policy
   itself is **C11**, a Phase VI decision not made here; the language rule is only that whatever
   is chosen also governs accessible names, error copy and inline examples.
10. **Arabic labels need more vertical room than Latin ones at the same size**, which is part of
    why §3 caps chrome at three words. **No numeric typography value is frozen by VI-01** — VI-01
    does not decide typography, and no line-height has been established against the final
    typeface. *(An earlier draft froze `line-height ≥ 1.6`; removed — FIX-03 §7.)*
    **Carried forward to VI-03 Typography and VI-10 RTL/LTR + Accessibility Validation:** final
    Arabic typography must preserve legibility, avoid Latin-style tracking that breaks Arabic
    joining, and be tested with long Arabic and with user accessibility settings. Treat
    "no letter-spacing on Arabic" as an **implementation guard to validate against the chosen
    font**, not as a semantic language contract.

---

## 17. Terms that must not reach users — four authorities, not one list

Full log in `QANDEEL_VI01_REJECTED_LANGUAGE.md`. **A rejection is only as strong as its reason,
and these four reasons are not interchangeable.** A copy task may hard-ban what is **false**; it
may not quietly shrink QANDEEL's future product scope by declaring ordinary words permanently
unspeakable, and it must not call an internal term or a labelling scheme "a falsehood" when it is
neither.

| Authority | What it means | Can it be revisited? |
|---|---|---|
| **A · `SEMANTIC / TRUTH HARD BAN`** | The statement is false or unsupported under the current contract | Only via a runtime contract that makes it true |
| **B · `INTERNAL ONLY`** | True, but an implementation or reviewer concept users should not need | If it ever becomes a genuine user concept |
| **C · `PRODUCT / STRUCTURAL REJECTION`** | Conflicts with the chosen experience, creates ambiguity, scales badly, or risks implying rank — **not** a false runtime statement | By a later architecture decision |
| **D · `CURRENT-VOCABULARY PREFERENCE`** | Mis-sets the register for today's surfaces and voice | By a later voice or capability decision |

*(Structure corrected by FIX-01 §13 and FIX-03 §4. An earlier version ran two classes and filed
engineering vocabulary, reviewer chrome and peer-labelling schemes under the truth ban — which
contradicted that class's own definition.)*

### A · `SEMANTIC / TRUTH HARD BAN`

**The statement would be false or unsupported under the current contract.** Full table in §18:
confidence percentages and bands; rank / winner / primary; unsupported evidence strength; false
verbatim provenance; applied correction; answer-caused gap closure; unsupported runtime-derived
contextual relevance; unsupported count or ceiling claims.

**Plus claims about what the system knows or did** — «فهم عميق», "understands you", "Thinking…",
"knows you". Each tells the user something untrue about the system's comprehension or its internal
state.

### B · `INTERNAL ONLY`

**These terms may be perfectly true. They are implementation or reviewer concepts users should not
need** — so they are barred as *product copy*, and **they are not "false"**
*(corrected by FIX-03 §4: an earlier version filed them under the truth hard ban, contradicting
that class's own definition).*

**Engineering vocabulary** — runtime / «الرَنتايم», `MAX_ACTIVE_HYPOTHESES`, hypothesis, HIM,
orchestrator, peer, peer reading, material selection, recency window, **provenance**, disconfirming
condition, subject anchor, context field, fixture, stress state, simulated, snapshot, token,
embedding, prompt, model, LLM, evidence layer, structural grammar, non-equivalence law, and every
freeze identifier.

**Reviewer-facing Arabic already present in shipped markup** — «مُحاكى لاختبار التجربة», «مدعوم
من الرَنتايم», «دفتر الصدق», «ممنوع الاستنتاج», «مُلخّص للمراجعة», «مسودة اختبار للثبات». The
highest-risk leak in the codebase: well-written Arabic sitting beside product copy. **A reviewer
label that survives into production does become a truth violation** — it asserts a simulated
capability is real — but the terms themselves are internal, not false.

### C · `PRODUCT / STRUCTURAL REJECTION`

**The wording or scheme conflicts with the chosen QANDEEL experience, creates ambiguity, scales
badly, or risks implying rank — but is not itself a false runtime statement.**

**User-facing reading identifiers** — «قراءة أ / ب / ج», numbered reading identities,
first / second, "the other", left/right identity. Rejected **for the current architecture**.

> **The accurate claim, and it is narrower than an earlier draft's** *(FIX-03 §4)*: **not** that
> every sequence inherently equals merit or rank, but that **QANDEEL will not use a user-facing
> reading identity whose sequence or order can be mistaken for hierarchy, breaks bilingual or
> accessible navigation, or becomes the identity itself.** That preserves **A2** without inventing
> a stronger canonical prohibition than the freeze contains.

**Also here:** «الشغّال دلوقتي» (ambiguity against «شغل», sentence-as-label, redundant with
«سياق»), «المشهد» (unnecessary metaphor, in-product ambiguity), and the count-locked
«اللي في القراءتين».

### D · `CURRENT-VOCABULARY PREFERENCE` (not bans)

**These words are not inherently false, and some may become correct later.** They are avoided
*now* because they mis-set the register or overreach for the surfaces VI-01 covers — not because
a future QANDEEL capability may never use them.

| Term | Why avoided now | What would change it |
|---|---|---|
| **"AI-powered" / «مدعوم بالذكاء الاصطناعي»** | Generic, self-congratulatory AI-product register | A marketing surface where it is the useful thing to say. **It is not a false claim — QANDEEL is an AI product** *(FIX-02 §4.1)* |
| **«ذكاء», "intelligent", "smart", "insights", «تحليل عميق»** | Self-congratulatory; the product's personality is not to assert its own intelligence | A different voice decision. **Not truth violations** |
| **"Live"** *(user-facing **context panel** only)* | Technical AI-product vocabulary, ambiguous against realtime behaviour, unnecessary once the concept is clear | **Call/realtime naming is `PROVISIONAL / PHASE VII`** — "live", "real-time", "call" may be used later if the architecture makes the wording accurate and the voice chooses it. **"Live call" is not currently a false statement by definition** *(FIX-02 §4.2, FIX-03 §10)* |
| "Summary" / «ملخّص» | On the current Deep Analysis surface it can read as a **settled synthesis**, and it is generic | A surface whose contract is to summarise. **A summary can summarise alternatives without forcing a winner** — this is a style choice, not a semantic impossibility *(FIX-02 §5)* |
| "Overview" | Implies completeness the bounded selection does not have | A view that really is complete |
| "Analysis" / «تحليل» | Generic AI-product vocabulary in the current framing | A capability where it is the accurate word |
| "Source" *(EN only)* | English "Source" reads as citation; Arabic «مصدر» is **approved** and in use (§12) | An English surface where citation is the meaning |
| "I understand" | Claims comprehension QANDEEL cannot evidence on today's surfaces | Treat as hard-banned in practice today; the word itself is not permanently impossible |
| "recommend" / "advice" / «ننصح» | Out of scope for Deep Analysis, which reports alternatives | **A future advisory capability with its own product/runtime contract** (§2) |
| "Dashboard", "Workspace", "Get started", "Explore", "Seamless" | Generic SaaS register | A different product voice, deliberately chosen |
| Therapy register — «رحلتك», «مساحتك الآمنة», «تأمّل», "your journey", "safe space", "check in", "reflect", "sit with" | Barred by the brief's personality constraints | A personality decision, not a truth one |

**The distinction that matters:** only **A** may never be written. **B** waits for the concept to
become a user concept; **C** waits for an architecture decision; **D** waits for a voice or
capability decision. A later task may revisit B, C or D without reopening VI-01.

---

## 18. Runtime / truth language guardrails

Derived directly from the freeze's "Forbidden to infer" list and §9 of the brief. **Every entry
is a banned copy pattern, not a banned idea.**

| Banned pattern | AR example | EN example | Why |
|---|---|---|---|
| Numeric confidence | «نسبة ثقة ٧٠٪» | "70% confident" | The quantity does not exist to render |
| Confidence bands | «ثقة عالية» | "High confidence" | Same |
| Ranking | «القراءة الأرجح» | "The most likely reading" | **A2** — peers are equal |
| Primary peer | «القراءة الأساسية» | "Primary reading" | **A2** |
| Evidence strength | «دليل أقوى» | "Stronger evidence" | **A15** |
| Relation strength | «قوة العلاقة» | "Strong link" | **A15** |
| Count as strength | «٣ حاجات بتسند» | "3 supporting" | **A14** — count read as score |
| Verbatim memory | «قلت بالحرف» | "You said, quote:" | Not a transcription. **Includes quotation marks as typography** (§12) |
| Memory-to-turn provenance | «قلت ده في رسالة كذا» | "You said this in message 4" | Not supported |
| Record date as event date | «يوم ١٢ حصل» | "On the 12th, this happened" | **A8** |
| Correction applied | «التصحيح اتطبّق» | "Correction applied" | **A11** |
| Answer-driven closure | «إجابتك قفلت الحاجة الناقصة» | "Your answer closed this gap" | Forbidden |
| Guaranteed two readings | «القراءتين» as a fixed frame | "Both readings" | The count is **not fixed at two** and can plausibly reach double digits for one subject |
| Guaranteed distinct readings | «قراءتين مختلفتين» | "Two different readings" | Not guaranteed |
| **Limitless readings** | «قراءات من غير حد» | "as many readings as it needs" | **The runtime is bounded, not unlimited** — `MAX_ACTIVE_HYPOTHESES = 32` per user. Copy may not promise a limitlessness the runtime does not have |
| **A stated per-subject ceiling** | «لحد ٣٢ قراءة» | "up to 32 readings" | The 32 cap is **per user, not per subject**, and no per-subject cap was found. Stating any ceiling for a subject asserts a fact the runtime does not supply — and a stated maximum invites the count to read as a score (**A14**) |
| Computed relevance | «الأقرب لموضوعك» | "Most relevant to this" | **NOT SUPPORTED** in production |
| Reading verdicts | «مدعومة / ضعيفة / مرفوضة» | "Supported / Weak / Rejected" | Forbidden states |
| Unknown refusal | «مش هقول» | "I won't say" | An unknown is missing, not withheld |

**Contextual relevance — the standing gate, scoped to the capability A22 actually gates.**
`RESERVED FUTURE CAPABILITY / SIMULATED ONLY UNTIL RUNTIME SUPPORT EXISTS` (**A22**). What A22
gates is **runtime-derived contextual-relevance spatialization or representation inside Live
Context** — not the English word "relevant". Until that contract exists:

- **Product copy must not claim that current memory or context items were selected, ordered,
  positioned or surfaced by computed contextual relevance.** That is the falsehood, and it is a
  **Authority A** hard ban (§17).
- **Design simulations may not present relevance as production truth**, and must be labelled
  `SIMULATED FOR EXPERIENCE/DESIGN TESTING`.
- **Any future A22 relevance representation requires the accessible non-spatial equivalent**
  (**A23**) — a language deliverable, not only a visual one.
- When it ships, its vocabulary may not overlap with foreground vocabulary (§9), or a
  reader-driven view state and a system-driven relevance state become indistinguishable in words
  — exactly the aliasing **A15** forbids.

*(Scoped by FIX-03 §5. An earlier draft banned "relevance vocabulary at all" in every context,
which would have forbidden an ordinary English word across unrelated future QANDEEL capabilities.
The **A15 non-equivalence law stays intact**: relevance ≠ importance ≠ truth ≠ confidence ≠
evidence strength ≠ priority ≠ rank ≠ certainty ≠ correctness.)*

---

## 19. Open decisions requiring Product/Creative Direction approval

### 19.1 Arabic addressee gender — RESOLVED, with one residual decision

**The policy is issued and applied** (§3.6). It is no longer a blocker: no fixed Arabic string in
this package is masculine-as-default. Most reached neutrality naturally; **two control labels did
not, and are now `OPEN` rather than forced** (§9) — neutrality is a constraint, not the copy
objective.

**What remains open is narrower and is a voice decision, not a grammar one.** Neutrality in T2
is achievable, but the Egyptian perfect verb and participle — «قلت»، «مضايقاك» — are precisely
the forms the dialect writes out, and they are load-bearing in the prototype's warmest lines.
Writing around them measurably flattens the voice. Two paths:

- **(a) Neutral-always in T2.** Simplest and safest; costs some warmth in QANDEEL's most
  characteristic sentences.
- **(b) Neutral by default, gendered on an explicit stored preference.** Permitted by the
  policy, preserves the full voice for users who have supplied a preferred form of address, and
  requires a settings affordance that is *offered*, never *required* — the policy bars a
  mandatory onboarding question.

**CLAUDE RECOMMENDATION: (b)** — it is the only option that satisfies the policy without
permanently costing the voice, and the affordance is cheap because §3.6.3 already governs
generated turns as a constraint rather than a string table. `PROPOSED — REQUIRES
PRODUCT/CREATIVE DIRECTION APPROVAL`.

### 19.2 Remaining open decisions

| # | Decision | Resolve in | Why it is open |
|---|---|---|---|
| 2 | **Exact English wording for Live Context** — "In play" / "In play now" / a better native phrase | VI-02/VI-03 | Concept approved; the wording carries a faint business/sports flavour and must be judged in the real interaction (§7.2). |
| 3 | **Foreground/focus action wording**, AR and EN | VI-02/VI-03 | Semantics locked; «تركيز العرض» rejected as constructed, «إرجاع العرض» not approved, and the interaction may carry part of the meaning (§9). |
| 4 | **Remove-from-current-context wording**, AR and EN | VI-02/VI-03 | Semantics locked; «استبعاد» reads evaluative, "Take out" reads ambiguous without context (§9). |
| 5 | **Reading short-identity strategy** | Next task, using existing data | A runtime label is `DEFERRED POSSIBILITY — NOT REQUESTED` (§10.2). |
| 6 | **Exact voice / realtime state strings** | Phase VII | Depends on an architecture that does not exist (§14). |
| 7 | Whether a **destructive delete** exists in the product at all | Product | Nothing in the freeze defines one. If it does, it needs a clearly distinct verb («حذف نهائي» / "Delete permanently") so it can never be confused with the non-destructive removal. |
| 8 | Product name presentation in English — **"Qandeel" vs "QANDEEL"** | Brand | Affects every English string and the `lang`/`dir` treatment of the name inside Arabic copy. |
| 9 | Numeral policy (**C11**) | Phase VI | §16.9 only binds accessible names to whatever is chosen. |

*(The former item 2 — `AR-EG` vs `AR-NEUTRAL` as launch default — is withdrawn. v1 ships one
Arabic product language, so there is no profile choice to make; §3.3.)*

---

## 20. Recommendation for what should be frozen after review

> ### The freeze does not create an immutable string table
>
> *(Product Direction, FIX-02 §7 — stated explicitly so no future team misreads VI-01.)*
>
> **What freezes is the language *system* and its semantic contracts. Individual sentences and
> labels stay editable** in VI-02, VI-03 and hi-fi, provided all four hold:
>
> 1. the **semantic contract** stays intact;
> 2. **runtime truth** stays intact;
> 3. **accessibility** stays intact — including Label-in-Name and the accessible-name promise;
> 4. **bilingual meaning stays equivalent** on the five axes in §5.
>
> **This is intentional flexibility, not an unfinished foundation.** A language system that
> survives only if nobody rewords anything is not a system — it is a string dump. The rules below
> are what must not drift; the wording is what teams are expected to improve.

The package separates three tiers.

### TIER 1 — FROZEN: LANGUAGE SYSTEM AND SEMANTIC CONTRACTS

These constrain every later string, and every day they stay open is a day of strings authored
against nothing.

1. **Bilingual native authorship / transcreation** (§4, §5).
2. **Arabic register architecture for v1** — one Arabic, four tiers, two gates (§3.1, §3.2), plus
   the future-localization principle (§3.3).
3. **Truth guardrails** (§18) — the language-side mirror of the canonical Runtime / Truth
   Boundaries; should carry the same authority.
4. **Naming-minimization framework** (§6) — so future concepts default to *unnamed*.
5. **Gender policy** (§3.6), including the constraint-not-objective rule and the variant rule.
6. **Peer-scaling language rules** (§10.1).
7. **Provenance and correction semantic rules** (§11, §12).
8. **Semantic rejections — Authority A only** (§17, §18). Authorities B, C and D are revisitable by a later task.
9. **Accessibility-language rules** (§16).

### TIER 2 — APPROVED CORE VOCABULARY

Only terms that survived the FIX-02 register-consistency pass with confidence. **The common
property: each is a short MSA-lexeme nominal that carries no dialect inflection**, so it is
register-safe in fixed copy and needs no naturalness caveat.

| Concept | Arabic | English |
|---|---|---|
| Conversation *(referential vocabulary, not necessarily a visible title)* | «الكلام» | Conversation |
| A reading | «قراءة» | reading |
| The readings | «القراءات» | Readings |
| Live Context *(Arabic semantic/product direction)* | **«سياق الكلام»** | *(wording `OPEN` — §19.2)* |
| Shared region | «المشترك بين القراءات» | Shared across readings |
| Provenance action | «المصدر» | Where this came from |
| Record date | «تاريخ التسجيل» | recorded on |
| Correction *(noun)* | «التصحيح» | correction |
| Correction actions | «تصحيح» · «إرسال التصحيح» | Correct this · Send correction |
| Close / retry | «إغلاق» · «إعادة المحاولة» | Close · Try again |
| Role in readings *(link)* | «دورها في القراءات» | Its role in each reading |

### TIER 3 — PROPOSED / EDITABLE MICROCOPY

**Semantics frozen; exact wording still open.** These are not defects — they are strings whose
Arabic naturalness I cannot certify from the page, or whose wording depends on an interaction
that does not exist yet. Freezing the pattern and deferring the sentence is the honest outcome.

| Item | Frozen | Open |
|---|---|---|
| **Role terms** (§8) | SUPPORTING / CONTRADICTING, nominal, no magnitude; EN "supports"/"contradicts" | Arabic: «تسند»/«تعارض» *(leading)* vs «بتسند»/«بتعارض» *(incumbent)* |
| **Unknown pattern** (§13) | Declarative naming of the specific gap; no agent, rank, utility or refusal; EN "Not known: …" | Arabic lead-in: «مش معروف …» vs «غير معروف: …» |
| **Recorded material** (§8) | From the user's own words; provenance inside the name; never quoted | Arabic: «اللي مسجّل من كلامك» vs «المسجّل من كلامك» |
| **State lines** (§10.3) | Each state's semantic guard, incl. the agentless RESOLVED disclaimer | Exact Arabic for open/resolved/superseded, correction received/pending, thin-data lines |
| **Helper / boundary copy** (P2) | The boundary must be stated; never "most relevant" | Exact Arabic wording |
| **Foreground / removal actions** (§9) | Full semantics — view-only, reversible, non-destructive, temporary scope | AR + EN wording — VI-02/VI-03 |
| **Live Context English** (§7.2) | Must diverge from literal "Context" | Exact string — VI-02/VI-03 |
| **Voice states** (§14) | Principles only | All strings — Phase VII |

### OPEN UNTIL REAL INTERACTION / VISUAL CONTEXT

Everything in §19.2 — Live Context English wording, foreground/focus wording,
remove-from-current-context wording, reading short-identity strategy, exact voice/realtime
states, QANDEEL English casing, numeral policy.

**Do not resolve any of these on the page.** Each needs the real interaction or a real
architecture in hand; several are open precisely *because* an earlier draft resolved them
prematurely.

**No remaining blocker.** The addressee-gender question that previously blocked freezing any
T2 Arabic string is resolved by policy (§3.6); what remains at §19.1 is a voice-latitude
choice that does not block freezing the neutral forms already authored.

---

## 21. Design-critique gate — outcome

Run against the fifteen adversarial questions in the brief plus the `design-critique`
framework, **before** these deliverables were finalized. Eight defects were found in my own
proposals and corrected in place. The four that changed a recommendation:

| # | Question | Defect found | Fix applied |
|---|---|---|---|
| 1 | Does this sound like an AI app? | My first English proposal for the context panel was **"Current context"**. "Context" is captured AI vocabulary in English — it reads as a model's context window. | English diverges to **"In play now"**. Became the model case for §5. |
| 4 | Does Arabic sound translated? | **«السياق الحالي»** was a 1:1 map of "Current context" — the one place I had started from English, which is exactly what the brief forbids. Re-derived natively. | **«سياق الكلام»** — a real Arabic collocation, and it unifies the split term (§7.2). Materially better than what it replaced. |
| 9 | Survives double-digit peers? | My scaling rule banned count-varying labels outright. **Wrong for Arabic**, which has three grammatical numbers; the real defect is *partial* gating, not gating. | Rule 5 refined (§10.1): gating is admissible only if singular, dual and plural are all authored. |
| 14 | Do correction/provenance phrases avoid overclaiming? | The prototype **quotes recorded material in guillemets** while its provenance line states it is not a transcription. Typography asserts verbatim; copy denies it. | Recorded material renders unquoted in both languages (§12). Added to §18 as a banned pattern. |

Four further fixes, applied without changing a recommendation: English collective reframed from
"What you've told me" to **"from what you said"** (the former edged toward a listening-therapist
frame — Q2); the superseded state changed from the aphoristic "No longer the question" to
**"This no longer applies"** (Q3); **"Take out for now"** split into a short visible label plus a
completing accessible name for 375px (Q12); the correction entry point kept as a **question**
rather than the schoolteacher-adjacent «صحّح» (Q10).

Questions **5, 6, 7, 8, 11, 13, 15** passed without a fix. The strongest pass is 6: applying
§6 removed names rather than adding them — the surface noun «المشهد» is deleted with no
replacement, and the subject anchor, Home, provenance, foreground and disconfirming conditions
all resolve to actions or sentences with no noun at all.

### 21.1 Focused rerun after the canonical authority gate (`VI-01 FIX-00`)

The gate found exactly one substantive canonical difference — the runtime peer-cap correction
(§0). Critique was rerun **only** on the conclusions that fact touches: **Q8** (unsupported
runtime intelligence) and **Q9** (double-digit peer survival). Everything else was left alone
because canonical A15, A22, A23, D7 and the relevance gate are byte-identical to the text the
original pass ran against.

| Conclusion | Verdict on rerun |
|---|---|
| §10.1 rules 1–8 (peer scaling) | **Stand unchanged.** None depended on the count being unlimited — only on it being *unknown at design time and reaching double digits*, which canonical confirms more precisely than the stale source did. |
| §10.2 reading identity (reject أ/ب/ج; content-derived target) | **Stands, strengthened.** Boundedness bounds how badly an abjad series fails; it does not rescue it. Rationale expanded. |
| §18 "guaranteed two readings" rationale | **Was wrong — corrected.** It read "reading count is unbounded", which is the stale claim. |
| §18 coverage | **Two new banned patterns added** that the stale source could not have produced: copy implying *limitless* readings, and copy stating a *per-subject ceiling*. The second is the subtler one — 32 is per **user**, so "up to 32 readings" for a subject asserts a fact the runtime does not supply, and a stated maximum invites the count to read as a score (**A14**). |
| §1, §5, §6, §7, §12, §16, §19, §20 | **Unaffected.** No conclusion in them rests on the peer-cap statement. |

Net effect of the gate: **one factual error removed, one guardrail gained.** No naming
recommendation changed, and no rejection was overturned. The three findings FIX-00 named as
provisional — the English/«سياق» divergence, the guillemets/provenance conflict, and
Arabic-aware count gating — all survive revalidation: each rests on canonical text that the
archival correction did not touch, and on the V10 prototype, which the archive manifest
confirms is byte-identical.

---

### 21.2 Final package critique — all five deliverables

Run across the complete package, not only this document: Foundation, Terminology Matrix, Copy
Patterns, Rejected Language, Language Stress Test. The fifteen original adversarial questions
were re-run against the finished system, plus the seven additional checks required at RESUME-01
§8.

**Original fifteen: all pass.** The four defects the first gate found stayed fixed; nothing
regressed when the remaining four documents were authored around them.

**The seven additional checks:**

| Check | Verdict |
|---|---|
| Is fixed Arabic UI copy gender-neutral where practical? | **PASS — 35/35 fixed strings**, zero variant pairs required. Stress test §14. |
| Did any attempt at neutrality make Arabic unnatural? | **PASS, with three strings recorded as flatter.** The masdar convention is what Arabic UIs already use, so the neutral form is also the conventional one; `-ك` possessives keep second-person intimacy. All three flattened strings are chrome, where §3.1 had already prescribed the neutral register. |
| Any gendered reusable string missing a variant/fallback rule? | **PASS** — none is gendered, so none is outstanding; the rule for future strings is at Copy Patterns **P-gender** step 4. |
| Does any English term look like a literal mirror of the Arabic? | **PASS.** The high-risk pairs diverge deliberately («سياق الكلام» / "In play now"، «المصدر» / "Where this came from"). Where AR and EN do run parallel — «المشترك بين القراءات» / "Shared across readings" — both are independently natural, and §5 records that the equivalence rule *permits* convergence rather than requiring divergence. |
| Does any Arabic term look reverse-translated from English? | **PASS, with one flagged.** «السياق الحالي» was the real instance and was re-derived as «سياق الكلام». **«تركيز العرض» carries the highest residual naturalness risk in the package** — it is semantically the right answer, because it locates the change *in the view* and so cannot be read as importance (**A9**, **A15**), but it is a slightly constructed phrase rather than an attested collocation. It is flagged for the native-speaker pass rather than presented as settled. |
| Does any peer label break at double digits or imply ordering? | **PASS.** «قراءة أ/ب/ج» rejected; the `n===2` dual switch deleted; aggregate labels count-independent; position taken from native list semantics, never authored copy. Stress test §6. |
| Did stale unlimited-runtime wording reappear anywhere? | **PASS — verified mechanically** across all five files. Every occurrence of the phrase is a *negation* or a *citation* of the stale claim, never an assertion of it. |

**Four new defects were found by this pass and the stress test, and all four are fixed** — D6–D9
in Stress Test §17. Two of them (D8, D9) are the package failing its *own* rules: «دلوقتي» had
leaked into four proposed system strings, and the transparency test's stated rule contradicted
its own verdict table. Both were caught only because the rules were written as **tests** rather
than as principles, which is the strongest argument for freezing §3.1, §3.2 and §18 first (§20).

**One honest limitation on the whole package.** I am confident about the *system* — the register
law, the truth guardrails, the scaling rules, the rejections — and about the *reasoning* behind
each name. I am less able to certify that every proposed Arabic string sounds right to a native
ear. **That limitation was borne out:** «تركيز العرض» was flagged here as the likeliest failure
and independent review confirmed it, along with two more. All three are now `OPEN` (§9). This is
why §20 recommends freezing the rules before the nouns, and why the remaining nouns still need a
native-speaker pass.

### 21.3 Focused critique gate after Product Direction FIX-01

Run across all five deliverables after the corrections. **Seven defects were found by independent
review (D10–D16, Stress Test §17.1); all seven are corrected.** The seven required checks:

| # | Check | Verdict |
|---|---|---|
| 1 | Did forced gender-neutrality make any Arabic label bureaucratic? | **YES — and that is now recorded rather than denied.** «تركيز العرض», «إرجاع العرض» read constructed; «استبعاد مؤقت» reads evaluative. All three are `OPEN`, no synonym forced. The earlier "no naturalness cost" claim is withdrawn. |
| 2 | Any stale dual `AR-EG` / `AR-NEUTRAL` v1 requirement remaining? | **NO — verified mechanically.** v1 ships one Arabic; profiles survive only as a future-localization principle (§3.3). Remaining mentions are withdrawal notices and the voice-register column. |
| 3 | Any rationale still claiming spatial meaning is forbidden by A15? | **NO — verified mechanically.** All five remaining occurrences are explicit withdrawals or defect records. A19-forbids-naming is likewise withdrawn. |
| 4 | Does any global rule accidentally forbid a legitimate future capability? | **NO.** The non-conclusion rule is scoped to Deep Analysis and to unsupported certainty (§2); the rejection log is split into Class A hard bans and Class B revisitable preferences (§17). Advisory language is Class B. |
| 5 | Does any empty-state sentence promise a future reading? | **NO — verified mechanically.** All four remaining occurrences are the removed string quoted as a defect. |
| 6 | Is a new runtime reading-label contract implied as approved? | **NO.** `DEFERRED POSSIBILITY — NOT REQUESTED` in §10.2, Matrix O03 and Stress Test §6. The v1 answer needs no runtime change. |
| 7 | Are semantic hard bans clearly separated from current-vocabulary preferences? | **YES.** Rejection Log carries an explicit Class A / Class B table with the test for which is which, and §17 mirrors it. |

**Document hygiene.** The reported duplicate `# PART 3 — High-impact term reviews` block in the
Terminology Matrix **does not exist** — the file has 16 headings and zero duplicate heading text,
verified mechanically. No spurious fix was applied. The likely cause of the misread is that
high-impact reviews are split across two documents; the Part 3 preamble is now an explicit split
table naming which four concepts live in Foundation §7 and which seven live in the Matrix.

**What this round changed about the package's own method.** Every FIX-01 defect was a rule applied
past its warrant, not a rule broken — neutrality pushed into copy quality, market reach pushed
into a v1 requirement, Phase V truth boundaries pushed past what they say, non-conclusion pushed
into product mission. The package's self-critique was structurally unable to catch these, because
it tested whether rules were *obeyed*. **A rule can be over-obeyed, and only independent review
catches that.** The register law, truth guardrails and naming framework are unchanged and remain
the parts worth freezing first (§20).

### 21.4 Final critique gate after Product Direction FIX-02

Run across all five deliverables after the corrections. **Seven review defects (D17–D23) plus the
fixed-copy register audit, all recorded in Stress Test §17.2 and §15.1.** The ten required checks:

| # | Check | Verdict |
|---|---|---|
| 1 | Executive summary and detailed sections carry identical decision states | **PASS after fix.** Three drifted (D17–D19): the «الشغّال دلوقتي» rationale, the Live Context English string, and reading identity. All three now match their detail sections. |
| 2 | English Live Context wording is `OPEN` everywhere | **PASS after fix — audited across all five files.** Four presentations as final were corrected: the §7.2 direction table, Copy Patterns P3, the Rejection Log §1.2 heading, and the Stress Test calque table. Remaining uses are prose, candidates, or defect records — and Copy Patterns now records that **every English string containing "in play" inherits the open decision**. |
| 3 | No new runtime reading-label contract implied | **PASS.** `DEFERRED POSSIBILITY — NOT REQUESTED`; content-derived identity is now "the first direction to test in VI-02", not a mandate. |
| 4 | No global ban silently removes guidance/advice/legitimate acknowledgement | **PASS after fix.** Four absolutes scoped (D20). One residual contradiction was caught in Copy Patterns P11 — *"Errors never apologize"* — and corrected to match §15.3. |
| 5 | Class A contains only genuinely unsupported/false claims | **PASS after fix.** Class A narrowed to claims about **what the system knows or did**. |
| 6 | "AI-powered" is not called factually false | **PASS after fix.** Moved to Class B — **QANDEEL is an AI product**, so the phrase is register, not falsehood. «ذكاء», "intelligent", "smart", "insights", «تحليل عميق» moved with it. |
| 7 | "Summary"/"Analysis" not treated as semantically impossible | **PASS after fix.** *A summary can summarise alternatives without forcing a winner.* Both are Class B current-vocabulary choices. |
| 8 | Fixed Arabic register rules do not contradict freeze-candidate strings | **PASS after fix — this was the largest remaining defect.** The package declared all fixed copy neutral, then approved eight Egyptian fixed strings. Resolved by splitting **T3a labels** from **T3b prose** (§3.1), then re-scoring every freeze candidate (Stress Test §15.1). |
| 9 | Arabic naturalness was not sacrificed to market-neutrality | **PASS.** **No string was rewritten into stiff MSA.** Where the neutral form was clearly better it is the leading candidate; where it was not, the wording was demoted to `PROPOSED` and the semantics frozen. G2 is now explicitly a review preference that may produce a rewrite or a deferral — **never a stiff string**. |
| 10 | The package says microcopy remains editable under frozen semantic guardrails | **PASS.** Stated at the head of §20 with its four conditions, and mirrored in the Matrix status vocabulary and the Copy Patterns preamble. |

**The honest summary of this round.** 11 terms survived as approved core vocabulary; **8 were
demoted from approved to `PROPOSED` with their semantics frozen.** That is not a regression — it
is the package no longer claiming confidence about Arabic naturalness it does not have. The
alternative was a freeze that reads authoritative and is partly guesswork.

**And a method note.** D10–D16 were rules *over-obeyed*; **D17–D19 were simply edits never
propagated to the executive summary.** A long document can be correct in every section and still
disagree with itself, and the summary is where that shows first. **Any future correction round
must re-read the executive section last, on principle.**

### 21.5 Final consistency seal (FIX-03)

The last pass before freeze. **Eight defects found (D24–D31, Stress Test §17.3); all eight
corrected.** The fourteen required checks, nine of them verified mechanically:

| # | Check | Verdict |
|---|---|---|
| 1 | No `Freeze nothing yet` remains | **PASS** — executive rec 10 now states the three-tier policy |
| 2 | Deep Analysis decision status consistent everywhere | **PASS** — `APPROVED` in §7.1, Matrix S04/S06, §20 Tier 2 |
| 3 | No "right answer / v1 answer / v1 solves" pre-solves reading navigation | **PASS** — reduced to six frozen constraints; VI-02 owns the solution |
| 4 | Authority A contains only false/unsupported claims | **PASS** — four authorities (§17) |
| 5 | Internal vocabulary is not called false | **PASS** — Authority B says so explicitly |
| 6 | Peer-label rejection not misclassified as runtime falsehood | **PASS** — Authority C, with the narrower order-can-be-mistaken-for-hierarchy claim |
| 7 | Relevance ban scoped to A22 runtime-derived relevance | **PASS** — §18; the ordinary word "relevant" is no longer globally banned |
| 8 | **Every Label-in-Name example literally contains its visible label** | **PASS after fix — this was a real WCAG 2.5.3 failure** (D24), re-run mechanically over every pair |
| 9 | No numeric line-height frozen by VI-01 | **PASS** — removed from §16 and from the stress test's own preamble; carried to VI-03 / VI-10 |
| 10 | No global "errors never apologize" | **PASS** — scoped in §15.3 and Copy Patterns P11 |
| 11 | Correction gratitude not treated as inherently false | **PASS** — tone/restraint choice, with three conditions if ever used |
| 12 | Realtime "live" Phase VII-dependent everywhere | **PASS** — 4 sites corrected |
| 13 | `OPEN` strings not used as canonical rule examples | **PASS** — action-vocabulary rule stated abstractly; accessibility examples use `⟨visible label⟩` |
| 14 | Counts / statuses / headings agree across all five files | **PASS** — one count everywhere: **59 concept rows**; one status line per file; one taxonomy |

**D24 is the finding that matters, and it is worth stating plainly.** The package's accessibility
rule correctly invoked WCAG 2.5.3 — and then illustrated it with an Arabic pair that **violates
it**: «المصدر» → «مصدر الحاجة دي». The definite «المصدر» is not present as a contiguous string, so
a voice-control user saying what they see would not match the control. **Every other check in this
seal was documentation drift; this one would have shipped a real barrier**, in the language where
it is hardest to notice, because Arabic can absorb a label into a construct phrase without looking
like it changed. The standing instruction that follows: **a rule stated in English and illustrated
in Arabic must have its Arabic example checked as a string, not as a meaning.**

**The other seven repeat a pattern the package has now named three times** — corrections landing
in detail sections while summaries, examples and cross-references keep the old state. The
countermeasure is in place: each round now ends with a mechanical sweep for the *previous* round's
withdrawn claims, and every remaining hit must be a withdrawal notice or a defect record rather
than an assertion.

---

**`VI-01 — FREEZE CANDIDATE. FIX-03 CONSISTENCY SEAL APPLIED.`**
**`FROZEN: the language system and its semantic contracts. APPROVED: core vocabulary.`**
**`PROPOSED / OPEN: exact microcopy, by design — see §20.`**
