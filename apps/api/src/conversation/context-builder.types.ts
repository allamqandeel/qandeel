import type { ModelRouterContextMessage } from '../model-router/model-router.types';
import type { ConversationTurn } from './conversation.types';

export const CONTEXT_BUILDER = Symbol('CONTEXT_BUILDER');

// QIR-004 retired `assemble(...)`. ContextBuilder owns CANONICAL CONVERSATION
// CONSTRUCTION only: it retrieves the recent authoritative exchanges and
// appends the canonical current USER turn. It is no longer a second, competing
// final provider-context assembly authority - final normalized
// `ModelRouterRequest` assembly, source budgeting and byte accounting belong to
// the ONE QIR-004 Integrated Context Budget Assembler.
export interface ContextBuilder {
  build(
    accessToken: string,
    userId: string,
    sourceTurn: ConversationTurn,
  ): Promise<ReadonlyArray<ModelRouterContextMessage>>;
}
