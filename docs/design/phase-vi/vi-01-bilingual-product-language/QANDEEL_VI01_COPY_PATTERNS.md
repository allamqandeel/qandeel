# QANDEEL — VI-01 · BILINGUAL COPY PATTERNS

**Status:** `FREEZE CANDIDATE — FIX-03 CONSISTENCY SEAL APPLIED. SYSTEM + SEMANTIC CONTRACTS FROZEN; VOCABULARY APPROVED; MICROCOPY PROPOSED / OPEN AS MARKED`
**Canonical authority:** `docs/design/phase-v/` @ `4e83b1ce2d854f1ba49a6de15572f1025d196647`

Reusable patterns, not a string table. Each defines the **shape** a class of copy takes, so new
strings can be written without re-deciding the semantics every time.

**Reading this document.** Every pattern gives Arabic, English, semantic intent, a usage rule,
and what NOT to say. Register tiers are Foundation §3.1 — `T1` chrome · `T2` voice ·
**`T3a` analysis chrome** · **`T3b` analysis prose** · `T4` system. No fixed Arabic string here is
masculine-as-default (§3.6).

> **The patterns are the deliverable; the sentences are examples.** Semantic contracts freeze;
> exact microcopy stays editable in VI-02/VI-03 provided the semantic contract, runtime truth,
> accessibility and bilingual equivalence all hold (Foundation §20). Where an exact Arabic string
> is `PROPOSED` rather than approved, it is marked in place.
>
> **One dependency to carry forward:** the English context-panel name is `OPEN` (Foundation §7.2),
> so **every English string below that contains the phrase "in play" inherits that decision** and
> must be re-checked once the panel name is settled — including the helper text in **P2** and the
> empty state in **P12**. The Arabic «سياق الكلام» is approved, so its dependents are stable.

**The one rule above all the patterns:** the copy and the interface must not disagree. If a
sentence says a thing is not a transcription, the typography may not put it in quotation marks;
if a label says an action is temporary, the action may not be permanent. Where they disagree,
users believe the interface.

---

## P1 · Headings

| | |
|---|---|
| **AR** | «قرار الشغل الجديد» · «المشترك بين القراءات» · «اللي مسجّل من كلامك» |
| **EN** | The new job decision · Shared across readings · What's recorded from what you said |
| **Intent** | Name the region by what is in it, or by the user's own subject. Never by a product concept. |

**Usage rule.** A heading names a *region*, never a *record* — **D1** rejected per-record
headings as boilerplate; one region heading is correct. The surface's top heading is the user's
subject, not a product noun (**S05**). Aggregate headings are count-independent (**§P-scaling**).
Heading levels never skip.

**Do NOT say:**

- ❌ «المشهد» / "Deep Analysis" — retired container nouns (Foundation §7.1).
- ❌ «اللي في القراءتين» / "In both readings" — count-locked at exactly two.
- ❌ "Overview", "Summary", "Insights", «ملخّص التحليل» — **Authority D — current-vocabulary choices,
  not truth rules** *(FIX-02 §5)*. On the current Deep Analysis surface "Summary" can read as a
  settled synthesis and is generic; "Analysis" is generic AI-product vocabulary in this framing.
  **A summary can perfectly well summarise alternatives without forcing a winner** — an earlier
  draft claimed "Summary" implies a conclusion QANDEEL does not draw, which turned a style
  preference into a semantic impossibility. Withdrawn.
- ❌ Any heading with a count in figures — **A14**.

---

## P2 · Helper text

| | |
|---|---|
| **AR** | «دي الحاجات المسجّلة اللي داخلة مع الكلام حالياً، مش كل اللي مسجّل.» |
| **EN** | "These are the recorded things in play with this conversation — not everything recorded." |
| **Intent** | State the boundary of what is shown, so the user never infers completeness. |

