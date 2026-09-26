# QANDEEL — I-08B3.1-G1.2
## Voice + Live Conversation Experience — Canonical Closure

**Status:** `I-08B3.1-G1.2 — CLOSED / FROZEN AS PRODUCT + INTERACTION + BACKGROUND-CALL PROOF`

**Independent review basis:** `I-08B3.1-G1.2-VOICE-LIVE-CONVERSATION-BACKGROUND-SAFE-PROOF`  
**Reviewed proof ZIP SHA-256:** `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`  
**Final bounded R1 correction ZIP SHA-256:** `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`

This record closes the G1.2 Product proof after independent review. It freezes the Product-facing
interaction model and the background-call requirement. It does **not** claim that a production Voice
runtime, provider, native call stack or durable Personal audio source already exists.

---

## 1. Frozen interaction model

Writing, Voice Note and Live Call are three ways of talking inside one Conversation.

- **Writing:** Conversation-first.
- **Voice Note:** Conversation-first.
- **Live Call:** Analysis-first when the call starts.
- Opening **«المحادثة»** during a Live Call does not end or replace the call.
- Returning to **«تحليل المحادثة»** returns to the same active call.
- Speaker-side geometry and the `UTTERANCE` role remain inherited from G1.1.

---

## 2. Frozen Live Call background contract

Once the reader deliberately starts a Live Call while QANDEEL is foregrounded:

- the call continues when the screen locks or auto-locks;
- the call continues when QANDEEL backgrounds;
- the call continues while another app is open;
- returning to QANDEEL restores the **last truthful in-call surface**, not a hardcoded reset;
- leaving from Analysis returns to Analysis;
- leaving from Conversation returns to Conversation;
- the same call identity and Conversation identity continue.

If the call actually ended while QANDEEL was away, the Product returns to a truthful ended/recovery
state and does not show live controls.

No survival is promised after explicit force-stop / force-quit or unrecoverable OS termination.

---

## 3. Shared World Product name — final G1.2 supersession

The Shared World Product-area name is now:

- Arabic: **«العالم المشترك»**
- English: **Shared World**

Both are stable **singular Product-area names regardless of count**.

The earlier G1.1/R3 proof wording:
- «مع الآخرين»
- count-dependent «عالم مشترك» / «عوالم مشتركة»
- “With others”
- count-dependent “Shared world” / “Shared worlds”

is superseded as Product-area naming.

A user may have zero, one or many Shared Worlds; that fact does not rename the Product area.

G1.1's closure record is amended accordingly.

---

## 4. Live Call visible-state correction

Ordinary call state is not expressed as persistent explanatory prose.

The Product must not keep visible normal-state sentences such as:

- «الميكروفون شغّال»
- «الميكروفون مكتوم»
- «قنديل بيتكلم»
- a redundant “call active” sentence

during normal call operation.

Normal call truth is carried through the call controls, elapsed continuity and the current proof
activity treatment, with semantic state preserved for assistive technology.

Visible explanatory wording remains appropriate for states that need explanation, including:

- connecting;
- reconnecting;
- connection failure;
- microphone permission blocked / denied;
- recovery or action-required states.

Final independent review also removed duplicate assistive announcements introduced by the visible-copy
reduction: call-state changes use one dedicated assistive live-status channel rather than announcing the
same state through two live regions.

---

## 5. Microphone permission rule

Microphone access is requested at the moment of explicit Voice Note / Live Call intent, not at app
launch.

QANDEEL's custom permission education is first-need / recovery only:

- permission already granted → proceed without repeating custom education;
- denied/revoked/blocked → explain the real issue and keep Writing available;
- OS-owned privacy indicators remain OS-owned and are never hidden or imitated.

---

## 6. Deliberately NOT frozen by G1.2

The following remain proof craft or later implementation work:

- current small icon/glyph shapes;
- final iconography system;
- current audio strip / waveform / activity morphology;
- final Voice visual language;
- final Voice / call strings that VI-01 leaves provisional;
- final audio provider / realtime transport;
- iOS / Android native call-stack implementation;
- exact speaker-route behavior across hardware changes;
- another-system-call hold/interruption UI;
- barge-in runtime semantics;
- Voice Note behavior when the app leaves the foreground;
- whether committed Voice Notes later gain a machine transcript;
- final call-history material representation;
- final QANDEEL spoken-reply control on ordinary text turns;
- system-call history / Recents privacy behavior.

The current icons and audio strip are **PROOF ONLY — NOT A VISUAL FREEZE**.

G2 still owns the final Living Analysis spectacle.

---

## 7. Real-device / production gates remain

G1.2 is not production certification.

Still required before launch:

- real iOS and Android background / lock / return validation;
- CallKit / Android Telecom integration validation;
- Bluetooth / headset and audio-route tests;
- other-call / interruption tests;
- Android ongoing-call notification and permission-state validation;
- VoiceOver / TalkBack validation;
- real microphone / output / latency / echo-cancellation testing;
- store-declaration review against the exact native implementation.

These are implementation / release gates and do not reopen this Product proof unless they expose a
Product contradiction.

---

## 8. Runtime residue — admitted to the canonical backlog

G1.2 found a genuine cross-task residue: the repository has no canonical Personal Voice / Live Call
runtime and no durable Personal original-audio source.

That residue is admitted as:

> `QAN-BL-VOICE-01 — Personal Voice / Live Call Runtime + Durable Audio Source — OPEN — UNASSIGNED`

This backlog entry owns no Product redesign. It preserves the future runtime / native / audio-source
work that G1.2 was explicitly forbidden to invent.

The existing Replay limitation remains: Personal original Live Call audio cannot become an audio-led
Replay source until a reviewed durable source exists.

---

## 9. Review evidence and bounded correction

The original G1.2 proof reported:

- 33/33 checks passing;
- 42/42 planted defects rejected;
- 13 motion recordings;
- standard / Reduced Motion parity;
- Arabic / English background-return proof;
- no production Voice runtime claim.

R1 was intentionally a bounded source correction rather than a second full render cycle.

Final independent source/build review after R1 verifies:

- Arabic Product-area name = **«العالم المشترك»**;
- English Product-area name = **Shared World** exactly;
- the singular name is stable regardless of count;
- persistent ordinary call-state prose is removed from the visible line;
- the same state remains available to assistive technology;
- the mute control exposes the correct action label;
- microphone education does not repeat when permission is already granted;
- background/restore logic is not reopened;
- iconography and audio-strip craft are not frozen;
- corrected prototype HTML rebuilds successfully from the patched source.

The original motion evidence remains the behavioral evidence of record. Its old Product-area wording
and old persistent normal-call text are superseded by R1.

---

## 10. Closure

Independent Product / Design review finds no remaining G1.2 blocker.

> **I-08B3.1-G1.2 — CLOSED / FROZEN AS PRODUCT + INTERACTION + BACKGROUND-CALL PROOF**

Production Voice runtime truth remains open and is not implied by this closure.

The next G task may proceed without rerunning the full G1.2 render package.
