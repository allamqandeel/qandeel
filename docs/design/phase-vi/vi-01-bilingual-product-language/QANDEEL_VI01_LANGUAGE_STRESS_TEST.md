# QANDEEL — VI-01 · LANGUAGE STRESS TEST

**Status:** `FREEZE CANDIDATE — FIX-03 CONSISTENCY SEAL APPLIED. SYSTEM + SEMANTIC CONTRACTS FROZEN; VOCABULARY APPROVED; MICROCOPY PROPOSED / OPEN AS MARKED`
**Canonical authority:** `docs/design/phase-v/` @ `4e83b1ce2d854f1ba49a6de15572f1025d196647`

Text and table based; no visual design is produced or required. The proposed system is run
against the states the V10 prototype already proved are real, plus the states the canonical
freeze names as open.

**Method.** Each test states the pressure, the strings under test, and a verdict:
**PASS** · **PASS (with rule)** · **FAIL → fixed** · **OPEN**. Character counts are measured, not
estimated. **31 defects were found across all gates — 9 by self-critique, 7 by FIX-01 review, 7 by FIX-02
review, 8 by the FIX-03 consistency seal — and all 31 are fixed.** They are listed in §17 rather than hidden, because a
stress test that finds nothing has not been run.

---

## 1 · 375px label pressure — measured

Threshold used: Arabic ≤ 16 characters and English ≤ 20 characters are safe as chrome at 375px.
Arabic buys less horizontal room per character than Latin at the same size and needs more vertical
room, so the cap is deliberately tight. **No numeric typography value is asserted or frozen here**
— line-height and tracking are VI-03/VI-10 decisions against the final typeface (Foundation
§16.10; §17.3-D30). The character caps are a **language-side length discipline**, and they will be
re-validated once a typeface exists.

| Arabic | ch | English | ch | Verdict |
|---|---|---|---|---|
| «القراءات» | 8 | Readings | 8 | **PASS** |
| «سياق الكلام» *(`APPROVED`)* | 11 | *"In play now" — candidate, wording `OPEN`* | 11 | **PASS** |
| «الكلام» | 6 | Conversation | 12 | **PASS** |
| «المصدر» | 6 | Where this came from | 20 | **PASS** — deliberate divergence |
| «فيه حاجة غلط؟» | 13 | Something not right? | 20 | **PASS** |
| «إرسال التصحيح» | 13 | Send correction | 15 | **PASS** |
| ~~«استبعاد مؤقت»~~ | 12 | ~~Take out~~ | 8 | **length PASS — but wording `OPEN`** *(evaluative / ambiguous, §17-D11)* |
| ~~«تركيز العرض»~~ | 11 | *Bring to front — candidate* | 14 | **length PASS — but wording `OPEN`** *(constructed, §17-D10)* |
| ~~«إرجاع العرض»~~ | 11 | *Put it back — candidate* | 11 | **length PASS — but wording `OPEN`** |
| «إعادة المحاولة» | 14 | Try again | 9 | **PASS** |
| «إغلاق» | 5 | Close | 5 | **PASS** |
| «تسجيل» | 5 | Record | 6 | **PASS** |
| «حاجة من كلامك» | 13 | something you said | 18 | **PASS** |
| «دورها في القراءات» | 17 | Its role in each reading | 24 | **PASS (with rule)** — inline link only, never chrome |
| «المشترك بين القراءات» | 20 | Shared across readings | 22 | **PASS (with rule)** — region heading only, never a control |
| «اللي مسجّل من كلامك» | 19 | what's recorded from what you said | 34 | **PASS (with rule)** — collective form is prose; the countable form carries it in constrained space |

**Verdict on length: PASS.** Every chrome label clears the threshold in both languages, and the
three long forms are non-chrome by design.

**But length was never the binding constraint on three of these rows.** «تركيز العرض»،
«إرجاع العرض» and «استبعاد مؤقت» all fit comfortably and are still wrong — the first two read
constructed, the third reads evaluative. **A label can pass every measurable test and still be
bad copy**, which is why the package now separates *measured* verdicts from *judged* ones and
sends all three to VI-02/VI-03 with the interaction (§17-D10, D11).

**Note on the freeze's open item 7.** The app-bar subtitle truncated at 375px
(«المشهد · قرار الش…»). With «المشهد» retired the subtitle loses its product noun entirely, and
the recommendation is deletion — which matches the freeze's own "probably deletion".

---

## 2 · Long Arabic

Pressure: the V10 dense fixture's longest real strings — a long subject, long statements and long
recorded material simultaneously.

| String under test | Result |
|---|---|
| Subject: «قرار الشغل الجديد واللي وراه من كلام كتير اتقال على مدى شهرين من غير ما يوصل لحاجة» | **PASS.** It is the *subject heading*, not a label; **S05** makes the subject the heading precisely so long subjects have somewhere to live. No product noun competes with it. |
| Reading statement: «اللي بيشدّه ناحية العرض الجديد ده هو إنه عايز يتعلم حاجة مختلفة عن اللي بيعمله كل يوم من سنتين، مش الفلوس ولا المسمّى الوظيفي…» | **PASS.** Analysis prose is unconstrained by label length. The proposed system adds no wrapper noun around it. |
| Provenance disclosure (2 mandatory claims, one sentence pair) | **PASS.** 148 Arabic characters. It lives in a dialog, not inline — **A8** requires *one press away*, which is what makes the length affordable. |
| Removal accessible name: «استبعاد الحاجة دي من سياق الكلام مؤقتاً — مش هتتمسح» | **PASS.** 48 ch. Accessible names are not length-constrained; the visible label is 12 ch. |

**Verdict: PASS.** The system's length discipline is applied to *labels* and deliberately not to
*sentences* — which is the correct split, because Arabic carries meaning in prose more compactly
than in nouns.

---

## 3 · Concise Arabic

Pressure: can the system say the hard things *short* without losing the truth guards?

