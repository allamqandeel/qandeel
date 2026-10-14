// S6-01 — structural isolation of the owner's Introductions preparation (CW2-06A §2.2, §3; Product Owner D1, D3, D6).
//   * The module reaches prior understanding only through the database's consent-gated reader: it imports no
//     Conversation, Memory, Hypothesis, HIM, Model Router, Shared or Public source, and calls no model.
//   * It names no I-07 Matching setup command or relation: preparation is never enrollment.
//   * Nothing outside it — and no Shared, Public or Matching runtime source — imports it.
//   * It writes nothing to a log.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const sources = (dir: string): string[] => readdirSync(join(SRC, dir)).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(join(SRC, path)).isDirectory()) return sources(path);
  return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
});
const MODULE = 'introductions-preparation';
const own = sources(MODULE);

describe('S6-01 — the Introductions preparation is isolated', () => {
  it('the module exists as the expected files', () => {
    expect(own.map((p) => p.replace(/\\/gu, '/')).sort()).toEqual([
      'introductions-preparation/introductions-preparation.controller.ts',
      'introductions-preparation/introductions-preparation.module.ts',
      'introductions-preparation/introductions-preparation.repository.ts',
      'introductions-preparation/introductions-preparation.service.ts',
      'introductions-preparation/introductions-preparation.types.ts',
      'introductions-preparation/onboarding-objective-selector.ts',
      'introductions-preparation/onboarding-phrasing.port.ts',
    ]);
  });

  it.each(own)('%s imports only its own files, auth and the Data API transport', (path) => {
    const text = readFileSync(join(SRC, path), 'utf8');
    const imports = [...text.matchAll(/from '([^']+)'/gu)].map((m) => m[1]);
    for (const target of imports) {
      expect(target.startsWith('./') || ['@nestjs/common', '../auth/authenticated-request', '../auth/supabase-auth.guard',
        '../auth/supabase-auth.service', '../conversation/supabase-data-api.service'].includes(target)).toBe(true);
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
    expect(code).not.toMatch(/model-router|ModelRouter|memory\/|hypothes|human-model|shared-world|public-world|service[-_]role/iu);
    expect(code).not.toMatch(/console\.|Logger|captureException|Sentry/u);
  });

  it('no source names an I-07 Matching setup command or relation', () => {
    for (const path of own) {
      expect(readFileSync(join(SRC, path), 'utf8')).not.toMatch(
        /activate_matching_participation|resume_matching_participation|grant_matching_context|set_introduction_profile|set_matching_requirements|grant_pre_match_disclosure_authority|get_my_matching_setup|matching_participation|introduction_profile_version/u);
    }
  });

  it('only the Account module composes it; no Shared, Public, Conversation or Matching runtime source imports it', () => {
    const importers = sources('.').filter((path) => !path.replace(/\\/gu, '/').startsWith(`${MODULE}/`)
      && readFileSync(join(SRC, path), 'utf8').includes(`${MODULE}/`));
    expect(importers.map((p) => p.replace(/\\/gu, '/'))).toEqual(['account/account.module.ts']);
  });
});
