# P3-A — Contextual notification permission education (proof)

**Status:** `P3-A EVIDENCE — NOT FROZEN`. Evidence: board 09, clips M05 / M05r, checks C-PERM-1…4.

## 1. When (P3-D / P3-Z; I-08N D50)

- **Never at first launch** (planted defect D4 — a launch popup — is rejected by C-PERM-1).
- Only at a legitimate moment with clear notification value, and only while the OS permission has **not yet been
  requested**. The proof shows two: the first entry into a Shared experience (the board and M05) and choosing «سماح»
  for Proactive QANDEEL in settings. Entering / enabling Introductions is the third named moment.
- After «مش دلوقتي», QANDEEL does not ask again by itself. A new request is appropriate only in a new legitimate
  context or when the user goes to settings (D50; C-PERM-3).

## 2. The education surface

A PASSAGE (modal bottom sheet, the one Surface tone, the one scrim), because it asks for a genuine decision. Focus
moves to its heading; Escape means "Not now".

| | Arabic (Product Owner direction, used as given) | English (proof equivalent) |
|---|---|---|
| title | «خليني أوصلك لما يكون في حاجة تستاهل» | Let me reach you when it's worth it |
| body | «مش هبعتلك علشان أرجعك للتطبيق وخلاص. هستخدم الإشعارات لما يكون في سبب له قيمة ليك، وتقدر تقللها أو توقفها في أي وقت.» | I won't notify you just to pull you back into the app. I'll use notifications when there's a reason that matters to you, and you can reduce or turn them off anytime. |
| primary | «السماح بالإشعارات» | Allow notifications |
| secondary | «مش دلوقتي» | Not now |

Actions are the canon's text buttons (primary ink / rest ink), as the frozen Matching proposal draws its acts. No
fear, guilt or implication that the Product needs permission to work. The copy speaks as QANDEEL (first person); the
real product follows the user's own dialect profile (I-08N D18A).

## 3. The boundary (P3-C)

«السماح بالإشعارات» hands over to the **platform-owned** prompt. The proof does not draw it: it shows a dashed,
labelled schematic `PLATFORM-OWNED · iOS / ANDROID · NOT DRAWN` («يسألك النظام الآن»). On iOS the first request is the
only system prompt; on Android 13+ POST_NOTIFICATIONS is requested at a moment the app chooses (P3_PLATFORM_REFERENCE_GATE.md).

## 4. After the answer

- **Granted:** Push becomes possible within every rule of the model.
- **Denied, or Not now:** Push is unavailable; event truth, eligibility, Activity, the mark and the strip all keep
  working (S6; C-PERM-4). Settings state it once, plainly, with the device handoff.
- **Apple provisional authorization** is recorded as a future platform option only. It is **not** adopted.
