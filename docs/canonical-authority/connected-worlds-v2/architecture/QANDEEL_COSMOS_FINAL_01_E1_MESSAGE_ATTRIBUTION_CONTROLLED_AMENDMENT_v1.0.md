# QANDEEL — Connected Worlds v2
## COSMOS-FINAL-01 E-1 — Message Attribution in the Shared and Public Conversations — Narrow Controlled Amendment v1.0

**Status:** `PROPOSED R1 — REVISED UNDER THE PRODUCT OWNER'S UI-POLISH ADDENDUM (2026-11-20). E1(h) — THE SPEAKER BADGE — IS PO-DIRECTED AND IMPLEMENTED ON DRAFT PR #401 (d02cabe2). EVERY OTHER RULE IS NOT IN FORCE AND NOT IMPLEMENTED.`
R1 (2026-11-20, *PO UI-Polish Addendum — Chat Attribution Must Also Look Good*): adds E1(h); E1(a) now attributes the reader's
own Shared rows by the reader's badge; E1(f) is withdrawn (Public verified, unchanged); E1(g) is revised; §2 now names the one
change the Personal conversation takes. The R0 text is in git history (2cd2899a).  
It binds only after the Product Owner approves this text, its Copy Gate and its privacy / wire-contract review
([E-1 package](../../../e2e/QANDEEL_COSMOS_FINAL_01_E1_ATTRIBUTION_PACKAGE_v1.md)), and from the merge of the pull request
that implements it.  
**Scope:** who wrote each displayed message in a Shared World conversation (and the conversations that reuse its thread:
the closed World's read and the Introduction World), in a Shared place's source list, and in a Public discussion — as the
reader sees it, and — by E1(h) only — the Personal conversation (§2). Nothing else: QANDEEL's own attribution, the model's input,
Replay, Voice, the Manage page, Matching and every World's data are outside it.  
**Amends, narrowly and only in that scope:** S4-02's displayed Shared thread attribution (approved as implemented, record
lines 193–195); S4-02's read contract (record line 93, "adds only each human author's Name and whether THIS reader may
delete"); the S5-04 discussion
presentation of a post's author (with S8A-05 A-5(b) beside it). Each passage is quoted in the package §2 and binds as
narrowed only once this record is effective.  
**Authority:** the Product Owner, *COSMOS-FINAL-01 Continuation After §29 Review* (2026-11-20), item 2: "Approve Option A
as the design direction … This is authorization of the design direction, not a waiver of privacy or contract controls.
Prepare the narrow canonical amendment, required Copy Gate and privacy/wire-contract review. Do not introduce unreviewed
identity exposure." The register item it answers is COSMOS-INT-01 contract §20 E-1; the conflict it resolves is §29.8.  
**Task:** `COSMOS-FINAL-01` (COSMOS-INT-01 Slice E). It is not a new task.

This record is additive. G1.1 R3 and its canonical closure, the S4-02 / S5-04 records, S8A-02 §5.3 and S8A-05 A-5 stay
byte-identical.

---

## 1. Why an amendment is needed

E-1 (contract §20) requires that every displayed message say who wrote it; that the Shared World distinguish individual
participants, the reader and QANDEEL; and that the Public World keep its Public Identity model. The current canon does not
deliver that in two places (§29.8):

1. **Shared — the reader's own rows carry no visible attribution.** They are distinguished by edge and surface, as in the
   Personal conversation, while every other human row carries a Name. In a conversation of several humans the reader's own
   rows are the only unlabelled human rows.
2. **Shared — two participants can be indistinguishable.** The wire carries, per message, `producer` (SELF / HUMAN /
   QANDEEL) and `authorName` only. Two members with the same legitimate Name, two members whose Name this reader may not
   see (a Matching-born World before SUCCESS shows a handoff first name or nothing, 0155 `shared_person_name_v1`), or a
   member whose Name equals QANDEEL's word, cannot be told apart. S4-02 permits Names only; S8A-02 §5.3 rule 4 permits a
   per-request number for the model's input only, never shown.
3. **Public — the reader's own posts carry no self marker.** They show the reader's own Public display, as anyone else
   sees it; `own` is on the wire but used only for Retry.

## 2. The Personal conversation takes the speaker badge only

G1.1 R3, frozen by `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`, attributes the Personal
conversation's two speakers by position plus ground ("the reader is always on the slab tone at their own edge, and QANDEEL
on the World"; "neither speaker has a colour or an avatar"), and every turn announces «كلامك» / «قنديل» before its words
(R3-12a). The conversation has exactly two speakers, so position plus ground identifies each message's author
unambiguously. The Product Owner directs that it be preserved "provided its existing speaker distinction is demonstrated to
satisfy E-1"; the demonstration is the package §5 (a native iOS check and an Android check, with the existing W1A-01 pins).
If the demonstration failed, the amendment would return to the Product Owner, not change G1.1 R3.

**R1.** The Product Owner's UI-Polish Addendum (2026-11-20) then directed one visible speaker mark in the Personal
conversation as well ("Keep the new speaker attribution for Personal and Shared"). The Personal conversation therefore takes
E1(h) and nothing else: its two edges, the reader's slab, QANDEEL's open words, the paragraph directions and every accessible
name stay as G1.1 R3 fixes them; the row spacing and the slab padding are tightened as the addendum directs (items 5 – 6).
From this record's effect, E1(h) binds over G1.1 R3's "neither speaker has a colour or an avatar", and over nothing else.

## 3. The text of the amendment (binds once effective)

**E1(a) — the reader in a Shared conversation (R1).** Each of the reader's own rows is attributed visibly by the reader's
speaker badge (E1(h)): the initials of the reader's own account Name on the reader's tone. The R0 word «أنت» / "You" is not
added (the addendum: one treatment). Its accessible label is unchanged (W1A-01 «كلامك: …» / "You: …"). Position and surface
are unchanged.

