# QANDEEL — S6-06 Visual Gate and Copy Gate v1

**Task:** S6-06 — Progressive Disclosure, Photos, SUCCESS & Reactivation (Task Contract v1.0, WP0 v1.1 and its
five-point correction, approved 2026-10-16)  
**Checkpoint:** CP1 — Secure Backend & Media (the gates are presented in CP1, before any user-interface code); implemented in
CP2 — Mobile, end-to-end and closure  
**Status:** **VISUAL GATE CLOSED — COPY GATE CLOSED — 74 / 74 APPROVED; D-04 DECIDED (12 / 48 / 1600)** (Product Owner,
2026-10-17: «S6-06 — اعتماد Copy Gate», §4, then «S6-06 — اعتماد البوابات وبدء CP2», §5). The approved screens and wording are
implemented in CP2 and verified by CP2's own tests; no separate test cycle or corrective task is opened for them. Record:
[S6-06 implementation record](QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md).

The visual package itself (CP1 rev.1, then rev.2 of 2026-10-17 with one state per screen, P14 «غير متاح الآن» and the
full-name entry screens: phone mock-ups P0–P16 in Arabic and English, RTL / LTR, Dark and Light, at two
phone sizes, built only from the existing QANDEEL visual system, with the real blur samples embedded) is reviewed outside
the repository, as S6-05's was. This document is the repository record of what was presented, so the decision can be
recorded against it word for word.

## 1. What is asked

