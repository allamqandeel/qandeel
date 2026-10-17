/**
 * ACCT-DEL-01 (P-2) — the counterpart's retained Introduction World on the device, in Arabic and English, proven
 * rather than assumed: after the other human's account erasure, the server answers this reader exactly as migration
 * 0164's replaced readers do (verify-migration-0164 E01 / E12) — the World listed ENDED with the proposal identity they
 * held and NO name; the live read one ENDED row; the closed history their own words only; and every S6-06 sharing and
 * SUCCESS read UNAVAILABLE (that reader holds no Introduction Record any more). The existing S6-05 / S6-06 surfaces need
 * no change: the card says IW-11b, the World opens its closed record under IW-31 with no composer, no END and no sharing
 * action, nothing says the World is unavailable, and the reader deletes their own words as after any END (R-5).
 *
 * The appearance, the controllers and the surfaces are the REAL ones over scripted transports.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type {
  IntroductionHistoryRead, IntroductionMessage, IntroductionMessagesRead, IntroductionWorld, SharedDeleteResult, SharedRootResult,
} from '../../runtime-entry';
import { sharedCopy } from '../../shared-world/copy';
import { createSharedWorldController } from '../../shared-world/shared-world-controller';
import { SharedWorldArea } from '../../shared-world/SharedWorldArea';
import { createIntroductionSharingController } from '../introduction-sharing-controller';
import { introductionSharingCopy } from '../introduction-sharing-copy';
import { createIntroductionWorldsController, introductionWorldCopy } from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const W = '61111111-1111-4111-8111-111111111111';
const PR = '63333333-3333-4333-8333-333333333333';
const M1 = '66666666-6666-4666-8666-666666666661';
const M2 = '66666666-6666-4666-8666-666666666662';
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const settle = async () => { for (let i = 0; i < 4; i += 1) await flush(); };
let seq = 0;
const nextId = () => `c0000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const mine = (materialId: string, text: string, at: string): IntroductionMessage =>
  ({ materialId, producer: 'SELF', text, establishedAt: at, canDelete: true });
const FIRST = mine(M1, 'my first words', '2026-10-17T10:00:00+00:00');
const SECOND = mine(M2, 'my second words', '2026-10-17T10:01:00+00:00');
/** Exactly what 0164 answers the counterpart: ENDED, the proposal identity they held, no name. */
const RETAINED: IntroductionWorld = { worldId: W, proposalId: PR, state: 'ENDED', otherFirstName: null };

function appearance() {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }), system: { current: () => 'DARK', subscribe: () => () => undefined }, native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

function server() {
  let history: IntroductionHistoryRead = { kind: 'PAGE', messages: [FIRST, SECOND], hasOlder: false };
  const calls = { messages: 0, history: 0, del: [] as { worldId: string; materialId: string }[], sharingReads: 0 };
  const deletion = {
    deleteMaterial: async (worldId: string, materialId: string): Promise<SharedDeleteResult> => {
      calls.del.push({ worldId, materialId });
      history = { kind: 'PAGE', messages: [FIRST], hasOlder: false };
      return { kind: 'DELETED' };
    },
  };
  const worlds = createIntroductionWorldsController({
    transport: {
      list: async () => ({ kind: 'READ' as const, worlds: [RETAINED] }),
      messages: async (): Promise<IntroductionMessagesRead> => { calls.messages += 1; return { kind: 'ENDED' }; },
      history: async () => { calls.history += 1; return history; },
      send: async () => { throw new Error('nothing is ever sent into a retained World'); },
      end: async () => { throw new Error('nothing is ever ended in a retained World'); },
    } as never,
    deletion, isCurrent: () => true, newCommandId: nextId,
  });
  const unavailable = async () => { calls.sharingReads += 1; return { kind: 'UNAVAILABLE' as const }; };
  const refused = async () => { throw new Error('no sharing act is offered in a retained World'); };
  const sharing = createIntroductionSharingController({
    transport: {
      disclosures: unavailable, shareText: refused, uploadImage: refused, shareStage: refused, removeImage: refused,
      media: refused, grantDisplayName: refused, revokeDisplayName: refused,
    } as never,
    success: { success: unavailable, approve: refused, withdraw: refused } as never,
    deletion: deletion as never,
    photos: { choose: refused, discard: () => undefined, sweep: async () => undefined } as never,
    isCurrent: () => true, clearImageMemory: () => undefined, newCommandId: nextId,
  });
  return { worlds, sharing, calls };
}

