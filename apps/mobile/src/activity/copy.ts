/**
 * A3-01 — the ONE place the words of «النشاط» / Activity, the Attention Strip and Notifications & Activity are written.
 *
 * Authority, per string (no proof copy is silently promoted):
 *   - CANON — frozen by an earlier record: «النشاط» / Activity, «الكل» / All, «من قنديل» / From QANDEEL, the World and
 *     Introductions names, «الإشعارات والنشاط» / Notifications & Activity, «سماح» / «أقل» / «إيقاف» (Allow / Reduce /
 *     Off), the four Lock Screen labels (P3 §17; the pinned P4-C3 registry `st: CANON`);
 *   - APPROVED — the 72 `p3.*` rows and `activityNew`, ratified by P4-C4 §6–§7, byte-exact from the pinned registry
 *     `docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_REGISTRY.json` (blob `feaee440…`);
 *     the registry key is named beside each row;
 *   - VI-01 T03 — «إعادة المحاولة» / "Try again", reused from `conversation/copy.ts`, not rewritten;
 *   - A3-01 PRODUCT COPY GATE — `ACTIVITY_COPY_GATE` below: the rows no record approves, required by controls the Task
 *     Contract requires. They are PROPOSED, awaiting the Product Owner, and A3-01 is not READY FOR INDEPENDENT REVIEW
 *     until each one is approved (or replaced) and re-marked here.
 *
 * Not used: the permission-education sheet (`p3.edu*`, `AUDIT_OWNED`; A3-02), and every `FIXTURE_ONLY` event sentence —
 * event sentences come only from the source domain that publishes them.
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { ActivityCategory, DisclosureLevel, LockSubject, ProactiveChoice } from '../runtime-entry';

export type CopyGateStatus = 'PROPOSED — AWAITING PRODUCT OWNER APPROVAL';

/** A3-01 Product Copy Gate — every row here is unapproved. Presented to the Product Owner; bound only once approved. */
export const ACTIVITY_COPY_GATE = Object.freeze({
  status: 'PROPOSED — AWAITING PRODUCT OWNER APPROVAL' as CopyGateStatus,
  rows: Object.freeze({
    /** Activity: the first page is being read. */
    loading: { ar: 'جارٍ تحميل النشاط…', en: 'Loading Activity…' },
    /** Activity: the page could not be read (the act beside it is the frozen «إعادة المحاولة»). */
    unavailable: { ar: 'تعذّر تحميل النشاط.', en: 'Activity couldn’t load.' },
    /** A row whose destination's surface does not exist yet (Stage 4–8): typed, failing closed. */
    entryUnavailable: { ar: 'لا يمكن فتح هذا من هنا بعد.', en: 'This can’t be opened from here yet.' },
    /** Snooze is on: {0} is the device-local end time. */
    snoozeActive: { ar: 'الإيقاف المؤقت مفعّل حتى {0}', en: 'Snoozed until {0}' },
    /** Ends Snooze now. */
    snoozeEnd: { ar: 'إنهاء الإيقاف المؤقت', en: 'End Snooze' },
    /** The custom Snooze picker: the end it would set ({0}), and its two steps. */
    snoozeUntil: { ar: 'حتى {0}', en: 'Until {0}' },
    snoozeLonger: { ar: 'ساعة أكثر', en: 'One hour more' },
    snoozeShorter: { ar: 'ساعة أقل', en: 'One hour less' },
    /** Quiet Hours: the two edit labels. */
    quietStart: { ar: 'البداية', en: 'Starts' },
    quietEnd: { ar: 'النهاية', en: 'Ends' },
    /** Notifications & Activity: a change the server did not confirm. */
    saveFailed: { ar: 'تعذّر حفظ التغيير. حاول مرة أخرى.', en: 'The change couldn’t be saved. Try again.' },
    /** Notifications & Activity: the page could not be read. */
    settingsUnavailable: { ar: 'تعذّر تحميل إعدادات الإشعارات.', en: 'Notification settings couldn’t load.' },
  }),
});

type Gate = typeof ACTIVITY_COPY_GATE.rows;
const gate = (language: ChromeLanguage) => Object.fromEntries(
  Object.entries(ACTIVITY_COPY_GATE.rows).map(([key, pair]) => [key, pair[language]]),
) as { readonly [K in keyof Gate]: string };

