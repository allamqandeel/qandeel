/**
 * COSMOS E-2 corrections, Slice E — the two tabs of the Public Detail Sheet: «المعلومات» / Information and
 * «المناقشة» / Discussion (PO directive "COSMOS E-2 Findings, Personal World Product Corrections & Public World
 * Closure", 2026-11-20, §8).
 *
 * Before, the discussion was reached through ONE control inside the Information content («النقاش · n», S5-04) and
 * replaced the panel in the sheet. Now Information and Discussion are sibling tabs at the top of the SAME Detail Sheet,
 * beside Back, for the SAME focused Experience. The sheet, the controller, the discussion and every security,
 * entitlement and moderation rule are unchanged: a tab is `controller.openDiscussion()` / `controller.closeDiscussion()`.
 *
 * Every string carries its source:
 *
 *   - APPROVED — COSMOS E-2 PRODUCT COPY GATE — CLOSED (Product Owner, 2026-11-20, "PO APPROVAL: D-1 THROUGH D-5"):
 *     the three rows below, in the Owner's words «المعلومات», «المناقشة», «المناقشة · {0}». The approval is for this
 *     tab presentation only: the S5-04 word «النقاش» stays byte-exact on every unrelated S5-04 surface (the discussion's
 *     own heading and count), and the count in the tab is the authorized human discussion count, never QANDEEL's replies.
 *
 * The count in the Discussion tab is the S5-04 human discussion count only — never QANDEEL's, never a ranking; a tab is
 * never a feed, a badge or a notification.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

export const PUBLIC_SHEET_TABS_COPY_GATE = {
  status: 'COSMOS E-2 PRODUCT COPY GATE — CLOSED — 3 rows APPROVED by the Product Owner (2026-11-20)',
  approved: ['information', 'discussion', 'discussionWithCount'],
  proposed: [],
  /** The Owner chose the new words over the S5-04 reuse; «النقاش» stays on the S5-04 surfaces, untouched. */
  reusableAlternative: null,
} as const;

export interface PublicSheetTabsCopy {
  /** The Information tab: the Experience's authorized content, its publisher, its themes and its nearby context. */
  readonly information: string;
  /** The Discussion tab (no posts yet, or the count not yet known). */
  readonly discussion: string;
  /** "Discussion · {0}" — the tab with the human discussion count. */
  readonly discussionWithCount: string;
}

const AR: PublicSheetTabsCopy = Object.freeze({
  information: 'المعلومات', // APPROVED — COSMOS E-2 Product Copy Gate (Product Owner, 2026-11-20)
  discussion: 'المناقشة', // APPROVED — COSMOS E-2 Product Copy Gate (Product Owner, 2026-11-20; S5-04 surfaces keep «النقاش»)
  discussionWithCount: 'المناقشة · {0}', // APPROVED — COSMOS E-2 Product Copy Gate (Product Owner, 2026-11-20)
});

const EN: PublicSheetTabsCopy = Object.freeze({
  information: 'Information', // APPROVED — COSMOS E-2 Product Copy Gate (Product Owner, 2026-11-20)
  discussion: 'Discussion', // APPROVED — COSMOS E-2 Product Copy Gate (Product Owner, 2026-11-20)
  discussionWithCount: 'Discussion · {0}', // APPROVED — COSMOS E-2 Product Copy Gate (Product Owner, 2026-11-20)
});

export function publicSheetTabsCopy(language: ChromeLanguage): PublicSheetTabsCopy {
  return language === 'ar' ? AR : EN;
}

/** "{0}" substitution, the same convention the other Public copy modules use. */
export const fillSheetTabsCopy = (template: string, value: string): string => template.replace('{0}', value);
