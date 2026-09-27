// P4-C3 — THE COPY REGISTRY. Every word the proof can show or speak, in both Product languages, with its authority,
// its status and the reason for it. data/COPY_DECISION_TABLE.md is generated from this file (tools/c3copytable.mjs), the
// prototype renders only from it (build.mjs → app.js), and the checks read both (tools/c3checks.mjs, C-COPY-*).
//
// Statuses (task §6.1), never mixed:
//   CANON                   already frozen elsewhere before P4-C3; copied exactly (source named)
//   APPROVED_BY_PO_P4C3     authored by P4-C3 and explicitly approved by the Product Owner in the P4-C3R correction pass
//                           (docs/canonical-authority/final-product-experience/p4/
//                           QANDEEL_P4C3_RESIDUAL_VISUAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md). Added by P4-C3R; NOT CANON:
//                           it was not frozen elsewhere before P4-C3. Exactly three rows carry it: replayNoun, confMixed, pidBody.
//   PROPOSED_FOR_PO_REVIEW  authored by P4-C3 for review; binds nothing until a later P4 closure freezes it
//   RUNTIME_GATED           cannot close here (QAN-BL-VOICE-01 / VI-01 V01–V07 "PROVISIONAL / PHASE VII")
//   AUDIT_OWNED             handed to the End-to-End audit by P4-C2 §5
//   FIXTURE_ONLY            evidence text, never Product copy
//
// Register (VI-01 §3, T-08 header): T1 chrome — labels, controls, settings, accessible names — is neutral contemporary
// Arabic: no displayed case endings, gender-neutral (masdar controls, -ك possessives, perfect verbs, impersonal
// passives), never masculine-by-default. QANDEEL's own spoken line (the opener) keeps its frozen warm register.
// English: "context" and "live" do not ship as user-facing nouns (VI-01 §4 / §7.2; T-08 header). QANDEEL is cased
// QANDEEL (P4-C2 §5; I-08A4 §9).
// Numerals: Western digits in both languages, through one formatter (T-08; T-12 §9, v1 `latn`).

export const C = 'CANON', AP = 'APPROVED_BY_PO_P4C3', P = 'PROPOSED_FOR_PO_REVIEW', R = 'RUNTIME_GATED', A = 'AUDIT_OWNED', F = 'FIXTURE_ONLY';
export const STATUSES = [C, AP, P, R, A, F];
/** The P4-C3R Product Owner approval record (the authority every AP row names). */
export const PO_RECORD = 'docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C3_RESIDUAL_VISUAL_COPY_PRODUCT_OWNER_APPROVALS_v1.0.md';
/** Wording the Product Owner replaced in P4-C3R. It must never return as active copy (check C-COPY-13). */
export const RETIRED = {
  confMixedAr: 'فيه تعارض',
  pidBodyEn: 'This is the only manual change your Public ID will ever get. After you confirm, the new ID is permanent and can\'t be changed again.',
  replayAr: 'عرض الجلسة', replayEn: 'Session Replay',
};

const rows = [];
/** k key · fam family · surf surface / moment · src authority · st status · ar · en · frozen · prop newly proposed · why */
const row = (k, fam, surf, src, st, ar, en, frozen, prop, why) => rows.push({ k, fam, surf, src, st, ar, en, frozen, prop, why, po: st === P ? 'YES' : st === AP ? 'APPROVED (P4-C3R)' : 'NO' });

// ============================================================================================ A. FROZEN NAMES (copied)
const F1 = 'frozen names';
row('product', F1, 'Product name', 'VI-01 S01; I-08A4 §8 / §9; P4-C2 §5 (casing)', C, 'قنديل', 'QANDEEL', 'both', '—', 'English casing QANDEEL is final (P4-C2 §5). Earlier proofs\' "Qandeel" is corrected everywhere in this package.');
row('conv', F1, 'Conversation surface / Analysis → Conversation', 'G1.1 §1–§2; I-08A4 §8 / §9', C, 'المحادثة', 'Conversation', 'both', '—', 'Frozen surface name, reused unchanged as the Analysis → Conversation label.');
row('shared', F1, 'Shared World area', 'G1.2 §3; I-08A4 §8 / §9', C, 'العالم المشترك', 'Shared World', 'both', '—', 'Singular, stable regardless of count.');
row('public', F1, 'Public World area', 'I-08A4 §8 / §9', C, 'العالم العام', 'Public World', 'both', '—', 'Frozen by I-08A4. The older proof casing "Public world" is corrected to the frozen "Public World".');
row('mine', F1, 'Personal QANDEEL destination', 'I-08A4 §8 / §9', C, 'قنديل', 'QANDEEL', 'both', '—', 'Personal QANDEEL is «قنديل» / QANDEEL (I-08A4 §8 / §9).');
row('understanding', F1, 'QANDEEL Understanding', 'P1 §10', C, 'فهم قنديل', 'QANDEEL Understanding', 'both', '—', 'Frozen by P1 §10.');
row('intro', F1, 'Introductions capability', 'I-08A4 §8 / §10', C, 'التعارف', 'Introductions', 'both', '—', 'Frozen; "Matching" is rejected as the English term (I-08A4 §10).');
row('settings', F1, 'General Settings destination title', 'I-08A4 §8 / §9; P1 §8', C, 'الإعدادات', 'Settings', 'both', '—', 'I-08A4 already freezes the concept name in both languages.');
row('activity', F1, 'Activity destination', 'P3 §17', C, 'النشاط', 'Activity', 'both', '—', 'P3 APPROVED.');

// ============================================================================================ B. CORE P4 COPY (G3 §G)
const F2 = 'core Conversation / Analysis / Replay / Timeline';
row('door', F2, 'Conversation → Analysis (visible label, upper chrome)', 'G1.1 §1–§2 (Arabic); G3 §G; P4-C2 §5', P, 'تحليل المحادثة', 'Analysis',
  'Arabic «تحليل المحادثة» (G1.1)', 'English "Analysis"',
  'Pairs cleanly with the frozen "Conversation" on the way back: two nouns, one per place. Avoids the rejected "context" / "live". Shorter than the proof "Conversation analysis" (the chrome keeps Replay beside it at 320 pt). The accessible name below restores "of this conversation".');
row('doorName', F2, 'Conversation → Analysis (accessible name)', 'G1.1 §2; WCAG 2.5.3 label-in-name', P, 'تحليل المحادثة', 'Analysis of this conversation',
  'Arabic visible label', 'English name starting with the visible label', 'The name begins with the visible word, so voice control ("tap Analysis") works. Arabic needs no expansion: the visible label is already complete.');
