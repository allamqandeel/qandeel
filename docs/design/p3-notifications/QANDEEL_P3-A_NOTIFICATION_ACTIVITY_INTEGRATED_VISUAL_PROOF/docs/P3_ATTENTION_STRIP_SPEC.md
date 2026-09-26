# P3-A — The in-app Attention Strip (proof)

**Status:** `P3-A PROOF SPECIFICATION — NOT FROZEN` (refined: P3-A refinement §8; final micro-refinement §5–§9).
Evidence: board 06, board 14, board 17, clips M02 / M03 / M04 / M08 / M08r / M09 / M10, checks C-STRIP-1…4,
C-CALL-1m…7, C-ANL-3m, C-ANL-4m, C-ANL-3, C-EXIT-1m…4, C-DOC-1.

## 1. When it appears (P3-H / P3-J / P3-V)

Only when **all** of these hold, as decided by `model.decide()` (never by the view):

1. QANDEEL is in the **foreground** (the Product already has the user's attention, D51);
2. the user is **not inside the Analysis** (final micro-refinement §5: the Analysis is not an attention surface);
3. the user is **outside the event's originating context**;
4. the event is eligible to interrupt: not Class 4 ambient, not Public Discovery, not a muted World, not Proactive
   QANDEEL set to Off (or, under Reduce, a candidate the Proactive Gate did not find strong enough), not suppressed by
   authority;
5. **no active Live Call** — with the two narrow exceptions of §4.

The decision order in `decide()`: authority and semantic time → category eligibility and mute → Proactive settings →
ambient → **Live Call exceptions** → **Analysis: ordinary attention deferred** → same context → different context →
background (OS permission, Snooze, Quiet Hours, ceilings, disclosure). Where the user is looking reaches the model as
the proof-context field `view` (`'analysis' | 'conversation' | 'shared' | …`) — proof context, not a production schema.

## 2. When it does not

| Case | What happens instead |
|---|---|
| same originating context (S1) | the event lands **in place** (the new message appears in the thread); no strip, no Push |
| **inside the Analysis, no call** (S32 Shared, S33 Public, S34 Introduction, S35 Proactive; S36 even critical security) | **deferred** (reason `analysis-deferred`): no strip, no transient region, no announcement, nothing laid over G3's page. The item is in Activity with the attention mark. It is **re-evaluated when the user leaves the Analysis** (§3) |
| active Live Call, ordinary attention (S7 Shared, S8 Introduction, S16 Proactive, S39 in the Analysis; S19 in the background) | **deferred**: the item goes to Activity and the attention mark becomes present, silently; the call is untouched. An Introduction is deferred the same way (G3 §D). When the call ends, deferred items are **re-evaluated** (§3) |
| ambient / Discovery / muted | Activity only, without a mark |
| background | the strip does not exist; see the Push rules |

Critical security outside a call gets **no new exception** inside the Analysis: no frozen rule names another surface
there, so it waits like everything else and is re-evaluated on exit (S36).

## 3. Leaving a deferring state — re-evaluated, never replayed (final micro-refinement §7)

When the user leaves the Analysis for another Product surface — and, by the same law, when a Live Call ends —
`model.reevaluatePending()` decides every waiting candidate **again**, against current truth, current authority,
current eligibility and the current context:

- **at most one** strip follows. If several are strip-eligible now, the one with the highest attention value is
  presented (lowest Interruption Class; on a tie, the one that has waited longest — proof interpretation); the others
  stay in Activity with their mark (reason `one-strip-at-a-time`);
- a candidate that went **stale**, whose World was **muted** meanwhile, or whose **originating context** the user is now
  in gets that answer instead — nothing is shown merely because it once waited;
- a candidate that is **still** deferred (the user left the Analysis but the call continues) keeps waiting.

| Model case | Waited | After leaving | Strip |
|---|---|---|---|
| X1 | a Shared reply | strip | the Shared reply |
| X2 | Shared, Public, Introduction, Proactive | one strip; Public and Introduction stay in Activity; the Proactive note is in place (its own Conversation) | the Shared reply (longest-waiting) |
| X3 | a Shared reply (World muted meanwhile), a vanished target, a Proactive note | Activity · stale · in place | none |
| X4 | a Shared reply, and the call continues | still deferred | none |

In the prototype the exit is G3's own «المحادثة» control (`back()` → `releaseDeferred()`); the strip that follows uses
the **approved ordinary strip motion** (clip M10). No new motion language is created, and nothing animates inside the
Analysis, because nothing appears there.

## 4. The call-safe strip — the only two exceptions during a Live Call (refinement §8)

`model.isCallSafe()` admits exactly:

1. a **genuinely critical security / account event** (`kind: 'security'`, `critical: true`) — S17, S37;
2. an **exact-time reminder the user explicitly asked for** (`kind: 'reminder'`, `requested: true`) — S18, S38.

A reminder that was not requested, or a non-critical security notice, still waits (C-CALL-2m). Ordinary Shared,
Public, Introductions, Proactive QANDEEL and ordinary System / account attention wait during the call. In the
background during a call these two take the normal Push path (S20); everything else waits there too (S19). This is a
Product rule, not an OS level: it is not an Apple Critical Alert or an Android channel importance.

**What it is:** a small, non-blocking, transient strip in the same ASIDE material. **Dismiss only — no Direct Entry**
(accepted by the Product Owner). Its body is text; its one act is dismiss. Dismissing it dismisses only the transient
presentation: it does **not** resolve the source event and does **not** end the call. The item waits in Activity (the
security item stays actionable, with its mark), and the call continues exactly as it was (C-CALL-5; planted defect D28
gives it a Direct Entry and C-CALL-5 rejects it).

**What it is not:** a modal, a takeover, a full-screen interruption, a replacement for the call, a persistent Analysis
control, a new Activity entry in the Analysis, or an OS Critical Alert mapping. It never pulses or bounces, never uses
Living Brass as status, and never uses red.

**Where it lives:**

| Surface | Place | Why |
|---|---|---|
| Conversation, during a call (G1.2: the call continues) | under the upper chrome, as the ordinary strip, with the full sentence | the conversation content is not frozen; Call Rail A stays untouched at the bottom |
| **Analysis**, during a call (G3's own page, in a frame) | **inside the upper chrome row (y 47–95), from the Replay slot to 8 pt before «المحادثة»**, 44 pt tall; the short line only («تسجيل دخول جديد» / "New sign-in"; «كلّم العيادة، 4:00» / "Call the clinic, 4:00") | G3's world starts at y 95 and, in a call, is sized at its floor max(160, usable / 2) — at 320 × 568 PINNED it is 161 pt on a 160-pt floor (G3 closure §C.2). Anything laid over the world would take it below its floor. The chrome row is the only place that leaves the world intact |

**The Replay slot (accepted, final micro-refinement §8).** During an active Live Call, the two call-safe exceptions
may temporarily and intentionally occlude the Replay slot only. Temporary intentional Replay occlusion is the one
bounded exception; all other frozen Analysis controls and the world remain unobstructed. It is accepted because the
event is exceptional, the strip is transient, and Replay is neither destroyed nor moved (it is back the moment the strip
leaves). The Conversation ↔ Analysis switch («المحادثة»), the Call Rail and call line, the Timeline, Return Live, the
band and the Living Analysis world floor stay unobstructed — C-CALL-3 measures every one of them, and that the strip
does sit on Replay, on G3's own elements at 320, 390 and 430, Arabic and English (planted defect D27 moves the strip off
Replay into the world, and C-CALL-3 rejects it). If Replay takes keyboard focus under it, the strip steps aside at once,
so focus is never hidden (C-CALL-7). The geometry is **measured from G3's page** (`app.js chromeSlot()`), never assumed.

**No ordinary strip in the Analysis.** The first refinement pass let an ordinary strip use the same chrome-row place
outside a call (state `analysis-strip-shared`). That behaviour is **REJECTED** by the Product Owner and removed from the
prototype's states, the captures and the boards; it survives only as planted defect D24 (`?defect=analysisstrip`,
labelled REJECTED / PLANTED DEFECT — ORDINARY STRIP INSIDE ANALYSIS), which C-ANL-3m, C-FG-1 and C-ANL-3 reject.

