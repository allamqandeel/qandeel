import { HypothesisGenerationTriggerClassificationService } from './hypothesis-generation-trigger-classification.service';
import { MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS } from './hypothesis-generation-trigger-classification.types';

describe('HypothesisGenerationTriggerClassificationService', () => {
  const service = new HypothesisGenerationTriggerClassificationService();
  const classify = (text: string, safetyDisposition: 'ALLOW' | 'GUIDED' | 'BLOCK' = 'ALLOW') =>
    service.classify({ text, safetyDisposition });

  it.each([
    ["I don't understand why I always pull away when someone gets close to me.", 'EXPLICIT_WHY_SELF'],
    ['Every time I decide to leave my job, I change my mind even though I am unhappy there.', 'RECURRING_PATTERN'],
    ['I want to leave this job, but I keep choosing to stay.', 'INTERNAL_CONTRADICTION'],
    ['Whenever someone gets close to me, I pull away from them.', 'RELATIONAL_PATTERN'],
    ["I ended up cancelling again, and I don't know why.", 'OUTCOME_WITH_UNCLEAR_CAUSE'],
  ])('classifies explicit English trigger structure: %s', (text, reason) => {
    expect(classify(text)).toEqual({ classification: 'TRIGGER', reason });
  });

  it.each([
    ['مش فاهم ليه أنا دايمًا ببعد لما حد يقرب مني.', 'EXPLICIT_WHY_SELF'],
    ['كل مرة أنا باقرر أسيب الشغل بغير رأيي.', 'RECURRING_PATTERN'],
    ['أنا عايز أسيب الشغل بس أنا بفضل مكاني.', 'INTERNAL_CONTRADICTION'],
    ['كل مرة حد يقرب مني ببعد عنه.', 'RELATIONAL_PATTERN'],
    ['لقيت نفسي لغيت الموضوع ومش عارف ليه.', 'OUTCOME_WITH_UNCLEAR_CAUSE'],
  ])('classifies explicit Arabic/Egyptian trigger structure: %s', (text, reason) => {
    expect(classify(text)).toEqual({ classification: 'TRIGGER', reason });
  });

  it.each([
    ['My name is Karim.', 'ORDINARY_FACT'],
    ['My wife is called Nada.', 'ORDINARY_FACT'],
    ['I like my job.', 'PREFERENCE_OR_GOAL'],
    ['My goal is to change jobs.', 'PREFERENCE_OR_GOAL'],
    ['Should I leave my job?', 'COMMAND_OR_REQUEST'],
    ['Tell me how to update my résumé.', 'COMMAND_OR_REQUEST'],
    ['What is the capital of France?', 'GENERIC_QUESTION'],
    ['Hello!', 'GREETING_OR_ACK'],
    ["I'm upset today.", 'TRANSIENT_STATE_ONLY'],
    ['He said he does not understand why he always leaves.', 'QUOTED_OR_THIRD_PARTY'],
    ['The meeting starts at nine.', 'INSUFFICIENT_SIGNAL'],
    ['أنا ساكن في القاهرة.', 'ORDINARY_FACT'],
    ['هدفي أغير شغلي.', 'PREFERENCE_OR_GOAL'],
    ['أعمل إيه عشان أغير شغلي؟', 'COMMAND_OR_REQUEST'],
    ['ما عاصمة فرنسا؟', 'GENERIC_QUESTION'],
    ['تمام', 'GREETING_OR_ACK'],
    ['أنا متضايق النهارده.', 'TRANSIENT_STATE_ONLY'],
    ['هو قال مش فاهم ليه دايمًا بيمشي.', 'QUOTED_OR_THIRD_PARTY'],
  ])('conservatively excludes %s', (text, reason) => {
    expect(classify(text)).toEqual({ classification: 'NO_TRIGGER', reason });
  });

  it.each([
    ['There is always some kind of pattern here.', 'TRIGGER_LIKE_BUT_UNRESOLVED'],
    ['حاسس إن في نمط بس مش واضح.', 'TRIGGER_LIKE_BUT_UNRESOLVED'],
  ])('keeps unresolved trigger-like language ambiguous: %s', (text, reason) => {
    expect(classify(text)).toEqual({ classification: 'AMBIGUOUS', reason });
  });

  it.each(['GUIDED', 'BLOCK'] as const)('%s is Safety-ineligible without inspecting semantics', (safetyDisposition) => {
    expect(classify("I don't understand why I always pull away.", safetyDisposition))
      .toEqual({ classification: 'NO_TRIGGER', reason: 'SAFETY_INELIGIBLE' });
  });

  it('normalizes deterministically without changing the bounded classification', () => {
    const variants = [
      "I don't understand why I always pull away.",
      "  I don't   understand why I always pull away.  ",
      "I don’t understand why I always pull away.".normalize('NFKC').replace('’', "'"),
    ];
    expect(variants.map((text) => classify(text))).toEqual(Array(3).fill({ classification: 'TRIGGER', reason: 'EXPLICIT_WHY_SELF' }));
  });

  it('rejects over-bound text as AMBIGUOUS without truncating into a positive', () => {
    const text = `${'x'.repeat(MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS)} why do I always leave`;
    expect(classify(text)).toEqual({ classification: 'AMBIGUOUS', reason: 'INPUT_BOUND_EXCEEDED' });
    expect(classify('x'.repeat(MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS * 3))).toEqual({ classification: 'AMBIGUOUS', reason: 'INPUT_BOUND_EXCEEDED' });
  });

  it('accepts the exact normalized bound and has no provider, persistence, or runtime dependencies', () => {
    expect(classify('x'.repeat(MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS))).toEqual({ classification: 'NO_TRIGGER', reason: 'INSUFFICIENT_SIGNAL' });
    expect(HypothesisGenerationTriggerClassificationService.length).toBe(0);
    expect(Object.keys(service)).toEqual([]);
  });
});
