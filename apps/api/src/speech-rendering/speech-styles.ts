/**
 * S8B-04 (CP1, contract v1.2 §7.1 / §11.5) — QANDEEL's spoken delivery. The model names one of six expressions in the
 * first line of its own voice-note reply (TM-01, the one main generation; no classifier, rule or extra call picks it), and
 * the expression selects one approved style sentence, which reaches the TTS request's `speechMetadata.style` only — never
 * the spoken text (I-3). Copy Gate rows S-01 … S-06, APPROVED by the Product Owner for CP1 (2026-11-01), verbatim.
 */
export const SPEECH_EXPRESSIONS = ['CALM', 'JOY', 'PLAYFUL', 'SURPRISE', 'EMPATHY', 'SERIOUS'] as const;
export type SpeechExpression = (typeof SPEECH_EXPRESSIONS)[number];

export const DEFAULT_SPEECH_EXPRESSION: SpeechExpression = 'CALM';

export const SPEECH_STYLE_SENTENCES: Readonly<Record<SpeechExpression, { readonly id: string; readonly style: string }>> = Object.freeze({
  CALM: { id: 'S-01', style: 'warm, friendly and natural, like a close friend talking casually; relaxed pace' },
  JOY: { id: 'S-02', style: 'warm and genuinely happy for a friend, natural, never over the top' },
  PLAYFUL: { id: 'S-03', style: 'teasing gently, joking, smiling' },
  SURPRISE: { id: 'S-04', style: 'amazed, light and friendly' },
  EMPATHY: { id: 'S-05', style: 'gentle and caring, at a natural pace, not dramatic' },
  SERIOUS: { id: 'S-06', style: 'calm, clear and steady, serious without being cold' },
});

export function isSpeechExpression(value: unknown): value is SpeechExpression {
  return typeof value === 'string' && (SPEECH_EXPRESSIONS as readonly string[]).includes(value);
}

/**
 * The deterministic Safety constraint (§7.1, AC-06): on a Safety GUIDED turn — the turn on which humour is suspended
 * (SAFETY_HUMOUR_SUSPENSION_LINE) — PLAYFUL and JOY become CALM. A constraint, not a classifier: it reads only the turn's
 * own Safety disposition.
 */
export function constrainSpeechExpression(expression: SpeechExpression, safetyGuided: boolean): SpeechExpression {
  return safetyGuided && (expression === 'PLAYFUL' || expression === 'JOY') ? DEFAULT_SPEECH_EXPRESSION : expression;
}
