// Smoke-only deterministic conversational ModelRouter double for the Full
// Intelligence End-to-End Runtime smoke. It stands in ONLY for the paid
// conversational provider transport behind the existing ModelRouter contract:
// every request it receives was assembled by the REAL ConversationOrchestrator
// from real database state, and the central guidance it records is produced by
// the REAL production composeServerGuidance — never re-implemented here.
//
// The double performs no network call, no provider SDK call, reads no provider
// key, and adds no Recommendation/HIM/Hypothesis/Question policy of its own: it
// records the exact request, records the exact central server guidance, and
// returns one fixed benign assistant text. Call counts are observable so the
// smoke can prove exactly one conversational call per foreground turn and
// exactly two calls in total.
import {
  composeServerGuidance,
  type ModelRouter,
  type ModelRouterRequest,
  type ModelRouterResult,
} from '../../src/model-router/model-router.types';

export interface RecordedConversationalCall {
  readonly request: ModelRouterRequest;
  /** The exact central guidance the real composeServerGuidance produced for this request. */
  readonly serverGuidance: string;
}

export class DeterministicConversationalModelRouter implements ModelRouter {
  readonly calls: RecordedConversationalCall[] = [];

  constructor(private readonly fixedAssistantContent: string) {}

  get callCount(): number {
    return this.calls.length;
  }

  async generate(request: ModelRouterRequest): Promise<ModelRouterResult> {
    const serverGuidance = composeServerGuidance(request);
    this.calls.push({
      request: structuredClone(request) as ModelRouterRequest,
      serverGuidance,
    });
    return {
      content: this.fixedAssistantContent,
      routingMetadata: { path: request.path },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
