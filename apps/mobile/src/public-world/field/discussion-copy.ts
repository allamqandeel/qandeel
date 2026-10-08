/**
 * S5-04 — the copy of the dependent Public discussion, the Experience panel's Discussion entry and publication date.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - CANON: «قنديل» / QANDEEL (I-08A4 §8–§9), the attribution of a Public QANDEEL response — truthful, and never a
 *     human Public identity;
 *   - REUSED: words other surfaces already froze for the same fact, read from their own modules: the composer
 *     placeholder, Send, «قنديل: …» / "QANDEEL: …" (the accessible form of a QANDEEL turn), waiting for QANDEEL's reply,
 *     QANDEEL's reply could not be completed, the send could not be confirmed / was refused (W1A-01 Product Copy Gate);
 *     Back, Cancel, Try again and «شخص ما» / Someone (S4-01 Product Copy Gate); the no-longer-in-Public-World line
 *     and the cannot-be-shown-right-now line (S5-03B Product Copy Gate);
 *   - APPROVED — the S5-04 PRODUCT COPY GATE, CLOSED (ONE bounded gate for the whole task; implementation record §14):
 *     every genuinely new string below, approved by the Product Owner (2026-10-08) exactly as proposed.
 *
 * No string counts popularity, ranks, names a like, a follower, a contact or a private message, calls a count importance
 * or truth, or says why something is unavailable.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import { conversationCopy } from '../../conversation';
import { sharedCopy } from '../../shared-world/copy';
import { publicFieldCopy } from './field-copy';

export const PUBLIC_DISCUSSION_COPY_GATE = {
  status: 'S5-04 PRODUCT COPY GATE — CLOSED — 9 rows APPROVED (Product Owner, 2026-10-08; with the 3 Public Activity rows: 12 / 12)',
  canon: ['qandeel'],
  reused: ['composerPlaceholder', 'send', 'qandeelSays', 'qandeelPending', 'qandeelUnavailable', 'sendUnconfirmed', 'sendRefused', 'back',
    'cancel', 'retry', 'someone', 'experienceUnavailable', 'unavailable'],
  approved: ['discussion', 'discussionWithCount', 'noPosts', 'composerName', 'reply', 'replyingTo', 'invokeHint', 'publishedOn', 'morePosts'],
  proposed: [],
} as const;

export interface PublicDiscussionCopy {
  /** The Discussion entry in the panel (no posts yet) and the discussion's heading. */
  readonly discussion: string;
  /** "Discussion · {0}" — the entry with the human discussion count; never a QANDEEL count, never a ranking. */
  readonly discussionWithCount: string;
  readonly noPosts: string;
  /** The composer's accessible name. */
  readonly composerName: string;
  readonly reply: string;
  /** "Replying to {0}" — {0}: the post author's Public display, or «شخص ما» / Someone. */
  readonly replyingTo: string;
  /** How to ask QANDEEL here, and that its answer is public. */
  readonly invokeHint: string;
  /** "Published {0}" — {0}: the publication date. */
  readonly publishedOn: string;
  readonly morePosts: string;
  readonly qandeel: string;
  readonly qandeelSays: (text: string) => string;
  readonly qandeelPending: string;
  readonly qandeelUnavailable: string;
  readonly composerPlaceholder: string;
  readonly send: string;
  readonly sendUnconfirmed: string;
  readonly sendRefused: string;
  readonly back: string;
  readonly cancel: string;
  readonly retry: string;
  readonly someone: string;
  readonly experienceUnavailable: string;
  /** The discussion could not be read now. */
  readonly unavailable: string;
}

const AR = {
  discussion: 'النقاش', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  discussionWithCount: 'النقاش · {0}', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  noPosts: 'لا مشاركات بعد.', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  composerName: 'مشاركتك في هذا النقاش', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  reply: 'ردّ', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  replyingTo: 'ردّ على {0}', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  invokeHint: 'اكتب ‎@qandeel لتسأل قنديل هنا، وردّه يظهر للجميع.', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  publishedOn: 'نُشرت في {0}', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  morePosts: 'عرض المزيد من المشاركات', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
} as const;

const EN = {
  discussion: 'Discussion', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  discussionWithCount: 'Discussion · {0}', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  noPosts: 'No posts yet.', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  composerName: 'Your post in this discussion', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  reply: 'Reply', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  replyingTo: 'Replying to {0}', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  invokeHint: 'Write @qandeel to ask QANDEEL here. Its answer is visible to everyone.', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  publishedOn: 'Published {0}', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
  morePosts: 'Show more posts', // APPROVED — S5-04 Product Copy Gate (Product Owner, 2026-10-08)
} as const;

function build(language: ChromeLanguage): PublicDiscussionCopy {
  const conversation = conversationCopy(language); // REUSED — W1A-01 Product Copy Gate
  const shared = sharedCopy(language); // REUSED — S4-01 Product Copy Gate
  const field = publicFieldCopy(language); // REUSED — S5-03B Product Copy Gate
  return Object.freeze({
    ...(language === 'ar' ? AR : EN),
    qandeel: conversation.product, // CANON — I-08A4 §8 / §9
    qandeelSays: conversation.replyTurnName, // REUSED — W1A-01
    qandeelPending: conversation.waitingForReply, // REUSED — W1A-01
    qandeelUnavailable: conversation.replyFailed, // REUSED — W1A-01
    composerPlaceholder: conversation.composerPlaceholder, // REUSED — W1A-01
    send: conversation.sendName, // REUSED — W1A-01
    sendUnconfirmed: conversation.sendUnconfirmed, // REUSED — W1A-01
    sendRefused: conversation.sendRefused, // REUSED — W1A-01
    back: shared.back, // REUSED — S4-01
    cancel: shared.cancel, // REUSED — S4-01
    retry: shared.retry, // REUSED — S4-01
    someone: shared.someone, // REUSED — S4-01
    experienceUnavailable: field.experienceUnavailable, // REUSED — S5-03B
    unavailable: field.fieldUnavailable, // REUSED — S5-03B
  });
}

const BUILT = { ar: build('ar'), en: build('en') } as const;

export function publicDiscussionCopy(language: ChromeLanguage): PublicDiscussionCopy {
  return BUILT[language];
}

/** "{0}" substitution, the same convention the other Public copy uses. */
export const fillDiscussionCopy = (template: string, value: string): string => template.replace('{0}', value);
