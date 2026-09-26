# P3-A — Notification & Activity: Product proof report

**Status:** `P3-A FINAL MICRO-REFINEMENT — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`. The P3-A direction and its
first refinement passed independent review; the final micro-refinement records the Product Owner's final craft
selections and one bounded correction — no ordinary Attention Strip inside the Analysis (see §Final micro-refinement).
**P3 is NOT CLOSED / NOT FROZEN. No production notification runtime or platform integration has been implemented.**

Baseline `main` `b9e087ba366c9df6843b6b880ff5e790f1fde045`. Everything below is shown in the prototype
(`prototype/index.html`), on the boards (`boards/`) and in the clips (`motion/`), and every behaviour is decided by one
model (`source/src/model.mjs`) that the checks also run.

## Final micro-refinement — the last decisions, and what changed

| Decision | Realized |
|---|---|
| Introductions row mark | **Open Link is FINAL** (accepted by the Product Owner); At the Door is comparison / history only; the two-opening drawing stays withdrawn (board 05; C-SEL-2, C-GLY-1…3) |
| Ordinary attention inside the Analysis | **no Attention Strip inside the Analysis**, call or no call. The model owns it: with the proof-context field `view`, ordinary attention in the Analysis is **deferred** (reason `analysis-deferred`) — no strip, no transient region, no announcement — and stays in Activity with the mark. Critical security outside a call gets no new exception (S32–S36; boards 06, 14, 17; C-ANL-3m, C-ANL-3) |
| Leaving the Analysis | the waiting events are **re-evaluated** against current truth, authority, eligibility and context (`reevaluatePending`); **at most one strip** follows; stale, muted and same-context candidates are not forced; if the call continues they keep waiting (X1–X4; clip M10; C-EXIT-1m…4) |
| Call-safe exceptions | unchanged and narrow: only **critical security** and a **requested exact-time reminder**, only during an active Live Call (S37, S38; C-CALL-2m, C-ANL-4m) |
| Replay slot | Temporary intentional Replay occlusion is the one bounded exception; all other frozen Analysis controls and the world remain unobstructed — only for the two call-safe cases during an active Live Call (board 06; C-CALL-3, C-CALL-7, C-DOC-1) |
| Call-safe strip interaction | **dismiss only — no Direct Entry**; dismissing resolves nothing and ends nothing (C-CALL-5) |
| Rejected evidence | the ordinary Analysis strip state `analysis-strip-shared` is removed from the prototype's states, captures and boards; it survives only as planted defect D24 (REJECTED / PLANTED DEFECT — ORDINARY STRIP INSIDE ANALYSIS) |

## Refinement — what the Product Owner decided, and what changed

| Decision | Realized |
|---|---|
| Activity entry glyph | **Open Ledger accepted**; the Quiet Bell stays as comparison / history only (board 05; C-SEL-1) |
| Analysis | **no Activity entry in the Analysis chrome**; the Analysis is G3.2's own page, byte-exact, unchanged; Activity is one step away through «المحادثة» (board 05; C-ANL-1, C-ANL-2, C-SCOPE-4) |
| L1 words | **«إظهار النوع» / "Show type"** — the type only; «تنبيه عام» / "General" withdrawn (boards 07, 08, 10; C-COPY-1) |
| «أقل» / Reduce | **a tighter Proactive Gate, not "Class 2 only"**: a Gate-strong Class 3 may interrupt, a Gate-weak Class 2 waits; no score, weight or threshold — the fixture states the Gate's finding as one boolean (boards 07, 14; C-RED-1…5) |
| Introductions disclosure | **default L0 kept; the category-wide L1 cap removed**; the user may raise the ceiling; an event's own bounded projection may still render less (board 10; C-PRIV-6, C-PRIV-7; S28–S31) |
| Active Live Call | ordinary Shared / Public / Introductions / Proactive attention **waits**; **only critical security and a requested exact-time reminder** show a small call-safe strip (boards 06, 14, 17; clips M08, M08r, M09; C-CALL-1m…7) |
| Introductions row mark | the two-opening drawing **withdrawn**; Open Link and At the Door compared — **Open Link since accepted as final** (board 05; C-GLY-1…3, C-SEL-2) |
| Copy | a **bounded** cleanup of the important Product UI; fixture sentences keep the status FIXTURE (`data/COPY_TABLE.md`) |

Everything else in P3-A is unchanged and still realized as accepted.

## Activity

- **What the user sees.** «النشاط» / **Activity**: one quiet, chronological list of what happened across their places —
  From Qandeel, the Shared World, the Public World, Introductions and the account — grouped by Today / Yesterday /
  Earlier. Rows sit on the page; there are no cards, no red unread rows, no totals. (Boards 01, 02.)
