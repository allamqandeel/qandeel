تم. **Stage 2.2 — APPROVED / FROZEN / CLOSED** وGate 2.2 = **PASS**.

نفذت **Stage 2.3 فقط**. لم أدخل في object participation الخاصة بـ2.4، ولم أختَر geometry/coordinates/packing algorithm، ولم أدخل Pan/Zoom أو Timeline.

القرار المعماري الأهم في 2.3 هو:

> **Home Anchor هو canonical geography. Thread Neighborhood هو adaptive spatial expression حول هذا الـAnchor، وليس قطعة أرض canonical ذات حدود ثابتة.**
>
> نمو الـThread—even لو زاد 20× أو 100×—لا يمنحه تلقائيًا مساحة canonical جديدة ولا يحرّك أي Anchor. الذي يتكيف هو **Neighborhood expression**.

وده يحل مشكلة النمو بدون ما نحول العالم إلى land-allocation system أو graph-packing problem.

# QANDEEL — STAGE 2.3

## Thread Neighborhood + Append-Oriented Growth

**Status:** `STAGE 2.3 FREEZE CANDIDATE — AWAITING APPROVAL`
**Stage 2.1:** CLOSED / PASS
**Stage 2.2:** CLOSED / PASS
**Stage 2.4:** NOT STARTED

---

# A. Thread Neighborhood Definition

## NH-01 — Thread Neighborhood

**Thread Neighborhood** هو:

> **The adaptive local spatial expression through which an Established Thread's currently relevant conversational and analytical structure can inhabit and be inspected around its one permanent Home Anchor.**

بمعنى أدق:

- الـThread هو canonical conversational identity.
- الـHome Anchor هو canonical permanent placement.
- الـNeighborhood هو **كيف العالم يستطيع التعبير مكانيًا عن المحتوى المتزايد حول هذا الـThread**.

---

## NH-02 — Neighborhood is not a second canonical identity

لا نحتاج:

```text
Thread ID
+
Neighborhood ID
```

كأنهما كيانان مستقلان.

الـNeighborhood يأخذ هويته من الـThread الذي يعبّر عنه.

يعني:

> **one Thread → one Home Anchor → adaptive Neighborhood expression**

وليس:

> one Thread → evolving series of canonical territories.

---

## NH-03 — Neighborhood is not a semantic container

وجود شيء داخل Neighborhood لا يعني تلقائيًا:

- أن Thread “يمتلكه”؛
- أنه لا يمكن أن يشارك في Thread أخرى؛
- أنه child object؛
- أن Thread semantically contains it.

التفاصيل الدقيقة لمشاركة Records/Events/Memories/Readings وغيرها مؤجلة إلى Stage 2.4.

Stage 2.3 يجمد فقط أن:

> **Neighborhood is spatial context, not ontological ownership.**

---

## NH-04 — Neighborhood need not be one contiguous region

لا يوجد product-truth requirement يجبر Neighborhood أن تكون:

- دائرة واحدة؛
- polygon واحدة؛
- Voronoi cell؛
- blob واحدة؛
- contiguous territory.

إذا النمو المستقبلي احتاج spatial expression متعدد الأجزاء أو غير متصل presentation-wise، فهذا لا ينشئ:

- Thread جديدة؛
- Home Anchor ثانية؛
- canonical territory ثانية.

---

# B. Home Anchor ↔ Neighborhood Contract

## B1. Anchor is canonical; Neighborhood extent is not

الـHome Anchor:

**permanent canonical placement**

أما:

- Neighborhood radius;
- edge;
- outline;
- footprint;
- occupied display area;
- contour;
- apparent density

فليست canonical spatial truth في Stage 2.3.

### القرار

# **Neighborhood extent is adaptive, not canonical.**

---

## B2. Neighborhood cannot relocate its Thread

مهما تغيرت Neighborhood:

```text
Home Anchor = ثابت
```

حتى لو:

