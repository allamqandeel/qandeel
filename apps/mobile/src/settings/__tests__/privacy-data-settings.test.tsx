/**
 * W3-MEGA-S — General Settings → «قنديل والمحادثة» / QANDEEL & Conversation (the Language row) and «الخصوصية والبيانات» /
 * Privacy & Data (Export my data, Delete account), in Arabic and English: the stable React UI proof states (no frame
 * timing, no raster).
 *
 * The appearance is the REAL authority and the Privacy & Data controller is REAL, over a scripted transport that answers
 * exactly what migration 0130 and the API would. The two platform edges — the system's language setting and the
 * folder picker the package is saved through — are replaced at their own module boundary.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, Linking, Platform, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { PrivacyStateView } from '../../runtime-entry';
import { SettingsSurface, createPrivacyDataController, settingsCopy, type PrivacyDataTransport } from '..';
import { saveExportDocument } from '../export-file';
import { openLanguageSettings } from '../language-settings';
import { formatDay } from '../PrivacyDataSection';

jest.mock('../export-file', () => ({ saveExportDocument: jest.fn(async () => 'SAVED'), exportFileName: () => 'qandeel-data.json' }));
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const UNTIL = '2026-10-07T09:00:00.000Z';
const NONE: PrivacyStateView = { export: { status: 'NONE', availableUntil: null }, deletion: { status: 'NONE', finalAt: null } };

function privacyServer(initial: PrivacyStateView = NONE) {
  let current = initial;
  const queue: unknown[] = [];
  const next = async () => queue.shift() as never;
  const transport: PrivacyDataTransport = {
    readPrivacyState: jest.fn(async () => ({ kind: 'READ' as const, view: current })),
    requestDataExport: jest.fn(next),
    downloadDataExport: jest.fn(next),
    requestAccountDeletion: jest.fn(next),
    cancelAccountDeletion: jest.fn(next),
  };
  return { transport, answer: (...outcomes: unknown[]) => queue.push(...outcomes), commit: (view: PrivacyStateView) => { current = view; } };
}

async function settings(language: ChromeLanguage, initial?: PrivacyStateView) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const server = privacyServer(initial);
  const privacy = createPrivacyDataController({ transport: server.transport, isCurrent: () => true, setTimer: () => null, clearTimer: () => undefined, newCommandId: () => '6f1f3a52-9d4e-4c1b-8a7e-2b9c0d4e5f60' });
  const view = await render(
    <AppearanceProvider authority={authority}>
      <SettingsSurface language={language} insets={INSETS} onBack={jest.fn()} onSignOut={jest.fn(async () => undefined)} privacy={privacy} />
    </AppearanceProvider>,
  );
  await act(async () => {
    await flush();
  });
  return { view, server };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await flush();
  });
}

async function type(view: RenderResult, testID: string, text: string) {
  await fireEvent.changeText(view.getByTestId(testID), text);
}

const words = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => node.props.children as string);

afterEach(() => {
  jest.restoreAllMocks();
  (saveExportDocument as jest.Mock).mockClear();
});

describe.each(['ar', 'en'] as const)('%s — QANDEEL & Conversation and Privacy & Data', (language) => {
  const copy = settingsCopy(language);
  const p = copy.privacy;

  it('draws the two groups in their P1 §8.1 places — Language, then Appearance, then Privacy & Data, then Support — and nothing else', async () => {
    const { view } = await settings(language);
    expect(view.getAllByRole('header').map((node) => node.props.children)).toEqual([
      copy.title, copy.qandeelGroup, copy.appearanceGroup, copy.privacyGroup, copy.supportGroup,
    ]);
    expect(words(view)).toEqual([
      copy.title,
      copy.qandeelGroup, copy.language.term, language === 'ar' ? 'العربية' : `${LRI}English${PDI}`,
      copy.appearanceGroup, copy.appearance.DARK, copy.appearance.LIGHT, copy.appearance.SYSTEM,
      copy.privacyGroup, p.exportAction, p.deleteAction,
      copy.supportGroup, copy.signOut,
    ]);
    // P4-C4 §4, verbatim: the two group names are the approved ones.
    expect([copy.qandeelGroup, copy.privacyGroup]).toEqual(language === 'ar' ? ['قنديل والمحادثة', 'الخصوصية والبيانات'] : ['QANDEEL & Conversation', 'Privacy & Data']);
    // No in-app language switch and no in-app accessibility switch: one row that opens the system's setting.
    expect(view.queryAllByRole('switch')).toHaveLength(0);
    expect(view.getByTestId('qandeel-language-row').props.accessibilityLabel).toBe([copy.language.term, copy.language.names[language]].join(', '));
  });

  it('the Language row opens the SYSTEM setting and stores nothing', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
    openSettings.mockClear();
    sendIntent.mockClear();
    const { view } = await settings(language);
    await press(view, 'qandeel-language-row');
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(sendIntent).not.toHaveBeenCalled();
  });
  it('Export: the promise first, then the password; a wrong one is said; the package is then prepared on the server', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    const { view, server } = await settings(language);
    await press(view, 'qandeel-export-request');
    const form = 'qandeel-export-request-form';
    expect(view.getByTestId(`${form}-title`).props.children).toBe(p.exportAction);
    expect(view.getByTestId(`${form}-title`).props.accessibilityRole).toBe('header');
    expect(focus).toHaveBeenCalledWith(4242);
    expect(view.getByTestId(`${form}-password-instruction`).props.children).toBe(p.exportExplain);
    expect(view.getByTestId(`${form}-password`).props.secureTextEntry).toBe(true);
    expect(view.getByTestId(`${form}-message`).props.accessibilityLiveRegion).toBe('polite');

    await press(view, `${form}-confirm`);
    expect(server.transport.requestDataExport).not.toHaveBeenCalled();
    expect(announce).toHaveBeenLastCalledWith(p.enterPassword);

    await type(view, `${form}-password`, 'wrong');
    server.answer({ kind: 'PASSWORD_REJECTED' });
    await press(view, `${form}-confirm`);
    expect(announce).toHaveBeenLastCalledWith(p.passwordIncorrect);
    expect(view.getByTestId(form)).toBeTruthy();

    await type(view, `${form}-password`, 'secret');
    server.answer({ kind: 'ACCEPTED', view: { status: 'PREPARING', availableUntil: null } });
    await press(view, `${form}-confirm`);
    expect(server.transport.requestDataExport).toHaveBeenLastCalledWith('6f1f3a52-9d4e-4c1b-8a7e-2b9c0d4e5f60', 'secret');
    expect(view.queryByTestId(form)).toBeNull();
    expect(view.getByTestId('qandeel-export-status-status').props.children).toBe(p.exportPreparing);
    expect(view.getByTestId('qandeel-export-status').props.accessibilityLabel).toBe([p.exportAction, p.exportPreparing].join(', '));
    expect(announce).toHaveBeenLastCalledWith(p.exportPreparing);
  });

  it('Export: a lost answer is reconciled by reading — held means accepted, never a false failure', async () => {
    const { view, server } = await settings(language);
    await press(view, 'qandeel-export-request');
    await type(view, 'qandeel-export-request-form-password', 'secret');
    server.answer({ kind: 'NETWORK' });
    server.commit({ ...NONE, export: { status: 'PREPARING', availableUntil: null } });
    await press(view, 'qandeel-export-request-form-confirm');
    expect(view.queryByTestId('qandeel-export-request-form')).toBeNull();
    expect(view.getByTestId('qandeel-export-status-status').props.children).toBe(p.exportPreparing);
  });

  it('Export: READY says until when, and Download saves the server’s package through the system picker', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { view, server } = await settings(language, { ...NONE, export: { status: 'READY', availableUntil: UNTIL } });
    expect(view.getByTestId('qandeel-export-status-status').props.children).toBe(p.exportReady(formatDay(UNTIL, language)));
    const document = { format: 'qandeel.personal-data-export.v1', account: { name: 'Noor' } };
    server.answer({ kind: 'READY', availableUntil: UNTIL, document });
    await press(view, 'qandeel-export-download');
    expect(saveExportDocument).toHaveBeenCalledWith(document);
    expect(announce).toHaveBeenLastCalledWith(p.exportSaved);
    expect(view.getByTestId('qandeel-export-download-notice').props.accessibilityLiveRegion).toBe('polite');

    (saveExportDocument as jest.Mock).mockResolvedValueOnce('CANCELLED');
    server.answer({ kind: 'READY', availableUntil: UNTIL, document });
    announce.mockClear();
    await press(view, 'qandeel-export-download');
    expect(announce).not.toHaveBeenCalled();

    (saveExportDocument as jest.Mock).mockResolvedValueOnce('FAILED');
    server.answer({ kind: 'READY', availableUntil: UNTIL, document });
    await press(view, 'qandeel-export-download');
    expect(announce).toHaveBeenLastCalledWith(p.exportSaveFailed);
  });

  it('Export: an expired package is not downloadable, and a new copy can be asked for', async () => {
    const { view } = await settings(language, { ...NONE, export: { status: 'EXPIRED', availableUntil: null } });
    expect(view.queryByTestId('qandeel-export-download')).toBeNull();
    expect(view.getByTestId('qandeel-export-request-notice')).toBeTruthy();
    expect(words(view)).toContain(p.exportExpired);
  });

  it('Delete: the consequence is read before the password; then the date it becomes final, and Cancel', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { view, server } = await settings(language);
    await press(view, 'qandeel-deletion-request');
    const form = 'qandeel-deletion-request-form';
    expect(view.getByTestId(`${form}-title`).props.children).toBe(p.deleteAction);
    expect(view.getByTestId(`${form}-password-instruction`).props.children).toBe(p.deleteExplain);
    // Reading order: title → consequence → password → the one destructive act.
    const order = words(view);
    expect(order.indexOf(p.deleteExplain)).toBeLessThan(order.indexOf(p.password));
    expect(view.getByTestId(`${form}-confirm`).props.accessibilityLabel).toBe(p.deleteConfirm);

    await type(view, `${form}-password`, 'secret');
    server.answer({ kind: 'ACCEPTED', view: { status: 'SCHEDULED', finalAt: UNTIL } });
    await press(view, `${form}-confirm`);
    expect(server.transport.requestAccountDeletion).toHaveBeenLastCalledWith('6f1f3a52-9d4e-4c1b-8a7e-2b9c0d4e5f60', 'secret');
    const scheduled = p.deleteScheduled(formatDay(UNTIL, language));
    expect(view.getByTestId('qandeel-deletion-status-status').props.children).toBe(scheduled);
    expect(announce).toHaveBeenLastCalledWith(scheduled);
    expect(view.queryByTestId('qandeel-deletion-request')).toBeNull();
    // Never "deleted" before the final deletion: the scheduled line is a future.
    expect(words(view).some((w) => w === p.deleteFinalizing)).toBe(false);

    server.answer({ kind: 'CANCELLED' });
    await press(view, 'qandeel-deletion-cancel');
    expect(announce).toHaveBeenLastCalledWith(p.deleteCancelled);
    expect(view.getByTestId('qandeel-deletion-request')).toBeTruthy();
    expect(view.getByTestId('qandeel-deletion-request-notice')).toBeTruthy();
    expect(words(view)).toContain(p.deleteCancelled);
  });

  it('Delete: after the grace period it is being deleted and cannot be cancelled; BLOCKED can be cancelled', async () => {
    const finalizing = await settings(language, { ...NONE, deletion: { status: 'FINALIZING', finalAt: UNTIL } });
    expect(finalizing.view.getByTestId('qandeel-deletion-status-status').props.children).toBe(p.deleteFinalizing);
    expect(finalizing.view.queryByTestId('qandeel-deletion-cancel')).toBeNull();
    expect(finalizing.view.queryByTestId('qandeel-deletion-request')).toBeNull();
    await finalizing.view.unmount();

    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const scheduled = await settings(language, { ...NONE, deletion: { status: 'SCHEDULED', finalAt: UNTIL } });
    scheduled.server.answer({ kind: 'NOT_CANCELLABLE' });
    scheduled.server.commit({ ...NONE, deletion: { status: 'FINALIZING', finalAt: UNTIL } });
    await press(scheduled.view, 'qandeel-deletion-cancel');
    expect(announce).toHaveBeenLastCalledWith(p.deleteNotCancellable);
    expect(scheduled.view.getByTestId('qandeel-deletion-status-status').props.children).toBe(p.deleteFinalizing);
    await scheduled.view.unmount();

    const blocked = await settings(language, { ...NONE, deletion: { status: 'BLOCKED', finalAt: UNTIL } });
    expect(blocked.view.getByTestId('qandeel-deletion-status-status').props.children).toBe(p.deleteBlocked);
    expect(blocked.view.getByTestId('qandeel-deletion-cancel')).toBeTruthy();
  });

  it('scales with the platform text size: no fixed-height text row, no cap, no truncation', async () => {
    const { view } = await settings(language, { ...NONE, export: { status: 'READY', availableUntil: UNTIL }, deletion: { status: 'SCHEDULED', finalAt: UNTIL } });
    for (const node of view.getAllByText(/.+/u)) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
    }
    for (const id of ['qandeel-language-row', 'qandeel-export-status', 'qandeel-export-download', 'qandeel-deletion-status', 'qandeel-deletion-cancel']) {
      const frame = style(view.getByTestId(id));
      expect(frame.height).toBeUndefined();
      expect(frame.minHeight).toBe(44);
    }
  });
});

describe('the group waits for the server', () => {
  it('draws no Privacy & Data group until the state is read — never a placeholder', async () => {
    const authority = createAppearanceAuthority({
      store: createEphemeralAppearancePreferenceStore({}),
      system: { current: () => 'DARK', subscribe: () => () => undefined },
      native: { apply: () => undefined },
    });
    authority.bindAccount('reader');
    const privacy = createPrivacyDataController({
      transport: { ...privacyServer().transport, readPrivacyState: jest.fn(async () => ({ kind: 'UNAVAILABLE' as const })) },
      isCurrent: () => true,
      setTimer: () => null,
      clearTimer: () => undefined,
    });
    const view = await render(
      <AppearanceProvider authority={authority}>
        <SettingsSurface language="en" insets={INSETS} onBack={jest.fn()} onSignOut={jest.fn(async () => undefined)} privacy={privacy} />
      </AppearanceProvider>,
    );
    await act(async () => {
      await flush();
    });
    expect(view.queryByTestId('qandeel-settings-group-privacy')).toBeNull();
    expect(view.getByTestId('qandeel-settings-group-qandeel')).toBeTruthy();
  });
});

describe('the system language setting, per platform', () => {
  it('iOS opens the app’s own settings page; Android opens the device language; a refusal is false', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
    openSettings.mockClear();
    sendIntent.mockClear();
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(openLanguageSettings()).resolves.toBe(true);
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(sendIntent).not.toHaveBeenCalled();
    jest.replaceProperty(Platform, 'OS', 'android');
    await expect(openLanguageSettings()).resolves.toBe(true);
    expect(sendIntent).toHaveBeenCalledWith('android.settings.LOCALE_SETTINGS');
    expect(openSettings).toHaveBeenCalledTimes(1);
    sendIntent.mockRejectedValueOnce(new Error('no settings'));
    await expect(openLanguageSettings()).resolves.toBe(false);
  });
});