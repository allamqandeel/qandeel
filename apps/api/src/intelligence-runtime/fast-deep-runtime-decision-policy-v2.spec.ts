import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideFastDeepRoute } from './fast-deep-runtime-decision-policy-v2';
import {
  RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE,
  RUNTIME_ROUTING_MIN_COMPLEXITY_SCORE,
  RUNTIME_ROUTING_POLICY_VERSION,
  isLegalCurrentRoutePair,
} from './fast-deep-routing-contract';

// QIR-002 focused policy spec. Every threshold, every reason and every Unicode
// rule the specification names is proven here on the real function.
const units = (count: number, body = 'y'.repeat(45)) => `${body}. `.repeat(count).trim();

describe('QIR-002 FAST/DEEP Runtime Decision Policy v2', () => {
  describe('code-point boundaries', () => {
    it.each([
      [299, 0, 'FAST'],
      [300, 1, 'FAST'],
      [599, 1, 'FAST'],
      [600, 2, 'FAST'],
      [999, 2, 'FAST'],
      [1000, 3, 'DEEP'],
    ] as const)('%i code points scores %i and routes %s', (length, score, path) => {
      const decision = decideFastDeepRoute('x'.repeat(length));
      expect(decision.signals.codePointCount).toBe(length);
      expect(decision.complexityScore).toBe(score);
      expect(decision.path).toBe(path);
    });

    it('routes exactly at the 1000 code-point scale boundary with the input-scale reason', () => {
      expect(decideFastDeepRoute('x'.repeat(999)).reason).toBe('RUNTIME_ROUTING_V2_FAST_DEFAULT');
      expect(decideFastDeepRoute('x'.repeat(1000)).reason).toBe('RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE');
    });
  });

  describe('question boundaries', () => {
    it.each([
      ['a?', 1, 0],
      ['a?b?', 2, 1],
      ['a?b?c?', 3, 2],
    ] as const)('%s counts %i question marks', (content, questionCount, score) => {
      const decision = decideFastDeepRoute(content);
      expect(decision.signals.questionCount).toBe(questionCount);
      expect(decision.complexityScore).toBe(score);
      // Questions alone can never reach the DEEP score of 3.
      expect(decision.path).toBe('FAST');
    });

    it('counts Latin and Arabic question marks in the same signal', () => {
      expect(decideFastDeepRoute('a؟').signals.questionCount).toBe(1);
      expect(decideFastDeepRoute('a?b؟').signals.questionCount).toBe(2);
      expect(decideFastDeepRoute('a؟b؟c?').signals.questionCount).toBe(3);
      // Mixed and single-script inputs of the same shape decide identically.
      expect(decideFastDeepRoute('a?b؟')).toEqual(decideFastDeepRoute('a?b?'));
    });

    it('counts only the two question marks, never other terminal punctuation', () => {
      expect(decideFastDeepRoute('a.b!c;d؛e…').signals.questionCount).toBe(0);
    });
  });

  describe('logical-unit boundaries', () => {
    it.each([
      [3, 0],
      [4, 1],
      [6, 1],
      [7, 2],
    ] as const)('%i logical units scores %i breadth points', (count, breadth) => {
      const decision = decideFastDeepRoute(units(count, 'y'));
      expect(decision.signals.logicalUnitCount).toBe(count);
      // Short bodies keep input scale at zero, so the score IS the breadth.
      expect(decision.signals.codePointCount).toBeLessThan(300);
      expect(decision.complexityScore).toBe(breadth);
    });

    it('splits on every separator the contract names and discards empty pieces', () => {
      expect(decideFastDeepRoute('a.b!c?d؟e;f؛g…h\ni').signals.logicalUnitCount).toBe(9);
      // A RUN of separators is one boundary, not several empty units.
      expect(decideFastDeepRoute('a?!...b').signals.logicalUnitCount).toBe(2);
      expect(decideFastDeepRoute('   ').signals.logicalUnitCount).toBe(0);
      expect(decideFastDeepRoute('').signals.logicalUnitCount).toBe(0);
      expect(decideFastDeepRoute('...').signals.logicalUnitCount).toBe(0);
    });

    it('gives empty input the FAST default with zeroed signals', () => {
      expect(decideFastDeepRoute('')).toEqual({
        policyVersion: 2,
        path: 'FAST',
        reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT',
        complexityScore: 0,
        signals: { codePointCount: 0, questionCount: 0, logicalUnitCount: 0 },
      });
    });
  });

  describe('composite scoring and reason precedence', () => {
    it('routes 600+ code points with 2 questions to DEEP as a composite', () => {
      const decision = decideFastDeepRoute(`${'x'.repeat(598)}?y?`);
      expect(decision.signals).toEqual({ codePointCount: 601, questionCount: 2, logicalUnitCount: 2 });
      expect(decision.complexityScore).toBe(3);
      expect(decision.path).toBe('DEEP');
      expect(decision.reason).toBe('RUNTIME_ROUTING_V2_DEEP_COMPOSITE');
    });

    it('routes 300+ code points with 7 logical units to DEEP as multi-part', () => {
      const decision = decideFastDeepRoute(units(7));
      expect(decision.signals.logicalUnitCount).toBe(7);
      expect(decision.signals.codePointCount).toBeGreaterThanOrEqual(300);
      expect(decision.signals.codePointCount).toBeLessThan(1000);
      expect(decision.complexityScore).toBe(3);
      expect(decision.path).toBe('DEEP');
      expect(decision.reason).toBe('RUNTIME_ROUTING_V2_DEEP_MULTI_PART');
    });

    it('routes 300+ code points with 2 questions and 4 units to DEEP as a composite', () => {
      const decision = decideFastDeepRoute(
        `${'a'.repeat(80)}? ${'b'.repeat(80)}? ${'c'.repeat(80)}. ${'d'.repeat(80)}.`,
      );
      expect(decision.signals.questionCount).toBe(2);
      expect(decision.signals.logicalUnitCount).toBe(4);
      expect(decision.signals.codePointCount).toBeGreaterThanOrEqual(300);
      expect(decision.complexityScore).toBe(3);
      expect(decision.path).toBe('DEEP');
      expect(decision.reason).toBe('RUNTIME_ROUTING_V2_DEEP_COMPOSITE');
    });

    it('prefers the multi-question reason over multi-part and composite', () => {
      const decision = decideFastDeepRoute(`${'a'.repeat(120)}? ${'b'.repeat(120)}? ${'c'.repeat(120)}?`);
      expect(decision.signals.questionCount).toBe(3);
      expect(decision.signals.codePointCount).toBeGreaterThanOrEqual(300);
      expect(decision.signals.codePointCount).toBeLessThan(1000);
      expect(decision.path).toBe('DEEP');
      expect(decision.reason).toBe('RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION');
    });

    it('prefers the input-scale reason over every other DEEP reason', () => {
      const decision = decideFastDeepRoute(units(9, 'z'.repeat(120)));
      expect(decision.signals.codePointCount).toBeGreaterThanOrEqual(1000);
      expect(decision.signals.logicalUnitCount).toBe(9);
      expect(decision.reason).toBe('RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE');
    });

    it('keeps short content with only three questions on FAST', () => {
      const decision = decideFastDeepRoute('why? how? when?');
      expect(decision.signals.questionCount).toBe(3);
      expect(decision.complexityScore).toBe(2);
      expect(decision.path).toBe('FAST');
      expect(decision.reason).toBe('RUNTIME_ROUTING_V2_FAST_DEFAULT');
    });

    it('keeps every pre-QIR-002 DEEP case DEEP', () => {
      for (const content of [
        'x'.repeat(1000),
        'x'.repeat(4000),
        `${'sentence. '.repeat(120)}`,
        '😀'.repeat(1000),
        `${'ا'.repeat(1500)}`,
      ]) {
        expect(decideFastDeepRoute(content).path).toBe('DEEP');
        expect(decideFastDeepRoute(content).reason).toBe('RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE');
      }
    });

    it('stays inside the bounded score range and always emits a legal current pair', () => {
      for (const content of [
        '', 'hi', 'why? how? when? where?', 'x'.repeat(1000), units(12), `${'x'.repeat(700)}?a?`,
        `${'a'.repeat(150)}? ${'b'.repeat(150)}? ${'c'.repeat(150)}? ${'d'.repeat(150)}. ${'e'.repeat(150)}. ${'f'.repeat(150)}. ${'g'.repeat(150)}.`,
      ]) {
        const decision = decideFastDeepRoute(content);
        expect(decision.complexityScore).toBeGreaterThanOrEqual(RUNTIME_ROUTING_MIN_COMPLEXITY_SCORE);
        expect(decision.complexityScore).toBeLessThanOrEqual(RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE);
        expect(Number.isInteger(decision.complexityScore)).toBe(true);
        expect(decision.policyVersion).toBe(RUNTIME_ROUTING_POLICY_VERSION);
        expect(isLegalCurrentRoutePair(decision.path, decision.reason)).toBe(true);
      }
    });

    it('reaches the maximum score of 7', () => {
      const decision = decideFastDeepRoute(
        `${'a'.repeat(145)}? ${'b'.repeat(145)}? ${'c'.repeat(145)}? ${'d'.repeat(145)}. ${'e'.repeat(145)}. ${'f'.repeat(145)}. ${'g'.repeat(145)}.`,
      );
      expect(decision.signals.codePointCount).toBeGreaterThanOrEqual(1000);
      expect(decision.signals.questionCount).toBe(3);
      expect(decision.signals.logicalUnitCount).toBe(7);
      expect(decision.complexityScore).toBe(RUNTIME_ROUTING_MAX_COMPLEXITY_SCORE);
    });
  });

  describe('Unicode awareness', () => {
    it('decides NFC-equivalent strings identically', () => {
      // U+0065 U+0301 (decomposed) vs U+00E9 (precomposed): different UTF-16
      // strings, one canonical NFC form, therefore one identical decision.
      const precomposed = 'é'.repeat(400);
      const decomposed = 'é'.repeat(400);
      expect(precomposed).not.toBe(decomposed);
      expect(decomposed.length).toBe(800);
      expect(decideFastDeepRoute(decomposed)).toEqual(decideFastDeepRoute(precomposed));
      expect(decideFastDeepRoute(decomposed).signals.codePointCount).toBe(400);
    });

    it('counts code points, not UTF-16 code units, for surrogate pairs', () => {
      const emoji = '😀'.repeat(500);
      expect(emoji.length).toBe(1000);
      const decision = decideFastDeepRoute(emoji);
      expect(decision.signals.codePointCount).toBe(500);
      // The retired input-length-only policy would have called this DEEP.
      expect(decision.path).toBe('FAST');
      expect(decideFastDeepRoute('😀'.repeat(1000)).signals.codePointCount).toBe(1000);
      expect(decideFastDeepRoute('😀'.repeat(1000)).path).toBe('DEEP');
    });

    it('trims leading and trailing Unicode whitespace before analysis', () => {
      expect(decideFastDeepRoute('   hello \n\t').signals).toEqual(
        decideFastDeepRoute('hello').signals,
      );
    });

    it('never mutates or exposes the canonical content', () => {
      const content = 'é tell me? and then? and finally?';
      const before = `${content}`;
      const decision = decideFastDeepRoute(content);
      expect(content).toBe(before);
      expect(Object.keys(decision).sort()).toEqual(
        ['complexityScore', 'path', 'policyVersion', 'reason', 'signals'],
      );
      expect(Object.keys(decision.signals).sort()).toEqual(
        ['codePointCount', 'logicalUnitCount', 'questionCount'],
      );
      expect(JSON.stringify(decision)).not.toContain('tell me');
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(decision.signals)).toBe(true);
    });
  });

  describe('determinism and purity', () => {
    it('produces deep-equal decisions for repeated identical input', () => {
      for (const content of ['', 'hello', 'a? b? c? d. e. f. g.', 'x'.repeat(1000), '😀🙂'.repeat(300)]) {
        const first = decideFastDeepRoute(content);
        const second = decideFastDeepRoute(content);
        const third = decideFastDeepRoute(`${content}`);
        expect(second).toEqual(first);
        expect(third).toEqual(first);
      }
    });

    it('is a pure CPU boundary: the shipped module performs no I/O of any kind', () => {
      const source = readFileSync(join(__dirname, 'fast-deep-runtime-decision-policy-v2.ts'), 'utf8');
      const contract = readFileSync(join(__dirname, 'fast-deep-routing-contract.ts'), 'utf8');
      // Prose that DESCRIBES the forbidden surface is not the forbidden
      // surface: only executable code is scanned.
      const code = (module: string) => module.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
      for (const module of [code(source), code(contract)]) {
        for (const forbidden of [
          'async ', 'await ', 'Promise', 'setTimeout', 'setInterval', 'process.env',
          'fetch(', 'require(', 'Math.random', 'Date.now', 'new Date',
        ]) {
          expect(module).not.toContain(forbidden);
        }
      }
      // The routing boundary imports NOTHING but its own sibling contract: no
      // provider, model registry, database, Memory, HIM, Hypothesis, Question,
      // Safety, Recommendation or telemetry edge may ever enter it.
      const imports = [...code(source).matchAll(/from '([^']+)'/gu)].map((match) => match[1]);
      expect(imports).toEqual(['./fast-deep-routing-contract']);
      expect([...code(contract).matchAll(/from '([^']+)'/gu)]).toEqual([]);
    });
  });
});
