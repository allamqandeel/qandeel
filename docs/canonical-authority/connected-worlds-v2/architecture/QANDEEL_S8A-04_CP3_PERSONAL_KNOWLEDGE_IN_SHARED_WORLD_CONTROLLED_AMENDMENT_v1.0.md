# QANDEEL — S8A-04 CP3 — Personal Knowledge in Shared World — Controlled Amendment v1.0

**Status:** `PROPOSED — FOR THE PRODUCT OWNER'S DESIGN REVIEW (2026-10-25) — NOT APPROVED — NOT IMPLEMENTED — COPY GATE
PROPOSED (0 of 6 approved)`. No code, migration or paid call exists for it; CP3-A does not start before approval.

**Delivers:** `SHARED-CTX-01` / `QAN-BL-CW-02` (the private-context portion of `G-08`).
**Binds over (when approved):** CW2-02 §16–§22, §32; CW2-03 §23, §39, §40; I-03E, I-03F and I-03G, only as stated in §2 – §3;
0078 / 0083 stay byte-identical. **Decisions applied:** the Product Owner's review of 2026-10-25 (D1–D7) and the final
review of the same day (D1–D5, below as PO-1 … PO-5).

## 1. The Product Owner's final decisions
- **PO-1** One clear consent action by the knowledge's owner may create two separate, bounded authorities — reasoning and
  disclosure. Neither ever grants the other. The consent is bound to the current membership episode; leave ends its use;
  rejoining needs a fresh consent.
- **PO-2** One consent tier in v1: QANDEEL may use the item and mention it to the approved audience, and the owner is
  told explicitly that it may be said in front of the World's members. "Reasoning only, never mention" is deferred (no
  cost, no implementation). Non-disclosure beyond the consent is proven **on the final reply before delivery**, not by
  the inputs alone; the existing gate and readiness stay fail-closed; no word matching, no model self-trust.
- **PO-3** DeepSeek Flash may judge relevance, but not by default on every reply: the existing retrieval index first,
  Flash only where it cannot decide. The request is private to the owner, invisible to others, never delays the reply,
  never repeats, and the item is never used before consent. The advance grant from the Personal World is deferred.
- **PO-4** Eligible: the owner's ACTIVE, current memory items about themselves, stated or confirmed by them, including
  preferences saved as memories. Excluded: items about other people, derived inferences the owner did not confirm, and
  `INTERACTION_PREFERENCE` (the 0153 system and memories of that type). Correction, forgetting and the source's current
  state are respected.
- **PO-5** A mention is natural attribution only ("منى بتفضل القطر"): never "she allowed me", never the private
  conversation, the Personal source or when it was said.

## 2. Point 1 — the two authorities inside the existing path, and the check of the final reply

**The two authorities.** One consent event (0176) writes two rows of two families:
- a **reasoning grant**: a Standing Context Grant narrowed to one memory item (grantor, exact World, membership episode,
  audience ceiling, purpose = QANDEEL reasoning). It enters the frozen I-03E envelope exactly as today: an
  `AUTHORIZED_PRIVATE_REASONING_CONTEXT` item whose constraints are the unchanged I-03A ALLOW constant
  (`directPrivateDisclosureAuthority = NOT_GRANTED`, provenance `SEALED`). The reasoning grant grants no disclosure;
- a **disclosure grant** (CW2-02 §19, the separate bounded authority): the same item, World, episode and ceiling;
  scope = mention the item's content, attributed to its owner. It never covers a quote, provenance, another item or
  another person. It requires its reasoning grant (a mention needs use), never the reverse. It is evaluated by its own
  evaluator into a **separate Disclosure Authorization** object bound to the EffectiveContext's `effectiveContextRef`
  and audience snapshot. The frozen EffectiveContext's exact key set is unchanged: the authorization travels beside it.

