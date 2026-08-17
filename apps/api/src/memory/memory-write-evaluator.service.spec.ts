import { MEMORY_IMPORTANCE, MemoryWriteEvaluatorService } from './memory-write-evaluator.service';

describe('MemoryWriteEvaluatorService', () => {
  const evaluator = new MemoryWriteEvaluatorService();
  const now = new Date('2026-08-17T12:00:00.000Z');

  it.each([
    'hello', 'thanks', 'تمام', 'What is the capital of France?', 'Egypt is hot in summer.',
    'أنا متضايق النهارده.', 'الشغل ده هيقتلني.', 'يمكن أنا شخص عصبي.',
    'Maybe I am just a difficult person.', 'He said "I live in Cairo."', 'أعمل إيه لو مديري بيضغط عليا؟',
  ])('skips unsupported, transient, speculative, or third-party content: %s', (content) => {
    expect(evaluator.evaluate(content, now).decision).toBe('SKIP');
  });

  it.each([
    ['I prefer short answers.', 'STABLE_PREFERENCE', 'I prefer short answers.'],
    ['أنا بفضل الردود المختصرة.', 'STABLE_PREFERENCE', 'أنا بفضل الردود المختصرة.'],
    ['By the way, I live in Cairo for 3 years.', 'PERSONAL_FACT', 'I live in Cairo.'],
    ['بالمناسبة أنا ساكن في أكتوبر من 3 سنين.', 'PERSONAL_FACT', 'أنا ساكن في أكتوبر.'],
    ['My goal is to lose 10 kg this year.', 'GOAL', 'My goal is to lose 10 kg this year.'],
    ['هدفي إني أسيب الشغل خلال 6 شهور.', 'GOAL', 'هدفي إني أسيب الشغل خلال 6 شهور.'],
    ['I decided to start training on Saturday.', 'DECISION_COMMITMENT', 'I decided to start training on Saturday.'],
    ['قررت أبدأ الجيم من السبت.', 'DECISION_COMMITMENT', 'قررت أبدأ الجيم من السبت.'],
    ['Nora is my sister.', 'RELATIONSHIP_CONTEXT', 'Nora is my sister.'],
    ['سلمى أختي.', 'RELATIONSHIP_CONTEXT', 'سلمى أختي.'],
    ['Speak to me in Egyptian Arabic.', 'INTERACTION_PREFERENCE', 'Speak to me in Egyptian Arabic.'],
    ['كلمني بالمصري.', 'INTERACTION_PREFERENCE', 'كلمني بالمصري.'],
  ])('writes one explicit candidate for %s', (content, type, normalized) => {
    const decision = evaluator.evaluate(content, now);
    expect(decision).toMatchObject({
      decision: 'WRITE',
      candidate: { type, content: normalized, source: 'USER_STATED', status: 'ACTIVE', confidence: 0.95 },
    });
    if (decision.decision === 'WRITE') {
      expect(decision.candidate.importance).toBe(MEMORY_IMPORTANCE[type as keyof typeof MEMORY_IMPORTANCE]);
      expect(decision.candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.candidate.confidence).toBeLessThanOrEqual(1);
      expect(decision.candidate.type).not.toBe('DERIVED_INSIGHT');
      expect(decision.candidate.source).not.toBe('SYSTEM_DERIVED');
    }
  });

  it('writes a bounded temporary state with deterministic expiration', () => {
    const decision = evaluator.evaluate("I'm traveling to Riyadh next week.", now);
    expect(decision).toMatchObject({
      decision: 'WRITE', candidate: { type: 'TEMPORARY_STATE', importance: 0.5, expiresAt: '2026-08-31T12:00:00.000Z' },
    });
  });

  it('uses explicit remember confidence only for a supported safe fact', () => {
    expect(evaluator.evaluate('Remember that I live in Giza.', now)).toMatchObject({
      decision: 'WRITE', candidate: { type: 'PERSONAL_FACT', confidence: 0.98, source: 'USER_STATED' },
    });
    expect(evaluator.evaluate('Remember to buy milk.', now).decision).toBe('SKIP');
    expect(evaluator.evaluate('افتكر إني ساكن في الجيزة.', now)).toMatchObject({
      decision: 'WRITE', candidate: { type: 'PERSONAL_FACT', confidence: 0.98, content: 'أنا ساكن في الجيزة.' },
    });
  });

  it.each([
    'Remember my password is ABC123', 'Remember my API key is test-value',
    'Remember my OTP is 123456', 'Remember my card is 4111 1111 1111 1111',
    'افتكر الرقم القومي 29801011234567',
  ])('denies obvious sensitive data without returning its content: %s', (content) => {
    expect(evaluator.evaluate(content, now)).toEqual({ decision: 'SKIP', reason: 'SENSITIVE_DATA' });
  });

  it('never expands a multi-fact turn into multiple candidates', () => {
    const decision = evaluator.evaluate('I prefer short answers. My goal is to run a marathon.', now);
    expect(decision.decision).toBe('SKIP');
  });
});
