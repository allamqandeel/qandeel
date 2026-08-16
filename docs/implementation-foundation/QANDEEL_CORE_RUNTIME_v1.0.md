# QANDEEL — CORE RUNTIME v1.0

## Purpose
The Core Runtime is Qandeel's operational heart. It manages a conversation turn, assembles required context, selects Fast/Deep processing, invokes only needed capabilities, applies policy/safety, shapes the response, and persists state.

## Golden Principle
**Maximize the value of the next interaction, not the length of the current response.**

## Runtime Boundary
`Client → API → Conversation Orchestrator → Runtime Kernel → Capabilities / Model Router → Policy & Safety → Response → Persistence`

## Turn Lifecycle
1. Receive authenticated input and establish request/session/turn identifiers.
2. Validate input, authorization, limits, and basic safety.
3. Create/resume session and load required hot state.
4. Build the smallest sufficient context.
5. Select Fast Path by default; Deep Path only when justified.
6. Invoke only required capabilities.
7. Route through Model Router.
8. Generate candidate response.
9. Apply behavioral, safety, privacy, and output constraints.
10. Shape response length, tone, question behavior, and speech/text form.
11. Persist authoritative turn/state/metadata.
12. Emit safe runtime events.
13. Return final response.

## Fast vs Deep
Fast Path is default. Deep Path may be justified by complex decision support, conflicting/ambiguous information, meaningful memory synthesis, high-impact recommendation, multi-step reasoning, or when shallow processing would materially reduce quality. Deep Path requires an explicit reason.

## Selective Capability Invocation
ABS engines are capabilities, not mandatory steps. Question, Memory, Hypothesis, Evidence, Recommendation, Personality, and Learning capabilities run only when they add value.

## Conversation State
Distinguish user identity, session identity, turn identity, conversation mode, interaction state, hot context, pending tool/job state, realtime interruption state, and runtime metadata.

## Context Builder
Construct the smallest sufficient context from current input, recent turns, relevant memory, relevant preferences, session state, safety/policy state, required product context, and provider constraints. Never inject the entire history by default.

## Model Router Contract
Core Runtime contains no provider-specific decision logic. Router inputs may include conversation mode, complexity, capability, latency/cost budgets, safety requirements, context size, and provider health.

## Response Policy
- Prefer concise natural responses when detail is unnecessary.
- Avoid unnecessary introductions before questions.
- Do not expose internal hypotheses unless helpful.
- Do not steer the user's story with premature explanations.
- Ask the smallest useful next question.
- Do not ask merely to keep conversation going.
- Allow short acknowledgment when best.
- Preserve Qandeel dialect, tone, and behavior.

## Safety & Authorization
Authenticated user scope is established before accessing user-scoped resources. Applicable safety, privacy, boundary, and output constraints apply before delivery.

## Persistence & Observability
Persist user/assistant turns, identifiers, selected path, required runtime and cost metadata, and event/outbox information. Use correlation IDs without turning logs into a copy of private conversations.

## Provider-Agnostic Interfaces
ConversationOrchestrator, SessionManager, ContextBuilder, PathSelector, CapabilityInvoker, ModelRouter, MemoryRuntime, SafetyPolicy, ResponsePolicy, ResponseRenderer, TurnPersistence, RuntimeEventPublisher.

## Definition of Done
An authenticated user can create/resume a session; a complete text turn travels from input to persisted output; Fast is default; Deep is explicit; capabilities are selective; models route through Model Router; resources are authorization-protected; response passes policy/safety; persistence/events work; end-to-end testing works without implementing the complete product.

## Final Principle
**QANDEEL DOES NOT MAXIMIZE THE AMOUNT OF INTELLIGENCE EXPOSED IN A RESPONSE; IT MAXIMIZES THE VALUE OF THE NEXT INTERACTION.**
