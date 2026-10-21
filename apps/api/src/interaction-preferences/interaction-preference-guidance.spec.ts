// S8A-02: re-anchored from Text v3 to Text v4, the Personal guidance rendered since the approved core v2 (Product Owner D1, 2026-10-21).
import { BehavioralResponsePolicyService, TEXT_V4_BEHAVIORAL_GUIDANCE } from '../conversation/behavioral-response-policy.service';
import { compileInteractionPreferenceGuidance, INTERACTION_PREFERENCE_GUIDANCE_HEADER, SAFETY_HUMOUR_SUSPENSION_LINE } from './interaction-preference-guidance';
import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from './interaction-preferences.types';

const prefs = (over: Partial<InteractionPreferences>): InteractionPreferences => ({ ...DEFAULT_INTERACTION_PREFERENCES, ...over });

describe('IP-IMP-01 WP4 — the interaction-preference constraint compiler', () => {
  it('renders nothing for no durable declaration, so the guidance stays exactly Text v2', () => {
    expect(compileInteractionPreferenceGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: false })).toBeUndefined();
    const policy = new BehavioralResponsePolicyService();
    expect(policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: false })).toBe(TEXT_V4_BEHAVIORAL_GUIDANCE);
    expect(policy.buildTextGuidance()).toBe(TEXT_V4_BEHAVIORAL_GUIDANCE);
  });

  it('renders one line per chosen field in the frozen order, after the header, appended to Text v2', () => {
    const all = prefs({ replyLength: 'ALWAYS_BRIEF', replyLanguage: 'GULF_ARABIC', humour: 'DECLINED', explanationStyle: 'SIMPLER_AND_DIRECT' });
    const block = compileInteractionPreferenceGuidance({ preferences: all, safetyGuided: false });
    expect(block).toBe([
      INTERACTION_PREFERENCE_GUIDANCE_HEADER,
      '- Reply length: keep the reply brief.',
      '- Reply language: reply in Gulf Arabic.',
      '- Humour: do not use humour.',
      '- Explanation style: explain in simple terms and get to the point directly.',
    ].join('\n'));
    expect(new BehavioralResponsePolicyService().buildTextGuidance({ preferences: all, safetyGuided: false })).toBe(`${TEXT_V4_BEHAVIORAL_GUIDANCE}\n\n${block}`);
  });

  it.each([
    ['EGYPTIAN_ARABIC', 'Egyptian Arabic'], ['MODERN_STANDARD_ARABIC', 'Modern Standard Arabic'], ['LEVANTINE_ARABIC', 'Levantine Arabic'],
    ['GULF_ARABIC', 'Gulf Arabic'], ['MAGHREBI_ARABIC', 'Maghrebi Arabic'], ['ENGLISH', 'English'],
  ] as const)('names the reply language %s exactly', (value, words) => {
    expect(compileInteractionPreferenceGuidance({ preferences: prefs({ replyLanguage: value }), safetyGuided: false }))
      .toBe(`${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Reply language: reply in ${words}.`);
  });

  it('states the precedence: the current explicit request and safety guidance come first', () => {
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toMatch(/explicit request the user makes in the current conversation takes precedence/u);
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toMatch(/safety guidance always takes precedence/u);
  });

  it('WELCOME permits humour and never asks for a joke; DECLINED forbids it', () => {
    const welcome = compileInteractionPreferenceGuidance({ preferences: prefs({ humour: 'WELCOME' }), safetyGuided: false })!;
    expect(welcome).toContain('- Humour: light humour is welcome where it fits naturally; never force a joke.');
    expect(welcome).not.toMatch(/\b(?:tell|include|add|make) (?:a )?jokes?\b/iu);
    expect(compileInteractionPreferenceGuidance({ preferences: prefs({ humour: 'DECLINED' }), safetyGuided: false }))
      .toBe(`${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Humour: do not use humour.`);
  });

  // R2-01 — P6 / HUMOUR_SUSPENDED_SAFETY: EVERY GUIDED turn suspends humour, whatever the preference, DEFAULT included.
  it.each([
    ['DEFAULT (no declaration at all)', DEFAULT_INTERACTION_PREFERENCES, undefined],
    ['WELCOME', prefs({ humour: 'WELCOME' }), undefined],
    ['DECLINED', prefs({ humour: 'DECLINED' }), `${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Humour: do not use humour.`],
    ['DEFAULT with another field chosen', prefs({ replyLength: 'ALWAYS_BRIEF' }), `${INTERACTION_PREFERENCE_GUIDANCE_HEADER}\n- Reply length: keep the reply brief.`],
  ] as const)('GUIDED with humour %s: the Safety suspension is rendered, never a welcome', (_name, preferences, block) => {
    const guided = compileInteractionPreferenceGuidance({ preferences, safetyGuided: true })!;
    expect(guided).toBe(block === undefined ? SAFETY_HUMOUR_SUSPENSION_LINE : `${block}\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`);
    expect(guided).not.toContain('humour is welcome');
    // Safety's constraint is its own line, never presented under the header as the user's own choice.
    expect(guided.slice(0, guided.indexOf(SAFETY_HUMOUR_SUSPENSION_LINE))).not.toContain('playfulness');
    expect(new BehavioralResponsePolicyService().buildTextGuidance({ preferences, safetyGuided: true }))
      .toBe(`${TEXT_V4_BEHAVIORAL_GUIDANCE}\n\n${guided}`);
  });

  it('all DEFAULT is byte-identical Text v2 only without GUIDED; GUIDED all-DEFAULT adds exactly the Safety suspension', () => {
    const policy = new BehavioralResponsePolicyService();
    expect(policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: false })).toBe(TEXT_V4_BEHAVIORAL_GUIDANCE);
    expect(policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: true }))
      .toBe(`${TEXT_V4_BEHAVIORAL_GUIDANCE}\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`);
  });

  it('R2-02: the block outranks remembered context, so an old Memory never weakens a declared preference', () => {
    expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toMatch(/take precedence over anything inferred from the conversation or from user memory context/u);
  });

  it('is pure and deterministic, carries no provider name, no profiling and no user content', () => {
    const input = { preferences: prefs({ replyLength: 'ALWAYS_BRIEF', humour: 'WELCOME' }), safetyGuided: false };
    const once = compileInteractionPreferenceGuidance(input);
    expect(compileInteractionPreferenceGuidance(input)).toBe(once);
    expect(once).not.toMatch(/Claude|Anthropic|OpenAI|GPT|Gemini|the user is|the user has|diagnos/iu);
    // The largest block stays small inside the 64 KiB Mandatory Core.
    const largest = compileInteractionPreferenceGuidance({ preferences: prefs({ replyLength: 'ALWAYS_BRIEF', replyLanguage: 'MODERN_STANDARD_ARABIC', humour: 'WELCOME', explanationStyle: 'SIMPLER_AND_DIRECT' }), safetyGuided: false })!;
    expect(Buffer.byteLength(largest, 'utf8')).toBeLessThan(1_024);
  });
});
