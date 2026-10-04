/**
 * A3-01 — the Activity vocabulary the surfaces iterate, as the frozen contracts name it (I-08N-01 D30 categories, D14
 * disclosure levels, the D15 / P3 §10 Lock Screen subjects). The wire types are the runtime-entry layer's own.
 */
import type { ActivityCategory, DisclosureLevel, LockSubject } from '../runtime-entry';

export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = Object.freeze(['QANDEEL', 'SHARED', 'PUBLIC', 'INTRODUCTIONS', 'SYSTEM']);
export const DISCLOSURE_LEVELS: readonly DisclosureLevel[] = Object.freeze(['L0', 'L1', 'L2', 'L3']);
export const LOCK_SUBJECTS: readonly LockSubject[] = Object.freeze(['QANDEEL', 'SHARED', 'PUBLIC', 'DISCOVERY', 'INTRODUCTIONS', 'REMINDERS', 'ACCOUNT', 'SECURITY']);
