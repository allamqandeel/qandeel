# QANDEEL — S6-06 Visual Gate and Copy Gate v1

**Task:** S6-06 — Progressive Disclosure, Photos, SUCCESS & Reactivation (Task Contract v1.0, WP0 v1.1 and its
five-point correction, approved 2026-10-16)  
**Checkpoint:** CP1 — Secure Backend & Media (the gates are presented in CP1, before any user-interface code)  
**Status:** **PRESENTED — AWAITING THE PRODUCT OWNER'S EXPLICIT APPROVAL. Nothing below is approved.** Every row is
PROPOSED; every screen and every blur value is a candidate. No mobile surface is built until both gates are closed
(CP2). Record: [S6-06 implementation record](QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md).

The visual package itself (CP1 rev.1: phone mock-ups P0–P16 in Arabic and English, RTL / LTR, Dark and Light, at two
phone sizes, built only from the existing QANDEEL visual system, with the real blur samples embedded) is reviewed outside
the repository, as S6-05's was. This document is the repository record of what was presented, so the decision can be
recorded against it word for word.

## 1. What is asked

1. **D-04 — the blur values.** One value per stage, chosen from the real samples in §2. Proposed: strong 12 px, medium
   48 px, clear 1600 px (technical candidates only).
2. **Visual Gate.** The screens P0–P16: the one new header action in the live Introduction World (P0, D-12; V-1 is
   otherwise unchanged), the sharing panel and its sheets, the three-stage photo, deletion and removal, SUCCESS (not
   shown in production before Stage 8A), the status line and resume, the display-name consent in the World (P15) and the
   new Settings page «ما شاركته في التعارف» (P16, reachable in every state: live, after END and after SUCCESS).
3. **Copy Gate.** The 74 rows of §3, word for word in both languages.

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
decision is the Product Owner's.

## 3. The copy (74 rows, all PROPOSED)

WP0 v1.1 carried 68 rows; rev.1 adds PD-00 (the header action, P0) and PD-79 … PD-83 (the Settings page and the iOS
Photos purpose string), and corrects PD-26b and PD-31 so that deletion no longer implies removing what the other person
already saw or kept (correction 5). Reused rows (Back, Cancel, Try again, «تعذّر ذلك الآن.», «هذا غير متاح الآن.», «جارٍ
الفتح», offline, «متابعة», the IW-* rows, «الخصوصية والبيانات») are already approved and are not repeated.