async function area(language: ChromeLanguage, s: ReturnType<typeof server>) {
  const ROOT: SharedRootResult = { kind: 'READ', root: { capabilities: { invitation: false, birth: false }, worlds: [], invitations: [], closedWorlds: [], memberRequests: [] } };
  const none = async () => ({ kind: 'UNAVAILABLE' as const });
  const shared = createSharedWorldController({
    transport: {
      manage: none, leave: none, proposeSettings: none, proposeRemoval: none, proposeEnd: none, approve: none, historyCandidates: none,
      proposeHistoryShare: none, approveHistoryShare: none, closedWorld: none, proposeMember: none, acceptMembershipRequest: none,
      root: async () => ROOT, invite: none, accept: none, decline: none, entry: async () => ({ kind: 'DENIED' as const }), materials: none,
      send: async () => ({ kind: 'NOT_AVAILABLE' as const }), deleteMaterial: async () => ({ kind: 'NOT_DELETABLE' as const }),
    } as never,
    isCurrent: () => true,
  });
  const view = await render(
    <AppearanceProvider authority={appearance()}>
      <SharedWorldArea controller={shared} language={language} insets={INSETS} introductions={s.worlds} introductionSharing={s.sharing} />
    </AppearanceProvider>,
  );
  await settle();
  return view;
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await settle();
}

describe.each([['ar'], ['en']] as const)('ACCT-DEL-01 — the counterpart\'s retained Introduction World — %s', (language: ChromeLanguage) => {
  const copy = introductionWorldCopy(language);
  const shared = sharedCopy(language);

  it('is listed under the ended Worlds with IW-11b (no name), and opens its closed record with the reader\'s own words', async () => {
    const s = server();
    const view = await area(language, s);
    const card = view.getByTestId(`qandeel-introduction-card-${W}`);
    expect(card.props.accessibilityLabel).toBe(`${copy.titleNoName}${language === 'ar' ? '، ' : ', '}${copy.endedStatus}`);
    await press(view, `qandeel-introduction-card-${W}`);
    expect(view.getByTestId('qandeel-introduction-closed')).toBeTruthy();
    expect(view.getByText(copy.closedBanner)).toBeTruthy();
    expect(s.calls.messages).toBeGreaterThan(0);
    expect(s.calls.history).toBeGreaterThan(0);
    for (const m of [M1, M2]) expect(view.getByTestId(`qandeel-shared-material-self-${m}`)).toBeTruthy();
    expect(view.queryAllByTestId(/^qandeel-shared-material-human-/u)).toHaveLength(0);
    // Nothing the reader cannot do here is offered, and nothing says the World is unavailable.
    for (const absent of ['qandeel-shared-input', 'qandeel-introduction-end', 'qandeel-introduction-sharing', 'qandeel-introduction-denied']) {
      expect(view.queryByTestId(absent)).toBeNull();
    }
    expect(view.queryByText(shared.worldUnavailable)).toBeNull();
    expect(view.queryByText(introductionSharingCopy(language).sharingAction)).toBeNull();
    expect(s.calls.sharingReads).toBeGreaterThan(0);
  });

  it('the reader deletes their own retained words through the existing owner deletion (R-5)', async () => {
    const s = server();
    const view = await area(language, s);
    await press(view, `qandeel-introduction-card-${W}`);
    await press(view, `qandeel-shared-material-self-${M2}`);
    await press(view, 'qandeel-shared-delete');
    await press(view, 'qandeel-shared-delete-confirm-action');
    expect(s.calls.del).toEqual([{ worldId: W, materialId: M2 }]);
    expect(view.queryByTestId(`qandeel-shared-material-self-${M2}`)).toBeNull();
    expect(view.getByTestId(`qandeel-shared-material-self-${M1}`)).toBeTruthy();
  });
});
