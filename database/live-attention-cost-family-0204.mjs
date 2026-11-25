// INTEL-LIVE-01 CP1 (migration 0204): the one feature family 0204 admits, and the probe that tells an earlier verifier
// whether 0204 is applied. Every earlier verifier that pins the exact family list adds exactly this one, and nothing
// else, once the probe answers true (0204's own verifier proves the family admitted and an unknown family refused).
export const ATTENTION_FAMILIES = Object.freeze(['LIVE_ATTENTION_EVALUATION']);

// One row, one boolean column `attention`: whether 0204's coverage ledger exists.
export const ATTENTION_COST_PROBE = "SELECT to_regclass('voice_private.call_attention_evaluations') IS NOT NULL AS attention";
