import { Platform } from 'react-native';

import type { AppLanguage } from '../i18n';

/**
 * Deep-link parameters for review, honoured on web only.
 *
 *   ?lang=ar|en    start in that language
 *   ?beats=N       start with N beats already played
 *
 * They exist so a specific frame of the sequence can be opened, screenshotted and
 * compared across the two directions without anyone having to click through the
 * playback by hand. They change nothing about how beats are interpreted.
 */
export interface ReviewParams {
  language?: AppLanguage;
  beats?: number;
}

export function readReviewParams(): ReviewParams {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const out: ReviewParams = {};

    const lang = params.get('lang');
    if (lang === 'ar' || lang === 'en') out.language = lang;

    const beats = Number(params.get('beats'));
    if (Number.isInteger(beats) && beats >= 0) out.beats = beats;

    return out;
  } catch {
    return {};
  }
}
