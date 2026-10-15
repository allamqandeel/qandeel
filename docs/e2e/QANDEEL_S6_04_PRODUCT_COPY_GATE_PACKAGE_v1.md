# QANDEEL — S6-04 Product Copy Gate Package v1

**Task:** S6-04 — Private Proposal Review and Decisions  
**Status:** `CLOSED — APPROVED BY THE PRODUCT OWNER (2026-10-15)` — every displayed row approved; M-01 kept exactly but not
displayed in S6-04 (CG-2, §0).  
**Source of truth for the strings:** [`apps/mobile/src/introductions/proposals-copy.ts`](../../apps/mobile/src/introductions/proposals-copy.ts).
The table in §3 is generated mechanically from that module (`PROPOSALS_COPY_ROWS`), so it is byte-identical to what the
application renders (45 rows after the CG-2 decision; the package first proposed 46).

## 0. The Product Owner's decision (2026-10-15)

Recorded verbatim from the Product Owner's review of the S6-04 report, PR #342 and this package:

> CG-1 وCG-3 وCG-4 وCG-5 وCG-6 وCG-7: أوافق على التوصيات والنصوص الواردة في الحزمة.
>
> CG-2: لا أعتمد تبرير أن وجود استنتاج محفوظ وحده يثبت فهم قنديل الحقيقي للطرفين. احتفظ بنص M-01 المعتمد، لكن لا
> تعرضه في تجربة S6-04 الحالية. تفعيله مستقبلًا مشروط بدليل حقيقي من Stage 8A. لا تستبدله بادعاء توافق غير مثبت.

Applied in the S6-04 pull request:

- **Approved:** CG-1 (`reviewLead`), CG-3 (M-03 verbatim on the review of a waiting proposal), CG-4 (`acceptNotYet`), CG-5
  (`MATCH_CONCLUDED`, `concludedBody`), CG-6 (every English row), CG-7 (the accessibility labels), and the texts of this package.
  Every displayed row in §3 is marked `APPROVED` in the module.