1. **D-04 — the blur values.** One value per stage, chosen from the real samples in §2. **DECIDED 2026-10-17: strong
   12 px, medium 48 px, clear 1600 px**, the proposed values unchanged (they are the pipeline's current values).
2. **Visual Gate.** **CLOSED 2026-10-17: rev.2 APPROVED, P0 – P16** (§5). The screens P0–P16: the one new header action in the live Introduction World (P0, D-12; V-1 is
   otherwise unchanged), the sharing panel and its sheets, the three-stage photo, deletion and removal, SUCCESS (not
   shown in production before Stage 8A), the status line and resume, the display-name consent in the World (P15) and the
   new Settings page «ما شاركته في التعارف» (P16, reachable in every state: live, after END and after SUCCESS).
3. **Copy Gate.** The 74 rows of §3, word for word in both languages. **CLOSED 2026-10-17: 74 / 74 APPROVED** (§4).

## 2. The blur samples (D-04)

Produced by the API's own pipeline (`apps/api/src/introductions-disclosure/introduction-image.pipeline.ts`) from three
**synthetic, drawn** images (no real person, no user photo), 2400×3000 with planted EXIF and GPS. Every rendition is the
exact bytes that would be sent. Laplacian energy is measured on a common 256×320 grid; "checker σ" is the standard
deviation of a 4 px checkerboard patch on the output (the source's is 83.6 / 87.0 / 18.5).

| Image | Candidate | Size | Bytes | EXIF | Laplacian | Checker σ |
| --- | --- | --- | ---: | --- | ---: | ---: |
| warm | strong-8 | 480×640 | 3.7 KB | NONE | 2.53 | 1.63 |
| warm | strong-12 | 533×640 | 5.1 KB | NONE | 2.5 | 4.12 |
| warm | strong-16 | 520×640 | 5.4 KB | NONE | 2.55 | 3.81 |
| warm | medium-32 | 520×640 | 6.9 KB | NONE | 2.81 | 13.44 |
| warm | medium-48 | 507×640 | 7.5 KB | NONE | 3.57 | 14.22 |
| warm | medium-64 | 510×640 | 7.9 KB | NONE | 4.53 | 13.8 |
| warm | clear-1280 | 1024×1280 | 35.7 KB | NONE | 706.45 | 60.89 |
| warm | clear-1600 | 1280×1600 | 46.3 KB | NONE | 653.2 | 62.27 |
| warm | clear-2048 | 1638×2048 | 65.7 KB | NONE | 681.77 | 64.61 |
| warm | source | 2400×3000 | 154.2 KB | PRESENT | 622.33 | 83.59 |
| sky | strong-8 | 480×640 | 4.7 KB | NONE | 3.09 | 4.73 |
| sky | strong-12 | 533×640 | 6.0 KB | NONE | 2.82 | 6.9 |
| sky | strong-16 | 520×640 | 6.3 KB | NONE | 2.93 | 8.64 |
| sky | medium-32 | 520×640 | 7.9 KB | NONE | 2.99 | 10.05 |
| sky | medium-48 | 507×640 | 8.5 KB | NONE | 3.82 | 8.19 |
| sky | medium-64 | 510×640 | 8.9 KB | NONE | 4.94 | 7.65 |
| sky | clear-1280 | 1024×1280 | 42.2 KB | NONE | 792.01 | 62.53 |
| sky | clear-1600 | 1280×1600 | 55.0 KB | NONE | 730.96 | 64.42 |
| sky | clear-2048 | 1638×2048 | 76.8 KB | NONE | 763.8 | 66.9 |
| sky | source | 2400×3000 | 179.9 KB | PRESENT | 700.49 | 87 |
| night | strong-8 | 480×640 | 5.4 KB | NONE | 3.54 | 12.66 |
| night | strong-12 | 533×640 | 6.6 KB | NONE | 3.46 | 18.6 |
| night | strong-16 | 520×640 | 6.6 KB | NONE | 3.49 | 20.29 |
| night | medium-32 | 520×640 | 8.6 KB | NONE | 3.98 | 27.31 |
| night | medium-48 | 507×640 | 8.6 KB | NONE | 5.06 | 28.05 |
| night | medium-64 | 510×640 | 8.6 KB | NONE | 6.91 | 27.47 |
| night | clear-1280 | 1024×1280 | 34.1 KB | NONE | 843.76 | 15.79 |
| night | clear-1600 | 1280×1600 | 44.0 KB | NONE | 757.53 | 13.12 |
| night | clear-2048 | 1638×2048 | 62.0 KB | NONE | 793.48 | 16.18 |
| night | source | 2400×3000 | 152.8 KB | PRESENT | 713.87 | 18.5 |

**What the numbers show:** no rendition carries EXIF (the source does); Laplacian energy is strictly strong < medium <
clear on every image; the strong stage flattens the fine pattern. **What they do not show (PD-21b):** blur reduces the
information sent - a strong stage carries at most `sampleEdge × sampleEdge` colour samples - but it does **not** make
anyone unrecognisable. On the samples, the silhouette, colours and the glasses are recognisable at medium 48 px. The
decision is the Product Owner's. **Decided 2026-10-17: 12 / 48 / 1600, unchanged.**

## 3. The copy (74 rows, all APPROVED 2026-10-17)

WP0 v1.1 carried 68 rows; rev.1 adds PD-00 (the header action, P0) and PD-79 … PD-83 (the Settings page and the iOS
Photos purpose string), and corrects PD-26b and PD-31 so that deletion no longer implies removing what the other person
already saw or kept (correction 5). Reused rows (Back, Cancel, Try again, «تعذّر ذلك الآن.», «هذا غير متاح الآن.», «جارٍ
الفتح», offline, «متابعة», the IW-* rows, «الخصوصية والبيانات») are already approved and are not repeated. The table below is the approved wording; §4 records each row the decision
changed and its earlier wording.

| ID | Location | Arabic | English | Status |
| --- | --- | --- | --- | --- |
| PD-00 | Header action in the live Introduction World (D-12) | المشاركة | Sharing | APPROVED — NEW in rev.1 (C-1) |
| PD-01 | Sharing panel title | مشاركاتك في التعارف | What you share | APPROVED — Arabic: the gender-neutral wording (G, LANG-01); English shortened in rev.1 so the header title is not cut at 360 dp (C-6) |
| PD-02 | Sharing panel lead | المشاركة باختيارك: ماذا ومتى. ولا تُلزم الطرف الآخر بشيء. | You choose what to share and when. Sharing asks nothing of the other person. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-03 | Section: mine | مشاركاتي | What I shared | APPROVED — Arabic: changed by the Product Owner (C-8) |
| PD-04 | Section: theirs | مشاركات {الاسم} | What {name} shared | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-05 | Empty section | لا توجد مشاركات بعد. | Nothing shared yet. | APPROVED |
| PD-06 | Primary action / type sheet title | مشاركة معلومة | Share something | APPROVED |
| PD-07 | Type | الاسم الكامل | Full name | APPROVED |
| PD-08 | Type | وسيلة تواصل | A way to reach you | APPROVED |
| PD-09 | Type | معلومة شخصية | Something personal | APPROVED |
| PD-10 | Type | صورة | Photo | APPROVED |
| PD-11 | Preview heading | هكذا ستظهر لـ{الاسم} | This is what {name} will see | APPROVED |
| PD-12 | Confirm button | مشاركة الآن | Share now | APPROVED |
| PD-13 | Confirm note | يمكنك حذفها لاحقًا، لكن لا يمكن التحكم فيما رآه الطرف الآخر أو احتفظ به. | You can delete it later, but not what the other person has already seen or kept. | APPROVED |
| PD-14 | Dismiss | ليس الآن | Not now | APPROVED |
| PD-15 | Gate closed (NOT_AVAILABLE_NOW) | المشاركة غير متاحة الآن. | Sharing isn't available right now. | APPROVED |
| PD-16 | Contact method hint | رقم أو بريد أو أي وسيلة من اختيارك. | A number, an email, or any way you choose. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-17 | Contact refused in name / personal field (D-10) | وسيلة التواصل تُشارَك من خيار «وسيلة تواصل». | To share a way to reach you, use "A way to reach you". | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-18 | Home town hint (D-11) | المدينة فقط، دون عنوان. | City only, no address. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-19a | Personal field key work_field | مجال العمل | Field of work | APPROVED |
| PD-19b | Personal field key education | الدراسة | Education | APPROVED |
| PD-19c | Personal field key hometown_city | المدينة التي نشأت فيها | Home town | APPROVED |
| PD-19d | Personal field key about_me | عني | About me | APPROVED |
| PD-20 | Photo action | اختيار صورة | Choose a photo | APPROVED |
| PD-21 | Photo explanation | تظهر صورتك على ثلاث مراحل: تشويش قوي، ثم متوسط، ثم واضحة. كل مرحلة بموافقة جديدة منك. | Your photo is shown in three steps: strongly blurred, then less blurred, then clear. Each step needs your new approval. | APPROVED |
| PD-21b | Blur limit (always shown with PD-21) | التشويش يخفي التفاصيل، لكنه قد لا يمنع من يعرفك من التعرّف عليك. | Blur hides detail, but someone who knows you may still recognise you. | APPROVED — approved with D-04 (C-5) |
| PD-22a | Stage name | تشويش قوي | Strong blur | APPROVED |
| PD-22b | Stage name | تشويش متوسط | Medium blur | APPROVED |
| PD-22c | Stage name | صورة واضحة | Clear photo | APPROVED |
| PD-23 | Stage share button | مشاركة: {المرحلة} | Share: {stage} | APPROVED |
| PD-24 | Locked next stage | تُتاح المرحلة التالية بعد مشاركة هذه. | The next step opens after you share this one. | APPROVED |
| PD-25 | Before stage 1 only | تغيير الصورة | Change photo | APPROVED |
| PD-26 | Remove action | إزالة الصورة | Remove photo | APPROVED |
| PD-26b | Remove confirmation (rev.1 correction) | إزالة الصورة؟ ستُحذف كل مراحلها التي شاركتها من هذا التعارف، ولن يكون بإمكان {الاسم} فتحها بعد الآن. لا يشمل ذلك ما سبق أن رآه الطرف الآخر أو احتفظ به. | Remove this photo? Every step you shared will be deleted from this introduction, and {name} won't be able to open it anymore. This doesn't cover what they already saw or kept. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01); English: "introduction" in lower case (C-7); the rev.1 deletion correction kept (C-3) |
| PD-27 | Photo refused | تعذّر استخدام هذه الصورة. يمكن اختيار صورة أخرى (JPEG أو PNG أو WebP، حتى 10 ميجابايت). | This photo can't be used. Choose another (JPEG, PNG or WebP, up to 10 MB). | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-28 | Photo processing | جارٍ تجهيز الصورة… | Preparing your photo… | APPROVED |
| PD-29 | A new photo after a removed one | يمكنك مشاركة صورة جديدة. تبدأ من التشويش القوي، وكل مرحلة بموافقة جديدة. | You can share a new photo. It starts strongly blurred, and each step needs your new approval. | APPROVED |
| PD-29b | Retired series | لا يمكن متابعة هذه الصورة بعد حذف إحدى مراحلها. | This photo can't continue after one of its steps was deleted. | APPROVED |
| PD-30 | Delete action | حذف | Delete | APPROVED |
| PD-31 | Delete confirmation (rev.1 correction) | حذف هذه المشاركة؟ ستُحذف من هذا التعارف ولن تظهر لـ{الاسم} بعد الآن. لا يشمل ذلك ما سبق أن رآه الطرف الآخر أو احتفظ به. | Delete this? It will be deleted from this introduction and {name} won't see it anymore. This doesn't cover what they already saw or kept. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01); English: "introduction" in lower case (C-7); the rev.1 deletion correction kept (C-3) |
| PD-32 | Retry of a deleted share (DELETED) | حُذفت هذه المشاركة. ويمكن مشاركتها من جديد في مشاركة جديدة. | This was deleted. To share again, start a new share. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-40 | SUCCESS card title (never shown before Stage 8A) | الاستمرار في عالم مشترك | Continue as a Shared World | APPROVED — SUCCESS copy approved now; never shown to a user before Stage 8A (C-4) |
| PD-41 | SUCCESS card body | اقترح قنديل أن يستمر هذا التعارف عالمًا مشتركًا. لا يحدث ذلك إلا بموافقتكما معًا، ويمكنك سحب موافقتك قبل اكتماله. | QANDEEL suggested continuing this introduction as a Shared World. It happens only if you both agree, and you can withdraw before it's complete. | APPROVED — English: "introduction" in lower case (C-7); SUCCESS copy approved now; never shown to a user before Stage 8A (C-4) |
| PD-42 | Approve | أوافق على الاستمرار | I agree to continue | APPROVED — SUCCESS copy approved now; never shown to a user before Stage 8A (C-4) |
| PD-43 | Approved state | وافقت. يمكنك سحب موافقتك ما لم يكتمل الانتقال. | You agreed. You can withdraw until it's complete. | APPROVED — SUCCESS copy approved now; never shown to a user before Stage 8A (C-4); nothing is ever said about the other person's decision |
| PD-44 | Withdraw | سحب موافقتي | Withdraw my agreement | APPROVED — SUCCESS copy approved now; never shown to a user before Stage 8A (C-4) |
| PD-45 | Completed | أصبح هذا عالمًا مشتركًا. | This is now a Shared World. | APPROVED — SUCCESS copy approved now; never shown to a user before Stage 8A (C-4); carries no relationship meaning |
| PD-46 | Hand-off to the Standard World | فتح العالم المشترك | Open the Shared World | APPROVED — SUCCESS copy approved now; never shown to a user before Stage 8A (C-4) |
| PD-47 | CHANGED | تغيّر شيء. يمكنك المحاولة مرة أخرى. | Something changed. Try again. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01); SUCCESS copy approved now; never shown to a user before Stage 8A (C-4) |
| PD-50 | Status line title (Introductions surface) | حالة التعارف | Introductions status | APPROVED |
| PD-51 | ACTIVE_INTRODUCTION | التعارف متوقف أثناء تعارفك الحالي. | Introductions are paused during your current introduction. | APPROVED — English: "introduction" in lower case (C-7) |
| PD-52 | POST_INTRODUCTION | التعارف متوقف منذ انتهاء تعارفك الأخير. | Introductions are paused since your last introduction ended. | APPROVED — English: "introduction" in lower case (C-7) |
| PD-53 | POST_SUCCESS | التعارف متوقف منذ أن استمر تعارفك عالمًا مشتركًا. | Introductions are paused since your introduction continued as a Shared World. | APPROVED — English: "introduction" in lower case (C-7) |
| PD-54 | OFF | التعارف متوقف باختيارك. | Introductions are off, by your choice. | APPROVED |
| PD-55 | Resume (RESUME) | استئناف التعارف | Resume Introductions | APPROVED |
| PD-56 | Turn on (ACTIVATE) | تشغيل التعارف | Turn on Introductions | APPROVED |
| PD-57 | Resume note | لن يعود أي اقتراح سابق، وسيتحقق قنديل من إعدادك الحالي أولًا. | No earlier suggestion comes back, and QANDEEL checks your current setup first. | APPROVED |
| PD-58 | NOT_ELIGIBLE | يحتاج إعدادك إلى مراجعة قبل الاستئناف. | Your setup needs a review before resuming. | APPROVED |
| PD-59 | Gate closed | الاستئناف غير متاح الآن. | Resuming isn't available right now. | APPROVED |
| PD-60 | Resumed | استُؤنف التعارف. | Introductions resumed. | APPROVED |
| PD-70 | Display name row | اسم العرض | Display name | APPROVED |
| PD-71 | Display name explanation | يظهر اسمك الأول لـ{الاسم}. ويمكنك اختيار إظهار اسمك الكامل الذي شاركته بدلًا منه، في هذا العالم فقط. | {name} sees your first name. You can choose to show the full name you shared instead, in this World only. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-72 | Grant | إظهار اسمي الكامل | Show my full name | APPROVED |
| PD-73 | Grant confirmation | سيظهر «{الاسم الكامل}» بدل اسمك الأول في هذا العالم. يمكنك الرجوع عن ذلك في أي وقت، لكن لا يمكن التحكم فيما رآه الطرف الآخر. | "{full name}" will appear instead of your first name in this World. You can undo this anytime, but not what the other person has already seen. | APPROVED |
| PD-74 | No FULL_NAME shared yet | إظهار اسمك الكامل يحتاج إلى مشاركته أولًا. | Share your full name first to be able to show it. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-75 | Granted state | يظهر اسمك الكامل في هذا العالم. | Your full name is shown in this World. | APPROVED |
| PD-76 | Revoke | الرجوع إلى اسمي الأول | Go back to my first name | APPROVED |
| PD-77 | Revoked | يظهر اسمك الأول من جديد. | Your first name is shown again. | APPROVED |
| PD-78 | A new FULL_NAME version | شاركت اسمًا كاملًا جديدًا. ولإظهاره بدل اسمك الأول يلزم اختيار ذلك من جديد. | You shared a new full name. To show it instead of your first name, choose that again. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01) |
| PD-79 | Settings → Privacy & Data row + page title (NEW) | ما شاركته في التعارف | What I shared in Introductions | APPROVED — NEW in rev.1 (C-2); kept as written (C-8) |
| PD-80 | Settings page lead (NEW) | هنا ما شاركته في كل تعارف، حتى بعد انتهائه أو استمراره عالمًا مشتركًا. يمكنك حذف أي مشاركة، والرجوع إلى اسمك الأول في أي وقت. | Here is what you shared in each introduction, even after it ended or continued as a Shared World. You can delete anything you shared, and go back to your first name at any time. | APPROVED — English: "introduction" in lower case (C-7); NEW in rev.1 (C-2) |
| PD-81 | Settings page empty (NEW) | لا توجد مشاركات لك في أي تعارف. | You haven't shared anything in any introduction. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01); English: "introduction" in lower case (C-7); NEW in rev.1 (C-2) |
| PD-82 | Settings page group heading per World (NEW) | مع {الاسم} | With {name} | APPROVED — NEW in rev.1 (C-2); {name}: the first name the server presents |
| PD-83 | iOS Photos purpose string (NSPhotoLibraryUsageDescription) | يستخدم قنديل الصورة المختارة فقط، لمشاركتها في تعارفك. | QANDEEL uses only the photo you choose, to share it in your introduction. | APPROVED — Arabic: the gender-neutral wording (G, LANG-01); English: "introduction" in lower case (C-7); NEW in rev.1 (C-2); the image picker does not normally show it (PHPicker); kept so the build stays valid |

