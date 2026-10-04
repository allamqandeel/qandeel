/**
 * A3-02 — the ONE place the words of the permission education, the device-permission state and the Android channel names
 * are written.
 *
 * Authority, per string (no proof copy is silently promoted):
 *   - CANON / APPROVED — the Android channel names are the Activity filter names (`p3.filters.*`, CANON / P4-C4 APPROVED,
 *     the same words the reader already sees in Activity) and the CANON product name for the neutral L0 channel;
 *     «إشعارات قنديل متوقفة …» / "Notifications for QANDEEL are off …" is `p3.osOff` (P4-C4 APPROVED), byte-exact from the
 *     pinned P4-C3 registry;
 *   - A3-02 PRODUCT COPY GATE — `PUSH_COPY_GATE` below: the permission-education sheet and its "Not now" note. Their
 *     registry status is `AUDIT_OWNED` (P4-C2 §5 handed the sheet to the End-to-End audit; E2E-E-10 is
 *     `PRODUCT OWNER DECISION REQUIRED`), and the backlog Exit Gate of QAN-BL-NOTIF-01 requires them approved BEFORE the
 *     OS prompt ships. The rows below are P3-A's own DIRECTION / PROOF wording, PROPOSED to the Product Owner unchanged
 *     except the P4-C2 §5 casing rule; the status says so until the Product Owner decides (record §24a).
 *
 * The OS permission prompt itself is the platform's and is never drawn or imitated here (P3 §11, P3-A C-PERM).
 */
import type { ChromeLanguage } from '../orientation-chrome';

export type PushCopyGateStatus =
  | 'PROPOSED — A3-02 PRODUCT COPY GATE — AWAITING THE PRODUCT OWNER'
  | 'APPROVED BY THE PRODUCT OWNER — A3-02 PRODUCT COPY GATE';

/** A3-02 Product Copy Gate (record §24a). */
export const PUSH_COPY_GATE = Object.freeze({
  status: 'PROPOSED — A3-02 PRODUCT COPY GATE — AWAITING THE PRODUCT OWNER' as PushCopyGateStatus,
  rows: Object.freeze({
    /** p3.eduTitle — the education sheet's heading (QANDEEL speaks in the first person, P3-A EDU). */
    eduTitle: { ar: 'خليني أوصلك لما يكون في حاجة تستاهل', en: "Let me reach you when it's worth it" },
    /** p3.eduBody — what notifications are for, and that they can be reduced or turned off. */
    eduBody: {
      ar: 'مش هبعتلك علشان أرجعك للتطبيق وخلاص. هستخدم الإشعارات لما يكون في سبب له قيمة ليك، وتقدر تقللها أو توقفها في أي وقت.',
      en: "I won't notify you just to pull you back into the app. I'll use notifications when there's a reason that matters to you, and you can reduce or turn them off anytime.",
    },
    /** p3.eduAllow — hands over to the platform's own prompt. Also the Device Notification Settings act before any ask. */
    eduAllow: { ar: 'السماح بالإشعارات', en: 'Allow notifications' },
    /** p3.eduNotNow — keeps everything in the app working; QANDEEL does not ask again by itself. */
    eduNotNow: { ar: 'مش دلوقتي', en: 'Not now' },
    /** p3.notNowNote — said once, after "Not now". */
    notNowNote: { ar: 'تمام. النشاط هيفضل يظهر هنا جوه التطبيق.', en: 'Okay. Activity will keep showing here in the app.' },
  }),
});

export interface PushCopy {
  readonly eduTitle: string;
  readonly eduBody: string;
  readonly eduAllow: string;
  readonly eduNotNow: string;
  readonly notNowNote: string;
  /** p3.osOff — the OS permission is not granted: said once, plainly; Activity keeps working (P3 §12.2). */
  readonly osOff: string;
  /** Android channel names, by channel id (the server names the id; the device names the channel). */
  readonly channels: Readonly<Record<'qandeel' | 'category-qandeel' | 'category-shared' | 'category-public' | 'category-introductions' | 'category-system', string>>;
}

const gate = (language: ChromeLanguage) => {
  const rows = PUSH_COPY_GATE.rows;
  return {
    eduTitle: rows.eduTitle[language], eduBody: rows.eduBody[language], eduAllow: rows.eduAllow[language],
    eduNotNow: rows.eduNotNow[language], notNowNote: rows.notNowNote[language],
  };
};

const AR: PushCopy = {
  ...gate('ar'),
  osOff: 'إشعارات قنديل متوقفة على هذا الجهاز، وسيظل النشاط يظهر داخل التطبيق.', // APPROVED — p3.osOff
  // CANON product name; the rest CANON / APPROVED p3.filters.*.
  channels: {
    qandeel: 'قنديل', 'category-qandeel': 'من قنديل', 'category-shared': 'العالم المشترك', 'category-public': 'العالم العام',
    'category-introductions': 'التعارف', 'category-system': 'النظام',
  },
};

const EN: PushCopy = {
  ...gate('en'),
  osOff: 'Notifications for QANDEEL are off on this device. Activity still appears here in the app.',
  channels: {
    qandeel: 'QANDEEL', 'category-qandeel': 'From QANDEEL', 'category-shared': 'Shared World', 'category-public': 'Public World',
    'category-introductions': 'Introductions', 'category-system': 'System',
  },
};

export function pushCopy(language: ChromeLanguage): PushCopy {
  return language === 'ar' ? AR : EN;
}