row('backName', F2, 'Analysis → Conversation (accessible name)', 'G1.1 §1–§2; T-08 RETURN_LIVE_HEAD', P, 'المحادثة', 'Conversation',
  'the visible label', 'no extra words in the name', 'The G3.2 proof name «المحادثة — رجوع» / "Conversation — back" is dropped: the button role already says it acts. A longer «العودة إلى المحادثة» was rejected because it collides with T-08\'s frozen «العودة إلى المحادثة الجارية» (Rejoin) for screen-reader users.');
row('replayNoun', F2, 'Replay — the noun (menu title)', 'P4-C3R PO approval record §4 (supersedes I-08A4 §8 / §9\'s user-facing name row only); G1.1 §5; G3 §G', AP, 'إعادة العرض', 'Replay',
  'placement (G1.1); the Product-facing name, approved by the Product Owner in P4-C3R', 'nothing further — approved',
  'Approved by the Product Owner (P4-C3R, finding F-02 resolved by controlled amendment). «إعادة العرض» is the established Arabic word for a replay, and never meets the reader\'s word "session", which no other Product surface uses (T-08 speaks of the conversation and its moments). The older I-08A4 name row is superseded for this Product-facing name only; its bytes stay preserved as history, and no Replay runtime, media, storage, transport or export semantics change.');
row('replayEntry', F2, 'Replay — icon-only entry (accessible name)', 'G1.1 §1; P2 §10 (icon-only names)', P, 'إعادة عرض المحادثة', 'Replay this conversation',
  'the entry\'s place and glyph (G1.1; P2)', 'both names', 'Names the object, so it is not confused with a media "replay" of a voice note. Kept from the proof: it reads natively in both languages.');
row('replayFull', F2, 'Replay — whole conversation', 'G1.1 R3 proof entry; G3 §G', P, 'المحادثة كاملة', 'The whole conversation', '—', 'both', 'Kept from the proof: natural, gender-neutral, parallel with the next row.');
row('replayPart', F2, 'Replay — part of the conversation', 'G1.1 R3 proof entry; G3 §G', P, 'جزء من المحادثة', 'Part of the conversation', '—', 'both', 'Kept from the proof.');
row('timelineName', F2, 'Timeline (accessible name)', 'G3 §G; T-05 / T-06', P, 'الخط الزمني للمحادثة', 'Conversation timeline',
  '—', 'Arabic revised; English kept', 'The proof «خط المحادثة» ("the conversation\'s line") does not name a timeline. «الخط الزمني» is the established Arabic term, and «للمحادثة» keeps it scoped to this conversation.');
row('timelineHint', F2, 'Timeline (accessible hint)', 'G3 §G; T-06 preview / commit / cancel; VI-01 §3.6', P,
  'للنظر مؤقتًا إلى لحظة: السحب أو مفاتيح الأسهم. وللانتقال إليها: الإفلات أو مفتاح Enter.',
  'Drag, or use the arrow keys, for a temporary look at a moment. Release or press Enter to go there.',
  '—', 'Arabic rewritten; English tightened',
  'The proof hint used masculine imperatives («اسحب … اترك … اضغط»), which VI-01 §3.6 forbids as a default. Masdar clauses are gender-neutral and name each act once. "Enter" stays Latin: it is the key\'s printed name.');
row('previewCancel', F2, 'Timeline preview — cancel', 'G3 §G; T-06 lossless cancel; T-08 previewLine', P, 'إلغاء النظرة المؤقتة', 'Cancel the temporary look',
  '—', 'both', 'Uses T-08\'s own frozen noun for a preview («نظرة مؤقتة» / "a temporary look"), so the control and the line it cancels speak the same word. The proof "Cancel the look" read unfinished.');
row('previewCommit', F2, 'Timeline preview — commit', 'G3 §G; T-06 commit; T-08 RETURN_LIVE_FOCUS verb', P, 'الانتقال إلى اللحظة {n}', 'Go to moment {n}',
  '—', 'Arabic verb aligned', '«الانتقال» is the verb T-08 already freezes for moving the view («الانتقال إلى موضع الاهتمام الآن»); the proof «الذهاب» is replaced for consistency. English kept.');
row('liveFollowing', F2, 'Live edge while following (accessible name of the terminal)', 'T-08 temporalLive (words); G3 T-11 / T-12 amendment §2; P2 §7', P,
  'أنت عند آخر المحادثة', 'Following the conversation as it continues',
  'the words (T-08 temporal sentence)', 'their use as the terminal\'s name while following',
  'No new words: the terminal says exactly what T-08\'s temporal line says in the same state, without the full stop. "Live" stays out of English (VI-01 rejection log D).');
row('liveRejoin', F2, 'Live edge while PINNED (Return Live)', 'T-08 RETURN_LIVE_HEAD — product-copy.ts', C, 'العودة إلى المحادثة الجارية', 'Rejoin the conversation', 'both', '—', 'Frozen, implemented T-08 copy; copied exactly.');
row('temporalLive', F2, 'Temporal line while following', 'T-08 temporalLive — product-copy.ts', C, 'أنت عند آخر المحادثة.', 'Following the conversation as it continues.', 'both', '—', 'Frozen T-08 sentence.');
row('returnsLabel', F2, 'Return controls group', 'T-08 returnControlsLabel', C, 'طرق العودة', 'Ways back', 'both', '—', 'Frozen T-08.');

// ============================================================================================ C. THE NORMAL OPENER
const F3 = 'normal new-conversation opener';
row('opener', F3, 'Normal new-conversation opener (QANDEEL\'s first line)', 'G1.1 §1 (Arabic); P4-C2 §5 (English owed)', P,
  'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ', 'Hi {display_name} ... I\'m here, ready when you are ... let\'s begin',
  'Arabic, exactly — wording, spelling and « ... » rhythm', 'English',
  'Carries the Arabic\'s three beats (greeting · presence · invitation) and its warmth without a literal "I\'m waiting for you", which in English reads as needy or impatient. "Ready when you are" keeps the Arabic\'s patience and hands the start to the reader. The spaced ellipses mirror the frozen Arabic rhythm; the Arabic is not "corrected".');
row('firstOpening', F3, 'First Conversation Opening / post-registration Welcome', 'I-08A4 §12–§15; G1.1 §1; P4-C2 §5', A, '—', '—', 'the moment and its placement (I-08A4)', '—', 'A separate moment from the normal opener (P4-C2 §5). Its exact words go to the End-to-End audit\'s first-use pass. Not drawn here.');