- المحتوى تضاعف؛
- Thread أصبحت dense جدًا؛
- عادت بعد dormancy؛
- ظهرت علاقات جديدة؛
- تغيرت التحليلات.

---

## B3. Spatial memory comes from the Home Anchor

الـstable spatial memory على مستوى Thread يجب أن تعتمد على:

> **same Thread → same Home Anchor**

وليس:

> same exact blob shape forever.

لو حفظنا شكل الـNeighborhood نفسه كحقيقة canonical، هنخلق global layout churn عاجلًا أو آجلًا.

---

## B4. Neighborhood must remain anchor-referential

Adaptive لا تعني arbitrary.

أي presentation للـNeighborhood يجب أن يظل واضحًا أنه spatially يعود لنفس الـHome Anchor.

لا يجوز أن تنمو expression لدرجة تجعل الـThread فعليًا تبدو وكأنها انتقلت إلى Home جديد.

---

# C. Canonical Neighborhood Truth vs Adaptive Presentation

Stage 2.3 يجمّد **partial-canonical model**:

## Canonical

يبقى ثابتًا:

- Thread identity؛
- Home Anchor؛
- Canonical Spatial Address؛
- placement identity؛
- establishment history؛
- fact that current/historical material belongs contextually to this Thread according to Stage 1.

## Adaptive

يمكن إعادة حسابه:

- Neighborhood extent؛
- shape؛
- boundary؛
- local footprint؛
- density expression؛
- local arrangement؛
- amount simultaneously disclosed؛
- temporary offsets؛
- collision response؛
- whether expression is contiguous or multi-part.

---

## C1. No canonical boundary

Stage 2.3 يرفض:

> **Thread owns this permanent polygon of world space.**

لأن هذا سيجبرنا لاحقًا على:

- reallocating territory؛
- moving neighbors؛
- fixed-capacity assumptions؛
- global packing.

---

## C2. No canonical Neighborhood size

Thread ذات 200 objects لا تملك spatial authority أكبر من Thread ذات 4 objects.

Content quantity may require richer presentation.

It does not grant:

> more canonical world ownership.

---

# D. Append-Oriented Growth Contract

## D1. Existing-Thread growth does not create new permanent geography

دي النقطة load-bearing الأساسية.

إذا Ahmed Thread زادت من:

5 pieces of material
→ 100 pieces

لم يحدث:

> canonical Thread geography expansion.

الذي حدث:

> **the adaptive Neighborhood has more structure to express.**

Home Anchor لم يتغير.

---

## D2. New material appends analytical/contextual state, not land ownership

Append-oriented growth means:

> later material is incorporated without requiring prior canonical geography to be rewritten.

لا يعني:

> كل object جديدة تحجز قطعة أرض permanent.

---

## D3. Canonical geography grows when permanent spatial identities grow

ضمن scope الحالي:

Thread establishment creates new permanent geography.

زيادة محتوى Thread Established موجودة بالفعل:

لا تفعل ذلك بنفسها.

Stage 2.4 ستحدد إن كانت بعض الأنواع الأخرى لها spatial-address behavior خاص، لكن Stage 2.3 لا تفترضه.

---

## D4. Global optimization is prohibited

حدث جديد داخل Ahmed لا يعطي system الحق أن يقول:

> “Let's optimize the whole map again.”

Growth must be **locally absorbable** at the world-model level.

---

## D5. Unrelated Neighborhoods must not require recomputation

Growth في Ahmed قد يسبب presentation pressure محليًا مع المناطق المجاورة.

لكن لا يجوز أن يفرض منطقيًا إعادة تنظيم:

- Family البعيدة؛
- Career؛
- Health؛
- Travel؛
- أي منطقة غير متأثرة محليًا.

---

# E. Local Expansion / Overflow Contract

## E1. Expansion is expression, not territorial annexation

“Ahmed Neighborhood expanded” يعني:

> current presentation needs a broader/more distributed spatial expression around the same Home Anchor.

لا يعني:

> Ahmed permanently annexed more canonical world territory.

