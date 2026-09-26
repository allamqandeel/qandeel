# P3-A — Bilingual copy table (generated from `source/src/content.mjs` and `source/src/fixtures.mjs`)

**Status:** `P3-A PROOF COPY — NOT CANONICAL COPY` (refinement: a bounded cleanup of the important Product UI only).
Statuses: **APPROVED** = the Product Owner's exact accepted name or wording (for example the Lock Screen levels
«خاصة جدًا» / «إظهار النوع» / «إظهار السياق» / «إظهار المعاينة», accepted in the P3-A refinement §6); **CANON** = frozen by
an earlier record (source named); **DIRECTION** = the Product Owner's directional proof copy, used as given, not
automatically final; **PROOF** = written for this proof, reviewable, not final; **OPEN** = wording left as open craft;
**FIXTURE** = synthetic event text (second table), never Product copy.

Interface strings: 125. Rows with an APPROVED side: 16 · CANON: 20 · DIRECTION: 10 · OPEN: 2. Fixture strings: 63.

| key | Arabic | status | English | status | source |
|---|---|---|---|---|---|
| `product` | قنديل | CANON | Qandeel | CANON | VI-01 S01 · VI-01 S01 (proof casing, as P2-A) |
| `nav.label` | العوالم | CANON | Worlds | PROOF | G1.1 R3 landmark |
| `nav.items[0]` | قنديل | CANON | Qandeel | PROOF | G1.1 R3 / P2-A |
| `nav.items[1]` | العالم المشترك | CANON | Shared World | CANON | G1.2 §3 |
| `nav.items[2]` | العالم العام | CANON | Public world | PROOF | G1.1 R3 / P2-A |
| `door` | تحليل المحادثة | CANON | Conversation analysis | OPEN | G1.1 §1 · G1.1 §2 English label open |
| `replay` | إعادة عرض المحادثة | OPEN | Replay this conversation | PROOF | G3 handoff §7 open copy (kept from P2-A) |
| `composer` | كلامك هنا | CANON | Write here | PROOF | VI-01 A10 |
| `mute` | كتم الميكروفون | CANON | Mute microphone | PROOF | G1.2 R1 |
| `route` | السماعة الخارجية | PROOF | Speaker | PROOF | P2-A |
| `endCall` | إنهاء المكالمة | CANON | End call | PROOF | G1.2 R1 |
| `activity` | النشاط | APPROVED | Activity | APPROVED | P3-R · P3-R ("ACTIVITY"; title case in the interface) |
| `activityOpen` | فتح النشاط | PROOF | Open Activity | PROOF | — |
| `activityNew` | فيه جديد | PROOF | new items | PROOF | accessible state only |
| `activitySettings` | إعدادات الإشعارات والنشاط | PROOF | Notifications & Activity settings | PROOF | — |
| `back` | رجوع | PROOF | Back | PROOF | — |
| `filterGroup` | تصفية النشاط | PROOF | Filter Activity | PROOF | — |
| `filters.all` | الكل | APPROVED | All | APPROVED | P3-T |
| `filters.qandeel` | من قنديل | CANON | From Qandeel | CANON | I-08N-01 D30 |
| `filters.shared` | العالم المشترك | CANON | Shared | PROOF | G1.2 §3 · task §6 |
| `filters.public` | العالم العام | CANON | Public | PROOF | G1.1 R3 · task §6 |
| `filters.intro` | التعارف | CANON | Introductions | CANON | I-08A4 |
| `filters.system` | النظام | PROOF | System | PROOF | task §6 "System" · task §6 |
| `day.today` | اليوم | PROOF | Today | PROOF | — |
| `day.yesterday` | أمس | PROOF | Yesterday | PROOF | — |
| `day.earlier` | في وقت سابق | PROOF | Earlier | PROOF | — |
| `markNew` | جديد | PROOF | new | PROOF | accessible state |
| `markWaiting` | في انتظارك | PROOF | waiting for you | PROOF | accessible state |
| `stale` | لم يعد متاحًا | PROOF | No longer available | PROOF | — |
| `staleExplain` | ما كان هنا لم يعد متاحًا. لن نفتح مكانًا آخر بدلًا منه. | PROOF | What was here is no longer available. We won't open somewhere else instead. | PROOF | D39 |
| `staleOpen` | فتح {0} | PROOF | Open {0} | PROOF | — |
| `muted` | مكتوم | PROOF | Muted | PROOF | — |
| `empty` | مفيش حاجة هنا دلوقتي. | PROOF | Nothing here right now. | PROOF | — |
| `stripRegion` | تنبيه | PROOF | Alert | PROOF | — |
| `stripDismiss` | إغلاق التنبيه | PROOF | Dismiss | PROOF | — |
| `callSafeRegion` | تنبيه أثناء المكالمة | PROOF | Alert during your call | PROOF | refinement §8 |
| `callSafeOn` | المكالمة مستمرة | PROOF | your call continues | PROOF | refinement §8 (accessible state only) |
| `eduTitle` | خليني أوصلك لما يكون في حاجة تستاهل | DIRECTION | Let me reach you when it's worth it | PROOF | task §9 · English equivalent of the task §9 direction |
| `eduBody` | مش هبعتلك علشان أرجعك للتطبيق وخلاص. هستخدم الإشعارات لما يكون في سبب له قيمة ليك، وتقدر تقللها أو توقفها في أي وقت. | DIRECTION | I won't notify you just to pull you back into the app. I'll use notifications when there's a reason that matters to you, and you can reduce or turn them off anytime. | PROOF | task §9 · English equivalent of the task §9 direction |
| `eduAllow` | السماح بالإشعارات | DIRECTION | Allow notifications | PROOF | task §9 |
| `eduNotNow` | مش دلوقتي | DIRECTION | Not now | PROOF | task §9 |
| `osBoundary` | يسألك النظام الآن | PROOF | Your device asks next | PROOF | — |
| `osBoundaryNote` | نافذة الإذن يملكها iOS / Android، ولا يرسمها قنديل ولا يقلّدها. | PROOF | The permission prompt belongs to iOS / Android. Qandeel does not draw or imitate it. | PROOF | — |
| `notNowNote` | تمام. النشاط هيفضل يظهر هنا جوه التطبيق. | PROOF | Okay. Activity will keep showing here in the app. | PROOF | — |
| `settings` | الإعدادات | PROOF | Settings | PROOF | P1 §8 one General Settings destination |
| `groups[0]` | الحساب والهوية | PROOF | Account & Identity | PROOF | P1 §8.1 |
| `groups[1]` | الأمان وتسجيل الدخول | PROOF | Security & Login | PROOF | P1 §8.1 |
| `groups[2]` | قنديل والمحادثة | PROOF | Qandeel & Conversation | PROOF | P1 §8.1 |
| `groups[3]` | الإشعارات والنشاط | APPROVED | Notifications & Activity | APPROVED | P3-G |
| `groups[4]` | المظهر وإمكانية الوصول | PROOF | Appearance & Accessibility | PROOF | P1 §8.1 |
| `groups[5]` | الخصوصية والبيانات | PROOF | Privacy & Data | PROOF | P1 §8.1 |
| `groups[6]` | التعارف | PROOF | Introductions | PROOF | P1 §8.1 |
| `groups[7]` | الدعم والتطبيق | PROOF | Support & App | PROOF | P1 §8.1 |
| `notif` | الإشعارات والنشاط | APPROVED | Notifications & Activity | APPROVED | P3-G |
| `osOff` | إشعارات قنديل متوقفة على هذا الجهاز. سيظل النشاط يظهر داخل التطبيق. | PROOF | Notifications for Qandeel are off on this device. Activity still appears here in the app. | PROOF | — |
| `proactive` | قنديل يبادر معايا | DIRECTION | Qandeel reaching out | PROOF | task §12 · English equivalent of «قنديل يبادر معايا» |
| `proactiveOpts.allow` | سماح | DIRECTION | Allow | APPROVED | task §12 |
| `proactiveOpts.reduce` | أقل | DIRECTION | Reduce | APPROVED | task §12 |
| `proactiveOpts.off` | إيقاف | DIRECTION | Off | APPROVED | task §12 |
| `proactiveHelp` | ده بيتحكم في إن قنديل يبدأ معاك الكلام بس. ذاكرته وفهمه والتحليل بيفضلوا زي ما هم. | PROOF | This only controls when Qandeel starts a conversation with you. Memory, understanding and analysis stay the same. | PROOF | D35 |
| `proactiveOptHelp.allow` | قنديل يقدر يبدأ معاك الكلام لما يكون عنده سبب يستاهل. | PROOF | Qandeel can reach out when there's a good reason. | PROOF | — |
| `proactiveOptHelp.reduce` | قنديل هيقاطعك أقل، ومش هينبّهك غير للحاجات الأهم أو اللي وقتها ميستناش. | PROOF | Qandeel interrupts you less, and only for what matters most or can't wait. | PROOF | refinement §7 meaning |
| `proactiveOptHelp.off` | قنديل مش هيبدأ معاك الكلام من نفسه. تقدر تكلّمه وقت ما تحب. | PROOF | Qandeel won't start a conversation on its own. You can talk to it whenever you like. | PROOF | — |
| `sharedSec` | العالم المشترك | CANON | Shared World | CANON | — |
| `sharedAll` | تنبيهات العالم المشترك | PROOF | Shared World alerts | PROOF | — |
| `on` | مفعّل | PROOF | On | PROOF | — |
| `off` | متوقف | PROOF | Off | PROOF | — |
| `mutedWorld` | مكتوم | PROOF | Muted | PROOF | — |
| `publicSec` | العالم العام | CANON | Public World | PROOF | — |
| `publicInter` | الردود والتفاعل معك | PROOF | Replies and interactions with you | PROOF | — |
| `publicDisc` | اكتشافات من العالم العام | PROOF | Discoveries from the Public World | PROOF | — |
| `publicDiscHelp` | اختياري — مرة في الأسبوع على الأكثر | PROOF | Optional — at most once a week | PROOF | P3-P |
| `introSec` | التعارف | CANON | Introductions | CANON | — |
| `introOn` | تنبيهات التعارف | PROOF | Introduction alerts | PROOF | — |
| `introHelp` | افتراضيًا، لا تكشف شاشة القفل أن الإشعار عن التعارف. | PROOF | By default, the Lock Screen doesn't show that a notification is about Introductions. | PROOF | D15 default; the ceiling is the user's |
| `systemSec` | الأمان والحساب | PROOF | Security & Account | PROOF | — |
| `securityAlways` | تنبيهات الأمان المهمة تصلك دائمًا، حتى في ساعات الهدوء، ولا يمكنها تجاوز إعدادات جهازك. | PROOF | Important security alerts always reach you, even during Quiet Hours. They can't override your device settings. | PROOF | D36 |
| `systemOther` | تحديثات الحساب الأخرى | PROOF | Other account updates | PROOF | — |
| `quiet` | ساعات الهدوء | PROOF | Quiet Hours | PROOF | — |
| `quietOn` | تفعيل ساعات الهدوء | PROOF | Use Quiet Hours | PROOF | — |
| `quietRange` | من {0} إلى {1} | PROOF | {0} to {1} | PROOF | — |
| `quietHelp` | خلالها لا يصلك إلا تذكير طلبته في موعد محدد أو تنبيه أمان مهم. وما ينتظر يُراجَع في الصباح، ولا يصلك دفعة واحدة. | PROOF | Only reminders you set for an exact time and important security alerts come through. Everything else is reviewed in the morning, not sent all at once. | PROOF | D06; P3-M |
| `snooze` | إيقاف مؤقت | PROOF | Snooze | PROOF | task §12 |
| `snoozeOpts.1h` | ساعة | PROOF | 1 hour | APPROVED | — |
| `snoozeOpts.8h` | 8 ساعات | PROOF | 8 hours | APPROVED | — |
| `snoozeOpts.24h` | 24 ساعة | PROOF | 24 hours | APPROVED | — |
| `snoozeOpts.custom` | مدة أخرى | PROOF | Custom | APPROVED | — |
| `lockSec` | معاينات شاشة القفل | DIRECTION | Lock Screen previews | PROOF | task §10 |
| `lockHelp` | هذا حدّ أقصى: قد يُظهر قنديل تفاصيل أقل. | PROOF | This is a limit: Qandeel may show less. | PROOF | D17 |
| `levels.L0` | خاصة جدًا | APPROVED | Very private | APPROVED | refinement §6 |
| `levels.L1` | إظهار النوع | APPROVED | Show type | APPROVED | refinement §6 |
| `levels.L2` | إظهار السياق | APPROVED | Show context | APPROVED | refinement §6 |
| `levels.L3` | إظهار المعاينة | APPROVED | Show preview | APPROVED | refinement §6 |
| `levelHelp.L0` | لا يظهر إلا أن هناك إشعارًا جديدًا. | PROOF | Only shows that there is a new notification. | PROOF | — |
| `levelHelp.L1` | يظهر نوع الإشعار فقط. | PROOF | Only shows the kind of notification. | PROOF | — |
| `levelHelp.L2` | يظهر المكان ومن فعل ماذا، دون المحتوى. | PROOF | Shows where and who did what, without the content. | PROOF | — |
| `levelHelp.L3` | يظهر جزء من المحتوى على شاشة القفل. | PROOF | Shows part of the content on the Lock Screen. | PROOF | — |
| `lockSubjects.qandeel` | قنديل | CANON | Qandeel | CANON | — |
| `lockSubjects.shared` | العالم المشترك | CANON | Shared World | CANON | — |
| `lockSubjects.public` | العالم العام | CANON | Public World | PROOF | — |
| `lockSubjects.discovery` | اكتشافات العالم العام | PROOF | Public World discoveries | PROOF | — |
| `lockSubjects.intro` | التعارف | CANON | Introductions | CANON | — |
| `lockSubjects.reminder` | التذكيرات | PROOF | Reminders | PROOF | — |
| `lockSubjects.system` | الحساب | PROOF | Account | PROOF | — |
| `lockSubjects.security` | الأمان | PROOF | Security | PROOF | — |
| `device` | إعدادات إشعارات الجهاز | DIRECTION | Device Notification Settings | APPROVED | task §12 |
| `deviceHelp` | الصوت وشكل التنبيه وشاشة القفل يتحكم فيها جهازك. | PROOF | Sound, alert style and the Lock Screen are controlled by your device. | PROOF | — |
| `l0` | إشعار جديد | PROOF | New notification | PROOF | L0 minimal |
| `generic.qandeel` | رسالة من قنديل | PROOF | A message from Qandeel | PROOF | — |
| `generic.shared` | نشاط جديد في العالم المشترك | PROOF | New activity in Shared World | PROOF | — |
| `generic.public` | نشاط جديد في العالم العام | PROOF | New activity in the Public World | PROOF | — |
| `generic.discovery` | جديد في العالم العام | PROOF | Something new in the Public World | PROOF | — |
| `generic.intro` | تحديث في التعارف | PROOF | An Introductions update | PROOF | — |
| `generic.reminder` | تذكير | PROOF | Reminder | PROOF | — |
| `generic.system` | تحديث في الحساب | PROOF | Account update | PROOF | — |
| `generic.security` | تنبيه أمان | PROOF | Security alert | PROOF | — |
| `ctxTitle.qandeel` | قنديل | PROOF | Qandeel | PROOF | — |
| `ctxTitle.reminder` | تذكير | PROOF | Reminder | PROOF | — |
| `ctxTitle.system` | الحساب | PROOF | Account | PROOF | — |
| `ctxTitle.security` | الأمان | PROOF | Security | PROOF | — |
| `ctxTitle.intro` | التعارف | PROOF | Introductions | PROOF | — |
| `ctxTitle.discovery` | العالم العام | PROOF | Public World | PROOF | — |
| `ctxTitle.public` | العالم العام | PROOF | Public World | PROOF | — |
| `ctxTitle.shared` | العالم المشترك | PROOF | Shared World | PROOF | — |
| `now` | الآن | PROOF | now | PROOF | — |