| Concept | Shortest safe Arabic | ch | Guard retained? |
|---|---|---|---|
| Unknown, open | «لسه ناقصة» | 9 | ✅ no agent, no refusal, no utility claim |
| Correction pending | «لسه ما اتطبّقش» | 13 | ⚠️ **PASS (with rule)** — the short form is legal only where the full object is visible; standalone it must be «لسه ما اتطبّقش على الحاجة المسجّلة» |
| Superseded | «ما بقتش مطروحة» | 14 | ✅ distinct from resolved |
| Peer equality | «بالتساوي» | 8 | ⚠️ **PASS (with rule)** — an adverb alone cannot carry **A2**; the full sentence must appear once per stage |
| No reading | «لسه مفيش قراءة اتكوّنت للموضوع ده.» | 33 | ✅ **and it stops there** — the follow-on sentence that promised a future reading is removed (§17-D12) |
| One reading | «قراءة واحدة» | 11 | ✅ restraint wins; no temporal hedge |
| Non-destructive removal | *wording `OPEN`* | — | ⚠️ the temporary-scope guard must survive into whatever label VI-02/VI-03 chooses |

**Verdict: PASS (with rules).** Three strings shorten safely; two shorten only in the presence of
context, and the condition is now stated at each. **The general rule this test produced:** a
truth guard may never be the word that gets cut for length. Where a string cannot shorten without
dropping its guard, the layout changes, not the copy.

---

## 4 · Natural English — calque check

Pressure: English was authored natively; verify no Arabic structure leaked across.

| Arabic | Proposed English | Literal calque that was rejected |
|---|---|---|
| «دي مش وظيفتي هنا.» | That's not my part in this. | ✗ "This is not my job here." |
| «اللي بيشدّه ناحية العرض» | What's pulling him toward the new job | ✗ "That which pulls him toward the offer" |
| «لسه بدري عليّا أقول لك إني فاهم» | It's too early for me to say I understand this | ✗ "Still early on me to say to you that I am understanding" |
| «وصلني وكلامك ده موجود عندي» | I have this, and what you wrote is here | ✗ "It arrived to me and this your speech is present with me" |
| «مش معروف …» | Not known: … | ✗ "It is not known …" |
| «سياق الكلام» | *"In play now" — candidate, wording `OPEN`* | ✗ "Context of the speech" / ✗ "Current context" |

**Verdict: PASS.** No proposed English string maps clause-for-clause onto its Arabic counterpart.
The last row is the package's model case: mirroring would have produced AI-dashboard English from
perfectly ordinary Arabic.

**Reverse check — does any Arabic look reverse-translated from English?** One did.
«السياق الحالي» was a 1:1 map of "Current context" and was caught in the first critique gate;
re-derived natively as «سياق الكلام», a real Arabic collocation. No other proposed Arabic string
originates from an English draft — Arabic was authored first throughout, from the V10 prototype
rather than from any English source, and **no English product copy exists to have been derived
from**.

---

## 5 · RTL / LTR parity

| Pressure | Result |
|---|---|
| Any string relying on يمين/شمال or left/right | **PASS** — none exists; barred by scaling rule 2. |
| Directional meaning in peer order | **PASS** — peer identity is non-positional by construction. |
| «قدّام» / "front" in the foreground action | **PASS (with rule)** — the word is reader-owned and the state sentence says the change is *in the view*. It is not a locator, and **A23** independently requires a non-spatial equivalent. |
| Locators used as the only reference («فوق»، «تحت», "above", "below") | **PASS** — barred by accessibility rule 6; regions are named, not located. |
| Latin tokens inside Arabic copy (product name, any English term) | **PASS (with rule)** — requires inline `lang="en" dir="ltr"`; a bare span scrambles under bidi and is mispronounced. |
| A22 direction-independence | **PASS** — no relevance vocabulary exists in product copy at all, so there is nothing to mirror. |

**Verdict: PASS.** The system carries **equivalent product meaning** in both directions rather
than mirrored meaning, which is what the canonical direction-independence clause requires.

---

## 6 · Peer scaling — 2 / 3 / 6 / double-digit

Canonical bound: `MAX_ACTIVE_HYPOTHESES = 32` **per user**, **no per-subject cap found**, runtime
**bounded, not unlimited**. A subject's count is therefore bounded but unknown at design time and
can plausibly reach double digits.

| String | n=1 | n=2 | n=3 | n=6 | n=12 | Verdict |
|---|---|---|---|---|---|---|
| «قراءة أ / ب / ج» *(prototype)* | ok | ok | ok | strained | **breaks** | **FAIL → rejected.** Asserts a sequence (**A2**); loses intuitive order well before 32 |
| «اللي في القراءتين» *(prototype)* | n/a | ok | **breaks** | breaks | breaks | **FAIL → rejected.** Count-locked dual |
| «المشترك بين القراءات» | n/a | ok | ok | ok | ok | **PASS** — «بين» is count-safe from 2 up |
| "Shared across readings" | n/a | ok | ok | ok | ok | **PASS** |
| «القراءات» *(route label)* | ⚠ plural at 1 | ok | ok | ok | ok | **PASS (with rule)** — gate all three Arabic numbers: «القراءة» / «القراءتين» / «القراءات» |
| Content-derived reading identity | ok | ok | ok | ok | ok | **PASS** — but see the runtime dependency below |
| «كل القراءات معروضة هنا بالتساوي» | n/a | ok | ok | ok | ok | **PASS** |
| "the other reading" / «القراءة التانية» | n/a | ok | **breaks** | breaks | breaks | **FAIL → rejected** |

**Verdict: PASS, with one OPEN item.** The naming rules survive to double digits. The route label
is the one string that legitimately varies with count, and it is admissible **only** because all
three Arabic number forms are authored — partial gating is the defect, not gating itself.

**OPEN — VI-02 owns the navigation solution, and VI-01 does not pre-solve it** *(FIX-03 §3)*.

**What this test confirms is frozen:** no identity whose order can be mistaken for hierarchy; no
first/second/"the other"; no left/right positional identity; no peer silently omitted, truncated
or made unreachable; navigation position is an accessibility affordance, **not** semantic identity;
and **no runtime short-label contract is requested**.

