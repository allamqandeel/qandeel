# QANDEEL — STAGE 1.2

## Conversational Unit + Dialogue/Discourse Function Model

**Status:** `STAGE 1.2 FREEZE CANDIDATE — AWAITING APPROVAL`
**Input authority:** Stage 1.1 — APPROVED / CLOSED / Gate 1.1 PASS
**Stage 1.3:** NOT STARTED

The objective of Stage 1.2 is deliberately narrow:

> Define the smallest truthful conversational substrate on which later Thread establishment and higher analysis can depend.

It does **not** define Threads, world Events, final discourse relations, Evidence semantics, visual objects, or revision history.

---

# A. STAGE 1.2 PROPOSED CONVERSATIONAL-UNIT CONTRACT

## A1. Three concepts must remain distinct

### 1. Runtime Turn

`conversation_turn` retains its existing QANDEEL meaning:

> an operational runtime envelope for one USER / ASSISTANT / SYSTEM contribution.

It owns runtime identity, role, content and processing lifecycle.

It is **not automatically a semantic analysis unit**.

A turn may contain:

- zero meaningful conversational units;
- one conversational unit;
- several conversational units.

Nothing in Stage 1.2 changes the current runtime contract.

---

### 2. Utterance / Partial Utterance

An **Utterance** is a linguistic/source-level stretch of speech or text produced by one speaker.

For live speech it may be:

- partial;
- interrupted;
- hesitating;
- restarted;
- incorrectly transcribed temporarily;
- subsequently extended by the same speaker.

An utterance boundary is therefore useful to speech processing but is **not a canonical analytical identity in QANDEEL v1**.

Punctuation, an ASR endpoint or a short pause is a segmentation clue—not proof that a semantic unit has ended.

---

### 3. Conversational Unit — `CU`

Stage 1.2 introduces one new conceptual analytical atom:

> **Conversational Unit (CU): the smallest contiguous span of committed conversational source material that constitutes one independently addressable conversational contribution while preserving its speaker, attribution structure, references and local conversational function.**

The CU is the minimum unit downstream Stage 1 grammar may cite as concrete conversational evidence.

### Required CU invariants

A committed CU:

1. belongs to **exactly one runtime turn**;
2. has exactly one current-conversation speaker attribution state;
3. is bound to a **contiguous** span of that turn;
4. never crosses a runtime-turn boundary in v1;
5. may be smaller than a turn;
6. may equal the whole turn;
7. may carry **multiple conversational functions simultaneously**;
8. may contain explicit or embedded reported/quoted claim spans;
9. may contain resolved, ambiguous and unresolved references;
10. must preserve the original committed surface wording;
11. does not become QANDEEL Evidence merely because it exists.

### Therefore

**Turn > CU** is common.

Example:

> «أنا سبت الشغل امبارح، وأحمد كلمني. ممكن نرجع لموضوع السفر؟»

One runtime turn, but three independently addressable contributions:

- CU-1: «أنا سبت الشغل امبارح»
- CU-2: «وأحمد كلمني»
- CU-3: «ممكن نرجع لموضوع السفر؟»

A future user could respond separately to any of the three.

That makes separate CUs useful and truthful.

---

## A2. What causes a CU boundary?

Create a boundary when the conversation contains a genuinely independently addressable contribution.

Strong boundary evidence includes:

- a different conversational speaker;
- a different runtime turn;
- a clearly independent assertion/report;
- a separate question or request;
- an explicit clarification move;
- an explicit correction move;
- a separately targetable stance/challenge;
- an explicit redirection of conversational focus;
- a material change in claim attribution;
- a later span that could reasonably be responded to without referring to the preceding span.

Do **not** split merely because of:

- punctuation;
- commas;
- pause length alone;
- Arabic/English code-switching;
- filler words;
- hesitation;
- every syntactic clause;
- every named entity;
- every connective.

### Example

> «أنا كنت okay في الأول بس then I panicked لما المدير كلمني.»

Code-switching alone creates no boundary.

If the whole span constitutes one report, it may remain one CU.

---

## A3. One CU must not be duplicated because it has several functions

A central Stage 1.2 rule is:

> **One source span = one CU identity even when that span performs several relevant functions.**

Example:

> «مش مقتنع... تقصد أحمد صاحبي ولا أحمد أخويا؟»

One span may simultaneously perform:

