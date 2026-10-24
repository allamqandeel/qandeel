// S8A-03 Open Understanding — the unified semantic check of capture schema v3 (CP2 amendment §10).
import { appearsIn, verifySemanticCapture, type SemanticContext } from './personal-understanding-semantic.verifier';
import type { PersonalUnderstandingCaptureOutputV3, UnderstandingFactProposalV3, UnderstandingKnownItem } from './personal-understanding.types';

const NOW = new Date('2026-10-24T10:00:00Z');
const fact = (over: Partial<UnderstandingFactProposalV3>): UnderstandingFactProposalV3 => ({
  span: '', owner: 'SELF', ownerBasis: 'IN_SPAN', evidence: null, personName: null, personRelation: null, polarity: 'AFFIRMED',
  modality: 'STATED', temporal: 'CURRENT', type: 'PERSONAL_FACT', slot: null, importance: 'USEFUL', days: null, keys: [], ...over,
});
const known = (handle: string, content: string, over: Partial<UnderstandingKnownItem> = {}): UnderstandingKnownItem => ({
  handle, memoryId: `00000000-0000-4000-8000-0000000000${handle.slice(1).padStart(2, '0')}`, type: 'PERSONAL_FACT', content, subject: 'SELF',
  personName: null, personRelation: null, temporal: 'CURRENT', ended: false, terms: [], ...over,
});
const output = (over: Partial<PersonalUnderstandingCaptureOutputV3>): PersonalUnderstandingCaptureOutputV3 => ({
  facts: [], memories: [], context: [], commands: [], ...over,
});
const ctx = (message: string, over: Partial<SemanticContext> = {}): SemanticContext => ({ message, recentTurns: [], known: [], current: [], now: NOW, ...over });