## 4. The Product Owner's decision (2026-10-17)

«S6-06 — اعتماد Copy Gate»:

- The 74 rows of Copy Gate rev.2 are **approved**.
- **G — the 16 gender-neutral Arabic alternatives are approved**, under LANG-01 and VI-01 §3.6 (fixed Arabic copy
  addresses neither the reader nor a named person by one gender): PD-01, PD-02, PD-04, PD-16, PD-17, PD-18, PD-26b, PD-27,
  PD-31, PD-32, PD-47, PD-71, PD-74, PD-78, PD-81, PD-83.
- **PD-03 only** changes from «ما شاركتُه» to «مشاركاتي» (C-8); its English stays.
- **C-1 … C-8 are approved as recommended, with PD-79 kept as written:** C-1 PD-00 approved; C-2 PD-79 … PD-83 approved;
  C-3 the PD-26b / PD-31 correction kept (inside their G wording); C-4 the SUCCESS rows approved now; C-5 PD-21b approved
  with D-04; C-6 the shortened English PD-01 approved; C-7 lower case, matching the approved S6-05 copy; C-8 as above.
- **C-7, as applied:** one introduction (an instance) is written "introduction" mid-sentence, as the approved S6-05 rows
  write it («End introduction», «This introduction has ended»). The feature name "Introductions" keeps its capital, as the
  approved S6-01 / S6-04 rows write it («Enrolling in Introductions»), so PD-50, PD-51 ("Introductions are paused"),
  PD-55, PD-56 and PD-79 keep it. "Shared World" keeps its capitals.