- `ASK`
- `CLARIFY`
- `DISAGREE_CHALLENGE`

QANDEEL must not manufacture three copies of the user's speech merely to attach three labels.

This satisfies the frozen requirement that multi-function utterances survive without artificial duplication.

---

## A4. Minimum provenance required at Stage 1.2

Stage 1.4 will define the complete source-bearing object model.

Stage 1.2 freezes only the minimum provenance necessary to make a CU stable:

**Committed CU provenance anchor**

- parent runtime-turn identity;
- ordinal/order inside that turn;
- committed contiguous source span;
- exact committed surface text;
- conversational speaker attribution or explicit unresolved-speaker state;
- source version/state from which commitment occurred.

For text, the span can conceptually correspond to offsets inside committed turn content.

For voice, it can conceptually correspond to a finalized transcript span and, where available, the associated speech interval.

This is **not yet** the Stage 1.4 source-bearing ontology.

It is simply enough to guarantee:

> “CU-17 refers back to exactly this committed part of exactly this conversational turn.”

---

# B. MINIMUM DIALOGUE / DISCOURSE-FUNCTION CONTRACT

Stage 1.2 deliberately rejects a giant universal Dialogue Act taxonomy.

QANDEEL v1 needs only functions that materially protect conversational truth or support later analysis.

A committed CU may have **zero, one or several resolved functions**.

If function assignment remains genuinely ambiguous, it may remain:

`FUNCTION_UNRESOLVED`

instead of forcing a label.

## B1. Minimum function set

### 1. `INFORM_REPORT`

The speaker contributes propositional or experiential content.

Examples:

> «أنا سبت الشغل امبارح.»

> «أحمد قال إنه مش جاي.»

It means:

**the conversation contains an informative/reporting contribution.**

It does **not** mean:

- the proposition is objectively true;
- it is QANDEEL Evidence;
- QANDEEL believes it;
- it is already Memory;
- it is a grounded Event.

---

### 2. `ASK`

The speaker seeks information, confirmation, selection or explanation.

Examples:

> «هو أحمد سافر؟»

> «ليه حصل كده؟»

`ASK` does not automatically create a QANDEEL Information Gap or Question Candidate.

Those existing runtime concepts retain their current meanings.

---

### 3. `REQUEST`

The speaker asks the interlocutor to perform an action or conversational operation rather than merely supply a fact.

Examples:

> «ساعدني أفكر في الموضوع.»

> «خلينا نرجع للشغل.»

A CU may be both `ASK` and `REQUEST`.

---

### 4. `ACKNOWLEDGE`

The speaker signals reception, comprehension or conversational uptake.

Examples:

> «تمام.»

> «فاهمك.»

Crucial truth rule:

> **Acknowledgment is not automatically agreement.**

«تمام» may mean “I heard you” rather than “your interpretation is correct.”

---

### 5. `AGREE`

The speaker explicitly endorses or aligns with some prior conversational content.

Example:

> «أيوه، ده فعلًا اللي حصل.»

When locally identifiable, the function should retain its target CU.

It does **not** create a general semantic `SUPPORTS` relation or QANDEEL Evidence relationship.

---

### 6. `DISAGREE_CHALLENGE`

The speaker rejects, questions or challenges prior conversational content.

Examples:

> «لا، أنا مش شايف الموضوع كده.»

> «مش مقتنع إن ده السبب.»

This represents **conversational stance**.

It does not automatically mean:

- factual contradiction;
- contradicting QANDEEL Evidence;
- Hypothesis rejection.

Those are later contracts.

---

### 7. `ELABORATE`

The speaker adds meaningful detail to previously introduced conversational content.

Example:

> «قصدي إن المشكلة مش في المرتب بس؛ كمان طريقة المدير.»

Use only when there is a defensible local target.

It is a unit-side discourse function—not Stage 1's final discourse-relation registry.

---

### 8. `CLARIFY`

The speaker resolves or attempts to resolve an ambiguity, misunderstanding or underspecified reference.

Examples:

> «قصدي أحمد أخويا، مش أحمد صاحبي.»

> «لما قلت “هناك” كنت أقصد المكتب الجديد.»

A clarification request can be:

`ASK + CLARIFY`

while a supplied clarification can be:

`INFORM_REPORT + CLARIFY`.

---

### 9. `CORRECT`

The speaker explicitly revises earlier expressed wording, reference, fact, intention or meaning.

