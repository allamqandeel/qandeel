/**
 * S5-01 — the «العالم العام» / Public World copy: the destination word, the Global Switcher's accessible name for its
 * three destinations, and the Public display choice in General Settings → Account & Identity.
 *
 * Every string carries its source, as the other surfaces' copy modules do:
 *
 *   - CANON: «العالم العام» / Public World (I-08A4 §8–§9);
 *   - REUSED: words other surfaces already froze, read from their own modules rather than retyped — the Shared area's
 *     approved neutral shell words (`opening`, `worldUnavailable`, `retry`; S4-01 Product Copy Gate), the W3-02 Public ID
 *     term (`pidTerm`, P4-C4 §5) and the account Name term (W1B-01);
 *   - PROPOSED — S5-01 Product Copy Gate: the two genuinely new strings below. They are drawn in the frozen register
 *     (I-08A4 §11) and in the existing wording pattern, and they bind nothing until the Product Owner approves them.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from '../shared-world/copy';

export const PUBLIC_COPY_GATE = {
  status: 'S5-01 PRODUCT COPY GATE — OPEN (2 rows PROPOSED for Product Owner approval)',
  canon: ['publicWorld'],
  reused: ['opening', 'worldUnavailable', 'retry'],
  proposed: ['switcherLabel', 'displayHeading'],
} as const;

export interface PublicCopy {
  readonly publicWorld: string;
  /** The Global Switcher's accessible name, now naming all three destinations. Accessible name only. */
  readonly switcherLabel: string;
  /** General Settings → Account & Identity: the heading of the Public display choice. */
  readonly displayHeading: string;
  readonly opening: string;
  readonly worldUnavailable: string;
  readonly retry: string;
}

const AR = {
  publicWorld: 'العالم العام', // CANON — I-08A4 §8
  switcherLabel: 'التنقل بين قنديل والعالم المشترك والعالم العام', // PROPOSED — S5-01 Product Copy Gate — accessible name only
  displayHeading: 'الظهور في العالم العام', // PROPOSED — S5-01 Product Copy Gate
} as const;

const EN = {
  publicWorld: 'Public World', // CANON — I-08A4 §9
  switcherLabel: 'Switch between QANDEEL, Shared World and Public World', // PROPOSED — S5-01 Product Copy Gate — accessible name only
  displayHeading: 'Shown in Public World as', // PROPOSED — S5-01 Product Copy Gate
} as const;

export function publicCopy(language: ChromeLanguage): PublicCopy {
  const shared = sharedCopy(language);
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({ ...own, opening: shared.opening, worldUnavailable: shared.worldUnavailable, retry: shared.retry });
}
