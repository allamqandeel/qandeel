import type { InteractionPreferences } from './interaction-preferences.types';

// IP-IMP-01 (WP4) — the constraint compiler for the owner's durable interaction preferences.
//
// Pure, synchronous and deterministic: a fixed field order, one line per non-DEFAULT field, nothing else. Its output is
// appended to the Behavioral Runtime's text guidance, so it renders through the ONE `composeServerGuidance` inside the
// QIR-004 Mandatory Core (exact UTF-8 bytes, never truncated) and reaches the provider in the ONE Model Router call.
// All DEFAULT renders nothing, so a turn without a durable preference is byte-identical to before.
//
// Precedence, stated to the model in the block itself: Safety guidance and the owner's explicit request in the current
// conversation come first; the durable preference comes before the model's own interpretation of the conversation
// (it overrides the base guidance's "language or dialect when reasonably inferable" line). A preference only narrows
// or suspends: WELCOME permits humour and never asks for a joke; DECLINED forbids it; under GUIDED Safety guidance
// humour is suspended for the turn whatever the preference says.
//
// The model-facing texts below are OPEN COPY recorded in the IP-IMP-01 PO Copy Addendum.

export const INTERACTION_PREFERENCE_GUIDANCE_HEADER =
  'Standing interaction preferences the user explicitly chose. Apply them to this reply. An explicit request the user makes in the current conversation takes precedence for what it asks, and safety guidance always takes precedence.';

const REPLY_LENGTH_LINE = { ALWAYS_BRIEF: '- Reply length: keep the reply brief.' } as const;

const REPLY_LANGUAGE_LINE = {
  EGYPTIAN_ARABIC: '- Reply language: reply in Egyptian Arabic.',
  MODERN_STANDARD_ARABIC: '- Reply language: reply in Modern Standard Arabic.',
  LEVANTINE_ARABIC: '- Reply language: reply in Levantine Arabic.',
  GULF_ARABIC: '- Reply language: reply in Gulf Arabic.',
  MAGHREBI_ARABIC: '- Reply language: reply in Maghrebi Arabic.',
  ENGLISH: '- Reply language: reply in English.',
} as const;

const HUMOUR_WELCOME_LINE = '- Humour: light humour is welcome where it fits naturally; never force a joke.';
const HUMOUR_DECLINED_LINE = '- Humour: do not use humour.';
const HUMOUR_SUSPENDED_LINE = '- Humour: do not use humour in this reply.';

const EXPLANATION_LINE = {
  SIMPLER: '- Explanation style: explain in simpler terms.',
  DIRECT: '- Explanation style: get to the point directly.',
  SIMPLER_AND_DIRECT: '- Explanation style: explain in simple terms and get to the point directly.',
} as const;

export interface InteractionPreferenceGuidanceInput {
  readonly preferences: InteractionPreferences;
  /** True when this turn carries GUIDED Safety guidance: a welcomed humour preference is suspended for the turn. */
  readonly safetyGuided: boolean;
}

/** The preference block, or undefined when every field is DEFAULT. */
export function compileInteractionPreferenceGuidance(input: InteractionPreferenceGuidanceInput): string | undefined {
  const { preferences, safetyGuided } = input;
  const lines: string[] = [];
  if (preferences.replyLength !== 'DEFAULT') lines.push(REPLY_LENGTH_LINE[preferences.replyLength]);
  if (preferences.replyLanguage !== 'DEFAULT') lines.push(REPLY_LANGUAGE_LINE[preferences.replyLanguage]);
  if (preferences.humour === 'DECLINED') lines.push(HUMOUR_DECLINED_LINE);
  else if (preferences.humour === 'WELCOME') lines.push(safetyGuided ? HUMOUR_SUSPENDED_LINE : HUMOUR_WELCOME_LINE);
  if (preferences.explanationStyle !== 'DEFAULT') lines.push(EXPLANATION_LINE[preferences.explanationStyle]);
  return lines.length === 0 ? undefined : [INTERACTION_PREFERENCE_GUIDANCE_HEADER, ...lines].join('\n');
}
