# P4-C3 — Copy proof report

**Status:** `PROPOSED FOR PRODUCT OWNER REVIEW — NOTHING IS FROZEN BY THIS REPORT`. The complete, row-by-row record is
[`../data/COPY_DECISION_TABLE.md`](../data/COPY_DECISION_TABLE.md), generated from `source/src/content.mjs`. Every
string the prototype renders comes from that registry and carries its key, and C-COPY-5 proves the page shows nothing
unregistered or drifted.

## 1. Disposition summary

| Status | Rows |
|---|---|
| `CANON` | 23 |
| `PROPOSED_FOR_PO_REVIEW` | 107 |
| `RUNTIME_GATED` | 22 |
| `AUDIT_OWNED` | 12 |
| `FIXTURE_ONLY` | 69 (63 P3-A event sentences + 6 specimen / handle values), plus the conversation fixture turns |
| **total** | **233** |

Of the 107 proposed rows, most **adopt** an existing proof line unchanged (marked "adopted"). The rest are **authored or
revised** here, and each names its reason. Every P3-A interface key (125) is dispositioned (C-COPY-11).

## 2. The rules the words follow

- **Register (VI-01 §3.1).** Settings, labels, controls and accessible names are T1: neutral contemporary Arabic. Four P3
  proof help lines were in spoken Egyptian with a masculine «معاك» and are rewritten in T1. The one line that is
  QANDEEL's own voice — the opener — keeps its frozen warm register.
- **Gender (VI-01 §3.6).** Masdar controls, `-ك` possessives, perfect verbs and impersonal passives; no masculine singular
  imperatives. The proof Timeline hint («اسحب … اترك … اضغط») is rewritten with masdar clauses. C-COPY-12 scans every
  proposed Arabic row for these markers.
