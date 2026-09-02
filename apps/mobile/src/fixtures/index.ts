import type { AppLanguage } from '../i18n';
import type { CaseStudyFixture } from '../schema/types';

import arFixture from './case_study_01.ar.json';
import enFixture from './case_study_01.en.json';

/**
 * `case_study_01.ar.json` is `06_CASE_STUDY_SAMPLE_BEATS.json` byte for byte.
 * `case_study_01.en.json` mirrors it: same beat ids, same span ids, same refs, same
 * render bindings — only the human text is translated, so any difference on screen
 * between the two runs is a rendering difference and not a data difference.
 */
export const FIXTURES: Record<AppLanguage, CaseStudyFixture> = {
  ar: arFixture as CaseStudyFixture,
  en: enFixture as CaseStudyFixture,
};

export function fixtureFor(language: AppLanguage): CaseStudyFixture {
  return FIXTURES[language];
}
