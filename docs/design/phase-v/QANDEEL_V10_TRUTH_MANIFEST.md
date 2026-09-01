# V10 — PROTOTYPE TRUTH MANIFEST

**Prototype:** Cross-Screen Coherence Freeze — Reviewer Stress Harness. **NON-CANONICAL.**
**Audited runtime:** canonical main `644bae08fa360fe4b9106ad9b7539500d206ccad` (V5A).
**Audience:** design / review only. In the page a summary opens from the evaluator chrome
("Truth manifest"), and "Mark simulated" outlines simulated elements in place.

Nothing in this prototype fetches anything. Every object on screen is a local fixture.

V10 inherits V9's manifest in full. This document restates the boundaries that changed
and adds the one V10 introduces: **the stress fixtures themselves**.

---

## 0. THE STRESS-FIXTURE BOUNDARY — read this first

Two fixtures in this harness, `d1` (dense) and `p3` (three peers), are **simulated test
density**. They exist to falsify the grammar, not to describe a user.

| | What it is | What it is NOT |
|---|---|---|
| `d1` | Two peer readings, 11 recorded fragments (10 carrying a role), 3 shared records, 3 assumptions and 2 disconfirming conditions per reading, 3 named unknowns, long Arabic in four fragments, a longer session | Not a real session. Not a runtime output. Not evidence that QANDEEL produces this much. Not a claim about typical density |
| `p3` | Three equal peer readings, one of them a near-duplicate of another, one record carrying a role in all three, one record carrying a role in two of the three, one unknown belonging to a single reading | Not a claim that three readings are common. Not a claim about how a third reading would be produced |
| `lc5` (the five-item field state, built on `d1`) | Five active items in the context field, one removed by the reader and one entering through prototype recomposition, with one item raised by the reader | Not a relevance ranking. Not a claim that the runtime selects these five |

**How the boundary is declared, in three independent places:**

1. **In the page.** The evaluator strip shows a persistent line while a stress fixture is
   loaded: *"REVIEWER STRESS FIXTURE — SIMULATED TEST DENSITY. Not runtime-derived user
   data."* Every recorded fragment, peer statement and unknown in a stress fixture also
   carries `data-sim`, so "Mark simulated" outlines all of it in place.
2. **In the route and file names.** `dense-*`, `three-peer-*`, `live-context-five-items-*`.
3. **Here, and in the in-page manifest summary.**

Nothing is stamped onto the screenshots. A caption burned into a rendered state would be
screenshot decoration, which the task forbids; the declaration lives in the names, in
this manifest, and in the page itself.

The **material** in the stress fixtures is the V5B/V6/V9 fixture extended, not replaced:
`m1`–`m6` are byte-identical to V9's. `m7`–`m11` are new and exist only to reach the
mandated density. The subject, the two base readings, the roles, the assumptions, the
disconfirming conditions and the unknown wording all follow V9's shape. A direction is
not allowed to look better by being handed easier content, and a stress fixture is not
allowed to look worse by being handed nonsense.

---

## 1. RUNTIME-BACKED

Supported by the canonical runtime as audited in V5A. Unchanged from V9 except where
marked.

| Represented here | Backed by |
|---|---|
| Conversation as the primary durable surface, with per-turn timestamps | `conversation_sessions` / `conversation_turns`, own-row readable |
| Recorded material as records made from the user's own words, with a **record** date, a category and a status | `memories` (`content`, `type`, `status`, `created_at`); a deterministic, non-model extraction from the user's turn, `source='USER_STATED'` |
| Readings as durable statements held as peers, with no ranking and no winner | `hypotheses.statement`; nothing in the runtime ranks hypotheses; `question_candidates` forbids EIG/utility/ranking by CHECK constraint |
| **More than two readings for one subject** — the case `p3` exercises | Nothing in the runtime caps the number of `hypotheses` rows for a session. V9 assumed two; that assumption was not backed |
| Explicit stored role membership per reading: supporting / contradicting | `hypotheses.supporting_evidence_ids` / `contradicting_evidence_ids` (`memory:<uuid>`, ≤32 per role, disjoint within one reading) |
| One recorded item carrying a role in more than one reading — including support in one and contradiction in another, **and support in both** | Separate stored memberships on different hypothesis rows. Disjointness is enforced only *within* one reading |
| **One recorded item carrying a role in some but not all readings** — the `m8` case in `p3` | The same stored memberships. Nothing requires a shared record to be shared by every reading |
| **Several recorded items each carrying a role in more than one reading** — the three shared records in `d1` | The same stored memberships. Nothing caps how many memories are cited by more than one hypothesis |
| Assumptions and disconfirming conditions attached to a reading | `hypotheses.assumptions` / `disconfirming_conditions` (≤8 each, ≤500 chars). `d1` uses 3 and 2 — inside the stored limit |
| Named unknowns that occupy space while OPEN and can later be RESOLVED or SUPERSEDED | `information_gaps` with the migration-0063 lifecycle (`status`, `closed_at`, `closure_reason`, `open_epoch`) |
| Explicit context activation / deactivation for the four supported kinds | `set_him_session_context_binding_v1` / `clear_…` / `read_…` and the `PUT/DELETE/GET /conversation/sessions/:id/context-bindings` endpoint. The **command** is real; persistence in this page is local |
| A follow-up question arriving inside an ordinary conversational turn | The runtime's formal question is phrased by the provider inside the ordinary assistant turn |
| Thin data — zero readings, one reading, no relation, no unknown — as normal states | Hypotheses are only ever CANDIDATE/ACTIVE; nothing guarantees a second reading exists |

