# QANDEEL — Connected Worlds v2
## S8A-05 CP1 — Public World: «اكتب موضوعك» / Write Your Topic — Narrow Controlled Amendment v1.0

**Status:** `EFFECTIVE SINCE THE MERGE OF PR #359 AS 7c0356b7 (2026-10-26) — S8A-05 CLOSED / READY FOR PO MERGE DECISION (2026-10-27, the S8A-05 CP4 closing
change; record §13.10)`. As written at its review: `CANDIDATE CONTROLLED AMENDMENT — DIRECTION APPROVED BY THE PRODUCT OWNER (S8A-05 CP1 order, 2026-10-26) — AT THE
S8A-05 CP1 REVIEW GATE — NOT EFFECTIVE`. It binds from the merge of the S8A-05 pull request that carries it, after the
Product Owner approves that pull request. Until then nothing below is in force.  
**Scope:** directly written Public topics only — their private drafts, their human title, their user-chosen section, their
preparation for publication and the discard of a topic that was never published. Conversation-derived topics, revisions
of a published topic, the Public semantic / spatial binding, Public discussion and Replay / Voice are outside it  
**Amends, narrowly and only in that scope:** A-1 — the Public World Product Definition v1 (§1, §10, §22, §23, quoted in §3);
A-2 — CW2-04 Public World Runtime Architecture v1.0 (§3, §4, §5, §12, quoted in §4)  
**Authority:** the Product Owner, *S8A-05 CP1 order* (2026-10-26, local time +03:00), which approves the S8A-05 WP1 design
with its WP1-R1 corrections as the implementation basis; the Public World Product Definition §28 rule 5 ("later decisions
govern")  
**Task:** `S8A-05` — CP1 (Public World: Write Your Topic). It is not a new task and not a Connected Worlds phase  
**Implementation:** S8A-05 CP1, on branch `s8a/s8a-05-cp1` from `main` at `9459245e` (the merge of PR #358, S8A-04);
migration `0179`; record: [S8A-05 implementation record](../../../e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md)

This record is additive. The Public World Product Definition v1 and CW2-04 are frozen and stay byte-identical; each passage
this record narrows is quoted below and binds as narrowed only after this record becomes effective. No closed-stage record
(Stage 5, Stage 7, S8A-04) is edited.

---

# 1. Why an amendment is needed

The frozen Public World starts every Experience from material that already exists in a person's life with QANDEEL (a call,
a chat, a Replay, Shared material) and shows QANDEEL's `meaning` as the headline of every topic on the map, in search and in
the panel. The Product Owner's direction for S8A-05 is that the Public World is a place for **human stories**, written by
people, where QANDEEL is not the hero of the interface. A person must be able to start a topic directly, give it a human
title, and place it in one section they choose. The frozen texts do not allow that, so they are narrowed here, and only
here.

Governing principle (Product Owner): **the person writes and decides; QANDEEL's understanding stays behind the scenes.**

---

# 2. The Product Owner's decisions (S8A-05 CP1 order, 2026-10-26)

1. The Public World is for human stories; QANDEEL is not the hero of the interface.
2. A direct new topic, with a human title and text the person writes.
3. Exactly one section, chosen by the person, from 12 sections plus «حكايات مفتوحة»; the names pass the Copy Gate.
4. Drafts are saved securely on the account, and can be edited and deleted.
5. Title 8–100 characters; text up to 5,000 characters. Long conversations belong to CP2.
6. The existing Public Experience is used; no parallel posts system.
7. WP1-R1 decisions D-1 … D-8 apply in the stages that own them.
8. No production publishing and no commenting before Stage 9.
9. No Replay and no Voice.
10. Preparing for publication must not create a Public Identity in production before the publication gates open; the full
    path is proven in a controlled verification environment only, and the CW2-08 gate is not bypassed.

---

# 3. A-1 — Public World Product Definition addendum

## 3.1 The passages narrowed (quoted, unchanged in their own file)

PD §1: «التجربة العامة الأساسية لا تبدأ من "اكتب بوستًا".»

PD §10: «العالم العام ليس مجموعة Categories منفصلة ذات حدود صلبة.»

PD §22: «التصنيف والتمركز يجب أن ينبعا من: المادة المنشورة نفسها. المعاني التي وافق عليها المستخدم أو صححها.»

PD §23: «لا نريد Tabs كثيرة تجعل العالم مجموعة صفحات منفصلة.» and the principle **World-first, not post-first.**

## 3.2 The addendum (binds once effective)

1. **Direct writing is a primary Public path.** Besides material from a person's life with QANDEEL, a person may start a
   topic directly by writing it: a human title and their own text. §1's sentence no longer excludes this path; it still
   describes the material-derived path, which is unchanged.
2. **The human title is the headline.** Where a topic has a human title, the map label, the search result and the panel
   heading show that title, not QANDEEL's `meaning`. QANDEEL's understanding stays behind the scenes. A topic without a
   human title (every topic that exists before this amendment) keeps showing its `meaning`.
3. **One user-chosen section, which is not geography.** A directly written topic belongs to exactly one section the person
   chooses from twelve sections plus «حكايات مفتوحة». A section is a reading aid and a label. It is not a hard Category in
   §10's sense: it does not decide, move or bound the topic's place in the semantic field. Placement still comes from the
   published material alone (§22), and a change of section never moves a topic.
4. **No tabbed world.** Sections are not separate pages or tabs of the world (§23). A viewer may look at one section of the
   same field, by their own choice: the topics outside it recede, nothing moves and nothing leaves the field, and search
   may run inside it. The section is also shown as a label in the panel.
5. **QANDEEL never chooses for the person.** QANDEEL does not suggest the title or the section of a directly written topic.

---

# 4. A-2 — CW2-04 Public World Runtime Architecture

## 4.1 The passages narrowed (quoted, unchanged in their own file)

CW2-04 §3: the lifecycle `DRAFT`, `READY_FOR_REVIEW`, `PUBLISHED`, `ABSENT_FROM_PUBLIC_WORLD`.

CW2-04 §4: "Eligible payload may include: human text; voice/audio; selected QANDEEL analysis; Replay artifact; bounded
public metadata."

CW2-04 §5: "Authorized source may come from: `MY_WORLD`, `SHARED_WORLD`, `REPLAY_ARTIFACT`."

CW2-04 §12: "Each publishable version receives a bounded semantic interpretation based only on its public package."

## 4.2 A-2(a) — a fourth source class, `PUBLIC_AUTHORED`

§5 gains a fourth authorized source class, `PUBLIC_AUTHORED`: text written directly for the Public World by its author. An
authored item carries no source identifier (no World, no Session, no unit): its author is the manifest's publisher, bound
there, and the author is its sole required approver. Its public body **is** the author's text; nothing hidden stands behind
it, so §5's "never creates navigation/access back into hidden source Worlds" holds trivially. The I-05A authority
derivation, the provenance shape checks and the digest-erasure checks admit the class and nothing else changes for the
three existing classes.

## 4.3 A-2(b) — bounded public metadata: a title and a section

§4's "bounded public metadata" is defined, for a directly written topic, as exactly:

- **a human title**, 8–100 characters, bound to exactly one Experience Version (a new version carries its own title). It
  is erasable one-way, together with the version's content. An optional edit note (≤ 140 characters) for a revision of a
  published topic belongs to CP4 and is not part of CP1;
- **a section**, bound to the Experience (the container), not to a version, with an append-only history of changes.

Neither the title nor the section is part of the package that §12's semantic interpretation reads, and neither is an input
to semantic placement (§14). The interpretation still reads only the public package; a section change creates no version,
no interpretation and no placement.

## 4.4 A-2(c) — discarding a topic that was never published

1. **A fifth lifecycle movement.** A topic that was **never published** and whose every item is `PUBLIC_AUTHORED` may be
   discarded by its controller: `DRAFT | READY_FOR_REVIEW → ABSENT_FROM_PUBLIC_WORLD`, with its immutable lifecycle event.
   The census of functions that may move a Public Experience lifecycle grows from four to five; no other movement is added.
   A published topic is never discarded this way; its removal stays CW2-04 §29's owner deletion, unchanged.
2. **One-way erasure, at one instant.** The discard erases every public body, both content digests (public and captured
   source), the human title and every semantic text derived from it, and keeps no private source pointer. The one-way
   package guard admits exactly this second exception, proven by the discard command at the same instant. The person's
   private draft keeps the words, and returns to editing.
3. **Placement only at publication.** A place in the semantic field is computed for a topic only when it is published.
   (Binding the Public semantic / spatial producers to that moment is S8A-05 CP3's work; CP1 adds no placement.)
4. **The freeze is atomic and closed in production.** Preparing a draft for publication (provisioning the one Public
   Identity, starting the Experience, preparing and approving its one authored item, reaching `READY_FOR_REVIEW`) happens
   in one transaction, and it is **not available in production before the Stage 9 publication gates open**. A closed
   seam answers `NOT_EVALUATED` in every environment; only a controlled verifier replaces it, inside a transaction it rolls
   back. No CW2-08 gate is opened or bypassed.

---

# 5. What the server guarantees (CP1)

- A draft is private to its author's account: no other person, role or channel reads, lists, changes or deletes it, and
  nothing answers whether another person's draft exists.
- Drafting, saving, reading, listing, previewing and deleting a draft create no Public Identity and no Public footprint.
- Drafts cascade with the account (`ACCOUNT_CASCADE`, registered); they never block account deletion.
- Deleting a draft erases its words; a prepared, never-published topic is discarded first, in the same transaction.
- The preview is exactly what preparation would publish: the same trimmed title and text, byte for byte.
- Export My Data carries the reader's own drafts as `publicTopicDrafts`, and nothing of anyone else's.
- Viewers see a human title only for an Experience they may already see, and only the title of its visible version.

---

# 6. Not changed, and what stays open

- Not changed: the CW2-08 publication seam and every Stage 9 gate; Public discussion and its entitlement seam; S5-03A
  semantic interpretation and S5-03B placement (reused unchanged); 0099 removal; Public identity and labels; Replay; Voice.
- S8A-05 CP2: topics from QANDEEL conversations (long conversations, the conversation's own erasure rules) and discarding
  topics that hold non-authored items.
- S8A-05 CP3: the Public semantic and spatial binding (placement computed at publication).
- S8A-05 CP4: revisions of a published topic (with the optional edit note), Public discussion, the original poster and the
  `@qandeel` context, and S8A-05's closure.
