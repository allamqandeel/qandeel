/**
 * S8A-05 CP4 — the words that show how a Public discussion thread connects (Controlled Amendment A-5(a) / (b)): which posts
 * the topic's author wrote, and which post a reply answers when it is not its thread's first post.
 *
 * Fixed Arabic is simplified Modern Standard Arabic and gender-considerate (LANG-01). Each row carries two statuses, and
 * nothing here is promoted by being shipped. `status` is the Arabic row's; `enStatus` is the English row's:
 *
 *   APPROVED  — approved verbatim by the Product Owner at the S8A-05 CP4 Product Copy Gate (2026-10-27: both rows, Arabic
 *               and English, without edits; the gate is CLOSED);
 *   PROPOSED  — shown to the Product Owner at that gate, not yet approved (no row now).
 *
 * Deliberately absent: a name or a count, any word ranking the author's posts above others, and any reason a target
 * cannot be shown.
 */
import type { ChromeLanguage } from '../orientation-chrome';

export type PublicAuthorshipCopyStatus = 'APPROVED' | 'PROPOSED';

interface Row {
  readonly ar: string;
  readonly en: string;
  readonly status: PublicAuthorshipCopyStatus;
  readonly enStatus: PublicAuthorshipCopyStatus;
  readonly source: string;
}

const CP4 = 'S8A-05 CP4 Product Copy Gate — APPROVED verbatim, Arabic and English (Product Owner, 2026-10-27)';
const approved = (ar: string, en: string): Row => ({ ar, en, status: 'APPROVED', enStatus: 'APPROVED', source: CP4 });

export const PUBLIC_AUTHORSHIP_COPY_ROWS = Object.freeze({
  /** Beside the author's display on every post the topic's author wrote (A-5(b)); read with the author's display. */
  opTag: approved('صاحب الموضوع', 'Topic author'),
  /** Above a reply that answers a reply (A-5(a)); {0}: the answered post's author display, or «شخص ما» / Someone. Tapping it shows that post. */
  inReplyTo: approved('ردًا على {0}', 'In reply to {0}'),
});

export const PUBLIC_AUTHORSHIP_COPY_GATE = Object.freeze({
  status: 'S8A-05 CP4 PRODUCT COPY GATE — CLOSED — 2 rows APPROVED in Arabic and English (Product Owner, 2026-10-27, without edits)',
  rows: Object.keys(PUBLIC_AUTHORSHIP_COPY_ROWS),
});

export type PublicAuthorshipCopy = { readonly [K in keyof typeof PUBLIC_AUTHORSHIP_COPY_ROWS]: string };

const build = (language: ChromeLanguage): PublicAuthorshipCopy => Object.freeze(Object.fromEntries(
  Object.entries(PUBLIC_AUTHORSHIP_COPY_ROWS).map(([key, row]) => [key, language === 'ar' ? row.ar : row.en]),
) as PublicAuthorshipCopy);
const BUILT = { ar: build('ar'), en: build('en') } as const;

export function publicAuthorshipCopy(language: ChromeLanguage): PublicAuthorshipCopy {
  return BUILT[language];
}