// ============================================================================================ D. UNDERSTANDING CONFIDENCE
const F4 = 'QANDEEL Understanding confidence';
row('confClear', F4, 'Confidence state — clear', 'P1 §11.3', P, 'واضح', 'Clear', 'the concept (P1 §11.3)', 'both words',
  'The plainest word for the state. Describes the understanding (masculine «فهم»), never the reader, so it needs no gendered form.');
row('confForming', F4, 'Confidence state — forming', 'P1 §11.3', P, 'يتشكّل', 'Taking shape', 'the concept', 'both words',
  'Says the understanding is still being formed — not that it is weak. "Taking shape" is warmer and more natural than "Forming" as a status word.');
row('confMixed', F4, 'Confidence state — mixed / contested', 'P4-C3R PO approval record §2; P1 §11.3, §11.4', AP, 'يوجد تعارض', 'Mixed', 'the concept (P1); both words, approved by the Product Owner in P4-C3R', 'nothing further — approved',
  'Approved by the Product Owner (P4-C3R). One label must cover mixed evidence and an explicit disagreement (P1 §11.4). «يوجد تعارض» ("there is a conflict") stays neutral and factual, without blaming the reader, in the more formal, stable QANDEEL T1 register: the reviewed candidate «فيه تعارض» used the colloquial «فيه». «متناقض» was rejected as accusatory and «غير محسوم» collides with the frozen detail name «نقاط غير محسومة». English "Mixed" is unchanged: the gentlest accurate word; "Contested" reads adversarial.');
row('confMore', F4, 'Confidence state — needs more context', 'P1 §11.3; VI-01 §4 / §7.2', P, 'يحتاج سياقًا أكثر', 'Needs more to go on', 'the concept', 'both words',
  'Arabic «سياق» is ordinary and approved. English may not ship "context" as a noun (VI-01), so the meaning is carried idiomatically: there is not yet enough to go on. Neither word asks the reader to do anything.');
row('confName', F4, 'Confidence (accessible prefix)', 'P1 §11.3; T-08 family CONFIDENCE', P, 'الثقة: {state}', 'Confidence: {state}', 'the concept', 'both',
  'Screen readers hear what the word is about. «الثقة» is the family word T-08 already uses for CONFIDENCE.');

// ============================================================================================ E. GENERAL SETTINGS GROUPS
const F5 = 'General Settings group names';
row('gAccount', F5, 'Settings group — Account & Identity', 'P1 §8.1; I-08A4 §8 («الحساب»)', P, 'الحساب والهوية', 'Account & Identity', 'the group and its contents (P1)', 'both labels', 'Built on I-08A4\'s frozen «الحساب» / Account.');
row('gSecurity', F5, 'Settings group — Security & Login', 'P1 §8.1; T-14 product-sign-in-copy.ts', P, 'الأمان وتسجيل الدخول', 'Security & Sign-in', 'the group', 'both labels',
  'Matches the words the shipped gateway already uses («تسجيل الدخول» / "Sign in"). "Login" survives only inside the P1 identifier name "Login ID".');
row('gQandeel', F5, 'Settings group — QANDEEL & Conversation', 'P1 §8.1; I-08A4 §8 / §9', P, 'قنديل والمحادثة', 'QANDEEL & Conversation', 'the group', 'both labels', 'Both halves are frozen names; only the pairing is new.');
row('gNotif', F5, 'Settings group — Notifications & Activity', 'P3 §12, §17', C, 'الإشعارات والنشاط', 'Notifications & Activity', 'both', '—', 'P3 APPROVED — not renamed.');
row('gAppearance', F5, 'Settings group — Appearance & Accessibility', 'P1 §8.1, §12', P, 'المظهر وتسهيلات الاستخدام', 'Appearance & Accessibility', 'the group', 'both labels',
  '«تسهيلات الاستخدام» is the term Arabic iOS users already meet for Accessibility; the proof «إمكانية الوصول» is a calque of "accessibility" that reads as "reachability".');
row('gPrivacy', F5, 'Settings group — Privacy & Data', 'P1 §8.1; I-08A4 §8 / §9', P, 'الخصوصية والبيانات', 'Privacy & Data', 'the group', 'both labels', 'Both words are I-08A4 frozen names.');
row('gIntro', F5, 'Settings group — Introductions', 'P1 §8.1; I-08A4 §8 / §10', C, 'التعارف', 'Introductions', 'both', '—', 'The capability name, unchanged.');
row('gPlan', F5, 'Settings group — Plan / Usage', 'P1 §8.1', P, 'الباقة والاستخدام', 'Plan & Usage', 'the placement only (no pricing is frozen)', 'both labels',
  '«الباقة» is the everyday Arabic word for a plan; it promises no price, credit or subscription model (P1 freezes none).');
row('gSupport', F5, 'Settings group — Support / App', 'P1 §8.1', P, 'الدعم ومعلومات التطبيق', 'Support & About', 'the group', 'both labels',
  'Help, legal, version and sign-out live here. "Support & App" (proof) names nothing a reader looks for; "About" is the platform word for version and legal.');

// ============================================================================================ F. PUBLIC ID WARNING
const F6 = 'Public ID one-time change';
row('pidTerm', F6, 'Public ID (term)', 'P1 §2, §6', P, 'المعرّف العام', 'Public ID', 'the English identifier name (P1)', 'the Arabic term',
  'No Arabic term was frozen. «المعرّف العام» pairs with «العالم العام» and is distinct from Login ID and Shared ID.');
row('pidAvailable', F6, 'Settings row state — change still available', 'P1 §6, §8.1', P, 'متاح تغيير يدوي واحد', 'One manual change available', '—', 'both', 'States the remaining allowance before the reader acts, not only at the warning.');
row('pidUsed', F6, 'Settings row state — change used', 'P1 §6, §8.1', P, 'استُخدم التغيير اليدوي الوحيد', 'Your one manual change has been used', '—', 'both', 'Impersonal passive in Arabic: gender-neutral and blameless.');
row('pidTitle', F6, 'Warning — title', 'P1 §6 ("prominently warns … only manual change … permanent")', P, 'يمكن تغيير المعرّف العام مرة واحدة فقط', 'You can change your Public ID only once',
  'the obligation to warn before commitment', 'both', 'The title alone carries the rule. Arabic uses the impersonal «يمكن» rather than a gendered imperfect.');
