تم. **Stage 2.1 — APPROVED / FROZEN / CLOSED** وGate 2.1 = **PASS**.

نفذت هنا **Stage 2.2 فقط**، بدون اختيار coordinate system أو placement algorithm أو grid/radial/graph model، وبدون الدخول في Neighborhood growth الخاصة بـ2.3.

القرار المركزي الذي خرجت به Stage 2.2 هو:

> **Thread Establishment and Home Anchor commitment are one logical canonical transition.**
>
> بمجرد أن يصبح الـThread Established بحق، يصبح له في نفس لحظة الـcanonical truth **Home Anchor واحد فقط، دائم، لا يُعاد إنشاؤه ولا يُعاد وضعه**.
>
> الـrenderer قد يتأخر في إظهاره، لكن لا توجد canonical state اسمها “Established Thread بلا permanent spatial identity”.

# QANDEEL — STAGE 2.2

## Thread Home Anchor + Establishment Territory

**Status:** `STAGE 2.2 FREEZE CANDIDATE — AWAITING APPROVAL`
**Stage 2.1:** CLOSED / PASS
**Stage 2.3:** NOT STARTED

---

# A. Home Anchor Definition

## HA-01 — Home Anchor

**Thread Home Anchor** هو:

> **The one permanent canonical spatial placement identity assigned to an Established Conversation Thread within the persistent Conversation World spatial frame.**

هو يجمع:

- Thread canonical identity؛
- Canonical Spatial Address؛
- stable placement identity؛
- establishment availability/history.

ولا يشترط أن يكون:

- point هندسية؛
- `(x,y)`؛
- center of a shape؛
- cell؛
- node؛
- circle؛
- region centroid.

كلمة **Anchor** في Stage 2.2 تعني:

> **the Thread's stable canonical home-place**

وليس visual marker.

---

## HA-02 — Exactly one Home Anchor

لكل Established Thread:

> **exactly one canonical Home Anchor.**

لا يوجد:

- Active Anchor؛
- Dormant Anchor؛
- Reopened Anchor؛
- mobile Anchor؛
- desktop Anchor؛
- historical duplicate Anchor.

كلها projections/states لنفس الـThread ونفس placement identity.

---

## HA-03 — Home Anchor belongs to Thread identity, not Thread label

لو:

`Ahmed`

تم refined لاحقًا إلى:

`Ahmed — work colleague`

الـThread لم يتغير.

إذًا:

**Home Anchor لا يتغير.**

Label refinement ليست spatial re-establishment.

---

# B. Establishment Entitlement + Timing Contract

دي أهم نقطة في 2.2.

## B1. Emerging Focus has no canonical Home Anchor

مهما كان الـEmerging Focus:

- متكرر؛
- ظاهر بوضوح؛
- QANDEEL مهتم به؛
- عنده Readings؛
- عنده Questions؛

فطالما Stage 1 Thread Grammar لم يمنحه:

**ESTABLISHED**

فهو غير entitled لـpermanent geography.

قد يوجد له لاحقًا provisional presentation.

لكن:

> **no Canonical Spatial Address**
> **no Home Anchor**
> **no committed placement**

---

## B2. Thread establishment creates spatial entitlement

في اللحظة المنطقية التي يثبت فيها Stage 1:

> `Emerging Focus → Established Thread`

يصبح الـThread entitled فورًا إلى:

> **one permanent canonical spatial placement.**

---

## B3. Establishment + Home Anchor are one logical canonical commit

Stage 2.2 يرفض نموذجًا من مرحلتين canonical مثل:

```text
10:05 Thread becomes Established
10:08 Home Anchor eventually assigned
```

لأن الفترة من 10:05 إلى 10:08 ستحتوي:

> Established Thread بلا permanent geography.

وده يناقض Stage 0.

العقد الصحيح:

```text
Thread establishment
+
Home Anchor canonical placement commitment
=
one logical availability boundary
```

يعني لو `tE` هي establishment availability time:

```text
Thread Established at tE
Home Anchor valid at tE
```

---

