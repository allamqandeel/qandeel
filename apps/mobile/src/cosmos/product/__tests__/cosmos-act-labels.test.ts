/**
 * COSMOS-INT-01 Slice C closure — the six concise act labels APPROVED by the Product Owner on 2026-11-16
 * (Contract v1.4 §17). The words live in their owners; the gate's record must equal them, every hint is the
 * unchanged detailed sentence, and RETURN_LIVE_HEAD's T-06 twin (the rail's Live words) carries the same label.
 */
import { analysisCopy } from '../../../analysis-language';
import { returnActWords } from '../../../orientation-chrome';
import { COSMOS_ACT_LABELS_APPROVED, COSMOS_PRODUCT_COPY_GATE } from '../copy';

const IDS = ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE'] as const;

// The detailed hints as they stood before the relabelling: the approval changes labels only.
const HINTS = {
  en: {
    BACK_ONE_STEP: 'Restores the viewpoint your most recent step came from. It does not rejoin the conversation.',
    EXACT_RETURN: 'Restores exactly the viewpoint this inspection started from.',
    RETURN_LIVE_HEAD: 'Follows the conversation as it continues. The view does not move.',
    RETURN_LIVE_FOCUS: 'Goes once to where attention is now. The moment you are reading does not change.',
    RETURN_WORLD: 'Returns to the world viewpoint at the same moment you are reading.',
    GO_LIVE_AND_LOCATE: 'Rejoins the conversation and, if its current attention can be located there, moves the view to it in the same step.',
  },
  ar: {
    BACK_ONE_STEP: 'يستعيد موضعك قبل خطوتك الأخيرة. لا يعيدك إلى المحادثة الجارية.',
    EXACT_RETURN: 'يستعيد بالضبط الموضع الذي بدأت منه هذه المعاينة.',
    RETURN_LIVE_HEAD: 'يتابع المحادثة وهي تستمر. لا يتحرك العرض.',
    RETURN_LIVE_FOCUS: 'ينتقل مرة واحدة إلى موضع الاهتمام الآن. لا تتغير لحظتك.',
    RETURN_WORLD: 'يعود إلى العالم كله عند اللحظة نفسها.',
    GO_LIVE_AND_LOCATE: 'يعود إلى المحادثة الجارية، وإذا أمكن تحديد موضع الاهتمام هناك، ينقل العرض إليه في الخطوة نفسها.',
  },
} as const;

describe('COSMOS-INT-01 — the six concise act labels (PO, 2026-11-16)', () => {
  it('the gate records all six as APPROVED and stays CLOSED', () => {
    expect(COSMOS_PRODUCT_COPY_GATE.status).toMatch(/CLOSED — 12 rows APPROVED/u);
    expect(COSMOS_PRODUCT_COPY_GATE.proposed).toEqual([]);
    for (const id of IDS) expect(COSMOS_PRODUCT_COPY_GATE.approved).toContain(id);
    expect(Object.keys(COSMOS_ACT_LABELS_APPROVED)).toEqual([...IDS]);
  });

  it.each(['ar', 'en'] as const)('%s: each act carries exactly its approved label and its unchanged hint', (language) => {
    for (const id of IDS) {
      const words = returnActWords(language, id);
      expect(words.label).toBe(COSMOS_ACT_LABELS_APPROVED[id][language]);
      expect(words.hint).toBe(HINTS[language][id]);
    }
    // Six different acts keep six different names: no two are merged by a shorter word.
    expect(new Set(IDS.map((id) => returnActWords(language, id).label)).size).toBe(6);
  });

  it.each(['ar', 'en'] as const)('%s: the rail’s Live words are RETURN_LIVE_HEAD’s approved label; the following sentence is unchanged', (language) => {
    expect(analysisCopy(language).rejoinConversation).toBe(COSMOS_ACT_LABELS_APPROVED.RETURN_LIVE_HEAD[language]);
    expect(analysisCopy(language).followingConversation).toBe(language === 'ar' ? 'متابعة المحادثة مفعّلة الآن' : 'Following the conversation');
  });
});