**What is carried forward as a candidate, not a solution:** identifying a reading from **existing
truthful reading content**. **VI-01 does not prescribe** the opening statement as the final
accessible name, its truncation as the final visible identity, or any final control architecture.
*(An earlier version of this section did prescribe exactly that, which pre-solved the phase's #1
open item from a copy task — §17.3-D26.)*

A runtime-supplied short label is **`DEFERRED POSSIBILITY — NOT REQUESTED`** *(FIX-01 §8)*. VI-02
must first attempt large/double-digit peer navigation with data that already exists.

**Bounded-runtime language check.** No string in the package claims limitless readings, and none
states a per-subject ceiling. Both are barred (Foundation §18). **The stale local Phase V wording
— "the runtime caps nothing" — appears nowhere in the package.**

---

## 7 · One-reading and no-reading states

| State | Arabic | English | Verdict |
|---|---|---|---|
| No reading | «لسه مفيش قراءة اتكوّنت للموضوع ده.» | "No reading has formed for this yet." | **PASS after fix.** Thin data is a valid product state (**A12**) — not an error, not a spinner. |
| ✗ *"When one does, it'll be here."* | ✗ «لما حاجة تتكوّن هتلاقيها هنا.» | — | **FAIL → removed (§17-D12).** This **promised a future formation** — the exact thing this document's own guardrail forbids. It was in the package's own recommended copy. |
| One reading | «قراءة واحدة» | "One reading" | **PASS after fix.** «لحد الآن» / "so far" removed — a temporal hedge doing no work. |
| ✗ «قراءة واحدة بس» / "Only one reading" | — | — | **FAIL → rejected.** "Only" / «بس» adds a deficiency read. |
| ✗ «القراءة التانية لسه بتتكوّن» | — | — | **FAIL → rejected.** Guarantees two. |

**Verdict: PASS after fix — and this was the package's own worst self-inconsistency.** The
one-reading and no-reading states are where copy most naturally reaches for a promise, and the
recommended wording had reached for one. Restraint wins: **state the state and stop.**

---

## 8 · Correction pending

| Pressure | Result |
|---|---|
| Acknowledgement states receipt **and** non-application | **PASS** — both obligations are in the pattern; neither may be dropped. |
| Nothing implies downstream change | **PASS** — «اتطبّق» / "applied" is barred. |
| Pending is a stable state, not a transition | **PASS** — no spinner, no ETA, no "Applying…". |
| Legible with motion disabled | **PASS** — nothing on the correction path animates (**A11**, **D5**). |
| Notice appears once, not repeatedly | **PASS (with rule)** — the state appears at the record it concerns; the V10 repeated-notice defect is a layout rule the copy must not reintroduce. |
| Material/readings/roles/unknowns identical before and after | **PASS** — no copy anywhere states or implies otherwise. |

**Verdict: PASS.**

---

## 9 · Unknowns — open, resolved, superseded

| State | String | Verdict |
|---|---|---|
| OPEN | «مش معروف العرض الجديد بيقدّم إيه بالظبط من ناحية التعلّم.» + «لسه ناقصة» | **PASS.** Specific, agentless, occupies space (**A7**). |
| RESOLVED | «بقت معروفة.» + «مفيش إجابة منك هي اللي غيّرت الحالة دي.» | **PASS (with rule)** — the disclaimer is **mandatory** and travels with the state. Answer-driven gap closure is forbidden. |
| SUPERSEDED | «ما بقتش مطروحة.» | **PASS.** Distinct from resolved; a different outcome, not a better one. |
| Distinguishability | RESOLVED vs SUPERSEDED | **PASS.** ✗ "Closed" / «اتقفلت» would collapse them and is rejected. |
| ✗ refusal reading | «مش هقول» | **FAIL → rejected.** An unknown is missing, never withheld. |
| ✗ utility claim | «السؤال ده مهم» | **FAIL → rejected.** Question utility is forbidden. |

**Verdict: PASS.**

---

## 10 · Provenance disclosure

| Pressure | Result |
|---|---|
| Both mandatory claims present | **PASS** — record date ≠ event date; not a transcription. |
| Identical on all three surfaces | **PASS** — **A19** requires one identity and one provenance line per record. |
| One press away, no metadata overload | **PASS** — **A8**; lives in a dialog. |
| Typography does not contradict the copy | **FAIL → fixed.** The V10 prototype wraps recorded material in guillemets while the line beside it says it is not a transcription. Quotation marks are a verbatim claim, and where copy and typography disagree the typography wins. **Recorded material now renders as plain text in both languages.** |
| Length at 375px | **PASS** — 148 Arabic characters inside a dialog, not inline. |

**Verdict: PASS after fix.** This was the highest-value defect in the package: a truth violation
carried entirely by punctuation, invisible to any copy review that reads only strings.

---

## 11 · Live Context with five items

The freeze's maximum intended handful, and the fixture that produced open item 6.

| Pressure | Result |
|---|---|
| Panel name at 375px | **PASS** — «سياق الكلام» 11 ch (`APPROVED`); English candidates all ≤ 11 ch, wording `OPEN`. |
| Five removal controls, each unambiguous | **PASS on structure, `OPEN` on wording** — each needs an item-specific accessible name completing the non-destructive promise; the visible label is deferred to VI-02/VI-03. |
| Boundary statement present | **PASS** — «دي الحاجات المسجّلة اللي داخلة مع الكلام حالياً، مش كل اللي مسجّل.» This is the guard against reading a bounded selection as a judgement. |
| Boundary statement below the fold at five items | **OPEN** — this is the freeze's open item 6 and is a *layout* question. **Language note for whoever solves it: the boundary statement may not be moved into a tooltip or a disclosure.** It is load-bearing truth, not helper decoration. |
| No relevance implication | **PASS** — no relevance vocabulary exists in the package; production has no client-readable relevance computation. |
| Ordering implies nothing | **PASS (with rule)** — no copy references position or order. |

**Verdict: PASS, with the freeze's own layout item still OPEN and one language constraint added
to it.**

---

## 12 · Voice reconnect and failure

