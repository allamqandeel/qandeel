# QANDEEL — S4-03 Birth Scene (G-04) & World-Transition Motion (G-25) — Visual Decision Package v1

**Status:** `DECIDED — T-A + B-A (Product Owner, 2026-10-05)`. The current plain World transition stays for v1 and the World
shell itself is the birth scene for v1; no new geometry, duration, easing or motion semantics are invented, and production
motion is unchanged. The options below are kept as the record of what was decided between.
**Owner of the decision:** the Product Owner (S4-03 Task Contract §4.2).
**Inherited from:** S4-01 Stage-4 Gap Matrix rows `G-04` (final birth-scene visual realization) and `G-25` (World-Transition
motion review, CW2-07 §41 / §49).

---

## 1. Why this stops here

The S4-03 Task Contract (§4.2) requires a census of the frozen visual authority before anything is drawn, and a stop for
Product Owner approval if that authority does not define enough geometry for a production realization. It does not.

| Item | What frozen authority defines | What it leaves open |
|---|---|---|
| **G-04 birth scene** | The *meaning*: "the World starts as a living space, not an empty chat", QANDEEL inside it, something that visually indicates both members (Shared World Product Definition §7); a neutral QANDEEL welcome and no setup before entry (CW2-03 §6–§8); the approved welcome copy (S4-01 §1.6) | The Product Definition is explicitly "not a Visual Freeze" and states the final visual form of the member links is "not yet decided" (§7, §25). CW2-07 is "Final graphic design: NOT FROZEN". No frozen artifact draws a direct-invitation birth. The only drawn birth (G3.2) is Matching-born proof evidence that G3 keeps as evidence, not Product law (G3 closure §J; G3 :208 "not universalised") |
| **G-25 World transition** | The laws: authority first, a neutral pre-authority shell with only neutral QANDEEL / world-boundary motion (CW2-07 §19–§20); motion may explain departure, boundary, entry, orientation, return and may not imply shared coordinates, content merge, permission transfer or hidden destination truth (§40); "Nothing teleports. Meaning resolves. A World boundary remains perceptible" (§41); Reduced-Motion parity (§42, G29 / G30); one curve `cubic-bezier(0.23,1,0.32,1)` and the cut + 140 ms resolve Reduced-Motion pattern (T-10, P2 §9 Calm State Morphing) | No frozen duration, curve assignment or geometry for a World change (CW2-07 §51; I-08A4 :599 "detailed motion realization" not frozen; P4-C classes switcher motion as craft). F2's 200 ms is explicitly NOT extended to the Shared World (G2 / F2 amendment :81). CW2-07 §49 requires an explicit motion review as a sign-off step |

A further conflict makes guessing unsafe: the Product Definition's §7 meaning ("something extends from QANDEEL's sides that
indicates both members") is close to the decorative "AI connection lines" / avatars the Task Contract forbids, and CW2-07
§18 forbids collapsing presence, relation, provenance and navigation into one line or link type.

## 2. What production draws today (unchanged by S4-03)

- **Switch QANDEEL ↔ Shared World:** a conditional mount of the Shared area over the still-mounted Personal world — a hard
  cut in standard and Reduced Motion alike (parity holds trivially). The SW-3 seam changes instantly.
- **Entry into a World:** the neutral pre-authority shell (no Name, member, title or welcome), then the World shell on
  ALLOW. No motion.
- **Birth:** the same authority-first entry as any World (the client does not distinguish birth from entry); the World
  shell shows the member Names and QANDEEL's approved welcome as plain text, with no mark.
- **S4-03 additions** (Manage World, the ended World) use the same cut: no new motion was introduced.

## 3. Options for the Product Owner

Every option uses only existing primitives, draws no avatar, topology graph, waveform, connection line or signal-bearing
animation, and keeps Reduced-Motion parity. Values are the reviewed G1.1 / G3.2 / T-10 evidence values, not frozen law.

### G-25 — World transition

| Option | What it is | Reduced Motion |
|---|---|---|
| **T-A — Ratify the neutral cut** (recommended for v1) | The motion review records that the present cut satisfies CW2-07 §40–§42: the boundary is perceptible as a change of ground and chrome, nothing implies shared coordinates or a content merge. No code change | identical |
| T-B — Seam travel + destination resolve | The SW-3 selected seam travels to the chosen cell (lead 200 ms / trail 280 ms); the destination's ground resolves in over 140 ms on the T-10 curve; the departing World cuts (never cross-faded: T-10 rejects old-scene crossfade). The pre-authority shell shows only the resolve | seam cuts; 140 ms opacity resolve only |

### G-04 — Birth scene

| Option | What it is | Reduced Motion |
|---|---|---|
| **B-A — The current World shell is the birth scene** (recommended for v1) | Keep the approved welcome and the members as they are; mark only the first entry after acceptance with the same 140 ms resolve as any entry. No links, no mark | none (static) |
| B-B — Shared-material frame at birth | The welcome sits on the frozen D2R "Shared" dash material (the same contours with one dash pattern; the dash value `7 5` is craft, not frozen), resolved once at birth over 320 ms after a 100 ms beat; never on later entries (birth ≠ arrival) | static frame, no resolve |
| B-C — G3.2-style rise | The World rises (translateY 18→0, scale 0.985→1, 320 ms) with the welcome +80 ms. Needs a Product Owner ruling on the Q mark (P4-DQ-03 Q-A names no Shared birth moment) and on the stagger (T-10 forbids stagger in the Map) | 140 ms resolve |

Open sub-questions the Product Owner may want to settle with any option: whether the **inviter** (who did not accept) gets
any arrival moment for a direct-invitation birth (G2.3 settles this only for Matching), and whether the welcome shows a
QANDEEL mark.

## 4. Recommendation

T-A + B-A for v1: they change nothing that is shipped, satisfy every frozen law, and keep the expressive birth moment open
for a dedicated visual task rather than a guess inside a lifecycle task. If the Product Owner prefers T-B and / or B-B, a
bounded local visual proof (the two motions on the production surfaces, standard and Reduced Motion, Arabic and English)
is prepared before anything ships.

## 5. What S4-03 does meanwhile

Nothing visual is changed for G-04 / G-25. The record (§4.2) carries this package as the disposition, and the Gap Matrix
keeps both rows open against the Product Owner's decision.

## 6. Decision (Product Owner, 2026-10-05)

**T-A + B-A.** Keep the current / plain World transition for v1; the World shell itself is the birth scene for v1. No new
geometry, duration, easing or motion semantics are invented in S4-03, and production motion remains unchanged. This closes
the S4-03 ambiguity gate for `G-04` and `G-25` (S4-03 implementation record §4.2, §14).