| ID | Location | Arabic | English | Status |
| --- | --- | --- | --- | --- |
| PD-00 | Header action in the live Introduction World (D-12) | المشاركة | Sharing | PROPOSED — NEW in rev.1: the text action beside «إنهاء التعارف» |
| PD-01 | Sharing panel title | ما تشاركه في التعارف | What you share | PROPOSED — rev.1: English shortened so the header title is not cut at 360 dp (was: What you share in this Introduction) |
| PD-02 | Sharing panel lead | أنت تختار ما تشاركه ومتى. المشاركة لا تُلزم الطرف الآخر بشيء. | You choose what to share and when. Sharing asks nothing of the other person. | PROPOSED |
| PD-03 | Section: mine | ما شاركتُه | What I shared | PROPOSED |
| PD-04 | Section: theirs | ما شاركه {الاسم} | What {name} shared | PROPOSED |
| PD-05 | Empty section | لا توجد مشاركات بعد. | Nothing shared yet. | PROPOSED |
| PD-06 | Primary action / type sheet title | مشاركة معلومة | Share something | PROPOSED |
| PD-07 | Type | الاسم الكامل | Full name | PROPOSED |
| PD-08 | Type | وسيلة تواصل | A way to reach you | PROPOSED |
| PD-09 | Type | معلومة شخصية | Something personal | PROPOSED |
| PD-10 | Type | صورة | Photo | PROPOSED |
| PD-11 | Preview heading | هكذا ستظهر لـ{الاسم} | This is what {name} will see | PROPOSED |
| PD-12 | Confirm button | مشاركة الآن | Share now | PROPOSED |
| PD-13 | Confirm note | يمكنك حذفها لاحقًا، لكن لا يمكن التحكم فيما رآه الطرف الآخر أو احتفظ به. | You can delete it later, but not what the other person has already seen or kept. | PROPOSED |
| PD-14 | Dismiss | ليس الآن | Not now | PROPOSED |
| PD-15 | Gate closed (NOT_AVAILABLE_NOW) | المشاركة غير متاحة الآن. | Sharing isn't available right now. | PROPOSED |
| PD-16 | Contact method hint | رقم أو بريد أو أي وسيلة تختارها. | A number, an email, or any way you choose. | PROPOSED |
| PD-17 | Contact refused in name / personal field (D-10) | لمشاركة وسيلة تواصل استخدم «وسيلة تواصل». | To share a way to reach you, use "A way to reach you". | PROPOSED |
| PD-18 | Home town hint (D-11) | اكتب المدينة فقط، دون عنوان. | City only, no address. | PROPOSED |
| PD-19a | Personal field key work_field | مجال العمل | Field of work | PROPOSED |
| PD-19b | Personal field key education | الدراسة | Education | PROPOSED |
| PD-19c | Personal field key hometown_city | المدينة التي نشأت فيها | Home town | PROPOSED |
| PD-19d | Personal field key about_me | عني | About me | PROPOSED |
| PD-20 | Photo action | اختيار صورة | Choose a photo | PROPOSED |
| PD-21 | Photo explanation | تظهر صورتك على ثلاث مراحل: تشويش قوي، ثم متوسط، ثم واضحة. كل مرحلة بموافقة جديدة منك. | Your photo is shown in three steps: strongly blurred, then less blurred, then clear. Each step needs your new approval. | PROPOSED |
| PD-21b | Blur limit (always shown with PD-21) | التشويش يخفي التفاصيل، لكنه قد لا يمنع من يعرفك من التعرّف عليك. | Blur hides detail, but someone who knows you may still recognise you. | PROPOSED |
| PD-22a | Stage name | تشويش قوي | Strong blur | PROPOSED |
| PD-22b | Stage name | تشويش متوسط | Medium blur | PROPOSED |
| PD-22c | Stage name | صورة واضحة | Clear photo | PROPOSED |
| PD-23 | Stage share button | مشاركة: {المرحلة} | Share: {stage} | PROPOSED |
| PD-24 | Locked next stage | تُتاح المرحلة التالية بعد مشاركة هذه. | The next step opens after you share this one. | PROPOSED |
| PD-25 | Before stage 1 only | تغيير الصورة | Change photo | PROPOSED |
| PD-26 | Remove action | إزالة الصورة | Remove photo | PROPOSED |
| PD-26b | Remove confirmation (rev.1 correction) | إزالة الصورة؟ ستُحذف كل مراحلها التي شاركتها من هذا التعارف، ولن يتمكن {الاسم} من فتحها بعد الآن. لا يشمل ذلك ما رآه أو احتفظ به قبل الحذف. | Remove this photo? Every step you shared will be deleted from this Introduction, and {name} won't be able to open it anymore. This doesn't cover what they already saw or kept. | PROPOSED — Corrected: no longer implies removing what the other person saw or kept |
| PD-27 | Photo refused | تعذر استخدام هذه الصورة. اختر صورة أخرى (JPEG أو PNG أو WebP، حتى 10 ميجابايت). | This photo can't be used. Choose another (JPEG, PNG or WebP, up to 10 MB). | PROPOSED |
| PD-28 | Photo processing | جارٍ تجهيز الصورة… | Preparing your photo… | PROPOSED |
| PD-29 | A new photo after a removed one | يمكنك مشاركة صورة جديدة. تبدأ من التشويش القوي، وكل مرحلة بموافقة جديدة. | You can share a new photo. It starts strongly blurred, and each step needs your new approval. | PROPOSED |
| PD-29b | Retired series | لا يمكن متابعة هذه الصورة بعد حذف إحدى مراحلها. | This photo can't continue after one of its steps was deleted. | PROPOSED |
| PD-30 | Delete action | حذف | Delete | PROPOSED |
| PD-31 | Delete confirmation (rev.1 correction) | حذف هذه المشاركة؟ ستُحذف من هذا التعارف ولن تظهر لـ{الاسم} بعد الآن. لا يشمل ذلك ما رآه أو احتفظ به قبل الحذف. | Delete this? It will be deleted from this Introduction and {name} won't see it anymore. This doesn't cover what they already saw or kept. | PROPOSED — Corrected: no longer implies removing what the other person saw or kept |
| PD-32 | Retry of a deleted share (DELETED) | حُذفت هذه المشاركة. لمشاركتها من جديد ابدأ مشاركة جديدة. | This was deleted. To share again, start a new share. | PROPOSED |
| PD-40 | SUCCESS card title (never shown before Stage 8A) | الاستمرار في عالم مشترك | Continue as a Shared World | PROPOSED |
| PD-41 | SUCCESS card body | اقترح قنديل أن يستمر هذا التعارف عالمًا مشتركًا. لا يحدث ذلك إلا بموافقتكما معًا، ويمكنك سحب موافقتك قبل اكتماله. | QANDEEL suggested continuing this Introduction as a Shared World. It happens only if you both agree, and you can withdraw before it's complete. | PROPOSED — Shown only with a real transition version (Stage 8A) |
| PD-42 | Approve | أوافق على الاستمرار | I agree to continue | PROPOSED |
| PD-43 | Approved state | وافقت. يمكنك سحب موافقتك ما لم يكتمل الانتقال. | You agreed. You can withdraw until it's complete. | PROPOSED — Nothing is ever said about the other person's decision |
| PD-44 | Withdraw | سحب موافقتي | Withdraw my agreement | PROPOSED |
| PD-45 | Completed | أصبح هذا عالمًا مشتركًا. | This is now a Shared World. | PROPOSED — Carries no relationship meaning |
| PD-46 | Hand-off to the Standard World | فتح العالم المشترك | Open the Shared World | PROPOSED |
| PD-47 | CHANGED | تغيّر شيء. حاول مرة أخرى. | Something changed. Try again. | PROPOSED |
| PD-50 | Status line title (Introductions surface) | حالة التعارف | Introductions status | PROPOSED |
| PD-51 | ACTIVE_INTRODUCTION | التعارف متوقف أثناء تعارفك الحالي. | Introductions are paused during your current Introduction. | PROPOSED |
| PD-52 | POST_INTRODUCTION | التعارف متوقف منذ انتهاء تعارفك الأخير. | Introductions are paused since your last Introduction ended. | PROPOSED |
| PD-53 | POST_SUCCESS | التعارف متوقف منذ أن استمر تعارفك عالمًا مشتركًا. | Introductions are paused since your Introduction continued as a Shared World. | PROPOSED |
| PD-54 | OFF | التعارف متوقف باختيارك. | Introductions are off, by your choice. | PROPOSED |
| PD-55 | Resume (RESUME) | استئناف التعارف | Resume Introductions | PROPOSED |
| PD-56 | Turn on (ACTIVATE) | تشغيل التعارف | Turn on Introductions | PROPOSED |
| PD-57 | Resume note | لن يعود أي اقتراح سابق، وسيتحقق قنديل من إعدادك الحالي أولًا. | No earlier suggestion comes back, and QANDEEL checks your current setup first. | PROPOSED |
| PD-58 | NOT_ELIGIBLE | يحتاج إعدادك إلى مراجعة قبل الاستئناف. | Your setup needs a review before resuming. | PROPOSED |
| PD-59 | Gate closed | الاستئناف غير متاح الآن. | Resuming isn't available right now. | PROPOSED |
| PD-60 | Resumed | استُؤنف التعارف. | Introductions resumed. | PROPOSED |
| PD-70 | Display name row | اسم العرض | Display name | PROPOSED |
| PD-71 | Display name explanation | يظهر اسمك الأول لـ{الاسم}. يمكنك أن تختار إظهار اسمك الكامل الذي شاركته بدلًا منه في هذا العالم فقط. | {name} sees your first name. You can choose to show the full name you shared instead, in this World only. | PROPOSED |
| PD-72 | Grant | إظهار اسمي الكامل | Show my full name | PROPOSED |
| PD-73 | Grant confirmation | سيظهر «{الاسم الكامل}» بدل اسمك الأول في هذا العالم. يمكنك الرجوع عن ذلك في أي وقت، لكن لا يمكن التحكم فيما رآه الطرف الآخر. | "{full name}" will appear instead of your first name in this World. You can undo this anytime, but not what the other person has already seen. | PROPOSED |
| PD-74 | No FULL_NAME shared yet | شارك اسمك الكامل أولًا لتتمكن من إظهاره. | Share your full name first to be able to show it. | PROPOSED |
| PD-75 | Granted state | يظهر اسمك الكامل في هذا العالم. | Your full name is shown in this World. | PROPOSED |
| PD-76 | Revoke | الرجوع إلى اسمي الأول | Go back to my first name | PROPOSED |
| PD-77 | Revoked | يظهر اسمك الأول من جديد. | Your first name is shown again. | PROPOSED |
| PD-78 | A new FULL_NAME version | شاركت اسمًا كاملًا جديدًا. لإظهاره بدل اسمك الأول اختر ذلك من جديد. | You shared a new full name. To show it instead of your first name, choose that again. | PROPOSED |
| PD-79 | Settings → Privacy & Data row + page title (NEW) | ما شاركته في التعارف | What I shared in Introductions | PROPOSED — NEW in rev.1 (replaces the earlier draft «اسمك الكامل في التعارف») |
| PD-80 | Settings page lead (NEW) | هنا ما شاركته في كل تعارف، حتى بعد انتهائه أو استمراره عالمًا مشتركًا. يمكنك حذف أي مشاركة، والرجوع إلى اسمك الأول في أي وقت. | Here is what you shared in each Introduction, even after it ended or continued as a Shared World. You can delete anything you shared, and go back to your first name at any time. | PROPOSED — NEW in rev.1 |
| PD-81 | Settings page empty (NEW) | لم تشارك شيئًا في أي تعارف. | You haven't shared anything in any Introduction. | PROPOSED — NEW in rev.1 |
| PD-82 | Settings page group heading per World (NEW) | مع {الاسم} | With {name} | PROPOSED — NEW in rev.1. {name}: the first name the server presents |
| PD-83 | iOS Photos purpose string (NSPhotoLibraryUsageDescription) | يستخدم قنديل الصورة التي تختارها فقط، لمشاركتها في تعارفك. | QANDEEL uses only the photo you choose, to share it in your Introduction. | PROPOSED — NEW in rev.1. The image picker does not normally show it (PHPicker); kept so the build stays valid |
