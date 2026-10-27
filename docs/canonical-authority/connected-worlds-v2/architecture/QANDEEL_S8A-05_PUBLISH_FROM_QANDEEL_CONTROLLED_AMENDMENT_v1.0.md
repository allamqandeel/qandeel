# QANDEEL — Connected Worlds v2
## S8A-05 CP2 — Public World: «انشر من قنديل» / Publish from QANDEEL — Narrow Controlled Amendment v1.0

**Status:** `EFFECTIVE SINCE THE MERGE OF PR #360 AS 72898797 (2026-10-27) — S8A-05 CLOSED / READY FOR PO MERGE DECISION (2026-10-27, the S8A-05 CP4 closing
change; record §13.10)`. As written at its review: `CANDIDATE CONTROLLED AMENDMENT — DIRECTION APPROVED BY THE PRODUCT OWNER (S8A-05 CP2 order, 2026-10-27) — AT THE
S8A-05 CP2 REVIEW GATE — NOT EFFECTIVE`. It binds from the merge of the S8A-05 CP2 pull request that carries it, after the
Product Owner approves that pull request. Until then nothing below is in force.  
**Scope:** Public topics made from the publisher's own Personal World (`MY_WORLD`) — whole committed messages of their own
Personal conversation with QANDEEL, and the summary of a «فهم قنديل» / QANDEEL Understanding item shown to them — and the
discard of any topic that was never published. Shared World material, Replay artifacts, revisions of a published topic,
the Public semantic / spatial binding, Public discussion and Voice are outside it  
**Amends, narrowly and only in that scope:** A-3 — CW2-04 Public World Runtime Architecture v1.0 §4, §5 and §7 (quoted in
§3); and the S8A-05 CP1 amendment's A-2(c) (quoted in §4), which is effective since the merge of PR #359  
**Authority:** the Product Owner, *S8A-05 CP2 order* (2026-10-27, local time +03:00), which orders A-3 "exactly as the
approved text in WP1-R1 §6.3" and the WP1-R1 §8 replacement of A-2(c); the Public World Product Definition §28 rule 5
("later decisions govern")  
**Task:** `S8A-05` — CP2 (Publish from QANDEEL). It is not a new task and not a Connected Worlds phase  
**Implementation:** S8A-05 CP2, on branch `s8a/s8a-05-cp2` from `main` at `7c0356b7` (the merge of PR #359, S8A-05 CP1);
migration `0180`; record: [S8A-05 implementation record §11 onward](../../../e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md#11-s8a-05-cp2--publish-from-qandeel)

This record is additive. CW2-04 and the S8A-05 CP1 amendment stay byte-identical; each passage this record narrows is quoted
below and binds as narrowed only after this record becomes effective. No closed-stage record is edited.

---

# 1. Why an amendment is needed

The Product Owner's goal for CP2: a person can turn what they chose of their own conversations with QANDEEL into a Public
topic, keeping their own voice, QANDEEL's original words and the true order of the conversation, and keeping the decision
of what becomes public theirs alone. CW2-04 admits only "selected QANDEEL analysis" without saying which QANDEEL text may be
public, who approves it, or how it is presented. CP1's A-2(c) lets only an all-`PUBLIC_AUTHORED` topic be discarded, so a
topic holding conversation items could not be withdrawn before publication. Both are narrowed here, and only here.

Governing principle (Product Owner): **the person decides what they publish.** QANDEEL does not rewrite the conversation,
does not turn it into a story of its own, and publishes nothing without an explicit choice.

---

# 2. The Product Owner's decisions (S8A-05 CP2 order, 2026-10-27)

1. The selection is the reader's: a whole conversation, a contiguous range, separate whole messages, and emphasized
   messages. Whole committed messages only; nothing is cut inside a message or reordered.
2. Speakers are shown clearly: the person by their public name, QANDEEL as «قنديل».
3. QANDEEL's original replies may be included, or the summary of a «فهم قنديل» card shown to the person.
4. A faithful preview of what will become public, understandable privacy warnings, then preparation through the existing
   Public Experience, Package and Manifest.
5. Long conversations are paged and loaded in stages; nothing the person chose is dropped silently.
6. No AI screening or moral judgement of the content, and no paid call.
7. Discarding a topic that was never published erases every text, every digest, every derivation and every private source
   reference, including items that are not `PUBLIC_AUTHORED` (as WP1-R1 decided).
8. Production publishing stays closed: no CW2-08 gate, no Public discussion, no production publication path is opened.

---

# 3. A-3 — personal analytical material in a Public package (CW2-04)

## 3.1 The passages narrowed (quoted, unchanged in their own file)

CW2-04 §4: "Eligible payload may include: human text; voice/audio; selected QANDEEL analysis; Replay artifact; bounded
public metadata."

CW2-04 §5: "Authorized source may come from: `MY_WORLD`, `SHARED_WORLD`, `REPLAY_ARTIFACT`."

CW2-04 §7: the required approver set of a package item.

## 3.2 The text of A-3 (binds once effective; WP1-R1 §6.3, verbatim)

> **CA-S8A05-A3 — Personal analytical material in a Public package**
> 1. *Scope.* This applies only to items derived from the publisher's own Personal World (`MY_WORLD`). Shared World material is unchanged (QANDEEL output in a Shared World remains unpublishable; `QAN-BL-CW-05`). Replay artifacts are governed by `REPLAY-DIST-01`.
> 2. *Admissible analytical items, exactly two:* (a) a QANDEEL reply of the publisher's own Personal conversation, as whole committed messages; (b) the summary text of a QANDEEL Understanding item exactly as it is currently shown to the publisher, at its exact revision, only while it is shown and not under review.
> 3. *Never admissible:* evidence, assumptions, disconfirming conditions, confidence, importance or any score, information gaps, Memory content, HIM, sealed provenance, analytical objects not shown to the user as text, and any text generated for the purpose of publishing.
> 4. *Authority.* The required approver set of an admissible analytical item is the Personal World owner alone. Being mentioned, described or analysed in an item confers no approval right and no veto: mention is not ownership. This is the rule that already governs the owner's own words.
> 5. *Presentation.* (a) is labelled QANDEEL. (b) is labelled as QANDEEL's understanding, with fixed Copy-Gated text stating that it is an unconfirmed inference, not a fact. No confidence value is shown.
> 6. *Disclosure, not guardianship.* Before freeze, the publisher sees every item that will become public with its speaker label, the deterministic contact-data and self-identification warnings, and one acknowledgement that QANDEEL material may describe other people and that publishing it is the publisher's decision. No AI screening and no refusal on the ground of mentions.
> 7. *Order.* Items are presented in their true session order, sealed at freeze.
> 8. *Independence.* Publication is an independent derivative (CW2-04 §31, D33).
> 9. *Closed refusal list:* not the publisher's own material; not a whole message; Understanding item withheld, under review or at a stale revision; source unavailable; any class in (3).

## 3.3 How CP2 realizes A-3 (informative; the binding text is §3.2)

| A-3 | Realized by (migration `0180` unless named) |
| --- | --- |
| 1 Scope | Sources are the author's own Personal conversation (`resolve_personal_range_v1`, 0169) or their own Understanding item; no Shared or Replay source exists in CP2 |
| 2(a) | One package item per whole committed unit of the selected messages; QANDEEL's units `ANALYTICAL_DERIVATIVE`, the author's `SOURCE_CONTENT_BEARING` |
| 2(b) | The Understanding item's `statement`, read on the server from its opaque ref at the exact version the card showed (`POST /understanding/items/:ref/public-topic`; an older revision is 409); refused while withheld (`evidenceChange ≠ NONE`) or under review, at preview and again at freeze |
| 3 | No route, column or function carries any of these classes; the client sends references only (positions, a ref and a revision), never a text, a speaker or an order |
| 4 | The author is the sole approver of every item; no mention check exists |
| 5 | «قنديل» and «فهم قنديل — استنتاج غير مؤكد، ليس حقيقة» (both in the S8A-05 CP2 Copy Gate); no confidence is read or shown |
| 6 | The paged preview is the same projection the freeze seals; the CP1 deterministic privacy notes now read every item; one acknowledgement, bound to the exact draft revision previewed, is required whenever QANDEEL material is present |
| 7 | `item_presentation`: display position, true Session Position, message, emphasis and gap, written in the freeze transaction |
| 8 | Unchanged CW2-04 §31 |
| 9 | `SOURCE_UNAVAILABLE`, `NOT_WHOLE_MESSAGES`, `SELECTION_INVALID`, `NOTHING_SELECTED`, `UNDERSTANDING_CHANGED`, `UNDERSTANDING_UNDER_REVIEW`, `UNDERSTANDING_WITHHELD`; plus the declared processing envelope (`TOO_LARGE`, WP1-R1 §5.2), refused before any write |

---

# 4. A-2(c), narrowed — discarding a topic that was never published

## 4.1 The passage narrowed (quoted from the S8A-05 CP1 amendment §4.4, unchanged in its own file)

"A topic that was **never published** and whose every item is `PUBLIC_AUTHORED` may be discarded by its controller:
`DRAFT | READY_FOR_REVIEW → ABSENT_FROM_PUBLIC_WORLD`, with its immutable lifecycle event."

## 4.2 The narrowing (binds once effective; WP1-R1 §8, as ordered)

A topic that was never published is discarded by erasing every class of its material, every digest and every private
source pointer, with the movement `DRAFT | READY_FOR_REVIEW → ABSENT_FROM_PUBLIC_WORLD`; the census of lifecycle movers
stays five (four plus this one). A place in the field is computed only at publication. The freeze is atomic and is not
available in production before publication opens.

In CP2 this means: the condition "whose every item is `PUBLIC_AUTHORED`" is removed. The discard also erases `MY_WORLD`
items (bodies, both digests, the personal source pointers), the version's human title, the sealed presentation rows and the
bounded search document, at one instant, and the author's private draft keeps its reference (never a copied text). A
Replay artifact is not a CP2 source and stays `REPLAY-DIST-01`'s. Everything else of A-2(c) is unchanged.

---

# 5. What the server guarantees (CP2)

- The draft stores a reference-based source specification only. The server re-derives every text, speaker, order and
  owner from the canonical rows, at preview and again at freeze; a message removed or no longer available before the
  freeze is an explicit refusal, never a smaller topic.
- The preview and the sealed package come from one projection: what the author previews is what would be sealed.
- The freeze is atomic (every item in its true order, or nothing). Above the processing envelope (10,000 units or 8 MB of
  text) it refuses before any write; nothing is cut or dropped. Measured on local PostgreSQL 17 at the envelope: under 3 s.
- The freeze stays closed in production (the CP1 seam answers `NOT_EVALUATED`); it is proven only inside a controlled,
  rolled-back verifier.
- A reader is never told where in the author's private conversation a message stood: the public items carry no Session
  Position.
- Search reads one bounded document per sourced version (≤ 8 KB); the bounded inputs for CP3's interpreter (≤ 24 KB) and
  CP4's `@qandeel` context (≤ 6 KB) exist and are executable by no application role. Nothing calls a model.

---

# 6. Not changed, and what stays open

- Not changed: CW2-08 and every Stage 9 gate; Public discussion; the S5-03A interpretation and S5-03B placement; 0099
  removal; Public identity and labels; Shared World QANDEEL output (`QAN-BL-CW-05`); Replay (`REPLAY-DIST-01`); Voice.
- S8A-05 CP3: the Public semantic and spatial binding (placement computed at publication; it consumes the 24 KB input).
- S8A-05 CP4: revisions of a published topic, Public discussion, the original poster and the `@qandeel` context (it
  consumes the 6 KB context), and S8A-05's closure.
