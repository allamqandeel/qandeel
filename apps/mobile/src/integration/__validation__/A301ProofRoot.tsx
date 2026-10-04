/**
 * A3-01 — the integrated in-app proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, over a runtime built by the production
 * `createIntegrationRuntime`, given the VPORT-01 proof world's in-memory identity and scripted network (reused, not
 * copied). Every module the reader sees — the Conversation with the Activity entry, Activity, the Attention Strip, the
 * Analysis, General Settings → Notifications & Activity — is the shipped one, over the real Activity controllers.
 *
 * No source producer exists on `main` (A3-01 record §3.2). This root therefore carries the ONE validation-only producer
 * seam the Product Owner authorised: an in-memory stand-in for the Activity API that answers `/activity/*` as the server
 * does for the synthetic events a proof link announces. It is unreachable from any Product build: it exists only in this
 * entry, which a build reaches only through `select-a301-proof-entry.mjs --apply` with `A301_INAPP_PROOF=1`. Every event
 * sentence below is SYNTHETIC test text (P3 `FIXTURE_ONLY` class), never Product copy.
 *
 *   qandeel://a301-proof/arrive/<system|reminder|shared|public>   a new event: in Activity, and interruption-eligible
 *   qandeel://a301-proof/callsafe/<on|off>                         the call-safe strip SPECIMEN (no call exists)
 *
 * The device's own presentation law decides everything else: the strip only outside the origin and outside the
 * Analysis, at most one, re-evaluated when the reader leaves the Analysis.
 */
import { useEffect, useState } from 'react';
import { I18nManager, Linking, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CallSafeStrip } from '../../activity';
import { usePalette } from '../../conversation';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal, type ActivityItem, type ActivityPreferences, type RuntimeHttpFetch } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createVport01ProofWorld } from './vport01-proof-world';