- **CG-2 — not approved as proposed:** the justification that a stored permitted conclusion by itself proves QANDEEL's
  genuine understanding of both people is rejected. M-01 stays byte-exact in `PROPOSALS_LANG01_APPROVED` and is
  **displayed nowhere in S6-04** (the `opening` row is removed; `reviewLead` is the review's first line). Showing it later
  requires real Stage 8A evidence; nothing replaces it with an unproven compatibility claim. Its English rendering
  ("Based on its understanding of each of you, QANDEEL sees someone worth getting to know, and room between you worth
  exploring together.") is kept here for that future decision and is not rendered.
- **Still open in this package:** nothing for S6-04. The future display of M-01 is a Stage 8A-conditioned decision, not
  an open S6-04 row.

## 1. Rules the package follows

- **Language (D12, the Product Owner's rule of 2026-10-13):** fixed Arabic is simplified Modern Standard Arabic,
  natural and gender-considerate. Where a second-person verb would mark gender, a row uses a noun or a form spelled
  alike for both (for example «يمكنك مراجعة المقترح» rather than an imperative). No Arabic row carries a Latin letter,
  so no English word can be reordered inside Arabic text. English is a separate version.
- **Neutrality (D3, D9):** no row names, describes or ranks a person; no row reveals why a proposal ended or what the
  other person did; no row claims an analysis that did not happen.
- **LANG-01:** M-03 is used verbatim and M-01 is kept verbatim but not displayed (CG-2); both are byte-checked against
  the G2.3 controlled amendment in the mobile test suite. M-02 («نقاط اتفاق كثيرة») is **not used**: no genuine permitted conclusion is presented before Mutual Match
  (CW2-06B-07 / -08). No historical frozen text is edited.
- **The Task Contract's approved directions** are used as written for `arrival`, `forwardNotYet`, `declineAction`,
  `withdrawAction`, `confirmAllow`, `inProgressBody`, `unavailableBody` and `empty`.

## 2. Decisions this package asks for

| # | Question | Proposal | Recommendation → decision (2026-10-15) |
|---|---|---|---|
| CG-1 | The contract's review line «راجع المقترح وخد قرارك براحتك» is colloquial (Task Contract §5) | `reviewLead`: «يمكنك مراجعة المقترح واتخاذ قرارك على مهل.» / "Review the proposal and take your time to decide." | Approve → **APPROVED** |
| CG-2 | Where M-01 may be shown (its truth condition, Task Contract §5) | On the review of a proposal that is **waiting for this human's decision**, for both recipients. A recipient view cannot exist without a permitted conclusion produced for that exact pair and recipient (0111 / 0120 / 0156 bind it), so the sentence's basis — QANDEEL's understanding of each of them — exists whenever this screen can be drawn. It is never shown on the card, the space, or an ended proposal | Approve; alternative: omit M-01 and keep `reviewLead` as the first line → **NOT APPROVED as proposed: M-01 kept, not displayed in S6-04; future use needs real Stage 8A evidence (§0)** |
| CG-3 | M-03 on the review | Shown verbatim on the review of a waiting proposal | Approve → **APPROVED** |
| CG-4 | The second recipient cannot accept yet (S6-05) | `acceptNotYet`: «خيار بدء التعارف من هذا المقترح غير متاح بعد.» — it says nothing about the other person | Approve → **APPROVED** |
| CG-5 | The status after Mutual Match (S6-05 owns the Introduction itself) | `MATCH_CONCLUDED` «انتقل إلى مرحلة التعارف» and `concludedBody` | Approve → **APPROVED** |
| CG-6 | The English version | All English rows, including English renderings of M-01 and M-03 (LANG-01 approved Arabic only) | Approve → **APPROVED** |
| CG-7 | Accessibility labels | A card is read as "title, status" (`cardTitle` + the status row); the Introductions entry, while a proposal waits, is read as "Introductions with QANDEEL, `arrival`" | Approve → **APPROVED** |

## 3. Every row (generated from the module)

| # | Key | Arabic | English | State |
|---|---|---|---|---|
| 1 | `spaceTitle` | مقترحات التعارف | Introduction proposals | APPROVED (Product Owner, 2026-10-15) |
| 2 | `arrival` | لديك مقترح تعارف خاص يمكنك مراجعته. | You have a private introduction proposal to review. | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 3 | `openSpace` | عرض المقترحات | View proposals | APPROVED (Product Owner, 2026-10-15) |
| 4 | `spaceIntro` | هذه مقترحات التعارف الخاصة التي قدّمها لك قنديل. لا يراها أحد غيرك. | These are the private introduction proposals QANDEEL has made to you. No one else sees them. | APPROVED (Product Owner, 2026-10-15) |
| 5 | `empty` | لا توجد مقترحات لمراجعتها حاليًا. | There are no proposals to review right now. | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 6 | `loading` | جارٍ عرض المقترحات… | Loading proposals… | APPROVED (Product Owner, 2026-10-15) |
| 7 | `unavailable` | تعذّر عرض المقترحات الآن. | Proposals can't be shown right now. | APPROVED (Product Owner, 2026-10-15) |
| 8 | `offline` | لا يوجد اتصال الآن. يمكنك المحاولة مرة أخرى عند عودة الاتصال. | You're offline. You can try again once you're back online. | APPROVED (Product Owner, 2026-10-15) |
| 9 | `tryAgain` | إعادة المحاولة | Try again | APPROVED (Product Owner, 2026-10-15) |
| 10 | `more` | عرض المزيد | Show more | APPROVED (Product Owner, 2026-10-15) |
| 11 | `back` | رجوع | Back | APPROVED (Product Owner, 2026-10-15) |
| 12 | `cardTitle` | مقترح تعارف خاص | Private introduction proposal | APPROVED (Product Owner, 2026-10-15) |
| 13 | `AWAITING_YOU` | بانتظار قرارك | Waiting for your decision | APPROVED (Product Owner, 2026-10-15) |
| 14 | `IN_PROGRESS` | قيد المتابعة | In progress | APPROVED (Product Owner, 2026-10-15) |
| 15 | `CLOSED_BY_YOU` | انتهى بقرارك | Ended by your decision | APPROVED (Product Owner, 2026-10-15) |
| 16 | `NO_LONGER_AVAILABLE` | لم يعد متاحًا | No longer available | APPROVED (Product Owner, 2026-10-15) |
| 17 | `MATCH_CONCLUDED` | انتقل إلى مرحلة التعارف | Moved on to an introduction | APPROVED (Product Owner, 2026-10-15) |
| 18 | `reviewLead` | يمكنك مراجعة المقترح واتخاذ قرارك على مهل. | Review the proposal and take your time to decide. | APPROVED (Product Owner, 2026-10-15) — MSA replacement of the contract's colloquial line |
| 19 | `qandeelRole` | يقترح قنديل ولا يقرر عنك؛ القرار لك في كل خطوة. | QANDEEL suggests; it never decides for you. Every step is your choice. | APPROVED (Product Owner, 2026-10-15) |
| 20 | `privacy` | خصوصيتك محفوظة. لن تُعرض بياناتك وتحليلاتك الخاصة على الطرف الآخر، ولن يُشارَك منها شيء إلا باختيارك. وسيكون قنديل معك خطوة بخطوة، حرصًا على راحتك وطمأنينتك. | Your privacy is protected. Your private data and analysis won't be shown to the other person, and nothing is shared unless you choose. QANDEEL will be with you step by step, for your comfort and peace of mind. | APPROVED — LANG-01 M-03 (Arabic, verbatim); context and English approved (CG-3, CG-6) |
| 21 | `forwardTitle` | ماذا يعني السماح؟ | What does allowing mean? | APPROVED (Product Owner, 2026-10-15) |
| 22 | `forwardMeaning` | إذا سمحت بذلك، يقدّم قنديل للطرف الآخر مقترحًا خاصًا ومستقلًا. | If you allow it, QANDEEL makes the other person a separate, private proposal. | APPROVED (Product Owner, 2026-10-15) |
| 23 | `forwardNotYet` | هذه الخطوة لا تبدأ التعارف الآن. | This step doesn't start an introduction yet. | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 24 | `forwardMutual` | لا يبدأ التعارف إلا إذا وافق الطرفان. | An introduction begins only if you both agree. | APPROVED (Product Owner, 2026-10-15) |
| 25 | `forwardWithdrawNote` | يمكنك سحب موافقتك لاحقًا ما دام التعارف لم يبدأ. | You can withdraw your approval later, as long as the introduction hasn't begun. | APPROVED (Product Owner, 2026-10-15) |
| 26 | `allowAction` | السماح بتقديم المقترح | Allow the proposal | APPROVED (Product Owner, 2026-10-15) |
| 27 | `confirmTitle` | قبل التأكيد | Before you confirm | APPROVED (Product Owner, 2026-10-15) |
| 28 | `confirmAllow` | أسمح لقنديل بتقديم مقترح خاص ومستقل للطرف الآخر | I allow QANDEEL to make the other person a separate, private proposal | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 29 | `declineAction` | لا أرغب في متابعة هذا المقترح | I don't want to continue with this proposal | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 30 | `confirmDeclineBody` | سينتهي هذا المقترح، ولن يُطلب منك ذكر أي سبب. | This proposal will end. You won't be asked for a reason. | APPROVED (Product Owner, 2026-10-15) |
| 31 | `confirm` | تأكيد | Confirm | APPROVED (Product Owner, 2026-10-15) |
| 32 | `acceptNotYet` | خيار بدء التعارف من هذا المقترح غير متاح بعد. | Starting an introduction from this proposal isn't available yet. | APPROVED (Product Owner, 2026-10-15) |
| 33 | `decisionsPaused` | لا يمكن اتخاذ قرار في هذا المقترح الآن. | Decisions on this proposal aren't available right now. | APPROVED (Product Owner, 2026-10-15) |
| 34 | `inProgressBody` | تم تسجيل قرارك. المقترح قيد المتابعة. | Your decision is recorded. The proposal is in progress. | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 35 | `withdrawAction` | أريد سحب موافقتي على متابعة المقترح | I want to withdraw my approval of this proposal | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 36 | `confirmWithdrawBody` | إذا سحبت موافقتك، ينتهي هذا المقترح ولن يُتابَع، ولا يمكن التراجع عن ذلك. | If you withdraw your approval, this proposal ends and won't continue. This can't be undone. | APPROVED (Product Owner, 2026-10-15) |
| 37 | `closedBody` | انتهى هذا المقترح بقرارك. | This proposal ended by your decision. | APPROVED (Product Owner, 2026-10-15) |
| 38 | `unavailableBody` | لم يعد هذا المقترح متاحًا. | This proposal is no longer available. | APPROVED (Product Owner, 2026-10-15) — contract direction (Arabic as written) |
| 39 | `concludedBody` | انتقل هذا المقترح إلى مرحلة التعارف. | This proposal has moved on to an introduction. | APPROVED (Product Owner, 2026-10-15) |
| 40 | `recordedDecline` | تم تسجيل قرارك. لن يُتابَع هذا المقترح. | Your decision is recorded. This proposal won't continue. | APPROVED (Product Owner, 2026-10-15) |
| 41 | `recordedWithdraw` | تم سحب موافقتك. لن يُتابَع هذا المقترح. | Your approval is withdrawn. This proposal won't continue. | APPROVED (Product Owner, 2026-10-15) |
| 42 | `changed` | تغيّر هذا المقترح أثناء مراجعتك. يمكنك مراجعته مرة أخرى. | This proposal changed while you were reviewing it. You can review it again. | APPROVED (Product Owner, 2026-10-15) |
| 43 | `notNow` | لا يمكن اتخاذ هذا القرار الآن. يمكنك المحاولة لاحقًا. | This decision can't be made right now. You can try again later. | APPROVED (Product Owner, 2026-10-15) |
| 44 | `failed` | تعذّر إرسال قرارك. يمكنك المحاولة مرة أخرى. | Your decision couldn't be sent. You can try again. | APPROVED (Product Owner, 2026-10-15) |
| 45 | `invalid` | تعذّر تنفيذ هذا الطلب. | This request couldn't be completed. | APPROVED (Product Owner, 2026-10-15) |

## 4. Where each row is used

- **The entry and the quiet cue (D1, D11):** `arrival` (screen-reader label of the entry while a proposal waits; one line
  in the cue), `openSpace`, `spaceTitle`.
- **The space (D2):** `spaceTitle`, `spaceIntro`, `loading`, `empty`, `unavailable`, `offline`, `tryAgain`, `more`, `back`.
- **The card (D3, D9):** `cardTitle` and one of `AWAITING_YOU`, `IN_PROGRESS`, `CLOSED_BY_YOU`, `NO_LONGER_AVAILABLE`,
  `MATCH_CONCLUDED`.
- **The review (D4, D5, D8):** `reviewLead` (first line; M-01 is not displayed, CG-2), `qandeelRole`, `forwardTitle`, `forwardMeaning`,
  `forwardNotYet`, `forwardMutual`, `forwardWithdrawNote`, `acceptNotYet`, `decisionsPaused`, `privacy` (M-03),
  `allowAction`, `declineAction`, `withdrawAction`; for an ended or progressing proposal `inProgressBody`, `closedBody`,
  `unavailableBody`, `concludedBody`.
- **The confirmations (D5, D6, D7):** `confirmTitle`, `confirmAllow`, `confirmDeclineBody`, `confirmWithdrawBody`,
  `confirm`, `back`.
- **After a decision (D10):** `recordedDecline`, `recordedWithdraw`, `changed`, `unavailableBody`, `notNow`, `failed`,
  `invalid`.
