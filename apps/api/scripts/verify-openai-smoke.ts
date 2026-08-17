import { OpenAIModelRouter } from '../src/model-router/providers/openai/openai-model-router';

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.log('OpenAI smoke: NOT RUN (OPENAI_API_KEY is unavailable).');
    return;
  }

  try {
    const result = await OpenAIModelRouter.fromEnvironment().generate({
      task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', complexity: 'LOW',
      behavioralGuidance: 'Respond with only the requested short answer.',
      context: [{ role: 'USER', content: 'Reply with the single word OK.' }],
      locale: 'en', modality: 'TEXT', latencyBudgetMs: 3_000,
      costBudget: 'LOW', safetyLevel: 'STANDARD',
    });
    if (!result.content || result.usage.inputTokens <= 0 || result.usage.outputTokens <= 0) {
      throw new Error('Smoke verification failed.');
    }
    console.log('OpenAI smoke: PASS (normalized text and usage metadata verified).');
  } catch {
    console.error('OpenAI smoke: FAIL (provider details were suppressed).');
    process.exitCode = 1;
  }
}

void main();
