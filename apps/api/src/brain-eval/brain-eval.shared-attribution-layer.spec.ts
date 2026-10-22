import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { resolveDeepSeekModel } from '../model-router/model-profile.registry';
import { DeepSeekModelRouter } from '../model-router/providers/deepseek/deepseek-model-router';
import { DEEPSEEK_MAX_OUTPUT_TOKENS, type DeepSeekModelRouterConfig } from '../model-router/providers/deepseek/deepseek-model-router.config';
import { ATTRIBUTION_READING_INSTRUCTION, ModelRouterAttributionReader } from '../shared-world/shared-attribution-reading';
import { AttributionNotesReplyGenerator, PreLayerSharedReplyGenerator } from '../shared-world/shared-attribution-reply.experimental';
import {
  ATTRIBUTION_LAYER_ARMS, ATTRIBUTION_LAYER_TRANSPORT_MS, LAYER_NO_REPLY, armCases, createLayerBlindPacket, earlierLayerCases, joinLayerVerdicts,
  layerConversation, layerReviewForm, layerTier, measureLayerArm, plannedLayerCalls, runAttributionLayerArm, scoreAttributionLayer,
  type AttributionLayerArm, type LayerAttemptResult, type LayerCase, type LayerItemReview,
} from './brain-eval.shared-attribution-layer';

// S8A-02 / CP2 Round 10 — the attribution-layer comparison harness, on the tracked earlier cases only (the CP2 independent
// set and the pinned held-out set are never read by a test). The provider is a recording client behind the real DeepSeek
// adapter, so every request body is the one production would send. Zero network.

type Body = { messages: Array<{ role: string; content: string }>; max_tokens: number } & Record<string, unknown>;
const config: DeepSeekModelRouterConfig = { apiKey: 'test-only', resolveModel: resolveDeepSeekModel, maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS, timeoutMs: 25_000, maxRetries: 0 };
const isReading = (body: Body) => body.messages[0]?.content.includes(ATTRIBUTION_READING_INSTRUCTION.split('\n')[0] as string) ?? false;
const USER = '20000000-0000-4000-8000-0000000000a1';

