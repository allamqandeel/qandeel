import type { ModelRouterRequest } from '../model-router/model-router.types';
import { assemblePublicQandeelRequest } from '../public-world/public-qandeel-model-input';
import { assembleSharedConversationRequest } from '../shared-world/shared-conversation-model-input';
import type { BrainEvaluationCase } from './brain-eval.types';

// S8A-02 — a Shared World or Public World case is evaluated through that World's OWN production model-input assembler
// (ACE-SP-01): the same frame, world-neutral personality, `locale: 'und'`, history bounds and FAST / DEEP budgets the
// reply service sends. The evaluation builds no second Shared or Public prompt, and no Personal preference can reach one.

/** The production request a World case sends, or an error when the assembler would refuse it (nothing to answer). */
export function worldEvaluationRequest(testCase: BrainEvaluationCase, safetyGuidance?: string): ModelRouterRequest {
  const world = testCase.world;
  if (world === undefined) throw new Error(`${testCase.id} is not a World case.`);
  const request = world.kind === 'SHARED'
    ? assembleSharedConversationRequest(world.conversation, safetyGuidance)
    : assemblePublicQandeelRequest(world.discussion, safetyGuidance);
  if (request === null) throw new Error(`${testCase.id}: the ${world.kind} assembler refuses this input.`);
  return request;
}

/** The text of the message a World case answers: the last Shared turn, or the invoking Public post. */
export function worldCurrentMessage(testCase: BrainEvaluationCase): string {
  const world = testCase.world;
  if (world === undefined) throw new Error(`${testCase.id} is not a World case.`);
  if (world.kind === 'SHARED') return world.conversation.at(-1)?.text ?? '';
  return world.discussion.posts.find((post) => post.invoking)?.text ?? '';
}