export interface ActivityCopy {
  readonly title: string;
  readonly openName: string;
  readonly newState: string;
  readonly back: string;
  readonly settingsName: string;
  readonly filterGroup: string;
  readonly all: string;
  readonly filters: Readonly<Record<ActivityCategory, string>>;
  readonly sources: Readonly<Record<ActivityCategory, string>>;
  readonly today: string;
  readonly yesterday: string;
  readonly earlier: string;
  readonly markNew: string;
  readonly markWaiting: string;
  readonly stale: string;
  readonly staleExplain: string;
  readonly staleOpen: string;
  readonly muted: string;
  readonly empty: string;
  readonly stripRegion: string;
  readonly stripDismiss: string;
  readonly callSafeRegion: string;
  readonly now: string;
  readonly tryAgain: string;
  readonly gate: ReturnType<typeof gate>;
}

export interface NotificationsCopy {
  readonly section: string;
  readonly proactive: string;
  readonly proactiveHelp: string;
  readonly proactiveOptions: Readonly<Record<ProactiveChoice, string>>;
  readonly proactiveOptionHelp: Readonly<Record<ProactiveChoice, string>>;
  readonly shared: string;
  readonly sharedAlerts: string;
  readonly public: string;
  readonly publicInteractions: string;
  readonly publicDiscovery: string;
  readonly publicDiscoveryHelp: string;
  readonly introductions: string;
  readonly introductionsAlerts: string;
  readonly introductionsHelp: string;
  readonly system: string;
  readonly securityAlways: string;
  readonly accountUpdates: string;
  readonly quiet: string;
  readonly quietOn: string;
  readonly quietRange: string;
  readonly quietHelp: string;
  readonly snooze: string;
  readonly snoozeOptions: { readonly '1h': string; readonly '8h': string; readonly '24h': string; readonly custom: string };
  readonly lock: string;
  readonly lockHelp: string;
  readonly levels: Readonly<Record<DisclosureLevel, string>>;
  readonly levelHelp: Readonly<Record<DisclosureLevel, string>>;
  readonly lockSubjects: Readonly<Record<LockSubject, string>>;
  readonly device: string;
  readonly deviceHelp: string;
  readonly on: string;
  readonly off: string;
  readonly gate: ReturnType<typeof gate>;
}

const AR_ACTIVITY: Omit<ActivityCopy, 'gate'> = Object.freeze({
  title: 'النشاط', // CANON — activity
  openName: 'فتح النشاط', // APPROVED — p3.activityOpen
  newState: 'هناك جديد', // APPROVED — activityNew (P4-C4 §7)
  back: 'رجوع', // APPROVED — p3.back
  settingsName: 'إعدادات الإشعارات والنشاط', // APPROVED — p3.activitySettings
  filterGroup: 'تصفية النشاط', // APPROVED — p3.filterGroup
  all: 'الكل', // CANON — p3.filters.all
  filters: { QANDEEL: 'من قنديل', SHARED: 'العالم المشترك', PUBLIC: 'العالم العام', INTRODUCTIONS: 'التعارف', SYSTEM: 'النظام' },
  // CANON product / World / capability names; SYSTEM is APPROVED p3.filters.system.
  sources: { QANDEEL: 'قنديل', SHARED: 'العالم المشترك', PUBLIC: 'العالم العام', INTRODUCTIONS: 'التعارف', SYSTEM: 'النظام' },
  today: 'اليوم', // APPROVED — p3.day.today
  yesterday: 'أمس', // APPROVED — p3.day.yesterday
  earlier: 'في وقت سابق', // APPROVED — p3.day.earlier
  markNew: 'جديد', // APPROVED — p3.markNew
  markWaiting: 'في انتظارك', // APPROVED — p3.markWaiting
  stale: 'لم يعد متاحًا', // APPROVED — p3.stale
  staleExplain: 'ما كان هنا لم يعد متاحًا، ولن يُفتح مكان آخر بدلًا منه.', // APPROVED — p3.staleExplain
  staleOpen: 'فتح {0}', // APPROVED — p3.staleOpen
  muted: 'مكتوم', // APPROVED — p3.muted
  empty: 'لا شيء هنا الآن.', // APPROVED — p3.empty
  stripRegion: 'تنبيه', // APPROVED — p3.stripRegion
  stripDismiss: 'إغلاق التنبيه', // APPROVED — p3.stripDismiss
  callSafeRegion: 'تنبيه أثناء المكالمة', // APPROVED — p3.callSafeRegion
  now: 'الآن', // APPROVED — p3.now
  tryAgain: 'إعادة المحاولة', // VI-01 T03 (frozen), as conversation/copy.ts carries it
});