- **English register (VI-01 §4 / §7.2; T-08).** "Context" and "live" never ship as product words. "needs more context"
  becomes "Needs more to go on", and the Live edge says "Following the conversation as it continues" (T-08's own words).
  The only "context" left is P3's APPROVED "Show context", copied as CANON. C-COPY-10 checks this.
- **Casing (P4-C2 §5).** QANDEEL everywhere in English. Earlier proofs' "Qandeel" is corrected (C-COPY-2).
- **Frozen names are copied, never re-derived** (C-COPY-3 finds each CANON row verbatim in its authority).
- **Parity, not literalism** (C-COPY-9). Both languages carry the same meaning and placeholders. The English opener
  carries the Arabic's warmth, not its word order.

## 3. The owned core copy (G3 §G → P4)

| Key | Arabic | English | Note |
|---|---|---|---|
| `door` | «تحليل المحادثة» (frozen) | **Analysis** | pairs with the frozen "Conversation" on the way back; fits beside Replay at 320 pt |
| `doorName` | «تحليل المحادثة» | **Analysis of this conversation** | begins with the visible word (label-in-name) |
| `backName` | «المحادثة» | **Conversation** | «العودة إلى المحادثة» rejected: it collides with T-08's frozen «العودة إلى المحادثة الجارية» for screen readers |
| `replayNoun` | **«إعادة العرض»** | **Replay** | see finding F-02: I-08A4 §8 / §9 still carry «عرض الجلسة» / Session Replay |
| `replayEntry` | «إعادة عرض المحادثة» | Replay this conversation | names the object; never confused with replaying a voice note |
| `timelineName` | **«الخط الزمني للمحادثة»** | Conversation timeline | the proof «خط المحادثة» did not name a timeline |
| `timelineHint` | **«للنظر مؤقتًا إلى لحظة: السحب أو مفاتيح الأسهم. وللانتقال إليها: الإفلات أو مفتاح Enter.»** | Drag, or use the arrow keys, for a temporary look at a moment. Release or press Enter to go there. | gender-neutral masdar clauses |
| `previewCancel` | **«إلغاء النظرة المؤقتة»** | **Cancel the temporary look** | uses T-08's own frozen noun «نظرة مؤقتة» / "a temporary look" |
| `previewCommit` | **«الانتقال إلى اللحظة {n}»** | Go to moment {n} | T-08's own verb «الانتقال» |
| `liveFollowing` | «أنت عند آخر المحادثة» | Following the conversation as it continues | T-08's frozen temporal sentence, reused as the terminal's name |
| `liveRejoin` | «العودة إلى المحادثة الجارية» | Rejoin the conversation | CANON (T-08) |

## 4. The normal opener

- **Arabic (CANON, exact):** «اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ». It is not "corrected": the hamza-less
  «اهلا» / «انا», the spaced ellipses and the colloquial «يلا» are frozen. The planted defect `openerdrift` (a single
  «اهلا» → «أهلًا») is rejected by C-COPY-1.
- **English (PROPOSED):** "Hi {display_name} ... I'm here, ready when you are ... let's begin". It keeps the three beats
  and the patience of «انا في انتظارك» without the needy or impatient ring of a literal "I'm waiting for you".
- It stays distinct from the First Conversation Opening / Welcome (`AUDIT_OWNED`), which is not drawn.

## 5. Understanding confidence (P1 §11.3)

| Concept | Arabic | English |
|---|---|---|
| clear | «واضح» | Clear |
| forming | «يتشكّل» | Taking shape |
| mixed / contested | «فيه تعارض» | Mixed |
| needs more context | «يحتاج سياقًا أكثر» | Needs more to go on |

The words describe the understanding, not the reader, so they need no gendered form. There are no scores and no
percentages, and colour carries nothing. «غير محسوم» was rejected because it collides with the frozen detail name «نقاط غير
محسومة».

## 6. General Settings groups (P1 §8.1; order not frozen)

«الحساب والهوية» Account & Identity · «الأمان وتسجيل الدخول» Security & Sign-in · «قنديل والمحادثة» QANDEEL & Conversation ·
«الإشعارات والنشاط» Notifications & Activity (**CANON, P3**) · «المظهر وتسهيلات الاستخدام» Appearance & Accessibility ·
«الخصوصية والبيانات» Privacy & Data · «التعارف» Introductions (**CANON**) · «الباقة والاستخدام» Plan & Usage ·
«الدعم ومعلومات التطبيق» Support & About.

The labels are built from I-08A4's frozen nouns («الحساب», «الخصوصية», «البيانات») and from the words the shipped
gateway already uses («تسجيل الدخول» / "Sign in").

## 7. Public ID warning (P1 §6)

Title «يمكن تغيير المعرّف العام مرة واحدة فقط» / "You can change your Public ID only once". The body states exactly three
facts: this is the one manual change, it lasts for the life of the account, and it is permanent after confirmation. The
two choices are equal and named: «الإبقاء على المعرّف الحالي» / "Keep current ID" and «تأكيد التغيير» / "Confirm change".
There is no danger colour, no countdown and no fear word, and no Login ID, Email, Shared ID or internal id is shown.
«المعرّف العام» is proposed as the Arabic term, because none is frozen.

## 8. P3 residual (frozen P3 surfaces)

- **Truth fix:** the Quiet Hours help said waiting items are "reviewed in the morning". P3 §13 freezes re-evaluation
  **when Quiet Hours end**, and the reader can move the window. The line now says so.
- **Register fixes:** the proactive help and the three Allow / Reduce / Off help lines are moved to T1 Arabic, and the
  masculine «معاك» is removed. The Activity empty line is moved to T1.
- **Voice fix:** the stale-target explanation spoke as "we" («لن نفتح»). It now uses an impersonal passive.
- **Heading:** «مبادرة قنديل» / "QANDEEL reaching out" is proposed. The Product Owner's direction «قنديل يبادر معايا» is
  kept as the alternative (it makes a Settings heading speak as the reader, in the first person).
- **Snooze Arabic:** «ساعة» · «8 ساعات» · «24 ساعة» · «مدة أخرى» — the counted nouns agree.
- **Unchanged status:** the permission-education sheet stays `AUDIT_OWNED`, and every event sentence stays
  `FIXTURE_ONLY`.

## 9. Runtime-gated (shown only as proof)

All VI-01 V01–V07 words and the call accessible phrases stay `RUNTIME_GATED`. That includes «كتم الميكروفون» and
«إنهاء المكالمة», which P3-A's table marks CANON (finding F-03). The only gated words the page shows are the capture word
«بسجّل» / "Recording" and the call record's «مكالمة صوتية» / "Voice call". The boards label both PROOF ONLY / NOT COPY
FREEZE.
