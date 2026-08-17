import { ClaudeModelRouter } from '../src/model-router/providers/anthropic/claude-model-router';

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.log('Claude smoke: NOT RUN (ANTHROPIC_API_KEY is unavailable).');
    return;
  }

  try {
    const result = await ClaudeModelRouter.fromEnvironment().generate({
      task: 'CONVERSATIONAL_RESPONSE',
      path: 'FAST',
      complexity: 'LOW',
      context: [{ role: 'USER', content: 'Reply with one short word.' }],
      locale: 'en',
      modality: 'TEXT',
      latencyBudgetMs: 3_000,
      costBudget: 'LOW',
      safetyLevel: 'STANDARD',
    });
    if (!result.content || !Number.isInteger(result.usage.inputTokens)
      || !Number.isInteger(result.usage.outputTokens)) {
      throw new Error('Normalized result is incomplete.');
    }
    console.log('Claude smoke: PASS (normalized text and usage metadata verified).');
  } catch {
    console.error('Claude smoke: FAIL (provider details were suppressed).');
    process.exitCode = 1;
  }
}

void main();
