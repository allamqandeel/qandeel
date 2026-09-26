# QANDEEL — I-08B3.1-G1.1
## Canonical Closure + Controlled Amendments

**Status:** `I-08B3.1-G1.1 — CLOSED / FROZEN AS PRIMARY PRODUCT SHELL + CONVERSATION + NAVIGATION PROOF`

**Independent review basis:** `I-08B3.1-G1.1-R3-CONSOLIDATED-PRODUCT-CONVERSATION-REPLAY-CORRECTION`  
**Reviewed R3 ZIP SHA-256:** `0a56a2fbc836168f16fbb3860b1847002e1bdfb376188c7ce0e6b459b434fbcd`

This record closes G1.1 after independent Product / Design review and applies the two bounded
canonical corrections that remained after R3. It does not reopen G2, Voice / Live Call runtime,
Replay media delivery, or final implementation.

---

## 1. Product-shell decisions accepted from R3

The following G1.1 Product decisions are accepted:

- Arabic primary Conversation: the user's committed turn occupies the **right** conversational side;
  QANDEEL occupies the opposite side.
- English primary Conversation: the user's committed turn occupies the **left** conversational side;
  QANDEEL occupies the opposite side.
- Speaker position and paragraph bidi direction are independent.
- The user's preferred turn morphology is the partial / incomplete directional slab shown in R3,
  not a fully rounded messenger bubble.
- Writing is **Conversation-first**.
- Voice Note is **Conversation-first**.
- Live Call is **Analysis-first** by default; opening Conversation does not end the same call.
- Conversation → Analysis uses **«تحليل المحادثة»**.
- Analysis → Conversation uses **«المحادثة»**.
- Internal `MY_WORLD` / World vocabulary is not the user-facing name of the Conversation-analysis depth.
- Replay is an action on the current Conversation / Analysis context, not a World or primary tab.
- **Superseded by I-08B3.1-G1.2:** the stable Shared World Product-area name is
  **«العالم المشترك»** in Arabic and **Shared World** in English, singular regardless of how many
  Shared Worlds currently exist. The earlier count-neutral / count-dependent proof wording is historical only.
- The normal Arabic new-conversation opener is:
  **«اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ»**.

The exact post-registration Welcome remains a separate copy moment and is not redefined here.

---

## 2. Controlled language amendment — VI-01

G1.1 supersedes VI-01 only on the following narrow naming point:

- canonical Conversation surface / referential noun: **«المحادثة»**;
- Arabic Conversation → Analysis depth action: **«تحليل المحادثة»**;
- **«القراءات»** remains the analytical-content vocabulary inside that depth;
- ordinary uses of **«الكلام»** remain valid where they are natural Arabic phrases
  (for example «سياق الكلام» and «كلامك هنا»);
- English remains **Conversation** for the Conversation surface;
- the exact English Conversation → Analysis depth label remains open to the later English copy pass.

The canonical VI-01 Foundation, Terminology Matrix, Copy Patterns and archive README are amended
accordingly. No VI-01 register, truth, gender, accessibility or bilingual-authorship contract is
reopened.

---

## 3. Controlled Surface amendment — `UTTERANCE`

Independent review accepts the R3 reconciliation: the user's committed-turn slab cannot truthfully
be `APPARATUS`, `ASIDE`, `PASSAGE` or `FIELD`.

A fifth Surface role is therefore authorized as a **narrow additive role**:

### `UTTERANCE` — “these words are the reader's”

- **Cause:** attribution of the reader's own committed words in Conversation history.
- **May contain:** exactly one committed human turn — text, or a voice-message turn with its
  committed textual representation.
- **Must not contain:** analytical content; QANDEEL's words; uncommitted composer text; unrelated
  controls beyond that turn's own media control.
- **Nature:** persistent; the container itself is non-interactive.
- **Placement:** anchored to the author's own conversational screen edge, inside the World's
  content plane, never over it.
- **Scrim:** never.
- **May sit on:** `WORLD` only.
- **Tone:** `{qandeel.surface.functional}`.
- **Material rule:** **no new colour and no second Surface tone**.
- **Geometry:** open / attached toward the author's screen edge and rounded only on the inward
  corners, matching the accepted G1.1 morphology.
- **Identity rule:** the role communicates speaker attribution only. It does not mean selected,
  important, confident, analytical, successful or active.

### One-tone token route

When the B4 token source is next synchronized into an implementation package, the semantic alias is:

```text
qandeel.role.utterance.fill = {qandeel.surface.functional}
```

This alias changes no rendered colour value.

### Earning-test amendment

The Surface ROLE clause becomes:

> Exactly one of `APPARATUS`, `ASIDE`, `PASSAGE`, `FIELD` or `UTTERANCE` must apply.

No existing Surface is reclassified:
- composer stays `FIELD`;
- standing product/navigation machinery stays `APPARATUS`;
- light transient anchored overlays stay `ASIDE`;
- modal passage stays `PASSAGE`.

This is the only B4/B0 semantic expansion authorized by G1.1.

---

## 4. Why no rerender was required

The amendment above changes **classification / canonical wording only**.

R3 already renders the accepted slab:
- with the existing functional Surface tone;
- with the accepted incomplete geometry;
- on the accepted Arabic/English speaker side;
- without Brass as speaker colour;
- without a new visual token.

Therefore a new render would not change a pixel and is not a meaningful acceptance gate.

The reviewed R3 evidence remains the visual proof of record for G1.1.

---

## 5. Non-blocking carry-forward boundaries

These do **not** keep G1.1 open:

- **Living Analysis spectacle:** owned by **G2**. The simplified analysis image used by G1.1 is
  proof scaffolding, not the final visual target.
- **Personal original audio / Live Call Replay source:** the Replay runtime currently does not
  provide a reviewed durable Personal original-audio/call source. Voice / Live Call integration
  must establish that source before the intended audio-led Replay can launch.
- **Final Replay mobile Product surface / delivery:** existing backlog item
  `QAN-BL-NAV-02 — Analysis Replay` remains open; G1.1 defines shell placement but does not
  falsely claim delivery implementation.
- **Display name implementation:** G1.1 defines the copy contract with `{display_name}`;
  the identity / registration implementation must supply a canonical value before launch.
- **Exact Arabic Replay noun:** remains editable Product copy; R3 proof wording does not become
  canonical through G1.1 closure.
- **Real-device VoiceOver / TalkBack / Android bidi validation:** remains an implementation/device
  validation gate, not a blocker on this visual Product proof.
- **Shared-World turns by other humans:** G1.1's `UTTERANCE` role closes only the reader's own
  Personal Conversation attribution; multi-human Shared-World attribution remains outside this task.

The canonical backlog was reviewed before closure. No existing backlog item is incorrectly
tombstoned by this record, and no new item is required merely to duplicate an already-owned
future-track boundary.

---

## 6. Closure

The two final review blockers are resolved:

1. VI-01 naming drift — **CORRECTED**.
2. B4 Surface-role gap for the accepted user slab — **CORRECTED by additive `UTTERANCE` role**.

No production code or visual pixel changed.

> **I-08B3.1-G1.1 — CLOSED / FROZEN**

Next Product-design work may proceed to the next G1 task without rerunning G1.1 visual generation.
