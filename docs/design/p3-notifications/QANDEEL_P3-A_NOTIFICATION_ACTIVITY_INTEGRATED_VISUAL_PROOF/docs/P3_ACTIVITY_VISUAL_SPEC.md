# P3-A — Activity: visual specification (proof)

**Status:** `P3-A PROOF SPECIFICATION — NOT FROZEN` (refined: P3-A refinement §4, §9). Numbers marked *craft* are reviewed reference values, not
Product law. Source of truth: `source/src/build.mjs` (CSS) and `source/src/app.js`.

## 1. Place in the Product (P3-A, P3-S, P3-U)

- **One global destination**, «النشاط» / **Activity**. Not a World, not in the World switcher, not a truth scope.
- **Entry:** an icon-only 44 × 44 pt button at the **START edge of the upper chrome** of every non-Analysis world
  surface (the Personal Conversation, a Shared World). START = right in Arabic, left in English. «تحليل المحادثة» and
  Replay keep their END-side places (G1.1). The three-World navigation is unchanged.
- **Not in the Analysis chrome — Product Owner decision (refinement §4.2).** G3 froze that composition; P3 adds no
  persistent control to it. From the Analysis, Activity is one step away through «المحادثة» (C-ANL-2). The proof shows
  the Analysis as G3.2's own page, byte-exact, in a frame (C-SCOPE-4), and checks it never gains the entry (C-ANL-1;
  planted defect D22).
- **Opening Activity** pushes a full page over the shell, without the World navigation (Activity is not a World). Back
  returns to where the user was.
- **Appearance:** follows the P1 preference Dark / Light / System (new-user default Dark). Never the Analysis dark.

## 2. The entry glyph (P2 consumption, task §20)

| | |
|---|---|
| **Accepted** (Product Owner, refinement §4.1) | **Open Ledger** — square keyline 16 u, corner radius 2 u, two equal rows; the QANDEEL cut carried to the lower END corner on the 45° diagonal, visible gap 5.69 u at 22 px (N1's ring cut: 6.76 u chord) |
| Comparison / history only | **Quiet Bell** — familiar, but it names ringing; not the entry (C-SEL-1) |
| Why not a ring | every ring in the P2 family is a World; Activity is not one |
| Size / ink | 22 px (the upper-chrome size); rest ink `qandeel.state.rest.ink` in every state; never Living Brass |
| Direction | never mirrored (symmetric except the cut, as every P2 glyph) |
| Construction | `source/src/p3glyphs.mjs` (uses `sig.mjs`'s `strokeFor` and `arc`, unchanged) |

## 2a. The Introductions source mark (refinement §9)

The first pass drew two arcs of the Shared ring (two openings — a second exception to P2's one-opening-per-ring
grammar). It is **withdrawn** (kept only as history and as planted defect D23). Two bounded variants replace it, both
fully inside P2 N1 with no exception:

| | |
|---|---|
| **Recommended** | **Open Link** — no ring. navShared's two points of light on the same 45° diagonal through the cut, each reaching toward the other with one straight stroke; the strokes stop 2.6 u apart (P2's cut minimum is 2 u). Before a Mutual Match there is no Shared World to draw: the link is offered, not made |
| Comparison | **At the Door** — one open ring with the one N1 cut at 45°, one point inside and one standing in the opening. Compliant, but a ring means a World in P2, so it risks reading as «قنديل» with a visitor |
| Checks | C-GLY-1 (no ring with more than one opening: Open Link covers 2° of the ring keyline, At the Door has exactly one opening), C-GLY-2 (points on the diagonal, never a face; signature distinct from the World glyphs and the ledger), C-GLY-3 (stroke 1.75 u at 20 px, round terminals, 24-unit grid, inside the live area) |

## 3. The Attention Mark (P3-E / P3-W)

- A **solid neutral dot** in primary ink, 6 pt (7 pt under Increased Contrast), at the glyph's **upper END corner**,
  knocked out of the ground it sits on by a 2-pt ring, so it reads attached and never as a second control.
- **Presence only.** There is no number to show: `indicators().global` has no count field.
- Never Brass, never error ink, never a pill. It cannot be read as SELECTED (E1R's 2-pt bar) — it is round and
  attached to a glyph.
- The accessible name carries it: «النشاط، فيه جديد» / "Activity, new items".
- Arrival: fade + scale 0.6 → 1 in 220 ms ease-out (*craft*); Reduced Motion: fade only. It never pulses.
- The same mark is the row mark inside Activity. A **hollow ring** variant (1.5-pt stroke) means WAITING: seen, but
  still needs you (an actionable item).

## 4. The feed (P3-I)

- One chronological list on the World ground, grouped by «اليوم» / «أمس» / «في وقت سابق». **No cards**, no filled
  unread rows, no coloured edges.
- **Row grammar:** 28-pt source glyph column (the P2 World glyphs in neutral secondary ink; the Introductions source
  mark — §2a; Hugeicons Free `settings` for System) · line 1 (12 / 500): source name, time, and when needed a state word
  («مكتوم», «لم يعد متاحًا») · line 2 (15 / 400): one event sentence · optional line 3 (12 / 500 tertiary) · at most
  **one** inline action as a text button (primary ink, 44-pt target) · otherwise the whole row is the Direct Entry.
- Row padding 10 / 20 pt (*craft*). Times without a leading zero (the shell's clock style), tabular digits.
- **Coalescing** (D09): only same category + same exact context + same kind + low value; never actionable or
  Class ≤ 2 items (`coalesceKey`). The example is «3 رسائل جديدة من سارة وكريم» inside «رحلة الصيف».

## 5. Attention states (board 04)

| State | Visual | Words (in the row's accessible name) |
|---|---|---|
| unseen | solid mark; sentence in primary ink | «جديد» / "new" |
| seen | no mark | — |
| opened | no mark; sentence in secondary ink | — |
| actionable, seen | hollow WAITING mark; the one inline action if obvious | «في انتظارك» / "waiting for you" |
| stale | no mark; sentence tertiary; «لم يعد متاحًا»; on press an explanation and one explicit act into its own World | «لم يعد متاحًا» / "No longer available" |
| muted World | no mark ever; «مكتوم» | «مكتوم» |

**Seen** = the row was at least half on screen for 1.2 s while Activity was open (*craft*). **Opened** = the user
entered it. Neither changes the source event (`resolved` is never written by the attention functions — C-ACT-6).
Opening Activity does not clear everything: the WAITING items keep the global mark present.

## 6. Filters (P3-T)

- `All` by default, then From Qandeel · Shared · Public · Introductions · System. A `role="group"` of toggle buttons
  with `aria-pressed` — **not** a tablist, and not five destinations.
- Selected = E1R SELECTED: primary-selected ink, weight 600 and a 2-pt marker under the word. Rest = rest ink.
- The row scrolls inside itself with a soft END edge; the selected chip is scrolled into view.
- Indicators: Shared shows a **useful count** of items needing attention (1 coalesced row, not 3 messages); System
  shows a count only of **actionable** items; From Qandeel and Public show presence; **Introductions shows presence
  only**, never a number (P3-F, D48).

## 7. Dimensions (reference, *craft*)

Status 47 · upper chrome 48 · filter row 44 · row min ≈ 60 · navigation 56 + home 34 (hidden on the Activity page) —
all consumed from the G1.1 / G3.2 shell.
