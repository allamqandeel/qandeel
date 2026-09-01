# QANDEEL — VI-01 · TERMINOLOGY MATRIX

**Status:** `FREEZE CANDIDATE — FIX-03 CONSISTENCY SEAL APPLIED. ROWS ARE APPROVED / PROPOSED / OPEN / PROVISIONAL AS MARKED`
**Canonical authority:** `docs/design/phase-v/` @ `4e83b1ce2d854f1ba49a6de15572f1025d196647`
**Companion to:** `QANDEEL_VI01_BILINGUAL_PRODUCT_LANGUAGE_FOUNDATION.md`

The matrix is split into **two tables keyed by the same Concept ID** — Part 1 carries identity
and decision, Part 2 carries rationale and risk — because a single fifteen-column table is
unreadable at any width, and an unreadable reference document does not get used.

**Register tiers** (Foundation §3.1): `T1` chrome · `T2` QANDEEL's voice · **`T3a` analysis
chrome** (labels, region and state names — neutral) · **`T3b` analysis prose** (sentences about
the user's own material — voice register) · `T4` system. **One Arabic product language in v1** —
no second chrome profile (Foundation §3.3).

> **Status vocabulary after FIX-02.** `APPROVED` = frozen as core vocabulary. `PROPOSED` =
> **semantics frozen, exact Arabic still open** pending the native product-language pass — this is
> the honest status for colloquially-inflected sentences whose naturalness cannot be certified
> from the page. `OPEN` = wording deferred to VI-02/VI-03 with the real interaction.
> `PROVISIONAL / PHASE VII` = depends on an architecture that does not exist.
> **A `PROPOSED` row is not a defect** — Foundation §20 makes microcopy editable under frozen
> semantic contracts by design.

**Gender:** no fixed Arabic string below is masculine-as-default. The `G` column flags the
technique where one was needed — `M` masdar, `P` `-ك` possessive, `O` object-focused, `—`
neutral with no intervention. **Neutrality is a constraint, not the copy objective**
(Foundation §3.6.2): where a neutral rewrite turned constructed or evaluative, the string is
`OPEN` rather than forced — see A03, A04, A08.

**Not every row has a user-facing term, and that is the point.** **59 concept rows** — one row per
concept, the single count this package uses (Foundation §6 states the same figure). By
visible-label need: **41 `YES` · 6 `CONTEXTUAL` · 12 `NO`.** Eight carry the status
`INTERNAL ONLY`.

---

# PART 1 — Identity and decision

## Core surfaces

| ID | Internal concept | Visible label? | Prototype AR | Prototype EN | Proposed AR | Proposed EN | G | Status |
|---|---|---|---|---|---|---|---|---|
| S01 | Home surface | **NO** | — *(sr-only «قنديل»)* | — | *no product noun* | *no product noun* | — | `INTERNAL ONLY` |
| S02 | Conversation | **YES** | «الكلام» | — | «الكلام» | Conversation | — | `APPROVED` |
| S03 | Live Context | **CONTEXTUAL** | «الشغّال دلوقتي» | *(none — reviewer term "Live Context")* | **«سياق الكلام»** | *"In play" / "In play now"* | — | AR `APPROVED` · **EN `OPEN`** |
| S04 | Deep Analysis | **CONTEXTUAL** | «المشهد» | *(none — reviewer term "Deep Analysis")* | «القراءات» *(contents, not container)* | Readings | — | `APPROVED` |
| S05 | Deep Analysis surface heading | **NO** | «المشهد · قرار الش…» | — | *the subject itself* | *the subject itself* | — | `PROPOSED` |
| S06 | Paged peer stage | **NO** | «مساحات المشهد» | — | «القراءات» *(region name)* | Readings | — | `APPROVED` |

## Understanding objects

| ID | Internal concept | Visible label? | Prototype AR | Prototype EN | Proposed AR | Proposed EN | G | Status |
|---|---|---|---|---|---|---|---|---|
| O01 | Subject anchor | **NO** | «الكلام داير حوالين» | — | *renders as the subject text* | *renders as the subject text* | — | `INTERNAL ONLY` |
| O02 | Reading (peer reading) | **YES** | «قراءة» / «القراءات» | — | «قراءة» / «القراءات» | reading / readings | — | `APPROVED` |
| O03 | Reading identity label | **CONTEXTUAL** | «قراءة أ / ب / ج» ✗ | — | *not prescribed here — VI-02 owns it* | *not prescribed here — VI-02 owns it* | — | **`OPEN` — VI-02 OWNS THE NAVIGATION SOLUTION**; short label is `DEFERRED POSSIBILITY — NOT REQUESTED` |
| O04 | Recorded material — collective | **YES** | «اللي مسجّل من كلامك» | — | «اللي مسجّل من كلامك» / «المسجّل من كلامك» | what's recorded from what you said | P | semantics `FROZEN` · AR `PROPOSED` |
| O05 | Recorded material — countable | **YES** | «حاجة من كلامك» | — | «حاجة من كلامك» | something you said | P | semantics `FROZEN` · AR `PROPOSED` |
| O06 | Shared material — region | **YES** | «المشترك» / «اللي في القراءتين» ⚠ | — | «المشترك بين القراءات» | Shared across readings | — | `APPROVED` |
| O07 | Supporting role | **YES** | «بتسند» | — | «تسند» *(leading)* / «بتسند» *(incumbent)* | **supports** *(frozen)* | — | semantics `FROZEN` · AR `PROPOSED` |
| O08 | Contradicting role | **YES** | «بتشدّ ضد» ✗ | — | «تعارض» *(leading)* / «بتعارض» *(incumbent)* | **contradicts** *(frozen)* | — | semantics `FROZEN` · AR `PROPOSED` |
| O09 | Assumptions | **YES** | «مفترضة إن» | — | «مفترضة إن» | assumes that | — | semantics `FROZEN` · AR `PROPOSED` |
| O10 | Disconfirming conditions | **NO** | «اللي يخلّيها محتاجة مراجعة» | — | *conditional sentence, no noun* | *conditional sentence, no noun* | O | `INTERNAL ONLY` |
| O11 | Named unknown / information gap | **YES** | «مش معروف …» / «لسه ناقصة» | — | «مش معروف …» / «غير معروف: …» | **Not known: …** *(frozen)* | O | pattern `FROZEN` · AR `PROPOSED` |
| O12 | Provenance | **NO** *(noun)* / action only | — | — | «المصدر» | Where this came from | — | `APPROVED` |
| O13 | Record date | **CONTEXTUAL** | «تاريخ تسجيل» | — | «تاريخ التسجيل» | recorded on | — | `APPROVED` |
| O14 | User-activated context item | **CONTEXTUAL** | «سياق انت فعّلته» | — | «سياق بتفعيلك» | context you turned on | P | `PROPOSED` |
| O15 | Foreground / focus | **NO** *(noun)* / action only | «مرفوعة قدّام» | — | *state sentence, no noun* | *state sentence, no noun* | O | `INTERNAL ONLY` |
| O16 | Correction | **YES** | «التصحيح» | — | «التصحيح» | correction | — | `APPROVED` |
| O17 | Peer equality | **NO** | «معروضين هنا بالتساوي» | — | *geometry + one sentence* | *geometry + one sentence* | — | `INTERNAL ONLY` |
| O18 | Material category / status | **NO** | — | — | — | — | — | `INTERNAL ONLY` |
| O19 | Contextual relevance | **NO** | — | — | **barred from product copy** | **barred from product copy** | — | `INTERNAL ONLY` |

## Core actions

| ID | Internal concept | Visible label? | Prototype AR | Prototype EN | Proposed AR | Proposed EN | G | Status |
|---|---|---|---|---|---|---|---|---|
| A01 | Open Live Context | **YES** | «افتح المشهد» / drawer | — | «سياق الكلام» | *"In play" — candidate* | M | AR `APPROVED` · EN `OPEN` |
| A02 | Close Live Context | **YES** | «اقفل الشغّال دلوقتي» | — | «إغلاق» | Close | M | `APPROVED` |
| A03 | Bring forward / focus | **YES** | «هاتها قدّام» | — | ~~«تركيز العرض»~~ *(rejected — constructed)* | *"Bring to front" — candidate* | — | **`OPEN` — VI-02/VI-03** |
| A04 | Return / undo focus | **YES** | «رجّعها مكانها» | — | ~~«إرجاع العرض»~~ *(not approved)* | *"Put it back" — candidate* | — | **`OPEN` — VI-02/VI-03** |
| A05 | Inspect provenance | **YES** | — | — | «المصدر» | Where this came from | — | `APPROVED` |
| A06 | Start a correction | **YES** | «فيه حاجة مش مظبوط؟» | — | «فيه حاجة غلط؟» | Something not right? | O | `PROPOSED` |
| A07 | Send a correction | **YES** | «ابعت التصحيح» | — | «إرسال التصحيح» | Send correction | M | `APPROVED` |
| A08 | Remove from current context | **YES** | «شيلها من الشغّال» | — | ~~«استبعاد مؤقت»~~ *(evaluative overtone)* | *"Take out" — ambiguous alone* | — | **`OPEN` — VI-02/VI-03** *(semantics approved)* |
| A09 | See role in readings | **YES** | «شوف دورها في القراءات» | — | «دورها في القراءات» | Its role in each reading | M | `APPROVED` |
| A10 | Compose / continue | **YES** | «اكتب لقنديل» / «كمّل الكلام» | — | «رسالتك لقنديل» *(label)* · «كلامك هنا» *(placeholder)* | Your message to Qandeel · Write here | P | `PROPOSED` |
| A11 | Open the readings | **YES** | «افتح المشهد» | — | «القراءات» | Readings | M | `APPROVED` |
| A12 | Start new conversation | **CONTEXTUAL** | — | — | «كلام جديد» | New conversation | — | `PROPOSED` ⚠ |
| A13 | Refuse to decide | **NO** *(voice, not a control)* | «دي مش وظيفتي هنا.» | — | «دي مش وظيفتي هنا.» | That's not my part in this. | — | `RETAIN` |

## System / truth states

| ID | Internal concept | Visible label? | Prototype AR | Prototype EN | Proposed AR | Proposed EN | G | Status |
|---|---|---|---|---|---|---|---|---|
| T01 | Loading | **YES** | — | — | «جاري التحميل» | Loading | O | `PROPOSED` |
| T02 | Unavailable | **YES** | — | — | «مش متاح حالياً» | Not available right now | O | `PROPOSED` |
| T03 | Retry | **YES** | — | — | «إعادة المحاولة» | Try again | M | `APPROVED` |
| T04 | Partial data | **YES** | — | — | «فيه جزء ما وصل» | Some of this didn't load | O | `PROPOSED` |
| T05 | No reading yet | **YES** | «لسه مفيش قراءة اتكوّنت» | — | «لسه مفيش قراءة اتكوّنت للموضوع ده.» | No reading has formed for this yet. | O | semantics `FROZEN` · AR `PROPOSED` |
| T06 | One reading only | **YES** | «قراءة واحدة لحد دلوقتي» | — | «قراءة واحدة» | One reading | O | semantics `FROZEN` · AR `PROPOSED` |
| T07 | Multiple equal readings | **YES** | «معروضين هنا بالتساوي» | — | «كل القراءات معروضة هنا بالتساوي» | These readings are shown here as equals | O | semantics `FROZEN` · AR `PROPOSED` |
| T08 | Unknown · OPEN | **YES** | «لسه ناقصة» | — | «لسه ناقصة» | Still open | O | semantics `FROZEN` · AR `PROPOSED` |
| T09 | Unknown · RESOLVED | **YES** | «اتعرفت» | — | «بقت معروفة» | This is known now | O | semantics `FROZEN` · AR `PROPOSED` |
| T10 | Unknown · SUPERSEDED | **YES** | «اتغيّرت» | — | «ما بقتش مطروحة» | This no longer applies | O | semantics `FROZEN` · AR `PROPOSED` |
| T11 | Correction · RECEIVED | **YES** | «وصلني» / «التصحيح وصل» | — | «وصلني» | I have this | — | semantics `FROZEN` · AR `PROPOSED` |
| T12 | Correction · PENDING | **YES** | «لسه ما اتطبّقش» | — | «لسه ما اتطبّقش على الحاجة المسجّلة» | I haven't applied it to what's recorded | O | semantics `FROZEN` · AR `PROPOSED` |
| T13 | Empty Live Context | **YES** | «مفيش حاجة شغّالة مع الكلام دلوقتي» | — | «مفيش حاجة داخلة مع الكلام.» | Nothing is in play. | O | `PROPOSED` |
| T14 | Reviewer / simulated states | **NO** | «مُحاكى لاختبار التجربة»، «مدعوم من الرَنتايم»، «دفتر الصدق» | Truth manifest, Mark simulated | **must never ship** | **must never ship** | — | `INTERNAL ONLY` |

## Voice / multimodal

**`PRINCIPLES = KEEP. EXACT STRINGS = PROVISIONAL / PHASE VII.`** No voice runtime is assumed or
invented, and **no V-row below is a freeze candidate.** Two of them are already known to be
architecture-dependent: **"Recording" may be false** if realtime audio is not persistently
recorded, and **"Listening" is not automatically a comprehension claim** — it may be a legitimate
mechanical microphone/VAD state depending on the final design. The strings are illustrative of
the *principles*, not proposals.

| ID | Internal concept | Visible label? | Prototype AR | Prototype EN | Illustrative AR | Illustrative EN | G | Status |
|---|---|---|---|---|---|---|---|---|
| V01 | Voice note | **YES** | — | — | «تسجيل صوتي» | voice note | M | `PROVISIONAL / PHASE VII` |
| V02 | Call | **YES** | — | — | «مكالمة» | call | — | `PROVISIONAL / PHASE VII` |
| V03 | Mic idle | **YES** | — | — | «تسجيل» | Record | M | `PROVISIONAL / PHASE VII` |
| V04 | Capture active | **YES** | — | — | «بسجّل» | Recording ⚠ | — | `PROVISIONAL / PHASE VII` — may be false |
| V05 | Speaking / playback | **YES** | — | — | «بيتكلم» | Speaking | — | `PROVISIONAL / PHASE VII` |
| V06 | Reconnecting | **YES** | — | — | «الاتصال انقطع. جاري إعادة الاتصال.» | The call dropped. Reconnecting. | O | `PROVISIONAL / PHASE VII` |
| V07 | Voice fallback | **YES** | — | — | «المكالمة وقفت. الكتابة متاحة.» | The call isn't working. You can keep going in writing. | O | `PROVISIONAL / PHASE VII` |

⚠ = carries a flagged risk, detailed in Part 2.

---

# PART 2 — Rationale and risk

| ID | Alternative AR | Alternative EN | Reg. | Where it appears | Why this recommendation | Runtime / truth risk | Accessibility concern |
|---|---|---|---|---|---|---|---|
| S01 | — | — | — | app root | Home is **SIMULATED** per the canonical truth boundaries, and a user never refers to it. Framework Q1: they can act without knowing it exists | Naming a simulated surface implies product-shaped state fetch that does not exist | Root needs an accessible name; use the product name |
| S02 | «المحادثة» | Chat, Thread | T1 | nav, headings | Plain, warm, transparent across markets, already load-bearing. «المحادثة» is stiffer; "Chat" is app-ish, "Thread" is engineering | none | — |
| S03 | «اللي معانا دلوقتي»، «السياق الحالي» | Current context, What's in play | T1 | drawer/column heading, control | Native Arabic collocation; **unifies a term the product currently splits** — panel «الشغّال دلوقتي» vs contents «السياق» | ⚠ "In play" must not imply computed relevance — production is a recency window. Explanatory sentence carries the bound | Drawer needs `aria-labelledby`; scrim button needs a full accessible name |
| S04 | «المشهد»، «التفصيل» | Deep Analysis, The breakdown | T1 | route control, region name | The contents and the user's subject already orient; a container noun is an extra metaphor to learn, is ambiguous in the prototype, and makes the interface read as theatrical. **Not** because A15 forbids spatial meaning or A19 forbids naming a surface — both were overstatements, withdrawn | none | Region name must be count-independent |
| S05 | — | — | T3 | surface heading | The subject is the user's own words; a product noun above it adds nothing. Resolves the freeze's open item 7 (app-bar subtitle truncation) by deletion | Subject anchor is **SIMULATED** (A20) — must not be presented as runtime output | Heading level must not skip |
| S06 | — | — | T1 | pager `role="tablist"` | Prototype's «مساحات المشهد» dies with «المشهد» | none | Position/set-size from native semantics, never authored copy |
| O01 | «الموضوع» | The subject, Topic | T3 | analysis heading | Framework Q2: the sentence on screen already carries it | **SIMULATED**; A20 is conditional on a runtime that may one day have it | — |
| O02 | «تفسير»، «زاوية» | interpretation, angle, lens | T3 | throughout analysis | "A reading of the situation" is natural English carrying exactly the needed meaning — an interpretation that could differ, with no truth claim. Non-ordinal, count-neutral, and already the user's own word | none — readings are runtime-backed | — |
| O03 | letters, numbers, "the other" | A/B/C, 1/2/3 | T3a | pager controls, cross-refs | **Authority C — product/structural** — rejected for the current architecture, not as a false statement. The rule: **no user-facing reading identity whose order can be mistaken for hierarchy, breaks bilingual/accessible navigation, or becomes the identity itself.** Abjad letters also lose intuitive ordering well before the 32-per-user bound. **Carried forward as the first direction to test in VI-02:** identity from existing truthful reading content | ⚠ A short label is **not** runtime-backed and is **`DEFERRED POSSIBILITY — NOT REQUESTED`**. VI-01 asks for no runtime change | **Constraints only:** every exposed peer reachable; navigation position is an accessibility affordance, not semantic identity. **The control architecture is VI-02's to determine** |
| O04 | «الحاجات المسجّلة» | Your material, Records, Notes | T3 | shared region, analysis | "Material" is engineering; "Notes" falsely implies the user authored them deliberately — extraction is deterministic and unrequested | Must not imply verbatim capture | Provenance must be reachable from every instance |
| O05 | «حاجة مسجّلة» | a record, an item | T3 | record rows | Countable form of O04, in the user's own frame | same as O04 | — |
| O06 | «المشترك»، «اللي في القراءتين» ⚠ | Shared, In both readings ⚠ | T3 | shared region heading | **The prototype switches this label on `n===2`.** «بين» is count-safe from 2 upward; "across" matches | ⚠ The `n===2` variant is a live count-lock defect | Region carries the heading, not the record (**D1**) |
| O07 | «بتدعم» | backs, is consistent with | T3 | role lines | Nominal, no magnitude. **A5** | Must never be counted as strength (**A14**) | Reaches AT as words, never as a mark |
| O08 | «بتناقض»، «ضدّها» | goes against, counts against | T3 | role lines | **`APPROVED`.** «بتعارض» is clearer, flatter, less metaphorical and less likely to imply strength than «بتشدّ ضد» — that practical reason is sufficient. *(An earlier draft argued force metaphors necessarily violate A15; over-argued, withdrawn.)* | Relation strength is forbidden | as O07 |
| O09 | «على افتراض إن» | assuming that, takes it that | T3 | per reading | Already right; flat and non-committal | Must not read as a confidence qualifier | — |
| O10 | «شروط المراجعة» | disconfirming conditions, falsifiers | T3 | per reading | Framework Q3 — an abstract logical object rendered as a plain conditional, introducing no noun at all | Must not imply the system will detect the condition itself | Full sentence, not a chip |
| O11 | «فجوة»، «سؤال مفتوح» | gap, open question, unknown | T3 | per reading, shared region | «مش معروف …» states the gap as a plain declarative. "Gap"/«فجوة» is reviewer vocabulary | ⚠ No refusal state; no question-utility claim; **no answer-driven closure** | Occupies space while open (**A7**) — not a tooltip |
| O12 | «تفاصيل التسجيل» | Source, Details, Provenance | T1 | record disclosure | «مصدر» is unambiguous at one Arabic word; English "Source" reads as citation, so English spends words. Documented length divergence | ⚠ Must state record-date ≠ event-date **and** not-a-transcription | **Accessible name must contain the exact visible label**: «المصدر» → «المصدر — للحاجة دي» ✅. **✗ «مصدر الحاجة دي» fails** — the definite «المصدر» is not contiguous in it (WCAG 2.5.3; Foundation §16.2) |
| O13 | «اتسجّلت يوم» | date recorded | T3 | record rows | Record date, never event date (**A8**) | ⚠ Highest-frequency truth trap in the product | One numeral system everywhere, incl. accessible names |
| O14 | «سياق فعّلته» | context you activated | T3 | context items | «سياق انت فعّلته» uses a gendered verb; «بتفعيلك» keeps the agency with a script-neutral possessive | Activation is user-driven and runtime-backed for four kinds; cross-session persistence is **SIMULATED** | — |
| O15 | «مرفوعة قدّام» | foregrounded, focused, pinned | T2 | state sentence | **A9**: reversible, reader-driven, non-semantic. A noun would reify a view state into an object property | ⚠ "Pin" implies stored state (**A10**); "Highlight" implies importance (**A15**) | State carried by more than one channel, never opacity alone (**B7**) |
| O16 | «التعديل» | edit, feedback, fix | T1/T2 | correction sheet | «التعديل»/"Edit" describes something the product does not do — **A11** freezes correction to RECEIVED/PENDING | ⚠ Must never imply downstream effect | — |
| O17 | «بالتساوي» | equal, unranked | T3 | stage | Asserted geometrically (**A2**), stated once in words | Peer order must never read as rank | Equality must reach AT as words |
| O18 | — | category, status | — | — | Runtime fields with no user-facing meaning | — | — |
| O19 | — | relevance, nearby, most related | — | **nowhere** | `RESERVED FUTURE CAPABILITY / SIMULATED ONLY` (**A22**) | ⚠ **NOT SUPPORTED** in production — no client-readable relevance computation exists | If it ever ships, **A23** requires a non-spatial equivalent — a *language* deliverable |
| A01 | «فتح السياق» | Open context | T1 | conversation chrome | Masdar/noun label; no addressee inflection | as S03 | `aria-expanded` + `aria-controls` |
| A02 | «قفل» | Dismiss | T1 | drawer, scrim | Standard Arabic UI masdar | none | Escape cascade order (**B10**); scrim needs an accessible name |
| A03 | «خلّيها قدّامي» *(T2 voice)*، «إبراز» ✗ | Focus ✗, Highlight ✗, Pin ✗ | T1 | record actions | **`OPEN`.** «تركيز العرض» reads constructed and technical and is rejected as final copy; no replacement synonym is invented here. The interaction may carry part of this meaning — not every state needs a named concept | ⚠ Semantics locked: view-only, reversible, not importance, not persistence. Must not share vocabulary with any future **A22** relevance state | Announce after the state, never before (**B4**) |
| A04 | «رجّعها زي ما كانت» *(T2)* | Undo, Reset view | T1 | record actions | Reversibility is part of the meaning, not a convenience | Must not imply anything stored changed (**A10**) | Focus returns to the trigger |
| A05 | «منين جت» | Source, Details | T1 | record row | see O12 | see O12 | Native dialog semantics; focus trap; Escape (**B8**) |
| A06 | «تصحيح» | Report a problem, Give feedback | T1 | record row | A question is warmer than an imperative and avoids the schoolteacher reading of «صحّح»; «مظبوط» is Egypt-locked and repaired to «غلط» | Must not promise review or downstream change | — |
| A07 | «ابعت» ✗ *(gendered)* | Submit, Save | T1 | correction sheet | Masdar; and the action keeps its name into the resulting state | ⚠ Never "Apply" | Label in Name |
| A08 | «شيلها» ✗، «احذف» ✗ | Remove, Delete ✗, Hide | T1 | context item | **`OPEN`.** Semantics approved: this is not destructive and the label must say so. But «استبعاد» can read as rejection or judgement — undesirable near **A15** — and bare "Take out" is ambiguous without context. **Requirement carried forward:** make the temporary, current-context scope clear without sounding destructive or evaluative | ⚠ Record is unchanged; effect is session-scoped (**A10**) | Accessible name completes the promise: "…for now — this doesn't delete it" |
| A09 | «شوف دورها» ✗ *(gendered)* | See role, Where this appears | T1 | context item → readings | A bare noun phrase has no verb, so it is neutral by construction | Landing must be on the actual record (**B4**) | Announce arrival only after it has arrived |
| A10 | «اكتب لقنديل» ✗ *(gendered)* | Message, Ask anything ✗ | T1 | composer | «اكتب» is a gendered imperative; a possessive label and a possessive placeholder are both neutral | "Ask anything" overclaims capability | `<label>` present even when visually hidden |
| A11 | «افتح المشهد» ✗ | Open analysis ✗ | T1 | conversation → readings | see S04 | see O03 | Count-independent region name |
| A12 | «محادثة جديدة» | New chat | T1 | nav | ⚠ **Not listed in the canonical runtime-backed set.** Proposed on the assumption it exists; verify before use | ⚠ Unverified against runtime | — |
| A13 | — | — | T2 | conversation | The product's thesis moment; already correct | Refusal must be plain and once, never softened into a hedge | — |
| T01 | «بحمّل…» *(T2 form)* | — | T4 | any surface | Standard, unambiguous | none | `aria-busy` or status text |
| T02 | «الخدمة مش متاحة» | Unavailable | T4 | error surface | Process-framed, not «لم نتمكن»/"We couldn't" | Must not blame the user or invent a cause | `role="status"` |
| T03 | «جرّب تاني» *(T2 voice only)* | Retry | T4 | error surface | Masdar in fixed copy; the colloquial form stays available to the conversational voice. One Arabic, two registers — no second profile (Foundation §3.3) | none | — |
| T04 | — | Partial results | T4 | any list | Names what is missing without ranking what arrived | Must not imply the missing part was less relevant | Announce politely |
| T05 | — | No readings yet | T3 | analysis | Thin data is a **valid product state** (**A12**), not an error | ⚠ Must not promise a reading will form | Occupies real space, not a spinner |
| T06 | «قراءة واحدة لحد الآن» ✗ | Only one reading ✗, One reading so far ✗ | T3 | analysis | **Restraint wins.** The bare state says everything; «لحد الآن» / "so far" was a temporal hedge doing no work. Re-add one only if a later product state genuinely needs to communicate openness | ⚠ Must not imply a second is coming — guaranteed two readings is forbidden. "Only" adds a deficiency read | — |
| T07 | «قراءتين، معروضين بالتساوي» ⚠ | Both readings ✗ | T3 | stage | Count-independent phrasing; the dual variant is count-locked | ⚠ **A2** — no winner, no primary | Equality reaches AT as words |
| T08 | «ناقصة» | Open, Unanswered | T3 | unknowns | Object-focused, neutral | — | Must occupy space while open |
| T09 | «اتعرفت» | Resolved, Answered ✗ | T3 | unknowns | **Agentless by construction** | ⚠ "Answered" implies answer-driven closure — forbidden. Disclaimer must travel with the state | Announce the change politely |
| T10 | «اتغيّرت» | Superseded, Overtaken | T3 | unknowns | Must not read as resolved — a different outcome, not a better one | ⚠ Not a resolution | — |
| T11 | «التصحيح وصل» | Received | T2 | correction | First person; states receipt only | ⚠ Never "applied" | — |
| T12 | «ما اتطبّقش» | Not applied yet | T2 | correction | The non-application is the *product truth*, not a caveat | ⚠ **A11** — nothing downstream changed | Nothing on this path animates (**D5**) |
| T13 | «مفيش حاجة داخلة» | Nothing here yet | T3 | context panel | Thin data is valid | Must not imply the system found nothing relevant | Empty state is an invitation, not a void |
| T14 | — | — | — | **reviewer only** | These read like product copy and sit in shipped markup — the highest-risk leak in the codebase | ⚠ Simulated-only states must never enter product language | — |
| V01 | «رسالة صوتية» | audio message | T1 | composer | Plain, no capability claim | Phase VII gate | — |
| V02 | «مكالمة صوتية» | "live call" / "session" — `PROVISIONAL` | T1 | call surface | **Not a false statement by definition** *(FIX-03 §10)*. Whether "live" is accurate depends on the realtime architecture; **"Live Context" stays rejected** as today's context-panel vocabulary | ⚠ No voice runtime exists — Phase VII decides | — |
| V03 | «اضغط للتسجيل» ✗ *(gendered)* | Hold to talk | T1 | mic control | Masdar label; the gesture belongs to the visual phase | — | Must have a keyboard equivalent |
| V04 | «بسمعك» | Listening | T4 | mic state | **`PROVISIONAL`.** "Listening" is **not automatically** a comprehension claim — it may be a legitimate mechanical microphone/VAD state if the final architecture defines it as one. Equally, "Recording" may be **false** if audio is not persistently recorded. Phase VII decides both | ⚠ Whichever ships must match what the architecture actually does | `aria-live` |
| V05 | «قنديل بيفكّر» ✗ | Thinking ✗ | T4 | playback | "Thinking" is anthropomorphic overclaim and an AI cliché | ⚠ Forbidden intelligence implication | — |
| V06 | «فقدتك» ✗ | I lost you ✗ | T4 | call | Process-framed; assigns no fault | — | Announce politely |
| V07 | — | — | T4 | call | Fallback always names the alternative | Must not promise the call will return | Alternative must be reachable by keyboard |

---

# PART 3 — High-impact term reviews

**This is the only high-impact review block in this file, and it does not repeat Foundation §7.**
The eleven high-impact concepts are split across the two documents with no overlap:

| Reviewed in Foundation §7 | Reviewed here, in Part 3 |
|---|---|
| Deep Analysis / «المشهد» · Live Context / «الشغّال دلوقتي» · Home · subject anchor | Conversation · reading · recorded material · shared material · unknown · provenance · foreground |

Same disciplined format in both: **maximum three serious directions**, Arabic and English
designed natively, and the concept's right to exist as a name questioned first.

Every recommendation below is `PROPOSED — REQUIRES PRODUCT/CREATIVE DIRECTION APPROVAL`, except
where a row is marked `APPROVED` or `OPEN` following Product Direction FIX-01.

## HI-1 · Conversation

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «الكلام» *(retain)* | «المحادثة» | *unnamed — the app opens into it* |
| **English** | Conversation | Chat | *unnamed* |
| **Communicates** | the ordinary human act of talking | a formal exchange | there is nothing to name |
| **Risks** | very plain — could read as under-designed | stiffer; the standard translated-software choice; **AR sounds MSA-formal against T2 warmth** | breaks cross-surface reference — «داخلة مع الكلام» has nothing to point at |
| **UI length** | AR 6 / EN 12 | AR 8 / EN 4 | — |
| **Scalability** | fine at any session length | fine | fails: other surfaces must refer to it |
| **Truth risk** | none | none | none |
| **Better unnamed?** | **no** — three other concepts (S03, O04, T13) define themselves *by relation to it* | | |

> **CLAUDE RECOMMENDATION: Direction A, `RETAIN`.** «الكلام» is the load-bearing referent for
> «داخلة مع الكلام»، «سياق الكلام»، «كمّل الكلام». Its plainness is the personality, not a gap in
> it. English takes "Conversation" — "Chat" is too casual for a product this restrained.

## HI-2 · Reading / peer reading

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «قراءة» *(retain)* | «تفسير» | «زاوية» |
| **English** | reading | interpretation | angle / lens |
| **Communicates** | how this is being read — could reasonably differ | an explanation of what it means | a viewpoint among viewpoints |
| **Risks** | none material | **claims explanatory authority** QANDEEL does not have; heavier in both languages | «زاوية»/"angle" is spatial, and spatial words near peers invite the ordinal reading **A2** bars |
| **UI length** | AR 5 / EN 7 | AR 5 / EN 14 | AR 4 / EN 5 |
| **Scalability** | count-neutral; no ordinal content | count-neutral | count-neutral |
| **Truth risk** | none — runtime-backed | ⚠ implies a resolved meaning | ⚠ spatial framing |
| **Better unnamed?** | **no** — it is the product's central object | | |

> **Direction A — `APPROVED` in both languages** *(Product Direction, FIX-01 §8).* "Peer" is
> reviewer vocabulary and must never ship; the user-facing word is simply "reading", and readings
> remain equal, unranked interpretations. **The word survives; its *labelling scheme* does not** —
> see O03 and Foundation §10.2. **No runtime label contract is requested.**

## HI-3 · Recorded material

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «اللي مسجّل من كلامك» / «حاجة من كلامك» | «الحاجات المسجّلة» | «ملاحظاتك» |
| **English** | what's recorded from what you said / something you said | records / a record | your notes |
| **Communicates** | this came from you, and I wrote it down | the system holds items | you wrote these |
| **Risks** | longest of the three | drops the *provenance* half — "records" could be anything, from anywhere | **false**: the user did not author them; extraction is deterministic and unrequested |
| **UI length** | AR 20 / EN 34 · countable AR 15 / EN 18 | AR 15 / EN 7 | AR 9 / EN 10 |
| **Scalability** | fine | fine | fine |
| **Truth risk** | ⚠ must not imply verbatim — provenance sentence carries it | ⚠ loses the "from your own words" guarantee | ⚠ **misattributes authorship** |
| **Better unnamed?** | **partly** — the collective form is a region heading, and the countable form is often carried by the sentence around it | | |

> **Direction A — semantics `FROZEN`, exact Arabic `PROPOSED`.** The provenance is *inside the
> name*, which is the cheapest possible guard against the verbatim-quotation and authorship
> traps; **that framing is frozen in both languages**, as is English "from what you said" /
> "something you said". "Material" stays `INTERNAL ONLY`.
>
> **After the FIX-02 register audit**, the collective Arabic is left open: «اللي مسجّل من كلامك»
> *(incumbent, warmer)* vs «المسجّل من كلامك» *(neutral, tighter)*. Where length bites at 375px,
> the countable form carries the meaning alone.

## HI-4 · Shared material

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «المشترك بين القراءات» | «اللي في القراءتين» *(prototype, at n=2)* | «داخلة في أكتر من قراءة» |
| **English** | Shared across readings | In both readings | In more than one reading |
| **Communicates** | one region, holding what more than one reading stands on | this is in the two readings | this record spans readings |
| **Risks** | slightly abstract as a heading | ⚠ **count-locked — valid only at exactly two**; this is a live defect | good as an *item* line, too long as a *region* heading |
| **UI length** | AR 20 / EN 22 | AR 17 / EN 16 | AR 24 / EN 24 |
| **Scalability** | ✅ «بين» is count-safe from 2 up; "across" likewise | ❌ **breaks at 3** | ✅ but verbose |
| **Truth risk** | none | ⚠ asserts a count the runtime does not fix | none |
| **Better unnamed?** | **no** — **B12** locks it as one region in reading order | | |

> **CLAUDE RECOMMENDATION: Direction A for the region heading; Direction C for the per-item
> line.** The region names itself count-independently; the item names *which* readings it stands
> in — **D2** already decided that naming beats counting. **Delete the `n===2` switch.**

## HI-5 · Unknown / information gap

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «مش معروف …» *(declarative)* | «حاجة ناقصة» | «سؤال مفتوح» |
| **English** | Not known: … | Missing | Open question |
| **Communicates** | this specific thing is not known | something is absent | there is a question outstanding |
| **Risks** | needs the full statement to work — it is a sentence pattern, not a chip | vague — *what* is missing? invites a deficiency read of the user | ⚠ **implies QANDEEL is asking**, and edges toward a **question-utility claim**. A QANDEEL question needs a concrete information purpose and must not be performative curiosity, engagement bait, disguised judgement, or a utility/rank claim *(Foundation §13; VI-01 does not own the Question Runtime)* |
| **UI length** | AR 10 + statement / EN 11 + statement | AR 11 / EN 7 | AR 10 / EN 13 |
| **Scalability** | fine at many unknowns | fine | fine |
| **Truth risk** | none — states absence without agency | ⚠ deficiency framing | ⚠ **question utility is forbidden**; also risks a refusal reading |
| **Better unnamed?** | **no** — **A7** requires it named, explicit, and occupying space while open | | |

> **Direction A — pattern `FROZEN`, exact Arabic `PROPOSED`.** It is the only one of the three
> that states the gap *without* an agent, which is exactly what the forbidden-inference list
> requires: no refusal state, no utility claim, no answer-driven closure. **English "Not known: …"
> is frozen.**
>
> **After the FIX-02 register audit**, the Arabic lead-in is left open: «مش معروف …» keeps one
> register across the label and the prose that follows; «غير معروف: …» is the cleaner neutral
> lead-in and is natural rather than stiff, but sets a neutral label against colloquial prose.
> Which reads better depends on the rendered seam — a native product-ear call, not a page call.
> "Gap" and «فجوة» stay `INTERNAL ONLY`.

## HI-6 · Provenance

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «المصدر» | «تفاصيل التسجيل» | *unnamed — the disclosure sentence is always visible* |
| **English** | Where this came from | Details | *unnamed* |
| **Communicates** | press to see where this came from | there is metadata here | — |
| **Risks** | AR/EN lengths diverge sharply *(deliberate)* | "Details" is the generic SaaS answer and says nothing | ⚠ violates **A8**, which requires it *one press away* — always-visible becomes metadata overload |
| **UI length** | AR 6 / EN 20 | AR 15 / EN 7 | — |
| **Scalability** | fine | fine | fails at density |
| **Truth risk** | ⚠ the disclosure itself carries two mandatory claims | same | ⚠ overload defeats the disclosure |
| **Better unnamed?** | **as a noun, yes** — "provenance" never ships; only the action is named | | |

> **CLAUDE RECOMMENDATION: Direction A.** The word "provenance" is `INTERNAL ONLY`; only the
> action surfaces. The AR/EN length divergence is deliberate and documented in Foundation §5:
> «مصدر» is unambiguous at one word, English "Source" reads as citation, so English spends four.

## HI-7 · Foreground / focus

| | Direction A | Direction B | Direction C |
|---|---|---|---|
| **Arabic** | «تركيز العرض» → **rejected, see below** | «إبراز» | «تثبيت» |
| **English** | Bring to front *(candidate)* | Highlight | Pin |
| **Communicates** | the *view* is focused on this | this one matters | keep this here |
| **Risks** | "front" is spatial — mitigated because the phrase is reader-owned and the state sentence says so | ⚠ **implies importance** | ⚠ **implies stored, persistent state** |
| **UI length** | AR 12 / EN 13 | AR 5 / EN 9 | AR 6 / EN 3 |
| **Scalability** | fine | fine | fine |
| **Truth risk** | ⚠ must never share vocabulary with a future **A22** relevance state | ⚠ **A15** — importance is barred | ⚠ **A10** — nothing is stored; the state is reversible and local |
| **Better unnamed?** | **as a noun, yes** — only the two actions and the state sentence are named | | |

> **`OPEN — MUST BE RESOLVED WITH THE FINAL INTERACTION IN VI-02/VI-03`**
> *(Product Direction, FIX-01 §6.)*
>
> **B and C stay rejected on truth grounds**: «إبراز» / "Highlight" asserts importance (**A15**),
> «تثبيت» / "Pin" asserts persistence (**A10**).
>
> **But A is not the answer either.** «تركيز العرض» reads constructed and technical — it is
> semantically defensible and product-language weak, which is exactly the case where neutrality
> and semantic tidiness were allowed to outrank naturalness. «إرجاع العرض» is likewise not
> approved. **No fourth synonym is invented here**; forcing one would repeat the error.
>
> English **"Bring to front" / "Put it back"** remain **candidates, not frozen strings**.
>
> **The strongest remaining option is still the one in the table's last row: this may not need a
> named product concept at all.** The interaction can carry part of the meaning, and that is a
> VI-02/VI-03 decision made with the real interaction in hand.

---

**`CORRECTED PER PRODUCT DIRECTION FIX-02. SEMANTIC CONTRACTS FROZEN; ROWS MARKED APPROVED /
PROPOSED / OPEN / PROVISIONAL. A PROPOSED ROW MEANS THE MEANING IS SETTLED AND THE WORDING IS NOT.`**
