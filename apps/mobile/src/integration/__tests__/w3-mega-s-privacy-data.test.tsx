/**
 * W3-MEGA-S — E2E-D-11 (the Language row), E2E-D-16 (Export My Data) and the Personal-world E2E-D-17 (Delete Account)
 * on the PRODUCTION phase surface, over a runtime the harness genuinely built: the route's own mapping, the real
 * runtime generation, the real account transport bound to the signed-in identity, the real Privacy & Data controller
 * and the real General Settings.
 *
 * Stood in for: the network and the QANDEEL API, answered here exactly as the W3-MEGA-S routes answer (the database is
 * proven by `database/verify-migration-0130.mjs`, the server boundary by `privacy-data.spec.ts`), and the system
 * folder picker the package is saved through.
 *
 * RE-ANCHORED by S6-07 (CP4, QAN-BL-PRIV-04): the download is the bundle route (the same package, and the reader's own
 * photos beside it), and the REAL save runs over a stood-in file system (expo-file-system's Directory) instead of being
 * replaced as a whole, so the folder the reader ends up with is what is asserted.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { settingsCopy } from '../../settings';
import { notificationsCopy } from '../../activity';
import { Directory } from 'expo-file-system';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLocale } from '../locale/device-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

jest.mock('expo-file-system', () => ({ ...jest.requireActual<object>('expo-file-system'), Directory: { pickDirectoryAsync: jest.fn() } }));

/** The place the reader picks, on a stood-in disk: what was written where, in which order, and what was removed. */
function pickedPlace() {
  const files = new Map<string, Buffer>();
  const order: string[] = [];
  const deleted: string[] = [];
  const dir = (path: string): unknown => ({
    createDirectory: (name: string) => dir(`${path}/${name}`),
    createFile: (name: string) => {
      const full = `${path}/${name}`;
      if (files.has(full)) throw new Error('exists');
      files.set(full, Buffer.alloc(0));
      return {
        write: (content: string, options?: { encoding?: string }) => {
          files.set(full, Buffer.from(content, options?.encoding === 'base64' ? 'base64' : 'utf8'));
          order.push(full);
        },
        get exists() { return files.has(full); },
        get size() { return files.get(full)?.length ?? 0; },
      };
    },
    delete: () => {
      deleted.push(path);
      for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key);
    },
  });
  (Directory.pickDirectoryAsync as jest.Mock).mockResolvedValue(dir('picked'));
  return { files, order, deleted };
}
const PACKAGE = { format: 'qandeel.personal-data-export.v1', account: { name: 'Noor', email: 'noor@example.test' } };
const TOKEN = 'b'.repeat(64);
const jpeg = (label: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(label)]);

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const LANGUAGE = deviceProductLocale().language;
const COPY = settingsCopy(LANGUAGE);
// A3-01 re-anchor (validation only): «الإشعارات والنشاط» / Notifications & Activity is now a real group, placed where P1 §8.1
// reserved it — after QANDEEL & Conversation. Every other group, and the absence of any placeholder, is unchanged.
const NOTIFICATIONS = notificationsCopy(LANGUAGE).section;
const UNTIL = '2026-10-07T09:00:00.000Z';

