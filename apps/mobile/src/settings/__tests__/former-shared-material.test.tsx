/**
 * S4-03 (E2E-G-18) — General Settings → «الخصوصية والبيانات» / Privacy & Data → the reader's own words in Shared Worlds
 * they no longer belong to, in Arabic and English. The controller is REAL over a scripted transport answering exactly what
 * migration 0140 (the read) and 0139 (the owner deletion) answer. Only the reader's own words are shown — no Name, member,
 * World label or count — and deleting reopens nothing. A history package that still needs the reader's approval of their
 * OWN earlier words (material authority survives membership) is approved here: exactly those words, no grantee.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { PrivacyStateView, SharedOwnMaterial } from '../../runtime-entry';
import { sharedLifecycleCopy } from '../../shared-world';
import { SettingsSurface, createFormerSharedMaterialController, createPrivacyDataController, type FormerSharedMaterialTransport, type PrivacyDataTransport } from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const flush = () => act(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});
const NONE: PrivacyStateView = { export: { status: 'NONE', availableUntil: null }, deletion: { status: 'NONE', finalAt: null } };
const WORLD = '33333333-3333-4333-8333-333333333333';
const OWN: SharedOwnMaterial[] = [
  { materialId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', worldId: WORLD, text: 'Fixture words I left behind', establishedAt: '2026-10-05T10:00:00Z' },
  { materialId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', worldId: WORLD, text: 'Fixture older words of mine', establishedAt: '2026-10-04T10:00:00Z' },
];

const PACKAGE = '99999999-9999-4999-8999-999999999999';
const ASKED = { packageId: PACKAGE, worldId: WORLD, approvedBySelf: false, items: [{ materialId: OWN[1].materialId, text: OWN[1].text, establishedAt: OWN[1].establishedAt }] };

function server(answers: { delete?: ('DELETED' | 'NOT_DELETABLE' | 'UNAVAILABLE')[]; approve?: ('APPROVED' | 'GRANTED' | 'STALE' | 'REFUSED' | 'UNAVAILABLE')[] } = {}) {
  let held = [...OWN];
  let asked = [ASKED];
  const transport: FormerSharedMaterialTransport & { deleteOwnMaterial: jest.Mock; ownMaterial: jest.Mock; approveFormerHistoryShare: jest.Mock } = {
    formerHistoryRequests: jest.fn(async () => ({ kind: 'READ' as const, requests: asked })),
    approveFormerHistoryShare: jest.fn(async () => {
      const kind = answers.approve?.shift() ?? 'GRANTED';
      if (kind === 'GRANTED') asked = [];
      return { kind };
    }),
    ownMaterial: jest.fn(async () => ({ kind: 'READ' as const, materials: held, hasOlder: false })),
    deleteOwnMaterial: jest.fn(async (_worldId: string, materialId: string) => {
      const kind = answers.delete?.shift() ?? 'DELETED';
      if (kind === 'DELETED') held = held.filter((m) => m.materialId !== materialId);
      return { kind };
    }),
  };
  return transport;
}

describe('S4-03 former-member own material — the controller', () => {
  it('reads nothing until the page opens, then only the reader\'s own words', async () => {
    const transport = server();
    const controller = createFormerSharedMaterialController({ transport, isCurrent: () => true });
    expect(transport.ownMaterial).not.toHaveBeenCalled();
    controller.open();
    await flush();
    expect(controller.getState()).toMatchObject({ status: 'READY', materials: OWN, hasOlder: false });
  });

  it('approves the reader\'s own words in a World they left: ONE command per package until answered, nothing else read', async () => {
    const transport = server({ approve: ['UNAVAILABLE', 'GRANTED'] });
    let n = 0;
    const controller = createFormerSharedMaterialController({ transport, isCurrent: () => true, newCommandId: () => `approval-${++n}` });
    controller.open();
    await flush();
    expect(controller.getState().requests).toEqual([ASKED]);
    await controller.approveRequest(PACKAGE);
    expect(controller.getState().notice).toBe('APPROVE_FAILED');
    await controller.approveRequest(PACKAGE);
    expect(transport.approveFormerHistoryShare.mock.calls).toEqual([[WORLD, PACKAGE, 'approval-1'], [WORLD, PACKAGE, 'approval-1']]);
    expect(controller.getState()).toMatchObject({ notice: 'GRANTED', requests: [] });
  });

  it('deletes through the owner authority with ONE command per material until answered, then re-reads', async () => {
    const transport = server({ delete: ['UNAVAILABLE', 'DELETED'] });
    let n = 0;
    const controller = createFormerSharedMaterialController({ transport, isCurrent: () => true, newCommandId: () => `command-${++n}` });
    controller.open();
    await flush();
    await controller.deleteMaterial(OWN[0].materialId);
    expect(controller.getState().notice).toBe('DELETE_FAILED');
    await controller.deleteMaterial(OWN[0].materialId);
    expect(transport.deleteOwnMaterial.mock.calls).toEqual([[WORLD, OWN[0].materialId, 'command-1'], [WORLD, OWN[0].materialId, 'command-1']]);
    expect(controller.getState()).toMatchObject({ notice: 'DELETED', materials: [OWN[1]] });
  });
});

describe.each([['ar'], ['en']] as const)('S4-03 former-member own material — Privacy & Data in %s', (language: ChromeLanguage) => {
  const copy = sharedLifecycleCopy(language);

  async function settings(transport = server()) {
    const authority = createAppearanceAuthority({
      store: createEphemeralAppearancePreferenceStore({}),
      system: { current: () => 'DARK', subscribe: () => () => undefined },
      native: { apply: () => undefined },
    });
    authority.bindAccount('reader');
    const privacyTransport: PrivacyDataTransport = {
      readPrivacyState: jest.fn(async () => ({ kind: 'READ' as const, view: NONE })),
      requestDataExport: jest.fn(), downloadDataExport: jest.fn(), requestAccountDeletion: jest.fn(), cancelAccountDeletion: jest.fn(),
    };
    const privacy = createPrivacyDataController({ transport: privacyTransport, isCurrent: () => true, setTimer: () => null, clearTimer: () => undefined });
    const formerShared = createFormerSharedMaterialController({ transport, isCurrent: () => true });
    const view: RenderResult = await render(
      <AppearanceProvider authority={authority}>
        <SettingsSurface language={language} insets={INSETS} onBack={jest.fn()} onSignOut={jest.fn(async () => undefined)} privacy={privacy} formerShared={formerShared} />
      </AppearanceProvider>,
    );
    await flush();
    return { view, transport };
  }

  it('one row inside Privacy & Data; nothing is read before it is opened', async () => {
    const { view, transport } = await settings();
    const group = view.getByTestId('qandeel-settings-group-privacy');
    expect(within(group).getByTestId('qandeel-former-shared-material-row').props.accessibilityLabel).toBe(copy.formerRow);
    expect(transport.ownMaterial).not.toHaveBeenCalled();
  });

  it('the page shows only the reader\'s own words, and deletion states its consequence first', async () => {
    const { view, transport } = await settings();
    await fireEvent.press(view.getByTestId('qandeel-former-shared-material-row'));
    await flush();
    const page = view.getByTestId('qandeel-former-shared-material');
    expect(within(page).getByText(copy.formerExplain)).toBeTruthy();
    expect(within(page).getAllByTestId('qandeel-former-shared-material-item')).toHaveLength(2);
    expect(within(page).getByText(/Fixture words I left behind/u)).toBeTruthy();
    // No World label, member or Name appears: only the reader's own words and their day.
    expect(within(page).queryByText(/Fixture peer|Bassem|Shared World members/u)).toBeNull();
    await fireEvent.press(within(page).getAllByTestId('qandeel-former-shared-material-delete')[0]);
    expect(within(page).getByTestId('qandeel-former-shared-material-confirm')).toBeTruthy();
    expect(within(page).getByText(copy.deleteExplanation)).toBeTruthy();
    expect(transport.deleteOwnMaterial).not.toHaveBeenCalled();
    await fireEvent.press(within(page).getByTestId('qandeel-former-shared-material-delete-action'));
    await flush();
    expect(transport.deleteOwnMaterial).toHaveBeenCalledWith(WORLD, OWN[0].materialId, expect.any(String));
    expect(view.getAllByTestId('qandeel-former-shared-material-item')).toHaveLength(1);
    expect(view.getByText(copy.deleted)).toBeTruthy();
  });

  it("a request to share the reader's own earlier words: exactly those words, no grantee; approving brings them back into nothing", async () => {
    const { view, transport } = await settings();
    await fireEvent.press(view.getByTestId('qandeel-former-shared-material-row'));
    await flush();
    const request = view.getByTestId('qandeel-former-shared-request');
    expect(within(request).getByText(copy.formerShareRequest)).toBeTruthy();
    expect(within(request).getByText(OWN[1].text)).toBeTruthy();
    expect(within(request).queryByText(/Fixture words I left behind|Rana|Bassem/u)).toBeNull();
    await fireEvent.press(within(request).getByTestId('qandeel-former-shared-request-approve'));
    await flush();
    expect(transport.approveFormerHistoryShare).toHaveBeenCalledWith(WORLD, PACKAGE, expect.any(String));
    expect(view.getByText(copy.granted)).toBeTruthy();
    expect(view.queryByTestId('qandeel-former-shared-request')).toBeNull();
  });

  it('with nothing left, the page says so', async () => {
    const empty: FormerSharedMaterialTransport = { ownMaterial: jest.fn(async () => ({ kind: 'READ' as const, materials: [], hasOlder: false })), deleteOwnMaterial: jest.fn(),
      formerHistoryRequests: jest.fn(async () => ({ kind: 'READ' as const, requests: [] })), approveFormerHistoryShare: jest.fn() };
    const { view } = await settings(empty as never);
    await fireEvent.press(view.getByTestId('qandeel-former-shared-material-row'));
    await flush();
    expect(view.getByTestId('qandeel-former-shared-material-empty').props.children).toBe(copy.formerEmpty);
  });
});
