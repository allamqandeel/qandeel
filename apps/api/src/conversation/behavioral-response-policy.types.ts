import type { InteractionPreferenceGuidanceInput } from '../interaction-preferences/interaction-preference-guidance';

export const BEHAVIORAL_RESPONSE_POLICY = Symbol('BEHAVIORAL_RESPONSE_POLICY');

export interface BehavioralResponsePolicy {
  /**
   * The Personal Text v2 guidance (ACE-01: frozen Text v1 + the approved personality core). IP-IMP-01: with the owner's
   * durable interaction preferences, their compiled block follows it (Mandatory Core); without any non-DEFAULT preference
   * and without GUIDED Safety the guidance is exactly Text v2.
   */
  buildTextGuidance(interaction?: InteractionPreferenceGuidanceInput): string;
}
