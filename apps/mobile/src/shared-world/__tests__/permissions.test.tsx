/**
 * S8A-04 CP3-C — the owner's permissions for their own knowledge in a Shared World, on the mobile client: the strict
 * decoders (names and an opaque audience reference, never a user id), the controller (the audience the reader was shown,
 * one command per act, AUDIENCE_CHANGED re-reads the new list), and the surfaces in Arabic and English — the private
 * request in the World's own screen apart from the conversation, «ما سمحت به هنا» in Manage World, every word from the
 * CP3 Copy Gate (APPROVED 6/6), each inserted value bidi-isolated.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { SharedEntryResult, SharedManage, SharedPermissions, SharedPermissionsResult, SharedRootResult } from '../../runtime-entry';
import { SharedWorldArea } from '../SharedWorldArea';
import { sharedCopy } from '../copy';
import {
  SHARED_PERMISSIONS_COPY_GATE, endedText, fillPermission, isolate, joinMembers, sharedPermissionsCopy,
} from '../permissions/permissions-copy';
import type { SharedPermissionsTransport } from '../permissions/shared-permissions-controller';
import { createSharedWorldController, type SharedWorldTransport } from '../shared-world-controller';

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const WORLD = '33333333-3333-4333-8333-333333333333';
const REQUEST = '88888888-8888-4888-8888-888888888888';
const ITEM = '99999999-9999-4999-8999-999999999999';
const ITEM_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_3 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF = `sha256:${'c'.repeat(64)}`;
const REF_2 = `sha256:${'d'.repeat(64)}`;
const flush = () => act(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

const ROOT: SharedRootResult = {
  kind: 'READ',
  root: { capabilities: { invitation: true, birth: true }, worlds: [], invitations: [], closedWorlds: [], memberRequests: [] },
};
const ALLOW: SharedEntryResult = { kind: 'ALLOW', world: { worldId: WORLD, bornAt: '2026-10-25T00:00:00Z', name: 'Evening Walks',
  members: [{ name: 'Mohamed Fixture', self: true }, { name: 'Hala Fixture', self: false }, { name: 'سارة', self: false }] } };
const MANAGE: SharedManage = {
  capabilities: { governance: false, history: false },
  settings: { name: 'Evening Walks', description: null, topic: null },
  members: [], proposals: [], historyRequests: [],
};
const NOTHING: SharedPermissions = { audienceRef: null, members: [], requests: [], allowed: [], reconfirm: [], declined: [], ended: [] };
const WITH_REQUEST: SharedPermissions = {
  ...NOTHING, audienceRef: REF, members: ['Hala Fixture', 'سارة'],
  requests: [{ requestId: REQUEST, itemId: ITEM, text: 'I go to sleep early every day for work' }],
};

function sharedTransport(): SharedWorldTransport {
  const answer = <T,>(value: T) => jest.fn(async () => value);
  return {
    root: answer(ROOT), invite: answer({ kind: 'SUBMITTED' as const }), accept: answer({ kind: 'NOT_ACCEPTABLE' as const }),
    decline: answer({ kind: 'DECLINED' as const }), entry: answer(ALLOW),
    materials: answer({ kind: 'READ' as const, conversation: true, materials: [], hasOlder: false }),
    send: answer({ kind: 'NOT_AVAILABLE' as const }), deleteMaterial: answer({ kind: 'NOT_DELETABLE' as const }),
    manage: answer({ kind: 'READ' as const, manage: MANAGE }), leave: answer({ kind: 'LEFT' as const }),
    proposeSettings: answer({ kind: 'PROPOSED' as const }), proposeRemoval: answer({ kind: 'PROPOSED' as const }),
    proposeEnd: answer({ kind: 'PROPOSED' as const }), approve: answer({ kind: 'APPROVED' as const }),
    historyCandidates: answer({ kind: 'READ' as const, hasOlder: false, candidates: [] }), proposeMember: answer({ kind: 'SUBMITTED' as const }),
    acceptMembershipRequest: answer({ kind: 'JOINED' as const }), proposeHistoryShare: answer({ kind: 'PROPOSED' as const }),
    approveHistoryShare: answer({ kind: 'GRANTED' as const }), closedWorld: answer({ kind: 'UNAVAILABLE' as const }),
  } as unknown as SharedWorldTransport;
}

/** The permissions server: every read answers the current view; each command moves it to the next one (the last stays). */
function permissionsTransport(views: SharedPermissions[], answers: { answer?: string[]; allow?: string[]; withdraw?: string[] } = {}) {
  const queue = [...views];
  const current = (): SharedPermissionsResult => ({ kind: 'READ', permissions: queue[0] });
  const out = (list: string[] | undefined, fallback: string) => {
    const kind = list && list.length > 0 ? list.shift()! : fallback;
    if (kind !== 'UNAVAILABLE' && queue.length > 1) queue.shift();
    return { kind: kind as never };
  };
  const t = {
    permissions: jest.fn(async () => current()),
    answerPermission: jest.fn(async () => out(answers.answer, 'ALLOWED')),
    allowPermission: jest.fn(async () => out(answers.allow, 'ALLOWED')),
    withdrawPermission: jest.fn(async () => out(answers.withdraw, 'WITHDRAWN')),
  };
  return t as typeof t & SharedPermissionsTransport;
}

