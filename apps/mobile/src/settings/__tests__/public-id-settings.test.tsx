/**
 * W3-02 (E2E-D-09) — General Settings → Account & Identity → the Public ID and its ONE lifetime manual change,
 * in Arabic and English: the stable React UI proof states (no frame timing, no raster).
 *
 * The appearance is the REAL authority; the Public ID controller is the REAL controller over a scripted
 * transport that answers exactly what migration 0125 would.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore, type AppearancePreference } from '../../appearance';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { AccountPublicIdOutcome, PublicIdChangeOutcome } from '../../runtime-entry';
import { SettingsSurface, createPublicIdController, settingsCopy, type PublicIdController } from '..';

// W3-MEGA-S re-anchor (validation only): the Language row of «قنديل والمحادثة» / QANDEEL & Conversation is now a real group
// of every Settings root, drawn before Appearance & Accessibility. The language name is its own run (LRI … PDI) in English.
const drawnLanguage = (language: 'ar' | 'en') => (language === 'ar' ? 'العربية' : String.fromCodePoint(0x2066) + 'English' + String.fromCodePoint(0x2069));


// The test renderer has no native node: every located element answers one known handle, so a request to move
// the screen reader is observable. Nothing else of the renderer is replaced.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));
const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function transportFor(initial: { publicId: string; changeAvailable: boolean }) {
  let current = { ...initial };
  const answers: PublicIdChangeOutcome[] = [];
  const requests: { commandId: string; publicId: string }[] = [];
  let hold: Promise<void> | null = null;
  return {
    requests,
    /** Queue what the next change request answers. `COMMIT` answers CHANGED and commits it for later reads. */
    next(outcome: PublicIdChangeOutcome | 'COMMIT' | 'COMMIT_BUT_LOSE_THE_ANSWER') {
      answers.push(outcome as never);
    },
    holdNext() {
      let release!: () => void;
      hold = new Promise((resolve) => { release = resolve; });
      return () => release();
    },
    transport: {
      readPublicId: async (): Promise<AccountPublicIdOutcome> => ({ kind: 'READ', view: { ...current } }),
      changePublicId: async (commandId: string, publicId: string): Promise<PublicIdChangeOutcome> => {
        requests.push({ commandId, publicId });
        if (hold !== null) {
          const waiting = hold;
          hold = null;
          await waiting;
        }
        const answer = answers.shift() as PublicIdChangeOutcome | 'COMMIT' | 'COMMIT_BUT_LOSE_THE_ANSWER' | undefined;
        if (answer === 'COMMIT' || answer === 'COMMIT_BUT_LOSE_THE_ANSWER') {
          current = { publicId, changeAvailable: false };
          return answer === 'COMMIT' ? { kind: 'ANSWERED', answer: 'CHANGED', view: { ...current } } : { kind: 'NETWORK' };
        }
        return answer ?? { kind: 'NETWORK' };
      },
    },
  };
}

async function settings(language: ChromeLanguage, options: { publicId?: string; changeAvailable?: boolean; preference?: AppearancePreference } = {}) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore(options.preference === undefined ? {} : { reader: options.preference }),
    system: { current: () => 'LIGHT', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const server = transportFor({ publicId: options.publicId ?? 'nightlamp27', changeAvailable: options.changeAvailable ?? true });
  const controller: PublicIdController = createPublicIdController({ transport: server.transport, isCurrent: () => true, setTimer: () => null, clearTimer: () => undefined });
  const onBack = jest.fn();
  const view = await render(
    <AppearanceProvider authority={authority}>
      <SettingsSurface language={language} insets={INSETS} onBack={onBack} onSignOut={async () => undefined} publicId={controller} />
    </AppearanceProvider>,
  );
  await act(async () => {
    await flush();
  });
  return { view, onBack, server, controller };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await flush();
  });
}

async function type(view: RenderResult, text: string) {
  await fireEvent.changeText(view.getByTestId('qandeel-public-id-change-input'), text);
}

const words = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => node.props.children as string);

afterEach(() => jest.restoreAllMocks());

