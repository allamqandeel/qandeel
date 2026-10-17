/**
 * S6-06 (CP2) — progressive disclosure, the three-stage photo, the display-name consent, SUCCESS and resuming
 * Introductions on the device, in Arabic and English, Dark and Light: the approved copy word for word against the Copy
 * Gate record; the controller's retry identities and in-memory renditions; and the approved screens P0 – P16.
 *
 * The appearance is the REAL authority; the controllers are the REAL controllers over scripted transports. The photo
 * source is a stand-in that records what is chosen and deleted (the device source is proven by its own suite).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import type { ChromeLanguage } from '../../orientation-chrome';
import type {
  IntroductionDiscloseResult, IntroductionDisclosures, IntroductionDisclosuresRead, IntroductionGrantResult, IntroductionMediaRead, IntroductionMessage,
  IntroductionParticipationRead, IntroductionRemoveResult, IntroductionResumeResult, IntroductionRevokeResult, IntroductionShare, IntroductionSharesRead,
  IntroductionSuccessRead, IntroductionSuccessResult, IntroductionUploadResult, SharedDeleteResult,
} from '../../runtime-entry';
import { createIntroductionSharesController } from '../../settings';
import { IntroductionSharesPage } from '../../settings/IntroductionSharesSection';
import { usePalette } from '../../conversation';
import { sharedCopy } from '../../shared-world/copy';
import {
  INTRODUCTION_SHARING_COPY_GATE, INTRODUCTION_SHARING_COPY_ROWS, IntroductionWorldSurface, IntroductionsSurface, createIntroductionSharingController,
  createIntroductionWorldsController, createIntroductionsController, createParticipationController, fillSharing, introductionSharingCopy,
  introductionWorldCopy, myPhotoOf, type PhotoChoice, type PhotoSource,
} from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const W = '51111111-1111-4111-8111-111111111111';
const PR = '53333333-3333-4333-8333-333333333333';
const S = '57777777-7777-4777-8777-777777777777';
const H1 = '58888888-8888-4888-8888-888888888881';
const H2 = '58888888-8888-4888-8888-888888888882';
const H3 = '58888888-8888-4888-8888-888888888883';
const HT = '58888888-8888-4888-8888-888888888889';
const AT = '2026-10-17T10:00:00+00:00';
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const settle = async () => { for (let i = 0; i < 4; i += 1) await flush(); };
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const GATE = readFileSync(join(__dirname, '../../../../../docs/e2e/QANDEEL_S6_06_VISUAL_COPY_GATE_v1.md'), 'utf8');
const APP = JSON.parse(readFileSync(join(__dirname, '../../../app.json'), 'utf8')) as { expo: { plugins: unknown[]; android: { blockedPermissions: string[] } } };

let seq = 0;
const uuid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const nextId = () => uuid('c0000000');

const fullName = (text = 'Sami Fouad', versionId = uuid('55555555')): IntroductionShare =>
  ({ kind: 'TEXT', mine: true, materialId: uuid('56666666'), versionId, textType: 'FULL_NAME', fieldKey: null, text, establishedAt: AT });
const theirTown = (): IntroductionShare =>
  ({ kind: 'TEXT', mine: false, materialId: uuid('56666666'), versionId: uuid('55555555'), textType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'hometown_city', text: 'Alexandria', establishedAt: AT });
const myStage = (stage: 1 | 2 | 3, handle: string): IntroductionShare =>
  ({ kind: 'IMAGE', mine: true, materialId: uuid('56666666'), versionId: uuid('55555555'), stage, handle, seriesId: S, establishedAt: AT });
const theirStage = (stage: 1 | 2 | 3, handle: string): IntroductionShare =>
  ({ kind: 'IMAGE', mine: false, materialId: uuid('56666666'), versionId: uuid('55555555'), stage, handle, seriesId: null, establishedAt: AT });
const view = (over: Partial<IntroductionDisclosures> = {}): IntroductionDisclosures =>
  ({ introductionState: 'ACTIVE', items: [], myPhoto: null, myDisplayedVersionId: null, otherDisplayName: null, ...over });

type Answer<T> = T | (() => Promise<T>);
const take = async <T,>(queue: Answer<T>[], fallback: () => T): Promise<T> => {
  const next = queue.shift();
  if (next === undefined) return fallback();
  return typeof next === 'function' ? (next as () => Promise<T>)() : next;
};

function sharingServer(initial: IntroductionDisclosures = view()) {
  let current: IntroductionDisclosuresRead = { kind: 'READY', view: initial };
  let success: IntroductionSuccessRead = { kind: 'NO_TRANSITION' };
  const q = {
    text: [] as Answer<IntroductionDiscloseResult>[], upload: [] as Answer<IntroductionUploadResult>[], stage: [] as Answer<IntroductionDiscloseResult>[],
    remove: [] as Answer<IntroductionRemoveResult>[], grant: [] as Answer<IntroductionGrantResult>[], revoke: [] as Answer<IntroductionRevokeResult>[],
    media: [] as Answer<IntroductionMediaRead>[], del: [] as Answer<SharedDeleteResult>[], approve: [] as Answer<IntroductionSuccessResult>[],
    withdraw: [] as Answer<IntroductionSuccessResult>[],
  };
  const calls = {
    reads: 0, text: [] as unknown[][], upload: [] as unknown[][], stage: [] as unknown[][], remove: [] as unknown[][], grant: [] as unknown[][],
    revoke: [] as unknown[][], media: [] as string[], del: [] as unknown[][], approve: [] as unknown[][], withdraw: [] as unknown[][],
  };
  return {
    q, calls,
    set(next: IntroductionDisclosures) { current = { kind: 'READY', view: next }; },
    setRead(next: IntroductionDisclosuresRead) { current = next; },
    setSuccess(next: IntroductionSuccessRead) { success = next; },
    transport: {
      disclosures: async () => { calls.reads += 1; return current; },
      shareText: async (...args: unknown[]) => { calls.text.push(args); return take(q.text, () => ({ kind: 'DISCLOSED' as const, materialId: uuid('56666666'), disclosedAt: AT })); },
      uploadImage: async (...args: unknown[]) => { calls.upload.push(args); return take(q.upload, () => ({ kind: 'READY' as const, seriesId: S })); },
      shareStage: async (...args: unknown[]) => { calls.stage.push(args); return take(q.stage, () => ({ kind: 'DISCLOSED' as const, materialId: uuid('56666666'), disclosedAt: AT })); },
      removeImage: async (...args: unknown[]) => { calls.remove.push(args); return take(q.remove, () => ({ kind: 'REMOVED' as const })); },
      media: async (_world: string, handle: string) => { calls.media.push(handle); return take(q.media, () => ({ kind: 'DRAWABLE' as const, dataUri: `data:image/jpeg;base64,${handle.slice(-4)}` })); },
      grantDisplayName: async (...args: unknown[]) => { calls.grant.push(args); return take(q.grant, () => ({ kind: 'GRANTED' as const })); },
      revokeDisplayName: async (...args: unknown[]) => { calls.revoke.push(args); return take(q.revoke, () => ({ kind: 'REVOKED' as const })); },
    },
    success: {
      success: async () => success,
      approve: async (...args: unknown[]) => { calls.approve.push(args); return take(q.approve, () => ({ kind: 'APPROVED' as const, eventId: uuid('59999999') })); },
      withdraw: async (...args: unknown[]) => { calls.withdraw.push(args); return take(q.withdraw, () => ({ kind: 'WITHDRAWN' as const, eventId: uuid('59999999') })); },
    },
    deletion: { deleteMaterial: async (...args: unknown[]) => { calls.del.push(args); return take(q.del, () => ({ kind: 'DELETED' as const })); } },
  };
}

function photoSource(choice: PhotoChoice = { kind: 'CHOSEN', uri: 'file:///cache/ImagePicker/a.jpg', mimeType: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) }) {
  const log: string[] = [];
  const source: PhotoSource = {
    choose: async () => { log.push('choose'); return choice; },
    discard: (uri) => { log.push(`discard ${uri}`); },
    sweep: async () => { log.push('sweep'); },
  };
  return { source, log };
}

function appearance(preference: 'DARK' | 'LIGHT') {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: preference }), system: { current: () => 'DARK', subscribe: () => () => undefined }, native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

const HELLO: IntroductionMessage = { materialId: uuid('56666666'), producer: 'HUMAN', text: 'Hello there', establishedAt: AT, canDelete: false };
function worldsTransport(state: 'ACTIVE' | 'ENDED' = 'ACTIVE') {
  return {
    list: async () => ({ kind: 'READ' as const, worlds: [{ worldId: W, proposalId: PR, state, otherFirstName: 'Reem' }] }),
    messages: async () => (state === 'ACTIVE' ? { kind: 'PAGE' as const, messages: [HELLO], hasOlder: false } : { kind: 'ENDED' as const }),
    history: async () => ({ kind: 'PAGE' as const, messages: [HELLO], hasOlder: false }),
    send: async () => ({ kind: 'FAILED' as const }),
    end: async () => ({ kind: 'ENDED' as const }),
  };
}

async function world(language: ChromeLanguage, server: ReturnType<typeof sharingServer>, opts: { preference?: 'DARK' | 'LIGHT'; photos?: PhotoSource; state?: 'ACTIVE' | 'ENDED';
  withSharing?: boolean; clear?: jest.Mock; onOpenSharedWorld?: jest.Mock } = {}) {
  const clear = opts.clear ?? jest.fn();
  const sharing = createIntroductionSharingController({
    transport: server.transport, success: server.success, deletion: server.deletion, photos: opts.photos ?? photoSource().source, isCurrent: () => true,
    clearImageMemory: clear, newCommandId: nextId,
  });
  const worlds = createIntroductionWorldsController({ transport: worldsTransport(opts.state), deletion: server.deletion as never, isCurrent: () => true, newCommandId: nextId });
  const utils = await render(
    <AppearanceProvider authority={appearance(opts.preference ?? 'DARK')}>
      <IntroductionWorldSurface controller={worlds} worldId={W} language={language} insets={INSETS} onBack={jest.fn()}
        sharing={opts.withSharing === false ? undefined : sharing} onOpenSharedWorld={opts.onOpenSharedWorld} />
    </AppearanceProvider>,
  );
  await settle();
  return { ...utils, sharing, worlds, clear };
}

const press = async (node: Parameters<typeof fireEvent.press>[0]) => { await act(async () => { fireEvent.press(node); }); await settle(); };

describe('S6-06 — the approved copy', () => {
  it('the S6-06 Copy Gate, word for word: 74 APPROVED rows; PD-83 is the native purpose string in both languages', () => {
    const record = new Map<string, { ar: string; en: string; status: string }>();
    for (const line of GATE.split(/\r?\n/u)) {
      if (!line.startsWith('| PD-')) continue;
      const cells = line.split(' | ');
      const status = cells.slice(4).join(' | ');
      // §3's rows carry their status; §4's "rows the decision changed" do not.
      if (cells.length < 5 || !status.startsWith('APPROVED')) continue;
      record.set(cells[0].slice(2), { ar: cells[2], en: cells[3], status });
    }
    const rows = Object.values(INTRODUCTION_SHARING_COPY_ROWS);
    expect(rows).toHaveLength(74);
    expect(record.size).toBe(74);
    for (const row of rows) {
      expect(record.get(row.id)?.status).toMatch(/^APPROVED/u);
      expect(row.ar).toBe(record.get(row.id)?.ar);
      expect(row.en).toBe(record.get(row.id)?.en);
    }
    expect(INTRODUCTION_SHARING_COPY_GATE.status).toMatch(/CLOSED — 74 rows APPROVED/u);
    const picker = APP.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>];
    expect(picker[1]).toEqual({ photosPermission: INTRODUCTION_SHARING_COPY_ROWS.photosPurpose.en, cameraPermission: false, microphonePermission: false });
    for (const lang of ['ar', 'en'] as const) {
      const locale = JSON.parse(readFileSync(join(__dirname, `../../../locales/${lang}.json`), 'utf8'));
      expect(locale).toEqual({ ios: { NSPhotoLibraryUsageDescription: INTRODUCTION_SHARING_COPY_ROWS.photosPurpose[lang] } });
    }
    expect(APP.expo.android.blockedPermissions).toEqual(['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
  });

  it('no row addresses the reader or the other person by one gender (LANG-01): the sixteen approved neutral rows are what ships', () => {
    const ar = introductionSharingCopy('ar');
    expect(ar.panelTitle).toBe('مشاركاتك في التعارف');
    expect(ar.mineHeading).toBe('مشاركاتي');
    expect(ar.theirsHeading).toBe('مشاركات {الاسم}');
    expect(ar.changed).toBe('تغيّر شيء. يمكنك المحاولة مرة أخرى.');
    for (const text of Object.values(ar)) expect(text).not.toMatch(/(?:^|\s)(?:اكتب|اختر|استخدم|ابدأ|حاول|شارك)(?:\s|$)|لم تشارك|ما شاركه/u);
  });
});

describe('S6-06 — P0 and the panel (P1, P2)', () => {
  it.each([['ar', 'rtl'], ['en', 'ltr']] as const)('P0 (%s): «المشاركة» beside «إنهاء التعارف» in the live World only; without sharing V-1 is unchanged', async (language, writing) => {
    const server = sharingServer();
    const live = await world(language, server);
    const action = live.getByTestId('qandeel-introduction-sharing');
    expect(action.props.accessibilityLabel).toBe(introductionSharingCopy(language).sharingAction);
    expect(flat(action).minHeight).toBe(44);
    expect(live.getByTestId('qandeel-introduction-end')).toBeTruthy();
    expect(live.getByTestId(`qandeel-introduction-world`).props.style.direction).toBe(writing);
    await cleanup();
    const plain = await world(language, sharingServer(), { withSharing: false });
    expect(plain.queryByTestId('qandeel-introduction-sharing')).toBeNull();
    expect(plain.getByTestId('qandeel-introduction-end')).toBeTruthy();
    await cleanup();
    const closed = await world(language, sharingServer(view({ introductionState: 'ENDED' })), { state: 'ENDED' });
    expect(closed.queryByTestId('qandeel-introduction-sharing')).toBeNull();
  });

  it.each(['DARK', 'LIGHT'] as const)('P1a (%s): both sections always shown, the lead, and PD-06 on the canonical palette', async (preference) => {
    const server = sharingServer();
    const s = await world('ar', server, { preference });
    await press(s.getByTestId('qandeel-introduction-sharing'));
    const copy = introductionSharingCopy('ar');
    expect(s.getByTestId('qandeel-sharing-title').props.children).toBe(copy.panelTitle);
    expect(s.getByText(copy.panelLead)).toBeTruthy();
    expect(s.getByText(copy.mineHeading)).toBeTruthy();
    expect(s.getByText(fillSharing(copy.theirsHeading, { name: 'Reem' }))).toBeTruthy();
    expect(s.getAllByText(copy.emptySection)).toHaveLength(2);
    const share = s.getByTestId('qandeel-sharing-share');
    const palette = preference === 'DARK' ? P.DARK.standard : P.LIGHT.standard;
    expect(flat(share)).toMatchObject({ minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: palette.primary, backgroundColor: palette.world });
    expect(flat(s.getByTestId('qandeel-introduction-sharing-root'))).toMatchObject({ backgroundColor: palette.world });
  });

  it('P2: the four bounded kinds only, then Cancel', async () => {
    const s = await world('en', sharingServer());
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    const copy = introductionSharingCopy('en');
    expect(s.getByTestId('qandeel-sharing-type-sheet')).toBeTruthy();
    for (const id of ['full_name', 'contact_method', 'deeper_personal_field', 'photo']) expect(s.getByTestId(`qandeel-sharing-type-${id}`)).toBeTruthy();
    expect(s.getByText(copy.typeFullName)).toBeTruthy();
    await press(s.getByTestId('qandeel-sharing-types-cancel'));
    expect(s.queryByTestId('qandeel-sharing-type-sheet')).toBeNull();
  });
});

describe('S6-06 — text shares (P3, P4, P9d, P14a)', () => {
  it('flow 1: the full name is written by the reader, previewed exactly, shared once; «ليس الآن» writes nothing', async () => {
    const server = sharingServer();
    const s = await world('ar', server);
    const copy = introductionSharingCopy('ar');
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-full_name'));
    expect(s.getByTestId('qandeel-sharing-field').props.value).toBe('');
    await act(async () => { fireEvent.changeText(s.getByTestId('qandeel-sharing-field'), 'سامي فؤاد'); });
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await press(s.getByTestId('qandeel-sharing-continue'));
    // The keyboard leaves with the field (the device run found it staying over the preview).
    expect(dismiss).toHaveBeenCalled();
    expect(s.getByText(fillSharing(copy.previewHeading, { name: 'Reem' }))).toBeTruthy();
    expect(s.getByText('سامي فؤاد')).toBeTruthy();
    expect(s.getByText(copy.confirmNote)).toBeTruthy();
    await press(s.getByTestId('qandeel-sharing-not-now'));
    expect(server.calls.text).toHaveLength(0);
    // Again, and shared.
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-full_name'));
    await act(async () => { fireEvent.changeText(s.getByTestId('qandeel-sharing-field'), 'سامي فؤاد'); });
    await press(s.getByTestId('qandeel-sharing-continue'));
    server.set(view({ items: [fullName('سامي فؤاد')] }));
    await press(s.getByTestId('qandeel-sharing-share-now'));
    expect(server.calls.text).toEqual([[W, expect.any(String), 'FULL_NAME', null, 'سامي فؤاد']]);
    expect(s.getByTestId('qandeel-sharing-mine-full_name')).toBeTruthy();
    // Sharing the full name does not show it: the first name stays until a separate consent (P15a).
    expect(s.getByText(fillSharing(copy.displayExplain, { name: 'Reem' }))).toBeTruthy();
  });

  it('P3b: a contact written in the name is refused by the server and pointed to its one path (D-10)', async () => {
    const server = sharingServer();
    server.q.text.push({ kind: 'CONTACT_REFUSED' });
    const s = await world('en', server);
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-full_name'));
    await act(async () => { fireEvent.changeText(s.getByTestId('qandeel-sharing-field'), 'Sami 0100 000 0000'); });
    await press(s.getByTestId('qandeel-sharing-continue'));
    await press(s.getByTestId('qandeel-sharing-share-now'));
    expect(s.getByTestId('qandeel-sharing-contact-refused').props.children).toBe(introductionSharingCopy('en').contactRefused);
    expect(flat(s.getByTestId('qandeel-sharing-field')).borderColor).toBe(P.DARK.standard.error);
  });

  it('P3c: the four personal keys in the ✓ choice pattern; the home town is the city only, at most 64', async () => {
    const s = await world('ar', sharingServer());
    const copy = introductionSharingCopy('ar');
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-deeper_personal_field'));
    for (const key of ['work_field', 'education', 'hometown_city', 'about_me']) expect(s.getByTestId(`qandeel-sharing-key-${key}`).props.accessibilityRole).toBe('radio');
    expect(s.queryByTestId('qandeel-sharing-field')).toBeNull();
    await press(s.getByTestId('qandeel-sharing-key-hometown_city'));
    expect(s.getByTestId('qandeel-sharing-key-hometown_city').props.accessibilityState.checked).toBe(true);
    expect(s.getByText('✓', { includeHiddenElements: true })).toBeTruthy();
    expect(s.getByTestId('qandeel-sharing-field').props.maxLength).toBe(64);
    expect(s.getByText(copy.hometownHint)).toBeTruthy();
    // The server refuses a line break: one is shown as a space, where the reader sees it.
    await act(async () => { fireEvent.changeText(s.getByTestId('qandeel-sharing-field'), 'المنصورة\nمصر'); });
    expect(s.getByTestId('qandeel-sharing-field').props.value).toBe('المنصورة مصر');
  });

  it('P14a / P9d / a lost answer: the gate closed is said; DELETED is said; FAILED retries with the SAME command id', async () => {
    const server = sharingServer();
    server.q.text.push({ kind: 'FAILED' }, { kind: 'NOT_AVAILABLE_NOW' });
    const s = await world('en', server);
    const copy = introductionSharingCopy('en');
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-contact_method'));
    expect(s.getByText(copy.contactHint)).toBeTruthy();
    await act(async () => { fireEvent.changeText(s.getByTestId('qandeel-sharing-field'), 'sami@example.com'); });
    await press(s.getByTestId('qandeel-sharing-continue'));
    await press(s.getByTestId('qandeel-sharing-share-now'));
    expect(s.getByText(sharedCopy('en').actionUnavailable)).toBeTruthy();
    await press(s.getByTestId('qandeel-sharing-share-now'));
    expect(server.calls.text[1][1]).toBe(server.calls.text[0][1]);
    expect(s.getByText(copy.sharingUnavailable)).toBeTruthy();
    expect(s.queryByTestId('qandeel-sharing-share-now')).toBeNull();
    server.q.text.push({ kind: 'DELETED' });
    await press(s.getByTestId('qandeel-sharing-not-now'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-contact_method'));
    await act(async () => { fireEvent.changeText(s.getByTestId('qandeel-sharing-field'), 'sami@example.com'); });
    await press(s.getByTestId('qandeel-sharing-continue'));
    await press(s.getByTestId('qandeel-sharing-share-now'));
    expect(s.getByText(copy.deletedShare)).toBeTruthy();
  });
});

describe('S6-06 — the photo (P5 – P9)', () => {
  it('flow 4: explained first; the picker copy is deleted before the upload is answered; stage 1 previewed from memory with no image cache', async () => {
    const server = sharingServer();
    let release!: (value: IntroductionUploadResult) => void;
    server.q.upload.push(() => new Promise((resolve) => { release = resolve; }));
    const photos = photoSource();
    const s = await world('ar', server, { photos: photos.source });
    const copy = introductionSharingCopy('ar');
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-photo'));
    expect(photos.log).toEqual(['sweep']);
    expect(s.getByText(copy.photoExplain)).toBeTruthy();
    expect(s.getByText(copy.blurLimit)).toBeTruthy();
    await press(s.getByTestId('qandeel-sharing-choose-photo'));
    expect(photos.log).toEqual(['sweep', 'choose', 'discard file:///cache/ImagePicker/a.jpg']);
    expect(s.getByTestId('qandeel-sharing-preparing').props.accessibilityLabel).toBe(copy.preparingPhoto);
    server.set(view({ myPhoto: { seriesId: S, state: 'READY', unsharedStages: [{ stage: 1, handle: H1 }, { stage: 2, handle: H2 }, { stage: 3, handle: H3 }] } }));
    await act(async () => { release({ kind: 'READY', seriesId: S }); });
    await settle();
    expect(server.calls.upload[0].slice(2)).toEqual([new Uint8Array([1, 2, 3]), 'image/jpeg']);
    // P6: the strong rendition exactly as it will be sent, fetched for drawing only; the later stages locked.
    const image = s.getByTestId('qandeel-sharing-picture-image');
    expect(image.props.cachePolicy).toBe('none');
    expect(image.props.source).toEqual({ uri: `data:image/jpeg;base64,${H1.slice(-4)}` });
    expect(image.props.accessibilityLabel).toBe(`${copy.typePhoto}، ${copy.stageStrong}`);
    expect(server.calls.media).toEqual([H1]);
    expect(s.getByText(copy.nextLocked)).toBeTruthy();
    expect(s.getByText(`${copy.stageMedium} · ${copy.stageClear}`)).toBeTruthy();
    expect(s.getByTestId('qandeel-sharing-change-photo')).toBeTruthy();
    server.set(view({ items: [myStage(1, H1)], myPhoto: { seriesId: S, state: 'DISCLOSING', unsharedStages: [{ stage: 2, handle: H2 }, { stage: 3, handle: H3 }] } }));
    await press(s.getByTestId('qandeel-sharing-share-stage'));
    expect(server.calls.stage).toEqual([[W, expect.any(String), S, 1]]);
    // P7a: the next stage is its own explicit act, previewed exactly.
    await press(s.getByTestId('qandeel-sharing-share-stage'));
    expect(s.getByText(fillSharing(copy.shareStage, { stage: copy.stageMedium }))).toBeTruthy();
    expect(server.calls.media).toContain(H2);
    await press(s.getByTestId('qandeel-sharing-share-stage-now'));
    expect(server.calls.stage[1].slice(2)).toEqual([S, 2]);
  });

  it('P5c: a refused photo is said (JPEG / PNG / WebP, up to 10 MB); a cancelled picker says nothing', async () => {
    const refused = photoSource({ kind: 'REFUSED' });
    const s = await world('en', sharingServer(), { photos: refused.source });
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-share'));
    await press(s.getByTestId('qandeel-sharing-type-photo'));
    await press(s.getByTestId('qandeel-sharing-choose-photo'));
    expect(s.getByText(introductionSharingCopy('en').photoRefused)).toBeTruthy();
  });

  it('P8: only the newest stage the other person shared is ever fetched; P9a removal says what it truly does', async () => {
    const server = sharingServer(view({ items: [theirTown(), theirStage(1, HT), myStage(1, H1)], myPhoto: { seriesId: S, state: 'DISCLOSING', unsharedStages: [{ stage: 2, handle: H2 }, { stage: 3, handle: H3 }] } }));
    const s = await world('ar', server);
    const copy = introductionSharingCopy('ar');
    await press(s.getByTestId('qandeel-introduction-sharing'));
    expect(s.getByText('Alexandria')).toBeTruthy();
    expect(new Set(server.calls.media)).toEqual(new Set([HT, H1]));
    await press(s.getByTestId('qandeel-sharing-theirs-photo-open'));
    expect(s.getByTestId('qandeel-sharing-their-stage').props.children).toBe(copy.stageStrong);
    await press(s.getByTestId('qandeel-sharing-back'));
    await press(s.getByTestId('qandeel-sharing-remove'));
    expect(s.getByText(fillSharing(copy.removeConfirm, { name: 'Reem' }))).toBeTruthy();
    server.set(view({ items: [theirTown(), theirStage(1, HT)] }));
    await press(s.getByTestId('qandeel-sharing-delete-confirm'));
    expect(server.calls.remove).toEqual([[W, expect.any(String), S]]);
    expect(s.getByText(copy.newPhoto)).toBeTruthy();
    expect(s.getByTestId('qandeel-sharing-choose-again')).toBeTruthy();
  });

  it('memory: a rendition leaves memory when its share leaves the read, and everything when the World closes', async () => {
    const server = sharingServer(view({ items: [theirStage(1, HT)] }));
    const clear = jest.fn();
    const s = await world('en', server, { clear });
    await press(s.getByTestId('qandeel-introduction-sharing'));
    expect(s.sharing.getState().open?.media[HT]?.kind).toBe('DRAWABLE');
    server.set(view());
    await act(async () => { s.sharing.refresh(); });
    await settle();
    expect(s.sharing.getState().open?.media[HT]).toBeUndefined();
    expect(clear).toHaveBeenCalledTimes(1);
    s.sharing.close();
    expect(s.sharing.getState().open).toBeNull();
  });

  it('myPhotoOf: stages strictly in order; nothing is skipped and the face is the newest shared', () => {
    const photo = myPhotoOf(view({ items: [myStage(1, H1)], myPhoto: { seriesId: S, state: 'DISCLOSING', unsharedStages: [{ stage: 2, handle: H2 }, { stage: 3, handle: H3 }] } }));
    expect(photo).toMatchObject({ phase: 'PROGRESS', next: { stage: 2, handle: H2 }, face: { stage: 1, handle: H1 } });
    expect(myPhotoOf(view({ items: [myStage(1, H1), myStage(2, H2), myStage(3, H3)] }))).toMatchObject({ phase: 'DONE', next: null, face: { stage: 3 } });
    expect(myPhotoOf(view({ myPhoto: { seriesId: S, state: 'PENDING', unsharedStages: [{ stage: 1, handle: H1 }] } }))).toMatchObject({ phase: 'PENDING', next: null, face: null });
  });
});

describe('S6-06 — deletion and the display name (P9b, P15)', () => {
  it('P9b: a text share is deleted through the Shared owner deletion, behind its true words', async () => {
    const name = fullName();
    const server = sharingServer(view({ items: [name] }));
    const s = await world('en', server);
    await press(s.getByTestId('qandeel-introduction-sharing'));
    await press(s.getByTestId('qandeel-sharing-delete'));
    expect(s.getByText(fillSharing(introductionSharingCopy('en').deleteConfirm, { name: 'Reem' }))).toBeTruthy();
    server.set(view());
    await press(s.getByTestId('qandeel-sharing-delete-confirm'));
    expect(server.calls.del).toEqual([[W, name.materialId, expect.any(String)]]);
    expect(s.queryByTestId('qandeel-sharing-mine-full_name')).toBeNull();
  });

  it('flow 6: the first name by default; the full name by consent, confirmed with its exact text; back in one tap', async () => {
    const name = fullName('Sami Fouad');
    const server = sharingServer(view({ items: [name] }));
    const s = await world('en', server);
    const copy = introductionSharingCopy('en');
    await press(s.getByTestId('qandeel-introduction-sharing'));
    expect(s.getByTestId('qandeel-sharing-display-explain').props.children).toBe(fillSharing(copy.displayExplain, { name: 'Reem' }));
    await press(s.getByTestId('qandeel-sharing-display-grant'));
    expect(s.getByText(fillSharing(copy.displayConfirm, { fullName: 'Sami Fouad' }))).toBeTruthy();
    server.set(view({ items: [name], myDisplayedVersionId: name.versionId }));
    await press(s.getByTestId('qandeel-sharing-display-confirm'));
    expect(server.calls.grant).toEqual([[W, expect.any(String), name.versionId]]);
    expect(s.getByText(copy.displayGranted)).toBeTruthy();
    server.set(view({ items: [name] }));
    await press(s.getByTestId('qandeel-sharing-display-revoke'));
    expect(server.calls.revoke).toHaveLength(1);
    expect(s.getByText(copy.displayRevoked)).toBeTruthy();
    // P15f: a new full name never inherits the consent.
    const newer = fullName('Sami A. Fouad');
    server.set(view({ items: [name, newer], myDisplayedVersionId: name.versionId }));
    await act(async () => { s.sharing.refresh(); });
    await settle();
    expect(s.getByText(copy.displayNewVersion)).toBeTruthy();
  });

  it('P15g: the World\'s title is the other person\'s full name only when the server returns it', async () => {
    const s = await world('ar', sharingServer(view({ otherDisplayName: 'ريم عادل' })));
    expect(s.getByTestId('qandeel-introduction-opening-title').props.children).toBe(introductionWorldCopy('ar').title.replace('{0}', 'ريم عادل'));
    await cleanup();
    const plain = await world('ar', sharingServer());
    expect(plain.getByTestId('qandeel-introduction-opening-title').props.children).toBe(introductionWorldCopy('ar').title.replace('{0}', 'Reem'));
  });
});

describe('S6-06 — SUCCESS (P10 – P12), never without a real transition', () => {
  it('NO_TRANSITION (production before Stage 8A): the V-1 opening, and no SUCCESS word anywhere', async () => {
    const s = await world('en', sharingServer());
    const copy = introductionSharingCopy('en');
    expect(s.getByTestId('qandeel-introduction-opening')).toBeTruthy();
    for (const word of [copy.successTitle, copy.successApprove, copy.successCompleted]) expect(s.queryByText(word)).toBeNull();
  });

  it('TRANSITION: the proposal in the opening\'s place; my approval only; CHANGED said; COMPLETED hands off to the Shared World', async () => {
    const server = sharingServer();
    const version = uuid('5aaaaaaa');
    server.setSuccess({ kind: 'TRANSITION', versionId: version, myState: 'NONE', expectedEventId: null });
    const onOpenSharedWorld = jest.fn();
    const s = await world('ar', server, { onOpenSharedWorld });
    const copy = introductionSharingCopy('ar');
    expect(s.getByText(copy.successTitle)).toBeTruthy();
    expect(s.getByText(copy.successBody)).toBeTruthy();
    expect(s.queryByTestId('qandeel-introduction-opening')).toBeNull();
    expect(flat(s.getByTestId('qandeel-introduction-success-opening'))).toMatchObject({ borderStartWidth: 2, borderStartColor: P.DARK.standard.selectedMarker });
    server.q.approve.push({ kind: 'CHANGED' });
    await press(s.getByTestId('qandeel-introduction-success-approve'));
    expect(s.getByText(copy.changed)).toBeTruthy();
    await press(s.getByTestId('qandeel-introduction-success-approve'));
    expect(server.calls.approve[1]).toEqual([W, expect.any(String), version, null]);
    expect(s.getByText(copy.successApproved)).toBeTruthy();
    expect(s.getByTestId('qandeel-introduction-success-withdraw')).toBeTruthy();
    await press(s.getByTestId('qandeel-introduction-success-withdraw'));
    expect(server.calls.withdraw).toHaveLength(1);
    server.q.approve.push({ kind: 'COMPLETED' });
    await press(s.getByTestId('qandeel-introduction-success-approve'));
    expect(s.getByText(copy.successCompleted)).toBeTruthy();
    expect(s.queryByTestId('qandeel-introduction-end')).toBeNull();
    await press(s.getByTestId('qandeel-introduction-success-open'));
    expect(onOpenSharedWorld).toHaveBeenCalledWith(W);
  });
});

describe('S6-06 — the status line and resuming (P13, P14b)', () => {
  const surface = async (language: ChromeLanguage, read: IntroductionParticipationRead, resume: IntroductionResumeResult[] = []) => {
    const calls: unknown[][] = [];
    const participation = createParticipationController({
      transport: { participation: async () => read, resume: async (...args) => { calls.push(args); return resume.shift() ?? { kind: 'NOT_AVAILABLE_NOW' }; } },
      isCurrent: () => true, newCommandId: nextId,
    });
    const controller = createIntroductionsController({ transport: { read: async () => ({ kind: 'UNAVAILABLE' }) } as never, isCurrent: () => true });
    const utils = await render(
      <AppearanceProvider authority={appearance('DARK')}>
        <IntroductionsSurface controller={controller} language={language} insets={INSETS} onBack={jest.fn()} participation={participation} />
      </AppearanceProvider>,
    );
    await settle();
    return { ...utils, calls };
  };
  const E = '59999999-9999-4999-8999-999999999999';

  it('paused after an Introduction: the reason, the note, and the one explicit resume — closed today (P14b)', async () => {
    const s = await surface('ar', { kind: 'READY', participation: { state: 'PAUSED', pauseReason: 'POST_INTRODUCTION', expectedEventId: E } });
    const copy = introductionSharingCopy('ar');
    expect(s.getByText(copy.statusTitle)).toBeTruthy();
    expect(s.getByText(copy.pausedPostIntroduction)).toBeTruthy();
    expect(s.getByText(copy.resumeNote)).toBeTruthy();
    await press(s.getByTestId('qandeel-introductions-resume'));
    expect(s.calls).toEqual([[expect.any(String), E, null]]);
    expect(s.getByText(copy.resumeUnavailable)).toBeTruthy();
    expect(s.queryByTestId('qandeel-introductions-resume')).toBeNull();
  });

  it('during an Introduction: no resume; OFF after taking part: turn on (ACTIVATE, manual entry); never took part: nothing', async () => {
    const during = await surface('en', { kind: 'READY', participation: { state: 'PAUSED', pauseReason: 'ACTIVE_INTRODUCTION', expectedEventId: E } });
    expect(during.getByText(introductionSharingCopy('en').pausedActive)).toBeTruthy();
    expect(during.queryByTestId('qandeel-introductions-resume')).toBeNull();
    await cleanup();
    const off = await surface('en', { kind: 'READY', participation: { state: 'OFF', pauseReason: null, expectedEventId: E } }, [{ kind: 'REACTIVATED' }]);
    expect(off.getByText(introductionSharingCopy('en').pausedOff)).toBeTruthy();
    await press(off.getByTestId('qandeel-introductions-resume'));
    expect(off.calls).toEqual([[expect.any(String), E, 'MANUAL_MY_WORLD_ENTRY']]);
    await cleanup();
    const never = await surface('en', { kind: 'READY', participation: { state: 'OFF', pauseReason: null, expectedEventId: null } });
    expect(never.queryByTestId('qandeel-introductions-status')).toBeNull();
    await cleanup();
    const user = await surface('en', { kind: 'READY', participation: { state: 'PAUSED', pauseReason: 'USER_PAUSED', expectedEventId: E } });
    expect(user.queryByTestId('qandeel-introductions-status')).toBeNull();
  });
});

describe('S6-06 — «ما شاركته في التعارف» in Settings (P16)', () => {
  const page = async (language: ChromeLanguage, read: IntroductionSharesRead) => {
    const calls = { del: [] as unknown[][], remove: [] as unknown[][], revoke: [] as unknown[][] };
    const controller = createIntroductionSharesController({
      transport: {
        shares: async () => read,
        removeImage: async (...args) => { calls.remove.push(args); return { kind: 'REMOVED' }; },
        revokeDisplayName: async (...args) => { calls.revoke.push(args); return { kind: 'REVOKED' }; },
      },
      deletion: { deleteMaterial: async (...args) => { calls.del.push(args); return { kind: 'DELETED' }; } },
      isCurrent: () => true, newCommandId: nextId,
    });
    const utils = await render(
      <AppearanceProvider authority={appearance('LIGHT')}>
        <PageHost language={language} controller={controller} />
      </AppearanceProvider>,
    );
    await settle();
    return { ...utils, calls };
  };

  it('every Introduction, after END too: the reader\'s own shares, delete and remove behind their true words, back to the first name in one tap', async () => {
    const V = uuid('55555555');
    const M = uuid('56666666');
    const s = await page('ar', { kind: 'READY', worlds: [{ worldId: W, introductionState: 'ENDED', otherFirstName: 'ريم', shares: [
      { kind: 'TEXT', materialId: M, versionId: V, textType: 'FULL_NAME', fieldKey: null, text: 'سامي فؤاد', displayed: true, establishedAt: AT },
      { kind: 'IMAGE', materialId: uuid('56666666'), versionId: uuid('55555555'), seriesId: S, stage: 1, establishedAt: AT },
      { kind: 'IMAGE', materialId: uuid('56666666'), versionId: uuid('55555555'), seriesId: S, stage: 2, establishedAt: AT },
    ] }] });
    const copy = introductionSharingCopy('ar');
    expect(s.getByText(copy.settingsRow)).toBeTruthy();
    expect(s.getByText(copy.settingsLead)).toBeTruthy();
    expect(s.getByText(fillSharing(copy.settingsWith, { name: 'ريم' }))).toBeTruthy();
    expect(s.getByText(introductionWorldCopy('ar').closedBanner)).toBeTruthy();
    expect(s.getByText(copy.displayGranted)).toBeTruthy();
    expect(s.getAllByTestId('qandeel-introduction-shares-photo')).toHaveLength(1);
    expect(s.getByText(copy.stageMedium)).toBeTruthy();
    await press(s.getByTestId('qandeel-introduction-shares-revoke'));
    expect(s.calls.revoke).toEqual([[W, expect.any(String)]]);
    await press(s.getByTestId('qandeel-introduction-shares-delete'));
    expect(s.getByText(fillSharing(copy.deleteConfirm, { name: 'ريم' }))).toBeTruthy();
    await press(s.getByTestId('qandeel-introduction-shares-delete-confirmation-confirm'));
    expect(s.calls.del).toEqual([[W, M, expect.any(String)]]);
    await press(s.getByTestId('qandeel-introduction-shares-remove'));
    expect(s.getByText(fillSharing(copy.removeConfirm, { name: 'ريم' }))).toBeTruthy();
    await press(s.getByTestId('qandeel-introduction-shares-remove-confirmation-confirm'));
    expect(s.calls.remove).toEqual([[W, expect.any(String), S]]);
  });

  it('P16c: nothing shared in any Introduction', async () => {
    const s = await page('en', { kind: 'READY', worlds: [] });
    expect(s.getByTestId('qandeel-introduction-shares-empty').props.children).toBe(introductionSharingCopy('en').settingsEmpty);
  });
});

function PageHost({ language, controller }: { readonly language: ChromeLanguage; readonly controller: ReturnType<typeof createIntroductionSharesController> }) {
  // The page as Settings draws it, on the reader's palette.
  const palette = usePalette();
  return <IntroductionSharesPage controller={controller} language={language} palette={palette} />;
}
