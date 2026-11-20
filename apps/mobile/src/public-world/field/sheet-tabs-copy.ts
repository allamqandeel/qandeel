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
 *   - PROPOSED — COSMOS E-2 PRODUCT COPY GATE (this slice): the three rows below. The Arabic words are the ones the
 *     Product Owner suggested in the directive («المعلومات», «المناقشة»). They are drawn as PROPOSED until the Owner
 *     approves them, exactly as earlier gates were drawn before closure. Note for the Owner's decision: the approved
 *     S5-04 word for the discussion is «النقاش» (its heading and its count); «المناقشة» is a different word. Either the
 *     rows below are approved as proposed, or the discussion tab reuses the S5-04 «النقاش» / «النقاش · {0}» byte-exact
 *     (then `discussion` and `discussionWithCount` leave this gate as REUSED).
 *
 * The count in the Discussion tab is the S5-04 human discussion count only — never QANDEEL's, never a ranking; a tab is
 * never a feed, a badge or a notification.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

export const PUBLIC_SHEET_TABS_COPY_GATE = {
  status: 'COSMOS E-2 PRODUCT COPY GATE — OPEN — 3 rows PROPOSED (Slice E, 2026-11-20); awaiting the Product Owner',
  approved: [],
  proposed: ['information', 'discussion', 'discussionWithCount'],
  /** The S5-04 rows the Owner may choose to reuse instead of `discussion` / `discussionWithCount`. */
  reusableAlternative: { discussion: 'S5-04 discussion («النقاش»)', discussionWithCount: 'S5-04 discussionWithCount («النقاش · {0}»)' },
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
  information: 'المعلومات', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice E, 2026-11-20; the Owner's suggested word)
  discussion: 'المناقشة', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice E, 2026-11-20; the Owner's suggested word; S5-04 approved «النقاش»)
  discussionWithCount: 'المناقشة · {0}', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice E, 2026-11-20)
});

const EN: PublicSheetTabsCopy = Object.freeze({
  information: 'Information', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice E, 2026-11-20)
  discussion: 'Discussion', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice E, 2026-11-20; same English as S5-04)
  discussionWithCount: 'Discussion · {0}', // PROPOSED — COSMOS E-2 Product Copy Gate (Slice E, 2026-11-20; same English as S5-04)
});

export function publicSheetTabsCopy(language: ChromeLanguage): PublicSheetTabsCopy {
  return language === 'ar' ? AR : EN;
}

/** "{0}" substitution, the same convention the other Public copy modules use. */
export const fillSheetTabsCopy = (template: string, value: string): string => template.replace('{0}', value);
