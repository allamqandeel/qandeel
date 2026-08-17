import type { ModelRouterContextMessage } from '../model-router/model-router.types';
import type { ConversationTurn } from './conversation.types';

export const CONTEXT_BUILDER = Symbol('CONTEXT_BUILDER');

export interface ContextBuilder {
  build(
    accessToken: string,
    userId: string,
    sourceTurn: ConversationTurn,
  ): Promise<ReadonlyArray<ModelRouterContextMessage>>;
}
