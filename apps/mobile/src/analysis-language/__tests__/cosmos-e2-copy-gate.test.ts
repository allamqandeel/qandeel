// COSMOS E-2 Product Copy Gate, Slices A and C — CLOSED by the Product Owner's COPY GATE DECISION of 2026-11-21
// ("Complete Wording Approval Before Consolidated CI"). Every row is held here byte-exact, Arabic authoritative. Slice B
// (the conversation catalog) is held by conversation/__tests__/conversation-catalog.test.ts.
import { PERSONAL_CURRENT_WORLD_COPY_GATE, PERSONAL_TOPIC_NAME_COPY_GATE, analysisCopy } from '../analysis-copy';

const SLICE_A = {
  topicNameFromWords: ['من كلامك', 'From your words'],
  topicNameYours: ['اسم من اختيارك', 'Your name for it'],
  topicUnnamed: ['موضوع بلا اسم', 'Unnamed topic'],
  nameTopic: ['تسمية الموضوع', 'Name this topic'],
  topicNameField: ['اسم الموضوع', 'Topic name'],
  saveName: ['حفظ', 'Save'],
  cancelName: ['إلغاء', 'Cancel'],
  openSource: ['فتح المحادثة الأصلية', 'Open the original conversation'],
} as const;

const SLICE_C = {
  worldModeThisConversation: ['هذه المحادثة', 'This conversation'],
  worldModeAllTopics: ['كل موضوعاتي الآن', 'All my topics now'],
  currentWorldNote: ['العرض الحالي بلا خط زمني', 'No timeline in the current view'],
  currentWorldEmpty: ['لا موضوعات بعد', 'No topics yet'],
  currentWorldUnavailable: ['تعذّر عرض موضوعاتك الآن.', "Your topics can't be shown right now."],
} as const;

describe('COSMOS E-2 Product Copy Gate — Slices A and C, CLOSED 2026-11-21', () => {
  it.each([
    ['Slice A', PERSONAL_TOPIC_NAME_COPY_GATE, SLICE_A, 8],
    ['Slice C', PERSONAL_CURRENT_WORLD_COPY_GATE, SLICE_C, 5],
  ] as const)('%s: every row APPROVED, none PROPOSED, each byte-exact in Arabic and English', (_, gate, rows, count) => {
    expect(gate.status).toMatch(new RegExp(`— CLOSED — ${count} rows APPROVED by the Product Owner, 2026-11-21`, 'u'));
    expect(gate.proposed).toEqual([]);
    expect([...gate.approved].sort()).toEqual(Object.keys(rows).sort());
    for (const [index, language] of (['ar', 'en'] as const).entries()) {
      const copy = analysisCopy(language);
      for (const [key, pair] of Object.entries(rows)) expect(copy[key as keyof typeof rows]).toBe(pair[index]);
    }
  });

  it('Open the original conversation names the conversation, never an exact message position', () => {
    for (const language of ['ar', 'en'] as const) {
      expect(analysisCopy(language).openSource).not.toMatch(/حيث|موضع|رسالة|where|position|message|moment/iu);
    }
  });

  it('the current-world note stays a compact line, not a paragraph', () => {
    for (const language of ['ar', 'en'] as const) {
      const note = analysisCopy(language).currentWorldNote;
      expect(note).not.toMatch(/[.،,؛;\n]/u);
      expect(note.length).toBeLessThanOrEqual(32);
    }
  });
});