- **How they enter it.** A small icon in the top bar, at the start edge (right in Arabic, left in English), on every
  ordinary screen — never inside the Analysis. It does not replace the three Worlds at the bottom, and it is not a
  World. The icon is the **Open Ledger** drawing in the P2 style, accepted by the Product Owner. (Board 05.)
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
- **Never inside the Analysis.** While the user is in the Analysis, nothing ordinary is laid over it — no strip, no
  sound for a screen reader, nothing. The reply, the public reply, the introduction or Qandeel reaching out wait,
  marked, in Activity. When the user leaves the Analysis (by «المحادثة»), Qandeel looks at what waited again: at most
  one strip, and only for something that still deserves it now — not for a World muted meanwhile, not for something
  that is gone, not for the Conversation the user is returning to. (Boards 06, 14; clip M10.)
- **When it does not.** Not in the same place (the reply simply appears in the thread), not for low-value activity,
  not for a muted World — and **not during a Live Call** for anything ordinary: a Shared reply, a public reply, an
  introduction or Qandeel reaching out all wait, marked in Activity; when the call ends, what waited is looked at again
  and at most one strip is shown. (Boards 06, 14; clip M01.)
- **The two exceptions during a call.** A genuinely critical security / account alert, and a reminder the user set for
  exactly now, show a **small call-safe strip** at once: no takeover, no modal, nothing to open mid-call — just the line
  and a close button, while the call goes on; closing it settles nothing and ends nothing. In the Analysis it sits in the
  top bar beside «المحادثة» and deliberately hides the Replay button while it shows — the one accepted exception; the
  world, «المحادثة», the Timeline, «العودة إلى المحادثة الجارية» and the call controls stay exactly as G3 froze them —
  measured at 320, 390 and 430. If Replay is reached by keyboard, the strip steps aside. (Board 06; clips M08, M09.)
- **Reduced Motion.** The same strip, the same timing and acts, fading instead of moving. (Board 17, clips M04, M08r.)

## Privacy outside the app

- **Four levels, the Product Owner's words.** «خاصة جدًا» (only "new notification"), «إظهار النوع» (the type only),
  «إظهار السياق» (where and who, no content), «إظهار المعاينة» (part of the content). (Board 10.)
- **Defaults.** Qandeel: kind only. Shared and Public: context. **Introductions: «خاصة جدًا» — the Lock Screen does not
  even say it is an introduction** — and there is no permanent cap: the user may raise it, and Qandeel may still show
  less for a particular event (a pending proposal never shows a preview, because nobody is named before both accept).
  Security: context, even when urgent. **No category ever defaults to a preview.**
- The user's choice is a limit: Qandeel may show less, never more. The phone's own settings can still hide more.
- The notification card itself is the phone's design; Qandeel only decides the words. (Boards 10, 14.)

## Settings

General Settings → «الإشعارات والنشاط» (Boards 07, 08, 12):
- **«قنديل يبادر معايا»** — «سماح» / «أقل» / «إيقاف». It only controls interruptions; Qandeel's memory, understanding
  and analysis stay the same. «أقل» means fewer interruptions, kept for what matters most or can't wait — said in one
  line under the choice, with no class or number.
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

## Still open — copy and device / implementation only

No Product or craft question remains: Open Link, the ordinary Analysis strip, the Replay-slot policy and the call-safe
strip's lack of Direct Entry are all decided by the Product Owner (above).

1. **Copy only:** the wording still marked PROOF (the Allow / Reduce / Off lines, the call-safe name «تنبيه أثناء
   المكالمة», the other settings lines) and every FIXTURE sentence (`data/COPY_TABLE.md`); Qandeel's register per user
   dialect.
2. **Device / implementation:** VoiceOver / TalkBack, device Reduce Motion and Increase Contrast, haptics, real delivery
   and the platform mapping (board 14's example is not authority) are later device and implementation gates.

The 08:00 rule stays as recorded: a waiting candidate earns a Push at 08:00 only if it is still timely then.

## Evidence summary

| | |
|---|---|
| Boards | 18 (`boards/`, one question each: `data/BOARDS.json`) |
| Clips | 14, 30 fps: M01, M02, M03, M05, M06, M07, M08, M09, M10 and the Reduced Motion counterparts M01r, M04 (of M02), M05r, M07r, M08r; M06 is board-drawn |
| Captures | 117 Product captures at 2× composed into the boards (`data/SHOTS.json`); 22 key phones in `captures/` |
| Checks | **89 / 89 pass; 29 / 29 planted defects rejected** (`data/CHECKS.json`, each with its evidence). The repository governance gate `test:task-closure-governance-contract`: 24 / 24 |
| Coverage | Arabic RTL and English LTR · Dark and Light (and System) · 320 × 568, 390 × 844, 430 × 932 · Increased Contrast · Reduced Motion |

Browser evidence only. Screen readers, device motion / contrast settings, haptics, real delivery and the phone's own
notification surfaces remain device and implementation gates.