Example:

> «الخميس... لا، قصدي الجمعة.»

The annotation must distinguish at least:

- correction of the speaker's own earlier material;
- correction of somebody else's earlier material.

Stage 1.2 detects the conversational act.

**Stage 1.7—not Stage 1.2—will define its historical/supersession consequences.**

`CORRECT` is also categorically different from ASR/transcription revision.

---

### 10. `RECALL`

The speaker explicitly frames content as remembered or recalled.

Examples:

> «على ما أفتكر كان يوم التلات.»

> «فاكر إني قلتلك الموضوع ده قبل كده.»

`RECALL` should require a genuine recall cue or equivalent context.

Ordinary past tense alone does not justify it.

Most importantly:

> `RECALL` does not create or redefine a QANDEEL Memory or Evidence item.

---

### 11. `FOCUS_SHIFT`

The speaker explicitly redirects current conversational attention.

Examples:

> «سيبك من أحمد دلوقتي، خلينا في موضوع الشغل.»

> «المهم... نرجع لموضوع السفر.»

This function supplies potential evidence to Stage 1.3.

It does **not** itself:

- create a Thread;
- close a Thread;
- reopen a Thread;
- decide Thread identity.

---

## B2. Minimal conversational sequence position

Stage 1.2 should retain only the small amount of sequence organization required for interpretation.

A CU may carry:

- `UNMARKED`
- `INITIATING`
- `RESPONSIVE`
- `FOLLOW_UP`

and, where necessary:

- one or more **local target CU IDs**.

### Example

Assistant:

> «إمتى كلمت أحمد؟»

User:

> «بعد الشغل.»

The user CU is:

- `INFORM_REPORT`
- `RESPONSIVE`
- target = assistant question CU.

This gives downstream grammar the structure it needs without importing a universal adjacency-pair taxonomy.

### Boundary

This local targeting mechanism is **not** the final discourse-relation graph.

No Stage 1.2 relation such as:

- CAUSES;
- SUPPORTS;
- CONTRASTS\_WITH;
- TEMPORALLY\_PRECEDES;

is being introduced here.

---

# C. REFERENCE / COREFERENCE / ATTRIBUTION CONTRACT

The frozen roadmap makes this contract mandatory because downstream Thread truth cannot depend on falsely attributed Egyptian-Arabic material.

## C1. Reference occurrence ≠ world entity

Stage 1.2 introduces a lightweight **Conversational Reference Handle** only for continuity.

It is:

> a session-local handle saying that two conversational expressions have sufficient grounding to be treated as referring to the same conversational referent.

It is **not yet**:

- a universal Entity object;
- a world-object ontology;
- an Event;
- a permanent cross-session identity.

Those questions belong later.

---

## C2. Every relevant reference has one of three states

### `RESOLVED`

Exactly one defensible conversational referent can be grounded.

### `AMBIGUOUS`

Two or more defensible candidates exist.

Example:

> «قابلت أحمد وخالد... هو قالّي إنه هيسافر.»

`هو` could defensibly mean Ahmed or Khaled.

The result is:

`AMBIGUOUS {Ahmed, Khaled}`

—not whichever name happens to be most recent.

### `UNRESOLVED`

No candidate is sufficiently grounded.

Example:

> «هو كان متضايق.»

with no recoverable antecedent.

Result:

`UNRESOLVED`

—not an invented person.

---

## C3. Resolution rule

A reference may resolve only when conversational evidence makes one candidate sufficiently better grounded to exclude the relevant alternatives.

Useful grounding may include:

- explicit naming;
- explicit apposition;
- unique conversational antecedent;
- grammatical/person/gender/number compatibility;
- local sequence structure;
- explicit clarification;
- quote/report attribution frame;
- uniquely recoverable ellipsis.

Recency can contribute.

**Recency alone is not identity proof when meaningful competing candidates remain.**

No numeric confidence threshold is frozen in Stage 1.2.

---

## C4. Repeated names must not automatically collapse

Example:

> «أحمد صاحبي في الشغل كلمني امبارح.»

Later:

> «أحمد أخويا بقى له أسبوع مسافر.»

Stage 1.2 creates/retains two distinct conversational handles:

- Ahmed-A — work friend
- Ahmed-B — brother

A later:

> «هو كلمني الصبح.»

may therefore remain ambiguous unless surrounding context identifies which Ahmed.

