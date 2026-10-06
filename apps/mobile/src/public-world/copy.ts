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
 *   - APPROVED — S5-01 Product Copy Gate: the two genuinely new strings below, drawn in the frozen register
 *     (I-08A4 §11) and approved by the Product Owner when the gate closed (2026-10-06). No row is PROPOSED.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedCopy } from '../shared-world/copy';

export const PUBLIC_COPY_GATE = {
  status: 'S5-01 PRODUCT COPY GATE — CLOSED (2026-10-06: every row CANON, REUSED or APPROVED; none PROPOSED)',
  canon: ['publicWorld'],
  reused: ['opening', 'worldUnavailable', 'retry'],
  approved: ['switcherLabel', 'displayHeading'],
  proposed: [],
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
  switcherLabel: 'التنقل بين قنديل والعالم المشترك والعالم العام', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06) — accessible name only
  displayHeading: 'الظهور في العالم العام', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06)
} as const;

const EN = {
  publicWorld: 'Public World', // CANON — I-08A4 §9
  switcherLabel: 'Switch between QANDEEL, Shared World and Public World', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06) — accessible name only
  displayHeading: 'Shown in Public World as', // APPROVED — S5-01 Product Copy Gate (Product Owner, 2026-10-06)
} as const;

export function publicCopy(language: ChromeLanguage): PublicCopy {
  const shared = sharedCopy(language);
  const own = language === 'ar' ? AR : EN;
  return Object.freeze({ ...own, opening: shared.opening, worldUnavailable: shared.worldUnavailable, retry: shared.retry });
}
