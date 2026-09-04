/**
 * `@qandeel/runtime` - shared server/client runtime contracts.
 *
 * T-02 deferred the server/client wire envelopes to T-03A2 / T-03D. This
 * package is that reserved location, and in T-03A2 it is TYPE-ONLY: it ships no
 * JavaScript, declares no runtime dependency, and every consumer imports from
 * it with `import type`, so nothing here can become a bundled module.
 */
export type {
  ConversationTemporalDelivery,
  ConversationalUnitsCommittedType,
  ConversationalUnitsCommittedWireEvent,
  SessionTemporalSnapshot,
} from './temporal';