The string `"أحمد"` is a lexical cue.

It is not canonical identity.

---

## C5. Pronouns

Explicit pronouns such as:

- هو
- هي
- هم
- أنا
- إحنا

and attached pronouns such as:

- ـه
- ـها
- ـهم

must resolve through conversational grounding, not surface proximity alone.

### Example

> «أحمد قال لمحمد إنه تعبان.»

Depending on actual syntax/context, `إنه` may not always be safely resolvable merely from name proximity.

If Stage 1.2 cannot defend one antecedent, it remains ambiguous.

---

## C6. Omitted subjects / pro-drop

Egyptian Arabic frequently omits an independently written subject.

Example:

> «قالّي امبارح إنه زعلان.»

The grammatical subject of «قالّي» may be recoverable if exactly one active compatible referent exists.

If there are two plausible male referents:

> «أحمد وخالد كانوا معايا. بعدها قالّي إنه زعلان.»

QANDEEL must not invent which one said it.

Result:

`AMBIGUOUS`.

### Especially important

Written Egyptian Arabic can lose morphological distinctions that spoken pronunciation would have made clearer.

Therefore an omitted subject is not resolved merely because a model can produce a plausible sentence.

---

## C7. Conversational ellipsis

Example:

Assistant:

> «إمتى كلمت أحمد؟»

User:

> «بعد الشغل.»

The response is meaningful despite omitting most of the proposition.

Stage 1.2 may resolve its **dependency** to the preceding question because the conversational structure uniquely supplies the missing frame.

But QANDEEL does not need to overwrite the user's source text with:

> “I called Ahmed after work.”

The committed source remains:

> «بعد الشغل.»

The elliptical dependency is separately represented.

This distinction prevents generated paraphrase from becoming fake source truth.

---

## C8. Implicit references

Expressions such as:

- «ده»
- «دي»
- «كده»
- «الموضوع»
- «الحكاية دي»
- «هناك»
- «وقتها»

may refer to:

- a person/entity;
- prior conversational content;
- an event/situation;
- a time/place;
- something genuinely unresolved.

Stage 1.2 resolves only the conversational anchor needed for truthful continuity.

It does not create the final Event/Time/world-object model.

---

# C9. Speaker attribution and claim attribution are different

This distinction is mandatory.

For every committed CU we ask separately:

### Conversational speaker

> Who physically/textually produced this material in the current QANDEEL conversation?

### Claim / reported-content source

> Whose position, statement, belief or quoted words does a particular span represent?

These may differ.

---

## C10. Indirect reported speech

User says:

> «أحمد قال إنه مش جاي بكرة.»

**Conversational speaker:** USER.

**Reported-content source:** Ahmed.

The span:

> «إنه مش جاي بكرة»

is attributed to Ahmed.

The user is reporting that Ahmed said it.

QANDEEL must **not** silently convert this into:

> “The user believes that Ahmed is not coming tomorrow.”

User endorsement remains:

`NOT_ESTABLISHED`

unless separately expressed.

---

## C11. Direct quoted speech

User:

> «أحمد قالّي: أنا مش رايح بكرة.»

Outer conversational speaker:

**USER**

Quoted speaker:

**Ahmed**

Inside the quotation:

> «أنا»

refers to **Ahmed**, not to the current QANDEEL user.

Quotation therefore changes the local deictic/attribution frame.

---

## C12. Mixed reporter + own stance

> «أحمد قال إنه مش جاي بكرة، وأنا شايف إنه بيتهرب.»

Segment:

**CU-1**

> «أحمد قال إنه مش جاي بكرة»

Function: `INFORM_REPORT`

Reported content attributed to Ahmed.

**CU-2**

> «وأنا شايف إنه بيتهرب»

Function:

`INFORM_REPORT`

Potentially `DISAGREE_CHALLENGE` depending on local target.

Claim attributed to the USER.

This prevents Ahmed's statement and the user's interpretation from being fused into one claimant.

---

## C13. Nested/ambiguous reported speech

> «أحمد قال إن محمد كلمه وهو متضايق.»

The final:

> «هو»

could refer to Ahmed or Mohamed.

QANDEEL may know:

- conversational speaker = user;
- Ahmed is reported speaker;
- Mohamed is mentioned;

while still recording:

`هو → AMBIGUOUS {Ahmed, Mohamed}`.