const EN_ACTIVITY: Omit<ActivityCopy, 'gate'> = Object.freeze({
  title: 'Activity',
  openName: 'Open Activity',
  newState: 'new items',
  back: 'Back',
  settingsName: 'Notifications & Activity settings',
  filterGroup: 'Filter Activity',
  all: 'All',
  filters: { QANDEEL: 'From QANDEEL', SHARED: 'Shared World', PUBLIC: 'Public World', INTRODUCTIONS: 'Introductions', SYSTEM: 'System' },
  sources: { QANDEEL: 'QANDEEL', SHARED: 'Shared World', PUBLIC: 'Public World', INTRODUCTIONS: 'Introductions', SYSTEM: 'System' },
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
  markNew: 'new',
  markWaiting: 'waiting for you',
  stale: 'No longer available',
  staleExplain: 'What was here is no longer available. Nothing else will open in its place.',
  staleOpen: 'Open {0}',
  muted: 'Muted',
  empty: 'Nothing here right now.',
  stripRegion: 'Alert',
  stripDismiss: 'Dismiss alert',
  callSafeRegion: 'Alert during your call',
  now: 'now',
  tryAgain: 'Try again',
});

const AR_NOTIFICATIONS: Omit<NotificationsCopy, 'gate'> = Object.freeze({
  section: 'الإشعارات والنشاط', // CANON — gNotif / P3 §12
  proactive: 'مبادرة قنديل', // APPROVED — p3.proactive
  proactiveHelp: 'يحدّد هذا الخيار متى يبدأ قنديل الكلام معك فقط، ولا يغيّر ذاكرته أو فهمه أو التحليل.', // APPROVED — p3.proactiveHelp
  proactiveOptions: { ALLOW: 'سماح', REDUCE: 'أقل', OFF: 'إيقاف' }, // CANON — p3.proactiveOpts.*
  proactiveOptionHelp: { // APPROVED — p3.proactiveOptHelp.*
    ALLOW: 'يبدأ قنديل الكلام معك عندما يكون لديه سبب يستحق.',
    REDUCE: 'يقاطعك قنديل أقل، ولا ينبّهك إلا لما هو أهم أو لما لا يحتمل التأجيل.',
    OFF: 'لن يبدأ قنديل الكلام معك من تلقاء نفسه، ويمكنك محادثته متى شئت.',
  },
  shared: 'العالم المشترك', // CANON — shared
  sharedAlerts: 'تنبيهات العالم المشترك', // APPROVED — p3.sharedAll
  public: 'العالم العام', // CANON — public
  publicInteractions: 'الردود والتفاعلات معك', // APPROVED — p3.publicInter
  publicDiscovery: 'اكتشافات من العالم العام', // APPROVED — p3.publicDisc
  publicDiscoveryHelp: 'اختياري — مرة في الأسبوع على الأكثر', // APPROVED — p3.publicDiscHelp
  introductions: 'التعارف', // CANON — intro
  introductionsAlerts: 'تنبيهات التعارف', // APPROVED — p3.introOn
  introductionsHelp: 'لا تكشف شاشة القفل افتراضيًا أن الإشعار يخص التعارف.', // APPROVED — p3.introHelp
  system: 'الأمان والحساب', // APPROVED — p3.systemSec
  securityAlways: 'تنبيهات الأمان المهمة تصلك دائمًا، حتى في ساعات الهدوء، ولا يمكنها تجاوز إعدادات جهازك.', // APPROVED — p3.securityAlways
  accountUpdates: 'تحديثات الحساب الأخرى', // APPROVED — p3.systemOther
  quiet: 'ساعات الهدوء', // APPROVED — p3.quiet
  quietOn: 'تفعيل ساعات الهدوء', // APPROVED — p3.quietOn
  quietRange: 'من {0} إلى {1}', // APPROVED — p3.quietRange
  quietHelp: 'لا يصلك خلالها إلا تذكير طلبته لموعد محدد أو تنبيه أمان مهم. وعند انتهائها يُعاد النظر في ما انتظر، ولا يصلك دفعة واحدة.', // APPROVED — p3.quietHelp
  snooze: 'إيقاف مؤقت', // APPROVED — p3.snooze
  snoozeOptions: { '1h': 'ساعة', '8h': '8 ساعات', '24h': '24 ساعة', custom: 'مدة أخرى' }, // APPROVED — p3.snoozeOpts.*
  lock: 'معاينات شاشة القفل', // APPROVED — p3.lockSec
  lockHelp: 'هذا حدّ أقصى: قد يُظهر قنديل تفاصيل أقل.', // APPROVED — p3.lockHelp
  levels: { L0: 'خاصة جدًا', L1: 'إظهار النوع', L2: 'إظهار السياق', L3: 'إظهار المعاينة' }, // CANON — p3.levels.*
  levelHelp: { // APPROVED — p3.levelHelp.*
    L0: 'لا يظهر إلا أن هناك إشعارًا جديدًا.',
    L1: 'يظهر نوع الإشعار فقط.',
    L2: 'يظهر المكان وما حدث ومَن قام به، دون المحتوى.',
    L3: 'يظهر جزء من المحتوى على شاشة القفل.',
  },
  // CANON product / World / capability names; the rest APPROVED p3.lockSubjects.*.
  lockSubjects: { QANDEEL: 'قنديل', SHARED: 'العالم المشترك', PUBLIC: 'العالم العام', DISCOVERY: 'اكتشافات العالم العام', INTRODUCTIONS: 'التعارف', REMINDERS: 'التذكيرات', ACCOUNT: 'الحساب', SECURITY: 'الأمان' },
  device: 'إعدادات إشعارات الجهاز', // APPROVED — p3.device
  deviceHelp: 'الصوت وشكل التنبيه وشاشة القفل يتحكم فيها جهازك.', // APPROVED — p3.deviceHelp
  on: 'مفعّل', // APPROVED — p3.on
  off: 'متوقف', // APPROVED — p3.off
});