---

## 2. SIMULATED FOR EXPERIENCE TESTING

Needed to exercise the experience architecture, **not** currently backed by a production
product contract. Items 1–14 are V9's, unchanged. Item 0 is V10's.

0. **The stress density itself.** See §0. `d1`, `p3` and the five-item field state are
   reviewer constructions.
1. **Shaped, product-semantic durable-state fetch.** No product read API exists.
2. **Product-shaped client state**, and the **Home surface** itself.
3. **The subject anchor** (`قرار الشغل الجديد`). No durable subject object exists above
   the reading/session level. Marked in-page with `data-sim` on every user-facing
   occurrence.
4. **Live Context relevance selection and ordering — `RESERVED FUTURE CAPABILITY —
   SIMULATED FOR EXPERIENCE/DESIGN TESTING; NOT CURRENTLY RUNTIME-BACKED`.** Production's
   bounded material selection is a **recency** window (at most 64 active memories ordered by
   record time, filtered afterwards), not a relevance computation. Nothing on screen claims
   otherwise, and no item is placed nearer, larger or darker than another at rest — asserted
   live, including at five items. *(Label tightened by `V10-FIX-01`; the classification is
   unchanged.)* A future runtime-backed system may one day position Live Context items
   nearer/farther **solely** to express relatedness to the current conversation — never
   importance, truth, confidence, evidence strength, priority, certainty, correctness or
   rank — and only under the runtime contract described in
   `QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md` (A22, A23, "Runtime / Truth Boundaries").
   **No such support exists at this baseline and none is claimed here.**
5. **Live Context recomposition.** An item entering after an exclusion is prototype logic.
6. **Exclusion from the current field.** Local to this page.
7. **Foreground / recede.** An experience behaviour driven **only by the user's own
   press**. The resting state is flat, and neither this build nor the current production
   baseline brings an item forward on its own. Foreground is the reader's, always
   (`V10-FIX-01`: this is a rule about foreground and about judgement — it is not the
   reserved contextual-relevance capability in item 4, which is a different mechanism, is
   not foreground, and remains unbuilt and unsupported).
8. **Focus recomposition in the scene.** Recomputes nothing, changes nothing stored, and
   the screen says so while it is active.
9. **Progressive formation of the scene** as reader-stepped layered disclosure. No timer.
10. **Cross-screen continuity** — the same recorded sentence recognisable in Conversation
    → Live Context → the scene, and "see its role in the readings". Not production-backed
    navigation.
11. **Applying a correction, or anything downstream of it.** The correction is received
    and stays visible in the conversation; nothing beyond RECEIVED / PENDING exists.
12. **Any answer-linked gap closure.**
13. **Any user-driven reading status change.**
14. **Cross-session persistence of the explicit context activation** as shown here.

---

## 3. FORBIDDEN TO INFER

Deliberately not represented anywhere in this prototype.

- Numeric confidence, confidence band, percentage. *(`confidence_evaluations` has
  `numeric_score IS NULL` and `confidence_band IS NULL` as CHECK constraints.)*
- Relation strength, weight, mass, settledness, "how much". **No plane value, size,
  weight, position, distance or line thickness anywhere encodes a quantity** — one ground
  and one material type size, asserted live in every state including the dense one.
- Evidence count read as strength; any ranking; question utility.
- **Peer order read as rank.** The order of the peer columns and of the pager controls is
  the order the readings are held in, and nothing else. No peer is wider, darker, larger,
  earlier-by-merit or permanently primary — asserted live at three peers.