**Usage rule.** Maximum two sentences. Helper text states a **boundary or a basis**, never an
encouragement. Where a surface shows a subset, the helper text says so — this is the primary
guard against the user reading a bounded selection as a judgement. Gender-neutral by
construction: the subject is the material, not the reader.

**Do NOT say:**

- ❌ «دي أهم الحاجات» / "These are the most important ones" — **A15**.
- ❌ «الأقرب لموضوعك» / "Most relevant to what you're discussing" — relevance is **NOT
  SUPPORTED** in production (**A22**).
- ❌ «عشان تفهم نفسك أكتر» / "To help you understand yourself better" — therapy register, and
  a claim about outcomes.
- ❌ Anything explaining *how* the selection was made — the runtime basis is a recency window,
  and describing it invites a relevance reading.

---

## P3 · Primary actions

| | |
|---|---|
| **AR** | «القراءات» · «سياق الكلام» · «إرسال التصحيح» |
| **EN** | Readings · Send correction · ⟨context panel — wording `OPEN`, *"In play"* candidate⟩ |
| **Intent** | Name the outcome. The word survives into the resulting state. |

**Usage rule.** Verb-first in English; in Arabic, **reach for the masdar or a bare noun phrase
first** — it is the native Arabic UI convention and it carries no addressee inflection
(Foundation §3.6.2). **But the masdar is a first tool, not a requirement.** If it produces a
constructed or bureaucratic noun, the string is `OPEN` and the interaction is reconsidered —
naturalness and action clarity outrank a neutrality score. ≤ 3 words. The accessible name
**contains** the visible label (WCAG 2.5.3). An action keeps its name through the flow: "Send
correction" → "Correction sent", never "Correction submitted".

**Do NOT say:**

- ❌ «ابعت» / «ابعتي» — gendered imperative; use «إرسال».
- ❌ "Submit", "Confirm", "OK" — name the outcome, not the mechanism.
- ❌ «ابدأ رحلتك» / "Get started" — startup register.

---

## P4 · Secondary actions

| | |
|---|---|
| **AR** | «المصدر» · «دورها في القراءات» · «إغلاق» · ⟨foreground return — `OPEN`⟩ |
| **EN** | Where this came from · Its role in each reading · Close · ⟨*"Put it back"* — candidate only⟩ |
| **Intent** | Offer a next step without competing with the primary action. |

**Usage rule.** Secondary actions may be longer than primary ones because they sit inline, at
the record, rather than in chrome — which is why «المصدر» (6 characters) and "Where this came
from" (20) are equivalent despite the length gap (Foundation §5). Progressive disclosure is
**reader-stepped, never timed** (**B6**): each is one press away, and nothing opens on a delay.

**Do NOT say:**

- ❌ «شوف» / «شوفي» — gendered; use a bare noun phrase.
- ❌ "Learn more", "Details", "More" — say what is behind the press.

---

## P5 · Removal actions — the non-destructive inversion

> **`EXACT LABELS OPEN — VI-02/VI-03`.** The **semantics below are approved and locked**; the
> visible strings are not. «استبعاد مؤقت» can read as rejection or judgement — undesirable near
> **A15** — and "Take out" is ambiguous without surrounding context. The examples are retained to
> show the *shape*, not to propose the words.

| | |
|---|---|
| **AR** *(shape)* | **Label** ⟨short, non-evaluative⟩ · **Accessible name** «… من سياق الكلام مؤقتاً — مش هتتمسح» |
| **EN** *(shape)* | **Label** ⟨short, scope-bearing⟩ · **Accessible name** "… for now — this doesn't delete it" |
| **State** | AR «الحاجة دي مش داخلة مع الكلام حالياً. هي زي ما هي، ومحصلش أي تغيير تاني.» · EN "This isn't in play with the conversation now. It's unchanged, and nothing else changed with it." |
| **Intent** | Remove from the current context **without** implying deletion — because nothing is deleted. |
| **Carried-forward requirement** | The final label must make the **temporary, current-context scope** clear **without sounding destructive or evaluative**. |

