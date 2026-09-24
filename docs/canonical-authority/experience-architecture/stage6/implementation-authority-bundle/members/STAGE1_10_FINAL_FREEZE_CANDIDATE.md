# QANDEEL — STAGE 1.10

## Adversarial Grammar Validation + Final Freeze

**Status:** `STAGE 1.10 FREEZE CANDIDATE — AWAITING PRODUCT-OWNER APPROVAL`
**Stage 1.1–1.9:** `APPROVED / FROZEN / CLOSED`
**Stage 2:** `NOT STARTED`

---

# A. ADVERSARIAL VALIDATION STRATEGY

The system under test is the complete frozen Stage 1.1–1.9 contract.

The test objective was:

> **Find circumstances under which the grammar is forced to assert more structure than the conversation actually warrants.**

A successful grammar therefore does **not** maximize extracted objects or relations.

A successful result may be:

- unresolved reference;
- no canonical Event;
- no Thread promotion;
- no Conversation Transition;
- no GSR;
- no causal relation;
- no Reading;
- multiple unresolved Readings;
- no Evidence Participation;
- no Unknown;
- no Question;
- no correction/supersession;
- incomplete historical knowledge.

## A1. Holdout discipline

Because the same model performing the validation necessarily knows the Stage 1 grammar, this cannot be statistically blind in the experimental sense.

To preserve holdout discipline as far as possible:

1. the Egyptian-Arabic dialogue below was authored first as a natural conversation;
2. no Stage 1 IDs, classifications, expected relations or test labels were placed inside it;
3. the transcript was then treated as **sealed**;
4. the subsequent analysis did not rewrite dialogue turns to make the grammar succeed;
5. analysis proceeds forward from H01 to H32;
6. future turns are forbidden from changing what QANDEEL was entitled to know at earlier `K(t)` snapshots.

The holdout is intentionally not a checklist. Several phenomena occur naturally; several Stage 1 structures never become warranted.

---

## A2. Five attack layers

### Layer 1 — Source attack

Try to force:

- excessive CU segmentation;
- propositions from incomplete speech;
- committed input to be mistaken for provisional input;
- speaker/claimant conflation.

### Layer 2 — Identity attack

Try to force:

- same-name collapse;
- pronoun/reference guessing;
- Event coreference from lexical similarity;
- Thread establishment from entity recurrence.

### Layer 3 — Relation attack

Try to force:

- semantic relation from conversational adjacency;
- causality from temporal order;
- Conversation Transition across non-Thread digressions;
- Evidence Participation from simple source relevance.

### Layer 4 — Analytical attack

Try to force:

- premature Reading;
- Reading from user belief alone;
- winner/ranking between plausible Readings;
- Unknown proliferation;
- unnecessary Questions;
- false resolution.

### Layer 5 — Historical attack

Try to force:

- retroactive reference resolution;
- correction overwrite;
- future evidence appearing in past state;
- later Reading backdated to earlier source time;
- current truth replacing historically defensible earlier state.

---

# B. INDEPENDENTLY AUTHORED EGYPTIAN-ARABIC HOLDOUT

### H01 — USER

أنا دماغي مش رايقة من امبارح. حاسس موضوع الشغل بيتقلب بس مش عارف أنا مكبره ولا لأ.

### H02 — QANDEEL

إيه اللي حصل امبارح؟

### H03 — USER

بعد الميتنج أحمد شدني على جنب وقاللي: خلي بالك من موضوع التجديد. وبعدين قال حاجة زي أنا ماليش دعوة لو حصل تأخير، ولسه هيتكلم معاه... أو معاهم، مش فاكر.

### H04 — QANDEEL

أحمد مين؟ وإنت فاهم التجديد هنا عقدك ولا تمديد المشروع؟

### H05 — USER

أحمد بتاع الـPMO، مش أحمد ابن خالي. ابن خالي كان كلمني قبلها بس في حاجة تانية. والتجديد أنا فهمته عقدي تلقائي، بس مش متأكد.

### H06 — QANDEEL

في حاجة تانية خلتك تفهمه على إنه عقدك؟

### H07 — USER

سارة كانت قالتلي من يومين: هم موافقين مبدئيًا. وبعدها على طول قالت ما تعتمدش على كلامي. بس هي قبلها كانت بتتكلم عن الـextension والـbudget، فمش عارف كانت تقصد إيه بالظبط.

### H08 — QANDEEL

تمام، يبقى كلام سارة لوحده لسه ما يحسمش المقصود.

### H09 — USER

وحسام بعتلي بعد كلام أحمد بنص ساعة: كلمني بكرة قبل ما ترد. من غير أي context.

### H10 — QANDEEL

تعرف هو كان مستني منك رد على إيه؟

### H11 — USER

لا. أنا ربطت الرسالتين عشان الوقت بس. ممكن يكونوا مالهمش علاقة ببعض أصلًا.

### H12 — QANDEEL

آه، لحد هنا التوقيت لوحده مش كفاية يربطهم.

### H13 — USER

بس أصل أحمد قاللي قبل كده إن الشركة دي بتقفل ناس فجأة، فدماغي راحت للوحش.

### H14 — USER

لا استنى، أنا لخبطت. اللي قاللي كده أحمد ابن خالي، مش أحمد الـPMO. الاتنين اسمهم أحمد وأنا دمجتهم في دماغي.

### H15 — QANDEEL

تمام. يبقى التحذير القديم ماينفعش ننسبه لأحمد الـPMO.

### H16 — USER

ابن خالي نفسه كلمني امبارح على السعودية وقال لو الدنيا وقفت هنا أبقى أكلمه، وإن فيه مكان عندهم.

### H17 — QANDEEL

هو قالك على فرصة فعلية ولا كلام مبدئي؟

### H18 — USER

لما سألته اسم الشركة قاللي استنى لما أتأكد. فمفيش offer يعني، هو بس فتح الكلام.

### H19 — USER

وبعدين هاجر قالتلي وشك متغير. أنا قلت يمكن عشان بابا كان تعبان... لا لا، ده كان الأسبوع اللي فات. امبارح بابا كان كويس. أنا اللي كنت مشدود.

