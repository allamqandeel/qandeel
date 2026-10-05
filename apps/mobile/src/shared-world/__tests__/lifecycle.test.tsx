/**
 * S4-03 — the Shared lifecycle on the mobile client: Manage World (inside the exact World, authority-first), leave (back to
 * the root at once, nothing of the World kept), proposals and approvals (one command per logical act; a lost answer is
 * retried as the same act), adding a member by Shared ID (one answer that names nobody) and the target's own acceptance,
 * the proposer and the neutral progress (never who approved), sharing earlier messages (the exact preview before the
 * proposal; older candidates one bounded page at a time), the ended World (read-only,
 * by entitlement: no input, no Manage World), the committed name as the World label, and the words — all from the one
 * S4-03 copy module, in Arabic and English.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { SharedClosedWorldResult, SharedEntryResult, SharedManage, SharedManageResult, SharedRootResult } from '../../runtime-entry';
import { SharedWorldArea } from '../SharedWorldArea';
import { fill, sharedCopy } from '../copy';
import { SHARED_LIFECYCLE_COPY_GATE, sharedLifecycleCopy } from '../lifecycle-copy';
import { createSharedWorldController, type SharedWorldTransport } from '../shared-world-controller';

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const WORLD = '33333333-3333-4333-8333-333333333333';
const ENDED = '66666666-6666-4666-8666-666666666666';
const PROPOSAL = '88888888-8888-4888-8888-888888888888';
const PACKAGE = '99999999-9999-4999-8999-999999999999';
const HANDLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SELF_HANDLE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MATERIAL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OLDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REQUEST = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const JOINABLE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const ADD = '12121212-1212-4121-8121-121212121212';
const flush = () => act(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

const ROOT: SharedRootResult = {
  kind: 'READ',
  root: {
    capabilities: { invitation: true, birth: true },
    worlds: [{ worldId: WORLD, name: 'Our Lantern', members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] }],
    invitations: [],
    closedWorlds: [{ worldId: ENDED, name: null, members: [{ name: 'Amal Fixture', self: true }, { name: 'Chadi Fixture', self: false }] }],
    memberRequests: [{ requestId: REQUEST, worldId: JOINABLE, kind: 'ADD', proposerName: 'Dalia Fixture' }],
  },
};
const ALLOW: SharedEntryResult = { kind: 'ALLOW', world: { worldId: WORLD, bornAt: '2026-10-05T00:00:00Z', name: 'Our Lantern', members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] } };
const MANAGE: SharedManage = {
  capabilities: { governance: true, history: true },
  settings: { name: 'Our Lantern', description: null, topic: 'Weekend plans' },
  members: [{ handle: SELF_HANDLE, name: 'Amal Fixture', self: true }, { handle: HANDLE, name: 'Bassem Fixture', self: false }],
  proposals: [
    { proposalId: PROPOSAL, kind: 'SETTINGS', proposer: { name: 'Bassem Fixture', self: false }, targetName: null,
      settings: { name: 'New name', description: null, topic: null }, approvedBySelf: false, progress: { approved: 1, required: 2 } },
    { proposalId: ADD, kind: 'ADD', proposer: { name: null, self: true }, targetName: null, settings: null, approvedBySelf: true, progress: { approved: 1, required: 2 } },
  ],
  historyRequests: [{ packageId: PACKAGE, granteeName: 'Rana Fixture', approvedBySelf: false, items: [{ materialId: MATERIAL, text: 'Fixture earlier words of mine', establishedAt: '2026-10-05T10:00:00Z' }] }],
};
const CLOSED: SharedClosedWorldResult = {
  kind: 'READ',
  world: { worldId: ENDED, name: null, members: [{ name: 'Amal Fixture', self: true }, { name: 'Chadi Fixture', self: false }], hasOlder: false,
    materials: [{ materialId: MATERIAL, producer: 'HUMAN', authorName: 'Chadi Fixture', text: 'Fixture words kept after the end', establishedAt: '2026-10-05T10:00:00Z', canDelete: false }] },
};

function transport(overrides: Partial<SharedWorldTransport> = {}): SharedWorldTransport & { calls: { name: string; args: unknown[] }[] } {
  const calls: { name: string; args: unknown[] }[] = [];
  const log = <T,>(name: string, answer: T) => jest.fn(async (...args: unknown[]) => { calls.push({ name, args }); return answer; });
  return {
    calls,
    root: log('root', ROOT),
    invite: log('invite', { kind: 'SUBMITTED' as const }),
    accept: log('accept', { kind: 'NOT_ACCEPTABLE' as const }),
    decline: log('decline', { kind: 'DECLINED' as const }),
    entry: log('entry', ALLOW),
    materials: log('materials', { kind: 'READ' as const, conversation: true, materials: [], hasOlder: false }),
    send: log('send', { kind: 'NOT_AVAILABLE' as const }),
    deleteMaterial: log('deleteMaterial', { kind: 'NOT_DELETABLE' as const }),
    manage: log<SharedManageResult>('manage', { kind: 'READ', manage: MANAGE }),
    leave: log('leave', { kind: 'LEFT' as const }),
    proposeSettings: log('proposeSettings', { kind: 'PROPOSED' as const }),
    proposeRemoval: log('proposeRemoval', { kind: 'PROPOSED' as const }),
    proposeEnd: log('proposeEnd', { kind: 'PROPOSED' as const }),
    approve: log('approve', { kind: 'APPROVED' as const }),
    historyCandidates: log('historyCandidates', { kind: 'READ' as const, hasOlder: false, candidates: [
      { materialId: MATERIAL, self: true, authorName: null, text: 'Fixture words before Bassem joined', establishedAt: '2026-10-05T09:00:00Z' }] }),
    proposeMember: log('proposeMember', { kind: 'SUBMITTED' as const }),
    acceptMembershipRequest: log('acceptMembershipRequest', { kind: 'JOINED' as const }),
    proposeHistoryShare: log('proposeHistoryShare', { kind: 'PROPOSED' as const }),
    approveHistoryShare: log('approveHistoryShare', { kind: 'GRANTED' as const }),
    closedWorld: log('closedWorld', CLOSED),
    ...overrides,
  } as SharedWorldTransport & { calls: { name: string; args: unknown[] }[] };
}

async function managed(t = transport()) {
  let n = 0;
  const controller = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => `command-${++n}` });
  controller.openWorld(WORLD);
  await flush();
  controller.openManage();
  await flush();
  return controller;
}

describe('S4-03 lifecycle — the controller', () => {
  it('opens Manage World only inside an ALLOWed World, and reads it through the server\'s verdict', async () => {
    const t = transport({ entry: jest.fn(async () => ({ kind: 'DENIED' as const })) });
    const controller = createSharedWorldController({ transport: t, isCurrent: () => true });
    controller.openWorld(WORLD);
    await flush();
    controller.openManage();
    await flush();
    expect(controller.getState().place).toEqual({ kind: 'WORLD', worldId: WORLD });
    expect(t.manage).not.toHaveBeenCalled();
    const ok = await managed();
    expect(ok.getState().place).toEqual({ kind: 'MANAGE', worldId: WORLD });
    expect(ok.getState().manage).toMatchObject({ worldId: WORLD, status: 'READY', data: MANAGE });
    expect(ok.getState().thread.worldId).toBeNull();
  });

  it('a Manage World read the server denies (left, removed, ended) returns to the root with nothing of the World kept', async () => {
    const t = transport({ manage: jest.fn(async () => ({ kind: 'DENIED' as const })) });
    const controller = await managed(t);
    expect(controller.getState().place).toEqual({ kind: 'ROOT' });
    expect(controller.getState().manage.data).toBeNull();
    expect(controller.getState().entry).toEqual({ status: 'NONE', world: null });
  });

  it('leave: LEFT returns to the root at once with the reader\'s notice; a lost answer retries the SAME command', async () => {
    let answers = [{ kind: 'UNAVAILABLE' as const }, { kind: 'LEFT' as const }];
    const leave = jest.fn(async () => answers.shift() ?? { kind: 'LEFT' as const });
    const t = transport({ leave });
    const controller = await managed(t);
    expect(await controller.leaveWorld()).toBe('UNAVAILABLE');
    expect(controller.getState().place).toEqual({ kind: 'MANAGE', worldId: WORLD });
    expect(controller.getState().manage.notice).toBe('UNAVAILABLE');
    expect(await controller.leaveWorld()).toBe('LEFT');
    expect(leave.mock.calls.map((c) => (c as unknown[])[1])).toEqual(['command-1', 'command-1']);
    expect(leave.mock.calls.every((c) => (c as unknown[])[0] === WORLD)).toBe(true);
    expect(controller.getState()).toMatchObject({ place: { kind: 'ROOT' }, notice: 'LEFT', entry: { status: 'NONE', world: null } });
    expect(controller.getState().thread.worldId).toBeNull();
    answers = [];
  });

  it('a refused leave stays where it is and says so', async () => {
    const controller = await managed(transport({ leave: jest.fn(async () => ({ kind: 'REFUSED' as const })) }));
    expect(await controller.leaveWorld()).toBe('REFUSED');
    expect(controller.getState().place.kind).toBe('MANAGE');
    expect(controller.getState().manage.notice).toBe('REFUSED');
  });

  it('a proposal and an approval: one command per logical act, the truth re-read after each answer', async () => {
    const t = transport({ approve: jest.fn(async () => ({ kind: 'COMMITTED' as const })) });
    const controller = await managed(t);
    expect(await controller.proposeSettings({ name: 'New name', description: '', topic: '' })).toBe('PROPOSED');
    expect(controller.getState().manage.notice).toBe('PROPOSED');
    expect(await controller.approve(PROPOSAL)).toBe('COMMITTED');
    expect(controller.getState().manage.notice).toBe('COMMITTED');
    expect(t.calls.filter((c) => c.name === 'manage')).toHaveLength(3);
    expect(t.proposeSettings).toHaveBeenCalledWith(WORLD, 'command-1', { name: 'New name', description: '', topic: '' });
    expect(t.approve).toHaveBeenCalledWith(WORLD, PROPOSAL, 'command-2');
    // Proposing again (a new act) mints a new command: answered acts never reuse one.
    await controller.proposeRemoval(HANDLE);
    expect(t.proposeRemoval).toHaveBeenCalledWith(WORLD, 'command-3', HANDLE);
  });

  it('a stale approval is told as stale, never as success', async () => {
    const controller = await managed(transport({ approve: jest.fn(async () => ({ kind: 'STALE' as const })) }));
    expect(await controller.approve(PROPOSAL)).toBe('STALE');
    expect(controller.getState().manage.notice).toBe('STALE');
  });

  it('sharing earlier messages: candidates for one member, then one exact package, approval granting it', async () => {
    const t = transport();
    const controller = await managed(t);
    controller.loadHistoryCandidates(HANDLE);
    await flush();
    expect(controller.getState().manage.candidates).toMatchObject({ memberHandle: HANDLE, status: 'READY' });
    expect(await controller.proposeHistoryShare(HANDLE, [MATERIAL])).toBe('PROPOSED');
    expect(t.proposeHistoryShare).toHaveBeenCalledWith(WORLD, 'command-1', HANDLE, [MATERIAL]);
    expect(controller.getState().manage.candidates).toBeNull();
    expect(await controller.approveHistoryShare(PACKAGE)).toBe('GRANTED');
    expect(controller.getState().manage.notice).toBe('GRANTED');
  });

  it('adding a member by Shared ID: one command per typed ID, one answer that names nobody; INVITED once everyone approved', async () => {
    let answers = [{ kind: 'UNAVAILABLE' as const }, { kind: 'SUBMITTED' as const }];
    const proposeMember = jest.fn(async () => answers.shift() ?? { kind: 'SUBMITTED' as const });
    const t = transport({ proposeMember, approve: jest.fn(async () => ({ kind: 'INVITED' as const })) });
    const controller = await managed(t);
    expect(await controller.proposeMember(' k7qm-4xwd-p9tr ')).toBe('UNAVAILABLE');
    expect(await controller.proposeMember('k7qm-4xwd-p9tr')).toBe('SUBMITTED');
    expect(proposeMember.mock.calls.map((c) => (c as unknown[]).slice(1))).toEqual([['command-1', 'k7qm-4xwd-p9tr'], ['command-1', 'k7qm-4xwd-p9tr']]);
    expect(controller.getState().manage.notice).toBe('MEMBER_SUBMITTED');
    expect(await controller.approve(ADD)).toBe('INVITED');
    expect(controller.getState().manage.notice).toBe('INVITED');
    answers = [];
    const invalid = await managed(transport({ proposeMember: jest.fn(async () => ({ kind: 'INVALID_SHARED_ID' as const })) }));
    expect(await invalid.proposeMember('nope')).toBe('INVALID_SHARED_ID');
    expect(invalid.getState().manage.notice).toBe('INVALID_SHARED_ID');
  });

  it('the target accepts from the root (one command until answered); JOINED enters the World authority-first', async () => {
    let answers = [{ kind: 'UNAVAILABLE' as const }, { kind: 'JOINED' as const }];
    const acceptMembershipRequest = jest.fn(async () => answers.shift() ?? { kind: 'JOINED' as const });
    const t = transport({ acceptMembershipRequest });
    const controller = createSharedWorldController({ transport: t, isCurrent: () => true, newCommandId: () => 'join-command' });
    controller.enter();
    await flush();
    await controller.acceptMembershipRequest(REQUEST);
    expect(controller.getState().notice).toBe('ACTION_UNAVAILABLE');
    await controller.acceptMembershipRequest(REQUEST);
    await flush();
    expect(acceptMembershipRequest.mock.calls).toEqual([[JOINABLE, REQUEST, 'join-command'], [JOINABLE, REQUEST, 'join-command']]);
    expect(t.entry).toHaveBeenCalledWith(JOINABLE);
    expect(controller.getState().place).toEqual({ kind: 'WORLD', worldId: JOINABLE });
    answers = [];
    await controller.acceptMembershipRequest('not-a-request');
    expect(acceptMembershipRequest).toHaveBeenCalledTimes(2);
  });

  it('earlier words are offered one bounded page at a time: the next page continues beneath, never a ceiling', async () => {
    const page = (materialId: string, hasOlder: boolean) => ({ kind: 'READ' as const, hasOlder,
      candidates: [{ materialId, self: false, authorName: 'Bassem Fixture', text: materialId, establishedAt: '2026-10-05T09:00:00Z' }] });
    const historyCandidates = jest.fn(async (_w: string, _h: string, before?: unknown) => (before ? page(OLDER, false) : page(MATERIAL, true)));
    const controller = await managed(transport({ historyCandidates }));
    controller.loadHistoryCandidates(HANDLE);
    await flush();
    expect(controller.getState().manage.candidates).toMatchObject({ status: 'READY', hasOlder: true });
    controller.loadOlderHistoryCandidates();
    await flush();
    expect(historyCandidates).toHaveBeenLastCalledWith(WORLD, HANDLE, { materialId: MATERIAL, establishedAt: '2026-10-05T09:00:00Z' });
    expect(controller.getState().manage.candidates?.list.map((c) => c.materialId)).toEqual([OLDER, MATERIAL]);
    expect(controller.getState().manage.candidates?.hasOlder).toBe(false);
  });

  it('the ended World: a separate read-only place, by entitlement, never the active entry', async () => {
    const t = transport();
    const controller = createSharedWorldController({ transport: t, isCurrent: () => true });
    controller.openClosed(ENDED);
    await flush();
    expect(controller.getState().place).toEqual({ kind: 'CLOSED', worldId: ENDED });
    expect(controller.getState().closed).toMatchObject({ worldId: ENDED, status: 'READY' });
    expect(t.entry).not.toHaveBeenCalled();
    expect(t.materials).not.toHaveBeenCalled();
    controller.openManage();
    expect(controller.getState().place.kind).toBe('CLOSED');
    controller.toRoot();
    expect(controller.getState().closed.worldId).toBeNull();
  });
});

describe.each([['ar'], ['en']] as const)('S4-03 lifecycle — the surfaces in %s', (language: ChromeLanguage) => {
  const copy = sharedLifecycleCopy(language);
  const shared = sharedCopy(language);

  function provider() {
    const authority = createAppearanceAuthority({
      store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
      system: { current: () => 'DARK', subscribe: () => () => undefined },
      native: { apply: () => undefined },
    });
    authority.bindAccount('reader');
    return authority;
  }

  it('the root: a committed name is the label; the ended Worlds are listed apart and open read-only', async () => {
    const t = transport();
    const controller = createSharedWorldController({ transport: t, isCurrent: () => true });
    const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    expect(within(view.getByTestId(`qandeel-shared-world-${WORLD}`)).getByText('Our Lantern')).toBeTruthy();
    const ended = view.getByTestId('qandeel-shared-ended-worlds');
    expect(within(ended).getByText(copy.endedHeading)).toBeTruthy();
    // The add / rejoin waiting on this reader: who proposed it, and nothing of the World; Accept is S4-01's approved word.
    const request = view.getByTestId(`qandeel-shared-member-request-${REQUEST}`);
    expect(within(request).getByText(fill(copy.memberRequestAdd, 'Dalia Fixture'))).toBeTruthy();
    expect(within(request).getByTestId('qandeel-shared-member-request-accept').props.accessibilityLabel).toBe(`${shared.accept}, ${fill(copy.memberRequestAdd, 'Dalia Fixture')}`);
    expect(within(request).queryByText(/Our Lantern/u)).toBeNull();
    await fireEvent.press(view.getByTestId(`qandeel-shared-ended-${ENDED}`));
    await flush();
    expect(view.getByTestId('qandeel-shared-ended-notice').props.children).toBe(copy.endedNotice);
    expect(view.queryByTestId('qandeel-shared-input')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-manage-open')).toBeNull();
    expect(view.getByText(/Fixture words kept after the end/u)).toBeTruthy();
  });

  it('Manage World: reached from inside the World, kept above the keyboard, the canonical names, settings and the waiting proposal', async () => {
    const t = transport();
    const controller = createSharedWorldController({ transport: t, isCurrent: () => true });
    const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    controller.openWorld(WORLD);
    await flush();
    const open = view.getByTestId('qandeel-shared-manage-open');
    expect(open.props.accessibilityLabel).toBe(copy.manageWorld);
    expect(flat(open).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(open);
    await flush();
    expect(view.getByTestId('qandeel-shared-title').props.children).toBe(copy.manageWorld);
    // The same keyboard protection as the S4-02 composer: padding on both platforms.
    // The S4-02 keyboard protection (padding on both platforms) is pinned at source level by the S4-03 root contract.
    expect(view.getByTestId('qandeel-shared-manage-keyboard')).toBeTruthy();
    expect(view.getByText(copy.worldSettings)).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-setting-description').props.accessibilityLabel).toBe(`${copy.descriptionLabel}: ${copy.notSet}`);
    const proposal = view.getByTestId('qandeel-shared-proposal-settings');
    expect(within(proposal).getByText(copy.proposalSettings)).toBeTruthy();
    // Who proposed it and the neutral progress — never who else approved.
    expect(within(proposal).getByTestId('qandeel-shared-proposal-proposer').props.children).toBe(fill(copy.proposedBy, 'Bassem Fixture'));
    expect(within(proposal).getByTestId('qandeel-shared-proposal-progress').props.children).toBe(fill(copy.progress, '1').replace('{1}', '2'));
    // An add names nobody before acceptance.
    const add = view.getByTestId('qandeel-shared-proposal-add');
    expect(within(add).getByText(copy.proposalAdd)).toBeTruthy();
    expect(within(add).getByTestId('qandeel-shared-proposal-proposer').props.children).toBe(copy.proposedBySelf);
    expect(within(add).getByTestId('qandeel-shared-proposal-approved')).toBeTruthy();
    await fireEvent.press(within(proposal).getByTestId('qandeel-shared-approve'));
    await flush();
    expect(t.approve).toHaveBeenCalledWith(WORLD, PROPOSAL, expect.any(String));
    expect(view.getByTestId('qandeel-shared-manage-notice')).toBeTruthy();
    expect(within(view.getByTestId('qandeel-shared-share-requests')).getByText(fill(copy.shareRequest, 'Rana Fixture'))).toBeTruthy();
    // Back from Manage World returns to the World it manages.
    await fireEvent.press(view.getByTestId('qandeel-shared-back'));
    await flush();
    expect(controller.getState().place).toEqual({ kind: 'WORLD', worldId: WORLD });
  });

  it('the consequence is stated BEFORE the act: leaving, removing and ending each confirm first', async () => {
    const t = transport();
    const controller = await managed(t);
    const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    await fireEvent.press(view.getByTestId('qandeel-shared-propose-removal-1'));
    const removal = view.getByTestId('qandeel-shared-removal-confirm');
    expect(within(removal).getByText(fill(copy.removeExplain, 'Bassem Fixture'))).toBeTruthy();
    expect(t.proposeRemoval).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('qandeel-shared-removal-confirm-cancel'));
    await fireEvent.press(view.getByTestId('qandeel-shared-end'));
    expect(within(view.getByTestId('qandeel-shared-end-confirm')).getByText(copy.endExplain)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-shared-end-confirm-cancel'));
    await fireEvent.press(view.getByTestId('qandeel-shared-leave'));
    const leave = view.getByTestId('qandeel-shared-leave-confirm');
    expect(within(leave).getByText(copy.leaveExplain)).toBeTruthy();
    expect(t.leave).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('qandeel-shared-leave-confirm-action'));
    await flush();
    expect(t.leave).toHaveBeenCalledWith(WORLD, expect.any(String));
    expect(controller.getState().place).toEqual({ kind: 'ROOT' });
    expect(view.getByTestId('qandeel-shared-notice')).toBeTruthy();
    expect(view.getByText(copy.left)).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-manage')).toBeNull();
  });

  it('sharing earlier messages shows the exact preview before anything is proposed', async () => {
    const t = transport();
    const controller = await managed(t);
    const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    await fireEvent.press(view.getByTestId('qandeel-shared-share-with-1'));
    await flush();
    expect(view.queryByTestId('qandeel-shared-share-preview')).toBeNull();
    const candidate = view.getByTestId('qandeel-shared-share-candidate');
    expect(candidate.props.accessibilityRole).toBe('togglebutton');
    await fireEvent.press(candidate);
    const preview = view.getByTestId('qandeel-shared-share-preview');
    expect(within(preview).getByText(fill(copy.previewHeading, 'Bassem Fixture'))).toBeTruthy();
    expect(t.proposeHistoryShare).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('qandeel-shared-share-propose'));
    await flush();
    expect(t.proposeHistoryShare).toHaveBeenCalledWith(WORLD, expect.any(String), HANDLE, [MATERIAL]);
  });

  it('adding a member: the S4-01 Shared ID field, a consequence first, and one answer that names nobody', async () => {
    const t = transport();
    const controller = await managed(t);
    const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    await fireEvent.press(view.getByTestId('qandeel-shared-add-member'));
    const form = view.getByTestId('qandeel-shared-add-member-form');
    expect(within(form).getByText(copy.addMemberExplain)).toBeTruthy();
    const field = view.getByTestId('qandeel-shared-add-member-id');
    expect(field.props.accessibilityLabel).toBe(shared.inviteFieldLabel);
    expect(field.props.placeholder).toBe(shared.inviteHint);
    await fireEvent.changeText(field, 'K7QM-4XWD-P9TR');
    await fireEvent.press(view.getByTestId('qandeel-shared-add-member-send'));
    await flush();
    expect(t.proposeMember).toHaveBeenCalledWith(WORLD, expect.any(String), 'K7QM-4XWD-P9TR');
    expect(view.getByText(copy.memberRequestSent)).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-add-member-form')).toBeNull();
  });

  it('with the governance and history scopes closed, only leaving stays — it is a human exit right', async () => {
    const t = transport({ manage: jest.fn(async () => ({ kind: 'READ' as const, manage: { ...MANAGE, capabilities: { governance: false, history: false } } })) });
    const controller = await managed(t);
    const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
    await flush();
    expect(view.getByTestId('qandeel-shared-governance-not-open').props.children).toBe(copy.governanceNotOpen);
    expect(view.queryByTestId('qandeel-shared-propose-settings')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-approve')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-end')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-share-with-1')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-add-member')).toBeNull();
    expect(view.getByTestId('qandeel-shared-leave')).toBeTruthy();
    expect(shared.membersHeading).toBe(copy.membersHeading);
  });
});

describe('S4-03 lifecycle — the copy gate', () => {
  it('canon is canon, reused rows are imported, and every new row is listed under the gate', () => {
    expect(sharedLifecycleCopy('ar').manageWorld).toBe('إدارة العالم');
    expect(sharedLifecycleCopy('en').manageWorld).toBe('Manage World');
    expect(sharedLifecycleCopy('ar').worldSettings).toBe('إعدادات العالم');
    expect(sharedLifecycleCopy('en').worldSettings).toBe('World Settings');
    // The Product Owner's decision (2026-10-05): the closed state's name.
    expect(sharedLifecycleCopy('ar').endedHeading).toBe('عوالم منتهية');
    expect(sharedLifecycleCopy('en').endedHeading).toBe('Ended Worlds');
    expect(SHARED_LIFECYCLE_COPY_GATE.canon).toContain('endedHeading');
    expect(SHARED_LIFECYCLE_COPY_GATE.proposed).not.toContain('endedHeading');
    for (const key of ['inviteFieldLabel', 'invalidSharedId', 'accept'] as const) {
      expect(sharedLifecycleCopy('ar')[key]).toBe(sharedCopy('ar')[key]);
      expect(sharedLifecycleCopy('en')[key]).toBe(sharedCopy('en')[key]);
    }
    for (const language of ['ar', 'en'] as const) {
      const copy = sharedLifecycleCopy(language) as unknown as Record<string, string>;
      for (const key of [...SHARED_LIFECYCLE_COPY_GATE.canon, ...SHARED_LIFECYCLE_COPY_GATE.reused, ...SHARED_LIFECYCLE_COPY_GATE.proposed]) {
        expect(typeof copy[key]).toBe('string');
        expect(copy[key].length).toBeGreaterThan(0);
      }
    }
    expect(sharedLifecycleCopy('en').delete).toBe(sharedCopy('en') && 'Delete');
  });
});
