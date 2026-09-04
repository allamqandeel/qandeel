// T-03B2b1 - Canonical Home Placement Engine v1 (QANDEEL OSDAP v1).
// Pure, production-inert: no Nest decorator, no module, no bootstrap
// registration, no persistence, no Thread identity allocation, no Home row.
//
// The public surface is exactly the closed types, the one placement function
// and the consumer rule that keeps the engine off every non-establishment
// path. The proof seams of `home-placement-engine.ts` are importable by path
// for the suites and the static contract only; the golden vectors live in
// `home-placement-vectors.ts` and are likewise not part of this surface.

export * from './home-placement.types';
export { placeCanonicalHome, resolveThreadHome } from './home-placement-engine';
