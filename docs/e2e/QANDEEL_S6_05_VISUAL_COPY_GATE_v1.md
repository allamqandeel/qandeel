# QANDEEL — S6-05 Visual Gate and Copy Gate v1

**Task:** S6-05 — Mutual Match & Introduction World (Task Contract v1.0, D1–D7)  
**Checkpoint:** CP1 — Visual & Copy Approval Gate  
**Status:** **VISUAL GATE CLOSED — COPY GATE CLOSED** by the Product Owner on 2026-10-15 («S6-05 — CP1 Final Approval & CP2
Authorization»). Record: [S6-05 implementation record](QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md).

The visual package itself (16 phone mock-ups in Dark and Light, built only from the existing QANDEEL visual system) was
reviewed outside the repository as the CP1 package rev.2; rev.3 recorded this approval. This document is the
repository record of what was approved, so the mobile surfaces (CP5) implement exactly it.

## 1. The Product Owner's decisions

- **Visual Gate: CLOSED.** V-1 approved as shown in rev.2, all 16 screens, including the S15a / S15b split. V-1 is a
  structural identity with no new colour, token or component: one opening block with a 2px start-edge seam in the
  `primary` ink (the existing `selectedMarker` thickness) holding the name, the M-11 line, the fixed welcome and the
  note; the same seam marks the «بدأ التعارف» result at the existing large-title size, with the entry as the one primary
  action; the welcome carries no «قنديل» label; a separate «التعارف» section in «العالم المشترك»; tools are back and
  «إنهاء التعارف» only (D4). No Living Analysis.
