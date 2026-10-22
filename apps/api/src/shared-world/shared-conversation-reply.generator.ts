import { Inject, Injectable } from '@nestjs/common';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import type {
  SharedQandeelReplyGenerator,
  SharedReplyGeneration,
  SharedReplyGenerationInput,
} from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { MODEL_ROUTER, type ModelRouter, type ModelRouterContextMessage } from '../model-router/model-router.types';
import { assembleSharedConversationRequest } from './shared-conversation-model-input';

const MESSAGE_REF = /^M[1-9][0-9]*$/u;
const SPEAKER_REF = /^S[1-9][0-9]*$/u;

/**
 * S8A-02 CP1: every message names itself once with a request-local token, every person's message carries its trusted
 * author's token, and QANDEEL's carries none. Anything else is refused rather than told apart by Name alone.
 */
function hasTrustedProvenance(conversation: SharedReplyGenerationInput['conversation']): boolean {
  const messages = new Set(conversation.map((turn) => turn.messageRef));
  return messages.size === conversation.length && conversation.every((turn) => MESSAGE_REF.test(turn.messageRef)
    && (turn.producer === 'HUMAN' ? typeof turn.speakerRef === 'string' && SPEAKER_REF.test(turn.speakerRef) : turn.speakerRef === null));
}

/**
 * S4-02 — the words of one request-driven QANDEEL reply, over the provider-neutral Model Router.
 *
 *   1. the canonical Safety Response Gate on the answered message (and the earlier people's words): BLOCK answers with its
 *      own deterministic words and calls no provider; GUIDED carries its guidance into the request;
 *   2. the one Shared model-input assembler, over messages that carry their trusted request-local provenance (S8A-02 CP1);
 *   3. the Model Router, inside the AI-COST-01 attribution scope of the human whose request started it — so the call is
 *      accounted (and refused before any provider request if it could not be), never untracked spend.
 *
 * No provider is named here; the deterministic test seam is the Model Router's own (NODE_ENV=test). Nothing is logged.
 */
@Injectable()
export class SharedConversationReplyGenerator implements SharedQandeelReplyGenerator {
  constructor(
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    private readonly safety: SafetyResponseGateService,
  ) {}

  async generate(input: SharedReplyGenerationInput): Promise<SharedReplyGeneration> {
    const current = input.conversation.at(-1);
    if (current === undefined || current.producer !== 'HUMAN' || !hasTrustedProvenance(input.conversation)) return { state: 'UNAVAILABLE' };
    const earlier: ModelRouterContextMessage[] = input.conversation.slice(0, -1)
      .filter((turn) => turn.producer === 'HUMAN').map((turn) => ({ role: 'USER', content: turn.text }));
    const gate = this.safety.evaluate(current.text, [...earlier, { role: 'USER', content: current.text }]);
    if (gate.disposition === 'BLOCK') {
      return gate.deterministicResponse ? { state: 'GENERATED', text: gate.deterministicResponse } : { state: 'UNAVAILABLE' };
    }
    const request = assembleSharedConversationRequest(input.conversation, gate.disposition === 'GUIDED' ? gate.safetyGuidance : undefined);
    if (request === null) return { state: 'UNAVAILABLE' };
    try {
      const result = await runWithAiUsageAttribution({ userId: input.requesterUserId }, () => this.router.generate(request));
      return result.content.trim().length > 0 ? { state: 'GENERATED', text: result.content } : { state: 'UNAVAILABLE' };
    } catch {
      return { state: 'UNAVAILABLE' };
    }
  }
}