## B4. Rendering may lag; canonical truth may not

ممكن implementation مستقبلًا يحتاج milliseconds أو asynchronous work عشان يرسم.

ده presentation/runtime concern.

لكن canonical model لا يقول:

> “Thread established لكن لسه مالوش مكان.”

الـrenderer إما:

- لم يعرض أحدث world state بعد؛

أو:

- يعرض state التي تحتوي بالفعل على Thread + Home Anchor.

لا يوجد intermediate product truth جديد.

---

## B5. Establishment must already be truthfully warranted

Stage 2.2 لا يستطيع Spatially Establish Thread قبل Stage 1.3.

بالتالي:

ambiguous reference → Thread not Establishable
→ no Home Anchor.

Geometry لا تستطيع حل ambiguity نيابة عن grammar.

---

# C. Conversational-Origin Contract

## C1. Conversational Origin

**Conversational Origin** هو:

> **The grounded conversational-history context from which the establishment episode of a new Thread emerged.**

مثال:

Work Active.

ثم:

> «بس أحمد نفسه هو اللي مقلقني.»

وبعد sustained engagement أحمد Establishes.

يمكن تسجيل:

> Ahmed establishment emerged conversationally from Work context.

---

## C2. Origin is placement input, not semantic parent

الـorigin قد يدخل في قرار canonical placement مستقبلًا.

لكنه لا يعني:

```text
Work
 └── Ahmed
```

ولا يعني:

- Ahmed part of Work؛
- Work causes Ahmed؛
- Work owns Ahmed؛
- Ahmed subordinate to Work؛
- Work semantically contains Ahmed.

---

## C3. Origin does not prescribe geometry

`Origin = Work`

لا يفرض:

- next to Work؛
- right of Work؛
- below Work؛
- 300 units away؛
- same sector؛
- branch line؛
- angle؛
- shortest path.

هو يقول فقط:

> **where this new conversational territory emerged from historically.**

كيف يتحول ذلك إلى admissible spatial territory يظل implementation/world-growth مسئلة لاحقة ضمن القيود المجمدة.

---

## C4. Conversation Transition ≠ origin-placement edge

لو سجلنا:

`Work → Ahmed`

Conversation Transition

وAhmed Establishes أثناء هذا التحول:

يمكن Work أن يكون conversational origin.

لكن:

**Transition itself does not draw or define the placement.**

لا يوجد:

> transition vector.

ولا:

> edge length.

ولا:

> direction from A to B.

---

## C5. Origin is availability-time-sensitive

لو عند establishment time QANDEEL يرى origin واحدًا معينًا:

هذا هو establishment provenance وقتها.

لو لاحقًا conversation analysis clarifies أن emergence كان مرتبطًا بأكثر من context:

origin provenance يمكن أن يتطور.

لكن الـHome Anchor لا يُعاد وضعه.

---

# D. Establishment Placement Truth Requirements

Stage 2.2 لا يختار **كيف** نحسب المكان.

لكنه يجمد الشروط التي تجعل أي placement مستقبلية شرعية.

## D1. One unique canonical placement

عند establishment يجب اختيار placement واحدة فقط.

ليس:

- candidate A على desktop؛
- candidate B على mobile؛
- several equal canonical options.

بعد commitment:

> **one Thread → one placement identity.**

---

## D2. Placement must belong to the existing World frame

الـThread الجديد لا ينشئ coordinate universe خاصًا به.

مكانه يجب أن يكون داخل نفس persistent Conversation World spatial frame الذي توجد فيه Anchors السابقة.

---

## D3. Placement must use previously uncommitted spatial capacity

يعني:

> المكان الذي أصبح Home Anchor لم يكن بالفعل canonical placement مملوكًا لـHome Anchor آخر.

وده لا يعني “pixel empty”.

ولا يعني measured free radius.

بل يعني فقط:

> **that canonical placement had not already been permanently committed to another Established Thread.**

---

## D4. Existing anchors are immutable placement constraints

أي future placement process يجب أن يقبل:

> existing Home Anchors as fixed canonical facts.