> **`PRINCIPLES TESTED. EXACT STRINGS PROVISIONAL / PHASE VII.`** *(Product Direction, FIX-01
> §12.)* The strings below are tested as *illustrations of the principles*; **none is a freeze
> candidate**, and two are already known to be architecture-dependent.

| Pressure | String | Verdict |
|---|---|---|
| Latency not anthropomorphized | — | **PASS.** ✗ «قنديل بيفكّر» / "Thinking…" — rejected. |
| Drop is process-framed | «الاتصال انقطع. جاري إعادة الاتصال.» | **PASS after fix** — see §17-D7. ✗ "I lost you" assigns fault. |
| Fallback names the alternative | «المكالمة وقفت. الكتابة متاحة.» | **PASS after fix** — see §17-D6. |
| No capability is invented | — | **PASS.** No voice runtime is assumed; Phase VII owns provider qualification. |
| "Live" scope | — | **PASS after fix.** Rejected for today's **context panel**; **`live call` is `PROVISIONAL / PHASE VII`, not false by definition** *(§17.3-D28)*. An earlier row barred it "in `Live Context` and `live call` alike". |
| Mic state names what the architecture does | «بسجّل» / "Recording" | **CANNOT BE TESTED YET (§17-D13).** "Recording" **may be false** if realtime audio is not persistently recorded. |
| "Listening" as a comprehension claim | «بسمعك» / "Listening" | **CANNOT BE TESTED YET (§17-D13).** It is **not automatically** a comprehension claim — it may be a legitimate mechanical microphone/VAD state. An earlier draft rejected it outright; that judgement was premature. |

**Verdict: principles PASS; exact states deferred to Phase VII.** The two rows that cannot be
tested are the reason the whole V-family is `PROVISIONAL` rather than proposed — a copy task
cannot settle a state name for an architecture that does not exist.

---

## 13 · Screen-reader accessible names

Label-in-Name (WCAG 2.5.3): the accessible name must **contain** the visible label so
voice-control users can speak what they see.

| Visible | Accessible name | Contains? |
|---|---|---|
| ⟨removal label — `OPEN`⟩ | «⟨label⟩ من سياق الكلام مؤقتاً — مش هتتمسح» | ✅ **pattern holds whatever the label becomes** |
| ⟨removal label — `OPEN`⟩ | "⟨label⟩ for now — this doesn't delete it" | ✅ pattern holds |
| «المصدر» | **«المصدر — للحاجة دي»** | ✅ **corrected** — see below |
| ~~«المصدر»~~ | ~~«مصدر الحاجة دي»~~ | ❌ **FAILED** — «المصدر» is not present as a contiguous string; «مصدر» alone is a different token *(§17-D24)* |
| "Where this came from" | "Where this came from" | ✅ |
| ⟨foreground label — `OPEN`⟩ | «⟨label⟩ على الحاجة دي» | ✅ pattern holds |
| ⟨foreground label — `OPEN`⟩ | "⟨label⟩ — changes only your view" | ✅ pattern holds |
| «إغلاق» *(scrim)* | «إغلاق سياق الكلام» | ✅ |
| «إرسال التصحيح» | «إرسال التصحيح» | ✅ |

| Additional pressure | Result |
|---|---|
| Accessible name in the same register tier as its visible label | **PASS** — a T1 label with a T2 accessible name is a voice break only screen-reader users hear. |
| Announcements are full sentences, polite, and arrive **after** the state | **PASS** — **B4**; correctness may not depend on an animation frame (**D5**). |
| Icon-only controls have names | **PASS (with rule)** — the scrim is the live example; the prototype already names it. |
| `lang` / `dir` on inline foreign terms | **PASS (with rule)** — required, or the screen reader mispronounces and bidi scrambles. |
| One numeral system everywhere, incl. accessible names | **PASS (with rule)** — the numeral policy itself is **C11**, a Phase VI decision; this rule only binds accessible names to whatever is chosen. |
| Meaning never carried by position alone | **PASS** — **A23**; every spatial statement has a sentence carrying the same meaning. |

**Verdict: PASS.** Note that the three `OPEN` labels do not weaken this test: **Label-in-Name is a
pattern constraint, not a string constraint**, and it holds for any label VI-02/VI-03 chooses —
which is precisely why deferring the wording costs the accessibility contract nothing.

---

## 14 · Gender-neutrality pass — every fixed string

Policy: fixed copy gender-neutral by default; never a masculine form labelled "neutral"
(Foundation §3.6).

| Category | Strings | Neutral? | Natural? |
|---|---|---|---|
| Primary actions | «القراءات»، «سياق الكلام»، «إرسال التصحيح» | ✅ 3/3 | ✅ conventional |
| Secondary actions | «المصدر»، «دورها في القراءات»، «إغلاق» | ✅ 3/3 | ✅ conventional |
| Correction | «فيه حاجة غلط؟»، «إرسال التصحيح» | ✅ 2/2 | ✅ |
| Composer | «رسالتك لقنديل»، «كلامك هنا» | ✅ 2/2 | ✅ `-ك` possessive |
| States | all of T01–T13 | ✅ 13/13 | ✅ object-focused |
| Foreground state sentence | «الحاجة دي قدّام حالياً باختيارك…» | ✅ | ✅ agent rewritten out; `-ك` retains reader agency (**A9**) |
| Retry | «إعادة المحاولة» | ✅ | ✅ conventional |
| **Foreground / return actions** | ~~«تركيز العرض»، «إرجاع العرض»~~ | ✅ neutral | ❌ **constructed — `OPEN`** |
| **Removal action** | ~~«استبعاد مؤقت»~~ | ✅ neutral | ❌ **evaluative — `OPEN`** |
| Voice | V01–V07 | ✅ | *(not assessed — `PROVISIONAL / PHASE VII`)* |

**Result: no fixed string is masculine-as-default, and zero `AR-M`/`AR-F` variant pairs are
required. But three labels reached neutrality at an unacceptable cost to naturalness and are now
`OPEN` rather than shipped.**