describe.each(['ar', 'en'] as const)('%s — Account & Identity: the Public ID', (language) => {
  const copy = settingsCopy(language);
  const pid = copy.publicId;

  it('is a REAL third group, first, holding the Public ID and nothing else — no placeholder rows', async () => {
    const { view } = await settings(language);
    expect(words(view)).toEqual([
      copy.title,
      copy.accountGroup, pid.term, `${LRI}@nightlamp27${PDI}`, pid.available,
      copy.qandeelGroup, copy.language.term, drawnLanguage(language),
      copy.appearanceGroup, copy.appearance.DARK, copy.appearance.LIGHT, copy.appearance.SYSTEM,
      copy.supportGroup, copy.signOut,
    ]);
    const group = view.getByTestId('qandeel-settings-group-account');
    expect(within(group).getByTestId('qandeel-settings-group-account-name').props.accessibilityRole).toBe('header');
    expect(within(group).getAllByRole('button')).toHaveLength(1);
    expect(view.getAllByRole('header').map((node) => node.props.children)).toEqual([copy.title, copy.accountGroup, copy.qandeelGroup, copy.appearanceGroup, copy.supportGroup]);
  });

  it('the handle is an isolated left-to-right run inside the reader’s line, and the row is fully described to a screen reader', async () => {
    const { view } = await settings(language);
    const value = view.getByTestId('qandeel-public-id-value');
    expect(value.props.children).toBe(`${LRI}@nightlamp27${PDI}`);
    expect(style(value).writingDirection).toBe(language === 'ar' ? 'rtl' : 'ltr');
    const row = view.getByTestId('qandeel-public-id-row');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toBe(`${pid.term}, @nightlamp27, ${pid.available}`);
    expect(row.props.accessibilityLabel).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
    expect(style(row).minHeight).toBe(44);
  });

  it('opening the change shows the warning, the Current value and the New field BEFORE anything can commit', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    const { view, server } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    expect(words(view)).toEqual([copy.title, pid.title, pid.body, pid.current, `${LRI}@nightlamp27${PDI}`, pid.next, pid.keep, pid.confirm]);
    expect(view.getByTestId('qandeel-public-id-change-title').props.accessibilityRole).toBe('header');
    expect(focus).toHaveBeenCalledWith(4242);
    const input = view.getByTestId('qandeel-public-id-change-input');
    expect(input.props.accessibilityLabel).toBe(pid.next);
    expect(style(input)).toMatchObject({ writingDirection: 'ltr', textAlign: 'left' });
    expect(input.props).toMatchObject({ autoCapitalize: 'none', autoCorrect: false, autoComplete: 'off' });
    expect(server.requests).toHaveLength(0);
    // It is a state of THIS destination: the Settings frame and its Back stay.
    expect(view.getByTestId('qandeel-settings-title').props.children).toBe(copy.title);
  });

  it('Keep current ID leaves the allowance intact and sends nothing', async () => {
    const { view, server, controller } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    await type(view, 'noor.writes');
    await press(view, 'qandeel-public-id-keep');
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(pid.available);
    expect(server.requests).toHaveLength(0);
    expect(controller.getState().changeAvailable).toBe(true);
  });

  it('Back and Android Back leave the change and return to the same Settings — never out of Settings', async () => {
    // The exact current React Native handler type, derived from the API rather than hand-written.
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const backPress: Parameters<Handler>[0] = { type: 'hardwareBackPress', timeStamp: 0 };
    const handlers: Handler[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    });
    const { view, onBack } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    expect(handlers).toHaveLength(1);
    await act(async () => {
      expect(handlers[handlers.length - 1](backPress)).toBe(true);
    });
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    await press(view, 'qandeel-public-id-row');
    await press(view, 'qandeel-settings-back');
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    expect(view.getByTestId('qandeel-settings-group-account')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    expect(handlers).toHaveLength(0);
  });

  it('a successful commit returns to Account & Identity with the new canonical value and the one change used — no second edit', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    const { view, server } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    await type(view, '  @Noor.Writes ');
    server.next('COMMIT');
    await press(view, 'qandeel-public-id-confirm');
    expect(server.requests).toEqual([{ commandId: expect.stringMatching(/^[0-9a-f-]{36}$/u), publicId: 'noor.writes' }]);
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    expect(view.getByTestId('qandeel-public-id-value').props.children).toBe(`${LRI}@noor.writes${PDI}`);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(pid.used);
    const row = view.getByTestId('qandeel-public-id-row');
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props.onPress).toBeUndefined();
    expect(row.props.accessibilityLabel).toBe(`${pid.term}, @noor.writes, ${pid.used}`);
    expect(focus).toHaveBeenCalledWith(4242);
    // Pressing the used row opens nothing.
    await fireEvent.press(row);
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
  });

  it.each([
    ['INVALID (told at once, no request)', 'ab', null, 'invalid'],
    ['INVALID (the server’s own verdict)', 'fine.value', { kind: 'ANSWERED', answer: 'INVALID', view: { publicId: 'nightlamp27', changeAvailable: true } }, 'invalid'],
    ['UNAVAILABLE', 'taken.one', { kind: 'ANSWERED', answer: 'UNAVAILABLE', view: { publicId: 'nightlamp27', changeAvailable: true } }, 'unavailable'],
    ['not committed after a lost answer', 'noor.writes', { kind: 'NETWORK' }, 'network'],
  ] as const)('%s keeps the edit state and says only the approved sentence', async (_name, value, answer, key) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { view, server, controller } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    await type(view, value);
    if (answer !== null) server.next(answer as PublicIdChangeOutcome);
    await press(view, 'qandeel-public-id-confirm');
    const message = view.getByTestId('qandeel-public-id-change-message');
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    expect(within(message).getByText(pid[key])).toBeTruthy();
    expect(style(within(message).getByText(pid[key])).color).toBe(P.DARK.standard.error);
    expect(announce).toHaveBeenCalledWith(pid[key]);
    expect(view.getByTestId('qandeel-public-id-change')).toBeTruthy();
    expect(controller.getState().changeAvailable).toBe(true);
    if (answer === null) expect(server.requests).toHaveLength(0);
  });

  it('a lost answer on a change that DID commit is reconciled by reading: the change is shown done, never a false failure', async () => {
    const { view, server } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    await type(view, 'noor.writes');
    server.next('COMMIT_BUT_LOSE_THE_ANSWER');
    await press(view, 'qandeel-public-id-confirm');
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    expect(view.getByTestId('qandeel-public-id-value').props.children).toBe(`${LRI}@noor.writes${PDI}`);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(pid.used);
    expect(view.queryByText(pid.network)).toBeNull();
  });

  it('Confirm is double-tap safe: busy and disabled while committing, one request, and Back cannot abandon it', async () => {
    const { view, server, onBack } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    await type(view, 'noor.writes');
    const release = server.holdNext();
    server.next('COMMIT');
    await fireEvent.press(view.getByTestId('qandeel-public-id-confirm'));
    await fireEvent.press(view.getByTestId('qandeel-public-id-confirm'));
    const confirm = view.getByTestId('qandeel-public-id-confirm');
    expect(confirm.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(style(confirm).opacity).toBe(0.6);
    expect(view.getByTestId('qandeel-public-id-keep').props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByTestId('qandeel-public-id-change-input').props.editable).toBe(false);
    await fireEvent.press(view.getByTestId('qandeel-settings-back'));
    expect(view.getByTestId('qandeel-public-id-change')).toBeTruthy();
    await act(async () => {
      release();
      await flush();
    });
    expect(server.requests).toHaveLength(1);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(pid.used);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('confirming the current ID consumes nothing and simply leaves the change', async () => {
    const { view, server, controller } = await settings(language);
    await press(view, 'qandeel-public-id-row');
    await type(view, '@NightLamp27');
    server.next({ kind: 'ANSWERED', answer: 'UNCHANGED', view: { publicId: 'nightlamp27', changeAvailable: true } });
    await press(view, 'qandeel-public-id-confirm');
    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(pid.available);
    expect(controller.getState().changeAvailable).toBe(true);
  });

  it('an account whose change is already used shows it as used, with nothing to press', async () => {
    const { view } = await settings(language, { publicId: 'noor.writes', changeAvailable: false });
    const row = view.getByTestId('qandeel-public-id-row');
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props.accessible).toBe(true);
    expect(within(view.getByTestId('qandeel-settings-group-account')).queryAllByRole('button')).toHaveLength(0);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(pid.used);
  });
});

