import type { InteractionPreferences } from './interaction-preferences.types';

// IP-IMP-01 (WP4) — the constraint compiler for the owner's durable interaction preferences.
//
// Pure, synchronous and deterministic: a fixed field order, one line per non-DEFAULT field, nothing else. Its output is
// part of the Behavioral Runtime's text guidance, so it renders through the ONE `composeServerGuidance` inside the
// QIR-004 Mandatory Core (exact UTF-8 bytes, never truncated) and reaches the provider in the ONE Model Router call.
// All DEFAULT on a turn without GUIDED Safety renders nothing, so such a turn is byte-identical to before.
//
// Precedence, stated to the model in the block itself: Safety guidance and the owner's explicit request in the current
// conversation come first; the durable preference comes before the model's own interpretation of the conversation and
// of the user memory context, and before the general language, dialect, length and explanation guidance (it overrides
// the base guidance's "language or dialect when reasonably inferable" line, and an old remembered remark such as
// «أنا بحب الهزار» never outweighs a declared preference). A preference only narrows or suspends: WELCOME permits humour
// and never asks for a joke; DECLINED forbids it.
//
// S8A-02 CP3 Final Integrated Correction (Product Owner, 2026-10-22): the block now LEADS the Personal guidance
// (`BehavioralResponsePolicyService`) instead of following it, and its header and lines say what to do when the
// preference and the current message disagree. CP3 Round 8 proved the cause: every preference that matched the language of
// the user's own message was followed (Egyptian, Levantine, humour declined: 9 / 9), and every one that conflicted with it
// was not (English after an Arabic message 0 / 3, and 0 / 5 in every earlier round; Modern Standard Arabic after an
// Egyptian message 0 / 3; Gulf after an Egyptian message 1 / 3) — the block was one late line that the guidance's own
// first line ("respond in the user's language") contradicted. The v1 header is kept below as the record; the v1 lines are
// recorded in the IP-IMP-01 implementation record (CA-2).
//
// P6 (conversational-personality-v1, HUMOUR_SUSPENDED_SAFETY): EVERY GUIDED turn suspends humour, whatever the
// preference says, DEFAULT included. That constraint is Safety's, not the user's choice, so it is its own line at the
// end of the guidance, never a line under the header that says "the user explicitly chose".
//
// The v1 model-facing texts were APPROVED copy (IP-IMP-01 PO Copy Addendum CA-2, R2-corrected wording). The v2 texts are
// APPROVED copy of the S8A-02 CP3 correction (PO Final Correction Approval, 2026-10-22), recorded verbatim in the S8A-02
// amendment record §5.4.

export const INTERACTION_PREFERENCE_GUIDANCE_HEADER_V1 =
  'Standing interaction preferences the user explicitly chose. Apply them to this reply. An explicit request the user makes in the current conversation takes precedence for what it asks, and safety guidance always takes precedence. They take precedence over anything inferred from the conversation or from user memory context.';

export const INTERACTION_PREFERENCE_GUIDANCE_HEADER =
  'Standing interaction preferences the user explicitly chose. Follow them in every reply; they override the general language, dialect, length and explanation guidance below. An explicit request the user makes in the current conversation takes precedence for what it asks, and safety guidance always takes precedence. They take precedence over anything inferred from the conversation or from user memory context. Apply them quietly, without announcing or repeating them to the user.';

const REPLY_LENGTH_LINE = {
  ALWAYS_BRIEF: '- Reply length: keep every reply brief, even on a complex question: give your answer and only the points that matter most, in a few sentences.',
} as const;

const REPLY_LANGUAGE_LINE = {
  EGYPTIAN_ARABIC: '- Reply language: write the whole reply in Egyptian Arabic, even when the user writes in another dialect or language.',
  MODERN_STANDARD_ARABIC: '- Reply language: write the whole reply in Modern Standard Arabic, without dialect words, even when the user writes in a dialect or another language.',
  LEVANTINE_ARABIC: '- Reply language: write the whole reply in Levantine Arabic, even when the user writes in another dialect or language.',
  GULF_ARABIC: '- Reply language: write the whole reply in Gulf Arabic, even when the user writes in another dialect or language.',
  MAGHREBI_ARABIC: '- Reply language: write the whole reply in Maghrebi Arabic, even when the user writes in another dialect or language.',
  ENGLISH: '- Reply language: write the whole reply in English, even when the user writes in another language.',
} as const;

const HUMOUR_WELCOME_LINE = '- Humour: light humour is welcome where it fits naturally; never force a joke.';
const HUMOUR_DECLINED_LINE = '- Humour: do not use humour.';
/** P6 / HUMOUR_SUSPENDED_SAFETY: rendered on every GUIDED turn, with or without any preference. */
export const SAFETY_HUMOUR_SUSPENSION_LINE = 'This turn carries safety guidance: do not use humour or playfulness in this reply.';

const EXPLANATION_LINE = {
  SIMPLER: '- Explanation style: explain in simple, everyday words, without jargon.',
  DIRECT: '- Explanation style: lead with the answer itself, without preamble.',
  SIMPLER_AND_DIRECT: '- Explanation style: lead with the answer itself, in simple, everyday words, without preamble or jargon.',
} as const;

export interface InteractionPreferenceGuidanceInput {
  readonly preferences: InteractionPreferences;
  /** True when this turn carries GUIDED Safety guidance: humour is suspended for the turn whatever the preference. */
  readonly safetyGuided: boolean;
}

/** The preference block alone (header and one line per chosen field); undefined when nothing is chosen. */
export function compileInteractionPreferenceBlock(input: InteractionPreferenceGuidanceInput): string | undefined {
  const { preferences, safetyGuided } = input;
  const lines: string[] = [];
  if (preferences.replyLength !== 'DEFAULT') lines.push(REPLY_LENGTH_LINE[preferences.replyLength]);
  if (preferences.replyLanguage !== 'DEFAULT') lines.push(REPLY_LANGUAGE_LINE[preferences.replyLanguage]);
  if (preferences.humour === 'DECLINED') lines.push(HUMOUR_DECLINED_LINE);
  else if (preferences.humour === 'WELCOME' && !safetyGuided) lines.push(HUMOUR_WELCOME_LINE);
  if (preferences.explanationStyle !== 'DEFAULT') lines.push(EXPLANATION_LINE[preferences.explanationStyle]);
  return lines.length === 0 ? undefined : [INTERACTION_PREFERENCE_GUIDANCE_HEADER, ...lines].join('\n');
}