### H20 — QANDEEL

تمام، يبقى مرض والدك مش تفسير مؤكد لتوترك امبارح.

### H21 — USER

أنا كنت...

### H22 — USER

سيبك. اللي مضايقني أكتر دلوقتي رسالة حسام: قبل ما ترد. أنا مش فاهم أرد على إيه أصلاً.

### H23 — QANDEEL

بصيت في الشات قبليها؟ فيه حاجة كنت باعتها له ممكن يكون بيرد عليها؟

### H24 — USER

آه، فيه رسالة مني الصبح بسأله عن إجازة نوفمبر. بس جملة قبل ما ترد مش راكبة عليها قوي. يمكن كان فيه message واتمسحت؟ معرفش.

### H25 — USER

استنى، سارة بعتتلي screenshot من الـmeeting notes دلوقتي. مكتوب: Project extension approved in principle, individual renewals pending budget confirmation.

### H26 — QANDEEL

ده يوضح إن موافقين مبدئيًا كانت على تمديد المشروع، بينما تجديدات الأفراد لسه معلقة على تأكيد الـbudget.

### H27 — USER

بالظبط. بس أحمد لما قاللي خلي بالك من التجديد كان يقصد انهي واحدة؟ دي لسه مش عارفها.

### H28 — QANDEEL

من الكلام الموجود لحد دلوقتي ما نقدرش نحسمها.

### H29 — USER

أنا حاسس إنه كان بيلمّح إن عقدي في خطر.

### H30 — QANDEEL

ممكن تكون دي قراءة، وفي قراءة تانية إنه كان بيتكلم عن عملية التجديد عمومًا. لسه مفيش حاجة ترجّح واحدة بشكل محترم.

### H31 — USER

طب بكرة أسأله مباشرة: كنت تقصد عقدي أنا ولا تمديد المشروع؟

### H32 — QANDEEL

ده سؤال مباشر على النقطة اللي لسه مفتوحة.

---

# C. SEQUENTIAL HOLDOUT ANALYSIS

## H01–H02 — Initial focus

`Work / current job uncertainty` can legitimately become an **Established Thread**.

Reason:

- it is explicitly selected by the user;
- it is the reason the conversation begins;
- it has independent user-addressable significance.

This is not promotion because the word "الشغل" occurred.

It is promotion because the user explicitly opened a sustained concern around it.

No Reading yet.

No Event yet beyond the broad reported state that something happened yesterday.

---

## H03 — Ambiguous Ahmed + reported encounter

H03 contains several independently addressable committed CUs, approximately:

1. after the meeting, Ahmed pulled the user aside;
2. Ahmed said: «خلي بالك من موضوع التجديد»;
3. Ahmed said something similar to «أنا ماليش دعوة لو حصل تأخير»;
4. Ahmed would speak to `him/them`, wording uncertain.

This segmentation is warranted because each span contributes a distinct proposition or reported act.

### What must NOT happen

Do not create ten CUs from every clause fragment.

Do not treat:

> «معاه... أو معاهم، مش فاكر»

as a resolved referent.

Do not treat uncertain recalled wording as exact quotation.

### Reference state

`Ahmed` is not yet safely identity-resolved.

There is enough grounding for a reported encounter Event such as:

> a post-meeting side conversation with a person named Ahmed

while preserving the participant reference as unresolved.

The Event can exist without pretending the participant identity has already been solved.

### Unknown

Ahmed's identity is analytically material because the conversation depends on what this person knows and previously said.

Therefore a bounded Unknown is warranted:

> Which Ahmed was the speaker in the post-meeting conversation?

H04 is consequently a legitimate Question.

No Ahmed Thread is established yet.

No Reading about contract risk is justified.

---

## H04–H05 — Reference resolution without hindsight

H05 resolves:

`Ahmed = Ahmed from PMO`

and explicitly distinguishes:

`Ahmed from PMO ≠ cousin Ahmed`.

This is a genuine reference-resolution update.

It does **not** mean `K(H03)` may now show that QANDEEL already knew Ahmed meant the PMO person.

Historical state remains:

> H03: Ahmed identity unresolved.

Current state after H05 becomes:

> the H03 reference is now resolved to PMO Ahmed, resolution availability = H05.

That distinction is load-bearing.

### “Renewal”

The user says:

> «أنا فهمته عقدي تلقائي، بس مش متأكد.»

This establishes the user's interpretation.

It does **not** establish what Ahmed meant.

No semantic equivalence may be asserted between:

- project extension;
- user's individual contract renewal.

---

## H06–H08 — Sara's ambiguous report

H07 introduces reported speech:

> Sara said: «هم موافقين مبدئيًا.»

Claimant chain remains approximately:

**USER reports → Sara asserted → “they approved in principle.”**

QANDEEL must not collapse this into:

> USER asserts that the user's contract was approved.

Nor:

> Sara confirmed the user's individual contract.

The surrounding extension/budget discussion creates genuine scope ambiguity.

A meaningful Unknown is therefore warranted:

> What did Sara's “approved in principle” apply to?

No Reading such as:

> “the user's contract is probably approved”

is justified.

H08's refusal is correct.

---

## H09–H12 — Temporal proximity trap

H09 creates a new reported Event:

> Hossam sent “call me tomorrow before you reply.”

The user explicitly says it happened approximately 30 minutes after the Ahmed interaction.

This is sufficient for:

`Ahmed encounter TEMPORALLY_PRECEDES Hossam message`

assuming both Event endpoints are represented.

It is **not** sufficient for:

- `CAUSES`;
- `CONTRIBUTES_TO`;
- semantic coordination;
- same hidden management decision;
- evidential support for contract danger.

H11 actually strengthens the refusal:

> «ممكن يكونوا مالهمش علاقة ببعض أصلًا.»

The grammar passes because temporal adjacency can remain merely temporal.

---

## H13–H15 — Same-name claimant corruption attack

At H13 the user commits the claim:

> PMO Ahmed previously said the company suddenly lets people go.

