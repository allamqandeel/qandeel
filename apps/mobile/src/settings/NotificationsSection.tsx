/**
 * A3-01 — General Settings → «الإشعارات والنشاط» / Notifications & Activity (P3 §12–§13; I-08N-01 D33–D37), as a page of
 * the ONE General Settings destination: the same state-of-the-destination pattern its other pages use, no route, no
 * second Settings framework.
 *
 * Organised by Product meaning, not by channel, in P3's order: QANDEEL reaching out (Allow / Reduce / Off — interruption
 * only), Shared World, Public World, Introductions (ONLY once the capability is entered — today it cannot be, so it is not
 * drawn), Security & Account (critical security is a statement, never a switch), Quiet Hours (ON, 23:00 → 08:00,
 * editable), Snooze (1 h / 8 h / 24 h / Custom), Lock Screen previews (one ceiling per subject, in the approved words),
 * and the separate hand-off to the device's own notification settings, which QANDEEL does not fake owning.
 *
 * A3-02 adds the device's OS permission to that last section: when it is not granted the page says so once, plainly
 * (`p3.osOff`), and Activity keeps working; before the OS has ever asked, the education's own allow act (A3-02 Product
 * Copy Gate, `push/copy.ts`) opens QANDEEL's education, which hands over to the real OS prompt; the Device Notification
 * Settings row hands off to the app's own notification settings in the OS. Choosing «سماح» / Allow for Proactive
 * QANDEEL is one of P3 §11's legitimate moments for the education (once; never again after the reader declined it).
 *
 * No meter, no remaining count, no per-channel list, no off switch for critical security, nothing implying that
 * QANDEEL's understanding is turned off.
 *
 * S4-04 — under the global Shared World alerts control, one row per Shared World the reader is CURRENTLY in (D34; P3
 * §12.2), read from the Shared domain's own safe boundary when the page is shown: the World's own label and its state
 * («مفعّل» / On, or «مكتوم» / Muted, p3.mutedWorld). Each row mutes or unmutes exactly that World; muting one World
 * mutes no other, and changes notifications and attention only — never the World, its conversation or its members. No
 * ended, former or hidden World is drawn, and no count.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Linking, ScrollView, Text, View } from 'react-native';

import { notificationsCopy, fill, type NotificationsCopy } from '../activity/copy';
import type { ActivityPreferencesController } from '../activity/preferences-controller';
import { weekTime } from '../activity/time';
import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { DISCLOSURE_LEVELS, LOCK_SUBJECTS } from '../activity/vocabulary';
import type { ActivityPreferences, DisclosureLevel, LockSubject, ProactiveChoice } from '../runtime-entry';
import { pushCopy, type PushController, type PushState } from '../push';
import { labelOfWorld, sharedCopy, type SharedAlertsController, type SharedAlertsState } from '../shared-world';

const ROW_START = 24;
const ROW_END = 20;
const TRACK_W = 40;
const TRACK_H = 24;
const KNOB = 18;
const SNOOZE_PRESETS = [['1h', 60], ['8h', 480], ['24h', 1440]] as const;
const CUSTOM_MIN_HOURS = 1;
const CUSTOM_MAX_HOURS = 7 * 24;
/** Quiet Hours are chosen on a 30-minute grid (implementation choice; P3 freezes only the 23:00 → 08:00 default). */
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

function Heading({ text, palette, language }: { readonly text: string; readonly palette: ConversationPalette; readonly language: ChromeLanguage }) {
  return (
    <Text accessibilityRole="header" accessibilityLanguage={language} style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingTop: 22, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END }}>
      {text}
    </Text>
  );
}

function Help({ text, palette, writing }: { readonly text: string; readonly palette: ConversationPalette; readonly writing: 'rtl' | 'ltr' }) {
  return <Text style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingBottom: 8, writingDirection: writing }}>{text}</Text>;
}

