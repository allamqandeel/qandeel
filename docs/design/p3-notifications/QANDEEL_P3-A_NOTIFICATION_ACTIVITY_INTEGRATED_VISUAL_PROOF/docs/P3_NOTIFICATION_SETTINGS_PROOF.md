# P3-A — General Settings → Notifications & Activity (proof)

**Status:** `P3-A EVIDENCE — NOT FROZEN`. Evidence: boards 07 (Arabic) and 08 (English), 12 (Quiet Hours / Snooze),
15 (320 pt).

## 1. Location (P3-G)

General Settings (P1 §8: the one destination; the proof draws P1 §8.1's groups in placement order, with proof copy)
→ **«الإشعارات والنشاط» / Notifications & Activity**. Also reachable from the Activity page's settings button. Where
General Settings itself is entered in the shell is **not** decided here (P2 §11 / P4).

## 2. Sections, in order — organised by Product meaning (D33), not by channel

| Section | Controls | Rules realized |
|---|---|---|
| (only if the OS permission is not granted) | one plain line: «إشعارات قنديل متوقفة على هذا الجهاز. سيظل النشاط يظهر داخل التطبيق.» | D50: the OS boundary is stated, never overridden; Activity keeps working |
| «قنديل يبادر معايا» / Qandeel reaching out | one choice: «سماح» / «أقل» / «إيقاف» (Allow / Reduce / Off), a radiogroup with E1R SELECTED; a line saying memory, understanding and analysis are unaffected | D35. **"Reduce" is a proof interpretation**: interrupt only for Timely (Class 2) reasons — open question 4 |
| «العالم المشترك» | «تنبيهات العالم المشترك» switch; then one row per World with its state («رحلة الصيف — مفعّل», «فريق العمل — مكتوم») | D34: muting one World mutes no other (S9) |
| «العالم العام» | «الردود والتفاعل معك» (on); «اكتشافات من العالم العام» (**off**: opt-in) with «اختياري — مرة في الأسبوع على الأكثر» | D03, D25, P3-P |
| «التعارف» — **only once the capability is entered** | «تنبيهات التعارف» switch; the line that the Lock Screen will not reveal Introductions | D26; board 07 shows the page without it |
| «الأمان والحساب» | a **statement**, not a switch: important security alerts always reach you, even during Quiet Hours, and cannot override the device; «تحديثات الحساب الأخرى» switch | D27, D36: critical is distinguished by words and by having no off switch — never by red |
| «ساعات الهدوء» | switch (ON by default); «من 23:00 إلى 08:00» (editable row); the two exceptions and "reviewed in the morning, not all at once" | D06, D37, P3-L, P3-M |
| «إيقاف مؤقت» / Snooze | «ساعة» · «8 ساعات» · «24 ساعة» · «مدة أخرى» (1 h / 8 h / 24 h / Custom) | D37: interruption only |
| «معاينات شاشة القفل» | one row per subject (Qandeel, Shared, Public, Discoveries, Introductions, Reminders, Security) with its ceiling in human words; a chooser sheet of four levels | D14–D17 (P3_PRIVACY_DISCLOSURE_PROOF.md) |
| «إعدادات إشعارات الجهاز» / Device Notification Settings | a separate handoff row; "Sound, alert style and the Lock Screen are controlled by your device" | QANDEEL does not fake ownership of OS alert style, sound, channel importance or the OS Lock Screen |

Time is shown as `23:00` / `08:00` (24-hour, Western digits, the locale authority the shell already uses); the order
reads «من … إلى …» in Arabic and "… to …" in English.

## 3. What the page never does

No quota meter, no "n left today", no counts of interruptions, no per-channel list, no toggle for critical security,
no switch that implies turning off QANDEEL's understanding, no Introductions controls before the capability exists.

## 4. Controls, semantics and targets

Switches are native buttons with `role="switch"` and `aria-checked`; the ON state moves the knob to the END edge and
fills the track (position + fill, not colour alone). Every row is ≥ 52 pt tall, every target ≥ 44 pt (C-A11Y-3,
including 320 pt).