**E1(b) — the per-World participant ordinal.** The authoritative server assigns each human participant of a Shared World a
**participant ordinal**: a positive integer, unique within that World, given once when the person's first membership
episode in that World begins, in that order, never changed and never reused (a person who leaves and returns keeps theirs;
a person who never joined has none). It is:
- **per World:** it is meaningless outside its World, and the same person's ordinals in two Worlds are unrelated;
- **non-identifying:** it is not derived from, and does not reveal, any account, user, member handle, Shared ID, Public
  identity or contact identifier, and no route takes it as input;
- **not stable across Worlds and not a key:** no read joins, compares or returns it across Worlds;
- **erased with the participant:** the account-deletion erasure removes it with the person's other World data.

**E1(c) — when an ordinal is shown.** A human author's ordinal is sent to a reader, and shown, **only when that reader's
displayed label for the author is not unique** among the World's participants as that reader sees them — two or more
participants other than the reader whose labels are equal, or a label equal to QANDEEL's word (Arabic or English). Labels
are compared after Unicode NFC normalisation, trimming and case folding; a participant with no visible Name has the label
«شخص ما» / "Someone" (S4-01 `someone`). Otherwise no ordinal leaves the server. The shown form is the label followed by the
ordinal (Copy Gate row E1-02). The reader's own rows never show an ordinal (E1(a)).

**E1(d) — where it applies.** The same attribution, from the same server truth, in every surface that draws Shared
conversation material: the live conversation, the closed World's read, the Introduction World (which reuses the thread),
and a Shared place's source list (which already shows «أنت» / "You" for the reader's own source).

**E1(e) — QANDEEL.** QANDEEL's rows keep their visible «قنديل» / "QANDEEL" label, edge and absence of surface. No human row
can carry QANDEEL's word without an ordinal (E1(c)).

**E1(f) — the Public self marker — WITHDRAWN (R1).** The addendum, item 12: "If the existing Public ID already identifies
each post clearly, do not add anything." Every Public post already shows its author's Public display (CW2-04 §9 – §10), the
reader's own included, so nothing is added and the Public Identity behaviour is preserved as it is. The R0 text follows for
the record only: ~~ In a Public discussion a post the reader wrote (`own`, already on the wire) shows the
approved word «أنت» / "You" (S4-01 `you`, REUSED) as a tag beside the reader's Public display, in the place and form of
the topic-author tag (A-5(b)), visible to the reader only — the post's author display for everyone else is unchanged. It
adds no identifier and no new wire field. The Public Identity model (CW2-04 §9 – §10) is unchanged.~~

**E1(g) — what does not change (R1).** No picture, photo or avatar image is added anywhere; the only mark is E1(h)'s badge,
and no row is attributed by colour alone (the badge carries letters; every Name label and accessible name stays). The model's
per-request numbering (S8A-02 §5.3 rule 4) is unchanged and is not the participant ordinal: the ordinal is never sent to a
model by this amendment. The Manage page's member handles (0140) are unchanged and never shown in a conversation.

**E1(h) — the speaker badge (R1; PO-directed, 2026-11-20).** Every message row of the Personal conversation and of a Shared
conversation (the live thread, the closed World's read, and the Introduction World that reuses its bubbles) carries one
small circular badge (22 pt), merged into the row at the row's own outer edge — inside the reader's slab or a person's
bubble, beside QANDEEL's open words — and level with the row's first line.
- **Letters.** QANDEEL: `QA`, always. The reader: the initials of the reader's own account Name (W1B-01), shown to the reader
  only. Another person: the initials of the Name this reader is already shown for them (S4-02 `authorName`; the
  Introduction World's first name). Initials are the first letter of the first word and, with more words, of the last (an Arabic word's article «ال» passed over: `محمد الفايد` is `م ف`); Latin
  letters are capitals written together (`MA`); Arabic letters are written apart (`م ع`) so they never join. No Name, no
  letters: the badge is the tone alone; a Name is never invented. The Introduction World passes no reader Name (its own rule:
  never an account Name), so the reader's badge there is the tone alone.
- **Tone.** One restrained, low-chroma tone per speaker, the same throughout the conversation, in Dark and Light: QANDEEL's
  and the reader's are their own; another person's is chosen from four others by the visible Name alone, so it carries
  nothing the Name does not, and is never QANDEEL's or the reader's.
- **Nothing new is exposed.** The badge is derived only from what the same reader already sees (or, for the reader, their own
  Name); no identifier, account, member handle or wire field is read or added. It is hidden from assistive technology; every
  accessible name is unchanged.
- **Geometry (addendum items 5 – 6).** Personal: 22 pt above the reader's turn, 12 above QANDEEL's (were 28 / 16); the slab
  8 / 9 pt vertical, 14 inner (were 11 / 12, 18). Shared: 14 above a person's words, 12 above QANDEEL's (were 20 / 16); the
  bubble 8 / 9 vertical, 12 horizontal (were 10 / 11, 16).
- **Not in scope.** Public (E1(f) withdrawn); a Voice Note's own slab (its body is drawn by the Voice Note surface and is
  unchanged); Replay's player and composite.

## 4. Not in force until

E1(h) is implemented on Draft PR #401 by the Product Owner's direct addendum and takes effect only with item 4 (the merge). For the rest:

1. The Product Owner approves this text.
2. The Product Owner approves the Copy Gate rows E1-01 – E1-03 (package §3).
3. The Product Owner accepts the privacy / wire-contract review (package §4).
4. The implementing pull request is merged by the Product Owner («ادمج»).