**Did neutrality make any Arabic bureaucratic? YES — in three labels, and that is the finding.**
*(This corrects an earlier claim in this document that the package had proved neutrality carried
no naturalness cost. It had not.)* The masdar convention is genuinely conventional for most
controls («حفظ»، «إلغاء»، «إرسال»), and `-ك` possessives keep second-person intimacy — so most
strings cost nothing. **But «تركيز العرض» and «إرجاع العرض» read constructed and technical, and
«استبعاد مؤقت» carries an evaluative overtone that is undesirable near A15 semantics.** Reaching a
"35/35 neutral" score was the wrong objective; **neutrality is a constraint, not the copy
objective** (Foundation §3.6.2). One string flattened acceptably and is kept: «شوف دورها في
القراءات» → «دورها في القراءات».

**Where the cost is real: T2 voice.** Egyptian perfect verbs and participles addressed to the
user («قلت»، «مضايقاك») are the forms the dialect writes out, and they carry the prototype's
warmest lines. Neutrality there is achievable but measurably flattening. This is why Foundation
§19.1 recommends *neutral by default, gendered on an explicit stored preference* — the only
option that satisfies the policy without permanently costing the voice.

**Any gendered reusable string missing a variant rule?** **No.** No fixed string in the package is
gendered, so no variant pair is outstanding. The rule that governs future ones is stated at Copy
Patterns **P-gender** step 4.

---

## 15 · One Arabic, two registers — the v1 architecture

> **This section previously tested a dual `AR-EG` / `AR-NEUTRAL` chrome-profile requirement.
> That requirement is withdrawn as premature scope expansion** *(Product Direction, FIX-01
> §2.2)*. **v1 ships one Arabic product language.** What follows tests what actually ships.

| Key | Fixed copy *(neutral contemporary)* | Same idea in QANDEEL's voice *(restrained Egyptian)* |
|---|---|---|
| `context.panel.title` | «سياق الكلام» | «اللي معانا دلوقتي» |
| `correction.send` | «إرسال التصحيح» | «ابعتلي اللي غلط» |
| `readings.shared` | «المشترك بين القراءات» | — *(analysis stays flat)* |
| `system.retry` | «إعادة المحاولة» | «جرّب تاني» |
| `state.no_reading` | «لسه مفيش قراءة اتكوّنت للموضوع ده.» | — *(analysis stays flat)* |
| `provenance.action` | «المصدر» | — |

**Verdict: PASS.** The register split is *functional* — fixed copy vs QANDEEL speaking — not
geographic, and it is what any well-made Arabic product does. No string is authored twice, and no
duplicate fixed-copy set is QA'd.

**Where the G-gates land now.** **G1 comprehension is a hard gate on every tier**: «شغّال»
*(running)* fails it, which is why «الشغّال دلوقتي» cannot be rescued by reclassifying it as
voice. **G2 market-neutral flavour applies to fixed copy only**: «دلوقتي» passes G1 but not G2, so
it belongs to the voice and not to a label. *(An earlier draft made G2 a property of a second
profile and used "has no `AR-NEUTRAL` counterpart" as the decisive argument against
«الشغّال دلوقتي». That framing is withdrawn; the term fails on its own terms — §17-D14.)*

**Future localization is a principle, not a v1 deliverable.** Strings are addressed by semantic
key so a later `ar-SA` variant is a locale addition rather than a rewrite (Foundation §3.3).

### 15.1 · Fixed-copy register audit — the package's own contradiction

*(Required by Product Direction FIX-02 §6.2. Scope: only strings that were `APPROVED`, `RETAIN`
or listed as approved core vocabulary. Historical prototype quotations are **not** rewritten —
they are evidence, and they are labelled as such throughout.)*

**The contradiction found.** The package declared all fixed copy neutral contemporary Arabic,
then approved fixed strings written in Egyptian — «لسه ناقصة»، «مش معروف …»، «بتسند»، «وصلني»،
«مفيش حاجة داخلة مع الكلام». **Both statements could not survive freeze.**

**How it was resolved — and how it was *not*.** It was **not** resolved by rewriting those
sentences into MSA; that produces exactly the bureaucratic copy the gender pass already showed is
the wrong trade. It was resolved by **splitting T3** (Foundation §3.1): the analysis surface holds
**labels** (T3a, neutral) and **sentences restating the user's own words** (T3b, voice register).
Then every freeze-candidate string was re-scored.

| Freeze-candidate string | Tier | Verdict |
|---|---|---|
| «القراءات»، «قراءة» | T1/T3a | ✅ `APPROVED` — MSA nominal, no inflection |
| «الكلام» | T1 | ✅ `APPROVED` |
| «سياق الكلام» | T1 | ✅ `APPROVED` — MSA collocation |
| «المشترك بين القراءات» | T3a | ✅ `APPROVED` |
| «المصدر»، «تاريخ التسجيل»، «التصحيح» | T1/T3a | ✅ `APPROVED` |
| «إغلاق»، «إعادة المحاولة»، «إرسال التصحيح»، «تصحيح» | T1/T4 | ✅ `APPROVED` — masdars |
| «دورها في القراءات» | T1 | ✅ `APPROVED` |
| **«بتسند» / «بتعارض»** | **T3a** | ⚠️ **`PROPOSED`** — colloquial `بـ-` prefix in repeated analysis chrome. Leading neutral: «تسند»/«تعارض». **«تدعم» considered and not recommended** — «دعم» leans to funding/endorsement, edging toward advocacy against **A5** |
| **«مش معروف …»** | **T3a lead-in + T3b body** | ⚠️ **`PROPOSED`** — «غير معروف: …» is the cleaner neutral lead-in and is natural, not stiff; but it sets a neutral label against colloquial prose. The seam is a rendered-surface call |
| **«اللي مسجّل من كلامك»** | T3a/T3b | ⚠️ **`PROPOSED`** — «المسجّل من كلامك» is tighter and neutral; «اللي» version is warmer |
| **«لسه ناقصة»، «بقت معروفة»، «ما بقتش مطروحة»** | T3a state labels | ⚠️ **`PROPOSED`** — repeated labels carrying G2 flags |
| **«وصلني»، «لسه ما اتطبّقش…»** | T2/T3b | ⚠️ **`PROPOSED`** — first-person voice; register is defensible, naturalness uncertified |
| **«لسه مفيش قراءة اتكوّنت…»، «مفيش حاجة داخلة مع الكلام»** | T3a | ⚠️ **`PROPOSED`** — «مفيش» carries a G2 flag |
| **«مفترضة إن»** | T3a | ⚠️ **`PROPOSED`** |

