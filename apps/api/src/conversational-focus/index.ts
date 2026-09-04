// T-03B1a - Reference / Attention Resolution Evaluator + Prepared Focus
// Semantics. Framework-agnostic, production-inert: no Nest decorator, no
// module, no bootstrap registration, no persistence, no durable identity.

export * from './conversational-focus.types';
export * from './focus-anchor-mapper';
export * from './focus-resolution-provider.types';
export * from './focus-resolution-provider.config';
export * from './focus-resolution-validator';
export * from './fake-focus-resolution.provider';
export * from './openai-focus-resolution.provider';
export * from './conversational-focus-evaluator.service';
// T-03B1b1 - durable canonicalization (pure, inert).
export * from './durable-focus-payload.types';
export * from './durable-focus-canonicalizer';
// T-03B1b2 - runtime orchestration + activation readiness (production-inert, AC-B1B2-01).
export * from './conversation-focus-runtime.types';
export * from './conversation-focus-runtime-mapper';
export * from './conversation-focus-runtime.repository';
export * from './focus-resolution-binding';
export * from './conversation-focus-establishment.service';