## 5. Form (the ordinary strip)

- An **ASIDE** (B4R): anchored to the upper chrome, nonmodal, no scrim, the one Surface tone, radius 14 (the Replay
  menu's), inset 10 pt, starting 2 pt under the chrome's lower edge — it emerges from the chrome.
- Content: the source glyph (neutral), a meta line «source · الآن» (12 / 500 secondary), one sentence (15 / 400
  primary, two lines max, clamped), and a 44 × 44 dismiss (Hugeicons Free `close`, normalised to the P2 stroke).
- The whole body is **one button: the Direct Entry** into the originating context (revalidated at tap, D38).
- Speaker: a QANDEEL-authored strip speaks as QANDEEL; Shared / Public / Introductions / System are Product voice (D18).
- Importance is never colour: the System strip is the same material as the others; its words carry it.

## 6. Behaviour (`app.js` `showStrip` / `dismissStrip`; timings are *craft*)

| Phase | Standard | Reduced Motion |
|---|---|---|
| appear | opacity 0 → 1 and 10 pt down from the chrome (6 pt for the call-safe strip in the Analysis chrome row), 240 ms, ease-out `cubic-bezier(.23,1,.32,1)` | opacity only, 160 ms |
| readable hold | 6 s; **paused** while focus or a finger is on it; no countdown or progress | the same |
| dismiss (timeout or ×) | opacity 1 → 0 and back up into the chrome, 180 ms | opacity only, 140 ms |
| enter (press; ordinary strip only) | the strip leaves, then the originating context fades in (200 ms) | 120 ms |

No bounce (no momentum is involved), no pulse, no loop (C-STRIP-3 reads every frame of M02 and scans the page for
infinite animations; C-CALL-6 reads M08 / M08r). Exit follows the entry path (apple-design §7). Deferral inside the
Analysis has no motion at all: nothing appears.

## 7. Accessibility

The ordinary strip is a `role="region"` named «تنبيه» / "Alert"; the call-safe strip is named «تنبيه أثناء المكالمة» /
"Alert during your call", and its text says the call continues. One polite announcement through the page's single
persistent live region — never through the call's own live-status channel (G1.2); nothing is announced for ordinary
events during a call, and **nothing at all for ordinary events inside the Analysis** (no region, no announcement;
C-ANL-3 — the event is announced only if a strip follows on exit). Focus is never stolen; every button is named; the
strip is never the only carrier (the item is always in Activity).

## 8. Required families (boards 06, 14)

QANDEEL-authored (in a Shared World) · Shared (in the Personal Conversation) · System (new sign-in) · same-context
suppressed · **Analysis deferral (no strip)** · **exit from the Analysis: one strip / no strip** · Live-Call deferred
(Conversation and Analysis) · post-call presentation · English Light · call-safe critical security (Analysis 320 / 390
/ 430, Conversation) · call-safe requested reminder (Analysis 320 / 390, Conversation Light) · dismissed, call
continuing.