ممنوع:

> “أحسن placement لأحمد محتاجة نحرك Work.”

إذن placement الجديدة تتكيف مع العالم الموجود.

العالم الموجود لا يتكيف بتحريك Anchors القديمة.

---

## D5. Allowed establishment inputs

على مستوى truth contract، placement authority يجوز لها أن تعتمد على:

- new Thread identity؛
- establishment time/history؛
- grounded conversational-origin state، إن وُجد؛
- current committed world geography؛
- existence of genuinely uncommitted capacity؛
- non-semantic spatial viability constraints necessary to commit a distinct stable place.

لكنها **لا يجوز** أن تعتمد على:

- semantic similarity؛
- relation count؛
- connection count؛
- Thread importance؛
- confidence؛
- Reading strength؛
- emotional intensity؛
- popularity؛
- future visual attractiveness.

---

## D6. Exact placement method remains open

Stage 2.2 لا يحسم:

- nearest free location؛
- sectors؛
- cells؛
- spatial hashing؛
- coordinates؛
- deterministic vectors؛
- procedural growth؛
- tiling.

فقط يحسم:

> أي method لاحق لازم ينتج **one stable placement satisfying the frozen invariants**.

---

# E. Establishment Territory / Uncommitted-Capacity Contract

هنا لازم نمنع 2.2 من التسلل إلى 2.3.

## E1. Establishment commits a Home Anchor, not a final Neighborhood territory

عندما Thread Establishes، Stage 2.2 يتطلب فقط:

> **permanent Home Anchor placement commitment.**

لا يجمد:

- radius؛
- polygon؛
- territory size؛
- future reserve area؛
- neighborhood envelope؛
- growth corridor.

دي Stage 2.3.

---

## E2. No fixed canonical territory envelope yet

ممنوع نقول دلوقتي:

> “كل Thread يستلم مساحة 500×500.”

أو:

> “كل Thread له radius ثابت.”

أو:

> “احتجز له sector.”

لا دليل على ده حتى الآن.

---

## E3. Minimum establishment-level spatial entitlement

أقل شيء يحتاجه Established Thread هو:

1. unique permanent Home Anchor؛
2. distinct canonical placement identity؛
3. عدم تعارض هذا placement مع Home Anchor committed موجودة؛
4. الحفاظ على إمكان أن Neighborhood لاحقة تُعبّر حول هذا الـAnchor بدون تغيير الـAnchor نفسه.

النقطة الرابعة **viability requirement** فقط.

ولا تحدد مساحة أو quantity.

---

## E4. “Uncommitted capacity” is not secretly owned future territory

لو عند `t1` مساحة العالم لم تُستخدم بعد:

لا يجوز اعتبارها:

> “future Ahmed territory.”

قبل Establishment.

وعند establishment:

يُcommit فقط ما يحتاجه canonical Home Anchor.

Stage 2.3 ستقرر هل وكيف يحصل growth حوله.

---

## E5. No hidden territorial hierarchy

إذا Ahmed origin = Work:

لا يحصل Work على:

> parent territory

والـAhmed على:

> child territory.

Conversation World لا يتحول إلى nested filesystem.

---

# F. Active / Dormant / Reopened Spatial Contract

## F1. Active

Active Thread يستخدم:

- same Thread ID؛
- same Home Anchor؛
- same Canonical Spatial Address؛
- same placement identity.

Activity affects conversational state.

Not geography.

---

## F2. Dormant

When Active → Dormant:

**nothing happens to canonical placement.**

Specifically:

- Home Anchor not released؛
- capacity not returned؛
- place not deleted؛
- Thread not packed away؛
- address not reassigned.

Dormant spatially means:

> **persistent place currently not receiving live conversational attention.**

---

## F3. Reopened

Dormant → Reopened:

> return to exactly the same Home Anchor.

There is:

- no placement calculation;
- no re-establishment;
- no new territory commitment;
- no new canonical address;
- no duplicate Thread.

---

## F4. Long absence changes nothing

سواء Thread dormant لمدة:

- 20 seconds؛
- hour؛
- months of future cross-session history if later architecture supports it;

duration alone has zero authority to reclaim/move its Home Anchor.

---

## F5. Reopening does create new conversational/temporal history

اللي يتغير:

- activity state؛
- current-session footprint؛
- Conversation Transition where warranted.

اللي لا يتغير:

- canonical spatial identity.

---

# G. Establishment Provenance + Historical K(t)

## G1. Minimum Home Anchor establishment provenance

كل Home Anchor يجب conceptually يحتفظ بما يكفي لإجابة:

- Which Thread was established?
- When did establishment become valid?
- What Canonical Spatial Address was committed?
- What stable placement does it resolve to?
- What committed Conversation World already existed then?
- What conversational-origin state was available at establishment?
- Was origin resolved, multiple, ambiguous, or absent?
- What Stage 1 establishment evidence made permanent geography legitimate?

ده provenance contract فقط.

ليس database schema.

---

## G2. Establishment history is immutable

Once committed:

> “Ahmed became established at tE at canonical placement PA”

تبقى world-history fact.

Later:

- relation discovery؛
- origin clarification؛
- label refinement؛
- shared objects؛
- density

لا تعيد كتابة establishment history.

---

## G3. K(t) immediately before establishment

لو Ahmed Establishes عند:

`10:07`

فـ:

### `K(10:06:59)`

يجوز أن يحتوي:

- Ahmed reference؛
- Ahmed Emerging Focus؛
- provisional presentation إذا stage later allows.

لكن:

**NO permanent Ahmed Home Anchor.**

---

## G4. K(t) at establishment

### `K(10:07)`

الـcanonical state gains together:

- TH-AHMED = Established؛
- AHMED Home Anchor؛
- canonical placement identity؛
- establishment availability.

---

## G5. Later K(t)

لو Ahmed Dormant ثم Reopened:

K(t) يستخدم **نفس canonical Home Anchor** عبر كل الأوقات التي يكون فيها الـThread already established.

قبل establishment:

لا يظهر كـpermanent geography.

---

## G6. Historical projection cannot re-layout

لو عند establishment كان في العالم:

- Work
- Ahmed

ثم بعد ساعة أصبح فيه 50 Thread:

historical `K(t)` التي ترجع للحظة القديمة لا تقوم:

> “نعيد توزيع Work/Ahmed لأن وقتها كانوا اتنين بس.”

نفس canonical placements.

فقط باقي future geography غير متاحة تاريخيًا.

---

# H. Multi-Origin / Ambiguous-Origin Cases

## H1. One clear origin

Work Active.

Ahmed begins emerging directly from Work discussion.

Ahmed later Establishes.

Origin provenance:

`Work`

Allowed.

لكن لا hierarchy ولا adjacency requirement.

---

## H2. Multiple grounded origins

User has active material around:

- Work
- Family

ثم focus جديد Establishes حول:

> “قرار السفر للسعودية”

والقرار نشأ substantively من الاثنين.

Origin state may be:

`{Work, Family}`

ولا يجب اختيار واحد كـparent.

Placement still must become **one unique Home Anchor**.

Multiple origins do not mean multiple Anchors.

---

## H3. Ambiguous origin

It is clear a Thread is independently Established, but exactly which prior conversational context it emerged from is ambiguous.

Result:

```text
Thread establishment = valid
Origin = AMBIGUOUS
Home Anchor = one stable canonical placement
```

Stage 2.2 does **not** block establishment merely because origin is ambiguous, unless the same ambiguity also prevents Thread identity itself.

Important distinction:

> origin ambiguity ≠ Thread identity ambiguity.

---

## H4. Unresolved referent blocks Thread establishment

User:

> «هو بقى المشكلة الحقيقية.»

Candidates:

- Ahmed;
- Khaled.

If the Thread to establish would need knowing which person:

Stage 1 blocks identity-specific establishment.

Therefore:

**no Home Anchor yet.**

Spatial model must wait.

---

## H5. Explicit user-selected Thread with no meaningful prior origin

User abruptly says:

> «على فكرة، عايز أتكلم معاك في علاقتي بوالدي.»

Suppose this truthfully Establishes immediately.

No prior Thread meaningfully owns this emergence.

Origin:

`NONE / NO UNIQUE CONVERSATIONAL ORIGIN`

This is valid.

The placement authority must choose new uncommitted capacity without inventing a fake parent.

---

## H6. First Thread in an empty world

No existing Thread geography.

User explicitly establishes Work.

Work gets:

- first Home Anchor;
- one stable placement.

But Stage 2.2 does not claim:

- Work = world center؛
- Work must occupy world origin؛
- future Threads radiate from Work.

The first placement is historical firstness only.

---

## H7. Long Emerging period

Ahmed Emerging for 25 minutes.

No Home Anchor.

At minute 26, explicit user addressability finally satisfies establishment.

Permanent geography starts **at minute 26 only**.

The prior 25 minutes do not gradually “reserve” canonical territory for Ahmed.

---

## H8. Several Threads establish near-simultaneously

Three Threads become established in close session succession.

They each receive:

- separate identities;
- separate Home Anchors;
- separate establishment histories.

Temporal proximity does not imply:

- spatial adjacency;
- clustering;
- same territory;
- shared semantic region.

---

# I. Canonical Work → Ahmed → Relationship → Work → Ahmed Proof

## Step 1 — Work

User:

> «عايز أتكلم عن الشغل.»

Stage 1 establishes Work.

Stage 2.2:

**HA-WORK created exactly once.**

Canonical placement:

`P-WORK`

No semantic claim about being center.

---

## Step 2 — Ahmed appears

> «أحمد اضطر يعيد التقرير.»

Ahmed = Mention.

Result:

**NO HA-AHMED.**

---

## Step 3 — Ahmed Emerging

> «أحمد نفسه بدأ يقلقني.»

Ahmed Emerging.

Still:

**NO HA-AHMED.**

---

## Step 4 — Ahmed Establishes

Further sustained user attention warrants establishment.

At establishment boundary:

```text
TH-AHMED → ESTABLISHED
HA-AHMED → committed
placement = P-AHMED
```

Conversational origin:

Work.

But:

- P-AHMED not semantically “inside Work”؛
- no parent link؛
- no required adjacency؛
- no chain geometry.

---

## Step 5 — Relationship with Ahmed emerges

> «علاقتي بأحمد نفسها...»

First:

Emerging.

No Home Anchor.

---

## Step 6 — Relationship Establishes

Explicit independent addressability warrants establishment.

At same logical boundary:

```text
TH-REL-AHMED → ESTABLISHED
HA-REL-AHMED → committed
placement = P-REL
```

Possible conversational origin:

Ahmed context.

But no:

```text
Work → Ahmed → Relationship
```

spatial chain is implied.

Three Threads now exist:

1. Work
2. Ahmed
3. Relationship with Ahmed

Exactly three Home Anchors.

---

## Step 7 — Return to Work

User:

> «نرجع للشغل.»

Work:

`Dormant → Reopened`

Spatial result:

```text
Home Anchor = P-WORK
```

No new placement.

No new Work Thread.

---

## Step 8 — Later return to Ahmed

> «عايز أرجع لأحمد نفسه.»

Ahmed:

`Dormant → Reopened`

Spatial result:

```text
Home Anchor = P-AHMED
```

No movement.

No new Ahmed.

No proximity adjustment.

---

## Final proof

Canonical world still contains exactly:

```text
Work                → P-WORK
Ahmed               → P-AHMED
Relationship Ahmed  → P-REL
```

And conversational history may contain transitions:

```text
Work → Ahmed
Ahmed → Relationship
Relationship → Work
Work → Ahmed
```

But those four transitions have **zero authority** to convert the three placements into a chain.

**PASS.**

---

# J. Negative / Adversarial Cases

## J1. “Put Ahmed near Work because they're related”

Not allowed.

Semantic relation, even if later grounded, has no placement authority.

---

## J2. “Ahmed came from Work, so make him a child”

