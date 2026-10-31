/**
 * S8B-03 (CP1, E5) — the model-facing lines about a MACHINE_ASR source, Copy Gate rows M-01 … M-03, APPROVED verbatim by
 * the Product Owner (2026-10-31). English only, never shown to the user. Changing one character is a Copy Gate change.
 *
 *   M-01  every prompt that receives Memories or Evidence (the six model boundaries of §4.9.6)
 *   M-02  Open Understanding, a qualifying voice message only (`{HIGH|MEDIUM}` is replaced by the turn's band)
 *   M-03  Open Understanding, a typed message
 */
export const MACHINE_ASR_SOURCE_GUIDANCE =
  "source MACHINE_ASR: automatically transcribed from the user's voice message; recognition errors are possible, especially in negation, names and numbers; never treat or quote it as words the user typed. confirmedByTyping: the user later confirmed this item explicitly in typed text; its source is still MACHINE_ASR.";

export const VOICE_MESSAGE_GUIDANCE_TEMPLATE =
  "This message was transcribed automatically from the user's voice (band {HIGH|MEDIUM}). Recognition errors are possible, especially in negation, names and numbers. Do not propose forgetting anything from it.";

export const TYPED_CONFIRMATION_GUIDANCE =
  'confirmedKnown: list a known item only when this typed message explicitly confirms that exact item as true, for example a clear yes to it. Saying the same thing again is a restatement, not a confirmation.';

/** M-02 for one qualifying band. */
export function voiceMessageGuidance(band: 'HIGH' | 'MEDIUM'): string {
  return VOICE_MESSAGE_GUIDANCE_TEMPLATE.replace('{HIGH|MEDIUM}', band);
}