row('pidBody', F6, 'Warning — body', 'P4-C3R PO approval record §3; P1 §6', AP, 'هذا هو التغيير اليدوي الوحيد المتاح لمعرّفك العام طوال عمر الحساب. بعد التأكيد يصبح المعرّف الجديد دائمًا، ولا يمكن تغييره مرة أخرى.',
  'This is the only time you can manually change your Public ID. After you confirm, the new ID is permanent and can’t be changed again.',
  'both, approved by the Product Owner in P4-C3R (English replaced; Arabic unchanged)', 'nothing further — approved',
  'Approved by the Product Owner (P4-C3R). States exactly three facts: one change, for the life of the account, permanent after confirmation. The English now keeps the reader as the one who acts ("you can manually change") instead of the awkward "the only manual change your Public ID will ever get". No fear words, no urgency, no extra confirmation step, no new behaviour.');
row('pidCurrent', F6, 'Warning — current value label', 'P1 §6', P, 'الحالي', 'Current', '—', 'both', 'Short labels; the values are shown as isolated left-to-right handles.');
row('pidNew', F6, 'Warning — new value label', 'P1 §6', P, 'الجديد', 'New', '—', 'both', '');
row('pidConfirm', F6, 'Warning — commit action', 'P1 §6', P, 'تأكيد التغيير', 'Confirm change', '—', 'both', 'Names the act. Not styled as a danger colour: this is permanent, not destructive.');
row('pidKeep', F6, 'Warning — the other choice', 'P1 §6; no dark patterns (task §6.6)', P, 'الإبقاء على المعرّف الحالي', 'Keep current ID', '—', 'both',
  'An equal, explicit alternative instead of a bare "Cancel": leaving without committing is a real choice, not a failure.');
row('pidFixtureOld', F6, 'Current handle (fixture)', 'P1 §6 (conceptually like @nightlamp27)', F, '@nightlamp27', '@nightlamp27', '—', '—', 'Evidence value; the generation grammar is implementation detail (P1 §6).');
row('pidFixtureNew', F6, 'New handle (fixture)', '—', F, '@noor.writes', '@noor.writes', '—', '—', 'Evidence value.');
row('uFix1', F4, 'Understanding specimen title (fixture)', '—', F, 'التحضير قبل المواعيد المهمة', 'Preparing before big deadlines', '—', '—', 'Stands in for an understanding item title; exists only to set a confidence word in context.');
row('uFix2', F4, 'Understanding specimen title (fixture)', '—', F, 'التفاصيل التي لا يلاحظها أحد', 'The details nobody notices', '—', '—', 'Evidence text.');
row('uFix3', F4, 'Understanding specimen title (fixture)', '—', F, 'النوم في الأيام الأخيرة قبل التسليم', 'Sleep in the last days before a deadline', '—', '—', 'Evidence text.');
row('uFix4', F4, 'Understanding specimen title (fixture)', '—', F, 'ما يساعدك بعد يوم طويل', 'What helps after a long day', '—', '—', 'Evidence text.');

// ============================================================================================ G. VOICE / CALL (all gated)
const F7 = 'Voice / call (runtime-gated)';
const G = 'VI-01 V01–V07 "PROVISIONAL / PHASE VII"; G1.2 §6; P4-C2 §4–§5; QAN-BL-VOICE-01';
row('vNote', F7, 'Voice Note (name)', `${G} (V01)`, R, 'رسالة صوتية', 'Voice message', '—', '—', 'Shown only in accessible names in this proof. Rendered as PROOF ONLY / NOT COPY FREEZE.');
row('vNoteName', F7, 'Voice Note turn (accessible summary)', G, R, 'رسالة صوتية منك، مدتها {d}', 'Your voice message, {d}', '—', '—', 'Gated: its words depend on what the runtime stores.');
row('vPlay', F7, 'Voice Note — play', `${G} (V05)`, R, 'تشغيل الرسالة الصوتية', 'Play voice message', '—', '—', 'Action label; stays gated with the V-family noun it contains.');
row('vPause', F7, 'Voice Note — pause', `${G} (V05)`, R, 'إيقاف الرسالة الصوتية مؤقتًا', 'Pause voice message', '—', '—', '');
row('vProgress', F7, 'Voice Note — stored playback position (accessible value)', G, R, '{a} من {b}', '{a} of {b}', '—', '—', 'Stored playback state, never a live level.');
row('vRecord', F7, 'Voice Note — start (mic, idle)', `${G} (V01 / V03)`, R, 'رسالة صوتية', 'Voice message', '—', '—', '');
row('vRecording', F7, 'Voice Note — capture active (visible)', `${G} (V04 — "may be false")`, R, 'بسجّل', 'Recording', '—', '—', 'G1.2 R1 keeps capture wording visible; VI-01 warns "Recording" may be false. PROOF ONLY / NOT COPY FREEZE.');
row('vSend', F7, 'Voice Note — send', G, R, 'إرسال الرسالة الصوتية', 'Send voice message', '—', '—', '');
row('vCancel', F7, 'Voice Note — cancel', G, R, 'إلغاء التسجيل', 'Cancel recording', '—', '—', '');
row('cCall', F7, 'Call (entry / name)', `${G} (V02)`, R, 'مكالمة صوتية', 'Voice call', '—', '—', '');
row('cRecord', F7, 'Finished call record (visible)', `${G} (V02); G1.2 §6 "final call-history material representation"`, R, 'مكالمة صوتية', 'Voice call', '—', '—', 'The record\'s layout is proved here; its word is not frozen.');
row('cRecordName', F7, 'Finished call record (accessible summary)', G, R, 'مكالمة صوتية انتهت، مدتها {d}', 'Voice call ended, {d}', '—', '—', '');
row('cMute', F7, 'Call — mute', G, R, 'كتم الميكروفون', 'Mute microphone', '—', '—', 'P3-A\'s COPY_TABLE marks this CANON ("G1.2 R1"). G1.2 §6 and P4-C2 §5 keep call strings gated, so it is not relabelled CANON here (finding F-03).');
row('cUnmute', F7, 'Call — unmute', G, R, 'تشغيل الميكروفون', 'Turn microphone on', '—', '—', '');
row('cEnd', F7, 'Call — end', G, R, 'إنهاء المكالمة', 'End call', '—', '—', 'Same as cMute (finding F-03).');
row('cRoute', F7, 'Call — speaker route', G, R, 'السماعة الخارجية', 'Speaker', '—', '—', '');
row('cContinues', F7, 'Call continues (accessible suffix)', `${G}; G1.2 §1`, R, 'المكالمة مستمرة', 'the call continues', '—', '—', 'Also P3-A `callSafeOn`.');
row('cConnecting', F7, 'Call — connecting (transitional, visible)', `${G}; G1.2 §4`, R, 'جاري الاتصال', 'Connecting', '—', '—', '');
row('cA11yOn', F7, 'Call — microphone on (assistive only)', `${G}; G1.2 §4`, R, 'الميكروفون شغّال', 'Microphone on', '—', '—', 'Never persistently visible (G1.2 §4).');
row('cA11yMuted', F7, 'Call — microphone muted (assistive only)', `${G}; G1.2 §4`, R, 'الميكروفون مكتوم', 'Microphone muted', '—', '—', 'Never persistently visible (G1.2 §4).');
row('cElapsedName', F7, 'Call — elapsed (accessible)', G, R, 'مدة المكالمة {d}', 'Call time {d}', '—', '—', '');
row('replayCallNote', F7, 'Replay — calls not included', `${G}; replay-runtime-v1 §7`, R, 'المكالمة الصوتية غير مشمولة.', 'Voice calls aren\'t included.', '—', '—', 'True today; changes when a durable call-audio source exists (QAN-BL-VOICE-01).');