**Usage rule.** This is the one place in the product where the usual advice inverts. Most
products must make destructive actions *unmistakably destructive*; here the action is
**non-destructive and must say so**, because **A10** guarantees nothing stored is mutated and the
effect is session-scoped. The temporariness belongs in the label, not only in a follow-up
sentence. If a genuinely destructive action is ever introduced, it must take a **visibly
different verb** — «حذف نهائي» / "Delete permanently" — so the two can never be confused.

**Do NOT say:**

- ❌ «احذف» / "Delete" — false; nothing is deleted.
- ❌ Bare "Remove" — reads as deletion in most products.
- ❌ «شيلها» / «شيليها» — gendered, and Egypt-locked.
- ❌ «مش مهمة» / "Not important" — **A15**; exclusion is not a judgement about the item.

---

## P6 · Correction acknowledgement

| | |
|---|---|
| **AR** | «وصلني، وكلامك ده موجود عندي هنا. بس أنا ما طبّقتوش على الحاجة المسجّلة.» |
| **EN** | "I have this, and what you wrote is here. I haven't applied it to what's recorded." |
| **Intent** | Confirm receipt and **state non-application** as the product truth, not as a caveat. |

**Usage rule.** **A11** freezes correction to RECEIVED / PENDING and nothing else: material,
readings, roles and unknowns are identical before and after. The acknowledgement therefore has
exactly three obligations — receipt, non-application, and the unchanged state of everything else
— and no fourth. **Nothing on the correction path animates** (**A11**, **D5**): motion may make a
state legible, never *be* the state. First person, neutral by construction («كلامك» is a
script-neutral possessive).

**Do NOT say:**

- ❌ «التصحيح اتطبّق» / "Correction applied" — the central forbidden claim here.
- ❌ «هنراجعه» / "We'll review this" — invents a process and a promise.
- ⚠️ «شكراً على التصحيح» / "Thanks for the correction" — **omitted as a tone/restraint choice, not
  a truth ban** *(FIX-03 §9)*. Thanking someone for the real act of sending a correction does not
  by itself claim it was applied. **Recommendation stands: skip the thank-you and lead with
  receipt + non-application.** If gratitude is ever used, it must refer only to the act of
  sending, must not replace the RECEIVED/PENDING language, and must not imply application, review
  or downstream effect.
- ❌ «حدّثت الفهم» / "Updated my understanding" — downstream effect.

---

## P7 · Pending state

| | |
|---|---|
| **AR** | «لسه ما اتطبّقش على الحاجة المسجّلة.» |
| **EN** | "Not applied to what's recorded yet." |
| **Intent** | Hold the state visibly and indefinitely without implying a queue, a worker, or an ETA. |

**Usage rule.** Pending is a **stable state, not a transition**. It carries no spinner, no
progress indication and no time estimate, because none of those are runtime-backed. It must
remain legible with motion disabled. The state appears at the record it concerns and does not
repeat elsewhere on the surface — the repeated-notice defect (**B6** in the V10 report) was the
one correction-path failure found, and it is fixed.

**Do NOT say:**

- ❌ «جاري التطبيق» / "Applying…" — implies work in progress.
- ❌ «هيتم قريب» / "Soon" — no ETA exists.
- ❌ A spinner as the only carrier of the state.

---

## P8 · Provenance disclosure

| | |
|---|---|
| **AR** | «التاريخ ده تاريخ تسجيل قنديل للحاجة دي، مش تاريخ حصولها. والكلام ده مأخوذ من كلامك انت، ومش نقل حرفي للي اتقال.» |
| **EN** | "This date is when I recorded it, not when it happened. And this is taken from your own words — it isn't a word-for-word record of what you said." |
| **Intent** | Discharge both mandatory disclaimers in one place, one press from the record. |

**Usage rule.** **A8** requires provenance discoverable *at the record*, one press away, without
metadata overload. Two claims are mandatory and neither may be dropped for length: **record date
≠ event date**, and **not a transcription**. Identical wording on every surface the record
appears on (**A19**). Native dialog semantics — real focus trap, inert background, Escape, focus
returned to the trigger, and the return may not depend on winning a race (**B8**).