Partial knowledge is preferable to a false complete interpretation.

---

## C14. Code-switching changes neither identity nor attribution by itself

Example:

> «Ahmed قال he مش coming بكرة.»

If the local reporting construction uniquely identifies `he` as Ahmed:

`he → Ahmed`

despite the Arabic/English switch.

Language change is not:

- a CU boundary;
- a new speaker;
- a new referent;
- a new Thread.

---

# D. PROVISIONAL → COMMITTED LIVE-UNIT LIFECYCLE

The frozen roadmap explicitly states that provisional speech may change through ASR revision, streaming completion, continuation or normalization, and that this is categorically different from genuine user self-correction.

## D1. State 0 — Live Source Buffer

Raw evolving user input.

Examples:

- partial ASR hypothesis;
- unfinished voice span;
- partially typed streaming input where applicable.

No CU truth exists yet.

---

## D2. State 1 — Provisional Conversational Unit

QANDEEL may tentatively hypothesize:

- likely segmentation;
- likely functions;
- likely speaker;
- possible references;
- likely sequence target.

But a provisional CU:

- has no durable analytical authority;
- may split;
- may merge;
- may disappear;
- may change wording;
- may change reference resolution;
- may change function classification.

It may support immediate conversational responsiveness only.

It cannot create permanent downstream analytical truth whose existence depends on the unstable material.

---

## D3. Commitment conditions

A provisional span becomes a **Committed CU** only when:

### 1. Source stability

The underlying conversational text/transcription for that span is no longer expected to change merely because the input system is still decoding it.

### 2. Boundary stability

There is sufficient evidence that continuation will not simply turn the supposed unit into a different unfinished contribution.

### 3. Speaker-state stability

Speaker attribution is either:

- resolved;

or

- explicitly committed as unresolved.

QANDEEL must not invent a speaker merely so the unit can commit.

### 4. Provenance stability

The unit can bind to a stable parent turn and source span.

---

## D4. State 2 — Committed Conversational Unit

On commitment:

- the CU receives canonical conversational-unit identity;
- its parent turn and source span become stable;
- its committed surface wording is preserved;
- source speaker state is preserved;
- subsequent Stage 1 grammar may reference that CU.

Important:

> Source commitment does not mean every derived interpretation is certain.

A committed CU may still contain:

- ambiguous reference;
- unresolved pronoun;
- unresolved function;
- uncertain quote boundary.

The honest state remains unresolved.

---

# D5. Pre-commit transcription revision

Suppose the actual user audio is:

> «أنا كلمت حسام امبارح.»

During live ASR:

1. «أنا كلمت أحـ...»
2. «أنا كلمت أحمد امبارح»
3. final decoder correction:
   «أنا كلمت حسام امبارح»

There is no evidence that the user ever said or intended `أحمد`.

Therefore:

- the provisional Ahmed reading disappears;
- no committed CU about Ahmed ever exists;
- no correction act exists;
- no historical contradiction exists.

This is **transcription revision**.

---

# D6. Genuine user self-correction

Actual user audio:

> «أنا كلمت أحمد امبارح... لا، قصدي حسام.»

Here the corrective act exists in the source itself.

Final committed source therefore preserves it.

Possible segmentation:

**CU-1**

> «أنا كلمت أحمد امبارح»

`INFORM_REPORT`

**CU-2**

> «لا، قصدي حسام»

`INFORM_REPORT + CORRECT`

target = CU-1

correction owner = SELF

Stage 1.2 identifies that this is genuine conversational correction.

It **does not yet specify** whether CU-1 becomes superseded, withdrawn, historically active-until-corrected, etc.

That belongs to Stage 1.7.

---

## D7. Abandoned partial speech

User:

> «أنا كنت... لا بص، خليني أقولها بطريقة تانية...»

The fragment:

> «أنا كنت...»

does not automatically become a committed CU simply because words exist.

If it never communicated enough stable meaning to become independently addressable, it remains source material without a semantic CU.

By contrast:

> «المعاد الخميس... لا، الجمعة.»

does contain enough prior meaning for the Thursday portion to constitute a CU and the Friday portion to constitute a correction CU.

---

## D8. Processing normalization must not replace source truth

Whitespace cleanup, tokenization, Arabic normalization or code-switch processing may help analysis.

But Stage 1.2 freezes:

> **Committed surface wording remains authoritative source material.**

