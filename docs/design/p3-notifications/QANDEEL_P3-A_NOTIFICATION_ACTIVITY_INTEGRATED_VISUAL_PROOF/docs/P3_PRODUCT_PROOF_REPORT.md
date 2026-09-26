# P3-A — Notification & Activity: Product proof report

**Status:** `P3-A — VISUAL PROOF / DECISION GATE — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`.
**P3 is NOT CLOSED / NOT FROZEN. No production notification runtime or platform integration has been implemented.**

Baseline `main` `b9e087ba366c9df6843b6b880ff5e790f1fde045`. Everything below is shown in the prototype
(`prototype/index.html`), on the boards (`boards/`) and in the clips (`motion/`), and every behaviour is decided by one
model (`source/src/model.mjs`) that the checks also run.

## Activity

- **What the user sees.** «النشاط» / **Activity**: one quiet, chronological list of what happened across their places —
  From Qandeel, the Shared World, the Public World, Introductions and the account — grouped by Today / Yesterday /
  Earlier. Rows sit on the page; there are no cards, no red unread rows, no totals. (Boards 01, 02.)
- **How they enter it.** A small icon in the top bar, at the start edge (right in Arabic, left in English), on every
  ordinary screen. It does not replace the three Worlds at the bottom, and it is not a World. The recommended icon is
  the new **Open Ledger** drawing in the P2 style (a Quiet Bell was drawn for comparison). (Board 05.)
- **What an item looks like.** The source's small icon, who / where, the time, one sentence, and at most one obvious
  action (e.g. «مراجعة» on a new sign-in). Tapping the row opens the place it came from — checked again at that moment;
  if it no longer exists, the row says so and offers only its own World, never a guess. (Boards 01, 04.)
- **How attention is shown.** A tiny neutral dot on the icon when something new is waiting — never a number, never red,
  never the brass of the navigation. Inside Activity, new rows carry the same dot; items that still need the user (a
  sign-in to review, an introduction) keep a small hollow ring after they are seen. Looking at Activity clears what was
  seen, not everything. (Boards 04, 11.)
- **How filters work.** «الكل» by default, then From Qandeel, Shared, Public, Introductions and System — light filters
  over the one list, not five tabs. Shared can show a small useful count; System counts only items that need action;
  Introductions shows presence only, never a number. (Board 03.)
- **Appearance.** Activity follows Dark / Light / System like the Conversation; it is never painted as the dark
  Analysis. (Board 02.)

## In-app attention

- **When the strip appears.** When the user is already in the app but somewhere else — for example a reply in
  «رحلة الصيف» while they talk with Qandeel — a short strip slides from under the top bar: who, one sentence, a close
  button. Pressing it opens that place. It stays about six seconds, waits while touched or focused, and goes back up by
  itself. (Board 06, clips M02, M03.)
- **When it does not.** Not in the same place (the reply simply appears in the thread), not for low-value activity,
  not for a muted World — and **never during a Live Call**. During a call only the small dot appears; when the call
  ends, what waited is looked at again and at most one strip is shown. An introduction during a call waits the same
  way. (Boards 06, 14; clip M01.)
- **Reduced Motion.** The same strip, the same timing and acts, fading instead of moving. (Board 17, clip M04.)

## Privacy outside the app

- **Four levels, human words.** «خاصة جدًا» (only "new notification"), «تنبيه عام» (the kind only), «إظهار السياق»
  (where and who, no content), «إظهار المعاينة» (part of the content). (Board 10.)
- **Defaults.** Qandeel: kind only. Shared and Public: context. **Introductions: «خاصة جدًا» — the Lock Screen does not
  even say it is an introduction.** Security: context, even when urgent. **No category ever defaults to a preview.**
- The user's choice is a limit: Qandeel may show less, never more. The phone's own settings can still hide more.
- The notification card itself is the phone's design; Qandeel only decides the words. (Boards 10, 14.)

## Settings