**Do NOT say:**

- ❌ «قلت بالحرف» / "You said, quote:" — verbatim claim.
- ❌ «قلت ده في رسالة ٤» / "You said this in message 4" — memory-to-turn provenance is not
  supported.
- ❌ «يوم ١٢ حصل كذا» / "On the 12th, this happened" — record date read as event date.
- ❌ **Quotation marks or guillemets around recorded material** — this is a *typographic*
  verbatim claim that contradicts the sentence above it, and when copy and typography disagree
  the typography wins. Recorded material renders as plain text. *(Defect found in the V10
  prototype during the critique gate.)*

---

## P9 · Unknown / open state

| | |
|---|---|
| **AR** | «مش معروف العرض الجديد بيقدّم إيه بالظبط من ناحية التعلّم.» · state: «لسه ناقصة» |
| **EN** | "Not known: what the new offer actually involves in terms of learning." · state: "Still open" |
| **Intent** | Name the specific gap as a plain declarative, with no agent and no judgement. |

**Usage rule.** **A7**: an unknown is named, explicit, and **occupies space while open** — never a
tooltip, never a footnote. The pattern is *"Not known: «the specific thing»"* — the specificity
is what makes it honest; a vague unknown reads as a deficiency in the user. Where QANDEEL asks
about one, the question is scoped by **what it changes**, never by curiosity: «فيه حاجة واحدة لو
عرفتها هتفرق معايا» / "There's one thing that would change what I can do."

**Do NOT say:**

- ❌ «مش هقول» / "I won't say" — a refusal state for an unknown is forbidden.
- ❌ «السؤال ده مهم» / "This is the important question" — question utility is forbidden.
- ❌ «حاجة ناقصة عندك» / "Something's missing from your account" — deficiency framing.
- ❌ Any count of unknowns in figures — **A14**.

---

## P10 · Resolved and superseded states

| | |
|---|---|
| **AR** | RESOLVED «بقت معروفة.» + «مفيش إجابة منك هي اللي غيّرت الحالة دي.» · SUPERSEDED «ما بقتش مطروحة.» |
| **EN** | RESOLVED "This is known now." + "No answer from you changed this." · SUPERSEDED "This no longer applies." |
| **Intent** | State the lifecycle change **agentlessly**, and keep the two outcomes distinct. |

**Usage rule.** These are the two states most likely to acquire a false agent. **Answer-driven
gap closure is forbidden**, so RESOLVED must carry its disclaimer wherever it appears — the
prototype's «مفيش إجابة منك هي اللي غيّرت الحالة دي» is the canonical form. SUPERSEDED is a
*different* outcome, not a better one: the question stopped being the question. Neither state may
read as an achievement.

**Do NOT say:**

- ❌ «إجابتك قفلت الحاجة الناقصة» / "Your answer closed this gap" — the forbidden claim.
- ❌ «تم الحل» / "Resolved ✓" — a checkmark is an achievement mark.
- ❌ Conflating the two — "Closed" covers both and loses the distinction.

---

## P11 · Retry and failure

| | |
|---|---|
| **AR** | «تعذّر تحميل القراءات.» + «إعادة المحاولة» |
| **EN** | "The readings didn't load." + "Try again" |
| **Intent** | Say what happened, offer the way forward, take no blame and assign none. |

**Usage rule.** **Process-framed, never confession-framed.** Arabic «تعذّر» frames the *process*
as having failed; «لم نتمكن» is a "we couldn't" confession that reads as institutional and weak
(`writing-eloquent-arabic`, robotic-tone). English mirrors this with "didn't load", not "We
couldn't load". **Routine failures are not padded with performative apology** — but apology is not
banned: where QANDEEL actually caused user-impacting harm, gave incorrect information, or failed a
request in a way accountability attaches to, **a brief direct apology is appropriate** (Foundation
§15.3). Errors are never vague about what happened. The retry
control is a masdar in fixed copy; the colloquial «جرّب تاني» stays available to QANDEEL's
conversational voice. One Arabic, two registers — not two profiles (Foundation §3.3).