**Result: 11 strings confirmed `APPROVED`; 8 demoted to `PROPOSED` with semantics frozen.**

**Verdict: PASS — and the demotions are the honest outcome, not a failure.** Every demoted string
has a **frozen semantic contract** and an open sentence. The alternative — inventing confidence
about Arabic naturalness I cannot verify from the page — would have produced a freeze that reads
authoritative and is partly guesswork. **The common property of the 11 that survived is
structural, not lucky: each is a short MSA-lexeme nominal carrying no dialect inflection**, which
is exactly why they are register-safe in fixed copy.

**Did neutrality get forced anywhere in this pass? No.** No string was rewritten into stiff MSA to
satisfy the flavour gate. Where the neutral form was clearly better it is named as the leading
candidate; where it was not clearly better, the decision was deferred rather than made.

---

## 16 · Cross-document coherence

| Check | Result |
|---|---|
| Every term in Copy Patterns appears in the Matrix with the same recommendation | **PASS** |
| Every rejection in the Rejection Log has a semantic/structural/truth reason, not a taste reason | **PASS** — 100% |
| No term is `RETAIN` in one document and `REJECT` in another | **PASS** |
| High-impact concepts all carry the A/B/C treatment | **PASS** — 11 concepts, no overlap between documents: Deep Analysis, Live Context, Home, subject anchor *(Foundation §7)*; Conversation, reading, recorded material, shared material, unknown, provenance, foreground *(Matrix Part 3)* |
| No document freezes a high-impact name | **PASS** — each carries `PROPOSED`, `APPROVED` *(Product Direction)*, or `OPEN` |
| **No dual `AR-EG` / `AR-NEUTRAL` v1 requirement remains** | **PASS** — verified by search; remaining mentions are the withdrawal notices and the voice-register column |
| **No rationale claims A15 forbids spatial meaning, or that A19 forbids naming a surface** | **PASS** — both withdrawn in Foundation §7.1, Matrix S04, Rejection Log §1.1 |
| **No global rule forbids a legitimate future QANDEEL capability** | **PASS** — the non-conclusion rule is scoped to Deep Analysis and to unsupported certainty; advisory language is Class B |
| **No empty-state sentence promises a future reading** | **PASS** — the promising clause is removed everywhere |
| **No new runtime reading-label contract is implied as approved** | **PASS** — `DEFERRED POSSIBILITY — NOT REQUESTED` in Foundation §10.2, Matrix O03, and §6 here |
| **Semantic hard bans are separated from current-vocabulary preferences** | **PASS** — Rejection Log Class A / Class B; Foundation §17 |
| Duplicate `PART 3` heading in the Matrix | **NOT PRESENT** — 16 headings, zero duplicates. The reported duplicate does not exist; the cross-reference that likely caused the misread is now an explicit split table |
| **No `Freeze nothing yet` remains** | **PASS** — verified by search |
| **Deep Analysis decision status consistent everywhere** | **PASS** — `APPROVED` in Foundation §7.1, Matrix S04/S06, §20 Tier 2 |
| **No "right answer / v1 answer / v1 solves" pre-solves reading navigation** | **PASS** — verified by search across all five files |
| **Class A contains only false/unsupported claims** | **PASS** — four authorities; internal vocabulary and peer labels moved out |
| **Internal vocabulary is not called false** | **PASS** — Authority B states explicitly that these terms may be true |
| **Peer-label rejection not misclassified as runtime falsehood** | **PASS** — Authority C, with the narrower order-can-be-mistaken-for-hierarchy claim |
| **Relevance ban scoped to A22 runtime-derived relevance** | **PASS** — Foundation §18, Rejection Log §7 |
| **Every Label-in-Name example literally contains the visible string** | **PASS after fix** — re-run mechanically over all displayed-label/accessible-name pairs |
| **No numeric line-height frozen by VI-01** | **PASS** — carried to VI-03 / VI-10 |
| **No global "errors never apologize"** | **PASS** — scoped in Copy Patterns P11 and Foundation §15.3 |
| **Correction gratitude not treated as inherently false** | **PASS** — tone/restraint choice |
| **Realtime "live" Phase VII-dependent everywhere** | **PASS** — 4 sites corrected |
| **OPEN strings not used as canonical rule examples** | **PASS** — action-vocabulary rule stated abstractly; accessibility examples use `⟨visible label⟩` |
| **Counts agree across files** | **PASS** — 59 concept rows, one formulation in Foundation §6 and the Matrix header |
| Stale "runtime caps nothing" wording absent | **PASS** — verified by search across all five files |
| Register tier assigned to every string | **PASS** |

---

## 17 · Defects found and fixed

Nine, all corrected in the package. Four were found by the first critique gate, one by the
canonical authority gate, four by this stress test and the final package critique.

