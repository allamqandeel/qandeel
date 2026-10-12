// IP-IMP-01 — Shared / Public isolation (D-SP Option A). A Personal interaction preference is private Personal context:
// it never enters a Shared World or Public World model input (CW2-04 §21-22; CW2-02 §16-17: no STANDING_CONTEXT_GRANT
// path exists, QAN-BL-CW-02 owns that decision). Structurally: no Shared / Public / Connected Worlds source reaches the
// preference authority, and both builders keep rendering the fixed Text v1 constant, never the per-owner policy.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TEXT_V1_BEHAVIORAL_GUIDANCE } from '../conversation/behavioral-response-policy.service';

const SRC = join(__dirname, '..');
const sources = (dir: string): string[] => readdirSync(join(SRC, dir)).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(join(SRC, path)).isDirectory()) return sources(path);
  return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
});

describe('IP-IMP-01 — Personal interaction preferences never enter a Shared or Public model input', () => {
  it.each(['shared-world', 'public-world', 'connected-worlds'])('no %s source imports the preference authority or the per-owner policy', (dir) => {
    const offenders = sources(dir).filter((path) => /interaction-preference|InteractionPreference|BehavioralResponsePolicyService|BEHAVIORAL_RESPONSE_POLICY/u.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it.each(['shared-world/shared-conversation-model-input.ts', 'public-world/public-qandeel-model-input.ts'])('%s renders the fixed Text v1 constant', (path) => {
    const text = readFileSync(join(SRC, path), 'utf8');
    expect(text).toMatch(/TEXT_V1_BEHAVIORAL_GUIDANCE/u);
    expect(text).not.toMatch(/buildTextGuidance\(/u);
  });

  it('Text v1 itself carries no preference line', () => {
    expect(TEXT_V1_BEHAVIORAL_GUIDANCE).not.toMatch(/Standing interaction preferences|Reply language:|Humour:/u);
  });
});