An analysis-friendly normalized form—if later introduced—must remain derivative and must not erase:

- dialectal particles;
- negation morphology;
- code-switching;
- hesitation;
- correction cues;
- quoted wording;
- ambiguity-bearing surface forms.

---

# E. EGYPTIAN-ARABIC WORKED CASES

## Case E1 — One runtime turn, several CUs

User:

> «أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني. ممكن نرجع لموضوع السفر؟»

### Segmentation

**CU-1**

> «أنا سبت الشغل امبارح.»

`INFORM_REPORT`

**CU-2**

> «وبالمناسبة أحمد كلمني.»

`INFORM_REPORT`

May also carry `FOCUS_SHIFT` if the redirection is structurally explicit in context.

**CU-3**

> «ممكن نرجع لموضوع السفر؟»

`REQUEST + FOCUS_SHIFT`

No Thread is created by Stage 1.2.

---

# Case E2 — ASR revision versus self-correction

### A — Decoder changed

Live hypothesis:

> «أنا كلمت أحمد...»

Committed transcription:

> «أنا كلمت حسام.»

Only Hossam survives.

No Ahmed CU.

No `CORRECT`.

### B — User changed what he said

> «أنا كلمت أحمد... لا، قصدي حسام.»

CU-1 = Ahmed report.

CU-2 = `CORRECT` targeting CU-1.

These two scenarios must never be conflated.

---

# Case E3 — Pronoun ambiguity

User:

> «قابلت أحمد وخالد امبارح.»

Later:

> «هو قالّي إنه ناوي يسيب الشغل.»

Available conversational referents:

- R1 = Ahmed
- R2 = Khaled

`هو`:

`AMBIGUOUS {R1, R2}`

Therefore reported-claim attribution remains ambiguous.

QANDEEL cannot use the sentence as definitive downstream evidence about Ahmed or Khaled.

---

# Case E4 — Recoverable ellipsis

QANDEEL:

> «إمتى كلمت أحمد؟»

User:

> «بعد الشغل.»

The user CU is:

- committed surface = «بعد الشغل»
- function = `INFORM_REPORT`
- sequence position = `RESPONSIVE`
- local target = preceding question
- ellipsis dependency = resolved through that question.

QANDEEL does not fabricate replacement source wording.

---

# Case E5 — Unrecoverable omitted subject

User:

> «أحمد وخالد كانوا عندي. بعدها سافر.»

Who travelled?

The Arabic surface does not establish it sufficiently.

Result:

`OMITTED_SUBJECT → AMBIGUOUS {Ahmed, Khaled}`

—not “probably Ahmed.”

---

# Case E6 — Same name, two people

> «أحمد صاحبي في المكتب كلمني.»

Later:

> «أحمد أخويا وصل من السفر.»

Reference handles:

- R-A = Ahmed / work friend
- R-B = Ahmed / brother

Later:

> «هو عايز يقابلني بكرة.»

If both remain plausible:

`هو → AMBIGUOUS {R-A, R-B}`.

Names are not automatically merged.

---

# Case E7 — Direct quoted speech

> «أحمد قالّي: أنا مش رايح بكرة.»

Conversational speaker:

USER

Quoted content:

> «أنا مش رايح بكرة»

Claim source:

Ahmed

`أنا` inside the quote:

Ahmed

User endorsement:

`NOT_ESTABLISHED`

QANDEEL is entitled to know:

> the user reports Ahmed as saying this.

It is not entitled from this CU alone to know:

> the user agrees with Ahmed;
> Ahmed will objectively not go tomorrow.

---

# Case E8 — Report + user's own stance

> «أحمد قال إنه مش جاي، بس أنا honestly مش مصدقه.»

**CU-1**

> «أحمد قال إنه مش جاي»

`INFORM_REPORT`

reported claim source = Ahmed

**CU-2**

> «بس أنا honestly مش مصدقه»

`INFORM_REPORT + DISAGREE_CHALLENGE`

claim source = USER

target = reported Ahmed claim.

`honestly` creates no segmentation consequence beyond the conversational structure already present.

---

# Case E9 — Acknowledgment is not agreement

QANDEEL:

> «يمكن أنت زعلان عشان حسيت إنهم تجاهلوك.»

User:

> «فاهمك، بس مش مقتنع إن ده السبب.»

**CU-1**

> «فاهمك»