/** A switch: position AND fill, never colour alone; its state is the control's own accessibility state. */
function SwitchRow({ label, on, onToggle, busy, palette, language, testID, words }: {
  readonly label: string; readonly on: boolean; readonly onToggle: () => void; readonly busy: boolean;
  readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly testID: string; readonly words: NotificationsCopy;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, busy, disabled: busy }}
      onPress={onToggle}
      testID={testID}
      style={{ minHeight: 52, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
        <Text style={{ ...typeStyle('body'), color: palette.primary, flex: 1, writingDirection: writing }}>{label}</Text>
        <Text style={{ ...typeStyle('metadata'), color: palette.secondary }}>{on ? words.on : words.off}</Text>
        <View testID={`${testID}-track`} style={{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: palette.markerThickness, borderColor: on ? palette.selectedInk : palette.restInk, backgroundColor: on ? palette.selectedInk : 'transparent', justifyContent: 'center', alignItems: on ? 'flex-end' : 'flex-start', paddingHorizontal: 1 }}>
          <View style={{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: on ? palette.world : palette.restInk }} />
        </View>
      </View>
    </Control>
  );
}

function Choice({ label, help, selected, onChoose, palette, language, testID }: {
  readonly label: string; readonly help?: string | null; readonly selected: boolean; readonly onChoose: () => void;
  readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly testID: string;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityRole="radio"
      accessibilityLabel={help ? `${label}${language === 'ar' ? '، ' : ', '}${help}` : label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onChoose}
      testID={testID}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
        {/* E1R: a ring, holding a filled dot when selected — a shape. */}
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: palette.markerThickness, borderColor: selected ? palette.selectedInk : palette.restInk, alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <View testID={`${testID}-selected`} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.selectedMarker }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{label}</Text>
          {help ? <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{help}</Text> : null}
        </View>
      </View>
    </Control>
  );
}

