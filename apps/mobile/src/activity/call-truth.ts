/**
 * A3-01 — the typed seam for "is a Live Call active?" (P3 §9).
 *
 * There is NO Personal Voice / Live Call runtime on `main` (`QAN-BL-VOICE-01`, `OPEN — UNASSIGNED`): no canonical call
 * authority exists to answer the question. So production answers the only truthful thing it can — no call is known —
 * and nothing here fabricates an active call. `ACTIVE` is the shape a future canonical call owner (Stage 8) will
 * supply; until then it exists only in validation fixtures, which is how the call-safe decision path and the call-safe
 * strip are proved without being mounted as if a call existed.
 */
export type CallTruth = { readonly kind: 'NO_CALL_KNOWN' } | { readonly kind: 'ACTIVE' };

/** The production answer while no canonical call authority exists. */
export const PRODUCTION_CALL_TRUTH: CallTruth = Object.freeze({ kind: 'NO_CALL_KNOWN' });