`ACKNOWLEDGE`

**not automatically** **`AGREE`**

**CU-2**

> «بس مش مقتنع إن ده السبب»

`INFORM_REPORT + DISAGREE_CHALLENGE`

`ده` binds to the preceding proposed explanation if uniquely identifiable.

This prevents QANDEEL from recording false agreement.

---

# Case E10 — Reported-speech ambiguity must survive

> «أحمد قال إن محمد كلمه وهو متضايق.»

Stage 1.2 can establish:

- conversational speaker = USER;
- Ahmed = reported speaker;
- Mohamed = mentioned participant.

But:

> «هو متضايق»

may describe Ahmed or Mohamed.

Therefore:

`هو → AMBIGUOUS {Ahmed, Mohamed}`

No guess.

No false claim attribution.

---

# Case E11 — Clarification around identical names

QANDEEL:

> «تقصد أحمد صاحبك؟»

User:

> «لا، أحمد أخويا.»

The user CU can carry simultaneously:

- `INFORM_REPORT`
- `CLARIFY`
- `DISAGREE_CHALLENGE`

and target the assistant's prior interpretation.

It does not need to be cloned into three CUs merely because three conversational functions exist.

---

# Case E12 — Partial live code-switching

Live user speech:

> «أنا كنت okay مع الموضوع بس... actually لا، خليني أقولها صح... أنا كنت متوتر من الأول.»

Before completion:

several provisional CUs may temporarily be proposed.

Committed source contains a genuine speaker restart/correction cue:

> «actually لا، خليني أقولها صح»

This is not an ASR correction merely because it occurs during streaming.

The distinction is determined by whether the corrective behavior exists in the **user's source speech**, not by whether the transcript happened to be unfinished at the time.

---

# F. GATE 1.2 RESULT

The frozen Stage 1.2 gate requires the model to prove segmentation, provenance, provisional truth restraint, reference ambiguity handling and accurate reported-speech attribution before Thread establishment may begin.

| Gate 1.2 requirementStage 1.2 result                                         |                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Meaningful units can be segmented consistently enough for downstream grammar | **PASS** — CU is independently addressable, contiguous, single-turn, source-anchored                          |
| Unstable provisional speech does not create permanent truth prematurely      | **PASS** — provisional material has zero durable analytical authority                                         |
| Finalized units have stable provenance                                       | **PASS** — committed parent turn + stable span + surface + speaker state                                      |
| Transcription revision differs from user self-correction                     | **PASS** — decoder mutation vs correction present in user's source behavior                                   |
| Pronouns/ellipsis/references resolve or remain explicitly unresolved         | **PASS** — `RESOLVED / AMBIGUOUS / UNRESOLVED` contract                                                       |
| Repeated names are not automatically collapsed                               | **PASS** — same-name referents retain distinct conversational handles absent grounding                        |
| Reported/quoted claims retain correct attribution                            | **PASS** — conversational speaker ≠ embedded claim source                                                     |
| Future Thread establishment cannot rely on falsely attributed material       | **PASS** — unresolved attribution/reference cannot be promoted into attribution-dependent downstream evidence |
| One utterance may perform several functions without duplicated source        | **PASS** — functions are a set on one canonical CU                                                            |
| Existing QANDEEL semantics remain untouched                                  | **PASS** — Turn, Evidence, Memory, INTENT\_PROVIDER, runtime Event and hrs.repair are not redefined           |

## GATE 1.2 RESULT: **PASS**

There is no evidence gap or contradiction requiring Stage 1.1 to reopen.

The remaining deferred questions are correctly owned by later frozen stages:

- Thread establishment → Stage 1.3
- source-bearing/world Event identity → Stage 1.4
- final relations/Evidence participation → Stage 1.6
- historical correction/revision consequences → Stage 1.7

These are scoped deferrals, not Stage 1.2 blockers.

---

# G. STAGE 1.2 FREEZE CANDIDATE

The following is the proposed material to freeze if Stage 1.2 is approved.

## CU-01 — Unit hierarchy

`conversation_turn` remains the operational runtime envelope.

Utterance is a source/linguistic segmentation concept.

**Conversational Unit (CU)** becomes Stage 1's smallest canonical conversational-analysis unit.

---

## CU-02 — CU containment

A CU:

- belongs to exactly one runtime turn;
- is contiguous;
- may be smaller than a turn;
- may equal a turn;
- **never spans multiple turns in v1**.