**The check of the final reply (the delivery sequence, CW2-02 §22).**
1. **Source Disclosure Gate — the exact final output.** When at least one private item was admitted, the server-owned
   detector judges the exact output bytes against the exact protected sources (the frozen I-03G request, binding and
   one-call-per-operation rule are kept). The detector is a **separate DeepSeek Flash judge call** (§4), never the
   generator, never a client or provider claim, never word matching. Its v2 assessment reports, **per protected
   source**, which of the four frozen categories occurred, and for an attribution whether it names the item's owner.
2. **The gate maps findings against authority, fail-closed:**
   - `DIRECT_PROTECTED_SOURCE_FACT` and `SOURCE_SPECIFIC_ATTRIBUTION` to the owner are acceptable **only** for a source
     the Disclosure Authorization covers for this exact audience;
   - `PRIVATE_QUOTE`, `SEALED_PROVENANCE_DISCLOSURE` (incl. "she allowed me", "she told me privately", when / where it
     was said) and an attribution to anyone but the owner are **never** acceptable;
   - any finding on a source without disclosure authority → `BLOCKED` (today's rule, unchanged);
   - a failing, timing-out, malformed, unbound or v1-shaped detector answer → `UNRESOLVED` (today's rule);
   - a clearance through authorized disclosure has its own basis `SERVER_DETECTOR_AUTHORIZED_DISCLOSURE` and names the
     covered source set; the existing bases (`NO_PROTECTED_PRIVATE_CONTEXT`, `SERVER_DETECTOR_CLEAR`) are unchanged.
3. **Authority revalidation (I-03F, byte-identical)** — reasoning grants, audience and source state (digest only).
4. **Disclosure revalidation (new step, only after the authorized-disclosure basis):** every covered source's disclosure
   grant still ACTIVE, same episode, ceiling ⊇ current audience; else `STALE`.
5. **Readiness** returns READY only when steps 1–4 name the same operation (the existing binding rule). Its
   `sourceDisclosureStatus` gains `AUTHORIZED_DISCLOSURE_ONLY`; System / Safety and delivery stay `NOT_EVALUATED` /
   `NOT_GRANTED_BY_THIS_BOUNDARY`.
6. **Commit:** a new `commit_shared_world_qandeel_material_v2` wrapper re-reads every used consent row under `FOR SHARE`
   in the commit transaction (revoke takes `FOR UPDATE`), then calls the unchanged v1 commit. The CW2-02 §22 race
   (revoked between revalidation and commit) is therefore refused. It records exactly one `REASONING_DEPENDENCY` per
   used item; the binder refuses edges that are not exactly the admitted items.

**What does not weaken.** Zero private items → no detector call, the gate is byte-for-byte today's. An item without a
disclosure grant → today's rule (any finding blocks). The I-03A constant, I-03E key set, I-03F file and the old
readiness positions are unchanged; every new outcome is narrower or equal. A blocked or unresolved reply is **withheld**:
no commit, no partial write, no regeneration, no retry in v1; the human's message stays committed (the existing refusal).

**The honest limit.** No method proves semantic non-disclosure with certainty. The design narrows the surface (the
generator never receives provenance: no session, date, "private" label or conversation text — only the item wording
and the owner's member token), then checks the final reply with an independent judge that can only block, then
measures that judge on a preregistered adversarial set (CP3-D) before acceptance.

## 3. Point 2 — relevance and the private request, cheapest first, no use before consent
- **When:** only for the **sender** of a message QANDEEL replies to (one owner per evaluation, so two members' private
  items never meet), and only if the sender has an eligible item that is not consented, declined or pending in this
  World, and no request is already open for them in this World.
- **Stage 1 — free:** the existing semantic index (0171 `retrieve_personal_memory_candidates_v1`), called **under the
  sender's own token and RLS**, with terms from the sender's **own** message (`memoryRetrievalTerms`). Eligibility is
  re-filtered (PO-4). No candidate → stop: no call, no request.
- **Stage 2 — Flash only when stage 1 found candidates:** one call with the sender's own message and those candidates
  (opaque refs, the owner's own wording), answering at most one ref that would genuinely help; the server validates it
  is one of those candidates. Family `SHARED_PRIVATE_RELEVANCE`, paid by the sender, tied to the message and World,
  attempt 1, no retry. Bounded by config: at most one stage-2 call per (member, World) per window (proposed 1 hour); an
  item judged not relevant is not re-judged in that window.
- **Why this is not use:** both stages run as the owner's private operation, on the owner's own data and own words. No
  other member's message, no Shared history, no QANDEEL reply and no Shared provider envelope is an input; the result is
  written only to an owner-only request row (0176) that no Shared path, collector or prompt reads. The reply of that
  turn is generated independently and its EffectiveContext admits only ACTIVE consents — none yet — so the request runs
  after (or beside) the reply and never holds it.
- **After consent:** the item is admitted from QANDEEL's next reply in that World on, under §2.
- **Never repeated:** "لا" is a final decline for that item in that World; an unanswered request stays the one open
  request; consented or declined items are never offered again in that World (until a fresh episode after rejoining).

## 4. Cost
- Relevance (stage 2): ≈ USD 0.0002–0.0004 at peak per call (from round 20's per-call spend), only when stage 1 finds a
  candidate, at most once per member, World and window. Not per message.
- Disclosure judge: one call per reply **that admitted a private item** (≈ USD 0.0002–0.0004 at peak). Replies without a
  private item cost nothing extra. The collector admits a consented item only when it matches the current turn's terms
  (the same index, through a 0176 service-role read limited to items already consented in this World — use within the
  consent, no other item read), so the judge does not run on every reply in a World where someone consented.
- Paid evaluation (CP3-D): a budget request will follow the free suite; nothing is spent before approval.

## 5. Copy Gate (6 texts, PROPOSED — not approved)
| # | Text | Arabic (PROPOSED) | English (PROPOSED) |
|---|---|---|---|
| CG-1 | The private request | «معلومة قد تفيد في «{world}»: «{item}». إذا سمحت، يمكن لقنديل أن يستخدمها في ردوده هنا، وقد يذكرها منسوبة إليك أمام أعضاء العالم الحاليين: {members}. لن يذكر قنديل كيف عرفها ولا أي حديث خاص بينكما. هذا الطلب لا يراه أحد غيرك، والإذن ينتهي إذا غادرت العالم أو صححت المعلومة أو طلبت نسيانها، ويمكنك سحبه في أي وقت.» | "Something that may help in "{world}": "{item}". If you allow it, QANDEEL can use it in its replies here and may mention it as yours in front of the World's current members: {members}. QANDEEL will not say how it knows it or refer to anything private between you. No one else sees this request. The permission ends if you leave the World, correct the item or ask QANDEEL to forget it, and you can withdraw it at any time." |
| CG-2 | The actions and their results | «اسمح بذكرها هنا» / «لا» — بعد السماح: «تم. يمكن لقنديل استخدام هذه المعلومة وذكرها في «{world}».» — بعد الرفض: «لن يسألك قنديل عن هذه المعلومة مرة أخرى في هذا العالم.» | "Allow it here" / "No" — after allowing: "Done. QANDEEL can use and mention this in "{world}"." — after declining: "QANDEEL won't ask about this again in this World." |
| CG-3 | Reconfirmation when the audience grows | «انضم إلى «{world}» أعضاء جدد: {members}. سمحت بذكر «{item}» أمام الأعضاء السابقين فقط. هل تسمح بذكرها أمام الجميع الآن؟ إلى أن توافق، لن يستخدمها قنديل في هذا العالم.» — «اسمح للجميع» / «أوقف استخدامها» | "New members joined "{world}": {members}. You allowed "{item}" to be mentioned only in front of the earlier members. Allow it in front of everyone now? Until you do, QANDEEL won't use it in this World." — "Allow for everyone" / "Stop using it" |
| CG-4 | Withdrawal | قائمة: «ما سمحت لقنديل بذكره في «{world}»» — «سحب الإذن» — تأكيد: «سحب الإذن؟ لن يستخدم قنديل هذه المعلومة أو يذكرها في «{world}» بعد الآن. ما ظهر من قبل يبقى كما هو.» — «اسحب» / «إلغاء» | List: "What you allowed QANDEEL to mention in "{world}"" — "Withdraw" — confirmation: "Withdraw permission? QANDEEL will no longer use or mention this in "{world}". What was already said stays as it is." — "Withdraw" / "Cancel" |
| CG-5 | The ended state | «انتهى هذا الإذن لأنك {غادرت العالم \| صححت المعلومة \| طلبت نسيانها \| أوقفت الاعتماد عليها \| انتهت صلاحيتها}.» | "This permission ended because you {left the World \| corrected the item \| asked QANDEEL to forget it \| turned it off \| it expired}." |
| CG-6 | The model-facing instruction (verbatim as it will run) | — | "MEMBER KNOWLEDGE. Each item below belongs to the member named by its token, who allowed QANDEEL to use and mention it in this World. Use an item only when it genuinely helps this turn. You may mention it naturally as that member's own, in your own words. Never say or imply that the member told you privately, gave you permission, or that you hold a private conversation, memory or record about them; never say when or where you learned it; never quote them; never add details the item does not state; never apply an item to anyone but its owner. If no item helps, ignore them all." |

## 6. Privacy tests (free; real PostgreSQL 17 and the CP2-binding harness; injected faults)
**The final-reply check fails:**
- the judge times out, throws, returns malformed JSON, an unknown category, a v1-shaped answer or a binding of another
  output → `UNRESOLVED` → reply withheld; no commit, no dependency, no partial write; the judge call has one ledger row
  (attempt 1, no retry); no regeneration; the human message stays committed;
- the judge reports `SEALED_PROVENANCE_DISCLOSURE` or `PRIVATE_QUOTE` on a covered item, an attribution to a
  non-owner, or any finding on an uncovered item → `BLOCKED` → withheld, same guarantees;
- zero admitted items → no judge call (the cost of an ordinary reply is unchanged).

**The consent changes during generation** (each injected at one boundary):
- revoked after the envelope was built, before the gate → disclosure revalidation `STALE` → withheld;
- revoked after readiness, before commit → the v2 commit refuses under lock → withheld, nothing written;
- revoked after commit → the reply stands (CW2-02 §32), the next reply no longer admits the item;
- a new member joins mid-generation → audience revalidation `STALE`; the item is excluded until CG-3 is answered;
- the owner leaves mid-generation → episode closed → `STALE`; rejoining does not revive the consent;
- the item is corrected, forgotten, disabled or expires mid-generation → source-state `STALE` → withheld.

**Isolation:** the provider envelope (captured at the guard) holds exactly the consented, relevant items of present
owners — never a non-consented item, another member's item, conversation text or provenance; a non-consenting member's
item never appears; the map, readings, placer, recall and Activity receive no item text or ref.
**JIT:** stages 1–2 run only for the sender, under their token; other members' views, the Shared material and the reply
envelope are byte-identical with and without a pending request; no request after "لا"; one open request at most; no
stage-2 call when stage 1 is empty; the window bound holds.
**Provenance:** one `REASONING_DEPENDENCY` per used item; the binder refuses a mismatch; owner deletion does not rewrite
the delivered reply.

## 7. Phases (after approval only)
CP3-A this amendment approved + 0176 (consent pair, events, request store, resolvers, v2 commit wrapper) and its
real-PostgreSQL verifier. CP3-B collector, relevance stages, disclosure evaluator / revalidator, gate v2 mapping, the
judge adapter, reply plumbing; the free suite of §6. CP3-C routes and the mobile prompt after the Copy Gate closes;
device check. CP3-D a paid stage (budget request first): judge quality on a preregistered adversarial set, relevance
quality, mention naturalness; then the S8A-04 BG-08 / BG-09 closure and the one PR.
