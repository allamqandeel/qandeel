import type { RuntimeEventEnvelope } from './runtime-event.types';
export const RUNTIME_EVENT_TRANSPORT=Symbol('RUNTIME_EVENT_TRANSPORT');
// readinessStatus is optional for verifier/test doubles that manage their own
// connection lifecycle; a transport that omits it is treated as available by
// the publisher supervision cycle. The real RedisStreamsTransport always
// exposes it so production supervision is readiness-driven.
export interface RuntimeEventTransport{readonly readinessStatus?:'not_configured'|'available'|'degraded';connect():Promise<void>;publish(event:RuntimeEventEnvelope):Promise<string>;close():Promise<void>;}
