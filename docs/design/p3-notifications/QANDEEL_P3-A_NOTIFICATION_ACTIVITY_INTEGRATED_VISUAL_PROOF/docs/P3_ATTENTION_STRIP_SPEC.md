# P3-A — The in-app Attention Strip (proof)

**Status:** `P3-A PROOF SPECIFICATION — NOT FROZEN` (refined: P3-A refinement §8). Evidence: board 06, board 14, board
17, clips M02 / M03 / M04 / M08 / M08r / M09, checks C-STRIP-1…4, C-CALL-1m…6.

## 1. When it appears (P3-H / P3-J / P3-V)

Only when **all** of these hold, as decided by `model.decide()` (never by the view):

1. QANDEEL is in the **foreground** (the Product already has the user's attention, D51);
2. the user is **outside the event's originating context**;
3. the event is eligible to interrupt: not Class 4 ambient, not Public Discovery, not a muted World, not Proactive
   QANDEEL set to Off (or, under Reduce, a candidate the Proactive Gate did not find strong enough), not suppressed by
   authority;
4. **no active Live Call** — with the two narrow exceptions of §3.

## 2. When it does not

| Case | What happens instead |
|---|---|
| same originating context (S1) | the event lands **in place** (the new message appears in the thread); no strip, no Push |
| active Live Call, ordinary attention (S7 Shared, S8 Introduction, S16 Proactive; S19 in the background) | **deferred**: the item goes to Activity and the attention mark becomes present, silently; the call is untouched. An Introduction is deferred the same way (G3 §D). When the call ends, deferred items are **re-evaluated**; the first still-eligible one is presented once (board 06, `call-ended`). Nothing is replayed in bulk |
| ambient / Discovery / muted | Activity only, without a mark |
| background | the strip does not exist; see the Push rules |

## 3. The call-safe strip — the only two exceptions during a Live Call (refinement §8)

`model.isCallSafe()` admits exactly:

1. a **genuinely critical security / account event** (`kind: 'security'`, `critical: true`) — S17;
2. an **exact-time reminder the user explicitly asked for** (`kind: 'reminder'`, `requested: true`) — S18.

A reminder that was not requested, or a non-critical security notice, still waits (C-CALL-2m). In the background during
a call these two take the normal Push path (S20); everything else waits there too (S19).

**What it is:** a small, non-blocking strip in the same ASIDE material, with **no Direct Entry**. Its body is text; its
one act is dismiss. The proof invents no mid-call navigation law: the item waits in Activity (the security item stays
actionable, with its mark), and the call continues exactly as it was (C-CALL-5).

**What it is not:** a modal, a takeover, a full-screen interruption, a replacement for the call, a persistent Analysis
control, a new Activity entry in the Analysis, or an OS Critical Alert mapping. It never pulses or bounces, never uses
Living Brass as status, and never uses red.

**Where it lives:**

| Surface | Place | Why |
|---|---|---|
| Conversation, during a call (G1.2: the call continues) | under the upper chrome, as the ordinary strip, with the full sentence | the conversation content is not frozen; Call Rail A stays untouched at the bottom |
| **Analysis**, during a call (G3's own page, in a frame) | **inside the upper chrome row (y 47–95), from the Replay slot to 8 pt before «المحادثة»**, 44 pt tall; the short line only («تسجيل دخول جديد» / "New sign-in"; «كلّم العيادة، 4:00» / "Call the clinic, 4:00"), two lines at most | G3's world starts at y 95 and, in a call, is sized at its floor max(160, usable / 2) — at 320 × 568 PINNED it is 161 pt on a 160-pt floor (G3 closure §C.2). Anything laid over the world would take it below its floor. The chrome row is the only place that touches neither the world nor a frozen control |

In the Analysis the strip covers the **Replay slot only, for its hold**. It never covers «المحادثة» (the Conversation ↔
Analysis switch), the Timeline, Return Live, the band or the call line (C-CALL-3 measures every one of them on G3's own
elements at 320, 390 and 430, Arabic and English). If Replay takes keyboard focus under it, the strip steps aside, so
focus is never obscured. The geometry is **measured from G3's page** (`app.js chromeSlot()`), never assumed.

**Consequence outside a call (open craft item):** an ordinary strip that arrives while the user is in the Analysis
uses the same chrome-row place, for the same reason (the world is sized at its floor there too). It keeps its Direct
Entry. Board 06 shows it (`analysis-strip-shared`).

## 4. Form (the ordinary strip)

- An **ASIDE** (B4R): anchored to the upper chrome, nonmodal, no scrim, the one Surface tone, radius 14 (the Replay
  menu's), inset 10 pt, starting 2 pt under the chrome's lower edge — it emerges from the chrome.
- Content: the source glyph (neutral), a meta line «source · الآن» (12 / 500 secondary), one sentence (15 / 400
  primary, two lines max, clamped), and a 44 × 44 dismiss (Hugeicons Free `close`, normalised to the P2 stroke).
- The whole body is **one button: the Direct Entry** into the originating context (revalidated at tap, D38).
- Speaker: a QANDEEL-authored strip speaks as QANDEEL; Shared / Public / Introductions / System are Product voice (D18).
- Importance is never colour: the System strip is the same material as the others; its words carry it.

## 5. Behaviour (`app.js` `showStrip` / `dismissStrip`; timings are *craft*)

| Phase | Standard | Reduced Motion |
|---|---|---|
| appear | opacity 0 → 1 and 10 pt down from the chrome (6 pt in the Analysis chrome row), 240 ms, ease-out `cubic-bezier(.23,1,.32,1)` | opacity only, 160 ms |
| readable hold | 6 s; **paused** while focus or a finger is on it; no countdown or progress | the same |
| dismiss (timeout or ×) | opacity 1 → 0 and back up into the chrome, 180 ms | opacity only, 140 ms |
| enter (press; ordinary strip only) | the strip leaves, then the originating context fades in (200 ms) | 120 ms |

No bounce (no momentum is involved), no pulse, no loop (C-STRIP-3 reads every frame of M02 and scans the page for
infinite animations; C-CALL-6 reads M08 / M08r). Exit follows the entry path (apple-design §7).

## 6. Accessibility

The ordinary strip is a `role="region"` named «تنبيه» / "Alert"; the call-safe strip is named «تنبيه أثناء المكالمة» /
"Alert during your call", and its text says the call continues. One polite announcement through the page's single
persistent live region — never through the call's own live-status channel (G1.2), and nothing is announced for
ordinary events during a call. Focus is never stolen; every button is named; the strip is never the only carrier (the
item is always in Activity).

## 7. Required families (boards 06, 14)

QANDEEL-authored (in a Shared World) · Shared (in the Personal Conversation) · System (new sign-in) · same-context
suppressed · Live-Call deferred (Conversation and Analysis) · post-call presentation · English Light · call-safe critical
security (Analysis 320 / 390 / 430, Conversation) · call-safe requested reminder (Analysis 320 / 390, Conversation Light)
· dismissed, call continuing.
