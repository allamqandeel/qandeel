# QANDEEL — S6-04 Product Copy Gate Package v1

**Task:** S6-04 — Private Proposal Review and Decisions  
**Status:** `PROPOSED — AWAITING THE PRODUCT OWNER'S FINAL APPROVAL (ONE CONSOLIDATED PACKAGE)`  
**Source of truth for the strings:** [`apps/mobile/src/introductions/proposals-copy.ts`](../../apps/mobile/src/introductions/proposals-copy.ts).
The table in §3 is generated mechanically from that module (`PROPOSALS_COPY_ROWS`), so it is byte-identical to what the
application renders. Nothing here is approved by being written down: the gate closes only on the Product Owner's
explicit approval (Task Contract §5, AC-13).

## 1. Rules the package follows

- **Language (D12, the Product Owner's rule of 2026-10-13):** fixed Arabic is simplified Modern Standard Arabic,
  natural and gender-considerate. Where a second-person verb would mark gender, a row uses a noun or a form spelled
  alike for both (for example «يمكنك مراجعة المقترح» rather than an imperative). No Arabic row carries a Latin letter,
  so no English word can be reordered inside Arabic text. English is a separate version.
- **Neutrality (D3, D9):** no row names, describes or ranks a person; no row reveals why a proposal ended or what the
  other person did; no row claims an analysis that did not happen.
- **LANG-01:** M-01 and M-03 are used verbatim (byte-checked against the G2.3 controlled amendment in the mobile test
  suite). M-02 («نقاط اتفاق كثيرة») is **not used**: no genuine permitted conclusion is presented before Mutual Match
  (CW2-06B-07 / -08). No historical frozen text is edited.
- **The Task Contract's approved directions** are used as written for `arrival`, `forwardNotYet`, `declineAction`,
  `withdrawAction`, `confirmAllow`, `inProgressBody`, `unavailableBody` and `empty`.

## 2. Decisions this package asks for

| # | Question | Proposal | Recommendation |
|---|---|---|---|
| CG-1 | The contract's review line «راجع المقترح وخد قرارك براحتك» is colloquial (Task Contract §5) | `reviewLead`: «يمكنك مراجعة المقترح واتخاذ قرارك على مهل.» / "Review the proposal and take your time to decide." | Approve |
| CG-2 | Where M-01 may be shown (its truth condition, Task Contract §5) | On the review of a proposal that is **waiting for this human's decision**, for both recipients. A recipient view cannot exist without a permitted conclusion produced for that exact pair and recipient (0111 / 0120 / 0156 bind it), so the sentence's basis — QANDEEL's understanding of each of them — exists whenever this screen can be drawn. It is never shown on the card, the space, or an ended proposal | Approve; alternative: omit M-01 and keep `reviewLead` as the first line |
| CG-3 | M-03 on the review | Shown verbatim on the review of a waiting proposal | Approve |
| CG-4 | The second recipient cannot accept yet (S6-05) | `acceptNotYet`: «خيار بدء التعارف من هذا المقترح غير متاح بعد.» — it says nothing about the other person | Approve |
| CG-5 | The status after Mutual Match (S6-05 owns the Introduction itself) | `MATCH_CONCLUDED` «انتقل إلى مرحلة التعارف» and `concludedBody` | Approve |
| CG-6 | The English version | All English rows, including English renderings of M-01 and M-03 (LANG-01 approved Arabic only) | Approve |
| CG-7 | Accessibility labels | A card is read as "title, status" (`cardTitle` + the status row); the Introductions entry, while a proposal waits, is read as "Introductions with QANDEEL, `arrival`" | Approve |

## 3. Every row (generated from the module)

| # | Key | Arabic | English | State |
|---|---|---|---|---|
| 1 | `spaceTitle` | مقترحات التعارف | Introduction proposals | PROPOSED |
| 2 | `arrival` | لديك مقترح تعارف خاص يمكنك مراجعته. | You have a private introduction proposal to review. | PROPOSED — contract direction (Arabic as written) |
| 3 | `openSpace` | عرض المقترحات | View proposals | PROPOSED |
| 4 | `spaceIntro` | هذه مقترحات التعارف الخاصة التي قدّمها لك قنديل. لا يراها أحد غيرك. | These are the private introduction proposals QANDEEL has made to you. No one else sees them. | PROPOSED |
| 5 | `empty` | لا توجد مقترحات لمراجعتها حاليًا. | There are no proposals to review right now. | PROPOSED — contract direction (Arabic as written) |
| 6 | `loading` | جارٍ عرض المقترحات… | Loading proposals… | PROPOSED |
| 7 | `unavailable` | تعذّر عرض المقترحات الآن. | Proposals can't be shown right now. | PROPOSED |
| 8 | `offline` | لا يوجد اتصال الآن. يمكنك المحاولة مرة أخرى عند عودة الاتصال. | You're offline. You can try again once you're back online. | PROPOSED |
| 9 | `tryAgain` | إعادة المحاولة | Try again | PROPOSED |
| 10 | `more` | عرض المزيد | Show more | PROPOSED |
| 11 | `back` | رجوع | Back | PROPOSED |
| 12 | `cardTitle` | مقترح تعارف خاص | Private introduction proposal | PROPOSED |
| 13 | `AWAITING_YOU` | بانتظار قرارك | Waiting for your decision | PROPOSED |
| 14 | `IN_PROGRESS` | قيد المتابعة | In progress | PROPOSED |
| 15 | `CLOSED_BY_YOU` | انتهى بقرارك | Ended by your decision | PROPOSED |
| 16 | `NO_LONGER_AVAILABLE` | لم يعد متاحًا | No longer available | PROPOSED |
| 17 | `MATCH_CONCLUDED` | انتقل إلى مرحلة التعارف | Moved on to an introduction | PROPOSED |
| 18 | `opening` | يرى قنديل، بناءً على فهمه لكلٍّ منكما، أن هناك شخصًا يستحق التعرّف إليه، وأن بينكما مساحة تستحق الاستكشاف معًا. | Based on its understanding of each of you, QANDEEL sees someone worth getting to know, and room between you worth exploring together. | APPROVED — LANG-01 M-01 (Arabic, verbatim); context and English PROPOSED |
| 19 | `reviewLead` | يمكنك مراجعة المقترح واتخاذ قرارك على مهل. | Review the proposal and take your time to decide. | PROPOSED — MSA replacement of the contract's colloquial line |
| 20 | `qandeelRole` | يقترح قنديل ولا يقرر عنك؛ القرار لك في كل خطوة. | QANDEEL suggests; it never decides for you. Every step is your choice. | PROPOSED |
| 21 | `privacy` | خصوصيتك محفوظة. لن تُعرض بياناتك وتحليلاتك الخاصة على الطرف الآخر، ولن يُشارَك منها شيء إلا باختيارك. وسيكون قنديل معك خطوة بخطوة، حرصًا على راحتك وطمأنينتك. | Your privacy is protected. Your private data and analysis won't be shown to the other person, and nothing is shared unless you choose. QANDEEL will be with you step by step, for your comfort and peace of mind. | APPROVED — LANG-01 M-03 (Arabic, verbatim); context and English PROPOSED |
| 22 | `forwardTitle` | ماذا يعني السماح؟ | What does allowing mean? | PROPOSED |
| 23 | `forwardMeaning` | إذا سمحت بذلك، يقدّم قنديل للطرف الآخر مقترحًا خاصًا ومستقلًا. | If you allow it, QANDEEL makes the other person a separate, private proposal. | PROPOSED |
| 24 | `forwardNotYet` | هذه الخطوة لا تبدأ التعارف الآن. | This step doesn't start an introduction yet. | PROPOSED — contract direction (Arabic as written) |
| 25 | `forwardMutual` | لا يبدأ التعارف إلا إذا وافق الطرفان. | An introduction begins only if you both agree. | PROPOSED |
| 26 | `forwardWithdrawNote` | يمكنك سحب موافقتك لاحقًا ما دام التعارف لم يبدأ. | You can withdraw your approval later, as long as the introduction hasn't begun. | PROPOSED |
| 27 | `allowAction` | السماح بتقديم المقترح | Allow the proposal | PROPOSED |
| 28 | `confirmTitle` | قبل التأكيد | Before you confirm | PROPOSED |
| 29 | `confirmAllow` | أسمح لقنديل بتقديم مقترح خاص ومستقل للطرف الآخر | I allow QANDEEL to make the other person a separate, private proposal | PROPOSED — contract direction (Arabic as written) |
| 30 | `declineAction` | لا أرغب في متابعة هذا المقترح | I don't want to continue with this proposal | PROPOSED — contract direction (Arabic as written) |
| 31 | `confirmDeclineBody` | سينتهي هذا المقترح، ولن يُطلب منك ذكر أي سبب. | This proposal will end. You won't be asked for a reason. | PROPOSED |
| 32 | `confirm` | تأكيد | Confirm | PROPOSED |
| 33 | `acceptNotYet` | خيار بدء التعارف من هذا المقترح غير متاح بعد. | Starting an introduction from this proposal isn't available yet. | PROPOSED |
| 34 | `decisionsPaused` | لا يمكن اتخاذ قرار في هذا المقترح الآن. | Decisions on this proposal aren't available right now. | PROPOSED |
| 35 | `inProgressBody` | تم تسجيل قرارك. المقترح قيد المتابعة. | Your decision is recorded. The proposal is in progress. | PROPOSED — contract direction (Arabic as written) |
| 36 | `withdrawAction` | أريد سحب موافقتي على متابعة المقترح | I want to withdraw my approval of this proposal | PROPOSED — contract direction (Arabic as written) |
| 37 | `confirmWithdrawBody` | إذا سحبت موافقتك، ينتهي هذا المقترح ولن يُتابَع، ولا يمكن التراجع عن ذلك. | If you withdraw your approval, this proposal ends and won't continue. This can't be undone. | PROPOSED |
| 38 | `closedBody` | انتهى هذا المقترح بقرارك. | This proposal ended by your decision. | PROPOSED |
| 39 | `unavailableBody` | لم يعد هذا المقترح متاحًا. | This proposal is no longer available. | PROPOSED — contract direction (Arabic as written) |
| 40 | `concludedBody` | انتقل هذا المقترح إلى مرحلة التعارف. | This proposal has moved on to an introduction. | PROPOSED |
| 41 | `recordedDecline` | تم تسجيل قرارك. لن يُتابَع هذا المقترح. | Your decision is recorded. This proposal won't continue. | PROPOSED |
| 42 | `recordedWithdraw` | تم سحب موافقتك. لن يُتابَع هذا المقترح. | Your approval is withdrawn. This proposal won't continue. | PROPOSED |
| 43 | `changed` | تغيّر هذا المقترح أثناء مراجعتك. يمكنك مراجعته مرة أخرى. | This proposal changed while you were reviewing it. You can review it again. | PROPOSED |
| 44 | `notNow` | لا يمكن اتخاذ هذا القرار الآن. يمكنك المحاولة لاحقًا. | This decision can't be made right now. You can try again later. | PROPOSED |
| 45 | `failed` | تعذّر إرسال قرارك. يمكنك المحاولة مرة أخرى. | Your decision couldn't be sent. You can try again. | PROPOSED |
| 46 | `invalid` | تعذّر تنفيذ هذا الطلب. | This request couldn't be completed. | PROPOSED |

## 4. Where each row is used

- **The entry and the quiet cue (D1, D11):** `arrival` (screen-reader label of the entry while a proposal waits; one line
  in the cue), `openSpace`, `spaceTitle`.
- **The space (D2):** `spaceTitle`, `spaceIntro`, `loading`, `empty`, `unavailable`, `offline`, `tryAgain`, `more`, `back`.
- **The card (D3, D9):** `cardTitle` and one of `AWAITING_YOU`, `IN_PROGRESS`, `CLOSED_BY_YOU`, `NO_LONGER_AVAILABLE`,
  `MATCH_CONCLUDED`.
- **The review (D4, D5, D8):** `opening` (M-01), `reviewLead`, `qandeelRole`, `forwardTitle`, `forwardMeaning`,
  `forwardNotYet`, `forwardMutual`, `forwardWithdrawNote`, `acceptNotYet`, `decisionsPaused`, `privacy` (M-03),
  `allowAction`, `declineAction`, `withdrawAction`; for an ended or progressing proposal `inProgressBody`, `closedBody`,
  `unavailableBody`, `concludedBody`.
- **The confirmations (D5, D6, D7):** `confirmTitle`, `confirmAllow`, `confirmDeclineBody`, `confirmWithdrawBody`,
  `confirm`, `back`.
- **After a decision (D10):** `recordedDecline`, `recordedWithdraw`, `changed`, `unavailableBody`, `notNow`, `failed`,
  `invalid`.