- **Column or pane length read as strength.** A reading that stands on fewer of its own
  records produces a shorter column. That is a fact about the stored memberships, not an
  encoding, and it is the one dimension the composition cannot equalise without lying.
- Any relation without a stored role membership; causal arrows; decorative connections
  between objects. **No line in this prototype joins two objects.**
- Memory as verbatim quotation; memory → conversation-turn provenance; occurrence counts.
- Record dates presented as life-event dates, or any chronology of what happened when.
- Reading states SUPPORTED / MIXED / WEAK / REJECTED / RETIRED; user rejection or
  retirement of a reading.
- A refusal state for an unknown.
- The stored gap text as the literal question put to the user.
- Guaranteed distinct peer readings — `s5` and `p3` both render near-duplicates correctly.
- **Guaranteed two peer readings.** `p3` exists because V9 assumed two and the runtime
  does not.
- Any structural consequence of a correction: no item replaced or deleted, no role moved,
  no reading rewritten, no unknown closed, no scene recomposed. **No animation is attached
  to the correction path**, so motion cannot imply a consequence that does not exist.

---

## 4. What the marks are allowed to mean

Structure is carried by the **kind** of margin, never by its value. There is one ground.
No line joins two objects, so there is no thickness, dash or arrow to misread.

| Mark | Means exactly | Never means |
|---|---|---|
| **One rule** | this block is something QANDEEL holds, standing in one reading | anything ranked, scored or weighted |
| **Two rules** | the same recorded thing stands in **more than one** reading; each reading it stands in is named beneath it, with the role it carries there | closeness, strength, importance, or a relation weight. Two hairlines are a *kind of membership*, not an amount |
| **Broken rule** | a named unknown: QANDEEL has named it and it is not filled in. The rule closes when the status does | an error, a refusal, a scored gap, or a level below "established" |
| **Brackets + outdent + full ink** | one item the **reader** brought forward | a system judgement of importance. Never opacity alone, never a background change, never a size change |
| **The shared region** | these records belong to more than one reading, which is why each is rendered once. On the grid each role line drops into its own reading's column track; on the paged stage the role lines name their readings in words | a centre, a verdict, or a conclusion. It is in reading order — own, then shared, then what is missing — and it recedes like anything else when the reader raises something else |
| **The anchor** | the subject organising this scene | anything ranked or scored. It is a simulated object |

**One change from V9 worth naming.** V9 printed a heading above every shared record
stating how many readings it entered. With three shared records that sentence appeared
three times, and with three peers it said "two of these" and left the reader to work out
which two. The heading is now stated once for the region, and the membership is carried
by the role lines beneath each record, which name each reading explicitly. Nothing was
removed from what the screen says; a restatement was removed, and the "some but not all"
case became *more* explicit, not less.

### What presence does not mean

Nothing is placed nearer, larger or darker because QANDEEL thinks it matters more. The
resting state is flat. The only thing that brings an item forward is the user pressing
«هاتها قدّام», and the only thing that removes one from the active set is the user
pressing «شيلها من الشغّال».

*`V10-FIX-01`:* «matters more» is the point of that sentence, and it holds permanently.
Distance may never be read as importance, truth, confidence, evidence strength, priority,
certainty, correctness or rank. It is not a permanent ban on distance ever carrying
*relatedness to the current conversation* inside Live Context — that is the reserved,
runtime-gated capability in §2.4, which nothing in this prototype implements or simulates.

The one ordinal-looking treatment in the build is the ink step used while something is
raised. It encodes *what you are currently looking at versus what you are not* — a
temporary, reversible, user-created view state — and never a property of the objects.
Both halves are asserted live, at density as well as at two peers: raising an ordinary
fragment recedes the shared material too, and any shared record can itself be raised.

---

## 5. Three honesty details worth naming

- **Counts are morphology, never figures** («قراءتين», not «٢»). At more than two readings
  the surface says «كل القراءات دي معروضة هنا بالتساوي» — still no figure, and still no
  ranking vocabulary. Digits appear only in record dates and times, in Arabic-Indic
  numerals — a temporary locale choice, not a frozen policy.
- **Provenance wording** is «مسجّل من كلامك · ⟨التاريخ⟩», and it is the disclosure control
  itself. The expanded accounting says in plain words that the date is when QANDEEL
  recorded the thing, not when it happened, and that it is not a literal transcription.
- **There are no truthful disclaimers to strip.** The surface carries no confidence, rank,
  strength or weight vocabulary at all — not even in denial — and the self-check scans the
  raw text with nothing removed, in every state including the dense and three-peer ones.
