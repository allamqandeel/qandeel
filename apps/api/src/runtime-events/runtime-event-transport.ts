import type { RuntimeEventEnvelope } from './runtime-event.types';
export const RUNTIME_EVENT_TRANSPORT=Symbol('RUNTIME_EVENT_TRANSPORT');
export interface RuntimeEventTransport{connect():Promise<void>;publish(event:RuntimeEventEnvelope):Promise<string>;close():Promise<void>;}

