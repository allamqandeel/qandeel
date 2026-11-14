// NASIJ proof (experimental, isolated) — the proof's chrome words. The browser preview's COPY table, word for word,
// plus the few words only the device proof needs (the fault selector and the HUD). Not Product copy.

import type { NasijWorldKind } from '../core/scene';
import type { NasijFault } from './fixture-transports';

export type NasijLanguage = 'ar' | 'en';

export interface NasijCopy {
  readonly PERSONAL: string; readonly SHARED: string; readonly PUBLIC: string;
  readonly fixture: string; readonly back: string; readonly overview: string;
  readonly rungs: Readonly<Record<NasijWorldKind, readonly string[]>>;
  readonly loading: string; readonly unavailable: string; readonly retry: string; readonly refused: string;
  readonly worldEmpty: string; readonly regionEmpty: string; readonly nearest: string; readonly absent: string;
  readonly thread: string; readonly reading: string; readonly home: string; readonly hosted: string; readonly noDetail: string;
  readonly fringe: (n: number) => string; readonly position: (a: number, b: number) => string;
  readonly live: string; readonly by: string; readonly sources: string; readonly tapHint: string;
  // Device proof only.
  readonly night: string; readonly close: string; readonly zoomIn: string; readonly zoomOut: string; readonly cloth: string;
  readonly faults: Readonly<Record<NasijFault, string>>; readonly faultTitle: string;
}

export const NASIJ_COPY: Readonly<Record<NasijLanguage, NasijCopy>> = {
  en: { PERSONAL: 'Personal', SHARED: 'Shared', PUBLIC: 'Public', fixture: 'Synthetic fixture · not real analysis', back: 'Back', overview: 'Whole cloth',
    rungs: { PERSONAL: ['World', 'Thread', 'Session', 'Object', 'Source'], SHARED: ['Far', 'Mid', 'Near'], PUBLIC: ['Far', 'Mid', 'Near'] },
    loading: 'Reading…', unavailable: 'This could not be read just now.', retry: 'Try again', refused: 'This is not available to you.',
    worldEmpty: 'Nothing has been woven here yet.', regionEmpty: 'Nothing in this part of the cloth.', nearest: 'Go to the nearest',
    absent: 'This is no longer here.', thread: 'Thread', reading: 'Reading', home: 'At its permanent place', hosted: 'Appears on a thread',
    noDetail: 'This view does not cover what you are inspecting.', fringe: (n) => `${n} not yet placed`, position: (a, b) => `Position ${a} of ${b}`,
    live: 'Live', by: 'By', sources: 'From', tapHint: 'Pinch, scroll or double-tap to go closer',
    night: 'Night cloth', close: 'Close', zoomIn: 'Go closer', zoomOut: 'Go further', cloth: 'The cloth',
    faultTitle: 'Fixture network',
    faults: { NONE: 'Normal', SLOW: 'Slow details', FAIL: 'Reads fail', REFUSED: 'Refused', EMPTY_WORLD: 'World empty', DENSE: 'Public ×400 stress' } },
  ar: { PERSONAL: 'الشخصي', SHARED: 'المشترك', PUBLIC: 'العام', fixture: 'بيانات اختبارية · ليست تحليلًا حقيقيًا', back: 'رجوع', overview: 'النسيج كله',
    rungs: { PERSONAL: ['العالم', 'الخيط', 'الجلسة', 'العنصر', 'المصدر'], SHARED: ['بعيد', 'متوسط', 'قريب'], PUBLIC: ['بعيد', 'متوسط', 'قريب'] },
    loading: 'جارٍ القراءة…', unavailable: 'تعذّرت القراءة الآن.', retry: 'حاول مجددًا', refused: 'هذا غير متاح لك.',
    worldEmpty: 'لم يُنسج شيء هنا بعد.', regionEmpty: 'لا شيء في هذا الجزء من النسيج.', nearest: 'اذهب إلى الأقرب',
    absent: 'لم يعد هذا موجودًا.', thread: 'خيط', reading: 'قراءة', home: 'في مكانه الدائم', hosted: 'يظهر على خيط',
    noDetail: 'هذا العرض لا يغطي ما تتفحّصه.', fringe: (n) => `${n} بلا مكان بعد`, position: (a, b) => `الموضع ${a} من ${b}`,
    live: 'مباشر', by: 'بقلم', sources: 'من', tapHint: 'قرّب بإصبعين أو بالتمرير أو بنقرتين',
    night: 'نسيج الليل', close: 'إغلاق', zoomIn: 'اقترب', zoomOut: 'ابتعد', cloth: 'النسيج',
    faultTitle: 'شبكة الاختبار',
    faults: { NONE: 'عادي', SLOW: 'تفاصيل بطيئة', FAIL: 'القراءة تفشل', REFUSED: 'مرفوض', EMPTY_WORLD: 'عالم فارغ', DENSE: 'ضغط العام ×٤٠٠' } },
};