---

## E2. Growth does not require contiguous free area

ممنوع نفترض:

> لازم ألاقي circle أكبر فاضية حول Ahmed.

لو مفيش convenient contiguous presentation room:

العقد يسمح لاحقًا بـpresentation strategies غير متصلة أو أكثر selective.

الـworld model نفسه لا يفشل.

---

## E3. Overflow is legitimate

إذا local convenient display space لا تكفي:

> **Neighborhood may overflow beyond its earlier convenient presentation footprint while retaining the same Home Anchor.**

Overflow لا يعني:

- new Anchor؛
- Thread duplication؛
- relocation.

---

## E4. Overflow need not mean outward radial expansion

لا يوجد:

```text
radius 1 → radius 2 → radius 3
```

كقاعدة canonical.

“Expansion” تعني زيادة القدرة على التعبير مكانيًا، وليس زيادة radius.

---

## E5. Multi-part expression is valid

Thread واحدة قد تُعرض في عدة local presentation patches مرتبطة بنفس الـHome Anchor إذا كانت هذه الطريقة لاحقًا هي الأنسب.

Stage 2.3 لا يحدد شكلها.

لكن يجمد:

> **disconnected presentation ≠ multiple canonical homes.**

---

# F. Dense vs Sparse Neighborhood Behavior

## F1. Same model at all densities

لا يوجد:

- sparse Thread ontology؛
- dense Thread ontology.

كلاهما:

```text
one Thread
one Home Anchor
adaptive Neighborhood
```

---

## F2. Sparse Neighborhood

Thread قد تحتوي قليل جدًا من material رغم مرور وقت طويل.

هذا لا يؤدي إلى:

- deleting Anchor؛
- reclaiming place؛
- shrinking canonical territory—لأنه أصلًا لا توجد fixed canonical territory.

Presentation قد تصبح minimal جدًا.

---

## F3. Dense Neighborhood

Thread كثيفة جدًا يمكن أن تحتاج:

- greater local expression؛
- more selective simultaneous disclosure؛
- adaptive composition؛
- overflow.

لكن:

**density ≠ spatial authority.**

---

## F4. Density does not determine Thread importance

Thread فيها 300 objects ليست تلقائيًا:

- أكثر أهمية؛
- أكثر مركزية؛
- أكثر قربًا من غيرها؛
- deserving of more permanent territory.

---

# G. Neighboring-Growth Pressure Contract

## G1. Neighboring Home Anchors are immovable facts

Work وAhmed Anchors ثابتين.

لو الاثنين أصبحوا dense جدًا:

الحل ممنوع يكون:

> move Work left and Ahmed right.

---

## G2. Neighborhood expressions may negotiate presentation locally

Local presentation may later adapt:

- disclosure;
- temporary local displacement of non-canonical presentation elements;
- contour;
- overlap management;
- clipping;
- local composition.

لكن Anchors تظل fixed.

---

## G3. Presentation collision never creates canonical conflict

لو rendered Neighborhoods تتداخل:

ده لا يعني:

> canonical geography is invalid.

هو:

> presentation-pressure problem.

Renderer/model presentation layer يجب أن تحله بدون تغيير world truth.

---

## G4. A dense neighbor has no eminent-domain right

Ahmed لا يمكنه طرد أو نقل Work لأنه نما أكثر.

ولا العكس.

---

## G5. Simultaneous growth is locally independent

لو 10 Threads تنمو في نفس الوقت:

كل واحدة تحافظ على Anchorها.

المطلوب من الـworld model:

> لا يوجد dependency تقول إن زيادة المحتوى تستلزم global canonical recomputation.

---

# H. Canonical Capacity / Territory Ownership Decision

دي ثاني أهم نتيجة في Stage 2.3.

## H1. Threads do not own fixed canonical territory beyond their Home Anchor

# **Decision: NO canonical fixed Thread territory.**

لا:

- permanent polygon؛
- radius؛
- cell؛
- quota؛
- sector.