const EN_NOTIFICATIONS: Omit<NotificationsCopy, 'gate'> = Object.freeze({
  section: 'Notifications & Activity',
  proactive: 'QANDEEL reaching out',
  proactiveHelp: 'This only controls when QANDEEL starts a conversation with you. Its memory, understanding and analysis stay the same.',
  proactiveOptions: { ALLOW: 'Allow', REDUCE: 'Reduce', OFF: 'Off' },
  proactiveOptionHelp: {
    ALLOW: 'QANDEEL can reach out when there\'s a good reason.',
    REDUCE: 'QANDEEL interrupts you less, and only for what matters most or can\'t wait.',
    OFF: 'QANDEEL won\'t start a conversation on its own. You can talk to it whenever you like.',
  },
  shared: 'Shared World',
  sharedAlerts: 'Shared World alerts',
  public: 'Public World',
  publicInteractions: 'Replies and interactions with you',
  publicDiscovery: 'Discoveries from the Public World',
  publicDiscoveryHelp: 'Optional — at most once a week',
  introductions: 'Introductions',
  introductionsAlerts: 'Introduction alerts',
  introductionsHelp: 'By default, the Lock Screen doesn\'t show that a notification is about Introductions.',
  system: 'Security & Account',
  securityAlways: 'Important security alerts always reach you, even during Quiet Hours. They can\'t override your device settings.',
  accountUpdates: 'Other account updates',
  quiet: 'Quiet Hours',
  quietOn: 'Use Quiet Hours',
  quietRange: '{0} to {1}',
  quietHelp: 'During these hours, only reminders you set for an exact time and important security alerts come through. When they end, anything waiting is looked at again — never sent all at once.',
  snooze: 'Snooze',
  snoozeOptions: { '1h': '1 hour', '8h': '8 hours', '24h': '24 hours', custom: 'Custom' },
  lock: 'Lock Screen previews',
  lockHelp: 'This is a limit: QANDEEL may show less.',
  levels: { L0: 'Very private', L1: 'Show type', L2: 'Show context', L3: 'Show preview' },
  levelHelp: {
    L0: 'Only shows that there is a new notification.',
    L1: 'Only shows the kind of notification.',
    L2: 'Shows where and who did what, without the content.',
    L3: 'Shows part of the content on the Lock Screen.',
  },
  lockSubjects: { QANDEEL: 'QANDEEL', SHARED: 'Shared World', PUBLIC: 'Public World', DISCOVERY: 'Public World discoveries', INTRODUCTIONS: 'Introductions', REMINDERS: 'Reminders', ACCOUNT: 'Account', SECURITY: 'Security' },
  device: 'Device Notification Settings',
  deviceHelp: 'Sound, alert style and the Lock Screen are controlled by your device.',
  on: 'On',
  off: 'Off',
});

export function activityCopy(language: ChromeLanguage): ActivityCopy {
  return { ...(language === 'ar' ? AR_ACTIVITY : EN_ACTIVITY), gate: gate(language) };
}

export function notificationsCopy(language: ChromeLanguage): NotificationsCopy {
  return { ...(language === 'ar' ? AR_NOTIFICATIONS : EN_NOTIFICATIONS), gate: gate(language) };
}

/** `{0}`, `{1}` placeholders, as the approved rows carry them. */
export const fill = (template: string, ...values: readonly string[]): string =>
  values.reduce((text, value, index) => text.replace(`{${index}}`, value), template);
