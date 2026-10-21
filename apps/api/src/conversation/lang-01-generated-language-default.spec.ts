// S8A-02: re-anchored to Text v4 / core v2 (Personal) and the world-neutral core v2, rendered since the approved core v2 (Product Owner D1 / D2, 2026-10-21). The D4 lines are unchanged.
// S8A-02 Round 2 (2026-10-21): re-anchored again to core v3 and the world-neutral core v3 (the Round 2 Copy Gate). The D4 lines are unchanged.
import {
  ARABIC_DEFAULT_LANGUAGE_LINE, ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL, BehavioralResponsePolicyService, QANDEEL_PERSONALITY_CORE_V3,
  QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL, TEXT_V1_BEHAVIORAL_GUIDANCE, TEXT_V4_BEHAVIORAL_GUIDANCE, withWorldNeutralPersonality,
} from './behavioral-response-policy.service';
import { INTERACTION_PREFERENCE_GUIDANCE_HEADER, SAFETY_HUMOUR_SUSPENSION_LINE } from '../interaction-preferences/interaction-preference-guidance';
import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from '../interaction-preferences/interaction-preferences.types';
import { PUBLIC_QANDEEL_FRAME } from '../public-world/public-qandeel-model-input';
import { SHARED_CONVERSATION_FRAME } from '../shared-world/shared-conversation-model-input';

// LANG-01 Work Package C (the LANG-01 controlled amendment, LA-17): the Product Owner's D4 default for genuinely generated
// Arabic — an explicit request, then a standing reply-language preference, then the user's reasonably clear dialect,
// otherwise neutral simplified Modern Standard Arabic, never Egyptian by default — stated once per world type in the
// model-facing guidance. Guidance only: nothing here classifies a dialect or calls a model.
const count = (text: string, part: string): number => text.split(part).length - 1;
const prefs = (over: Partial<InteractionPreferences>): InteractionPreferences => ({ ...DEFAULT_INTERACTION_PREFERENCES, ...over });
const policy = new BehavioralResponsePolicyService();
const WORLD_PREFIXES = [`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${SHARED_CONVERSATION_FRAME}`, `${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${PUBLIC_QANDEEL_FRAME}`];

describe('LANG-01 D4 — the generated-language default in the model-facing guidance', () => {
  it('Personal: the D4 line follows the core (Text v4 since S8A-02), once, and names no dialect as a default', () => {
    const guidance = policy.buildTextGuidance();
    expect(guidance).toBe(TEXT_V4_BEHAVIORAL_GUIDANCE);
    expect(guidance.endsWith(`\n\n${ARABIC_DEFAULT_LANGUAGE_LINE}`)).toBe(true);
    expect(guidance.startsWith(`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n\n${QANDEEL_PERSONALITY_CORE_V3}`)).toBe(true);
    expect(count(guidance, ARABIC_DEFAULT_LANGUAGE_LINE)).toBe(1);
    expect(ARABIC_DEFAULT_LANGUAGE_LINE).toContain('neutral simplified Modern Standard Arabic');
    expect(ARABIC_DEFAULT_LANGUAGE_LINE).toContain('Never default to Egyptian Arabic or any other regional dialect.');
    expect(guidance).not.toContain(ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL);
  });

  it.each(['EGYPTIAN_ARABIC', 'GULF_ARABIC', 'MODERN_STANDARD_ARABIC', 'ENGLISH'] as const)(
    'Personal: a standing %s preference still renders after the default, under the header that gives it precedence', (replyLanguage) => {
      const guidance = policy.buildTextGuidance({ preferences: prefs({ replyLanguage }), safetyGuided: false });
      const defaultAt = guidance.indexOf(ARABIC_DEFAULT_LANGUAGE_LINE);
      const headerAt = guidance.indexOf(INTERACTION_PREFERENCE_GUIDANCE_HEADER);
      expect(defaultAt).toBeGreaterThan(0);
      expect(headerAt).toBeGreaterThan(defaultAt);
      expect(INTERACTION_PREFERENCE_GUIDANCE_HEADER).toContain('They take precedence over anything inferred from the conversation');
      expect(guidance).toMatch(/- Reply language: reply in /u);
    });

  it('Personal on a GUIDED turn: the default stays before the Safety humour suspension, which stays last', () => {
    const guidance = policy.buildTextGuidance({ preferences: DEFAULT_INTERACTION_PREFERENCES, safetyGuided: true });
    expect(guidance).toBe(`${TEXT_V4_BEHAVIORAL_GUIDANCE}\n\n${SAFETY_HUMOUR_SUSPENSION_LINE}`);
  });

  it('Shared and Public: the world-neutral line follows the world-neutral core and reads only the message being answered', () => {
    for (const prefix of WORLD_PREFIXES) {
      for (const guided of [false, true]) {
        const guidance = withWorldNeutralPersonality(prefix, guided);
        expect(guidance.startsWith(`${prefix}\n\n${QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL}\n\n${ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL}`)).toBe(true);
        expect(count(guidance, ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL)).toBe(1);
        // No participant's personal authority reaches the others: no Personal line, no preference header.
        expect(guidance).not.toContain(ARABIC_DEFAULT_LANGUAGE_LINE);
        expect(guidance).not.toContain(INTERACTION_PREFERENCE_GUIDANCE_HEADER);
        expect(guidance.endsWith(SAFETY_HUMOUR_SUSPENSION_LINE)).toBe(guided);
      }
    }
    expect(ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL).toContain('the message you are answering');
    expect(ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL).toContain('never treat one participant\'s language or dialect as a standing preference for anyone else');
  });

  it('is deterministic guidance: the same inputs give the same bytes, and Text v1 is still the frozen prefix everywhere', () => {
    expect(policy.buildTextGuidance()).toBe(policy.buildTextGuidance());
    for (const prefix of WORLD_PREFIXES) expect(withWorldNeutralPersonality(prefix, false).startsWith(TEXT_V1_BEHAVIORAL_GUIDANCE)).toBe(true);
    expect(policy.buildTextGuidance().startsWith(TEXT_V1_BEHAVIORAL_GUIDANCE)).toBe(true);
  });
});