describe('appearance, 320 width and enlarged text', () => {
  it.each(['DARK', 'LIGHT'] as const)('%s: the group, the row and the change paint the effective family — Settings follows the preference', async (preference) => {
    const { view } = await settings('ar', { preference });
    const family = P[preference].standard;
    expect(style(view.getByTestId('qandeel-settings')).backgroundColor).toBe(family.world);
    expect(style(view.getByText(settingsCopy('ar').publicId.term)).color).toBe(family.primary);
    await press(view, 'qandeel-public-id-row');
    expect(style(view.getByTestId('qandeel-public-id-change-input')).backgroundColor).toBe(family.field);
    expect(style(view.getByTestId('qandeel-public-id-change-title')).color).toBe(family.primary);
  });

  it('nothing is clipped or capped, no row or field has a fixed width, and the actions wrap', async () => {
    const { view } = await settings('ar');
    await press(view, 'qandeel-public-id-row');
    expect(view.getByTestId('qandeel-settings-body').type).toBe('RCTScrollView');
    for (const node of view.getAllByText(/.+/u)) {
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.numberOfLines).toBeUndefined();
    }
    expect(style(view.getByTestId('qandeel-public-id-change-input')).width).toBeUndefined();
    for (const id of ['qandeel-public-id-keep', 'qandeel-public-id-confirm']) {
      expect(style(view.getByTestId(id))).toMatchObject({ minHeight: 44, minWidth: 44 });
      expect(style(view.getByTestId(id)).width).toBeUndefined();
    }
    expect(style(view.getByTestId('qandeel-public-id-actions'))).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });
});