Not allowed.

Conversational origin ≠ hierarchy.

---

## J3. “Relationship with Ahmed is obviously under Ahmed”

Not allowed spatially.

Its ontology is independently addressable Thread.

No nested geography is warranted.

---

## J4. Emerging Focus looks likely to establish

System pre-reserves permanent Anchor.

**FAIL.**

Likelihood is not establishment.

---

## J5. QANDEEL creates several Readings about Emerging Focus

Still no Home Anchor.

Analysis cannot establish geography.

---

## J6. Mobile viewport is crowded

System moves dormant Work to fit Ahmed.

**FAIL.**

Viewport has no canonical placement authority.

---

## J7. Ahmed becomes huge later

System moves its Home Anchor.

**FAIL.**

Stage 2.3 must solve growth around fixed Anchor.

---

## J8. Work Dormant for 90% of conversation

System recycles Work's placement.

**FAIL.**

Dormancy never releases canonical geography.

---

## J9. Ahmed returns after long absence

System calculates a fresh “better” Ahmed placement.

**FAIL.**

Must use original Home Anchor.

---

## J10. New Grounded Semantic Relation discovered

`ConflictWithAhmed CONTRIBUTES_TO LeavingWork`

System pulls Ahmed closer to Work.

**FAIL.**

Analysis changed.

Geography did not.

---

## J11. Strong semantic similarity discovered

No movement.

---

## J12. Many shared objects discovered

No movement.

This may affect future contextual/shared-object representation in 2.4.

Not Anchor placement.

---

## J13. Origin later corrected

Initially QANDEEL understood:

Ahmed emerged from Work.

Later conversation clarifies the actual establishment episode was spanning Work + Friendship context.

### Correct

Update/extend origin provenance from the availability time of clarification.

### Incorrect

Move Ahmed's Home Anchor to a “more correct” location.

Placement is historical geography.

**PASS.**

---

## J14. Origin becomes completely uncertain later

Same answer:

anchor stays.

Origin provenance may become ambiguous.

Stable placement does not depend on maintaining a forever-certain semantic origin.

---

## J15. No conversational origin

System chooses a fake nearest Thread as parent so it can calculate placement.

**FAIL.**

`NO UNIQUE ORIGIN` is valid input.

---

## J16. Two candidate origins

System picks the more important Thread.

**FAIL.**

Importance isn't origin truth.

---

## J17. First Thread

System labels it “central/root Thread”.

**FAIL.**

Firstness ≠ centrality/hierarchy.

---

## J18. Ten Threads establish rapidly

System runs force-directed optimization and moves all previous Anchors after each establishment.

**FAIL.**

Each new commitment must preserve all older placements.

---

## J19. Historical K(t) before Ahmed establishment

System shows faded Ahmed Home Anchor because it knows current geography.

**FAIL — hindsight leakage.**

---

## J20. Historical K(t) after establishment but before reopening

Ahmed is Dormant.

His Home Anchor still exists historically.

Dormancy does not erase geography.

---

## J21. Different renderer

Renderer B swaps Work and Ahmed because its layout engine prefers another composition.

**FAIL.**

It has changed canonical geography.

---

## J22. Thread label radically refined

Placement unchanged unless Stage 1 says it is actually a new reframed Thread.

---

## J23. Genuine reframing

Existing Ahmed Thread later leads to an independently established:

Relationship with Ahmed.

Correct:

**new Thread + new Home Anchor.**

Incorrect:

rename Ahmed and reuse its Home Anchor for Relationship.

---

# K. Gate 2.2 Result