describe('Open Understanding semantic verifier (capture v3)', () => {
  it('keeps a SELF fact whatever its wording, with no pronoun or verb list', () => {
    const r = verifySemanticCapture(output({ facts: [fact({ span: 'عندنا شقة في سموحة', slot: 'RESIDENCE', importance: 'CORE' })] }), ctx('عندنا شقة في سموحة من زمان'));
    expect(r.items.map((i) => [i.content, i.subject, i.slot])).toEqual([['عندنا شقة في سموحة.', 'SELF', 'RESIDENCE']]);
  });

  it('keeps someone else\'s fact under a person label grounded in a known Memory, with no kin word in the span', () => {
    const k1 = known('k1', 'مراتي اسمها سلمى.', { subject: 'OTHER', type: 'RELATIONSHIP_CONTEXT', personName: 'سلمى', personRelation: 'مراتي' });
    const r = verifySemanticCapture(output({ facts: [fact({ span: 'سلمى بقت مدرسة إنجليزي', owner: 'OTHER', ownerBasis: 'KNOWN_MEMORY', evidence: 'k1', personName: 'سلمى', personRelation: 'مراتي' })] }),
      ctx('وسلمى بقت مدرسة إنجليزي في مدرسة لغات', { known: [k1] }));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ subject: 'OTHER', personName: 'سلمى', personRelation: 'مراتي', slot: null });
  });

  it('never stores an uncertain, inferred or ungrounded owner', () => {
    const r = verifySemanticCapture(output({ facts: [
      fact({ span: 'بيشتغل طيار', owner: 'UNCLEAR' }),
      fact({ span: 'بيحب الكورة', owner: 'OTHER', ownerBasis: 'INFERRED', personRelation: 'أخويا' }),
      fact({ span: 'بيشتغل في دبي', owner: 'OTHER', ownerBasis: 'IN_MESSAGE', personName: 'حسام' }),
    ] }), ctx('بيشتغل طيار، وبيحب الكورة، وبيشتغل في دبي'));
    expect(r.items).toEqual([]);
    expect(r.audit.map((a) => a.verdict)).toEqual(['UNCERTAIN_OWNER', 'OWNER_INFERRED', 'PERSON_NOT_GROUNDED']);
  });

  it('refuses a SELF fact that names a known other person (OWNER_CONFLICT)', () => {
    const k1 = known('k1', 'أخويا حسام طيار.', { subject: 'OTHER', personName: 'حسام', personRelation: 'أخويا' });
    const r = verifySemanticCapture(output({ facts: [fact({ span: 'حسام اتنقل الدوحة' })] }), ctx('حسام اتنقل الدوحة الشهر اللي فات', { known: [k1] }));
    expect(r.audit[0].verdict).toBe('OWNER_CONFLICT');
  });

  it('does not keep questions, quotes, wishes or jokes, and a span must be verbatim', () => {
    const r = verifySemanticCapture(output({ facts: [
      fact({ span: 'محتاج راعي رسمي', modality: 'JOKE_OR_EXAGGERATION' }),
      fact({ span: 'بقيت شبه أبويا', modality: 'QUOTED' }),
      fact({ span: 'أنا ساكن في المعادي' }),
    ] }), ctx('ده أنا محتاج راعي رسمي 😂 وسلمى بتقول إني بقيت شبه أبويا'));
    expect(r.audit.map((a) => a.verdict)).toEqual(['NOT_A_STATEMENT', 'NOT_A_STATEMENT', 'NOT_VERBATIM']);
  });

  it('reads a pause as a pause: no message-wide negation, and PAUSED never ends an item', () => {
    const k3 = known('k3', 'فتحت صفحة طباعة صور.', { type: 'GOAL' });
    const r = verifySemanticCapture(output({ context: [{ handle: 'k3', status: 'PAUSED', span: 'وقفتها مؤقتًا' }] }),
      ctx('الصفحة وقفتها مؤقتًا، مش هقفلها خالص', { known: [k3] }));
    expect(r.ended).toEqual([]);
    expect(r.audit[0].verdict).toBe('NO_CHANGE:PAUSED');
  });

  it('keeps atomic facts over a compound one, and the most important within the declared bound of six', () => {
    const message = 'ساكن في سموحة وبحب التصوير، شغال محاسب، عندي عربية، بحب القهوة، بلعب بادل، بقرا روايات، بسمع مزيكا';
    const facts = [
      fact({ span: 'ساكن في سموحة وبحب التصوير', importance: 'CORE' }),
      fact({ span: 'ساكن في سموحة', importance: 'CORE' }), fact({ span: 'بحب التصوير', importance: 'CORE' }),
      fact({ span: 'شغال محاسب', importance: 'CORE' }), fact({ span: 'عندي عربية', importance: 'MINOR' }),
      fact({ span: 'بحب القهوة', importance: 'MINOR' }), fact({ span: 'بلعب بادل', importance: 'USEFUL' }),
      fact({ span: 'بقرا روايات', importance: 'USEFUL' }), fact({ span: 'بسمع مزيكا', importance: 'MINOR' }),
    ];
    const r = verifySemanticCapture(output({ facts }), ctx(message));
    expect(r.items.map((i) => i.content)).toEqual(['ساكن في سموحة.', 'بحب التصوير.', 'شغال محاسب.', 'بلعب بادل.', 'بقرا روايات.', 'عندي عربية.']);
    expect(r.audit.filter((a) => a.verdict === 'OVERLAPPING')).toHaveLength(1);
    expect(r.audit.filter((a) => a.verdict === 'OVER_BOUND')).toHaveLength(2);
  });

  it('forgets and corrects by handle only, grounded in the user\'s words; a correction keeps the owner and label', () => {
    const k1 = known('k1', 'عليا قسط عربية.');
    const k2 = known('k2', 'ليلى عندها 7 سنين.', { subject: 'OTHER', personName: 'ليلى', personRelation: 'بنتي' });
    const message = 'معلش صحح عندك: ليلى عندها 8 سنين مش 7، وانسى موضوع قسط العربية خالص';
    const r = verifySemanticCapture(output({ commands: [
      { kind: 'CORRECT', handle: 'k2', span: 'صحح عندك', replacement: fact({ span: 'ليلى عندها 8 سنين', owner: 'OTHER', ownerBasis: 'IN_SPAN', personName: 'ليلى' }) },
      { kind: 'FORGET', handle: 'k1', span: 'انسى موضوع قسط العربية خالص', replacement: null },
      { kind: 'FORGET', handle: 'k9', span: 'انسى', replacement: null },
    ] }), ctx(message, { known: [k1, k2] }));
    expect(r.forget).toEqual([k1.memoryId]);
    expect(r.corrections).toEqual([expect.objectContaining({ targetMemoryId: k2.memoryId, content: 'ليلى عندها 8 سنين.' })]);
    expect(r.audit.map((a) => a.verdict)).toEqual(['CORRECT', 'FORGET', 'UNKNOWN_HANDLE']);
  });

  it('ends a known item only on ENDED; a planned ending changes nothing, and each handle acts once', () => {
    const k1 = known('k1', 'شغال في مرسى.');
    const k2 = known('k2', 'بدرس ألماني.', { type: 'GOAL' });
    const k3 = known('k3', 'ساكن في المعادي.');
    const r = verifySemanticCapture(output({ context: [
      { handle: 'k1', status: 'ENDED', span: 'ودعت مرسى' },
      { handle: 'k2', status: 'ENDING_PLANNED', span: 'ناوي أبطل ألماني' },
      { handle: 'k3', status: 'REAFFIRMED', span: 'لسه في المعادي' },
    ] }), ctx('ودعت مرسى خلاص، وناوي أبطل ألماني الشهر الجاي، ولسه في المعادي', { known: [k1, k2, k3] }));
    expect(r.ended).toEqual([k1.memoryId]);
    expect(r.reaffirmed).toEqual([k3.memoryId]);
    expect(r.audit.map((a) => a.verdict)).toEqual(['ENDED', 'NO_CHANGE:ENDING_PLANNED', 'REAFFIRMED']);
  });

  it('grounds a person from the user\'s own recent turns, never from QANDEEL\'s words', () => {
    const p = fact({ span: 'بقت مدرسة إنجليزي', owner: 'OTHER', ownerBasis: 'CONVERSATION', personName: 'سلمى' });
    const fromUser = verifySemanticCapture(output({ facts: [p] }), ctx('بقت مدرسة إنجليزي', { recentTurns: [{ role: 'USER', content: 'مراتي سلمى بتدور على شغل' }] }));
    expect(fromUser.items).toHaveLength(1);
    const fromQandeel = verifySemanticCapture(output({ facts: [p] }), ctx('بقت مدرسة إنجليزي', { recentTurns: [{ role: 'QANDEEL', content: 'سلمى عاملة إيه؟' }] }));
    expect(fromQandeel.audit[0].verdict).toBe('PERSON_NOT_GROUNDED');
  });

  it('matches a person label as whole words with a one-letter proclitic only', () => {
    expect(appearsIn('وسلمى قالت', 'سلمى')).toBe(true);
    expect(appearsIn('لآدم كتاب', 'آدم')).toBe(true);
    expect(appearsIn('سلماوي', 'سلمى')).toBe(false);
  });
});