// ============================================================================================ H. SHELL WORDS the proof draws
const F8 = 'shell (consumed)';
row('navLabel', F8, 'Global Switcher landmark', 'G1.1 R3 proof; VI-01 residue', A, 'العوالم', 'Worlds', '—', '—', 'A VI-01 rendered-language residue (P4-C2 §5 → audit). Drawn unchanged.');
row('composer', F8, 'Composer placeholder', 'VI-01 A10 PROPOSED', A, 'كلامك هنا', 'Write here', '—', '—', 'VI-01 PROPOSED row → End-to-End audit (P4-C2 §5). Drawn unchanged.');
row('composerName', F8, 'Composer (accessible name)', 'VI-01 A10 PROPOSED', A, 'رسالتك لقنديل', 'Your message to QANDEEL', '—', '—', 'VI-01 residue → audit.');
row('send', F8, 'Send', 'G1.2 proof; VI-01 residue', A, 'إرسال', 'Send', '—', '—', 'VI-01 residue → audit.');
row('activityNew', F8, 'Activity entry — new items (accessible state)', 'P3-A activityNew (PROOF); P3 §6', P, 'هناك جديد', 'new items', '—', 'Arabic revised to T1', 'The proof «فيه جديد» is spoken Egyptian inside a T1 accessible name; «هناك جديد» is the neutral register the chrome uses.');

// ============================================================================================ I. P3 RESIDUAL COPY
// Every interface key of P3-A's COPY_TABLE is dispositioned here (C-COPY-P3 checks there is none left out). `p3` names
// the P3-A key; a key already covered above points at that row with `same`.
export const P3_SAME = { product: 'product', 'nav.label': 'navLabel', 'nav.items[0]': 'mine', 'nav.items[1]': 'shared', 'nav.items[2]': 'public', door: 'door', replay: 'replayEntry',
  composer: 'composer', mute: 'cMute', route: 'cRoute', endCall: 'cEnd', activity: 'activity', activityNew: 'activityNew', 'filters.intro': 'intro', settings: 'settings',
  'groups[0]': 'gAccount', 'groups[1]': 'gSecurity', 'groups[2]': 'gQandeel', 'groups[3]': 'gNotif', 'groups[4]': 'gAppearance', 'groups[5]': 'gPrivacy', 'groups[6]': 'gIntro', 'groups[7]': 'gSupport',
  notif: 'gNotif', callSafeOn: 'cContinues', sharedSec: 'shared', publicSec: 'public', introSec: 'intro', 'lockSubjects.qandeel': 'mine', 'lockSubjects.shared': 'shared', 'lockSubjects.public': 'public', 'lockSubjects.intro': 'intro',
  'ctxTitle.qandeel': 'mine', 'ctxTitle.intro': 'intro', 'ctxTitle.discovery': 'public', 'ctxTitle.public': 'public', 'ctxTitle.shared': 'shared', 'filters.shared': 'p3.filterShared', 'filters.public': 'p3.filterPublic' };
const F9 = 'P3 residual (frozen P3 surfaces)';
const p3 = (key, surf, st, ar, en, frozen, prop, why, src = '') => row('p3.' + key, F9, surf, `P3 ${src || '§17'}; P3-A COPY_TABLE \`${key}\``, st, ar, en, frozen, prop, why);
p3('activityOpen', 'Activity entry (accessible name)', P, 'فتح النشاط', 'Open Activity', '—', 'adopted', 'Verbal-noun control label; kept.', '§3');
p3('activitySettings', 'Activity → Notifications & Activity (accessible name)', P, 'إعدادات الإشعارات والنشاط', 'Notifications & Activity settings', 'the section name', 'adopted', 'Composes the frozen section name.', '§3, §12');
p3('back', 'Pushed page back (accessible name)', P, 'رجوع', 'Back', '—', 'adopted', 'Platform-standard.', '§3');
p3('filterGroup', 'Activity filters (group name)', P, 'تصفية النشاط', 'Filter Activity', '—', 'adopted', '', '§3');
p3('filters.all', 'Activity filter — All', C, 'الكل', 'All', 'both (P3 APPROVED)', '—', '', '§17');
p3('filters.qandeel', 'Activity filter — From QANDEEL', C, 'من قنديل', 'From QANDEEL', 'both (I-08N-01 D30)', '—', 'Casing corrected to QANDEEL (P4-C2 §5).', '§3');
row('p3.filterShared', F9, 'Activity filter — Shared World', 'P3 §3; P3-A COPY_TABLE `filters.shared`', P, 'العالم المشترك', 'Shared World', 'Arabic (G1.2 §3)', 'English = the frozen area name',
  'The proof English "Shared" drops half of a frozen name. A filter names the area, so it uses the area\'s name.', 'NO');
