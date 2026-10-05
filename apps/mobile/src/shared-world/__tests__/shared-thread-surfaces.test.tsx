/**
 * S4-02 — the Shared conversation surfaces in Arabic and English, Dark and Light: who said what is unambiguous and comes
 * from the server; QANDEEL is never a chat bubble; the input exists only while sending is open and has no voice control;
 * only the reader's own words offer Delete, behind a confirmation; the words stay until the server confirms them.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore, type AppearancePreference } from '../../appearance';
import { conversationCopy } from '../../conversation';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { SharedEntryResult, SharedMaterial, SharedMaterialsResult, SharedSendResult } from '../../runtime-entry';
import { SharedWorldArea } from '../SharedWorldArea';
import { sharedCopy } from '../copy';
import { SHARED_CONVERSATION_COPY_GATE, sharedConversationCopy } from '../conversation-copy';
import { createSharedWorldController, type SharedWorldTransport } from '../shared-world-controller';

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const WORLD = '33333333-3333-4333-8333-333333333333';
const MINE = '66666666-6666-4666-8666-666666666661';
const THEIRS = '66666666-6666-4666-8666-666666666662';
const QANDEEL = '66666666-6666-4666-8666-666666666663';
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const settle = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });

function appearance(preference: AppearancePreference) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: preference }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

const MATERIALS: SharedMaterial[] = [
  { materialId: THEIRS, producer: 'HUMAN', authorName: 'Bassem Fixture', text: 'Q3 numbers لسه ما وصلتش', establishedAt: '2026-10-05T10:00:00Z', canDelete: false },
  { materialId: MINE, producer: 'SELF', authorName: null, text: 'Fixture words of mine', establishedAt: '2026-10-05T10:01:00Z', canDelete: true },
  { materialId: QANDEEL, producer: 'QANDEEL', authorName: null, text: 'Fixture reply', establishedAt: '2026-10-05T10:02:00Z', canDelete: false },
];
const ALLOW: SharedEntryResult = { kind: 'ALLOW', world: { worldId: WORLD, bornAt: '2026-10-05T00:00:00Z', members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] } };

const OLDER: SharedMaterial = { materialId: '66666666-6666-4666-8666-666666666600', producer: 'HUMAN', authorName: 'Bassem Fixture', text: 'Fixture older words', establishedAt: '2026-10-05T09:00:00Z', canDelete: false };

function world(options: { conversation?: boolean; send?: () => Promise<SharedSendResult>; older?: boolean } = {}) {
  const read = jest.fn(async (_worldId: string, before?: unknown): Promise<SharedMaterialsResult> => (before
    ? { kind: 'READ', conversation: options.conversation ?? true, materials: [OLDER], hasOlder: false }
    : { kind: 'READ', conversation: options.conversation ?? true, materials: MATERIALS, hasOlder: options.older ?? false }));
  const transport: SharedWorldTransport = {
    root: async () => ({ kind: 'READ', root: { capabilities: { invitation: true, birth: true }, worlds: [], invitations: [] } }),
    invite: async () => ({ kind: 'SUBMITTED' }),
    accept: async () => ({ kind: 'NOT_ACCEPTABLE' }),
    decline: async () => ({ kind: 'DECLINED' }),
    entry: async () => ALLOW,
    materials: read,
    send: jest.fn(options.send ?? (async (): Promise<SharedSendResult> => ({ kind: 'COMMITTED', materialId: MINE, qandeel: 'COMMITTED' }))),
    deleteMaterial: jest.fn(async () => ({ kind: 'DELETED' as const })),
  };
  return { controller: createSharedWorldController({ transport, isCurrent: () => true }), transport, read };
}

async function openWorld(language: ChromeLanguage, preference: AppearancePreference, w: ReturnType<typeof world>) {
  const view = await render(
    <AppearanceProvider authority={appearance(preference)}>
      <SharedWorldArea controller={w.controller} language={language} insets={INSETS} />
    </AppearanceProvider>,
  );
  await settle();
  await act(async () => w.controller.openWorld(WORLD));
  await settle();
  return view;
}

describe.each([['ar', 'DARK'], ['en', 'LIGHT']] as const)('S4-02 Shared conversation — %s, %s', (language: ChromeLanguage, preference: 'DARK' | 'LIGHT') => {
  const copy = sharedConversationCopy(language);
  const palette = P[preference].standard;

  it('attributes every material from server truth: the reader on their own edge, another person by Name, QANDEEL open', async () => {
    const view = await openWorld(language, preference, world());
    const self = view.getByTestId(`qandeel-shared-material-self-${MINE}`);
    const other = view.getByTestId(`qandeel-shared-material-human-${THEIRS}`);
    const qandeel = view.getByTestId(`qandeel-shared-material-qandeel-${QANDEEL}`);
    expect(self.props.accessibilityLabel).toBe(copy.selfTurnName('Fixture words of mine'));
    expect(other.props.accessibilityLabel).toBe(copy.otherTurnName('Bassem Fixture', 'Q3 numbers لسه ما وصلتش'));
    expect(qandeel.props.accessibilityLabel).toBe(copy.qandeelTurnName('Fixture reply'));
    expect(within(other).getByText('Bassem Fixture')).toBeTruthy();
    expect(within(qandeel).getByText(copy.qandeel)).toBeTruthy();
    // QANDEEL has no surface of its own: no slab colour anywhere inside its line.
    expect(flat(qandeel).backgroundColor).toBeUndefined();
    expect(flat(qandeel).borderRadius).toBeUndefined();
    // Humans speak on a slab; the reader on the start edge, everyone else on the end edge.
    expect(flat(view.getByTestId(`qandeel-shared-material-human-${THEIRS}`)).alignSelf).toBe('flex-end');
    // A mixed paragraph takes its direction from its words (majority Arabic), not from the reader's language.
    expect(flat(within(other).getByText(/Q3 numbers/u)).writingDirection).toBe('rtl');
  });

  it('draws the input only while sending is open, with no voice or microphone control of any kind', async () => {
    const open = await openWorld(language, preference, world());
    expect(open.getByTestId('qandeel-shared-input').props.accessibilityLabel).toBe(copy.composerName);
    expect(open.getByTestId('qandeel-shared-input').props.placeholder).toBe(conversationCopy(language).composerPlaceholder);
    expect(open.queryAllByTestId(/mic|voice|record|audio|call/iu)).toHaveLength(0);
    await cleanup();
    const closed = await openWorld(language, preference, world({ conversation: false }));
    expect(closed.queryByTestId('qandeel-shared-input')).toBeNull();
    expect(closed.getByText(copy.conversationNotOpen)).toBeTruthy();
    expect(closed.getByTestId(`qandeel-shared-material-human-${THEIRS}`)).toBeTruthy();
  });

  it('keeps the words until the server confirms them, and clears them only then', async () => {
    let answer: SharedSendResult = { kind: 'UNAVAILABLE' };
    const w = world({ send: async () => answer });
    const view = await openWorld(language, preference, w);
    await fireEvent.changeText(view.getByTestId('qandeel-shared-input'), 'كلمة جديدة');
    await fireEvent.press(view.getByTestId('qandeel-shared-send'));
    await settle();
    expect(view.getByTestId('qandeel-shared-input').props.value).toBe('كلمة جديدة');
    expect(view.getByText(copy.sendUnconfirmed)).toBeTruthy();
    answer = { kind: 'COMMITTED', materialId: MINE, qandeel: 'COMMITTED' };
    await fireEvent.press(view.getByTestId('qandeel-shared-send'));
    await settle();
    expect(view.getByTestId('qandeel-shared-input').props.value).toBe('');
    const sendCalls = (w.transport.send as jest.Mock).mock.calls;
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[0][1]).toBe(sendCalls[1][1]);
  });

  it('only the reader\'s own words offer Delete, behind a confirmation that says what deletion does', async () => {
    const w = world();
    const view = await openWorld(language, preference, w);
    await fireEvent.press(view.getByTestId(`qandeel-shared-material-human-${THEIRS}`));
    expect(view.queryByTestId('qandeel-shared-delete')).toBeNull();
    await fireEvent.press(view.getByTestId(`qandeel-shared-material-self-${MINE}`));
    await fireEvent.press(view.getByTestId('qandeel-shared-delete'));
    expect(view.getByText(copy.deleteExplanation)).toBeTruthy();
    expect(flat(view.getByTestId('qandeel-shared-delete-confirm-action')).minHeight).toBeGreaterThanOrEqual(44);
    expect(w.transport.deleteMaterial).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('qandeel-shared-delete-confirm-action'));
    await settle();
    expect(w.transport.deleteMaterial).toHaveBeenCalledTimes(1);
    expect(view.getByText(copy.deleted)).toBeTruthy();
  });

  it('offers no older-history control when nothing older exists', async () => {
    const view = await openWorld(language, preference, world());
    expect(view.queryByTestId('qandeel-shared-older')).toBeNull();
  });

  it('offers older history only when it exists, and reads exactly one older page on request', async () => {
    const w = world({ older: true });
    const view = await openWorld(language, preference, w);
    const control = view.getByTestId('qandeel-shared-older');
    expect(control.props.accessibilityLabel).toBe(copy.olderMessages);
    expect(view.getByText(copy.olderMessages)).toBeTruthy();
    await fireEvent.press(control);
    await settle();
    expect(w.read).toHaveBeenLastCalledWith(WORLD, { materialId: MATERIALS[0].materialId, establishedAt: MATERIALS[0].establishedAt });
    expect(view.getByTestId(`qandeel-shared-material-human-${OLDER.materialId}`)).toBeTruthy();
    // Nothing older remains: the control goes away.
    expect(view.queryByTestId('qandeel-shared-older')).toBeNull();
  });

  it('the explicit refresh re-reads the server\'s truth', async () => {
    const w = world();
    const view = await openWorld(language, preference, w);
    const before = w.read.mock.calls.length;
    await fireEvent.press(view.getByTestId('qandeel-shared-refresh'));
    await settle();
    expect(w.read.mock.calls.length).toBe(before + 1);
    expect(view.getByTestId('qandeel-shared-refresh').props.accessibilityLabel).toBe(copy.refresh);
    expect(palette.world).toBeTruthy();
  });
});

describe('S4-02 copy', () => {
  it('reuses approved rows rather than copying them, and carries the Product Owner\'s final words for every S4-02 row', () => {
    for (const language of ['ar', 'en'] as const) {
      const copy = sharedConversationCopy(language);
      const w1a = conversationCopy(language);
      const s401 = sharedCopy(language);
      expect(copy.qandeel).toBe(s401.personalWorld);
      expect([copy.composerPlaceholder, copy.send, copy.waitingForReply, copy.sendUnconfirmed, copy.sendRefused, copy.replyFailed, copy.loadFailed])
        .toEqual([w1a.composerPlaceholder, w1a.sendName, w1a.waitingForReply, w1a.sendUnconfirmed, w1a.sendRefused, w1a.replyFailed, w1a.historyUnavailable]);
      expect([copy.cancel, copy.retry, copy.deleteFailed, copy.someone]).toEqual([s401.cancel, s401.retry, s401.actionUnavailable, s401.someone]);
      for (const row of SHARED_CONVERSATION_COPY_GATE.approved) expect((copy as unknown as Record<string, string>)[row].length).toBeGreaterThan(0);
    }
    expect(SHARED_CONVERSATION_COPY_GATE.status).toMatch(/CLOSED/u);
    expect('proposed' in SHARED_CONVERSATION_COPY_GATE).toBe(false);
    // The exact words the Product Owner approved (S4-02 Product Copy Gate, 2026-10-05).
    const ar = sharedConversationCopy('ar');
    const en = sharedConversationCopy('en');
    expect([ar.composerName, ar.delete, ar.deleteExplanation, ar.deleteConfirm, ar.deleted, ar.refresh, ar.conversationNotOpen, ar.olderMessages]).toEqual([
      'رسالتك في هذا العالم المشترك', 'حذف', 'سيختفي هذا الكلام من هذا العالم المشترك عند الجميع، ولن يستخدمه قنديل بعد ذلك.', 'حذف عند الجميع',
      'تم الحذف.', 'تحديث', 'المحادثة غير متاحة الآن في هذا العالم المشترك.', 'عرض رسائل أقدم',
    ]);
    expect([en.composerName, en.delete, en.deleteExplanation, en.deleteConfirm, en.deleted, en.refresh, en.conversationNotOpen, en.olderMessages]).toEqual([
      'Your message in this Shared World', 'Delete', "This message will disappear from this Shared World for everyone, and QANDEEL won't use it again.",
      'Delete for everyone', 'Deleted.', 'Refresh', "Conversation isn't available in this Shared World right now.", 'Show older messages',
    ]);
  });
});
