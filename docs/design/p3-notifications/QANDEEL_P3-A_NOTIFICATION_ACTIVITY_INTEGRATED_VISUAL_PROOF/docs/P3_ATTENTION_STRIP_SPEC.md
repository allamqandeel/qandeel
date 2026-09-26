# P3-A — The in-app Attention Strip (proof)

**Status:** `P3-A PROOF SPECIFICATION — NOT FROZEN`. Evidence: board 06, clips M02 / M03 / M04, checks C-STRIP-1…4.

## 1. When it appears (P3-H / P3-J / P3-V)

Only when **all** of these hold, as decided by `model.decide()` (never by the view):

1. QANDEEL is in the **foreground** (the Product already has the user's attention, D51);
2. the user is **outside the event's originating context**;
3. the event is eligible to interrupt: not Class 4 ambient, not Public Discovery, not a muted World, not Proactive
   QANDEEL set to Off (or a Class 3 reason under Reduce), not suppressed by authority;
4. **no active Live Call**.

## 2. When it does not

| Case | What happens instead |
|---|---|
| same originating context (S1) | the event lands **in place** (the new message appears in the thread); no strip, no Push |
| active Live Call (S7, S8) | **deferred**: the item goes to Activity and the entry's mark becomes present, silently; the call line is untouched. An Introduction is deferred the same way (G3 §D). When the call ends, deferred items are **re-evaluated**; the first still-eligible one is presented once (board 06, `call-ended`). Nothing is replayed in bulk |
| ambient / Discovery / muted | Activity only, without a mark |
| background | the strip does not exist; see the Push rules |

## 3. Form

- An **ASIDE** (B4R): anchored to the upper chrome, nonmodal, no scrim, the one Surface tone, radius 14 (the Replay
  menu's), inset 10 pt, starting 2 pt under the chrome's lower edge — it emerges from the chrome.
- Content: the source glyph (neutral), a meta line «source · الآن» (12 / 500 secondary), one sentence (15 / 400
  primary, two lines max, clamped), and a 44 × 44 dismiss (Hugeicons Free `close`, normalised to the P2 stroke).
- The whole body is **one button: the Direct Entry** into the originating context (revalidated at tap, D38).
- Speaker: a QANDEEL-authored strip speaks as QANDEEL; Shared / Public / Introductions / System are Product voice (D18).
- Importance is never colour: the System strip is the same material as the others; its words carry it.

## 4. Behaviour (`app.js` `showStrip` / `dismissStrip`; timings are *craft*)

| Phase | Standard | Reduced Motion |
|---|---|---|
| appear | opacity 0 → 1 and 10 pt down from the chrome, 240 ms, ease-out `cubic-bezier(.23,1,.32,1)` | opacity only, 160 ms |
| readable hold | 6 s; **paused** while focus or a finger is on it; no countdown or progress | the same |
| dismiss (timeout or ×) | opacity 1 → 0 and 10 pt back up into the chrome, 180 ms | opacity only, 140 ms |
| enter (press) | the strip leaves, then the originating context fades in (200 ms) | 120 ms |

No bounce (no momentum is involved), no pulse, no loop (C-STRIP-3 reads every frame of M02 and scans the page for
infinite animations). Exit follows the entry path (apple-design §7).

## 5. Accessibility

`role="region"` named «تنبيه» / "Notice"; one polite announcement through the page's single persistent live region
(«تنبيه: رحلة الصيف — سارة ردّت عليك»); focus is never stolen; both buttons are named; the strip is never the only
carrier (the item is always in Activity).

## 6. Required families (board 06)

QANDEEL-authored (in a Shared World) · Shared (in the Personal Conversation) · System (new sign-in) · same-context
suppressed · Live-Call deferred · post-call presentation · English Light.
