# V9 — PROTOTYPE TRUTH MANIFEST

**Prototype:** Key-Screen Rebuild — Spatial Intelligence Core v1. **NON-CANONICAL.**
**Audited runtime:** canonical main `644bae08fa360fe4b9106ad9b7539500d206ccad` (V5A).
**Audience:** design / review only. This manifest is deliberately kept out of the
ordinary user-facing experience; in the prototype a summary opens from the evaluator
chrome ("Truth manifest"), and "Mark simulated" outlines simulated elements in place.

Nothing in this prototype fetches anything. Every object on screen is a local fixture,
and it is **the same fixture V5B and V6 used** — same subject, same two peer readings,
same shared dual-role record, same roles, same assumptions, same disconfirming
conditions, same unknowns, same record-date semantics, same long Arabic stress content.
A direction is not allowed to look better by being handed easier content.

---

## RUNTIME-BACKED

Supported by the canonical runtime as audited in V5A.

| Represented here | Backed by |
|---|---|
| Conversation as the primary durable surface, with per-turn timestamps | `conversation_sessions` / `conversation_turns`, own-row readable |
| Recorded material as records made from the user's own words, with a **record** date, a category and a status | `memories` (`content`, `type`, `status`, `created_at`); a deterministic, non-model extraction from the user's turn, `source='USER_STATED'` |
| Readings as durable statements held as peers, with no ranking and no winner | `hypotheses.statement`; nothing in the runtime ranks hypotheses; `question_candidates` forbids EIG/utility/ranking by CHECK constraint |
| Explicit stored role membership per reading: supporting / contradicting | `hypotheses.supporting_evidence_ids` / `contradicting_evidence_ids` (`memory:<uuid>`, ≤32 per role, disjoint within one reading) |
| One recorded item carrying a role in more than one reading — including support in one and contradiction in another, **and support in both** | Separate stored memberships on different hypothesis rows. Disjointness is enforced only *within* one reading, so same-role sharing across peers is not merely possible, it is the case real data will be dominated by |
| Assumptions and disconfirming conditions attached to a reading | `hypotheses.assumptions` / `disconfirming_conditions` (≤8 each, ≤500 chars) |
| Named unknowns that occupy space while OPEN and can later be RESOLVED or SUPERSEDED | `information_gaps` with the migration-0063 lifecycle (`status`, `closed_at`, `closure_reason`, `open_epoch`) |
| Explicit context activation / deactivation for the four supported kinds | `set_him_session_context_binding_v1` / `clear_…` / `read_…` and the `PUT/DELETE/GET /conversation/sessions/:id/context-bindings` endpoint. The **command** is real; persistence in this page is local. |
| A follow-up question arriving inside an ordinary conversational turn | The runtime's formal question is phrased by the provider inside the ordinary assistant turn; there is no separate question object on screen |
| Thin data — zero readings, one reading, no relation, no unknown — as normal states | Hypotheses are only ever CANDIDATE/ACTIVE; nothing guarantees a second reading exists |

---

## SIMULATED FOR EXPERIENCE TESTING

Needed to exercise the frozen experience architecture, **not** currently backed by a
production product contract.

1. **Shaped, product-semantic durable-state fetch.** No product read API exists.
   Row-level `SELECT` plumbing exists, but nothing shapes, filters, joins or orders
   state for presentation.
2. **Product-shaped client state**, and the **Home surface** itself. No home surface
   exists in production; it is here only to prove the grammar survives ordinary product
   use and to test cross-screen continuity.
3. **The subject anchor** (`قرار الشغل الجديد`). No durable subject object exists above
   the reading/session level. Marked in-page with `data-sim` on every user-facing
   occurrence, including the app-bar subtitle and the Home title.
4. **Live Context relevance selection and ordering.** Which items appear in the field,
   and in what order, is prototype logic. Production's bounded material selection is a
   **recency** window (at most 64 active memories ordered by record time, filtered
   afterwards), not a relevance computation. Nothing on screen claims otherwise, and no
   item is placed nearer, larger or darker than another at rest.
5. **Live Context recomposition.** An item entering after an exclusion is prototype
   logic only.
6. **Exclusion from the current field.** Local to this page. No durable per-session
   exclusion of a memory exists.
7. **Foreground / recede.** An experience behaviour driven **only by the user's own
   press**. It is deliberately *not* a system relevance gradient: the resting state is
   flat, and QANDEEL never brings one item forward on its own. See "What the marks are
   allowed to mean".
8. **Focus recomposition in the scene.** Bringing an item forward reorganises what the
   reader is looking at. It recomputes nothing and changes nothing stored, and the
   screen says so while it is active.
9. **Progressive formation of the scene** as reader-stepped layered disclosure. The
   runtime does not stream a scene. Stepped by the reader, never by a timer, so it
   reads identically with motion disabled.
10. **Cross-screen continuity** — the same recorded sentence recognisable in
    Conversation → Live Context → the scene, and "see its role in the readings". Not
    production-backed navigation.