**Do NOT say:**

- ⚠️ «آسفين» / "Sorry about that" **padding a routine load failure** — generic, performative, and
  it delays the actual information. **Apology is not globally banned** *(FIX-03 §8; Foundation
  §15.3)*: where QANDEEL caused meaningful user-impacting harm, gave incorrect information, or
  failed a request where accountability attaches, **a brief direct apology is appropriate.**
- ❌ «حصل خطأ ما» / "Something went wrong" — vague.
- ❌ «جرّب» / «جرّبي» — gendered imperative in fixed copy.
- ❌ Blaming the connection without evidence — «تأكد من اتصالك» is only correct when the failure
  is actually a network failure.

---

## P12 · No-data and thin-data

| | |
|---|---|
| **AR** | «لسه مفيش قراءة اتكوّنت للموضوع ده.» · «قراءة واحدة.» · «مفيش حاجة داخلة مع الكلام.» |
| **EN** | "No reading has formed for this yet." · "One reading." · "Nothing is in play." |
| **Intent** | Present emptiness as a **valid product state**, not a failure and not a waiting room. |
| **Correction** | An earlier draft appended *"When one does, it'll be here."* / «لما حاجة تتكوّن هتلاقيها هنا.» — **that promises a future formation and is removed** (Product Direction, FIX-01 §10). The one-reading state likewise drops "so far" / «لحد الآن». **Stop at the state. Restraint wins.** |

**Usage rule.** **A12** makes thin data normal: zero readings, one reading, no relation, no
unknown are all correct states. Empty states occupy real space and say what would appear here —
never a spinner, never an error treatment. The most dangerous line in this family is the
one-reading state: it must not imply a second is coming, because **guaranteed two readings is
forbidden**, and it must not imply deficiency.

**Do NOT say:**

- ❌ «القراءة التانية لسه بتتكوّن» / "The second reading is still forming" — guarantees two.
- ❌ «قراءة واحدة بس» / "Only one reading" — "only" adds a deficiency read.
- ❌ «قراءات من غير حد» / "as many readings as it needs" — **the runtime is bounded, not
  unlimited** (`MAX_ACTIVE_HYPOTHESES = 32` per user).
- ❌ «لحد ٣٢ قراءة» / "up to 32 readings" — the cap is **per user, not per subject**, and no
  per-subject cap was found; stating a ceiling asserts a fact the runtime does not supply.

---

## P13 · Voice, reconnect and fallback

| | |
|---|---|
| **AR** | «بسجّل» · «الاتصال انقطع. جاري إعادة الاتصال.» · «المكالمة وقفت. الكتابة متاحة.» |
| **EN** | "Recording" · "The call dropped. Reconnecting." · "The call isn't working. You can keep going in writing." |
| **Intent** | Describe the mechanical state only, and always name the way out. |

> **`PRINCIPLES = KEEP. EXACT STRINGS = PROVISIONAL / PHASE VII.`** *(Product Direction, FIX-01
> §12.)* The strings above illustrate the principles; **none is a freeze candidate.**
> **"Recording" may be false** if realtime audio is not persistently recorded, and **"Listening"
> is not automatically a comprehension claim** — it may be a legitimate mechanical
> microphone/VAD state if the final architecture defines it as one. Reconnect and fallback
> wording depends on real failure modes that do not exist yet.

**Usage rule.** Vocabulary preparation only — **no voice runtime is assumed**, and provider
qualification is Phase VII. A state string must name **what the architecture actually does**:
if the state is mechanical, name the mechanism; if it implies comprehension, it needs support.
Failures are process-framed and assign no fault. Every failure names the alternative in the same
breath, and the alternative must be reachable by keyboard. Voice input is recorded material like
any other and inherits **P8** in full.