Cross-turn meaning is composed through later sequence/Thread/relationship grammar, not by stretching CU identity across turns.

---

## CU-03 — Independent-addressability segmentation

Create separate CUs for independently addressable conversational contributions.

Do not segment merely on punctuation, pause, syntax or language switch.

---

## CU-04 — Multi-function identity

One CU may carry multiple relevant functions.

Functions never require duplicating the underlying conversational source.

---

## CU-05 — Minimum function vocabulary

Freeze the minimum Stage 1.2 function set as:

- `INFORM_REPORT`
- `ASK`
- `REQUEST`
- `ACKNOWLEDGE`
- `AGREE`
- `DISAGREE_CHALLENGE`
- `ELABORATE`
- `CLARIFY`
- `CORRECT`
- `RECALL`
- `FOCUS_SHIFT`

with `FUNCTION_UNRESOLVED` permitted rather than forced classification.

No larger universal Dialogue Act taxonomy is adopted.

---

## CU-06 — Minimal sequence position

Only:

- `UNMARKED`
- `INITIATING`
- `RESPONSIVE`
- `FOLLOW_UP`

plus local target-CU binding where necessary.

This is **not** the final discourse-relation registry.

---

## CU-07 — Provisional material has no permanent analytical authority

Partial/live input and tentative CUs may be useful for immediate response.

They cannot create durable analytical truth while their source wording or boundary remains unstable.

---

## CU-08 — Commitment

A CU may commit once:

- source is stable;
- boundary is stable enough;
- speaker state is stable or explicitly unresolved;
- stable provenance back to the runtime turn/source span exists.

Canonical CU identity begins at commitment.

---

## CU-09 — Transcription revision ≠ user self-correction

ASR/streaming revision changes provisional interpretation.

User self-correction is a conversational act present in the source itself.

The latter produces committed conversational material.

Its historical effects remain Stage 1.7 work.

---

## CU-10 — Three-state reference resolution

Every materially relevant reference may be:

- `RESOLVED`
- `AMBIGUOUS`
- `UNRESOLVED`

QANDEEL is never required to guess merely to produce a complete structure.

---

## CU-11 — Same name ≠ same referent

Repeated lexical names are cues, not identity proof.

Multiple Ahmeds may coexist as separate conversational reference handles.

---

## CU-12 — Pronouns, omitted subjects and ellipsis

Resolve them only when surrounding conversation supplies sufficient unique grounding.

Otherwise preserve ambiguity/unresolved state.

Elliptical completion must never replace the user's actual committed wording.

---

## CU-13 — Conversational speaker ≠ claim source

Current-conversation speaker attribution and embedded claim/report/quotation attribution remain independent.

`Ahmed said X` never becomes `user claims/believes X` solely because the user uttered the reporting sentence.

---

## CU-14 — Quotation changes attribution frame

Pronouns and deictic expressions inside resolved direct quotation are interpreted relative to the quoted speaker/frame where linguistically warranted.

If the quote source or boundary is ambiguous, attribution remains unresolved.

---

## CU-15 — Code-switching is semantically ordinary

Arabic ↔ English switching does not itself:

- create a CU;
- create a new referent;
- change speaker;
- establish a new conversational focus.

Reference continuity crosses language boundaries when sufficiently grounded.

---

## CU-16 — Unresolved attribution blocks unsafe downstream promotion

A CU may exist while its reference or claimant remains ambiguous.

But any later Thread or analytical claim that requires knowing that identity may not treat the unresolved material as if identity were known.

---

## CU-17 — Existing QANDEEL semantics remain intact

Stage 1.2 does not redefine:

- `conversation_turn`;
- QANDEEL Memory;
- QANDEEL Evidence;
- Hypothesis Evidence participation;
- `INTENT_PROVIDER`;
- runtime Events;
- `hrs.repair`;
- current Question/Information-Gap semantics.

A CU is a new conversational-analysis substrate underneath later Stage 1 grammar—not a replacement for those systems.

---

# STAGE 1.2 STATUS

**Proposed Contract:** COMPLETE
**Gate 1.2:** **PASS**
**Freeze Candidate:** READY FOR PRODUCT-OWNER APPROVAL
**Stage 1.1:** remains CLOSED
**Stage 1.3:** **NOT STARTED**

Execution stops here.