At H14 the user explicitly corrects that committed attribution:

> the speaker was cousin Ahmed, not PMO Ahmed.

This is a **genuine user self-correction**, not ASR/transcription revision.

The committed H13 source must remain historically inspectable.

H14 creates a correction relation to H13.

Current analytical use changes.

Historical source does not disappear.

### Forbidden behavior

Do not silently rewrite H13 so that the historical transcript now says cousin Ahmed.

Do not maintain PMO Ahmed as claimant after H14.

Do not globally rewrite every analytical object in the conversation.

Only downstream objects actually grounded in the incorrect attribution require reassessment.

### Thread identity

This correction does **not** invalidate the PMO Ahmed focus itself.

The current PMO discussion was independently established by the post-meeting interaction.

Thus a corrected supporting detail must not destroy an otherwise grounded Thread.

---

## H16–H18 — Entity mention versus new independent focus

Cousin Ahmed is no longer merely the same-name correction target.

H16 deliberately moves into a separate possible Saudi work alternative.

H17–H18 develop it independently.

A legitimate Thread could therefore emerge around:

> **Saudi work alternative**

not simply around the entity “Ahmed”.

This demonstrates the Stage 1 rule:

> Entity ≠ Thread.

The same cousin participates in the focus, but the conversational locus is the possible alternative job path.

### Event restraint

The cousin says:

> «فيه مكان عندهم.»

But H18 establishes that:

- company identity is unknown;
- cousin has not confirmed the opportunity.

Therefore:

**NO canonical “job offer received” Event.**

At most there is:

> a reported conversation about a possible opportunity.

The hypothetical/prospective possibility must remain prospective.

---

## H19–H20 — Intra-turn self-correction + causal trap

H19 naturally contains multiple CUs:

1. Hagar said the user's face looked different;
2. the user tentatively linked this to father's illness;
3. user corrects the timing;
4. father was fine yesterday;
5. user was personally tense.

The father's illness is corrected to:

> last week, not yesterday.

### What survives

The committed incorrect temporal thought remains part of conversational history.

The correction changes current interpretation.

### What must be refused

No `CAUSES` relation:

> father's illness → yesterday's tension.

The user has explicitly weakened/retracted the temporal basis.

Nor should “Hagar” or “father's illness” automatically become an Established Thread.

This is a short digression, not persistent user-addressable attention.

---

## H21 — Incomplete committed speech

> «أنا كنت...»

This is important.

The turn is **committed**, despite being linguistically incomplete.

Therefore:

**Committed incomplete CU ≠ provisional input.**

The grammar should preserve it as source material.

It must not invent:

- what the user was doing;
- an omitted Event;
- an implied intention;
- an Unknown called “what was the user going to say?” merely because the sentence is incomplete;
- a Reading from the abandoned phrase.

No permanent proposition beyond the actual incomplete source is warranted.

This is a PASS.

---

## H22–H24 — Hossam becomes independently important

At H22 the user explicitly selects the Hossam message as:

> «اللي مضايقني أكتر دلوقتي».

That is much stronger than incidental mention.

A persistent focus around:

> **Hossam's unexplained “before you reply” message**

may now qualify for Thread establishment.

H23 asks a bounded question about prior context.

H24 supplies one candidate context—the November vacation question—but says it does not clearly explain Hossam's wording.

The user then speculates:

> «يمكن كان فيه message واتمسحت؟»

That is hypothetical material.

Therefore:

**NO canonical Event “Hossam deleted a message.”**

Only a hypothetical Event Mention is justified.

The target of “قبل ما ترد” remains unresolved.

---

## Conversation Transition stress at H19→H22

A particularly dangerous false structure would be:

`Saudi alternative → Hossam message`

simply because those are the last two Established Threads mentioned.

But between them the actual conversation moved through the Hagar/father digression.

Stage 1 Conversation Transition is occurrence-specific attention movement between Established Threads.

It must not manufacture a direct transition merely to make the Thread graph continuous.

The CU sequence itself preserves the digression.

Therefore a direct Saudi→Hossam transition may legitimately be **absent**.

This is truthful refusal, not missing data.

---

## H25–H26 — New documentary report without source inflation

At H25 the user reports receiving a screenshot whose text says:

> `Project extension approved in principle, individual renewals pending budget confirmation.`

Important provenance distinction:

QANDEEL has received a **user report of screenshot contents**.

Unless the actual artifact was independently ingested and verified, Stage 1 must not pretend it possesses direct documentary source authority beyond that chain.

However the new reported text materially clarifies the earlier ambiguity around Sara's:

> «هم موافقين مبدئيًا.»

It supports the interpretation that the “approved in principle” statement concerned the project extension.

The earlier Unknown about Sara's statement can now be resolved.

### It does NOT resolve

what PMO Ahmed meant by:

> «موضوع التجديد».

The screenshot proves neither Ahmed's intended referent nor private knowledge.

---

## H27–H28 — Correctly persistent Unknown

The unresolved proposition is now sharply bounded:

> When Ahmed warned about “renewal,” did he mean the user's individual renewal or the project-extension/renewal process?

This Unknown remains OPEN.

It is analytically meaningful.

It should **not** be marked resolved merely because:

- project extension is now clarified;
- the user has a guess;
- there are only two plausible alternatives.

H28's refusal is correct.

---

## H29 — User interpretation is not automatically QANDEEL Reading

The user states:

> «أنا حاسس إنه كان بيلمّح إن عقدي في خطر.»

This is source material representing the **user's interpretation**.

It is not automatically identical to a QANDEEL Reading.

The grammar must preserve:

> USER believes/suspects X

versus:

> QANDEEL analytically proposes X.

This claimant distinction passes.

---

## H30 — Multiple Readings without winner

Only now does QANDEEL itself explicitly form two bounded interpretations.

### Reading R1

Ahmed's warning may have referred specifically to the user's individual renewal being at risk.

### Reading R2

Ahmed's warning may have referred to the general project/renewal process rather than the user's personal contract outcome.

Both can coexist.

Neither is selected as winner.

Neither is automatically ranked.