- **SUCCESS (PD-40 … PD-47) is approved now and is never shown to a user before Stage 8A.**
- **D-04: 12 / 48 / 1600 px**, the proposed values, unchanged.
- These copy edits get no separate test cycle and no corrective task. They are recorded here, in S6-06, and
  implemented in CP2 under CP2's ordinary tests. CP1 and the closed tasks are not reopened, no new pull request is opened,
  and nothing is merged without the Product Owner's explicit approval.
- **Not decided by this message:** the Visual Gate (V-1 … V-6, screens P0–P16 of rev.2). It stayed PRESENTED until §5.

### Rows the decision changed (22)

| ID | Was (Arabic) | Was (English) | Approved (Arabic) | Approved (English) |
| --- | --- | --- | --- | --- |
| PD-01 | ما تشاركه في التعارف | (unchanged) | مشاركاتك في التعارف | (unchanged) |
| PD-02 | أنت تختار ما تشاركه ومتى. المشاركة لا تُلزم الطرف الآخر بشيء. | (unchanged) | المشاركة باختيارك: ماذا ومتى. ولا تُلزم الطرف الآخر بشيء. | (unchanged) |
| PD-03 | ما شاركتُه | (unchanged) | مشاركاتي | (unchanged) |
| PD-04 | ما شاركه {الاسم} | (unchanged) | مشاركات {الاسم} | (unchanged) |
| PD-16 | رقم أو بريد أو أي وسيلة تختارها. | (unchanged) | رقم أو بريد أو أي وسيلة من اختيارك. | (unchanged) |
| PD-17 | لمشاركة وسيلة تواصل استخدم «وسيلة تواصل». | (unchanged) | وسيلة التواصل تُشارَك من خيار «وسيلة تواصل». | (unchanged) |
| PD-18 | اكتب المدينة فقط، دون عنوان. | (unchanged) | المدينة فقط، دون عنوان. | (unchanged) |
| PD-26b | إزالة الصورة؟ ستُحذف كل مراحلها التي شاركتها من هذا التعارف، ولن يتمكن {الاسم} من فتحها بعد الآن. لا يشمل ذلك ما رآه أو احتفظ به قبل الحذف. | Remove this photo? Every step you shared will be deleted from this Introduction, and {name} won't be able to open it anymore. This doesn't cover what they already saw or kept. | إزالة الصورة؟ ستُحذف كل مراحلها التي شاركتها من هذا التعارف، ولن يكون بإمكان {الاسم} فتحها بعد الآن. لا يشمل ذلك ما سبق أن رآه الطرف الآخر أو احتفظ به. | Remove this photo? Every step you shared will be deleted from this introduction, and {name} won't be able to open it anymore. This doesn't cover what they already saw or kept. |
| PD-27 | تعذر استخدام هذه الصورة. اختر صورة أخرى (JPEG أو PNG أو WebP، حتى 10 ميجابايت). | (unchanged) | تعذّر استخدام هذه الصورة. يمكن اختيار صورة أخرى (JPEG أو PNG أو WebP، حتى 10 ميجابايت). | (unchanged) |
| PD-31 | حذف هذه المشاركة؟ ستُحذف من هذا التعارف ولن تظهر لـ{الاسم} بعد الآن. لا يشمل ذلك ما رآه أو احتفظ به قبل الحذف. | Delete this? It will be deleted from this Introduction and {name} won't see it anymore. This doesn't cover what they already saw or kept. | حذف هذه المشاركة؟ ستُحذف من هذا التعارف ولن تظهر لـ{الاسم} بعد الآن. لا يشمل ذلك ما سبق أن رآه الطرف الآخر أو احتفظ به. | Delete this? It will be deleted from this introduction and {name} won't see it anymore. This doesn't cover what they already saw or kept. |
| PD-32 | حُذفت هذه المشاركة. لمشاركتها من جديد ابدأ مشاركة جديدة. | (unchanged) | حُذفت هذه المشاركة. ويمكن مشاركتها من جديد في مشاركة جديدة. | (unchanged) |
| PD-41 | (unchanged) | QANDEEL suggested continuing this Introduction as a Shared World. It happens only if you both agree, and you can withdraw before it's complete. | (unchanged) | QANDEEL suggested continuing this introduction as a Shared World. It happens only if you both agree, and you can withdraw before it's complete. |
| PD-47 | تغيّر شيء. حاول مرة أخرى. | (unchanged) | تغيّر شيء. يمكنك المحاولة مرة أخرى. | (unchanged) |
| PD-51 | (unchanged) | Introductions are paused during your current Introduction. | (unchanged) | Introductions are paused during your current introduction. |
| PD-52 | (unchanged) | Introductions are paused since your last Introduction ended. | (unchanged) | Introductions are paused since your last introduction ended. |
| PD-53 | (unchanged) | Introductions are paused since your Introduction continued as a Shared World. | (unchanged) | Introductions are paused since your introduction continued as a Shared World. |
| PD-71 | يظهر اسمك الأول لـ{الاسم}. يمكنك أن تختار إظهار اسمك الكامل الذي شاركته بدلًا منه في هذا العالم فقط. | (unchanged) | يظهر اسمك الأول لـ{الاسم}. ويمكنك اختيار إظهار اسمك الكامل الذي شاركته بدلًا منه، في هذا العالم فقط. | (unchanged) |
| PD-74 | شارك اسمك الكامل أولًا لتتمكن من إظهاره. | (unchanged) | إظهار اسمك الكامل يحتاج إلى مشاركته أولًا. | (unchanged) |
| PD-78 | شاركت اسمًا كاملًا جديدًا. لإظهاره بدل اسمك الأول اختر ذلك من جديد. | (unchanged) | شاركت اسمًا كاملًا جديدًا. ولإظهاره بدل اسمك الأول يلزم اختيار ذلك من جديد. | (unchanged) |
| PD-80 | (unchanged) | Here is what you shared in each Introduction, even after it ended or continued as a Shared World. You can delete anything you shared, and go back to your first name at any time. | (unchanged) | Here is what you shared in each introduction, even after it ended or continued as a Shared World. You can delete anything you shared, and go back to your first name at any time. |
| PD-81 | لم تشارك شيئًا في أي تعارف. | You haven't shared anything in any Introduction. | لا توجد مشاركات لك في أي تعارف. | You haven't shared anything in any introduction. |
| PD-83 | يستخدم قنديل الصورة التي تختارها فقط، لمشاركتها في تعارفك. | QANDEEL uses only the photo you choose, to share it in your Introduction. | يستخدم قنديل الصورة المختارة فقط، لمشاركتها في تعارفك. | QANDEEL uses only the photo you choose, to share it in your introduction. |