---

## H2. Growth capacity is a capability, not owned land

**Growth capacity** يعني:

> Conversation World and its presentation model must remain capable of expressing additional Thread material without relocating existing permanent geography.

ده invariant وظيفي.

مش:

> reserved 800 units around every Thread.

---

## H3. No fixed future reservation

Stage 2.3 لا يحجز:

> “Ahmed future area”

حتى لو نعتقد أنه سينمو جدًا.

Uncommitted world capacity remains unowned.

---

## H4. No exclusive Neighborhood land claim

Adaptive expression قد تستخدم منطقة presentation اليوم ثم لا تحتاجها لاحقًا.

هذا لا يخلق canonical land title.

---

## H5. Home Anchor ownership remains exclusive

الشيء الوحيد الحصري حاليًا هو:

> **the committed permanent Home Anchor placement itself.**

Established Thread أخرى لا تستطيع أخذ نفس canonical placement.

---

## H6. Presentation usage can overlap conceptually

Because Neighborhood envelopes aren't canonical property parcels, their presentation influence may overlap or interpenetrate as later visual systems require.

هذا لا يعني semantic overlap.

ولا canonical merge.

---

# I. Historical K(t) Requirements

## I1. K(t) preserves canonical Thread geography

في أي historical time بعد establishment:

- same Thread;
- same Home Anchor.

---

## I2. K(t) filters material availability

لو Ahmed حاليًا عندها 200 analytical items، وعند `K(t1)` كان الموجود 10 فقط:

historical state يعرض فقط then-valid material.

---

## I3. Exact historical Neighborhood shape is not required canonical history

بما إن:

- boundary;
- local packing;
- extent;
- density expression

ليست canonical truth،

فـK(t) **ليس مطلوبًا** منه إعادة إنتاج exact screen/local Neighborhood geometry كما ظهرت وقتها.

المطلوب هو:

> reconstruct historically valid world content around the same canonical Home Anchor.

---

## I4. Current presentation rules may render historical truth

Historical K(t) يمكن أن يستخدم renderer الحالي لعرض then-valid material.

بشرط ألا يدّعي:

> “this was exactly how the screen looked then.”

Historical analytical/world truth ≠ historical UI recording.

---

## I5. Future material cannot cause historical expansion

لو Ahmed became dense at t50:

K(t10) لا يجوز أن يعرض future objects أو future analytical structure.

حتى لو renderer الحالي يستطيع استيعابهم.

---

## I6. Future density does not rewrite past geography

Home Anchor same.

Material set differs.

Adaptive expression may differ.

Canonical geography remains stable.

---

# J. Large-Growth Proofs

## Test 1 — Thread becomes 20× denser

Ahmed:

5 → 100+ relevant items.

Result:

- same Anchor؛
- Neighborhood expression adapts؛
- no canonical territory expansion required؛
- no neighbor moves.

**PASS**

---

## Test 2 — Work stable while Ahmed explodes

Work remains unchanged.

Ahmed grows dramatically.

Wrong:

> push Work away.

Correct:

> adapt Ahmed's local expression/overflow.

**PASS**

---

## Test 3 — Two mature dense Threads

Work + Ahmed both very dense.

Anchors remain fixed.

Their adaptive expressions may experience local pressure.

No global geography rewrite.

**PASS**

---

## Test 4 — Ten simultaneous growth events

All ten Neighborhoods receive new material.

Canonical world change:

none at anchor layer.

Presentation recomputation can remain local/viewport-scoped.

No force optimization required.

**PASS**

---

## Test 5 — Reopened Thread immediately becomes dense

Ahmed dormant for hours.

Reopens and 50 new analytical structures become available rapidly.

Result:

same Home Anchor.

Neighborhood re-expresses current density.

No spatial reset.

**PASS**

---

## Test 6 — Very sparse lifelong Thread

Thread remains sparse.

Its Home Anchor remains persistent.

No territory-release requirement exists.

No packing pressure caused by fixed reserve because no fixed reserve was frozen.