/** The server: the owner's Privacy & Data state and the routes that change it (0130 + the provider's password check). */
function server(h: IntegrationHarness) {
  const state = {
    password: 'pw',
    export: { status: 'NONE', availableUntil: null as string | null },
    deletion: { status: 'NONE', finalAt: null as string | null },
    commands: new Set<string>(),
    // S6-07 (CP4): the reader's own photos the bundle names, the leading ones inline, and whether they moved since.
    photos: [] as { fileName: string; bytes: Buffer }[],
    inline: 0,
    moved: false,
  };
  const body = (request: { readonly body?: string | null }) => JSON.parse(request.body ?? '{}') as Record<string, string>;
  const view = () => ({ export: { ...state.export }, deletion: { ...state.deletion } });
  h.http.on('/account/privacy', () => ({ status: 200, body: view() }));
  h.http.on('/account/privacy/export', (request) => {
    const { commandId, password } = body(request);
    if (password !== state.password) return { status: 200, body: { outcome: 'PASSWORD_REJECTED' } };
    state.commands.add(commandId);
    if (state.export.status !== 'READY') state.export = { status: 'PREPARING', availableUntil: null };
    return { status: 200, body: { outcome: 'ACCEPTED', export: { ...state.export } } };
  });
  h.http.on('/account/privacy/export/download', () => (state.export.status === 'READY'
    ? { status: 200, body: { status: 'READY', availableUntil: state.export.availableUntil, package: PACKAGE } }
    : { status: 200, body: { status: state.export.status, availableUntil: null, package: null } }));
  h.http.on('/account/privacy/export/download/bundle', () => (state.export.status === 'READY'
    ? { status: 200, body: { status: 'READY', availableUntil: state.export.availableUntil, package: PACKAGE,
      photoManifest: { format: 'qandeel.personal-data-export.photos.v1', notIncluded: [],
        files: state.photos.map((f, i) => ({ fileName: f.fileName, mimeType: 'image/jpeg', stage: i + 1, shared: i === 0,
          introductionStartedAt: '2026-10-10T08:00:00.123456+00:00', derivedRendition: true })) },
      photoFiles: state.photos.slice(0, state.inline).map((f) => ({ fileName: f.fileName, bytes: f.bytes.length, bytesBase64: f.bytes.toString('base64') })),
      photoManifestToken: TOKEN } }
    : { status: 200, body: { status: state.export.status, availableUntil: null, package: null, photoManifest: null, photoFiles: null, photoManifestToken: null } }));
  h.http.on('/account/privacy/export/download/bundle/files/', (request) => {
    const name = request.url.slice(request.url.lastIndexOf('/') + 1);
    const file = state.photos.find((f) => f.fileName === name);
    if (state.moved || file === undefined || request.headers?.['x-qandeel-export-manifest'] !== TOKEN) return { status: 409, body: { outcome: 'CHANGED' } };
    return { status: 200, body: { fileName: name, bytes: file.bytes.length, bytesBase64: file.bytes.toString('base64') } };
  });
  h.http.on('/account/privacy/deletion', (request) => {
    const { commandId, password } = body(request);
    if (password !== state.password) return { status: 200, body: { outcome: 'PASSWORD_REJECTED' } };
    state.commands.add(commandId);
    state.deletion = { status: 'SCHEDULED', finalAt: UNTIL };
    return { status: 200, body: { outcome: 'ACCEPTED', deletion: { ...state.deletion } } };
  });
  h.http.on('/account/privacy/deletion/cancel', () => {
    const had = state.deletion.status === 'SCHEDULED';
    state.deletion = { status: 'NONE', finalAt: null };
    return { status: 200, body: { outcome: had ? 'CANCELLED' : 'NONE', deletion: { ...state.deletion } } };
  });
  return state;
}

/** Every runtime a test built, disposed when it ends: an undisposed one keeps its Settings read retries armed after the run. */
const built: IntegrationHarness[] = [];

afterEach(() => {
  for (const h of built.splice(0)) h.dispose();
});