| Gate requirementResult                                                           |          |
| -------------------------------------------------------------------------------- | -------- |
| Home Anchor has precise non-visual definition                                    | **PASS** |
| Exactly one Home Anchor per Established Thread                                   | **PASS** |
| Emerging Focus receives no permanent geography                                   | **PASS** |
| Establishment and Home Anchor commitment share one logical availability boundary | **PASS** |
| No canonical Established-without-Anchor intermediate state                       | **PASS** |
| Renderer materialization distinguished from canonical availability               | **PASS** |
| Home Anchor retains Stage 2.1 place + placement identity                         | **PASS** |
| Conversational origin defined without hierarchy                                  | **PASS** |
| Conversational origin has no geometric prescription                              | **PASS** |
| Conversation Transition cannot act as placement edge                             | **PASS** |
| One clear origin handled                                                         | **PASS** |
| Multiple origins handled without fake parent                                     | **PASS** |
| Ambiguous origin preserved                                                       | **PASS** |
| No meaningful origin handled                                                     | **PASS** |
| Thread-identity ambiguity blocks establishment correctly                         | **PASS** |
| First Thread does not become semantic center/root                                | **PASS** |
| New placement must use uncommitted canonical capacity                            | **PASS** |
| Existing Home Anchors remain fixed constraints                                   | **PASS** |
| Semantic similarity/relation/importance cannot place Threads                     | **PASS** |
| No placement algorithm selected                                                  | **PASS** |
| No coordinate system selected                                                    | **PASS** |
| Establishment commits Anchor, not fixed Neighborhood envelope                    | **PASS** |
| Stage 2.3 territory quantities/growth not prematurely defined                    | **PASS** |
| Active preserves same Anchor                                                     | **PASS** |
| Dormant preserves and retains same Anchor                                        | **PASS** |
| Reopened returns to exactly same Anchor                                          | **PASS** |
| Long absence does not release geography                                          | **PASS** |
| Later origin revision cannot relocate Anchor                                     | **PASS** |
| Establishment provenance is sufficient for historical reconstruction             | **PASS** |
| K(t) before/after establishment has no hindsight leakage                         | **PASS** |
| Work→Ahmed→Relationship→Work→Ahmed produces exactly 3 Anchors                    | **PASS** |
| Sequence does not become spatial chain                                           | **PASS** |
| Viewport/device changes cannot affect establishment geography                    | **PASS** |
| No Stage 2.3 work performed                                                      | **PASS** |

# **GATE 2.2 RESULT: PASS**

No contradiction requiring Stage 0, Stage 1, or Stage 2.1 reopening was found.

---

# L. Stage 2.2 Freeze Candidate

If approved, freeze the following:

### **HA-01**

A Thread Home Anchor is the Established Thread's one permanent canonical spatial placement identity within the Conversation World.

### **HA-02**

Every Established Thread has exactly one Home Anchor.

### **HA-03**

Home Anchor identity follows canonical Thread identity, not label/presentation wording.

### **HA-04**

Emerging Focus has no Canonical Spatial Address or permanent Home Anchor.

### **HA-05**

Permanent spatial entitlement begins only when Stage 1 Thread establishment is truthfully warranted.

### **HA-06**

Thread establishment and Home Anchor placement commitment share one logical canonical availability boundary.

### **HA-07**

There is no valid canonical state in which a Thread is Established but its permanent spatial identity is unresolved.

### **HA-08**

Renderer/materialization latency does not create a second canonical establishment time.

### **HA-09**

A Home Anchor contains place identity + stable placement identity as frozen by Stage 2.1.

### **ORG-01**

Conversational Origin records the grounded conversational-history context from which Thread establishment emerged.

### **ORG-02**

Conversational Origin is placement provenance/input, not parenthood, hierarchy, causal relation, semantic dependence or ownership.

### **ORG-03**

Conversational Origin never prescribes exact adjacency, direction, angle, distance, chain position or geometric form.

### **ORG-04**

Conversation Transition does not function as a spatial-placement edge.

### **ORG-05**

A Thread may have one, multiple, ambiguous, or no meaningful conversational origin.

### **ORG-06**

Multiple/ambiguous origins must not be collapsed into a fake primary parent for placement convenience.

### **ORG-07**

Origin ambiguity does not block establishment when Thread identity and establishment evidence themselves are sufficiently grounded.

### **ORG-08**

Reference ambiguity that prevents Thread identity does block permanent geography until resolved.

### **PLC-01**

Establishment must commit exactly one canonical placement for the new Thread.