**PASS**

---

## Test 7 — Late Thread near mature geography

Stage 2.2 commits its new Home Anchor without moving existing Anchors.

Stage 2.3 does not require allocating a fixed polygon around it.

Therefore future growth remains solvable through adaptive expression rather than guaranteed empty parcel.

**PASS**

---

## Test 8 — No obvious visual room

Current renderer cannot fit more visible material near Ahmed.

This is presentation failure/pressure.

Not world-model permission to relocate Ahmed.

Renderer may reduce simultaneous disclosure or use another presentation expression later.

**PASS**

---

## Test 9 — Historical early Ahmed

Current:

200 items.

Historical:

12 items valid.

Same Anchor.

Only historically valid structure appears.

No need to reproduce old polygon.

**PASS**

---

## Test 10 — Huge world

5,000 Threads.

One Thread receives new material.

Nothing in frozen Stage 2.3 requires recalculating 4,999 canonical placements.

Therefore the world model does not intrinsically become a global graph-packing problem.

**PASS**

---

# K. Negative / Adversarial Cases

## K1. Fixed radius per Thread

> Every Thread gets radius 400.

**REJECTED.**

No truth basis.

---

## K2. Voronoi ownership

> Every Anchor permanently owns its nearest-cell area.

**REJECTED.**

Premature geometry + fixed territorial ownership.

---

## K3. Dense Thread deserves more permanent land

**REJECTED.**

Density is presentation demand, not canonical authority.

---

## K4. Important Thread gets bigger territory

**REJECTED.**

Importance has no spatial truth authority.

---

## K5. Relation discovered → expand toward related Thread

**REJECTED.**

GSR cannot control growth geography.

---

## K6. Conversation repeatedly alternates Work/Ahmed → neighborhoods stretch toward each other

**REJECTED as canonical rule.**

Conversation Transition frequency has no geographic authority.

---

## K7. Semantic similarity → share region

**REJECTED.**

---

## K8. Ahmed reaches boundary of its original polygon

Invalid premise.

No canonical polygon exists.

---

## K9. Neighborhood cannot fit, so move Anchor

**REJECTED.**

Presentation failure cannot mutate geography.

---

## K10. Neighborhood grows over another Thread's Anchor

Presentation must preserve the legibility/integrity of both Anchors.

It cannot erase or reinterpret another permanent placement.

But this is local presentation pressure—not permission to move either Anchor.

---

## K11. Very sparse Thread's “unused space” is reclaimed

There is no canonical reserved territory to reclaim.

Only Anchor placement is permanent.

---

## K12. Dormant Thread visually minimal → delete its Neighborhood identity

Neighborhood may be minimally expressed.

Thread and Anchor remain.

---

## K13. Reopened Thread gets current-density-based new placement

**REJECTED.**

---

## K14. 50 Threads grow → optimize global layout

**REJECTED.**

Content growth is not anchor-layout event.

---

## K15. Renderer A uses compact Neighborhood, Renderer B uses broad one

Allowed if:

- same Thread;
- same Home Anchor;
- same canonical analytical truth;
- only presentation extent differs.

---

## K16. Renderer A moves Home Anchor to make broad Neighborhood work

**REJECTED.**

---

## K17. One Thread appears in disconnected presentation patches

Allowed.

Still:

- one Thread;
- one Home Anchor.

No duplicate canonical geography.

---

## K18. Disconnected expression interpreted as several Threads

**REJECTED.**

Presentation segmentation cannot manufacture identity.

---

## K19. Current dense Neighborhood projected densely into old K(t)

Wrong if those objects were not yet available.

Historical filtering is analytical availability-driven.

---

## K20. Reconstruct exact historical contour from current model

Not required.

Contour isn't canonical history.

---

# L. Gate 2.3 Result

