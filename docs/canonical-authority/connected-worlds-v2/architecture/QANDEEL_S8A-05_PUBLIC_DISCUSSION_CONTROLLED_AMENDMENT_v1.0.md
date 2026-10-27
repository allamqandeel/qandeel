# QANDEEL — Connected Worlds v2
## S8A-05 CP4 — Public Discussion Threads & the @qandeel Context — Narrow Controlled Amendment A-5 v1.0

**Status:** `S8A-05 CLOSED / READY FOR PO MERGE DECISION (2026-10-27) — CONTROLLED AMENDMENT A-5, EFFECTIVE ON THE MERGE OF
THE S8A-05 CP4 PULL REQUEST — CP4 PRODUCT COPY GATE CLOSED / APPROVED (2 ROWS, PRODUCT OWNER, 2026-10-27; RECORD §13.7) — TIER Q PREPARED, NOT RUN (NO BUDGET
APPROVAL) — EDITING A PUBLISHED TOPIC DEFERRED TO QAN-BL-PUB-REV-01 (PRE-LAUNCH BLOCKER), NOT IMPLEMENTED`. It binds from the
merge of the S8A-05 CP4 pull request, after the Product Owner approves that pull request. Until then nothing below is in
force.  
**Scope:** the shape of a Public discussion thread (the exact post a reply answers; the topic's author marked as such) and
the context a Public `@qandeel` answer is given (one thread's branch, the topic as one bounded text, speaker roles, earlier
answers attached to the posts they answered); the cost family and provider composition of that answer; the Public DEEP
budget. Editing a published topic, successor versions and the discussion across versions are outside it (§5); so are
Stage 9, CW2-08, the entitlement, production publishing, Personal / Shared / Matching data, Replay and Voice  
**Amends, narrowly and only in that scope:** the S5-04 decision D2 (thread shape) and the S5-04 Public model-context contract
(record §7 – §8; migration 0147's context read), each quoted in §3; the S8A-01 Public DEEP request budget (`QAN-BL-AI-04`, for
Public only)  
**Authority:** the Product Owner, *S8A-05 CP4 order* (2026-10-27), which applies the WP1 design with its binding WP1-R1
corrections; the Product Owner's CP4 scope decision of the same day (§5); the Public World Product Definition §28 rule 5
("later decisions govern")  
**Task:** `S8A-05` — CP4, its last checkpoint. It is not a new task and not a Connected Worlds phase  
**Implementation:** S8A-05 CP4, on branch `s8a/s8a-05-cp4` from `main` at `c9715702` (the merge of PR #362, after PR #361
merged S8A-05 CP3 as `4ff74a80`); migration `0182`; record: [S8A-05 implementation record §13](../../../e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md#13-s8a-05-cp4--public-discussion-threads--the-qandeel-context)

This record is additive. CW2-04, the S5-04 record and the A-1 – A-4 amendments stay byte-identical; each passage narrowed
here is quoted and binds as narrowed only after this record becomes effective.

---

# 1. Why an amendment is needed

S5-04 stored every reply under its thread's first post (D2: one visible depth), so a reply to a reply lost the post it
answered. Its `@qandeel` context was the whole discussion, newest first, with no word of who wrote what: the model could not
tell the topic's author from a participant, the person asking from someone they quoted, or its own earlier reading from the
author's correction. In a public discussion of a personal topic that is exactly where a wrong answer hurts. The topic itself
reached the model as separate content rows and not as the bounded text the author published (CP2's 6 KB input).

---

# 2. The Product Owner's decisions applied (S8A-05 CP4 order and scope decision, 2026-10-27)

1. Reuse the S5-04 discussion system: no parallel engine, no new personality, no synthetic reply in production.
2. `@qandeel` gives at most one reply per invocation, through the existing lease, Safety Gate and AI-COST; the cost is the
   invoker's; DeepSeek Flash only; `SYNTHETIC_ONLY` kept; no private identifier and no Personal / Shared / Matching data.
3. The context distinguishes the topic's author (OP), the asker, the other participants and QANDEEL's earlier answers; the
   author's correction wins over an earlier QANDEEL reading; the topic enters as its bounded 6 KB text; a context change is
   a controlled contract, not a chain of guards.
4. Editing a published topic and the discussion across versions are NOT in CP4 (§5).

---

# 3. The passages narrowed

## 3.1 The passages (unchanged in their own files; D2 quoted, the others summarised)
- S5-04 record §3, D2: *"one visible depth (top-level posts with replies beneath), canonical ordinal order, no ranking, no
  nested tree; a reply to a reply joins the same thread root; 0096 storage unchanged."*
- S5-04 record §7 – §8 and migration 0147: the Public model context is the Experience's public content, the discussion's
  posts and QANDEEL's earlier public responses (bounded), and the minimum relation fact of related Experiences.
- S8A-01 / ACE-SP-01: the Public request sets `latencyBudgetMs` DEEP 10 000 and FAST 3 000.

## 3.2 The text of A-5 (binds once effective)

**A-5(a) — the exact reply target.** A reply keeps the exact post it answers. D2 stands: the thread shows one visible depth,
in canonical order, and 0096 still stores the thread's first post as the parent. The exact target is kept beside it, once,
immutably (`public_thread_private.reply_targets`), and every read that names a reply's target — the viewer read, `@qandeel`'s
context, the "reply to your post" activity — uses the exact target, falling back to the thread's first post for a reply made
before 0182. A reply that answers another reply (not the thread's first post) shows one line naming whom it answers, which
moves to that post when pressed. Nothing is ranked or nested deeper.

**A-5(b) — the topic's author.** A post written by the topic's author carries a text tag beside the author's Public display
(Copy Gate, record §13.7). It is a boolean the server derives from the Experience's creating Public Identity — never a name
comparison and never an identifier on the wire — and it is shown in words, never by colour alone.

**A-5(c) — the `@qandeel` context.** Replacing S5-04's whole-discussion context, under the same live 0147 lease and from
public-visible truth only, the server reads (`read_public_qandeel_context_v2`):
- the topic as ONE bounded labelled text of at most 6 KB: CP2's bounded QANDEEL input of its manifest (`AUTHOR` /
  `AUTHOR_TEXT` lines for the author's words, `QANDEEL` / `QANDEEL_UNDERSTANDING` lines for QANDEEL's words the author chose
  to publish), or, for a topic without that manifest, its title and items in the same labels; then its reviewed meaning and
  themes;
- the invoking post's BRANCH only: its chain of exact reply targets up to the thread's first post, the first post, and at
  most 8 more posts of the same thread before it — never another thread, never a related topic;
- each post's speaker role — `OP` (the topic's author; it wins when the author is also the asker), `ASKER` (the invoking
  post's author) or `PARTICIPANT` — and the post it answers;
- each served earlier QANDEEL answer, attached to the post it answered (the invoking post's own answer excluded).

No author, display, account or identifier but post / response ids reaches the server code, and none reaches the model. The
one Public assembler numbers the posts in the message only and gives the model these words (verbatim; fingerprinted in the
Tier Q preregistration):

> The published topic. Lines marked AUTHOR or AUTHOR_TEXT are its author's own words; lines marked QANDEEL or
> QANDEEL_UNDERSTANDING are your own words the author chose to publish.

> This thread of the public discussion, oldest first. [OP] is the topic's author. [Asker] is the person asking you now.
> [Participant] is anyone else; two posts marked [Participant] may or may not be the same person.
> [QANDEEL] is one of your own earlier public replies here: a reading, not a fact, and not the author's view. What the
> author says in the topic and in [OP] posts decides what the author means.

Each post is one line `#n [OP|Asker|Participant] replying to #m: …` (or "replying to an earlier post not shown"), the asking
post marked "— asking you now", each earlier answer `   [QANDEEL] answering #n: …` under its post. The branch is bounded by
the existing history budget (16 KB), keeping the invoking post, then its chain nearest first, then the newest other posts.
The S5-04 frame, the personality core, the Text v1 guidance, `locale: 'und'` and the composition are unchanged.

**A-5(d) — cost, provider and budget.** A Public QANDEEL answer is booked under its own AI-COST family
`PUBLIC_QANDEEL_REPLY` (it was `CONVERSATION_REPLY`), paid by the human whose post invoked it, one record per attempt. The
Public World module composes its own Model Router port: DeepSeek Flash through the shared router and the one accounted
transport (`DeepSeekModelRouter.forPublicQandeel`), the `SYNTHETIC_ONLY` boundary unchanged, the Model Router's own
deterministic seam under `NODE_ENV=test`. The Public DEEP request budget is 25 s, set from the S8A-02 CP3 measurement of the
same model (thinking, `max_tokens` 2 800 ≈ 19.3 s); FAST stays 3 s; Shared stays 10 s (`QAN-BL-AI-04` keeps Shared).

---

# 4. Quality acceptance (preregistered; prepared, NOT run)

The free proofs (verifier 0182, the API and mobile specs; record §13.5) show the server's branch, roles, bounds and the exact
text the model receives — not the model's reading of it. That reading is accepted only by the preregistered Tier Q
evaluation (`scripts/s8a-05/cp4/PREREGISTRATION.md`): 30 independently written synthetic threads, reviewed blind before
freezing; 30 DeepSeek Flash calls in one run; two independent blind raters; proposed ceiling 30 attempts and USD 0.05. It is
**PREPARED — NOT RUN**: guard round 26 is locked and no paid call is made without the Product Owner's separate budget
approval. Until it runs and is ACCEPTED, A-5(c) is proven as a contract, not as model quality.

---

# 5. Deferred by the Product Owner's decision — editing a published topic (NOT implemented)

The CP4 census found WP1-R1 §3.3's "additive only" premise wrong: every step of a successor version of a PUBLISHED
Experience is locked in the frozen I-05 publication core (preparation is DRAFT-only in 0119 / 0179 / 0180; the reviewed
interpretation and placement are pinned to the current version in 0144 / 0145; `publication_state` is keyed by the Experience
and immutable in 0095; eligibility needs the pointer to be the published version in 0098; removal semantics in 0099 / 0121;
verifiers 0095 / 0098 / 0099 / 0107 / 0119 / 0121 pin those bodies). The Product Owner chose (2026-10-27) a separate task:
**editing a published topic and the discussion's continuity across versions are deferred, in full, to `QAN-BL-PUB-REV-01`
(owner `PUB-REV-01`), a `PRE-LAUNCH BLOCKER` that must be implemented and tested before Stage 9 opens production
publishing.** It keeps every approved WP1-R1 requirement (V-1 – V-14), including the version history, an unchanged place
while the dominant meaning is unchanged (A-4(e)) and the integrity of the discussion's binding to versions. CP4 implements
none of it and opens no path toward it: 0182 asserts that still exactly five functions move a Public Experience's lifecycle.

---

# 6. Not changed

No frozen function is replaced; 0096 / 0097 / 0147's functions are untouched (the 0147 activity source is forward-replaced
under its own name, its other events identical); both CW2-08 seams still answer `NOT_EVALUATED`; the entitlement, the lease,
the one-reply rule and the Safety Gate are unchanged; Shared replies, Personal replies, QANDEEL COMPANY and LIVE are
unchanged; no real person's text reaches DeepSeek.