async function world() {
  const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' } });
  built.push(h);
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/account/public-id', () => ({ status: 200, body: { publicId: 'nightlamp27', changeAvailable: true } }));
  const state = server(h);
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return { h, view, state };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

describe('W3-MEGA-S — Privacy & Data, end to end', () => {
  it('reads nothing before Settings is shown; then the owner’s own state, on the owner’s token, with no id in any URL', async () => {
    const { h, view } = await world();
    expect(h.http.matching('/account/privacy')).toHaveLength(0);
    await press(view, 'qandeel-settings-entry');
    const reads = h.http.matching('/account/privacy');
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ method: 'GET', authorization: 'Bearer token-a' });
    expect(reads[0].url).not.toMatch(/alice|user/u);
    const settings = within(view.getByTestId('qandeel-settings'));
    expect(settings.getAllByRole('header').map((node) => node.props.children)).toEqual([
      COPY.title, COPY.accountGroup, COPY.qandeelGroup, NOTIFICATIONS, COPY.appearanceGroup, COPY.privacyGroup, COPY.supportGroup,
    ]);
  });

  it('exports: the password, then the server prepares; the ready package is saved; no body carries an account', async () => {
    const { h, view, state } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-export-request');
    await fireEvent.changeText(view.getByTestId('qandeel-export-request-form-password'), 'pw');
    await press(view, 'qandeel-export-request-form-confirm');
    expect(view.getByTestId('qandeel-export-status-status').props.children).toBe(COPY.privacy.exportPreparing);

    state.export = { status: 'READY', availableUntil: UNTIL };
    await press(view, 'qandeel-settings-back');
    await press(view, 'qandeel-settings-entry');
    const place = pickedPlace();
    await press(view, 'qandeel-export-download');
    // No photo: exactly today's one package file, where the reader chose.
    expect([...place.files.keys()]).toEqual([`picked/qandeel-data-${new Date().toISOString().slice(0, 10)}.json`]);
    expect(JSON.parse([...place.files.values()][0].toString())).toEqual(PACKAGE);
    expect(within(view.getByTestId('qandeel-export-download-notice')).getByText(COPY.privacy.exportSaved)).toBeTruthy();

    for (const request of [...h.http.matching('/account/privacy/export'), ...h.http.matching('/account/privacy/deletion')]) {
      expect(request).toMatchObject({ authorization: 'Bearer token-a' });
      expect(request.url).not.toMatch(/alice|user/u);
      if (request.method === 'POST') {
        expect(Object.keys(JSON.parse(request.body ?? '{}')).sort()).toEqual(['commandId', 'password']);
      }
    }
  });

  it('S6-07: exports the reader\'s own photos too - inline and by name under the token - photos first, the package last', async () => {
    const { h, view, state } = await world();
    state.export = { status: 'READY', availableUntil: UNTIL };
    state.photos = ['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg', 'qandeel-photo-01-stage-3.jpg'].map((fileName) => ({ fileName, bytes: jpeg(fileName) }));
    state.inline = 1;
    await press(view, 'qandeel-settings-entry');
    const place = pickedPlace();
    await press(view, 'qandeel-export-download');
    const day = new Date().toISOString().slice(0, 10);
    const folder = `picked/qandeel-data-${day}`;
    expect(place.order).toEqual([...state.photos.map((f) => `${folder}/${f.fileName}`), `${folder}/qandeel-photos-${day}.json`, `${folder}/qandeel-data-${day}.json`]);
    for (const f of state.photos) expect(place.files.get(`${folder}/${f.fileName}`)?.equals(f.bytes)).toBe(true);
    expect(JSON.parse(place.files.get(`${folder}/qandeel-data-${day}.json`)?.toString() ?? '')).toEqual(PACKAGE);
    expect(within(view.getByTestId('qandeel-export-download-notice')).getByText(COPY.privacy.exportSaved)).toBeTruthy();
    const fileRequests = h.http.matching('/bundle/files/');
    expect(fileRequests.map((r) => r.url.slice(r.url.lastIndexOf('/') + 1))).toEqual(['qandeel-photo-01-stage-2.jpg', 'qandeel-photo-01-stage-3.jpg']);
    for (const r of fileRequests) expect(r).toMatchObject({ authorization: 'Bearer token-a', headers: expect.objectContaining({ 'x-qandeel-export-manifest': TOKEN }) });
    expect(h.http.matching('/account/privacy/export/download').some((r) => r.url.endsWith('/export/download'))).toBe(false);

    // The photos moved between the manifest and a file: nothing is kept, and the reader is told it could not be saved.
    state.moved = true;
    const again = pickedPlace();
    await press(view, 'qandeel-export-download');
    expect(again.files.size).toBe(0);
    expect(again.deleted).toEqual([folder]);
    expect(within(view.getByTestId('qandeel-export-download-notice')).getByText(COPY.privacy.exportSaveFailed)).toBeTruthy();
  });

  it('deletes (Personal world): the password, then the date it becomes final; Cancel keeps the account', async () => {
    const { h, view, state } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-deletion-request');
    await fireEvent.changeText(view.getByTestId('qandeel-deletion-request-form-password'), 'nope');
    await press(view, 'qandeel-deletion-request-form-confirm');
    expect(state.deletion.status).toBe('NONE');
    await fireEvent.changeText(view.getByTestId('qandeel-deletion-request-form-password'), 'pw');
    await press(view, 'qandeel-deletion-request-form-confirm');
    expect(state.deletion.status).toBe('SCHEDULED');
    expect(view.getByTestId('qandeel-deletion-cancel')).toBeTruthy();
    // The reader stays signed in during the grace period: nothing here signs out.
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();

    await press(view, 'qandeel-deletion-cancel');
    expect(state.deletion.status).toBe('NONE');
    expect(view.getByTestId('qandeel-deletion-request')).toBeTruthy();
    const cancels = h.http.matching('/account/privacy/deletion/cancel');
    expect(cancels).toHaveLength(1);
    expect(JSON.parse(cancels[0].body ?? 'null')).toEqual({});
  });
});
