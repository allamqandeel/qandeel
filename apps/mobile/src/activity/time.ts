/**
 * A3-01 — Activity's times, through the ONE locale authority (`numberFormattingTag`: Egypt region, Western `latn`
 * digits — the v1 numeral policy, T-12 `QAN-BL-T12-02`). Day groups are by the device's local calendar day.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import { numberFormattingTag, productLocale } from '../integration';

export type DayGroup = 'TODAY' | 'YESTERDAY' | 'EARLIER';

const tag = (language: ChromeLanguage) => `${numberFormattingTag(productLocale(language, language === 'ar' ? 'RTL' : 'LTR'))}-ca-gregory`;
const dayStart = (ms: number) => {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export function dayGroupOf(instant: string, now: number): DayGroup {
  const days = Math.round((dayStart(now) - dayStart(Date.parse(instant))) / 86_400_000);
  return days <= 0 ? 'TODAY' : days === 1 ? 'YESTERDAY' : 'EARLIER';
}

/** 24-hour device-local clock time ("23:00"), as Quiet Hours are written. */
export function clockTime(instant: string | number, language: ChromeLanguage): string {
  try {
    return new Intl.DateTimeFormat(tag(language), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
  } catch {
    const date = new Date(instant);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

/** A row's time: the clock time today / yesterday, the day and month earlier. */
export function rowTime(instant: string, language: ChromeLanguage, now: number): string {
  if (dayGroupOf(instant, now) !== 'EARLIER') return clockTime(instant, language);
  try {
    return new Intl.DateTimeFormat(tag(language), { day: 'numeric', month: 'short' }).format(new Date(instant));
  } catch {
    return instant.slice(0, 10);
  }
}

/** A device-local end moment within the next week: the weekday and clock time ("Thu 14:00"). */
export function weekTime(instant: string | number, language: ChromeLanguage): string {
  try {
    return new Intl.DateTimeFormat(tag(language), { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
  } catch {
    return clockTime(instant, language);
  }
}