const LINK = /^qandeel:\/\/a301-proof\/(arrive|callsafe)\/([a-z]+)$/u;
const id = (n: number) => `a3010000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** SYNTHETIC event sentences — validation fixtures, never Product copy. */
const FIXTURE: Readonly<Record<string, { readonly ar: string; readonly en: string }>> = {
  system: { ar: 'نص اختبار: تحديث في الحساب', en: 'Fixture: an account update' },
  reminder: { ar: 'نص اختبار: تذكير طلبته', en: 'Fixture: a reminder you asked for' },
  shared: { ar: 'نص اختبار: ردّ في العالم المشترك', en: 'Fixture: a reply in a Shared World' },
  public: { ar: 'نص اختبار: ردّ على منشورك', en: 'Fixture: a reply to your post' },
  stale: { ar: 'نص اختبار: شيء لم يعد متاحًا', en: 'Fixture: something no longer there' },
  muted: { ar: 'نص اختبار: رسالة في عالم مكتوم', en: 'Fixture: a message in a muted World' },
  intro: { ar: 'نص اختبار: تحديث في التعارف', en: 'Fixture: an Introductions update' },
};
const CONTEXT = { ar: 'عالم اختبار', en: 'Fixture World' };

type Kind = 'system' | 'reminder' | 'shared' | 'public';
const SPEC: Readonly<Record<Kind, { category: ActivityItem['category']; contextKind: string; cls: 1 | 2 | 3 | 4; entry: ActivityItem['entry']; speaker: 'QANDEEL' | 'PRODUCT'; context: boolean }>> = {
  system: { category: 'SYSTEM', contextKind: 'ACCOUNT', cls: 3, entry: 'AVAILABLE', speaker: 'PRODUCT', context: false },
  reminder: { category: 'QANDEEL', contextKind: 'PERSONAL', cls: 2, entry: 'AVAILABLE', speaker: 'QANDEEL', context: false },
  shared: { category: 'SHARED', contextKind: 'SHARED_WORLD', cls: 2, entry: 'UNAVAILABLE', speaker: 'PRODUCT', context: true },
  public: { category: 'PUBLIC', contextKind: 'PUBLIC_WORLD', cls: 3, entry: 'UNAVAILABLE', speaker: 'PRODUCT', context: false },
};

const make = (n: number, kind: keyof typeof FIXTURE, category: ActivityItem['category'], over: Partial<ActivityItem> = {}): ActivityItem => ({
  id: id(n), category, speaker: 'PRODUCT', at: ago(n), context: null, body: FIXTURE[kind], secondary: null, attention: 'NEW',
  actionable: false, waiting: false, stale: false, muted: false, mark: true, entry: 'AVAILABLE', ...over,
});

/** The validation-only stand-in for the Activity API: what the server would answer for these synthetic events. */
function createValidationActivity() {
  let next = 100;
  const items: ActivityItem[] = [
    make(1, 'stale', 'SHARED', { context: CONTEXT, stale: true, mark: false, attention: 'SEEN', entry: 'UNAVAILABLE', at: ago(60 * 26) }),
    make(2, 'muted', 'SHARED', { context: CONTEXT, muted: true, mark: false, entry: 'UNAVAILABLE', at: ago(60 * 3) }),
  ];
  const interruptions: { item: ActivityItem; interruptionClass: number; contextKind: string; callSafe: boolean }[] = [];
  const settled = new Set<string>();
  let preferences: ActivityPreferences = {
    proactive: 'ALLOW', shared: { alerts: true }, public: { interactions: true, discovery: false }, introductions: { available: false, alerts: true },
    account: { updates: true }, quietHours: { enabled: true, start: '23:00', end: '08:00' }, snoozeUntil: null,
    lockScreen: { QANDEEL: 'L1', SHARED: 'L2', PUBLIC: 'L2', DISCOVERY: 'L1', INTRODUCTIONS: 'L0', REMINDERS: 'L2', ACCOUNT: 'L2', SECURITY: 'L2' },
  };
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  return {
    arrive(kind: Kind) {
      const spec = SPEC[kind];
      const item = make(next++, kind, spec.category, { speaker: spec.speaker, entry: spec.entry, context: spec.context ? CONTEXT : null, at: new Date().toISOString() });
      items.unshift(item);
      interruptions.unshift({ item, interruptionClass: spec.cls, contextKind: spec.contextKind, callSafe: false });
    },
    async fetch(path: string, method: string, body: unknown): Promise<ReturnType<typeof json>> {
      if (path.startsWith('/activity/attention')) {
        const marked = items.filter((item) => item.mark);
        return json(200, {
          present: marked.length > 0,
          categories: {
            QANDEEL: { present: marked.some((i) => i.category === 'QANDEEL') },
            SHARED: { present: marked.some((i) => i.category === 'SHARED'), count: marked.filter((i) => i.category === 'SHARED').length || null },
            PUBLIC: { present: marked.some((i) => i.category === 'PUBLIC') },
            INTRODUCTIONS: { present: false },
            SYSTEM: { present: marked.some((i) => i.category === 'SYSTEM'), count: null },
          },
          interruptions: interruptions.filter((c) => !settled.has(c.item.id) && c.item.attention === 'NEW'),
        });
      }
      if (path.startsWith('/activity/items/seen')) {
        for (const itemId of (body as { itemIds: string[] }).itemIds) {
          const item = items.find((i) => i.id === itemId);
          if (item && item.attention === 'NEW') Object.assign(item, { attention: 'SEEN', mark: false });
        }
        return json(204, {});
      }
      const open = /^\/activity\/items\/([0-9a-f-]+)\/open$/u.exec(path);
      if (open) {
        const item = items.find((i) => i.id === open[1]);
        if (!item) return json(404, {});
        Object.assign(item, { attention: 'OPENED', mark: false });
        if (item.stale) return json(200, { outcome: 'STALE', fallback: null });
        if (item.entry === 'UNAVAILABLE') return json(200, { outcome: 'UNAVAILABLE', fallback: null });
        return json(200, item.category === 'QANDEEL' ? { outcome: 'ENTER', destination: { kind: 'PERSONAL_CONVERSATION' } }
          : { outcome: 'ENTER', destination: { kind: 'GENERAL_SETTINGS', section: 'SECURITY' } });
      }
      if (path.startsWith('/activity/items')) {
        const category = new URL(`https://proof${path}`).searchParams.get('category');
        // The server's order (`last_occurred_at DESC, id DESC`): newest first, whatever order the events were seeded in.
        const page = items.filter((i) => category === null || i.category === category)
          .sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
        return json(200, { items: page, before: null });
      }
      if (path.startsWith('/activity/strip')) {
        const { presentedItemId, settledItemIds } = body as { presentedItemId: string | null; settledItemIds: string[] };
        for (const itemId of [presentedItemId, ...settledItemIds]) if (itemId !== null) settled.add(itemId);
        return json(204, {});
      }
      if (path.startsWith('/activity/preferences')) {
        if (method === 'PUT') preferences = { ...preferences, ...(body as object), introductions: preferences.introductions, snoozeUntil: preferences.snoozeUntil };
        return json(200, preferences);
      }
      if (path.startsWith('/activity/snooze')) {
        const { minutes } = body as { minutes: number | null };
        preferences = { ...preferences, snoozeUntil: minutes === null ? null : new Date(Date.now() + minutes * 60_000).toISOString() };
        return json(200, preferences);
      }
      return json(404, {});
    },
  };
}