### Evidence Participation restraint

The Ahmed source utterance is relevant to both.

The meeting-note report narrows the landscape of possible meanings.

But it does not prove Ahmed's intention.

H29—the user's feeling—is **not independent evidence of Ahmed's intention** merely because it matches R1.

Likewise H30, QANDEEL's own analysis utterance, must not become self-evidence for either Reading.

A Record's existence does not automatically create Evidence Participation.

---

## H31–H32 — User ASK versus analytical Question

H31 is a USER dialogue act:

`ASK`

and also contains the user's proposed external question to Ahmed:

> «كنت تقصد عقدي أنا ولا تمديد المشروع؟»

The canonical analytical Unknown already existed before H31.

A corresponding analytical Question may exist with the bounded objective:

> determine Ahmed's intended referent for “renewal.”

But these objects remain distinct:

- USER ASK;
- QANDEEL analytical Question;
- future real-world question to Ahmed.

They must not be collapsed because their surface wording is similar.

---

# C2. Final holdout state

At H32 a defensible analytical state includes roughly:

### Established conversational attention

- Work/job uncertainty;
- PMO Ahmed's warning;
- possible Saudi alternative;
- Hossam's unexplained message.

Not every person mentioned becomes a Thread.

### Source/world objects

- post-meeting Ahmed encounter;
- Sara's reported statement;
- Hossam message;
- cousin's Saudi conversation;
- father's illness last week;
- reported arrival of meeting-note screenshot;
- project extension's reported in-principle approval;
- individual renewals reported as pending budget confirmation.

### Open analytical uncertainty

- Ahmed's intended meaning of “renewal”;
- what Hossam meant by “before you reply”.

### Resolved uncertainty

- which Ahmed spoke after the meeting;
- attribution of the old “company suddenly lets people go” statement;
- scope of Sara's “approved in principle”.

### Coexisting Readings

- Ahmed warning was personal-contract-specific;
- Ahmed warning was about renewal process generally.

### Explicitly absent

- causal Ahmed→Hossam relation;
- deleted-message Event;
- actual Saudi job-offer Event;
- father illness→yesterday tension cause;
- Reading winner;
- direct evidence that user's contract will not renew.

---

# D. FALSE-POSITIVE / FALSE-STRUCTURE ATTEMPTS

| AttackTempting false structureCorrect Stage 1 result     |                                        |                                                            |
| -------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| H03 long compound sentence                               | CU per grammatical clause/token        | Only independently addressable meaningful spans            |
| H21 incomplete sentence                                  | infer omitted proposition              | **NO proposition / NO Event / NO Reading**                 |
| H21 committed incompleteness                             | treat as provisional input             | **REFUSE** — committed incomplete source remains committed |
| H03 Ahmed                                                | resolve immediately                    | **UNRESOLVED until H05**                                   |
| H03/H13 same name                                        | merge both Ahmeds                      | **REFUSE**                                                 |
| H13 prior warning                                        | attribute permanently to PMO Ahmed     | **CORRECT at H14, preserve H13 history**                   |
| repeated “Ahmed”                                         | automatically create one Thread        | **REFUSE entity→Thread shortcut**                          |
| Sara's “approved”                                        | user's contract approved               | **REFUSE until scope is grounded**                         |
| identical “renewal” wording                              | project extension = personal renewal   | **REFUSE Event/object collapse**                           |
| H09 after 30 minutes                                     | Ahmed caused Hossam message            | **NO CAUSAL RELATION**                                     |
| H09 timing                                               | semantic coordination                  | **NO semantic relation**                                   |
| H16 “there's a place”                                    | job offer Event                        | **NO actual offer Event**                                  |
| H19 father illness                                       | caused yesterday stress                | **NO CAUSES**                                              |
| H24 “maybe deleted”                                      | deleted-message Event                  | **NO canonical Event**                                     |
| H29 user feeling                                         | QANDEEL Reading already proven         | **NO** — preserve claimant                                 |
| H29 user feeling                                         | evidence supporting R1                 | **NO independent Evidence Participation**                  |
| H30 two Readings                                         | select strongest automatically         | **NO WINNER / NO RANKING**                                 |
| H25 new source                                           | retroactively know scope at H07        | **NO HINDSIGHT**                                           |
| H14 correction                                           | erase H13                              | **NO DELETION**                                            |
| unresolved pronoun                                       | create referent by plausibility        | **UNRESOLVED**                                             |
| every unresolved detail                                  | create Unknown                         | **REFUSE unless analytically material**                    |
| every Unknown                                            | ask user immediately                   | **NO — Question not mandatory**                            |
| user unable to know Ahmed's intent                       | keep asking user                       | **REFUSE repetitive/unanswerable inquiry**                 |
| QANDEEL H30 statement                                    | self-ground Reading from own statement | **NO CIRCULAR EVIDENCE**                                   |
| two adjacent Established Threads separated by digression | fabricate direct Transition            | **NO TRANSITION if occurrence not grounded**               |

All attacks were handled without changing frozen grammar.

---

# E. AMBIGUITY / REFUSAL TESTS

## E1. Same-name identity

**Input:** PMO Ahmed and cousin Ahmed.

**Required result:** two identities.

Before H05, identity remains unresolved.

**PASS.**

---

## E2. Uncertain reported wording

> «معاه... أو معاهم، مش فاكر.»

Neither alternative may be selected without grounding.

**PASS — unresolved source detail.**

---

## E3. Ambiguous semantic referent

> «التجديد»

could refer to:

- project extension/renewal;
- individual employment renewal.

Lexical repetition does not establish object identity.

**PASS.**

---

## E4. Reported speech

Sara's claim remains Sara's claim as reported by the user.

It does not become the user's own factual assertion merely through reporting.

**PASS.**

---

## E5. Hypothetical Event

> «يمكن كان فيه message واتمسحت»

does not create a deleted-message world Event.

**PASS.**

---

## E6. Uncertain recollection

The user can report approximate prior wording without the grammar converting approximation into exact quotation.

**PASS.**

---

## E7. Missing information that is NOT an Unknown

H21:

> «أنا كنت...»

does not warrant a canonical Unknown about what the user intended to finish saying.

Nothing establishes that recovering the missing phrase materially advances a grounded analytical objective.

**PASS.**

---

## E8. Missing information that IS an Unknown

Ahmed's intended meaning of “renewal” materially changes the user's understanding of employment risk.

This is bounded and analytically meaningful.

**Unknown warranted.**

**PASS.**

---

## E9. Unknown without mandatory Question

After the user has already said they do not know Ahmed's intended meaning, QANDEEL need not repeatedly ask them for the answer.

The Unknown may remain open.

**PASS.**

---

## E10. Brief digression without Thread promotion

Hagar/father material remains meaningful source material without requiring an Established Thread.

**PASS.**

---

# F. HISTORICAL K(t) / HINDSIGHT VALIDATION

## F1. Snapshot `K(H03)`

QANDEEL is entitled to know:

- user is concerned about work;
- an Ahmed spoke after a meeting;
- Ahmed warned about “renewal”;
- recalled wording is partly uncertain.

QANDEEL is **not** entitled to know:

- Ahmed = PMO Ahmed;
- “renewal” = user's personal contract;
- Sara's context;
- Hossam message;
- later correction.

### Hindsight attack

Show “PMO Ahmed” in an Analysis Replay at H03.

**FAILS truth contract.**

Correct replay must preserve unresolved identity.

---

## F2. Snapshot `K(H05)`

New knowledge:

- Ahmed resolved to PMO Ahmed;
- cousin Ahmed is a separate identity;
- user's own first interpretation was “my contract”.

This permits current resolution of the earlier reference.

It does not rewrite `K(H03)`.

**PASS.**

---

## F3. Snapshot `K(H07)`

Sara's “approved in principle” exists.

Scope remains ambiguous.

QANDEEL cannot yet know:

- project extension definitely approved in principle;
- individual renewal status.

The H25 screenshot report must not appear here.

**PASS.**

---

## F4. Snapshot `K(H09)`

QANDEEL now knows:

- Hossam sent a message around 30 minutes later.

QANDEEL may know:

`Ahmed encounter PRECEDES Hossam message`.

It does not know:

- whether the events are connected;
- whether Hossam knows what Ahmed said;
- whether either implies contract termination.

**PASS.**

---

## F5. Snapshot `K(H13)`

At this precise historical state, the user's committed assertion attributes the old “they let people go suddenly” statement to PMO Ahmed.

That is what QANDEEL had been told at that point.

The future H14 correction does not exist yet.

**PASS.**

---

## F6. Snapshot `K(H14+)`

The user corrects the claimant to cousin Ahmed.

Current state must stop using H13 as evidence about PMO Ahmed.

But historical `K(H13)` remains reconstructable.

This is exactly append-preserving correction.

**PASS.**

---

## F7. Snapshot `K(H24)`

The meeting-note screenshot has not arrived.

Therefore QANDEEL still cannot resolve Sara's “approved in principle” scope.

Any replay showing the H25 clarification at H24 would be hindsight leakage.

**PASS.**

---

## F8. Snapshot `K(H25+)`

The new reported meeting-note source becomes available now.

It may resolve the Sara-scope Unknown now.

Its underlying meeting/referenced time may be earlier.

Its **analysis availability time remains H25**.

Earlier source origin does not backdate knowledge.

**PASS.**

---

## F9. Snapshot `K(H29)`

The user has expressed a belief:

> Ahmed was hinting my contract is at risk.

But QANDEEL's explicit two-Reading analysis at H30 has not yet been formed.

Therefore `R1` and `R2` may not appear in `K(H29)` simply because the evidence later supports constructing them.

**PASS.**

---

## F10. Snapshot `K(H30+)`

Two QANDEEL Readings now exist.

Their source material reaches back to H03/H25.

Their **knowledge availability starts at H30**.

No Analysis Replay may display them at H03 merely because their evidence originated there.

**PASS.**

---

# G. STAGE 1.9 RUNTIME-MAPPING CONTRADICTION CHECK

The holdout was also used to attack the frozen Stage 1.9 mapping.

## G1. `conversation_turn` → Record = PARTIAL

The holdout contains:

- multiple CUs in one turn;
- nested reported speech;
- ambiguous claims;
- correction inside and across turns.

A whole-turn runtime object cannot alone represent these distinctions.

**Stage 1.9 conclusion remains correct.**

---

## G2. CU = GAP

H03 and H19 require multiple independently addressable CUs.

H21 demonstrates why semantic CU state cannot be derived simply from a complete proposition parser.

No current runtime CU layer exists.

**No contradiction.**

---

## G3. Dialogue/discourse functions = GAP

The holdout requires distinctions such as:

- ASK;
- CORRECT;
- reported INFORM;
- FOCUS SHIFT.

Existing hypothesis-generation `Intent` cannot represent them.

**No contradiction.**

---

## G4. Reference/coreference/attribution = GAP

The two Ahmeds and Sara's reported speech directly expose this gap.

**No contradiction.**

---

## G5. Thread lifecycle = GAP

Current runtime cannot durably represent:

- Work Thread;
- PMO Ahmed focus;
- Saudi alternative;
- Hossam-message focus;
- non-promoted father digression.

**No contradiction.**

---

## G6. narrated Event = GAP

The holdout requires distinguishing:

- actual/reported meeting conversation;
- possible Saudi opportunity;
- hypothetical deleted message;
- project-extension approval report.

Operational runtime events cannot substitute.

**No contradiction.**

---

## G7. Memory core = FIT

Nothing in the holdout requires redefining the existing Memory lifecycle.

Also:

> a user recalling something said previously

does **not** automatically require creating a canonical QANDEEL Memory object.

This confirms rather than weakens the Stage 1 distinction.

**No contradiction.**

---

## G8. Reading ↔ Hypothesis = PARTIAL

R1/R2 can be grounded directly in current conversational source material.

Existing Hypothesis Runtime is strongly aligned but its current evidence authority is primarily Memory-backed.

Thus exact 1:1 identity still cannot be safely forced.