General Settings → «الإشعارات والنشاط» (Boards 07, 08, 12):
- **«قنديل يبادر معايا»** — «سماح» / «أقل» / «إيقاف». It only controls interruptions; Qandeel's memory, understanding
  and analysis stay the same.
- **Shared World** — on / off, and each World muted separately. **Public World** — replies on; discoveries off until
  the user opts in (at most once a week). **Introductions** — appears only once the user has entered Introductions.
- **Security & account** — important security alerts always come through; stated in words, not a switch.
- **Quiet Hours** — on by default, **23:00 → 08:00**. **Snooze** — 1 hour, 8 hours, 24 hours, or a custom time.
- **Lock Screen previews** — one limit per kind of notification.
- **Device Notification Settings** — hands over to the phone for sound, style and the Lock Screen.

## Permission

- **When.** Never at first launch. Only at a moment where notifications clearly help: first entry into a Shared
  experience, choosing «سماح» for Qandeel reaching out, or entering Introductions. (Board 09, clip M05.)
- **The screen.** A small sheet in Qandeel's voice: «خليني أوصلك لما يكون في حاجة تستاهل» … with «السماح بالإشعارات» and
  «مش دلوقتي». Then the phone's own permission prompt — which the proof deliberately does not draw.
- **Not now / denied.** Everything keeps working inside the app; Activity, the dot and the strip still work; Qandeel
  does not ask again on its own.

## Frequency

- **Ceilings (never targets):** at most 4 ordinary interruptions in any 24 hours and 12 in any 7 days; Qandeel
  reaching out at most once in 24 hours and 3 times in 7 days; the same topic not again within 48 hours if unanswered,
  and a third time only with something genuinely new; public discoveries at most once a week, only if chosen. A
  reminder the user set for an exact time and an urgent security alert are outside these limits. (Board 13.)
- **Ceiling ≠ quota:** a quiet day stays quiet. Nothing is ever sent because "there is room left".
- **No morning dump:** five things arrive overnight; the morning brings **one** interruption (plus the urgent security
  alert that came through at 06:40), not five. The rest are in Activity, merged only within the same World, and the
  one whose moment passed is not sent at all. (Board 12, clip M06.)

## Open craft questions (only these; nothing already accepted is re-asked)

1. **Entry icon:** Open Ledger (recommended) or Quiet Bell.
2. **Introductions icon in Activity rows:** the two points with an unfinished ring — a second exception to P2's "one
   opening per ring". Accept, or show those rows without an icon.
3. **The words for the second level** «تنبيه عام» / "General": the direction named three levels' words, not four.
4. **«أقل» / Reduce:** the proof reads it as "only when timing really matters". Confirm the intended meaning.
5. **An urgent security alert during a Live Call:** the proof shows only the dot at once and the strip after the call.
6. **The Activity icon is not added to the Analysis screen** (its layout is frozen); it is one step away. Confirm.
7. **Final Arabic and English wording** of every proof string (data/COPY_TABLE.md), and Qandeel's register per user
   dialect.

## Evidence summary

| | |
|---|---|
| Boards | 18 (`boards/`, one question each: `data/BOARDS.json`) |
| Clips | 10, 30 fps: M01, M02, M03, M05, M06, M07 and the Reduced Motion counterparts M01r, M04 (of M02), M05r, M07r; M06 is board-drawn |
| Captures | 89 Product captures at 2× composed into the boards (`data/SHOTS.json`); 16 key phones in `captures/` |
| Checks | **58 / 58 pass; 16 / 16 planted defects rejected** (`data/CHECKS.json`, each with its evidence). The repository governance gate `test:task-closure-governance-contract`: 24 / 24 |
| Coverage | Arabic RTL and English LTR · Dark and Light (and System) · 320 × 568, 390 × 844, 430 × 932 · Increased Contrast · Reduced Motion |

Browser evidence only. Screen readers, device motion / contrast settings, haptics, real delivery and the phone's own
notification surfaces remain device and implementation gates.