**Do NOT say:**

- ❌ Any state word that outruns what the architecture delivers — «بسمعك» / "Listening" is
  admissible *only* if it names a real mechanical state, and inadmissible if it implies
  comprehension the system does not have. **Phase VII decides; VI-01 does not.**
- ❌ «قنديل بيفكّر» / "Thinking…" — anthropomorphic overclaim and an AI cliché.
- ❌ «فقدتك» / "I lost you" — anthropomorphizes and assigns fault.
- ⚠️ «مكالمة مباشرة» / "Live call" — **`PROVISIONAL / PHASE VII`, not a false statement by
  definition** *(FIX-03 §10)*. Whether "live" is accurate for a call depends on the realtime
  architecture, which does not exist yet. What **is** settled: **"Live Context" is rejected as
  today's user-facing context-panel vocabulary** (Foundation §7.2).
- ❌ «قاطعتني» / "You interrupted me" — interruption is neutral.

---

## P-scaling · The rule that binds every pattern above

Any string that references readings must survive **2, 3, 6 and double-digit** counts. The
canonical bound is `MAX_ACTIVE_HYPOTHESES = 32` **per user** with **no per-subject cap found** —
so a single subject's count is bounded but unknown at design time, and can plausibly reach double
digits.

1. Identity is never ordinal — no أ/ب/ج, no digits-as-names, no "first/second".
2. Identity is never positional — no يمين/شمال, no left/right.
3. Never "the other" — valid only at exactly two.
4. **Aggregate and region labels are count-independent** — «المشترك بين القراءات» holds at 2 and
   at 12.
5. Per-item labels may vary with count **only if all three Arabic number forms** — singular, dual,
   plural — are authored. Partial gating is the defect, not gating itself.
6. Arabic duals are a standing trap: any string containing قراءتين / الاتنين / كلاهما is
   count-locked. Prefer elimination over gating. English must not compensate with "both" or
   "either".
7. Reference by content, then by the named set — **never by a count** (**D2**).
8. Navigation position is not identity: supply it through native `tablist` set-size/position
   semantics, never authored copy, so no figure enters product language (**A14**).

---

## P-gender · Neutrality checklist for any new Arabic string

> **Neutrality is a constraint, not the copy objective.** If a neutral rewrite becomes
> bureaucratic, constructed, or less understandable, **the interaction must be redesigned or the
> string remains open.** Two labels in this package hit exactly that wall and are now `OPEN`
> rather than forced (**P5**, and the foreground action). Do not trade copy quality for a
> neutrality score.

Applied to every string in this document; apply to every new one.

1. **Is there an imperative?** → try a masdar («صحّح» → «تصحيح») or a bare noun phrase
   («شوف دورها» → «دورها في القراءات»). **Then read it aloud.** If the result is a word no one
   would say, stop — go to step 6.
2. **Is there an inflected second-person verb?** → rewrite around it, usually by making the object
   the subject («انت اللي رفعت الحاجة دي قدّام» → «الحاجة دي قدّام حالياً باختيارك»).
3. **Is there a `-ك` possessive?** → keep it. It is script-neutral unvowelled and carries the
   second-person intimacy that stops neutral Arabic sounding stiff.
4. **Is it an Egyptian perfect verb or participle addressed to the user?** («قلت»، «مضايقاك») →
   this is the one form the dialect writes out. Restructure, or ship an explicit `AR-M`/`AR-F`
   variant pair as a localization requirement.
5. **Never** ship a single masculine form labelled "neutral."
6. **If every neutral candidate reads constructed** → mark the string `OPEN` and resolve it with
   the real interaction. A named product concept may not be needed at all.

---

**`CORRECTED PER PRODUCT DIRECTION FIX-02. THE PATTERNS FREEZE; THE SENTENCES STAY EDITABLE UNDER
THE FOUR CONDITIONS IN FOUNDATION §20.`**