**No contradiction.**

---

## G9. `EvidenceItem` = DIFFERENT

The holdout requires potential Evidence Participation from:

- source Records/CUs;
- reported world objects;
- contextual qualifiers.

Current `EvidenceItem` means a specific eligible Memory-backed projection.

Stage 1.9 correctly protected that distinction.

**No contradiction.**

---

## G10. Evidence Participation = PARTIAL

The holdout naturally needs:

- source material that supports interpretations;
- material that merely qualifies them;
- correction removing previously usable attribution.

The current SUPPORTING/CONTRADICTING Memory-Evidence subset cannot express all of this.

**No contradiction.**

---

## G11. Unknown ↔ Information Gap = PARTIAL

The holdout includes:

- reference identity uncertainty;
- message-target uncertainty;
- Ahmed-intent uncertainty.

Some can exist before or independently of a Hypothesis/Confidence target.

Therefore Stage 1.9's PARTIAL classification remains correct.

---

## G12. Question ↔ Question Candidate = PARTIAL

The holdout distinguishes:

- QANDEEL Question;
- USER ASK;
- question to an external person;
- Unknown with no immediately useful user-directed Question.

Existing Question Runtime remains valuable but narrower.

**No contradiction.**

---

## G13. source correction = GAP

H13→H14 cannot be represented by Memory supersession or Hypothesis contradiction without changing its meaning.

**No contradiction.**

---

## G14. Memory supersession = FIT

No Stage 1 rule requires replacing existing version/successor semantics.

**No contradiction.**

---

## G15. knowledge-availability time = PARTIAL

Existing timestamps/audits could support parts of H13→H14 or later analytical history.

But they cannot represent the complete holdout `K(t)` because CU/reference/Thread/Event history does not yet exist.

**No contradiction.**

---

## G16. Historical K(t) = GAP

The holdout makes this especially clear.

A correct replay needs to know that:

- Ahmed identity was unresolved at H03;
- resolved at H05;
- PMO attribution existed at H13;
- was corrected at H14;
- Sara scope was unresolved until H25;
- R1/R2 did not exist until H30.

Current runtime cannot reconstruct that complete state.

**Stage 1.9 GAP classification is confirmed.**

---

## G17. client-readable analysis state = GAP

Even existing Hypothesis/Memory/Question intelligence does not currently provide this complete conversational state to the client.

**No contradiction.**

---

## G18. Durable Intent/Association = DIFFERENT

Nothing in this holdout justifies reinterpreting:

- hypothesis-generation Intent as dialogue act;
- Evidence→Hypothesis Association as generic GSR.

Stage 1.9 terminology protection remains necessary.

**No contradiction.**

---

# H. GENUINE GRAMMAR FAILURES

## Result: **NONE FOUND**

No adversarial case required changing a frozen Stage 1.1–1.9 contract.

Three areas produced significant pressure, but none constitutes a grammar failure.

---

## H1. Transition through an unestablished digression

The sequence:

Saudi option → father/Hagar digression → Hossam message

tempts the system to manufacture a direct Thread transition.

The frozen occurrence-specific Transition rule allows truthful refusal instead.

No reopening required.

---

## H2. Documentary content reported inside conversation

The screenshot example stresses provenance:

> direct source artifact versus user report of artifact contents.

The existing source/attribution/provenance distinction is sufficient.

No new “verified document” ontology is required for Stage 1 validity.

Implementation may later express richer provenance, but the grammar does not fail.

---

## H3. Same-turn correction

H19 contains an assertion and correction inside a single committed turn.

The CU model plus append-preserving correction handles it.

No requirement exists that correction must cross turn boundaries.

No reopening required.

---

# I. GATE 1.10 RESULT

| Validation requirementResult                             |          |
| -------------------------------------------------------- | -------- |
| Natural Egyptian-Arabic holdout authored before analysis | **PASS** |
| Holdout frozen before analytical classification          | **PASS** |
| Forward-only sequential analysis                         | **PASS** |
| CU false-positive attacks                                | **PASS** |
| committed vs provisional distinction                     | **PASS** |
| same-name identity attack                                | **PASS** |
| pronoun/reference ambiguity                              | **PASS** |
| reported/quoted claimant attribution                     | **PASS** |
| Thread overpromotion attack                              | **PASS** |
| Event overcreation attack                                | **PASS** |
| Event coreference attack                                 | **PASS** |
| Conversation Transition overcreation                     | **PASS** |
| temporal→causal fallacy attack                           | **PASS** |
| unsupported GSR attack                                   | **PASS** |
| premature Reading attack                                 | **PASS** |
| user-belief→QANDEEL-Reading conflation attack            | **PASS** |
| Reading ranking/winner attack                            | **PASS** |
| Evidence Participation overcreation                      | **PASS** |
| circular QANDEEL self-evidence attack                    | **PASS** |
| Unknown overproduction attack                            | **PASS** |
| Unknown false-resolution attack                          | **PASS** |
| unnecessary Question attack                              | **PASS** |
| correction overwrite attack                              | **PASS** |
| hypothetical→actual Event attack                         | **PASS** |
| K(t) reconstruction attack                               | **PASS** |
| hindsight-leakage attack                                 | **PASS** |
| Stage 1.9 runtime-mapping consistency                    | **PASS** |
| genuine cross-stage contradiction found                  | **NO**   |
| grammar silently patched                                 | **NO**   |
| implementation architecture introduced                   | **NO**   |
| Stage 2 begun                                            | **NO**   |

# GATE 1.10: **PASS**

---

# J. FINAL STAGE 1 FREEZE CANDIDATE

## QANDEEL Conversational Analysis Grammar / Data Reality v1

If explicitly approved, the following becomes the final consolidated Stage 1 truth contract.

---

## FINAL-01 — Committed source is analytical authority

Permanent conversational truth must ultimately derive from committed source material.

Provisional live input may support responsiveness but cannot prematurely create permanent analytical truth.

---

## FINAL-02 — Provisional revision ≠ user correction

ASR/streaming/normalization changes before commitment create no conversational correction history.