## 5. The Visual Gate decision and CP2 (2026-10-17)

«S6-06 — اعتماد البوابات وبدء CP2»:

- **Visual Gate rev.2 is approved**, with its designs P0 – P16, the original blur values 12 / 48 / 1600, and the ✓ choice
  pattern for the personal keys (V-3).
- The Copy Gate is confirmed as in §4: the 74 rows, the 16 gender-neutral Arabic alternatives under LANG-01, PD-03
  «مشاركاتي», PD-79 kept, C-1 … C-8 as reviewed, and the SUCCESS rows approved and never shown before Stage 8A.
- CP2 starts inside S6-06 and PR #344: the mobile surfaces as designed; V-1 unchanged apart from the sharing action; the
  CP1 privacy limits and gates kept, CW2-08 not opened and no frozen engine changed; the picker's temporary files and the
  Android / iOS permissions as WP0 designed them; Arabic and English, RTL / LTR, Light and Dark, accessibility; focused
  tests for CP2's changes with the mandatory CI running normally; the approval record and the documents updated in the
  same work. No new pull request, no closed task reopened, no merge or deployment without the Product Owner's explicit
  approval.

### How the approved screens are built (CP2)

The screens are built from the existing parts and the canonical palette only — no new colour, token, type role or
component library. Four rendering details follow from that rule and are recorded here so the review can compare like with
like:

1. **Sheets (P2, P9a, P9b, P15b)** stand over the panel exactly as drawn, on the Field with the 24-point top radius. The
   mock-ups darkened the panel behind with a translucent scrim colour; no such colour exists in the canonical palette, so
   the panel behind recedes to 35 % opacity and is hidden from the screen reader while the sheet is open.
2. **The display-name line inside the full-name card (P1b)** is drawn as the P15 section under «مشاركاتي» (PD-70 with
   PD-71 / PD-75 / PD-78 and its action), as P15a – P15f show it. The reader's own first name is not part of the World's
   disclosure read, so the card cannot name it without a new server field.
3. **The Settings page title (P16b)** follows the existing Settings sub-page pattern (the statement-size heading inside the
   page, as «كلامك في عوالم مشتركة انتهت عضويتك فيها» does); the Settings header itself is unchanged.
4. **The loading ring (P1c, P5b)** is a 28-point ring in the tertiary ink that turns, and stays still under Reduced Motion;
   «جارٍ الفتح» / PD-28 are its accessible names.