| Gate requirementResult                                             |          |
| ------------------------------------------------------------------ | -------- |
| Thread Neighborhood precisely defined                              | **PASS** |
| Neighborhood distinguished from Home Anchor                        | **PASS** |
| Neighborhood not treated as semantic container                     | **PASS** |
| Neighborhood not a second canonical identity                       | **PASS** |
| Fixed polygon/circle/cell assumptions rejected                     | **PASS** |
| Contiguity not required                                            | **PASS** |
| Neighborhood extent classified as adaptive                         | **PASS** |
| Canonical Thread-level spatial memory remains Home-Anchor-based    | **PASS** |
| Existing-Thread density growth does not create permanent geography | **PASS** |
| Append-oriented local growth defined without land allocation       | **PASS** |
| Global canonical optimization prohibited                           | **PASS** |
| Local expansion can occur without Anchor movement                  | **PASS** |
| Overflow is legitimate                                             | **PASS** |
| Overflow does not require radial growth                            | **PASS** |
| Multi-part Neighborhood expression allowed                         | **PASS** |
| Sparse/dense Threads use same world model                          | **PASS** |
| Density grants no canonical spatial authority                      | **PASS** |
| Neighboring mature Threads can both grow without moving Anchors    | **PASS** |
| Simultaneous growth does not require global re-layout              | **PASS** |
| No fixed canonical Thread territory introduced                     | **PASS** |
| No arbitrary future-capacity quantity introduced                   | **PASS** |
| Growth capacity defined as capability, not reserved land           | **PASS** |
| Uncommitted capacity remains unowned                               | **PASS** |
| Presentation pressure distinguished from canonical conflict        | **PASS** |
| Historical K(t) preserves same Anchor                              | **PASS** |
| Historical material is availability-filtered                       | **PASS** |
| Exact historical Neighborhood geometry not falsely made canonical  | **PASS** |
| Huge-world growth does not intrinsically require graph packing     | **PASS** |
| No object-placement contract from Stage 2.4 was introduced         | **PASS** |
| No algorithm/coordinate/geometry selected                          | **PASS** |
| No Stage 2.4 work begun                                            | **PASS** |

# **GATE 2.3 RESULT: PASS**

No contradiction requires reopening Stage 0, Stage 1, Stage 2.1, or Stage 2.2.

---

# M. Stage 2.3 Freeze Candidate

إذا وافقت، نجمد الآتي:

### **NH-01**

A Thread Neighborhood is the adaptive local spatial expression of one Established Thread around its permanent Home Anchor.

### **NH-02**

Thread Neighborhood is not a separate canonical identity from its Thread.

### **NH-03**

Thread Neighborhood is spatial context, not semantic/ontological ownership.

### **NH-04**

Neighborhood expression does not need to be a fixed polygon, circle, cell, contiguous region, nested container or permanently bounded territory.

### **NH-05**

The Home Anchor is canonical geography; Neighborhood extent is adaptive expression.

### **NH-06**

Neighborhood boundary, footprint, extent, density and contour are not canonical spatial truth in Stage 2.3.

### **NH-07**

Spatial memory of Thread identity is anchored by the permanent Home Anchor, not by preserving an exact Neighborhood shape.

### **NH-08**

Every Neighborhood expression must remain referentially tied to its one Home Anchor even when locally recomposed.

### **NH-09**

A Thread may have spatially discontinuous/multi-part presentation expression while retaining exactly one Home Anchor.

### **GROW-01**

Growth of an already Established Thread's material does not by itself create new permanent canonical geography.

### **GROW-02**

Additional Thread material changes adaptive Neighborhood expression rather than reallocating or extending canonical Thread-owned land.

### **GROW-03**

Append-oriented growth means adding later material without rewriting earlier permanent geography.

### **GROW-04**

Content growth does not authorize global Home-Anchor optimization or re-layout.

### **GROW-05**

Growth in one Thread does not semantically require recomputation of unrelated Thread Neighborhoods.

### **GROW-06**

Local presentation pressure may be handled locally without canonical relocation.

### **OVR-01**

Neighborhood overflow beyond an earlier convenient presentation footprint is legitimate.