### **PLC-02**

The placement belongs to the same persistent Conversation World frame as all earlier Home Anchors.

### **PLC-03**

A newly committed placement must come from previously uncommitted canonical spatial capacity.

### **PLC-04**

Uncommitted capacity means capacity not already permanently claimed by another canonical Home Anchor; it is not defined as empty pixels or fixed measurable area.

### **PLC-05**

All previously Established Home Anchors are immutable constraints on new placement.

### **PLC-06**

New placement adapts to existing geography; existing geography is never moved to accommodate establishment.

### **PLC-07**

Grounded conversational origin may influence placement, but semantic similarity, relation structure, confidence, importance, analytical strength and visual attractiveness may not.

### **PLC-08**

Stage 2.2 freezes admissibility requirements, not the algorithm that chooses an admissible placement.

### **TER-01**

Thread establishment commits a Home Anchor, not a fixed canonical Neighborhood envelope.

### **TER-02**

No radius, polygon, sector, reserve size, growth corridor or future-capacity quantity is frozen in Stage 2.2.

### **TER-03**

The minimum establishment-level territorial commitment is only enough to preserve a distinct permanent Home Anchor and future viability around that fixed placement.

### **TER-04**

Uncommitted world capacity is not pre-owned by future Threads before their establishment.

### **TER-05**

Conversational origin does not create nested parent/child territory.

### **LIFE-01**

Active, Dormant and Reopened are states of one Established Thread using one Home Anchor.

### **LIFE-02**

Dormancy does not delete, release, relocate or recycle canonical spatial placement.

### **LIFE-03**

Reopening never creates or recalculates a Home Anchor.

### **LIFE-04**

Returning after any absence returns to the same canonical spatial placement.

### **LIFE-05**

Reopening may create new temporal/conversational history while leaving spatial identity unchanged.

### **HIST-01**

Home Anchor establishment provenance must retain the Thread, placement identity, establishment availability, then-current world context, establishment grounding, and conversational-origin state.

### **HIST-02**

Establishment geography is historical fact and is not recomputed when later origin understanding changes.

### **HIST-03**

Later clarification/revision of conversational origin may change current provenance understanding but never relocates the established Home Anchor.

### **HIST-04**

Historical `K(t)` immediately before establishment contains no permanent Thread geography for that Thread.

### **HIST-05**

At the establishment availability boundary, Thread identity and Home Anchor become valid together.

### **HIST-06**

After establishment, historical projections reuse the same canonical placement whenever the Thread is time-valid; they never create compact alternative layouts.

### **BND-HA-01**

The first Thread in the world is historically first, not semantically central or hierarchically root.

### **BND-HA-02**

Several Threads establishing near each other in session time gain independent placements without automatic spatial adjacency.

### **BND-HA-03**

Later shared objects, semantic relations, convergence, density, viewport changes or renderer changes cannot relocate a Home Anchor.

### **BND-HA-04**

Refinement preserves Home Anchor identity; genuine Stage 1 reframing that establishes a distinct Thread requires a distinct Home Anchor.

### **BND-HA-05**

Stage 2.2 introduces no coordinate system, geometry family, placement algorithm, Neighborhood growth envelope, density solution or visual morphology.

---

# STAGE 2.2 STATUS

**A. Home Anchor definition:** COMPLETE
**B. Establishment entitlement/timing:** COMPLETE
**C. Conversational origin:** COMPLETE
**D. Placement truth requirements:** COMPLETE
**E. Establishment capacity boundary:** COMPLETE
**F. Active/Dormant/Reopened:** COMPLETE
**G. Provenance/K(t):** COMPLETE
**H. Multi-origin ambiguity:** COMPLETE
**I. Work→Ahmed→Relationship proof:** PASS
**J. Adversarial validation:** COMPLETE
**Gate 2.2:** ✅ **PASS**

## **STAGE 2.2 — FREEZE CANDIDATE**

**Stage 2.3 — NOT STARTED.**

أتوقف هنا لحد موافقتك الصريحة على Freeze Stage 2.2.