row('p3.filterPublic', F9, 'Activity filter — Public World', 'P3 §3; P3-A COPY_TABLE `filters.public`', P, 'العالم العام', 'Public World', 'both words (I-08A4)', 'their use as the filter label', 'Same reasoning as the Shared World filter.');
p3('filters.system', 'Activity filter — System', P, 'النظام', 'System', '—', 'adopted', '', '§3');
p3('day.today', 'Activity day — today', P, 'اليوم', 'Today', '—', 'adopted', 'Same words G3.2\'s Conversation uses.', '§4');
p3('day.yesterday', 'Activity day — yesterday', P, 'أمس', 'Yesterday', '—', 'adopted', '', '§4');
p3('day.earlier', 'Activity day — earlier', P, 'في وقت سابق', 'Earlier', '—', 'adopted', '', '§4');
p3('markNew', 'Attention mark — new (accessible state)', P, 'جديد', 'new', '—', 'adopted', 'State in words, never colour alone (P3 §6).', '§6');
p3('markWaiting', 'Attention mark — waiting (accessible state)', P, 'في انتظارك', 'waiting for you', '—', 'adopted', 'Gender-neutral in writing (-ك).', '§6');
p3('stale', 'Stale target — title', P, 'لم يعد متاحًا', 'No longer available', '—', 'adopted', '', '§15');
p3('staleExplain', 'Stale target — explanation', P, 'ما كان هنا لم يعد متاحًا، ولن يُفتح مكان آخر بدلًا منه.', 'What was here is no longer available. Nothing else will open in its place.',
  '—', 'revised', 'The proof spoke as "we", a voice QANDEEL\'s product text uses nowhere else. The impersonal passive states D39\'s rule without a speaker.', '§15 (D39)');
p3('staleOpen', 'Stale target — fallback action', P, 'فتح {0}', 'Open {0}', '—', 'adopted', '', '§15');
p3('muted', 'Activity row — muted World', P, 'مكتوم', 'Muted', '—', 'adopted', '', '§12.2');
p3('empty', 'Activity — empty', P, 'لا شيء هنا الآن.', 'Nothing here right now.', '—', 'Arabic revised to T1', 'The proof «مفيش حاجة هنا دلوقتي.» is spoken Egyptian on a T1 surface.', '§3');
p3('stripRegion', 'Attention Strip (region name)', P, 'تنبيه', 'Alert', '—', 'adopted', '', '§7');
p3('stripDismiss', 'Attention Strip — dismiss', P, 'إغلاق التنبيه', 'Dismiss alert', '—', 'English revised', 'English now names its object like the Arabic does.', '§7');
p3('callSafeRegion', 'Call-safe strip (region name)', P, 'تنبيه أثناء المكالمة', 'Alert during your call', '—', 'adopted', 'A region name on a frozen P3 surface, not a call-state string.', '§9');
p3('eduTitle', 'Permission education — title', A, 'خليني أوصلك لما يكون في حاجة تستاهل', 'Let me reach you when it\'s worth it', 'the sheet\'s behaviour (P3 §11)', '—', 'P4-C2 §5 hands the permission-education sheet to the End-to-End audit. Not finalised here.', '§11');
p3('eduBody', 'Permission education — body', A, '—', '—', 'P3 §11', '—', 'Audit-owned (P4-C2 §5).', '§11');
p3('eduAllow', 'Permission education — allow', A, 'السماح بالإشعارات', 'Allow notifications', 'P3 §11', '—', 'Audit-owned.', '§11');
p3('eduNotNow', 'Permission education — not now', A, 'مش دلوقتي', 'Not now', 'P3 §11', '—', 'Audit-owned.', '§11');
p3('osBoundary', 'Permission education — OS boundary note', A, 'يسألك النظام الآن', 'Your device asks next', 'P3 §11', '—', 'Part of the education flow → audit.', '§11');
p3('osBoundaryNote', 'Permission education — OS prompt ownership', A, '—', '—', 'P3 §11, §18', '—', 'Part of the education flow → audit.', '§11');
p3('notNowNote', 'Permission education — after "not now"', A, 'تمام. النشاط هيفضل يظهر هنا جوه التطبيق.', 'Okay. Activity will keep showing here in the app.', 'P3 §11', '—', 'Part of the education flow → audit.', '§11');
p3('osOff', 'Settings — OS permission off', P, 'إشعارات قنديل متوقفة على هذا الجهاز، وسيظل النشاط يظهر داخل التطبيق.', 'Notifications for QANDEEL are off on this device. Activity still appears here in the app.',
  '—', 'Arabic bound into one sentence', 'Two bound facts joined by «و» instead of a full stop (the second only makes sense with the first). Casing QANDEEL.', '§12');
p3('proactive', 'Settings — proactive QANDEEL section heading', P, 'مبادرة قنديل', 'QANDEEL reaching out',
  'the control beneath it (P3 §12.1)', 'both headings',
  'The Product Owner\'s direction «قنديل يبادر معايا» is kept as the alternative on the board. The proposal moves the heading into the T1 register every other Settings heading uses and removes the first-person «معايا», which makes a settings heading speak as the reader. English: the verb phrase is warmer than "Proactive QANDEEL" (internal vocabulary).', '§12.1, §17');
p3('proactiveHelp', 'Settings — proactive section help', P, 'يحدّد هذا الخيار متى يبدأ قنديل الكلام معك فقط، ولا يغيّر ذاكرته أو فهمه أو التحليل.',
  'This only controls when QANDEEL starts a conversation with you. Its memory, understanding and analysis stay the same.',
  'the semantics (P3 §12.1; I-08N-01 D35)', 'Arabic rewritten in T1; English casing',
  'The proof «ده بيتحكم … بس» is spoken Egyptian with a masculine «معاك». Verb-first T1 Arabic, one bound sentence; the reader\'s «معك» is neutral in writing.', '§12.1');
p3('proactiveOptHelp.allow', 'Settings — help under Allow', P, 'يبدأ قنديل الكلام معك عندما يكون لديه سبب يستحق.', 'QANDEEL can reach out when there\'s a good reason.',
  '—', 'Arabic rewritten in T1', 'Removes the masculine «معاك» and the colloquial «يستاهل».', '§12.1');
p3('proactiveOptHelp.reduce', 'Settings — help under Reduce', P, 'يقاطعك قنديل أقل، ولا ينبّهك إلا لما هو أهم أو لما لا يحتمل التأجيل.', 'QANDEEL interrupts you less, and only for what matters most or can\'t wait.',
  'the Reduce semantics (P3 §12.1: a tighter gate, not "Class 2 only", not Off)', 'Arabic rewritten in T1',
  'Says "less, and only the most important or time-bound" — exactly P3\'s tighter gate — without implying a class rule or a score.', '§12.1');
p3('proactiveOptHelp.off', 'Settings — help under Off', P, 'لن يبدأ قنديل الكلام معك من تلقاء نفسه، ويمكنك محادثته متى شئت.', 'QANDEEL won\'t start a conversation on its own. You can talk to it whenever you like.',
  'Off controls interruption only (D35)', 'Arabic rewritten in T1', '«شئت» is neutral in unvowelled script. The second clause keeps Off from reading as "QANDEEL is gone".', '§12.1');