function provider() {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

async function worldScreen(language: ChromeLanguage, p: SharedPermissionsTransport) {
  let n = 0;
  const controller = createSharedWorldController({ transport: sharedTransport(), isCurrent: () => true, newCommandId: () => `command-${++n}`, permissionsTransport: p });
  const view = await render(<AppearanceProvider authority={provider()}><SharedWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  controller.openWorld(WORLD);
  await flush();
  await flush();
  return { controller, view };
}

describe('S8A-04 CP3-C — the copy (CP3 Copy Gate, APPROVED 6/6)', () => {
  it('records the gate as approved by the Product Owner, with nothing proposed', () => {
    expect(SHARED_PERMISSIONS_COPY_GATE.status).toBe('S8A-04 CP3 COPY GATE — APPROVED 6/6 — Product Owner, 2026-10-25');
    expect('proposed' in SHARED_PERMISSIONS_COPY_GATE).toBe(false);
    for (const language of ['ar', 'en'] as const) {
      const copy = sharedPermissionsCopy(language);
      for (const key of [...SHARED_PERMISSIONS_COPY_GATE.approved, ...SHARED_PERMISSIONS_COPY_GATE.reused]) {
        expect(typeof copy[key]).toBe('string');
      }
    }
  });

  it('carries the approved words verbatim', () => {
    const ar = sharedPermissionsCopy('ar');
    const en = sharedPermissionsCopy('en');
    expect(ar.request.split('\n')[0]).toBe('في «{world}»، قد يفيد قنديل أن يعرف هذا عنك: «{item}».');
    expect(ar.request.split('\n')[3]).toBe('لا يرى هذا الطلب أحد غيرك. ينتهي الإذن إذا غادرت هذا العالم أو صححت هذه المعلومة أو طلبت نسيانها، ويمكنك سحبه في أي وقت.');
    expect(en.request.split('\n')[1]).toBe('If you allow it, QANDEEL will use it in its replies here and may mention it as yours in front of this World\'s members ({members}).');
    expect([ar.allow, ar.decline, ar.allowEveryone, ar.stopUsing, ar.title, ar.allowedHeading, ar.declinedHeading, ar.withdraw, ar.withdrawConfirm, ar.cancel, ar.allowNow])
      .toEqual(['اسمح', 'لا', 'اسمح للجميع', 'أوقف استخدامها', 'ما سمحت به هنا', 'مسموح', 'رفضته', 'سحب الإذن', 'اسحب', 'إلغاء', 'اسمح الآن']);
    expect([en.allow, en.decline, en.allowEveryone, en.stopUsing, en.title, en.allowedHeading, en.declinedHeading, en.withdraw, en.withdrawConfirm, en.cancel, en.allowNow])
      .toEqual(['Allow', 'No', 'Allow for everyone', 'Stop using it', 'What you\'ve allowed here', 'Allowed', 'Declined', 'Withdraw', 'Withdraw', 'Cancel', 'Allow now']);
    expect(en.declinedDone).toBe('QANDEEL won\'t ask about this again in this World. You can still allow it later from "What you\'ve allowed here".');
  });

  it('joins {members} as the gate defines it, each Name isolated, and isolates every inserted value', () => {
    const ar = sharedPermissionsCopy('ar');
    const en = sharedPermissionsCopy('en');
    expect(joinMembers(ar, ['هالة'])).toBe(isolate('هالة'));
    expect(joinMembers(ar, ['هالة', 'سارة'])).toBe(`${isolate('هالة')} و${isolate('سارة')}`);
    expect(joinMembers(ar, ['هالة', 'Sam', 'سارة'])).toBe(`${isolate('هالة')}، ${isolate('Sam')} و${isolate('سارة')}`);
    expect(joinMembers(en, ['Hala', 'Sam', 'Sara'])).toBe(`${isolate('Hala')}, ${isolate('Sam')} and ${isolate('Sara')}`);
    expect(fillPermission(en.allowedDone, { world: 'Walks 2' })).toBe(`Done. QANDEEL can use and mention this in "${isolate('Walks 2')}".`);
    expect(endedText(ar, 'LEFT')).toBe('انتهى هذا الإذن لأنك غادرت هذا العالم.');
    expect(endedText(en, 'FORGOTTEN')).toBe('This permission ended because you asked QANDEEL to forget it.');
    expect(endedText(en, 'NO_LONGER_CURRENT')).toBe('This permission ended because this is no longer current.');
  });
});

describe('S8A-04 CP3-C — the controller', () => {
  it('answers over the audience the reader was shown; AUDIENCE_CHANGED reads the new list, and the next Allow is a new act', async () => {
    const grown: SharedPermissions = { ...WITH_REQUEST, audienceRef: REF_2, members: ['Hala Fixture', 'سارة', 'Nour Fixture'] };
    const p = permissionsTransport([WITH_REQUEST, grown], { answer: ['AUDIENCE_CHANGED', 'ALLOWED'] });
    const { controller } = await worldScreen('en', p);
    const permissions = controller.permissions!;
    expect(permissions.getState().data).toEqual(WITH_REQUEST);
    expect(await permissions.answer(REQUEST, 'ALLOW')).toBe('AUDIENCE_CHANGED');
    await flush();
    expect(p.answerPermission).toHaveBeenLastCalledWith(WORLD, REQUEST, expect.any(String), 'ALLOW', REF);
    const first = (p.answerPermission.mock.calls[0] as unknown[])[2];
    expect(permissions.getState().data?.members).toEqual(['Hala Fixture', 'سارة', 'Nour Fixture']);
    expect(permissions.getState().notice).toBeNull();
    expect(await permissions.answer(REQUEST, 'ALLOW')).toBe('ALLOWED');
    expect(p.answerPermission).toHaveBeenLastCalledWith(WORLD, REQUEST, expect.any(String), 'ALLOW', REF_2);
    expect((p.answerPermission.mock.calls[1] as unknown[])[2]).not.toBe(first);
    expect(permissions.getState().notice).toBe('ALLOWED');
  });

  it('No carries no reference; a lost answer keeps the SAME command for the retry', async () => {
    const p = permissionsTransport([WITH_REQUEST], { answer: ['UNAVAILABLE', 'DECLINED'] });
    const { controller } = await worldScreen('en', p);
    const permissions = controller.permissions!;
    expect(await permissions.answer(REQUEST, 'DECLINE')).toBe('UNAVAILABLE');
    expect(permissions.getState().notice).toBe('FAILED');
    expect(await permissions.answer(REQUEST, 'DECLINE')).toBe('DECLINED');
    expect(p.answerPermission.mock.calls[0] as unknown[]).toEqual([WORLD, REQUEST, (p.answerPermission.mock.calls[1] as unknown[])[2], 'DECLINE', null]);
    expect(permissions.getState().notice).toBe('DECLINED');
  });

  it('a confirmation stays on the screen of its act: opening the World again (Manage, the conversation) never repeats it', async () => {
    const p = permissionsTransport([WITH_REQUEST], { answer: ['ALLOWED'] });
    const { controller } = await worldScreen('en', p);
    const permissions = controller.permissions!;
    expect(await permissions.answer(REQUEST, 'ALLOW')).toBe('ALLOWED');
    expect(permissions.getState().notice).toBe('ALLOWED');
    permissions.open(WORLD);
    expect(permissions.getState().notice).toBeNull();
  });

  it('nothing of the World stays after returning to the root', async () => {
    const p = permissionsTransport([WITH_REQUEST]);
    const { controller } = await worldScreen('en', p);
    controller.toRoot();
    expect(controller.permissions!.getState()).toMatchObject({ worldId: null, data: null });
  });
});

describe.each(['ar', 'en'] as const)('S8A-04 CP3-C — the surfaces (%s)', (language) => {
  const copy = sharedPermissionsCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  it('the request reaches the owner in the World\'s own screen, apart from the conversation; Allow confirms with CG-2', async () => {
    const p = permissionsTransport([WITH_REQUEST, { ...NOTHING, audienceRef: REF, members: WITH_REQUEST.members, allowed: [{ itemId: ITEM, text: WITH_REQUEST.requests[0].text }] }]);
    const { view } = await worldScreen(language, p);
    const card = view.getByTestId('qandeel-shared-permission-request');
    const expected = fillPermission(copy.request, { world: 'Evening Walks', item: WITH_REQUEST.requests[0].text, members: joinMembers(copy, WITH_REQUEST.members) }).split('\n');
    expected.forEach((line, index) => {
      const node = within(card).getByTestId(`qandeel-shared-permission-request-line-${index}`);
      expect(node.props.children).toBe(line);
      expect(flat(node).writingDirection).toBe(writing);
    });
    expect(within(view.getByTestId('qandeel-shared-thread')).queryByTestId('qandeel-shared-permission-request')).toBeNull();
    await fireEvent.press(within(card).getByTestId('qandeel-shared-permission-allow'));
    await flush();
    expect(p.answerPermission).toHaveBeenCalledWith(WORLD, REQUEST, expect.any(String), 'ALLOW', REF);
    expect(view.queryByTestId('qandeel-shared-permission-request')).toBeNull();
    expect(within(view.getByTestId('qandeel-shared-permission-notice')).getByText(fillPermission(copy.allowedDone, { world: 'Evening Walks' }))).toBeTruthy();
  });

  it('pinned: one request at a time, its words bounded and scrolling, its answers outside them and always in sight', async () => {
    const second = { requestId: '7a2b5c1d-0000-4000-8000-0000000000bb', itemId: '7a2b5c1d-0000-4000-8000-0000000000cc', text: 'second item' };
    const p = permissionsTransport([{ ...WITH_REQUEST, requests: [...WITH_REQUEST.requests, second] }]);
    const { view } = await worldScreen(language, p);
    const region = view.getByTestId('qandeel-shared-permission-requests');
    expect(within(region).getAllByTestId('qandeel-shared-permission-request')).toHaveLength(1);
    expect(within(region).queryByText(second.text, { exact: false })).toBeNull();
    const lines = within(region).getByTestId('qandeel-shared-permission-request-lines');
    expect(flat(lines).maxHeight).toBeGreaterThan(0);
    expect(within(lines).queryByTestId('qandeel-shared-permission-allow')).toBeNull();
    expect(within(lines).queryByTestId('qandeel-shared-permission-decline')).toBeNull();
    expect(within(region).getByTestId('qandeel-shared-permission-allow')).toBeTruthy();
  });

  it('No: no request again, and the way to allow later is named', async () => {
    const p = permissionsTransport([WITH_REQUEST, { ...NOTHING, audienceRef: REF, members: WITH_REQUEST.members, declined: [{ itemId: ITEM, text: 'x' }] }],
      { answer: ['DECLINED'] });
    const { view } = await worldScreen(language, p);
    await fireEvent.press(view.getByTestId('qandeel-shared-permission-decline'));
    await flush();
    expect(p.answerPermission).toHaveBeenCalledWith(WORLD, REQUEST, expect.any(String), 'DECLINE', null);
    expect(view.queryByTestId('qandeel-shared-permission-request')).toBeNull();
    expect(within(view.getByTestId('qandeel-shared-permission-notice')).getByText(copy.declinedDone)).toBeTruthy();
  });

  it('a member with nothing of their own here sees nothing: no card, no section, no trace', async () => {
    const p = permissionsTransport([NOTHING]);
    const { controller, view } = await worldScreen(language, p);
    expect(view.queryByTestId('qandeel-shared-permission-requests')).toBeNull();
    controller.openManage();
    await flush();
    await flush();
    expect(view.getByTestId('qandeel-shared-manage')).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-permissions')).toBeNull();
    expect(view.queryByText(copy.title)).toBeNull();
  });

  it('«ما سمحت به هنا»: withdraw after its consequence; allow now with the members; reconfirmation; the endings', async () => {
    const listed: SharedPermissions = {
      audienceRef: REF, members: ['Hala Fixture', 'سارة', 'Nour Fixture'], requests: [],
      allowed: [{ itemId: ITEM, text: 'I go to sleep early' }],
      reconfirm: [{ itemId: ITEM_2, text: 'I travel a lot', newMembers: ['Nour Fixture'] }],
      declined: [{ itemId: ITEM_3, text: 'I run in the morning' }],
      ended: [{ itemId: ITEM_2, text: null, reason: 'FORGOTTEN' }, { itemId: ITEM_3, text: 'I drink tea', reason: 'LEFT' }],
    };
    const p = permissionsTransport([listed]);
    const { controller, view } = await worldScreen(language, p);
    controller.openManage();
    await flush();
    await flush();
    const section = view.getByTestId('qandeel-shared-permissions');
    expect(within(section).getByText(copy.title)).toBeTruthy();
    expect(within(section).getByText(copy.allowedHeading)).toBeTruthy();
    expect(within(section).getByText(copy.declinedHeading)).toBeTruthy();
    // Reconfirmation (CG-3): the new members only.
    const reconfirmText = fillPermission(copy.reconfirm, { world: 'Evening Walks', members: joinMembers(copy, ['Nour Fixture']), item: 'I travel a lot' });
    expect(within(section).getByText(reconfirmText)).toBeTruthy();
    // Waiting for reconfirmation means no longer in use: it comes BEFORE «مسموح», never under it.
    const tree = JSON.stringify(view.toJSON());
    expect(tree.indexOf(JSON.stringify(reconfirmText))).toBeGreaterThan(-1);
    expect(tree.indexOf(JSON.stringify(reconfirmText))).toBeLessThan(tree.indexOf(`[${JSON.stringify(copy.allowedHeading)}]`));
    await fireEvent.press(within(section).getByTestId('qandeel-shared-permission-allow-everyone'));
    await flush();
    expect(p.allowPermission).toHaveBeenLastCalledWith(WORLD, ITEM_2, expect.any(String), REF);
    // Withdraw (CG-4): the consequence first, then the act.
    await fireEvent.press(within(section).getByTestId('qandeel-shared-permission-withdraw'));
    const confirm = view.getByTestId('qandeel-shared-permission-withdraw-confirm');
    expect(within(confirm).getByText(fillPermission(copy.withdrawExplain, { world: 'Evening Walks' }))).toBeTruthy();
    expect(p.withdrawPermission).not.toHaveBeenCalled();
    await fireEvent.press(within(confirm).getByTestId('qandeel-shared-permission-withdraw-confirm-action'));
    await flush();
    expect(p.withdrawPermission).toHaveBeenCalledWith(WORLD, ITEM, expect.any(String));
    // Allow now (CG-4): the members it may be mentioned in front of, before the act.
    await fireEvent.press(view.getByTestId('qandeel-shared-permission-allow-now'));
    const allowNow = view.getByTestId('qandeel-shared-permission-allow-now-confirm');
    expect(within(allowNow).getByText(fillPermission(copy.allowNowExplain, { members: joinMembers(copy, listed.members) }))).toBeTruthy();
    await fireEvent.press(within(allowNow).getByTestId('qandeel-shared-permission-allow-now-confirm-action'));
    await flush();
    expect(p.allowPermission).toHaveBeenLastCalledWith(WORLD, ITEM_3, expect.any(String), REF);
    // The endings (CG-5), the forgotten one without its words.
    const ended = view.getAllByTestId('qandeel-shared-permission-ended');
    expect(within(ended[0]).getByText(endedText(copy, 'FORGOTTEN'))).toBeTruthy();
    expect(within(ended[1]).getByText(endedText(copy, 'LEFT'))).toBeTruthy();
    expect(within(ended[1]).getByText('I drink tea')).toBeTruthy();
    // The World's name is the reader's own label; the S4-01 words stay the S4-01 words.
    expect(sharedCopy(language).actionUnavailable).toBe(copy.actionUnavailable);
  });
});