function ValueRow({ label, value, onPress, palette, language, testID, expanded }: {
  readonly label: string; readonly value: string; readonly onPress: () => void; readonly palette: ConversationPalette;
  readonly language: ChromeLanguage; readonly testID: string; readonly expanded: boolean;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <Control palette={palette} language={language} accessibilityLabel={`${label}${language === 'ar' ? '، ' : ', '}${value}`} accessibilityState={{ expanded }} onPress={onPress} testID={testID}
      style={{ minHeight: 52, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
        <Text style={{ ...typeStyle('body'), color: palette.primary, flex: 1, writingDirection: writing }}>{label}</Text>
        <Text style={{ ...typeStyle('body'), color: palette.secondary }}>{value}</Text>
      </View>
    </Control>
  );
}

export interface NotificationsSettingsProps {
  readonly controller: ActivityPreferencesController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /** A3-02 — the device's OS permission and the education; absent where no push boundary exists. */
  readonly push?: PushController;
  /** S4-04 — the reader's current Shared Worlds, each with its own mute; absent where no Shared boundary exists. */
  readonly sharedWorlds?: SharedAlertsController;
}

const NO_WORLDS = { subscribe: () => () => undefined, getState: (): SharedAlertsState | null => null, start: () => undefined };

/** S4-04 — one row per CURRENT Shared World: its own label, and whether its alerts are on or muted (D34). */
function SharedWorldRows({ controller, palette, language, words }: {
  readonly controller?: SharedAlertsController; readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly words: NotificationsCopy;
}) {
  const source = controller ?? NO_WORLDS;
  const state = useSyncExternalStore(source.subscribe, source.getState);
  useEffect(() => {
    source.start();
  }, [source]);
  if (state === null || state.status !== 'READY' || state.worlds.length === 0) return null;
  const shared = sharedCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View testID="qandeel-notifications-shared-worlds">
      {state.failed ? (
        <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {words.gate.saveFailed}
        </Text>
      ) : null}
      {state.worlds.map((world) => {
        const on = !world.muted;
        const label = labelOfWorld(shared, world);
        const busy = state.busy !== null;
        const testID = `qandeel-notifications-shared-world-${world.worldId}`;
        return (
          <Control
            key={world.worldId}
            palette={palette}
            language={language}
            accessibilityRole="togglebutton"
            accessibilityLabel={on ? label : `${label}${language === 'ar' ? '، ' : ', '}${words.mutedWorld}`}
            accessibilityState={{ checked: on, busy: state.busy === world.worldId, disabled: busy }}
            onPress={() => void controller?.setMuted(world.worldId, on)}
            testID={testID}
            style={{ minHeight: 52, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
              <Text style={{ ...typeStyle('body'), color: palette.primary, flex: 1, writingDirection: writing }}>{label}</Text>
              <Text testID={`${testID}-state`} style={{ ...typeStyle('metadata'), color: palette.secondary }}>{on ? words.on : words.mutedWorld}</Text>
              <View testID={`${testID}-track`} style={{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: palette.markerThickness, borderColor: on ? palette.selectedInk : palette.restInk, backgroundColor: on ? palette.selectedInk : 'transparent', justifyContent: 'center', alignItems: on ? 'flex-end' : 'flex-start', paddingHorizontal: 1 }}>
                <View style={{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: on ? palette.world : palette.restInk }} />
              </View>
            </View>
          </Control>
        );
      })}
    </View>
  );
}

const NO_PUSH = { subscribe: () => () => undefined, getState: (): PushState | null => null };

type Open = { readonly kind: 'QUIET'; readonly edge: 'start' | 'end' } | { readonly kind: 'LOCK'; readonly subject: LockSubject } | { readonly kind: 'SNOOZE_CUSTOM' } | null;

export function NotificationsSettings({ controller, language, palette, push, sharedWorlds }: NotificationsSettingsProps) {
  const words = notificationsCopy(language);
  const pushWords = pushCopy(language);
  const device: PushState | null = useSyncExternalStore(push?.subscribe ?? NO_PUSH.subscribe, push?.getState ?? NO_PUSH.getState);
  const saveFailed = words.gate.saveFailed;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [open, setOpen] = useState<Open>(null);
  const [customHours, setCustomHours] = useState(2);
  // The custom Snooze picker measures from when the reader opened it.
  const [customBase, setCustomBase] = useState(0);
  useEffect(() => {
    controller.start();
  }, [controller]);
  useEffect(() => {
    // Said once per failure: keyed on the failure and the one stable sentence, not on the (rebuilt) copy object.
    if (state.failed) AccessibilityInfo.announceForAccessibility(saveFailed);
  }, [state.failed, saveFailed]);

  if (state.status !== 'READY' || state.preferences === null) {
    return (
      <View testID="qandeel-notifications-state" accessibilityLiveRegion="polite" style={{ padding: ROW_START }}>
        <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>
          {state.status === 'UNAVAILABLE' ? words.gate.settingsUnavailable : words.gate.loading}
        </Text>
      </View>
    );
  }
  const p: ActivityPreferences = state.preferences;
  const busy = state.saving;
  /** One change: the whole preference set the reader now sees; the server's answer is what is shown after. */
  const save = (apply: Parameters<ActivityPreferencesController['change']>[0]) => {
    void controller.change(apply).then(() => setOpen(null));
  };
  const choose = (proactive: ProactiveChoice) => {
    save((c) => ({ ...c, proactive }));
    // P3 §11: choosing Allow is a legitimate moment for the education — only if the OS has not been asked yet.
    if (proactive === 'ALLOW') push?.offer('PROACTIVE_ALLOW');
  };
  const lockLevel = (subject: LockSubject, level: DisclosureLevel) => save((c) => ({ ...c, lockScreen: { ...c.lockScreen, [subject]: level } }));
  const setQuiet = (edge: 'start' | 'end', time: string) => {
    const other = edge === 'start' ? p.quietHours.end : p.quietHours.start;
    if (time === other) return; // a zero-length window is not a window
    save((c) => ({ ...c, quietHours: { ...c.quietHours, [edge]: time } }));
  };
  const snoozed = p.snoozeUntil !== null;
  const subjects = LOCK_SUBJECTS.filter((subject) => subject !== 'INTRODUCTIONS' || p.introductions.available);

  return (
    <View testID="qandeel-notifications" accessibilityLanguage={language}>
      {state.failed ? (
        <Text testID="qandeel-notifications-failed" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, padding: ROW_START, paddingBottom: 0, writingDirection: writing }}>
          {words.gate.saveFailed}
        </Text>
      ) : null}

      <Heading text={words.proactive} palette={palette} language={language} />
      <Help text={words.proactiveHelp} palette={palette} writing={writing} />
      <View accessibilityRole="radiogroup" accessibilityLabel={words.proactive} accessibilityLanguage={language}>
        {(['ALLOW', 'REDUCE', 'OFF'] as const).map((option) => (
          <Choice key={option} label={words.proactiveOptions[option]} help={p.proactive === option ? words.proactiveOptionHelp[option] : null}
            selected={p.proactive === option} onChoose={() => choose(option)} palette={palette} language={language} testID={`qandeel-proactive-${option.toLowerCase()}`} />
        ))}
      </View>

      <Heading text={words.shared} palette={palette} language={language} />
      <SwitchRow label={words.sharedAlerts} on={p.shared.alerts} busy={busy} words={words} palette={palette} language={language} testID="qandeel-notifications-shared"
        onToggle={() => save((c) => ({ ...c, shared: { alerts: !c.shared.alerts } }))} />
      <SharedWorldRows controller={sharedWorlds} palette={palette} language={language} words={words} />

      <Heading text={words.public} palette={palette} language={language} />
      <SwitchRow label={words.publicInteractions} on={p.public.interactions} busy={busy} words={words} palette={palette} language={language} testID="qandeel-notifications-public-interactions"
        onToggle={() => save((c) => ({ ...c, public: { ...c.public, interactions: !c.public.interactions } }))} />
      <SwitchRow label={words.publicDiscovery} on={p.public.discovery} busy={busy} words={words} palette={palette} language={language} testID="qandeel-notifications-public-discovery"
        onToggle={() => save((c) => ({ ...c, public: { ...c.public, discovery: !c.public.discovery } }))} />
      <Help text={words.publicDiscoveryHelp} palette={palette} writing={writing} />

      {p.introductions.available ? (
        <View testID="qandeel-notifications-introductions">
          <Heading text={words.introductions} palette={palette} language={language} />
          <SwitchRow label={words.introductionsAlerts} on={p.introductions.alerts} busy={busy} words={words} palette={palette} language={language} testID="qandeel-notifications-introductions-alerts"
            onToggle={() => save((c) => ({ ...c, introductions: { alerts: !c.introductions.alerts } }))} />
          <Help text={words.introductionsHelp} palette={palette} writing={writing} />
        </View>
      ) : null}

      <Heading text={words.system} palette={palette} language={language} />
      {/* D36: critical security has no off switch — it is said, in words, never coloured. */}
      <Text testID="qandeel-notifications-security-always" style={{ ...typeStyle('body'), color: palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, writingDirection: writing }}>
        {words.securityAlways}
      </Text>
      <SwitchRow label={words.accountUpdates} on={p.account.updates} busy={busy} words={words} palette={palette} language={language} testID="qandeel-notifications-account"
        onToggle={() => save((c) => ({ ...c, account: { updates: !c.account.updates } }))} />

      <Heading text={words.quiet} palette={palette} language={language} />
      <SwitchRow label={words.quietOn} on={p.quietHours.enabled} busy={busy} words={words} palette={palette} language={language} testID="qandeel-notifications-quiet"
        onToggle={() => save((c) => ({ ...c, quietHours: { ...c.quietHours, enabled: !c.quietHours.enabled } }))} />
      <Text testID="qandeel-notifications-quiet-range" style={{ ...typeStyle('body'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6, writingDirection: writing }}>
        {fill(words.quietRange, p.quietHours.start, p.quietHours.end)}
      </Text>
      {(['start', 'end'] as const).map((edge) => {
        const expanded = open?.kind === 'QUIET' && open.edge === edge;
        const label = edge === 'start' ? words.gate.quietStart : words.gate.quietEnd;
        return (
          <View key={edge}>
            <ValueRow label={label} value={p.quietHours[edge]} expanded={expanded} onPress={() => setOpen(expanded ? null : { kind: 'QUIET', edge })} palette={palette} language={language} testID={`qandeel-notifications-quiet-${edge}`} />
            {expanded ? (
              <ScrollView horizontal accessibilityRole="radiogroup" accessibilityLabel={label} testID={`qandeel-notifications-quiet-${edge}-times`} contentContainerStyle={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
                {TIMES.map((time) => (
                  <Control key={time} palette={palette} language={language} accessibilityRole="radio" accessibilityLabel={time}
                    accessibilityState={{ checked: p.quietHours[edge] === time, selected: p.quietHours[edge] === time }}
                    onPress={() => setQuiet(edge, time)} testID={`qandeel-notifications-quiet-${edge}-${time}`} style={{ minWidth: MIN_TARGET + 12, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ ...typeStyle('action'), color: p.quietHours[edge] === time ? palette.selectedInk : palette.restInk, fontWeight: p.quietHours[edge] === time ? '600' : undefined }}>{time}</Text>
                  </Control>
                ))}
              </ScrollView>
            ) : null}
          </View>
        );
      })}
      <Help text={words.quietHelp} palette={palette} writing={writing} />

      <Heading text={words.snooze} palette={palette} language={language} />
      {snoozed && p.snoozeUntil !== null ? (
        <View testID="qandeel-notifications-snoozed">
          <Text style={{ ...typeStyle('body'), color: palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, writingDirection: writing }}>
            {fill(words.gate.snoozeActive, weekTime(p.snoozeUntil, language))}
          </Text>
          <Control palette={palette} language={language} accessibilityLabel={words.gate.snoozeEnd} accessibilityState={{ busy, disabled: busy }} onPress={() => void controller.snooze(null)} testID="qandeel-notifications-snooze-end"
            style={{ minHeight: MIN_TARGET, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{words.gate.snoozeEnd}</Text>
          </Control>
        </View>
      ) : (
        <View>
          {SNOOZE_PRESETS.map(([key, minutes]) => (
            <Control key={key} palette={palette} language={language} accessibilityLabel={`${words.snooze}${language === 'ar' ? '، ' : ', '}${words.snoozeOptions[key]}`}
              accessibilityState={{ busy, disabled: busy }} onPress={() => void controller.snooze(minutes)} testID={`qandeel-notifications-snooze-${key}`}
              style={{ minHeight: MIN_TARGET, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}>
              <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{words.snoozeOptions[key]}</Text>
            </Control>
          ))}
          <ValueRow label={words.snoozeOptions.custom} value="" expanded={open?.kind === 'SNOOZE_CUSTOM'} onPress={() => {
              setCustomBase(Date.now());
              setOpen(open?.kind === 'SNOOZE_CUSTOM' ? null : { kind: 'SNOOZE_CUSTOM' });
            }}
            palette={palette} language={language} testID="qandeel-notifications-snooze-custom" />
          {open?.kind === 'SNOOZE_CUSTOM' ? (
            <View testID="qandeel-notifications-snooze-custom-picker" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, rowGap: 4 }}>
              <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>
                {fill(words.gate.snoozeUntil, weekTime(customBase + customHours * 3_600_000, language))}
              </Text>
              <View style={{ flexDirection: 'row', columnGap: 8 }}>
                <Control palette={palette} language={language} accessibilityLabel={words.gate.snoozeShorter} accessibilityState={{ disabled: customHours <= CUSTOM_MIN_HOURS }}
                  onPress={() => setCustomHours((h) => Math.max(CUSTOM_MIN_HOURS, h - 1))} testID="qandeel-notifications-snooze-shorter" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                  <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{words.gate.snoozeShorter}</Text>
                </Control>
                <Control palette={palette} language={language} accessibilityLabel={words.gate.snoozeLonger} accessibilityState={{ disabled: customHours >= CUSTOM_MAX_HOURS }}
                  onPress={() => setCustomHours((h) => Math.min(CUSTOM_MAX_HOURS, h + 1))} testID="qandeel-notifications-snooze-longer" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                  <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{words.gate.snoozeLonger}</Text>
                </Control>
              </View>
              <Control palette={palette} language={language} accessibilityLabel={words.snooze} accessibilityState={{ busy, disabled: busy }}
                onPress={() => void controller.snooze(customHours * 60).then(() => setOpen(null))} testID="qandeel-notifications-snooze-custom-confirm"
                style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                <Text style={{ ...typeStyle('action'), color: palette.primary }}>{words.snooze}</Text>
              </Control>
            </View>
          ) : null}
        </View>
      )}

      <Heading text={words.lock} palette={palette} language={language} />
      <Help text={words.lockHelp} palette={palette} writing={writing} />
      {subjects.map((subject) => {
        const expanded = open?.kind === 'LOCK' && open.subject === subject;
        return (
          <View key={subject}>
            <ValueRow label={words.lockSubjects[subject]} value={words.levels[p.lockScreen[subject]]} expanded={expanded}
              onPress={() => setOpen(expanded ? null : { kind: 'LOCK', subject })} palette={palette} language={language} testID={`qandeel-lock-${subject.toLowerCase()}`} />
            {expanded ? (
              <View accessibilityRole="radiogroup" accessibilityLabel={words.lockSubjects[subject]} testID={`qandeel-lock-${subject.toLowerCase()}-levels`}>
                {DISCLOSURE_LEVELS.map((level) => (
                  <Choice key={level} label={words.levels[level]} help={words.levelHelp[level]} selected={p.lockScreen[subject] === level}
                    onChoose={() => lockLevel(subject, level)} palette={palette} language={language} testID={`qandeel-lock-${subject.toLowerCase()}-${level}`} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {/* A3-02 — the OS permission, said once and plainly when it is not granted; Activity keeps working (P3 §12.2). */}
      {device !== null && (device.permission === 'DENIED' || device.permission === 'NOT_REQUESTED') ? (
        <Text testID="qandeel-notifications-os-off" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingTop: 16, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {pushWords.osOff}
        </Text>
      ) : null}
      {push !== undefined && device !== null && device.permission === 'NOT_REQUESTED' && device.canAskAgain ? (
        <Control palette={palette} language={language} accessibilityLabel={pushWords.eduAllow} onPress={() => push.offer('DEVICE_SETTINGS')} testID="qandeel-notifications-allow"
          style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('body'), color: palette.selectedInk, writingDirection: writing }}>{pushWords.eduAllow}</Text>
        </Control>
      ) : null}
      {device?.notNowNote ? (
        <Text testID="qandeel-push-not-now-note" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {pushWords.notNowNote}
        </Text>
      ) : null}
      {/* The device's own notification settings: a hand-off, never an imitation of an OS page (P3 §12.2). */}
      <Control palette={palette} language={language} accessibilityLabel={words.device} onPress={() => void (push !== undefined ? push.openDeviceSettings() : Linking.openSettings())} testID="qandeel-notifications-device"
        style={{ marginTop: 16, minHeight: 52, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, justifyContent: 'center' }}>
        <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{words.device}</Text>
        <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{words.deviceHelp}</Text>
      </Control>
    </View>
  );
}