| # | Defect | Where | Fix |
|---|---|---|---|
| D1 | English "Current context" reads as a model's context window — AI-dashboard register | first gate | English diverges to "In play now"; became the model transcreation case |
| D2 | «السياق الحالي» was a 1:1 map of the English — reverse-translated | first gate | Re-derived natively as «سياق الكلام», which also unifies a term the product split in two |
| D3 | Blanket ban on count-varying labels — wrong for Arabic's three-number system | first gate | Gating admissible if singular, dual and plural are **all** authored; partial gating is the defect |
| D4 | Guillemets around recorded material assert verbatim, contradicting the provenance line | first gate | Recorded material renders unquoted; added as a banned pattern |
| D5 | "Reading count is unbounded" — the stale pre-PR#186 claim | canonical gate | Corrected; **two new guardrails gained** — no limitless-readings copy, no per-subject ceiling |
| D6 | «المكالمة مش شغّالة دلوقتي» used «شغّال» *(running)* — a word the package's own transparency test bars — and «تقدر تكمّل» is a gendered verb | this test | → «المكالمة وقفت. الكتابة متاحة.» |
| D7 | «الاتصال اتقطع. بحاول أرجّعه.» put a system event in QANDEEL's first person and in EG-flavoured chrome | this test | → «الاتصال انقطع. جاري إعادة الاتصال.» A dropped call is a system event, not something QANDEEL did |
| D8 | «دلوقتي» appeared in four proposed T3/T4 strings, violating the package's own register law | this test | → «حالياً» throughout; prototype citations of the *rejected* term left intact |
| D9 | The transparency test's stated rule ("about comprehension, not nativeness") contradicted its own verdict table, which failed «دلوقتي» on flavour | final critique | Split into **G1 comprehension** *(all tiers)* and **G2 fixed-copy flavour** *(T1 chrome, T3a analysis chrome, T4 system)*; every word re-scored. *(Originally written against the since-withdrawn `AR-NEUTRAL` profile; restated in current architecture terms — FIX-03 §12.)* |

**D8 and D9 are the ones worth noting.** Both are the package failing its own rules rather than
failing an external standard — which is the only kind of defect a self-authored language system
can be trusted to surface, and the reason the rules were written as tests rather than as
principles.

### 17.1 · Defects found by independent Product/Creative Direction review (FIX-01)

Seven more, all corrected. **These are the ones the package could not find in itself**, because
each came from over-applying a rule the package believed in.

| # | Defect | Class of error | Fix |
|---|---|---|---|
| D10 | «تركيز العرض» / «إرجاع العرض» shipped as recommendations. Grammatically neutral, semantically defensible, **and constructed** | Neutrality treated as the objective rather than a constraint | Both `OPEN — VI-02/VI-03`. No replacement synonym invented. Rule added: if a neutral rewrite is bureaucratic, redesign the interaction or leave the string open |
| D11 | «استبعاد مؤقت» / "Take out" shipped as recommendations. «استبعاد» reads as rejection/judgement — undesirable near **A15**; "Take out" is ambiguous alone | Same class as D10 | Both `OPEN`. Semantics stay locked; the temporary-scope requirement is carried forward |
| D12 | *"When one does, it'll be here."* appended to the no-reading state | **Self-inconsistency** — the package's own guardrail forbids promising a reading will form | Removed. One-reading state also drops "so far" / «لحد الآن». Stop at the state |
| D13 | Voice strings V01–V07 presented as proposals; "Listening" rejected outright as a comprehension claim | Deciding for an architecture that does not exist | All `PROVISIONAL / PHASE VII`. "Recording" flagged as possibly false; "Listening" flagged as possibly a legitimate mechanical state |
| D14 | Dual `AR-EG` / `AR-NEUTRAL` chrome profiles made a **v1 shipping requirement**, and used as the decisive argument against «الشغّال دلوقتي» | Premature scope expansion — and a rejection resting on it | One Arabic in v1; profiles reduced to a future-localization principle. The term is rejected on its own grounds (§1.2 of the log) |
| D15 | «المشهد» rejected partly because "**A15** forbids spatial meaning" and it "contradicts **A19**"; "Deep Analysis" rejected partly because "Analysis" implies a conclusion | **Overstating a Phase V prohibition.** A15 bars encoding *confidence/rank/strength/certainty/importance*, and A22 deliberately **reserves** a spatial semantic; A19 does not forbid naming a surface | All three claims withdrawn. Five product reasons carry the rejection, and they are stronger for not overreaching |
| D16 | *"QANDEEL does not conclude, rank, recommend or resolve"* stated as global product philosophy; rejection log ran every category at absolute authority | **A copy task shrinking future product scope** | Rule scoped to Deep Analysis and unsupported certainty; rejection log split into Class A (hard bans) and Class B (current-vocabulary preferences, revisitable) |

**The pattern in D10–D16 is worth naming: every one is a rule applied past its warrant.** D10 and
D11 pushed a real constraint (gender neutrality) into a domain it should not govern (copy
quality); D14, D15 and D16 pushed real constraints (market reach, Phase V truth boundaries,
non-conclusion) beyond what the evidence supported. A self-critique can catch a rule being
*broken*; it is much weaker at catching a rule being **over-obeyed**, which is what independent
review is for.

### 17.2 · Defects found by Product/Creative Direction review of the post-FIX-01 package (FIX-02)

Seven more, all corrected. The first three are **decision-state drift** — the executive summary
was never updated when later sections were corrected, so the document disagreed with itself.

| # | Defect | Class | Fix |
|---|---|---|---|
| D17 | Executive rec 2 still made "no neutral-Arabic counterpart" the **decisive** argument against «الشغّال دلوقتي» — the exact framing withdrawn in §3.3 | Stale decision state | Rewritten to the four reasons that stand on their own: meaning collision with «شغل», sentence-like label, unnecessary split from «سياق», Egypt-specific flavour in a repeated fixed label |
| D18 | Executive rec 3 stated **"English takes 'In play now'"** while §7.2 marked the wording `OPEN` | Stale decision state | Executive now states the divergence is frozen and the **string is `OPEN`**; audited all five files — every remaining use is labelled candidate or test string |
| D19 | Executive rec 6 declared reading identity **"must be content-derived"** — stronger than the deferred handoff | Stale decision state | Freezes only the four prohibitions; content-derived identity is now **"the first direction to test in VI-02"**, and the runtime label stays `DEFERRED POSSIBILITY — NOT REQUESTED` |
| D20 | *"QANDEEL never grants, awards, unlocks, guides, or congratulates"*; *"never apologize"*; *"never praise"*; *"the only shape a QANDEEL question ever takes"* | **Copy task shrinking future product scope** | All four scoped: no manufactured authority/status/achievement, but **guidance and advice are permitted where the capability's contract supports them**; apology allowed for real user-impacting failure; acknowledgement allowed when grounded in a real event; a question needs a concrete information purpose, not one fixed shape |
| D21 | **"AI-powered" classified as a capability overclaim (Class A)** | **Factually wrong classification** — QANDEEL *is* an AI product | Moved to Class B with «ذكاء», "intelligent", "smart", "insights", «تحليل عميق». Class A narrowed to claims about what the system *knows or did* |
| D22 | **"Live" stated as claiming realtime computation the runtime does not have** | Over-broad truth claim | Reclassified as a current-vocabulary rejection for the context panel; realtime usage is Phase VII-dependent, not inherently false |
| D23 | **"Summary" implies a conclusion QANDEEL does not draw** | Style preference stated as a truth rule | Corrected: **a summary can summarise alternatives without forcing a winner.** "Summary"/"Analysis" are Class B current-vocabulary choices |