p3('sharedAll', 'Settings — Shared World global control', P, 'تنبيهات العالم المشترك', 'Shared World alerts', '—', 'adopted', '', '§12.2');
p3('on', 'Settings — on', P, 'مفعّل', 'On', '—', 'adopted', '', '§12.2');
p3('off', 'Settings — off', P, 'متوقف', 'Off', '—', 'adopted', '', '§12.2');
p3('mutedWorld', 'Settings — per-World muted', P, 'مكتوم', 'Muted', '—', 'adopted', '', '§12.2');
p3('publicInter', 'Settings — Public replies and interactions', P, 'الردود والتفاعلات معك', 'Replies and interactions with you', '—', 'Arabic plural aligned', 'Uses I-08A4\'s frozen «الردود» and «التفاعلات» (plural, as frozen).', '§12.2');
p3('publicDisc', 'Settings — Public Discovery', P, 'اكتشافات من العالم العام', 'Discoveries from the Public World', '—', 'adopted', '', '§12.2');
p3('publicDiscHelp', 'Settings — Public Discovery help', P, 'اختياري — مرة في الأسبوع على الأكثر', 'Optional — at most once a week', 'the ceiling (P3 §14)', 'adopted', 'True to the frozen ceiling: opt-in, at most one per rolling 7 days.', '§12.2, §14');
p3('introOn', 'Settings — Introductions alerts', P, 'تنبيهات التعارف', 'Introduction alerts', '—', 'adopted', '', '§12.2');
p3('introHelp', 'Settings — Introductions help', P, 'لا تكشف شاشة القفل افتراضيًا أن الإشعار يخص التعارف.', 'By default, the Lock Screen doesn\'t show that a notification is about Introductions.',
  'D15 default (P3 §10.1)', 'Arabic verb-first', 'The proof fronted «افتراضيًا،» English-style; the adverb now trails.', '§10.1');
p3('systemSec', 'Settings — System / Account section', P, 'الأمان والحساب', 'Security & Account', '—', 'adopted', '', '§12.2');
p3('securityAlways', 'Settings — critical security help', P, 'تنبيهات الأمان المهمة تصلك دائمًا، حتى في ساعات الهدوء، ولا يمكنها تجاوز إعدادات جهازك.', 'Important security alerts always reach you, even during Quiet Hours. They can\'t override your device settings.',
  'D36 (P3 §12.2)', 'adopted', 'Already neutral MSA; true to D36.', '§12.2');
p3('systemOther', 'Settings — other account updates', P, 'تحديثات الحساب الأخرى', 'Other account updates', '—', 'adopted', '', '§12.2');
p3('quiet', 'Settings — Quiet Hours', P, 'ساعات الهدوء', 'Quiet Hours', '—', 'adopted', '', '§13');
p3('quietOn', 'Settings — use Quiet Hours', P, 'تفعيل ساعات الهدوء', 'Use Quiet Hours', '—', 'adopted', '', '§13');
p3('quietRange', 'Settings — Quiet Hours window', P, 'من {0} إلى {1}', '{0} to {1}', 'the v1 default 23:00 → 08:00 (P3 §13)', 'adopted', '', '§13');
p3('quietHelp', 'Settings — Quiet Hours help', P, 'لا يصلك خلالها إلا تذكير طلبته لموعد محدد أو تنبيه أمان مهم. وعند انتهائها يُعاد النظر في ما انتظر، ولا يصلك دفعة واحدة.',
  'During these hours, only reminders you set for an exact time and important security alerts come through. When they end, anything waiting is looked at again — never sent all at once.',
  'D06 exceptions; re-evaluation and "no morning dump" (P3 §13)', 'both revised (truth fix)',
  'The proof said "reviewed in the morning". P3 §13 freezes re-evaluation when Quiet Hours END, and the reader may move the window; "morning" would become false. «طلبته» (perfect) is gender-neutral in writing.', '§13');
