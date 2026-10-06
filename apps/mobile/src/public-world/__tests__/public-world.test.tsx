/**
 * S5-01 — the Public World entry controller, the strict root link, the area's pre-authority neutrality and the
 * Public display choice controller.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { PublicDisplayResult, PublicEntryResult, PublicSetDisplayResult } from '../../runtime-entry';
import { createPublicDisplayController } from '../../settings/public-display-controller';
import { PUBLIC_COPY_GATE, publicCopy } from '../copy';
import { createPublicLinkInbox, isPublicWorldLink } from '../public-link';
import { createPublicWorldController } from '../public-world-controller';
import { PublicWorldArea } from '../PublicWorldArea';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

afterEach(cleanup);

describe('S5-01 qandeel://public', () => {
  it('is read exactly: one form, nothing else', () => {
    expect(isPublicWorldLink('qandeel://public')).toBe(true);
    for (const url of ['qandeel://public/', 'qandeel://public?x', 'qandeel://public#x', 'QANDEEL://public', 'qandeel://Public',
      'qandeel://public/experience/1', 'qandeel://shared/world/x', ' qandeel://public', 'qandeel://public ', null, undefined, 42, {}]) {
      expect(isPublicWorldLink(url)).toBe(false);
    }
  });

  it('the inbox holds one pending entry, taken once, dropped on sign-out', () => {
    const inbox = createPublicLinkInbox();
    const heard = jest.fn();
    inbox.subscribe(heard);
    inbox.put();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(inbox.take()).toBe(true);
    expect(inbox.take()).toBe(false);
    inbox.put();
    inbox.drop();
    expect(inbox.take()).toBe(false);
  });
});

describe('S5-01 Public entry controller', () => {
  it('resolves NOW on every entry; ALLOW only on ALLOW; a stale answer never wins', async () => {
    const answers = [deferred<PublicEntryResult>(), deferred<PublicEntryResult>()];
    let call = 0;
    const transport = { entry: jest.fn(() => answers[call++].promise) };
    const controller = createPublicWorldController({ transport, isCurrent: () => true });
    expect(controller.getState().entry).toBe('NONE');
    controller.enter();
    expect(controller.getState().entry).toBe('RESOLVING');
    controller.enter();
    answers[1].resolve({ kind: 'DENIED' });
    await flush();
    expect(controller.getState().entry).toBe('DENIED');
    answers[0].resolve({ kind: 'ALLOW' });
    await flush();
    expect(controller.getState().entry).toBe('DENIED');
    expect(transport.entry).toHaveBeenCalledTimes(2);
  });

  it('a transport failure is a refusal, never an ALLOW; a retired controller publishes nothing', async () => {
    const failing = createPublicWorldController({ transport: { entry: async () => { throw new Error('down'); } }, isCurrent: () => true });
    failing.enter();
    await flush();
    expect(failing.getState().entry).toBe('DENIED');
    const unavailable = createPublicWorldController({ transport: { entry: async () => ({ kind: 'UNAVAILABLE' }) }, isCurrent: () => true });
    unavailable.enter();
    await flush();
    expect(unavailable.getState().entry).toBe('DENIED');
    const retired = createPublicWorldController({ transport: { entry: async () => ({ kind: 'ALLOW' }) }, isCurrent: () => true });
    retired.retire();
    retired.enter();
    await flush();
    expect(retired.getState().entry).toBe('NONE');
  });
});

describe('S5-01 Public World area', () => {
  const appearance = () => {
    const authority = createAppearanceAuthority({
      store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
      system: { current: () => 'DARK', subscribe: () => () => undefined },
      native: { apply: () => undefined },
    });
    authority.bindAccount('reader');
    return authority;
  };

  it.each(['ar', 'en'] as const)('%s: nothing of the destination before ALLOW; the root after it; a neutral refusal', async (language) => {
    const words = publicCopy(language);
    const answer = deferred<PublicEntryResult>();
    const transport = { entry: jest.fn<Promise<PublicEntryResult>, []>(() => answer.promise) };
    const controller = createPublicWorldController({ transport, isCurrent: () => true });
    const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    expect(transport.entry).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-public-transition').props.accessibilityLabel).toBe(words.opening);
    expect(view.queryByText(words.publicWorld)).toBeNull();
    answer.resolve({ kind: 'ALLOW' });
    await flush();
    expect(view.getByTestId('qandeel-public-title').props.children).toBe(words.publicWorld);

    transport.entry.mockImplementation(async () => ({ kind: 'DENIED' }));
    await act(async () => { controller.enter(); await Promise.resolve(); });
    await flush();
    expect(view.getByText(words.worldUnavailable)).toBeTruthy();
    expect(view.queryByText(words.publicWorld)).toBeNull();
    transport.entry.mockImplementation(async () => ({ kind: 'ALLOW' }));
    await fireEvent.press(view.getByTestId('qandeel-public-retry'));
    await flush();
    expect(view.getByTestId('qandeel-public-title')).toBeTruthy();
  });

  it('the copy gate names its PROPOSED rows; the area name is CANON', () => {
    expect(PUBLIC_COPY_GATE.proposed).toEqual(['switcherLabel', 'displayHeading']);
    expect(publicCopy('ar').publicWorld).toBe('العالم العام');
    expect(publicCopy('en').publicWorld).toBe('Public World');
  });
});

describe('S5-01 Public display controller', () => {
  const display = (mode: 'PSEUDONYM' | 'REAL_NAME', realNameAvailable = true): PublicDisplayResult =>
    ({ kind: 'READ', display: { mode, label: mode === 'REAL_NAME' ? 'Amal' : 'nightlamp27', realNameAvailable } });

  it('reads, then chooses a MODE; nothing is optimistic', async () => {
    const set = deferred<PublicSetDisplayResult>();
    const transport = { readDisplay: jest.fn(async () => display('PSEUDONYM')), setDisplay: jest.fn(() => set.promise) };
    const controller = createPublicDisplayController({ transport, isCurrent: () => true });
    controller.load();
    await flush();
    expect(controller.getState().display).toEqual({ mode: 'PSEUDONYM', label: 'nightlamp27', realNameAvailable: true });
    controller.choose('REAL_NAME');
    expect(controller.getState().display?.mode).toBe('PSEUDONYM');
    expect(controller.getState().busy).toBe('REAL_NAME');
    expect(transport.setDisplay).toHaveBeenCalledWith('REAL_NAME');
    set.resolve({ kind: 'UPDATED', mode: 'REAL_NAME', label: 'Amal' });
    await flush();
    expect(controller.getState()).toMatchObject({ busy: null, failed: false, display: { mode: 'REAL_NAME', label: 'Amal' } });
  });

  it('a lost answer re-reads the canonical state and says it did not go through; Name without a Name is never sent', async () => {
    const transport = { readDisplay: jest.fn(async () => display('PSEUDONYM')), setDisplay: jest.fn(async (): Promise<PublicSetDisplayResult> => ({ kind: 'UNAVAILABLE' })) };
    const controller = createPublicDisplayController({ transport, isCurrent: () => true });
    controller.load();
    await flush();
    controller.choose('REAL_NAME');
    await flush();
    expect(transport.readDisplay).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({ failed: true, display: { mode: 'PSEUDONYM' } });

    const nameless = createPublicDisplayController({ transport: { ...transport, readDisplay: jest.fn(async () => display('PSEUDONYM', false)) }, isCurrent: () => true });
    nameless.load();
    await flush();
    transport.setDisplay.mockClear();
    nameless.choose('REAL_NAME');
    expect(transport.setDisplay).not.toHaveBeenCalled();
  });
});