**Plus the register audit (§15.1):** the package's declared fixed-copy register contradicted eight
of its own approved strings. Resolved by splitting T3 rather than by forcing MSA; 8 strings
demoted to `PROPOSED` with semantics frozen.

**What D17–D19 teach that D10–D16 did not.** Those were rules over-obeyed. **These are simply
edits that were never propagated** — three corrections landed in detail sections while the
executive summary kept the old decision. A long document can be individually correct in every
section and still disagree with itself, and the summary is where that shows first. **Any future
correction round must re-read the executive section last, on principle.**

### 17.3 · Defects found by the final consistency seal (FIX-03)

Eight more, all corrected. **D24 is the most serious defect in the whole package**, because it is
the one that would have shipped a real accessibility failure rather than a documentation problem.

| # | Defect | Class | Fix |
|---|---|---|---|
| **D24** | **The Arabic Label-in-Name example failed its own rule.** Visible «المصدر» → accessible «مصدر الحاجة دي». **The definite «المصدر» is not present as a contiguous string** — «مصدر» is a different token — so the pair violates **WCAG 2.5.3**, which the same rule invoked | **Real accessibility failure**, not documentation drift | → **«المصدر — للحاجة دي»**. Added the Arabic-specific rule: repeat the label in its **exact surface form, article included**, then add the clarifier after it. Arabic hides this trap — prefixing «ال» or entering an iḍāfa silently breaks the required substring |
| D25 | Executive rec 10 still said **"Freeze nothing yet — every naming decision is PROPOSED"**, contradicting the document status, §20's three tiers, and the Matrix's approved rows. §7.1 still ended `PROPOSED — REQUIRES APPROVAL` for a decision Product Direction had approved | Stale decision state | Executive rec 10 now states the actual three-tier policy; §7.1 reads `APPROVED` |
| D26 | Foundation §10.2, Matrix O03 and Stress Test §6 said **"the right answer is…", "the v1 answer…", "v1 solves this…"**, and prescribed the opening statement as accessible name and its truncation as visible identity | **A copy task pre-solving the phase's #1 open item** | Reduced to six frozen constraints; content-derived identity is now **the first direction to test in VI-02**, and no control architecture is prescribed |
| D27 | The Rejection Log defined Class A as *false/unsupported*, then filed **engineering vocabulary, reviewer chrome and peer-labelling schemes** inside it — none of which is a false statement. It also claimed **every sequence inherently equals rank** | Taxonomy contradicting its own definition; over-broad canonical claim | Four authorities: **A truth hard ban · B `INTERNAL ONLY` · C product/structural · D current-vocabulary**. Peer labels moved to **C**, with the narrower true claim: no identity **whose order can be mistaken for hierarchy**, breaks bilingual/accessible navigation, or becomes the identity itself |
| D28 | Residual absolutes treating **"live"/"live call"** as inherently false, after FIX-02 established otherwise | Over-broad truth claim | Context panel rejection stands; **call/realtime naming is `PROVISIONAL / PHASE VII`** in Foundation §14, §17 D, Matrix V02, Copy Patterns P13 and the voice table |
| D29 | Foundation §18 banned **"relevance vocabulary at all"** | Scope creep — **A22** gates *runtime-derived contextual-relevance representation inside Live Context*, not an English word | Scoped to the actual claim: copy must not say items were **selected, ordered, positioned or surfaced by computed relevance**. **A15** non-equivalence intact |
| D30 | Accessibility rule froze **`line-height ≥ 1.6`** — a numeric typography value, in a task that explicitly does not decide typography and has no final typeface | Out-of-scope freeze | Removed from Tier 1; carried to **VI-03 Typography** and **VI-10 RTL/LTR + Accessibility Validation** as a requirement to validate. "No letter-spacing on Arabic" reframed as an implementation guard |
| D31 | Three residual absolutes and two stale counts: *"errors never apologize"* (contradicting §15.3), correction-gratitude treated as a truth violation, `"Take out"` used as the canonical action-vocabulary example while `OPEN`, "34 audited concepts" vs "48 rows" | Contradictions and drift | Apology and gratitude scoped to tone choices; the action-vocabulary rule stated abstractly with a `⟨visible label⟩` placeholder; **one count everywhere: 59 concept rows (41 YES · 6 CONTEXTUAL · 12 NO; 8 `INTERNAL ONLY`)** |

**What FIX-03 teaches.** D25, D26 and D31 are propagation failures again — the same class as
D17–D19, which the package had already named and still repeated. **D24 is different and worse:**
an accessibility rule that its own worked example violated, in the one language where the
violation is hard to see. **A rule stated in English and illustrated in Arabic needs the Arabic
example checked as a string, not as a meaning** — that is now the standing instruction.

---

**`STRESS TEST COMPLETE — THE RULES HOLD. 31 DEFECTS FOUND ACROSS ALL GATES; 31 FIXED.
ONE WAS A REAL WCAG 2.5.3 FAILURE IN THE PACKAGE'S OWN ARABIC EXAMPLE (D24).
11 TERMS APPROVED; 8 PROPOSED WITH SEMANTICS FROZEN; CONTROL LABELS, READING IDENTITY AND VOICE
STATES OPEN RATHER THAN FORCED.`**