p3('snooze', 'Settings — Snooze', P, 'إيقاف مؤقت', 'Snooze', '—', 'adopted', '', '§13');
p3('lockSec', 'Settings — Lock Screen previews', P, 'معاينات شاشة القفل', 'Lock Screen previews', '—', 'adopted (Arabic was the PO\'s direction)', '', '§10');
p3('lockHelp', 'Settings — Lock Screen ceiling help', P, 'هذا حدّ أقصى: قد يُظهر قنديل تفاصيل أقل.', 'This is a limit: QANDEEL may show less.', 'D17 (P3 §10)', 'adopted; casing', '', '§10');
p3('levelHelp.L0', 'Settings — help L0', P, 'لا يظهر إلا أن هناك إشعارًا جديدًا.', 'Only shows that there is a new notification.', '—', 'adopted', '', '§10');
p3('levelHelp.L1', 'Settings — help L1', P, 'يظهر نوع الإشعار فقط.', 'Only shows the kind of notification.', '—', 'adopted', '', '§10');
p3('levelHelp.L2', 'Settings — help L2', P, 'يظهر المكان وما حدث ومَن قام به، دون المحتوى.', 'Shows where and who did what, without the content.', '—', 'Arabic revised', '«من فعل ماذا» is a word-for-word "who did what"; the revision says it in Arabic order.', '§10');
p3('levelHelp.L3', 'Settings — help L3', P, 'يظهر جزء من المحتوى على شاشة القفل.', 'Shows part of the content on the Lock Screen.', '—', 'adopted', '', '§10');
p3('lockSubjects.discovery', 'Lock Screen subject — discoveries', P, 'اكتشافات العالم العام', 'Public World discoveries', '—', 'adopted', '', '§10');
p3('lockSubjects.reminder', 'Lock Screen subject — reminders', P, 'التذكيرات', 'Reminders', '—', 'adopted', '', '§10');
p3('lockSubjects.system', 'Lock Screen subject — account', P, 'الحساب', 'Account', 'I-08A4 «الحساب» / Account', 'adopted', '', '§10');
p3('lockSubjects.security', 'Lock Screen subject — security', P, 'الأمان', 'Security', '—', 'adopted', '', '§10');
p3('device', 'Settings — Device Notification Settings', P, 'إعدادات إشعارات الجهاز', 'Device Notification Settings', 'English (APPROVED)', 'Arabic (was the PO\'s direction)', '', '§12.2');
p3('deviceHelp', 'Settings — device handoff help', P, 'الصوت وشكل التنبيه وشاشة القفل يتحكم فيها جهازك.', 'Sound, alert style and the Lock Screen are controlled by your device.', '—', 'adopted', '', '§12.2');
p3('l0', 'Lock Screen — L0 text', P, 'إشعار جديد', 'New notification', '—', 'adopted', '', '§10');
p3('generic.qandeel', 'Lock Screen — L1 QANDEEL', P, 'رسالة من قنديل', 'A message from QANDEEL', '—', 'adopted; casing', '', '§10');
p3('generic.shared', 'Lock Screen — L1 Shared World', P, 'نشاط جديد في العالم المشترك', 'New activity in Shared World', '—', 'adopted', '', '§10');
p3('generic.public', 'Lock Screen — L1 Public World', P, 'نشاط جديد في العالم العام', 'New activity in the Public World', '—', 'adopted', '', '§10');
p3('generic.discovery', 'Lock Screen — L1 discovery', P, 'جديد في العالم العام', 'Something new in the Public World', '—', 'adopted', '', '§10');
p3('generic.intro', 'Lock Screen — L1 Introductions', P, 'تحديث في التعارف', 'An Introductions update', '—', 'adopted', 'Reveals the category only when the reader raised the ceiling (P3 §10.1).', '§10.1');
p3('generic.reminder', 'Lock Screen — L1 reminder', P, 'تذكير', 'Reminder', '—', 'adopted', '', '§10');
p3('generic.system', 'Lock Screen — L1 account', P, 'تحديث في الحساب', 'Account update', '—', 'adopted', '', '§10');
p3('generic.security', 'Lock Screen — L1 security', P, 'تنبيه أمان', 'Security alert', '—', 'adopted', '', '§10');
p3('ctxTitle.reminder', 'Lock Screen L2 title — reminder', P, 'تذكير', 'Reminder', '—', 'adopted', '', '§10');
p3('ctxTitle.system', 'Lock Screen L2 title — account', P, 'الحساب', 'Account', '—', 'adopted', '', '§10');
p3('ctxTitle.security', 'Lock Screen L2 title — security', P, 'الأمان', 'Security', '—', 'adopted', '', '§10');
p3('now', 'Activity time — now', P, 'الآن', 'now', '—', 'adopted', '', '§4');
p3('snoozeOpts.1h', 'Snooze — 1 hour', P, 'ساعة', '1 hour', 'the duration (P3 §13); English (APPROVED)', 'Arabic', 'Arabic counted nouns agree: «ساعة» alone for one, «8 ساعات» (3–10 takes the plural), «24 ساعة» (11–99 takes the singular). «مدة أخرى» is the natural Arabic for "Custom"; «مخصّصة» would be a calque.', '§13');
p3('snoozeOpts.8h', 'Snooze — 8 hours', P, '8 ساعات', '8 hours', 'English (APPROVED)', 'Arabic', '', '§13');
p3('snoozeOpts.24h', 'Snooze — 24 hours', P, '24 ساعة', '24 hours', 'English (APPROVED)', 'Arabic', '', '§13');
p3('snoozeOpts.custom', 'Snooze — custom', P, 'مدة أخرى', 'Custom', 'English (APPROVED)', 'Arabic', '', '§13');
p3('proactiveOpts.allow', 'Proactive — Allow', C, 'سماح', 'Allow', 'both', '—', '', '§17');
p3('proactiveOpts.reduce', 'Proactive — Reduce', C, 'أقل', 'Reduce', 'both', '—', '', '§17');
p3('proactiveOpts.off', 'Proactive — Off', C, 'إيقاف', 'Off', 'both', '—', '', '§17');
p3('levels.L0', 'Lock level L0', C, 'خاصة جدًا', 'Very private', 'both', '—', '', '§10');
p3('levels.L1', 'Lock level L1', C, 'إظهار النوع', 'Show type', 'both', '—', '', '§10');
p3('levels.L2', 'Lock level L2', C, 'إظهار السياق', 'Show context', 'both', '—', 'APPROVED exception to the English "context" rule (P3 §17).', '§10');
p3('levels.L3', 'Lock level L3', C, 'إظهار المعاينة', 'Show preview', 'both', '—', '', '§10');

export const ROWS = rows;
export const ROW = Object.fromEntries(rows.map((r) => [r.k, r]));
// fix-ups: a row whose PO field was passed explicitly (p3.filterShared) keeps the standard rule
for (const r of rows) r.po = r.st === P ? 'YES' : 'NO';

/** One string, in one language, from the registry. `vars` fill {placeholders}. Throws on an unregistered key. */
export function T(key, lang, vars = {}) {
  const r = ROW[key]; if (!r) throw new Error('unregistered copy key ' + key);
  let s = lang === 'ar' ? r.ar : r.en;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

// ============================================================================================ FIXTURES (never Product copy)
/** The conversation the Voice proofs stand in — G3.2's fixture conversation, with one turn a Voice Note and one finished
 *  call. Every sentence is FIXTURE_ONLY; durations and times are fixture facts the history record is allowed to show. */
export const THREAD = {
  ar: [
    { day: 'أمس' },
    { who: 'me', text: 'خلّصت الشغل متأخر تاني. كان جاهز من يومين، بس فضلت أعدّل فيه.' },
    { who: 'q', text: 'التعديلات كانت في إيه؟' },
    { day: 'اليوم', time: '9:40' },
    { who: 'q', opener: true },
    { who: 'me', voice: { total: 42 } },
    { who: 'q', text: 'يعني اللي ناقص دلوقتي مش في إيدك. لما الأرقام توصل، إيه أول خطوة في العرض؟' },
    { call: { secs: 724 } },
    { who: 'me', text: 'الأرقام هتوصل بكرة الصبح' },
  ],
  en: [
    { day: 'Yesterday' },
    { who: 'me', text: 'Finished late again. It was ready two days ago, but I kept tweaking it.' },
    { who: 'q', text: 'What were the tweaks?' },
    { day: 'Today', time: '9:40' },
    { who: 'q', opener: true },
    { who: 'me', voice: { total: 42 } },
    { who: 'q', text: 'So what’s missing right now isn’t in your hands. When the numbers arrive, what’s the first step in the presentation?' },
    { call: { secs: 724 } },
    { who: 'me', text: 'The numbers land tomorrow morning' },
  ],
};
export const DISPLAY_NAME = { ar: 'نور', en: 'Nour' };
/** Cross-script voice-note fixture turns are not needed: a Voice Note has no text. The cross-script written sample
 *  proves paragraph direction independent of speaker side (G1.1 §1). */
export const CROSS = { ar: 'The Q3 numbers arrive Thursday', en: 'الأرقام هتوصل بكرة الصبح' };