### **OVR-02**

Overflow does not create another Home Anchor or another Thread.

### **OVR-03**

Overflow need not be contiguous or radial.

### **OVR-04**

Lack of obvious local display room is a presentation problem, not a canonical geography failure.

### **DEN-01**

Sparse and dense Threads use the same canonical world model.

### **DEN-02**

Thread density changes adaptive expression, not spatial authority.

### **DEN-03**

Thread importance, confidence, emotional intensity, relation count or content volume never grant additional canonical territorial rights.

### **PRESS-01**

When neighboring mature Neighborhoods both grow, all existing Home Anchors remain fixed.

### **PRESS-02**

Neighborhood presentations may locally adapt to pressure, but neither Thread can displace the other's Home Anchor.

### **PRESS-03**

Presentation collision/overlap is not evidence of canonical spatial conflict or semantic relation.

### **PRESS-04**

Simultaneous growth across many Threads never authorizes global canonical reshuffling.

### **CAP-01**

Beyond its Home Anchor, a Thread owns no fixed canonical territory under Stage 2.3.

### **CAP-02**

No canonical radius, polygon, sector, cell, envelope, reserve size or growth corridor is assigned to a Thread.

### **CAP-03**

Growth capacity is a world-model capability to express additional material without relocating existing permanent geography.

### **CAP-04**

Growth capacity is not preallocated or exclusively owned land.

### **CAP-05**

Uncommitted world capacity remains unowned until a later canonical contract truthfully commits permanent geography.

### **CAP-06**

The currently exclusive canonical spatial entitlement of an Established Thread is its Home Anchor placement.

### **CAP-07**

Adaptive Neighborhood presentation may use, vacate, overlap or redistribute presentation space without creating canonical territorial ownership.

### **HIST-NH-01**

Historical K(t) preserves the same canonical Home Anchor for every then-valid Established Thread.

### **HIST-NH-02**

Historical K(t) includes only material/analysis that was available at t.

### **HIST-NH-03**

Exact historical Neighborhood boundary, packing, contour or rendered extent is not required canonical history.

### **HIST-NH-04**

Historical projection may use current presentation rules to render then-valid truth, provided it does not claim to recreate exact historical UI appearance.

### **HIST-NH-05**

Later Neighborhood density never leaks future objects or analytical material into earlier K(t).

### **BND-NH-01**

Grounded Semantic Relations do not control Neighborhood growth geography.

### **BND-NH-02**

Conversation Transitions do not control Neighborhood growth geography.

### **BND-NH-03**

Semantic similarity does not control Neighborhood growth geography.

### **BND-NH-04**

Renderer/device constraints may adapt Neighborhood presentation but may never move Home Anchors.

### **BND-NH-05**

Stage 2.3 does not define the placement/participation behavior of Records, Events, Memories, Readings, Unknowns, Questions, shared objects or Cross-Thread Shared Anchors; Stage 2.4 owns that contract.

### **BND-NH-06**

Stage 2.3 introduces no geometry family, coordinate system, tiling scheme, packing algorithm, contour model, renderer, pan/zoom behavior or Timeline behavior.

---

# STAGE 2.3 STATUS

**Thread Neighborhood definition:** COMPLETE
**Anchor↔Neighborhood contract:** COMPLETE
**Canonical vs adaptive boundary:** COMPLETE
**Append-oriented growth:** COMPLETE
**Overflow/local expansion:** COMPLETE
**Dense/sparse behavior:** COMPLETE
**Neighbor-pressure contract:** COMPLETE
**Capacity/ownership decision:** COMPLETE
**Historical K(t):** COMPLETE
**Large-growth stress suite:** PASS
**Adversarial validation:** PASS
**Gate 2.3:** ✅ **PASS**

## **STAGE 2.3 — FREEZE CANDIDATE**

**Stage 2.4 — NOT STARTED.**

أتوقف هنا لحد موافقتك الصريحة على Freeze Stage 2.3.