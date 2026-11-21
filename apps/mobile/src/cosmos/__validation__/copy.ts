// COSMOS proof (experimental, isolated) — the proof's chrome words. The browser gate's COPY table, word for word, plus
// the few words only the device proof needs (the fault selector, the Measurements sheet, the overview tag).
// Not Product copy. The Measurements sheet itself is English only: it is an engineering instrument.

import type { WorldKind } from '../core/stage';
import type { CosmosFault } from './fixture-transports';

export type CosmosLanguage = 'ar' | 'en';

export interface CosmosCopy {
  readonly PERSONAL: string; readonly SHARED: string; readonly PUBLIC: string;
  readonly fixture: string; readonly back: string; readonly overview: string;
  readonly rungs: Readonly<Record<WorldKind, readonly string[]>>;
  readonly loading: string; readonly unavailable: string; readonly retry: string; readonly refused: string;
  readonly worldEmpty: string; readonly regionEmpty: string; readonly nearest: string; readonly absent: string;
  readonly thread: string; readonly reading: string; readonly home: string; readonly hosted: string; readonly noDetail: string;
  readonly fringe: (n: number) => string; readonly position: (a: number, b: number) => string;
  readonly live: string; readonly by: string; readonly sources: string; readonly tapHint: string;
  // Device proof only.
  readonly close: string; readonly zoomIn: string; readonly zoomOut: string; readonly sky: string;
  readonly faults: Readonly<Record<CosmosFault, string>>; readonly faultTitle: string;
  readonly measurements: string; readonly overviewTag: string; readonly overviewAct: string;
}

export const COSMOS_COPY: Readonly<Record<CosmosLanguage, CosmosCopy>> = {
  en: { PERSONAL: 'Personal', SHARED: 'Shared', PUBLIC: 'Public', fixture: 'Synthetic fixture · not real analysis', back: 'Back', overview: 'Whole world',
    rungs: { PERSONAL: ['World', 'Thread', 'Session', 'Object', 'Source'], SHARED: ['Far', 'Mid', 'Near'], PUBLIC: ['Far', 'Mid', 'Near'] },
    loading: 'Reading…', unavailable: 'This could not be read just now.', retry: 'Try again', refused: 'This is not available to you.',
    worldEmpty: 'Nothing is here yet.', regionEmpty: 'Nothing in this region.', nearest: 'Go to the nearest',
    absent: 'This is no longer here.', thread: 'Thread', reading: 'Reading', home: 'At its permanent place', hosted: 'Appears on a thread',
    noDetail: 'This view does not cover what you are inspecting.', fringe: (n) => `${n} not yet placed`, position: (a, b) => `Position ${a} of ${b}`,
    live: 'Live', by: 'By', sources: 'From', tapHint: 'Pinch or double-tap to go closer',
    close: 'Close', zoomIn: 'Go closer', zoomOut: 'Go further', sky: 'The world',
    faultTitle: 'Fixture network',
    faults: { NONE: 'Normal', SLOW: 'Slow details', FAIL: 'Reads fail', REFUSED: 'Refused', EMPTY_WORLD: 'World empty' },
    measurements: 'Measurements', overviewTag: 'overview (presentation only)', overviewAct: 'Overview' },
  ar: { PERSONAL: 'الشخصي', SHARED: 'المشترك', PUBLIC: 'العام', fixture: 'بيانات اختبارية · ليست تحليلًا حقيقيًا', back: 'رجوع', overview: 'العالم كله',
    rungs: { PERSONAL: ['العالم', 'الخيط', 'الجلسة', 'العنصر', 'المصدر'], SHARED: ['بعيد', 'متوسط', 'قريب'], PUBLIC: ['بعيد', 'متوسط', 'قريب'] },
    loading: 'جارٍ القراءة…', unavailable: 'تعذّرت القراءة الآن.', retry: 'حاول مجددًا', refused: 'هذا غير متاح لك.',
    worldEmpty: 'لا شيء هنا بعد.', regionEmpty: 'لا شيء في هذه المنطقة.', nearest: 'اذهب إلى الأقرب',
    absent: 'لم يعد هذا موجودًا.', thread: 'خيط', reading: 'قراءة', home: 'في مكانه الدائم', hosted: 'يظهر على خيط',
    noDetail: 'هذا العرض لا يغطي ما تتفحّصه.', fringe: (n) => `${n} بلا مكان بعد`, position: (a, b) => `الموضع ${a} من ${b}`,
    live: 'مباشر', by: 'بقلم', sources: 'من', tapHint: 'قرّب بإصبعين أو بنقرتين',
    close: 'إغلاق', zoomIn: 'اقترب', zoomOut: 'ابتعد', sky: 'العالم',
    faultTitle: 'شبكة الاختبار',
    faults: { NONE: 'عادي', SLOW: 'تفاصيل بطيئة', FAIL: 'القراءة تفشل', REFUSED: 'مرفوض', EMPTY_WORLD: 'عالم فارغ' },
    measurements: 'القياسات', overviewTag: 'نظرة عامة (عرض فقط)', overviewAct: 'نظرة عامة' },
};
