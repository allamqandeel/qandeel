import type { LocaleShape } from './en';

/**
 * Register: فصحى محايدة for the instrument's own chrome. The transcript itself is
 * Egyptian and stays exactly as the fixture recorded it — the app never rewrites the
 * user's words.
 */
export const ar: LocaleShape = {
  app: {
    title: 'قنديل — التحليل الحيّ',
    subtitle: 'نموذج عرض',
    placeholderNotice: 'نموذج استكشافيّ. الألوان والخطوط مؤقّتة، وليست اختيارًا نهائيًّا.',
  },
  controls: {
    play: 'تشغيل',
    pause: 'إيقاف',
    restart: 'من البداية',
    switchLanguage: 'English',
    beatCount: '{{done}} من {{total}}',
  },
  transcript: {
    heading: 'المتن',
    waiting: 'اضغط تشغيل لتشغيل الجلسة المسجّلة.',
  },
  focus: {
    backToWhole: 'عد إلى الصورة الكاملة',
    focusedOn: 'التركيز على',
    noRanking: 'تُعرض القراءات جنبًا إلى جنب، دون ترتيب ودون ترجيح واحدة على الأخرى.',
  },
  legend: {
    heading: 'ما الذي تراه',
    anchor: 'مَربِط',
    anchorGloss: 'موضع من كلامك استند إليه التحليل.',
    card: 'حاشية',
    cardGloss: 'تعليق قصير بجانب المَربِط.',
    thread: 'خيط',
    threadGloss: 'صلة مرسومة بين هذا المَربِط وآخر سابق.',
    meter: 'مؤشّر',
    meterGloss: 'قيمة متتبَّعة، تظهر ومعها ما حرّكها.',
    spine: 'المسار',
    spineGloss: 'شريط ممتدّ: علامة لكلّ نبضة ذات معنى.',
    emergingFrame: 'إطار يتشكّل',
    emergingFrameGloss: 'قراءة أوسع تتجمّع عبر عدّة نبضات.',
    openGap: 'ثغرة مفتوحة',
    openGapGloss: 'أمر لم يُحسم بعد. وليس نتيجةً.',
  },
  thread: {
    SUPPORT: 'يسند',
    CONTRADICT: 'يناقض',
    EVOLVE: 'يتطوّر عنه',
    CONNECT: 'يتّصل به',
  },
  weight: {
    LOW: 'خفيف',
    MEDIUM: 'متوسّط',
    HIGH: 'قويّ',
  },
  meter: {
    cause: 'حرّكه',
    unbound: 'لم يُسجَّل سبب',
  },
  spine: {
    heading: 'المسار',
    scrubHint: 'اسحب على المسار للتنقّل داخل الجلسة.',
    beat: 'نبضة',
  },
  gap: {
    stillOpen: 'ما زال مفتوحًا',
  },
  evidence: {
    level: 'مستوى التحليل',
    confidence: 'درجة الثقة',
  },
  direction: {
    nativeMismatch:
      'اتّجاه التخطيط في النظام ما زال تابعًا للغة الجهاز. أعد تشغيل التطبيق ليسري الاتّجاه الجديد.',
  },
  honesty: {
    heading: 'ما لم تسمح البيانات برسمه',
    capped:
      '{{primitive}} في النبضة {{beat}}: طُلب {{asked}}، ورُسم {{drawn}} — لأنّ {{levels}} لا يحتمل أكثر.',
    dropped: '{{primitive}} في النبضة {{beat}} لم يُرسم — {{reason}}.',
    clean: 'كلّ عنصر على الشاشة مرسوم بالوزن الذي تحتمله أدلّته.',
    reasonFrameThreshold: 'الإطار المتشكّل يحتاج موضوعين رئيسيّين على الأقلّ ومستوى استنتاجيًّا',
    reasonNoGeometry: 'أحد طرفيه لم يُقَس موضعه بعد',
    noScale: 'لا مقياس مسجَّل — يظهر اتّجاه كلّ حركة مسجّلة فقط.',
  },
};