A user's genuine correction of committed content does.

---

## FINAL-03 — CU is the minimum independently addressable committed source unit

One turn may contain multiple CUs.

A CU:

- stays bound to source;
- does not cross turns;
- may be incomplete;
- may carry multiple functions where appropriate;
- does not become Evidence merely by existing.

---

## FINAL-04 — Incomplete committed speech remains incomplete

The grammar does not fill conversational gaps merely to create propositions.

---

## FINAL-05 — Speaker and claimant are separate truths

Who physically uttered a turn is not necessarily the claimant of embedded reported/quoted content.

Reported speech preserves attribution chain.

---

## FINAL-06 — Reference resolution may remain unresolved

Pronouns, omitted subjects, ellipsis, same-name people and reported references are never guessed merely for analytical convenience.

---

## FINAL-07 — Ambiguity is canonical information

`AMBIGUOUS` and `UNRESOLVED` are legitimate analytical states.

Truthful non-resolution is preferable to false identity.

---

## FINAL-08 — Entity/Mention ≠ Thread

Thread establishment requires genuine independent conversational attention and user-addressable significance.

---

## FINAL-09 — Emerging Focus is provisional

Emerging Focus does not receive permanent geography or established identity merely because QANDEEL finds it analytically interesting.

---

## FINAL-10 — Established Thread identity persists

Established Threads retain canonical identity through:

- Active;
- Dormant;
- Reopened.

Dormancy is not deletion.

Reopening does not create a duplicate Thread.

---

## FINAL-11 — Refinement ≠ reframing

Clarification of an existing focus preserves Thread identity.

A genuinely new independently addressable semantic focus creates a new Thread.

---

## FINAL-12 — Analysis alone cannot establish a Thread

QANDEEL analysis may strengthen an Emerging Focus.

Permanent Thread existence ultimately requires conversational grounding.

---

## FINAL-13 — Record, Memory and Event remain distinct canonical objects

No object exists simply because another one exists.

A Record does not automatically create:

- Memory;
- Event;
- Evidence;
- Reading.

---

## FINAL-14 — Event Mention ≠ canonical Event

Hypothetical, desired, uncertain or poorly identified material may remain merely an Event Mention.

Canonical Event existence requires sufficient identity and grounding.

---

## FINAL-15 — Reported/prospective Event status remains explicit

A reported or prospective Event may be canonical without being falsely converted into verified actualized truth.

---

## FINAL-16 — Event identity never follows lexical similarity alone

Repeated wording, dates, names or topic proximity cannot merge Events without grounded identity.

---

## FINAL-17 — Source-bearing material, grounded world objects and analytical objects remain epistemically distinct

Record/Utterance and Memory can carry source material.

Event is a grounded world representation.

Reading/Hypothesis, Unknown and Question are analysis/inquiry objects.

---

## FINAL-18 — Conversation Transition is attention history, not semantic relation

It records grounded, directional, occurrence-specific attention movement between Established Threads.

It asserts no:

- causality;
- support;
- hierarchy;
- semantic similarity.

---

## FINAL-19 — No Transition is required merely for graph continuity

A digression through non-established focus does not authorize an invented Thread-to-Thread edge.

---

## FINAL-20 — Grounded Semantic Relations require independent entitlement

Every GSR must answer:

> What specific conversational/analytical grounding entitles QANDEEL to assert this relation?

If the answer is insufficient:

**NO RELATION.**

---

## FINAL-21 — Temporal adjacency ≠ causality

`TEMPORALLY_PRECEDES` and `TEMPORALLY_OVERLAPS` do not imply `CAUSES` or `CONTRIBUTES_TO`.

---

## FINAL-22 — Relation vocabulary remains bounded

Stage 1 permits only grounded relations justified by the frozen grammar, including where applicable:

- CLARIFIES;
- CORRECTS;
- CHALLENGES;
- temporal relations;
- CAUSES;
- CONTRIBUTES\_TO;
- PART\_OF;
- narrow INCOMPATIBLE\_WITH.

No generic visual “connection” relation exists.

---

## FINAL-23 — Reading is bounded interpretation, not source truth

Every Reading requires:

- explicit analytical claim;
- target/context;
- inspectable grounding;
- canonical identity;
- availability time.

---

## FINAL-24 — Insufficient grounding may yield NO READING

QANDEEL does not owe the system an interpretation merely because an analysis view exists.

---

## FINAL-25 — Multiple plausible Readings may coexist indefinitely

No winner is required.

No ranking is automatic.

No “best interpretation” is mandatory.

---

## FINAL-26 — User interpretation ≠ QANDEEL Reading

A user's belief is source material attributed to that user.

It becomes QANDEEL's Reading only when QANDEEL independently forms the analytical object under its grounding contract.

---

## FINAL-27 — QANDEEL cannot use its own prior assertion as circular evidence

A QANDEEL utterance or Reading does not become supporting Evidence merely because QANDEEL previously said it.

Evidence Participation requires independent grounding.

---

## FINAL-28 — Evidence Participation preserves source identity

A Record, Event or Memory participating evidentially remains the same canonical object.

Multiple analytical contexts never require canonical duplication.

---

## FINAL-29 — Evidence roles are target-specific

Where grounded:

- SUPPORTING;
- CHALLENGING;
- CONTRADICTING;
- QUALIFYING.

No role follows from counts, proximity or visual presentation.

---

## FINAL-30 — Evidence-role change requires new grounding

Historical roles remain reconstructable.

Later correction or evidence may revise present use without deleting previous analytical history.

---

## FINAL-31 — Unknown is meaningful unresolved information, not every missing fact

An Unknown exists only when resolving it could materially change:

- understanding;
- interpretation discrimination;
- important grounding validation;
- a grounded user-relevant analytical objective.

“Need more context” alone is insufficient.

---

## FINAL-32 — Unresolved reference does not automatically become Unknown

Reference state may remain unresolved without creating an analytical Unknown unless its resolution is materially important.

---

## FINAL-33 — Question is distinct from Unknown

One Unknown may have:

- zero;
- one;
- multiple Questions.