11. **Applying a correction, or anything downstream of it.** The correction is received
    and stays visible in the conversation; what has no runtime path is applying it.
    Nothing beyond RECEIVED / PENDING is implemented.
12. **Any answer-linked gap closure.** Closure is background-driven and
    hypothesis-scoped; no durable answer→resolution link exists.
13. **Any user-driven reading status change.** Not a product capability.
14. **Cross-session persistence of the explicit context activation** as shown here.

---

## FORBIDDEN TO INFER

Deliberately not represented anywhere in this prototype.

- Numeric confidence, confidence band, percentage. *(`confidence_evaluations` has
  `numeric_score IS NULL` and `confidence_band IS NULL` as CHECK constraints — the
  quantity does not exist to render.)*
- Relation strength, weight, mass, settledness, "how much". **No plane value, size,
  weight, position, distance or line thickness anywhere encodes a quantity** — there is
  one ground and one material type size, asserted live.
- Evidence count read as strength; any ranking; question utility; "the most important
  question".
- Any relation without a stored role membership; causal arrows; decorative connections
  between objects. **No line in this prototype joins two objects**; every rule is the
  margin of the block it belongs to.
- Memory as verbatim quotation; «قلتها في محادثة يوم …»; memory → conversation-turn
  provenance; occurrence counts.
- Record dates presented as life-event dates, or any chronology of what happened when.
- Reading states SUPPORTED / MIXED / WEAK / REJECTED / RETIRED; user rejection or
  retirement of a reading.
- A refusal state for an unknown.
- The stored gap text (`information_needed` / `why_it_matters`) as the literal question
  put to the user.
- Guaranteed distinct peer readings — S5 shows near-duplicate peers rendering correctly.
- Any structural consequence of a correction: no item replaced or deleted, no role
  moved, no reading rewritten, no unknown closed, no scene recomposed, nothing
  re-ranked or re-settled. **No animation is attached to the correction path either**,
  so motion cannot imply a consequence that does not exist.

---

## What the marks are allowed to mean

Structure here is carried by the **kind** of margin, never by its value. There is one
ground. There is no relationship line anywhere, so there is no thickness, dash or arrow
to misread.

| Mark | Means exactly | Never means |
|---|---|---|
| **One rule** | this block is something QANDEEL holds, standing in one reading | anything ranked, scored or weighted |
| **Two rules** | the same recorded thing stands in **both** readings; each reading's role is stated beneath it, in that reading's own column | closeness, strength, importance, or a relation weight. Two hairlines are a *count of memberships*, not an amount of anything |
| **Broken rule** | a named unknown: QANDEEL has named it and it is not filled in. The rule closes when the status does | an error, a refusal, a scored gap, or a level below "established" |
| **Brackets + outdent + full ink** | one item the **reader** brought forward | a system judgement of importance. Never opacity alone, never a background change, never a size change |
| **The crossing row** | this record belongs to both readings, which is why it is rendered once and spans them | a centre, a verdict, or a conclusion. It is in reading order — own, then shared, then what is missing — and it recedes like anything else when the reader raises something else |
| **The anchor** | the subject organising this scene. It occludes the scene on scroll — that occlusion is the depth | anything ranked or scored. It is a simulated object |

### What presence does not mean

Nothing is placed nearer, larger or darker because QANDEEL thinks it matters more. The
resting state is flat. The only thing that brings an item forward is the user pressing
«هاتها قدّام», and the only thing that removes one from the active set is the user
pressing «شيلها من الشغّال». Approach and recede are therefore **user-driven experience
behaviour**, not a relevance gradient — which is what keeps these surfaces inside V5A
truth.

The one ordinal-looking treatment in the build is the ink step used while something is
raised. It encodes *what you are currently looking at versus what you are not* — a
temporary, reversible, user-created view state — and never a property of the objects.
Both halves are asserted live: raising an ordinary fragment recedes the shared material
too, and the shared material can itself be raised.

---

## Three honesty details worth naming

- **Counts are morphology, never figures** («قراءتين», not «٢»). A real count must never
  be able to read as a score. Digits appear only in record dates and times, in
  Arabic-Indic numerals — a temporary locale choice, not a frozen policy.
- **Provenance wording** is «مسجّل من كلامك · ⟨التاريخ⟩», and it is the disclosure
  control itself, so "where did this come from" is always on screen and one press away.
  The expanded accounting says in plain words that the date is when QANDEEL recorded the
  thing, not when it happened, and that it is not a literal transcription.
- **There are no truthful disclaimers to strip.** V6 had to write «مش مقياس لقوة
  العلاقة» and «مفيش وزن ولا ترجيح هنا» because its composition asserted a rank its
  words then denied; its self-check needed a pass that removed those denials before
  scanning. V9's composition asserts no rank, so the surface carries **no confidence,
  rank, strength or weight vocabulary at all — not even in denial**, and the check scans
  the raw text with nothing removed.