## Synthetic fixture text — status FIXTURE

These sentences describe invented events (`source/src/fixtures.mjs`). They exist to exercise the surfaces; none of them
is proposed as Product copy, and none was polished in the refinement.

| key | Arabic | English | status |
|---|---|---|---|
| `EV.proactive.text` | عرض الخميس الساعة 10:30. تحب نراجع الأرقام اللي كانت ناقصة قبلها؟ | Your Thursday presentation is at 10:30. Want to go over the missing numbers before then? | FIXTURE |
| `EV.proactive.bounded` | بخصوص عرض الخميس | About Thursday's presentation | FIXTURE |
| `EV.proactive.preview` | عرض الخميس الساعة 10:30. تحب نراجع الأرقام؟ | Thursday's presentation is at 10:30. Want to go over the numbers? | FIXTURE |
| `EV.proTimely.text` | عرضك بعد ساعة، والطريق زحمة. لو هتتحرك، ده وقت كويس. | Your presentation is in an hour and traffic is heavy. If you're heading out, now is a good time. | FIXTURE |
| `EV.proTimely.bounded` | بخصوص عرض النهارده | About today's presentation | FIXTURE |
| `EV.proTimely.preview` | عرضك بعد ساعة، والطريق زحمة. | Your presentation is in an hour and traffic is heavy. | FIXTURE |
| `EV.proTimelyWeak.text` | القهوة اللي كنت بتدور عليها رجعت في المحل اللي جنبك. | The coffee you were looking for is back at the shop near you. | FIXTURE |
| `EV.proTimelyWeak.bounded` | حاجة كنت بتدور عليها | Something you were looking for | FIXTURE |
| `EV.proTimelyWeak.preview` | القهوة رجعت في المحل اللي جنبك. | The coffee is back at the shop near you. | FIXTURE |
| `EV.proHighValue.text` | قلت لي إن نتيجة التحليل هتطلع النهارده. لو حابب نتكلم فيها، أنا هنا. | You told me the test results come out today. If you'd like to talk them through, I'm here. | FIXTURE |
| `EV.proHighValue.bounded` | بخصوص حاجة قلتها لي | About something you told me | FIXTURE |
| `EV.proHighValue.preview` | نتيجة التحليل هتطلع النهارده. | The test results come out today. | FIXTURE |
| `EV.proAmbient.text` | لقيت مقال عن القراءة البطيئة ممكن يعجبك. | I found an article about slow reading you might like. | FIXTURE |
| `EV.proAmbient.bounded` | حاجة ممكن تعجبك | Something you might like | FIXTURE |
| `EV.proAmbient.preview` | مقال عن القراءة البطيئة | An article about slow reading | FIXTURE |
| `EV.sharedReply.text` | سارة ردّت عليك | Sara replied to you | FIXTURE |
| `EV.sharedReply.bounded` | سارة ردّت عليك | Sara replied to you | FIXTURE |
| `EV.sharedReply.preview` | سارة: تمام، هحجز التذاكر النهارده | Sara: Great, I'll book the tickets today | FIXTURE |
| `EV.sharedGov.text` | كريم غيّر مين يقدر يضيف أعضاء | Karim changed who can add members | FIXTURE |
| `EV.sharedGov.bounded` | تغيير في صلاحيات الأعضاء | A change to member permissions | FIXTURE |
| `EV.sharedGov.preview` | كريم غيّر مين يقدر يضيف أعضاء | Karim changed who can add members | FIXTURE |
| `EV.publicReply.text` | ردّ جديد من @saharreads على منشورك | A new reply from @saharreads on your post | FIXTURE |
| `EV.publicReply.bounded` | ردّ جديد على منشورك | A new reply on your post | FIXTURE |
| `EV.publicReply.preview` | @saharreads: فكرة جميلة، جربتها امبارح | @saharreads: Lovely idea, I tried it yesterday | FIXTURE |
| `EV.publicReaction.text` | تفاعل جديد على منشورك | A new reaction to your post | FIXTURE |
| `EV.publicReaction.bounded` | تفاعل جديد على منشورك | A new reaction to your post | FIXTURE |
| `EV.publicReaction.preview` | تفاعل جديد على منشورك | A new reaction to your post | FIXTURE |
| `EV.discovery.text` | نقاش جديد عن القراءة البطيئة قد يهمك | A new discussion about slow reading you might like | FIXTURE |
| `EV.discovery.bounded` | نقاش جديد قد يهمك | A new discussion you might like | FIXTURE |
| `EV.discovery.preview` | نقاش عن القراءة البطيئة | A discussion about slow reading | FIXTURE |
| `EV.introProposal.text` | فيه تعارف جديد في انتظارك | A new introduction is waiting for you | FIXTURE |
| `EV.introProposal.bounded` | فيه تعارف جديد في انتظارك | A new introduction is waiting for you | FIXTURE |
| `EV.introProposal.preview` | فيه تعارف جديد في انتظارك | A new introduction is waiting for you | FIXTURE |
| `EV.introAccept.text` | قَبِل الطرفان التعارف | You both accepted the introduction | FIXTURE |
| `EV.introAccept.bounded` | قَبِل الطرفان التعارف | You both accepted the introduction | FIXTURE |
| `EV.introAccept.preview` | قَبِل الطرفان التعارف. افتح التعارف لتكمل. | You both accepted the introduction. Open Introductions to continue. | FIXTURE |
| `EV.security.text` | تسجيل دخول جديد من جهاز Pixel 8 | New sign-in from a Pixel 8 | FIXTURE |
| `EV.security.short` | تسجيل دخول جديد | New sign-in | FIXTURE |
| `EV.security.bounded` | تسجيل دخول جديد على حسابك | A new sign-in to your account | FIXTURE |
| `EV.security.preview` | تسجيل دخول جديد من جهاز Pixel 8 في القاهرة | New sign-in from a Pixel 8 in Cairo | FIXTURE |
| `EV.reminder.text` | زي ما طلبت: كلّم العيادة الساعة 4:00 | As you asked: call the clinic at 4:00 | FIXTURE |
| `EV.reminder.short` | كلّم العيادة، 4:00 | Call the clinic, 4:00 | FIXTURE |
| `EV.reminder.bounded` | تذكير طلبته للساعة 4:00 | A reminder you set for 4:00 | FIXTURE |
| `EV.reminder.preview` | كلّم العيادة الساعة 4:00 | Call the clinic at 4:00 | FIXTURE |
| `EV.staleShared.text` | كريم شارك ملفًا | Karim shared a file | FIXTURE |
| `EV.staleShared.bounded` | ملف جديد | A new file | FIXTURE |
| `EV.staleShared.preview` | كريم شارك ملفًا | Karim shared a file | FIXTURE |
| `EV.mutedShared.text` | مها كتبت رسالة جديدة | Maha wrote a new message | FIXTURE |
| `EV.mutedShared.bounded` | رسالة جديدة | A new message | FIXTURE |
| `EV.mutedShared.preview` | مها: الاجتماع اتأجل | Maha: The meeting moved | FIXTURE |
| `FEED.F1.text` | 3 رسائل جديدة من سارة وكريم | 3 new messages from Sara and Karim | FIXTURE |
| `FEED.F2.text` | عرض الخميس الساعة 10:30. تحب نراجع الأرقام اللي كانت ناقصة قبلها؟ | Your Thursday presentation is at 10:30. Want to go over the missing numbers before then? | FIXTURE |
| `FEED.F3.text` | تسجيل دخول جديد من جهاز Pixel 8 | New sign-in from a Pixel 8 | FIXTURE |
| `FEED.F3.second` | إن لم يكن هذا أنت، فراجِع الأجهزة المتصلة. | If this wasn't you, review your signed-in devices. | FIXTURE |
| `FEED.F3.action` | مراجعة | Review | FIXTURE |
| `FEED.F4.text` | ردّ جديد من @saharreads على منشورك | A new reply from @saharreads on your post | FIXTURE |
| `FEED.F5.text` | فيه تعارف جديد في انتظارك | A new introduction is waiting for you | FIXTURE |
| `FEED.F6.text` | تفاعلان جديدان على منشورك | 2 new reactions to your post | FIXTURE |
| `FEED.F7.text` | كريم غيّر مين يقدر يضيف أعضاء | Karim changed who can add members | FIXTURE |
| `FEED.F8.text` | 4 رسائل جديدة من مها | 4 new messages from Maha | FIXTURE |
| `FEED.F9.text` | كريم شارك ملفًا | Karim shared a file | FIXTURE |
| `FEED.F10.text` | زي ما طلبت: كلّم العيادة الساعة 4:00 | As you asked: call the clinic at 4:00 | FIXTURE |
| `FEED.F11.text` | قَبِل الطرفان التعارف | You both accepted the introduction | FIXTURE |