Question creation is not mandatory.

---

## FINAL-34 — Question is distinct from USER ASK

User dialogue act, internal analytical inquiry and eventual delivered question remain separate concepts.

---

## FINAL-35 — Correction preserves history

A committed user correction does not erase the earlier committed source.

It changes current interpretation while preserving earlier `K(t)`.

---

## FINAL-36 — Clarification ≠ correction

Clarification may narrow meaning without declaring earlier material false.

---

## FINAL-37 — Contradiction ≠ correction

Incompatible committed propositions may remain unresolved contradiction until grounded correction/retraction/resolution occurs.

---

## FINAL-38 — Claimant authority constrains correction

One speaker cannot silently rewrite another person's assertion merely by disagreeing with it.

---

## FINAL-39 — Revision/supersession/retirement are non-destructive

Prior analytical objects remain historically inspectable.

Current replacement does not erase previous existence.

---

## FINAL-40 — Downstream revision is dependency-specific

A correction triggers reassessment only for objects/relations whose actual grounding changed.

No universal destructive recomputation is implied.

---

## FINAL-41 — Three temporal dimensions remain distinct

Always preserve:

1. Session Temporal Position;
2. Source / Referenced Temporal Origin;
3. Analysis Availability / Knowledge Time.

---

## FINAL-42 — Source time never backdates analysis

A Reading created at 11:50 from evidence originating at 04:20 did not exist at 04:20.

---

## FINAL-43 — Historical `K(t)` contains only then-available knowledge

Later:

- reference resolution;
- correction;
- evidence;
- Event convergence;
- Reading;
- Unknown resolution;
- relation revision

must not leak backwards.

---

## FINAL-44 — Historical truth may differ from current truth without either being erased

`K(t)` answers:

> What was QANDEEL entitled to know at t?

not:

> What do we know now about what happened then?

---

## FINAL-45 — Existing QANDEEL runtime authorities remain preserved

Stage 1 does not redefine functioning runtime contracts merely for vocabulary alignment.

---

## FINAL-46 — Current runtime mapping remains frozen

At the Stage 1.9 baseline:

### FIT

- Memory core identity/lifecycle;
- Memory supersession;
- selected bounded existing Evidence/Question capabilities within their current scope.

### PARTIAL

- Record↔conversation\_turn;
- Reading↔Hypothesis;
- Evidence Participation;
- Unknown↔Information Gap;
- Question↔Question Candidate;
- knowledge-availability primitives;
- source provenance;
- Hypothesis evolution/history.

### DIFFERENT

- EvidenceItem versus generic Evidence Participation;
- durable Intent versus dialogue intent;
- durable Association versus GSR;
- runtime Event versus narrated Event;
- Confidence versus Reading existence/ranking;
- ContextBuilder versus Conversation Analysis State.

### GAP

- CU runtime;
- discourse functions;
- reference/coreference/claim attribution;
- Thread lifecycle;
- narrated Event model;
- Conversation Transition;
- GSR layer;
- broader source/Event Evidence Participation;
- complete source-level correction model;
- full K(t);
- cross-Thread participation;
- unified client-readable analysis state.

### UNRESOLVED

- exact future Record identity relationship to `conversation_turn`.

---

## FINAL-47 — Runtime richness must not be flattened

Existing:

- Memory;
- Hypothesis;
- Confidence;
- Information Gap;
- Question;
- post-response durability;
- exact-version history;
- ContextBuilder/context assembly

remain assets to integrate with—not semantic debris to replace.

---

## FINAL-48 — Visual usefulness can never create analytical truth

No future object or relationship may exist because:

- it helps the map;
- it makes a compelling visualization;
- it improves visual density;
- it creates attractive connections.

The conversational-analysis contract comes first.

---

## FINAL-49 — Truthful refusal is a first-class successful output

Valid system results include:

- unresolved reference;
- no Thread;
- no Event;
- no relation;
- no Reading;
- multiple unresolved Readings;
- no Evidence Participation;
- no Unknown;
- no Question;
- no revision.

Extraction volume is not the success metric.

---

## FINAL-50 — Stage 1 produces Conversation Analysis State over time

The final analytical substrate must eventually make every represented object/relation answer:

- what it is;
- what source grounds it;
- who said/asserted it;
- what references remain unresolved;
- why it exists;
- its canonical identity;
- Thread participation;
- Transition participation;
- grounded relations;
- Evidence Participation;
- Readings;
- Unknowns;
- Questions;
- revision history;
- source/reference time;
- session time;
- analysis-availability time;
- what was knowable at earlier `K(t)`;
- current runtime fit/gap.

---

# FINAL STAGE 1 PRODUCT

If approved, Stage 1 closes with:

# **QANDEEL Conversational Analysis Grammar / Data Reality v1**

A frozen product/data-reality contract describing the truthful conversational and analytical substrate that may later underlie the QANDEEL Living Analysis Map.

It is:

- not a database schema;
- not an API contract;
- not a visual ontology;
- not a spatial algorithm;
- not an implementation task plan.

---

# K. EXPLICIT RECOMMENDATION

# **RECOMMENDATION: STAGE 1 CLOSE**

Reason:

1. Stage 1.1–1.9 contracts survived the independent holdout.
2. Adversarial attempts produced truthful refusal rather than forced structure.
3. Multiple ambiguity cases remained safely unresolved.
4. Correction preserved history without destructive rewriting.
5. Event identity resisted lexical/co-occurrence shortcuts.
6. Temporal order did not become causality.
7. Reading multiplicity survived without forced ranking.
8. Evidence did not arise from mere relevance or QANDEEL self-assertion.
9. Unknowns and Questions were not overproduced.
10. `K(t)` remained forward-only with no hindsight leakage.
11. Stage 1.9 runtime mapping remained internally consistent with the frozen grammar.
12. **No genuine grammar failure was discovered.**
13. No Stage 1 sub-stage requires reopening.

**Current status remains:**

`STAGE 1.10 — FREEZE CANDIDATE`

until explicit product-owner approval.

**Stage 2 has not begun.**