- **Copy Gate: CLOSED.** Every Arabic and English text of rev.2 approved word for word, with one final correction, IW-03b
  (rev.3, the Product Owner's text verbatim). IW-22 is kept; M-12 is not used (R-2).
- **IW-35 display rule (approved):** shown only when the send itself answers with a server-confirmed ended state for this
  member's own World; a network error, a timeout or a 5xx never shows it. Any future `ENDED` answer is subject to a
  membership check and reveals nothing to anyone not entitled (CP2 authorization).

## 2. The approved copy (30 APPROVED rows; M-12 recorded as not used)

Arabic: simplified MSA, considerate of all genders. Reused rows already approved elsewhere (S6-04 proposals copy, Shared
World and common strings) are unchanged and not repeated here; `acceptNotYet` stays for production while the launch gate
is closed. M-01 stays not displayed; M-02 stays unused.

| ID | Location | Arabic | English | Status |
| --- | --- | --- | --- | --- |
| IW-01 | Accept action (Review, CANDIDATE) | الموافقة على بدء التعارف | Agree to begin the introduction | APPROVED |
| IW-02 | Confirmation heading | قبل بدء التعارف | Before the introduction begins | APPROVED |
| IW-03a | Confirmation | عند الموافقة، وإذا كان المقترح ما زال متاحًا، يبدأ التعارف فورًا في عالم مشترك خاص بكما. | If you agree and the proposal is still available, the introduction begins right away in a private Shared World for the two of you. | APPROVED |
| IW-03b rev.3 | Confirmation | عند بدء التعارف، لا يُعرض للطرف الآخر من ملفك سوى اسمك الأول للتعارف. | When the introduction begins, only your introduction first name is shown to the other person from your profile. | APPROVED (the Product Owner's final correction, verbatim) |
| IW-03c rev.2 | Confirmation | فيما عدا اسمك الأول للتعارف، تبقى بياناتك وتحليلاتك الخاصة محمية ولا تُشارَك. | Apart from your first name for Introductions, your private data and analysis stay protected and aren't shared. | APPROVED |
| IW-03d | Confirmation | يستطيع أيٌّ منكما إنهاء التعارف في أي وقت، دون ذكر سبب. | Either of you can end the introduction at any time, without giving a reason. | APPROVED |
| IW-04 | Confirm button | أوافق على بدء التعارف | I agree to begin the introduction | APPROVED |
| IW-05 | Result heading (second party) | بدأ التعارف | Your introduction has begun | APPROVED |
| IW-05b | Result body | تمّت الموافقة، وبدأ التعارف في عالم مشترك خاص بكما. | You've agreed, and your introduction has begun in a private Shared World for the two of you. | APPROVED |
| IW-06 | Entry link (result + MATCH_CONCLUDED card) | الدخول إلى عالم التعارف | Enter the introduction | APPROVED |
| IW-07 | Accept pending | جارٍ تسجيل موافقتك… | Recording your agreement… | APPROVED |
| IW-10 | Section heading in «العالم المشترك» | التعارف | Introductions | APPROVED |
| IW-11 | Card / World title | تعارف مع {الاسم الأول} | Introduction with {first name} | APPROVED |
| IW-11b | Title when no name is available | تعارف | Introduction | APPROVED |
| IW-12 | Ended card status | انتهى التعارف | Introduction ended | APPROVED |
| IW-21 | Card subtitle in «العالم المشترك» (rev.2: no longer used in the opening) | مساحة تعارف خاصة | A private introduction space | APPROVED |
| M-11 | Opening subtitle, under the name (both parties) | وافق الطرفان على التعارف. | You both agreed to the introduction. | APPROVED for display (LANG-01 editorial approval + this Copy Gate) |
| IW-22 rev.2 | Fixed welcome in the opening (client text, R-3) | مرحبًا بكما في مساحة التعارف. يمكنكما بدء الحديث على مهل، ولكل منكما حرية الاستمرار أو إنهاء التعارف في أي وقت. | Welcome to your introduction space. You can start talking at your own pace, and each of you is free to continue or to end the introduction at any time. | APPROVED (the Product Owner's text, verbatim; diacritics as given: «ولكل») |
| M-12 | The LANG-01 welcome | أهلًا بكما. أنا معكما في البداية، ولكلٍّ منكما حرية اختيار ما يشاركه ومتى. | Welcome, both of you. I'm with you at the start, and each of you is free to choose what to share, and when. | Not used (R-2): «أنا معكما» implies an active presence that D3 does not provide |
| IW-23 rev.2 | Note in the opening, under the welcome | هذه المساحة خاصة، ولا يردّ قنديل على الرسائل في هذه المرحلة. | This space is private, and QANDEEL doesn't reply to messages at this stage. | APPROVED (the literal option was not taken) |
| IW-24 | Composer accessibility label | رسالتك في هذا التعارف | Your message in this introduction | APPROVED |
| IW-26 | Header action | إنهاء التعارف | End introduction | APPROVED |
| IW-27 | END confirmation heading | إنهاء التعارف؟ | End the introduction? | APPROVED |
| IW-28a rev.2 | END confirmation | عند الإنهاء تتوقف المحادثة لكما معًا. بعدها يمكنك قراءة ما يبقى متاحًا لك من السجل، وحذف رسائلك أيضًا. | Ending stops the conversation for both of you. After that, you can read what remains available to you in the record, and delete your own messages. | APPROVED (each person reads per their own 0116 closed-view entitlement, after owner deletions; R-5) |
| IW-28b | END confirmation | لن يُطلب منك ذكر أي سبب، ولا يمكن التراجع عن الإنهاء. | You won't be asked for a reason, and ending can't be undone. | APPROVED |
| IW-28c | END confirmation | لن تُستأنف مقترحات التعارف تلقائيًا بعد الإنهاء. | Introduction proposals won't resume automatically after ending. | APPROVED (true today: PAUSED_POST_INTRODUCTION + explicit resume belong to S6-06) |
| IW-29 | END confirm button | إنهاء التعارف | End introduction | APPROVED |
| IW-30 | END running | جارٍ إنهاء التعارف… | Ending the introduction… | APPROVED |
| IW-31 | Closed-record banner | انتهى هذا التعارف. يمكنك قراءة ما كان متاحًا لك فقط. | This introduction has ended. You can only read what was available to you. | APPROVED (modelled on the approved endedNotice) |
| IW-32 | ALREADY_SETTLED | انتهى هذا التعارف بالفعل. | This introduction has already ended. | APPROVED |
| IW-35 rev.2 | Send refused after END: only on a server-confirmed ended state | انتهى التعارف، ولم تُرسل الرسالة. | The introduction has ended. The message wasn't sent. | APPROVED (text unchanged). Display rule: only when the send answers with the ended state for this member's own World. The proposed CP2 shape is an ENDED outcome returned only to one of the World's two humans after closure, with UNAVAILABLE for anyone else, so there is no oracle. A network error, a timeout, a 5xx or a plain UNAVAILABLE never shows IW-35 (S15a / S14). |