function buildProofRuntime(activity: ReturnType<typeof createValidationActivity>): IntegrationRuntime {
  const world = createVport01ProofWorld(deviceProductLanguage());
  const fetch: RuntimeHttpFetch = async (input, init) => {
    const path = input.replace(/^https?:\/\/[^/]+/u, '');
    if (path.startsWith('/activity/')) {
      return activity.fetch(path, init?.method ?? 'GET', init?.body === undefined ? undefined : JSON.parse(init.body));
    }
    return world.fetch(input, init);
  };
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: fetch,
    // Foreground: attention reads only in the foreground. The VPORT-01 world serves the live driver's routes too.
    foreground: createManualForegroundSignal('ACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the A3-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

function CallSafeSpecimen() {
  const palette = usePalette();
  const language = deviceProductLanguage();
  const item: ActivityItem = { ...make(900, 'system', 'SYSTEM'), body: { ar: 'نص اختبار: تنبيه أمان مهم', en: 'Fixture: an important security alert' } };
  return (
    <View style={[styles.specimen, { backgroundColor: palette.world }]} testID="a301-call-safe-specimen">
      <Text style={[styles.caption, { color: palette.tertiary }]}>VALIDATION SPECIMEN — the call-safe strip. No call runtime exists; nothing here is a call.</Text>
      <Text style={[styles.caption, { color: palette.tertiary }]}>{I18nManager.isRTL ? 'RTL' : 'LTR'}</Text>
      <CallSafeStrip item={item} language={language} onDismiss={() => undefined} />
    </View>
  );
}

export function A301ProofRoot() {
  const [activity] = useState(createValidationActivity);
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime(activity));
  const [callSafe, setCallSafe] = useState(false);
  useEffect(() => {
    const built = runtime;
    void built.start();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const match = LINK.exec(url);
      if (match === null) return;
      const [, verb, argument] = match;
      if (verb === 'callsafe') {
        setCallSafe(argument === 'on');
        return;
      }
      if (argument === 'system' || argument === 'reminder' || argument === 'shared' || argument === 'public') {
        activity.arrive(argument);
        const phase = built.getPhase();
        // The proof's stand-in for the 30-s foreground read: the same production refresh.
        if (phase.kind === 'READY') phase.runtime.attention.refresh();
      }
    });
    return () => {
      subscription.remove();
      built.dispose();
    };
  }, [activity, runtime]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        <RuntimePhaseSurface runtime={runtime} />
        {callSafe ? <CallSafeSpecimen /> : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  specimen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 16, rowGap: 12 },
  caption: { fontSize: 12 },
});
