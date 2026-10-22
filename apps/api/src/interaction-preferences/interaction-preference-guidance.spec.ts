// S8A-02: re-anchored from Text v3 to Text v4, the Personal guidance rendered since the approved core v2 (Product Owner D1, 2026-10-21).
// S8A-02 CP3 correction (Product Owner, 2026-10-22): re-anchored to Text v5, with the preference block LEADING the guidance and
// the v2 header and lines (each line says what to do when the preference and the current message disagree). The compiler
// now returns the block alone; the policy places it first and the GUIDED Safety suspension last.
import { BehavioralResponsePolicyService, TEXT_V5_BEHAVIORAL_GUIDANCE } from '../conversation/behavioral-response-policy.service';
import { compileInteractionPreferenceBlock, INTERACTION_PREFERENCE_GUIDANCE_HEADER, SAFETY_HUMOUR_SUSPENSION_LINE } from './interaction-preference-guidance';
import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from './interaction-preferences.types';

const prefs = (over: Partial<InteractionPreferences>): InteractionPreferences => ({ ...DEFAULT_INTERACTION_PREFERENCES, ...over });

describe('IP-IMP-01 WP4 — the interaction-preference constraint compiler', () => {
  it('renders nothing for no durable declaration, so the guidance stays exactly Text v2', () => {
    expect(compileInteractionPreferenceBlock({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: false })).toBeUndefined();
    const policy = new BehavioralResponsePolicyService();
    expect(policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: false })).toBe(TEXT_V5_BEHAVIORAL_GUIDANCE);
    expect(policy.buildTextGuidance()).toBe(TEXT_V5_BEHAVIORAL_GUIDANCE);
  });

  it('renders one line per chosen field in the frozen order, after the header, LEADING Text v5', () => {
    const all = prefs({ replyLength: 'ALWAYS_BRIEF', replyLanguage: 'GULF_ARABIC', humour: 'DECLINED', explanationStyle: 'SIMPLER_AND_DIRECT' });
    const block = compileInteractionPreferenceBlock({ preferences: all, safetyGuided: false });
    expect(block).toBe([
      INTERACTION_PREFERENCE_GUIDANCE_HEADER,
      '- Reply length: keep every reply brief, even on a complex question: give your answer and only the points that matter most, in a few sentences.',
      '- Reply language: write the whole reply in Gulf Arabic, even when the user writes in another dialect or language.',
      '- Humour: do not use humour.',
      '- Explanation style: lead with the answer itself, in simple, everyday words, without preamble or jargon.',
    ].join('\n'));
    expect(new BehavioralResponsePolicyService().buildTextGuidance({ preferences: all, safetyGuided: false })).toBe(`${block}\n\n${TEXT_V5_BEHAVIORAL_GUIDANCE}`);
  });

  it.each([
    ['EGYPTIAN_ARABIC', 'write the whole reply in Egyptian Arabic, even when the user writes in another dialect or language.'],
    ['MODERN_STANDARD_ARABIC', 'write the whole reply in Modern Standard Arabic, without dialect words, even when the user writes in a dialect or another language.'],
    ['LEVANTINE_ARABIC', 'write the whole reply in Levantine Arabic, even when the user writes in another dialect or language.'],
    ['GULF_ARABIC', 'write the whole reply in Gulf Arabic, even when the user writes in another dialect or language.'],
    ['MAGHREBI_ARABIC', 'write the whole reply in Maghrebi Arabic, even when the user writes in another dialect or language.'],
    ['ENGLISH', 'write the whole reply in English, even when the user writes in another language.'],
  ] as const)('names the reply language %s exactly, and holds it when the user writes in another', (value, words) => {
    expect(compileInteractionPreferenceBlock({ preferences: prefs({ replyLanguage: value }), safetyGuided: false }))
      .toBe(`${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Reply language: ${words}`);
  });

  it.each([
    ['SIMPLER', '- Explanation style: explain in simple, everyday words, without jargon.'],
    ['DIRECT', '- Explanation style: lead with the answer itself, without preamble.'],
    ['SIMPLER_AND_DIRECT', '- Explanation style: lead with the answer itself, in simple, everyday words, without preamble or jargon.'],
  ] as const)('names the explanation style %s as something the reply visibly does', (value, line) => {
    expect(compileInteractionPreferenceBlock({ preferences: prefs({ explanationStyle: value }), safetyGuided: false }))
      .toBe(`${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n${line}`);
  });

  it('CP3 correction: the header overrides the general guidance below it, leads the guidance, and asks not to announce it', () => {
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toContain('Follow them in every reply; they override the general language, dialect, length and explanation guidance below.');
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER.endsWith('without announcing or repeating them to the user.')).toBe(true);
    const guidance = new BehavioralResponsePolicyService().buildTextGuidance({ preferences: prefs({ replyLanguage: 'ENGLISH' }), safetyGuided: false });
    expect(guidance.startsWith(INTERACTION_PREFERENCE_GUIDANCE_HEADER)).toBe(true);
    expect(guidance.indexOf(INTERACTION_PREFERENCE_GUIDANCE_HEADER)).toBeLessThan(guidance.indexOf("Respond in the user's language or dialect"));
  });

  it('states the precedence: the current explicit request and safety guidance come first', () => {
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toMatch(/explicit request the user makes in the current conversation takes precedence/u);
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toMatch(/safety guidance always takes precedence/u);
  });

  it('WELCOME permits humour and never asks for a joke; DECLINED forbids it', () => {
    const welcome = compileInteractionPreferenceBlock({ preferences: prefs({ humour: 'WELCOME' }), safetyGuided: false })!;
    expect(welcome).toContain('- Humour: light humour is welcome where it fits naturally; never force a joke.');
    expect(welcome).not.toMatch(/\b(?:tell|include|add|make) (?:a )?jokes?\b/iu);
    expect(compileInteractionPreferenceBlock({ preferences: prefs({ humour: 'DECLINED' }), safetyGuided: false }))
      .toBe(`${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Humour: do not use humour.`);
  });

  // R2-01 — P6 / HUMOUR_SUSPENDED_SAFETY: EVERY GUIDED turn suspends humour, whatever the preference, DEFAULT included.
  it.each([
    ['DEFAULT (no declaration at all)', DEFAULT_INTERACTION_PREFERENCES, undefined],
    ['WELCOME', prefs({ humour: 'WELCOME' }), undefined],
    ['DECLINED', prefs({ humour: 'DECLINED' }), `${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Humour: do not use humour.`],
    ['DEFAULT with another field chosen', prefs({ replyLength: 'ALWAYS_BRIEF' }), `${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Reply length: keep every reply brief, even on a complex question: give your answer and only the points that matter most, in a few sentences.`],
  ] as const)('GUIDED with humour %s: the Safety suspension is rendered last, never a welcome', (_name, preferences, block) => {
    expect(compileInteractionPreferenceBlock({ preferences, safetyGuided: true })).toBe(block);
    const guidance = new BehavioralResponsePolicyService().buildTextGuidance({ preferences, safetyGuided: true });
    expect(guidance).toBe(block === undefined
      ? `${TEXT_V5_BEHAVIORAL_GUIDANCE}\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`
      : `${block}\n\n${TEXT_V5_BEHAVIORAL_GUIDANCE}\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`);
    expect(guidance).not.toContain('humour is welcome');
    // Safety's constraint is its own line, never presented under the header as the user's own choice.
    expect(block ?? '').not.toContain('playfulness');
  });

  it('all DEFAULT is byte-identical Text v2 only without GUIDED; GUIDED all-DEFAULT adds exactly the Safety suspension', () => {
    const policy = new BehavioralResponsePolicyService();
    expect(policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: false })).toBe(TEXT_V5_BEHAVIORAL_GUIDANCE);
    expect(policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: true }))
      .toBe(`${TEXT_V5_BEHAVIORAL_GUIDANCE}\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`);
  });

  it('R2-02: the block outranks remembered context, so an old Memory never weakens a declared preference', () => {
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toMatch(/take precedence over anything inferred from the conversation or from user memory context/u);
  });

  it('is pure and deterministic, carries no provider name, no profiling and no user content', () => {
    const input = { preferences: prefs({ replyLength: 'ALWAYS_BRIEF', humour: 'WELCOME' }), safetyGuided: false };
    const once = compileInteractionPreferenceBlock(input);
    expect(compileInteractionPreferenceBlock(input)).toBe(once);
    expect(once).not.toMatch(/Claude|Anthropic|OpenAI|GPT|Gemini|the user is|the user has|diagnos/iu);
    // The largest block stays small inside the 64 KiB Mandatory Core.
    const largest = compileInteractionPreferenceBlock({ preferences: prefs({ replyLength: 'ALWAYS_BRIEF', replyLanguage: 'MODERN_STANDARD_ARABIC', humour: 'WELCOME', explanationStyle: 'SIMPLER_AND_DIRECT' }), safetyGuided: false })!;
    expect(Buffer.byteLength(largest, 'utf8')).toBeLessThan(1_024);
  });
});
