import type { OnboardingPath, Objective } from './onboarding-objective-selector';

/**
 * S6-01 — the natural-language phrasing seam for onboarding objectives (Task Contract WP3).
 *
 * Stage 6 binds NO provider here. Live, model-mediated onboarding conversation is Stage 8A's (`QAN-BL-MATCH-04`), and no
 * production LLM is authorized in S6-01 (Product Owner authorization §2). The only implementation is UNBOUND: it
 * answers without calling anything, and the mobile client renders the approved deterministic copy for the objective.
 * A future binding must redact personal and private evidence, assemble only purpose-authorized input, and pass its own
 * Product and cost review; nothing here prepares a prompt.
 */
export interface OnboardingPhrasingPort {
  phrase(objective: Objective, path: OnboardingPath): { readonly binding: 'UNBOUND' };
}

export const ONBOARDING_PHRASING_PORT = Symbol('ONBOARDING_PHRASING_PORT');

export class UnboundOnboardingPhrasing implements OnboardingPhrasingPort {
  phrase(): { readonly binding: 'UNBOUND' } {
    return { binding: 'UNBOUND' };
  }
}