function recordingRouter(fail: (body: Body, index: number) => boolean = () => false) {
  const bodies: Body[] = [];
  const create = jest.fn(async (sent: Body) => {
    bodies.push(sent);
    if (fail(sent, bodies.length)) throw new Error('simulated provider failure');
    const content = isReading(sent) ? JSON.stringify({ mentions: [], claims: [] }) : 'تمام، ده اللي واضح من الكلام هنا.';
    return { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
  });
  return { router: new DeepSeekModelRouter(config, { chat: { completions: { create } } } as never), bodies, create };
}
const attribute = async <T>(_key: string, work: () => Promise<T>) => runWithAiUsageAttribution({ userId: USER }, work);

const cases = earlierLayerCases();
const gated = cases.filter((testCase) => layerTier(testCase) > 0);
const ungated = cases.filter((testCase) => layerTier(testCase) === 0);

describe('S8A-02 CP2 round 10 — attribution-layer harness', () => {
  it('plans one reply per attempt, a reading only in S_R, and the gated cases only for S and S_R', () => {
    const plan = plannedLayerCalls(cases);
    expect(gated.length).toBeGreaterThan(0);
    expect(ungated.length).toBeGreaterThan(0);
    expect(plan.perArm.B).toEqual({ cases: cases.length, attempts: cases.length * 3, replyCalls: cases.length * 3, readingCalls: 0, providerCalls: cases.length * 3 });
    expect(plan.perArm.S).toEqual({ cases: gated.length, attempts: gated.length * 3, replyCalls: gated.length * 3, readingCalls: 0, providerCalls: gated.length * 3 });
    expect(plan.perArm.S_R).toEqual({ cases: gated.length, attempts: gated.length * 3, replyCalls: gated.length * 3, readingCalls: gated.length * 3, providerCalls: gated.length * 6 });
    expect(plan.total.providerCalls).toBe(plan.perArm.B.providerCalls + plan.perArm.S.providerCalls + plan.perArm.S_R.providerCalls);
    expect(armCases(cases, 'S').map((testCase) => testCase.id)).toEqual(gated.map((testCase) => testCase.id));
  });

  it('gives CP1 references by person (S#) and position (M#), never by Name', () => {
    const named: LayerCase = { id: 'X', source: 'PART_T', key: { kind: 'REVIEW_NOTES', notes: ['n'] },
      participants: [{ key: 'a', name: 'سارة' }, { key: 'b', name: 'سارة' }], messages: [{ by: 'b', text: 'أهلا' }, { by: 'QANDEEL', text: 'أهلا' }, { by: 'a', text: 'سؤال' }, { by: 'b', text: 'تمام' }] };
    expect(layerConversation(named).map((turn) => [turn.messageRef, turn.speakerRef])).toEqual([['M1', 'S1'], ['M2', null], ['M3', 'S2'], ['M4', 'S1']]);
  });

  it('runs each arm with no retry, records each call with its kind and both budgets, and reads on FAST in S_R', async () => {
    const one = [gated[0] as LayerCase];
    for (const arm of ATTRIBUTION_LAYER_ARMS) {
      const { router, create } = recordingRouter();
      const results = await runAttributionLayerArm(one, arm, { router, attribute }, 2);
      expect(results).toHaveLength(2);
      expect(create).toHaveBeenCalledTimes(arm === 'S_R' ? 4 : 2);
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.productionPath).toBe('FAST');
        expect(result.calls.map((call) => call.kind)).toEqual(arm === 'S_R' ? ['READING', 'REPLY'] : ['REPLY']);
        const reply = result.calls.at(-1);
        expect(reply).toMatchObject({ productionBudgetMs: 3000, transportBudgetMs: ATTRIBUTION_LAYER_TRANSPORT_MS.reply, inputTokens: 10, outputTokens: 5 });
        if (arm === 'S_R') expect(result.calls[0]).toMatchObject({ productionBudgetMs: null, transportBudgetMs: ATTRIBUTION_LAYER_TRANSPORT_MS.reading });
        expect(result.totalMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('counts a failed call once and never retries it; the attempt has no reply', async () => {
    const { router, create } = recordingRouter((body) => !isReading(body));
    const results = await runAttributionLayerArm([gated[0] as LayerCase], 'S_R', { router, attribute }, 1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({ success: false, deliveredWithinProductionBudget: false });
    expect(results[0]?.calls.map((call) => [call.kind, call.success])).toEqual([['READING', true], ['REPLY', false]]);
    expect(measureLayerArm(results)).toMatchObject({ attempts: 1, replies: 0, noReply: 1, providerCalls: 2, failedCalls: 1 });
  });

  it('stops sending at once when a cap stops the run', async () => {
    const { router, create } = recordingRouter();
    const results = await runAttributionLayerArm(cases, 'B', { router, attribute, stopWhen: (sofar) => (sofar.length >= 3 ? 'fetch:cost-cap' : null) }, 3);
    expect(results).toHaveLength(3);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('sends an ungated case byte-identically to production in S and S_R', async () => {
    for (const testCase of ungated) {
      const conversation = layerConversation(testCase);
      const bodiesOf = async (kind: 'B' | 'S' | 'R_DEEP') => {
        const { router, bodies } = recordingRouter();
        const safety = new SafetyResponseGateService();
        const generator = kind === 'B' ? new PreLayerSharedReplyGenerator(router, safety)
          : new AttributionNotesReplyGenerator(router, safety, { mode: kind, readOn: 'ANY_RISK', reader: new ModelRouterAttributionReader(router, 15_000), readingBudgetMs: 15_000 });
        await runWithAiUsageAttribution({ userId: USER }, () => generator.generate({ conversation, requesterUserId: USER }));
        return JSON.stringify(bodies);
      };
      const baseline = await bodiesOf('B');
      expect(await bodiesOf('S')).toBe(baseline);
      expect(await bodiesOf('R_DEEP')).toBe(baseline);
    }
  });

  it('blinds the packet: no arm, tier, notes or timing; ungated cases show B only; the map restores every reply', async () => {
    const results: LayerAttemptResult[] = [];
    for (const arm of ATTRIBUTION_LAYER_ARMS) {
      const { router } = recordingRouter((body, index) => !isReading(body) && index === 2);
      results.push(...await runAttributionLayerArm(cases, arm, { router, attribute }, 1));
    }
    const { packet, map } = createLayerBlindPacket(cases, results, 'salt-1');
    const text = JSON.stringify(packet);
    for (const hidden of ['"arm"', '"tier"', 'S_R', 'shared_attribution_notes', '[fact]', '[reading]', 'totalMs', 'readingState', 'FAST']) expect(text).not.toContain(hidden);
    for (const item of packet) {
      expect(Object.keys(item).sort()).toEqual(['conversation', 'itemId', 'key', 'replies']);
      for (const reply of item.replies) expect(Object.keys(reply).sort()).toEqual(['aids', 'failure', 'leakAid', 'reply', 'replyId']);
      const isGated = gated.some((testCase) => testCase.id === item.itemId);
      expect(item.replies).toHaveLength(isGated ? 3 : 1);
      const mapped = map.items.find((entry) => entry.itemId === item.itemId);
      expect(mapped?.replies.map((entry) => entry.replyId)).toEqual(item.replies.map((reply) => reply.replyId));
      if (!isGated) expect(mapped?.replies).toEqual([expect.objectContaining({ arm: 'B', standsForAllArms: true })]);
    }
    expect(packet.flatMap((item) => item.replies).filter((reply) => reply.failure === LAYER_NO_REPLY)).toHaveLength(3);
    // A different salt reorders without changing the content.
    const again = createLayerBlindPacket(cases, results, 'salt-2').packet;
    expect(again.map((item) => item.replies.map((reply) => reply.reply).sort())).toEqual(packet.map((item) => item.replies.map((reply) => reply.reply).sort()));
    expect(layerReviewForm(packet).flatMap((item) => item.replies).every((verdict) => verdict.criticalAttributionError === null)).toBe(true);
  });

  it('scores the pre-registered criteria from final verdicts, and an early cap stop is INCONCLUSIVE', async () => {
    const results: LayerAttemptResult[] = [];
    for (const arm of ATTRIBUTION_LAYER_ARMS) results.push(...await runAttributionLayerArm(cases, arm, { router: recordingRouter().router, attribute }, 3));
    const { packet, map } = createLayerBlindPacket(cases, results, 'salt');
    // Synthetic verdicts: B errs on every gated reply, S on none of them, S_R on none.
    const verdicts: LayerItemReview[] = layerReviewForm(packet).map((item) => ({ itemId: item.itemId, replies: item.replies.map((verdict) => {
      const arm = map.items.find((entry) => entry.itemId === item.itemId)?.replies.find((entry) => entry.replyId === verdict.replyId)?.arm as AttributionLayerArm;
      const isGated = gated.some((testCase) => testCase.id === item.itemId);
      return { ...verdict, criticalAttributionError: isGated && arm === 'B', falseAbsenceClaim: false, unnecessaryQuestionOrAbstention: false, mechanismOrLecture: false, leak: false, abnormal: false };
    }) }));
    const joined = joinLayerVerdicts(cases, results, map, verdicts);
    const outcome = scoreAttributionLayer(joined, results, false);
    expect(outcome.sVersusB.checks.P1).toBe(true);
    expect(outcome.metrics.gated.B.caeRate).toBe(1);
    expect(outcome.metrics.gated.S.caeRate).toBe(0);
    expect(outcome.metrics.ungated.B.replies).toBe(outcome.metrics.ungated.S.replies);
    expect(outcome.residualCriticalErrors.every((row) => row.arm === 'B' && row.gated)).toBe(true);
    expect(outcome.inconclusiveCases).toEqual([]);
    expect(scoreAttributionLayer(joined, results, true).sVersusB.verdict).toBe('INCONCLUSIVE');
    // A case left with 1 of 3 replies in one arm is INCONCLUSIVE and leaves every arm's metrics (decision §4.7).
    const thinId = (gated[0] as LayerCase).id;
    let dropped = 0;
    const thin = results.map((result) => (result.caseId === thinId && result.arm === 'S' && dropped++ < 2 ? { ...result, success: false } : result));
    const thinOutcome = scoreAttributionLayer(joined, thin, false);
    expect(thinOutcome.inconclusiveCases).toEqual([thinId]);
    expect(thinOutcome.metrics.gated.B.replies).toBe(outcome.metrics.gated.B.replies - 3);
    // An unfilled verdict is never scored.
    expect(() => scoreAttributionLayer(joinLayerVerdicts(cases, results, map, layerReviewForm(packet)), results, false)).toThrow('NOT SCORABLE');
  });
});
