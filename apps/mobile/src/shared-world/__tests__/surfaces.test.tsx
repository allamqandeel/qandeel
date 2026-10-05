/**
 * S4-01 — the Shared surfaces in Arabic and English, Dark and Light: the Global Switcher, the Shared root, the World
 * shell and the Shared ID page. Colours come from the generated canonical families; words from the one copy module.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore, type AppearancePreference } from '../../appearance';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import { P2_NAV_GLYPHS } from '../../iconography';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { SharedEntryResult, SharedRootResult } from '../../runtime-entry';
import { SharedIdPage } from '../../settings/SharedIdSection';
import { GlobalSwitcher } from '../GlobalSwitcher';
import { SharedWorldArea } from '../SharedWorldArea';
import { SHARED_COPY_GATE, fill, sharedCopy, worldLabel } from '../copy';
import { createSharedIdController } from '../shared-id-controller';
import { createSharedWorldController } from '../shared-world-controller';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const P = CANONICAL_VISUAL.palettes;
const WORLD = '33333333-3333-4333-8333-333333333333';
const INVITATION = '44444444-4444-4444-8444-444444444444';
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const flush = () => act(async () => {
  await new Promise((resolve) => setImmediate(resolve));
});

function appearance(preference: AppearancePreference) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: preference }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
}

const ROOT: SharedRootResult = {
  kind: 'READ',
  root: {
    capabilities: { invitation: true, birth: true },
    worlds: [{ worldId: WORLD, members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] }],
    invitations: [{ invitationId: INVITATION, inviterName: 'Chadi Fixture' }],
  },
};
const ALLOW: SharedEntryResult = { kind: 'ALLOW', world: { worldId: WORLD, bornAt: '2026-10-05T00:00:00Z', members: [{ name: 'Amal Fixture', self: true }, { name: 'Bassem Fixture', self: false }] } };

function areaController(entry: () => Promise<SharedEntryResult> = async () => ALLOW) {
  return createSharedWorldController({
    transport: {
      root: async () => ROOT,
      invite: async () => ({ kind: 'SUBMITTED' }),
      accept: async () => ({ kind: 'BORN', worldId: WORLD }),
      decline: async () => ({ kind: 'DECLINED' }),
      entry,
      materials: async () => ({ kind: 'READ', conversation: false, materials: [] }),
      send: async () => ({ kind: 'NOT_AVAILABLE' }),
      deleteMaterial: async () => ({ kind: 'NOT_DELETABLE' }),
    },
    isCurrent: () => true,
  });
}

describe.each([['ar', 'DARK'], ['en', 'LIGHT']] as const)('S4-01 surfaces — %s, %s', (language: ChromeLanguage, preference: 'DARK' | 'LIGHT') => {
  const copy = sharedCopy(language);
  const palette = P[preference].standard;
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  it('the Global Switcher: two destinations, words from the copy, glyphs decorative, SELECTED by marker and weight only', async () => {
    const onSelect = jest.fn();
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <GlobalSwitcher area="MY_WORLD" language={language} bottomInset={34} onSelect={onSelect} />
      </AppearanceProvider>,
    );
    const root = view.getByTestId('qandeel-global-switcher');
    expect(root.props.accessibilityLabel).toBe(copy.switcherLabel);
    expect(flat(root).direction).toBe(writing);
    const personal = view.getByTestId('qandeel-switcher-my_world');
    const shared = view.getByTestId('qandeel-switcher-shared_world');
    expect([personal.props.accessibilityLabel, shared.props.accessibilityLabel]).toEqual([copy.personalWorld, copy.sharedWorld]);
    expect(personal.props.accessibilityState).toMatchObject({ selected: true });
    expect(shared.props.accessibilityState).toMatchObject({ selected: false });
    expect(flat(personal).minHeight).toBeGreaterThanOrEqual(44);
    // SW-3: the selected cell's seam is the E1R marker; the other cell has none.
    expect(flat(view.getByTestId('qandeel-switcher-seam-my_world'))).toMatchObject({ height: palette.markerThickness, backgroundColor: palette.selectedMarker });
    expect(flat(view.getByTestId('qandeel-switcher-seam-shared_world')).height).toBe(0);
    // Brass never carries state: both glyphs are drawn in the same ink.
    const glyphs = [view.getByTestId('qandeel-nav-glyph-navMine', { includeHiddenElements: true }), view.getByTestId('qandeel-nav-glyph-navShared', { includeHiddenElements: true })];
    for (const glyph of glyphs) expect(glyph.props.accessibilityElementsHidden).toBe(true);
    await fireEvent.press(shared);
    expect(onSelect).toHaveBeenCalledWith('SHARED_WORLD');
    await fireEvent.press(personal);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('the Shared root: invitation in the approved meaning, Accept / Decline at 44 pt, Worlds labelled by the other members', async () => {
    const controller = areaController();
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <SharedWorldArea controller={controller} language={language} insets={INSETS} />
      </AppearanceProvider>,
    );
    await flush();
    expect(view.getByTestId('qandeel-shared-title').props.children).toBe(copy.sharedWorld);
    expect(view.getByText(fill(copy.invitation, 'Chadi Fixture'))).toBeTruthy();
    for (const id of ['qandeel-shared-accept', 'qandeel-shared-decline', 'qandeel-shared-create']) expect(flat(view.getByTestId(id)).minHeight).toBeGreaterThanOrEqual(44);
    expect(view.getByTestId(`qandeel-shared-world-${WORLD}`).props.accessibilityLabel).toBe('Bassem Fixture');
    expect(flat(view.getByTestId('qandeel-shared-area')).direction).toBe(writing);
    // No ranking, score or activity number anywhere.
    expect(view.queryByText(/\d+%|\bscore\b|closest|most important/iu)).toBeNull();
  });

  it('the World shell: nothing before ALLOW; then members and QANDEEL\'s welcome, no composer', async () => {
    let release: () => void = () => undefined;
    const controller = areaController(() => new Promise((resolve) => { release = () => resolve(ALLOW); }));
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <SharedWorldArea controller={controller} language={language} insets={INSETS} />
      </AppearanceProvider>,
    );
    await flush();
    await act(async () => controller.openWorld(WORLD));
    expect(view.getByTestId('qandeel-shared-transition').props.accessibilityLabel).toBe(copy.opening);
    expect(view.queryByText('Bassem Fixture')).toBeNull();
    await act(async () => {
      release();
      await new Promise((resolve) => setImmediate(resolve));
    });
    expect(view.getByTestId('qandeel-shared-welcome').props.accessibilityLabel).toBe(`${copy.personalWorld}: ${copy.welcome}`);
    // The title names the other member; the member list names everyone, the reader as You.
    expect(view.getByTestId('qandeel-shared-title').props.children).toBe('Bassem Fixture');
    expect(within(view.getByTestId('qandeel-shared-members')).getByText(copy.you)).toBeTruthy();
    expect(within(view.getByTestId('qandeel-shared-members')).getByText('Bassem Fixture')).toBeTruthy();
    expect(view.queryByTestId('qandeel-composer')).toBeNull();
    expect(view.getByTestId('qandeel-shared-back').props.accessibilityLabel).toBe(copy.back);
  });

  it('the Shared ID page: the value as one LTR run, Copy, and Regenerate only after the confirmation', async () => {
    const regenerate = jest.fn(async () => ({ kind: 'READY' as const, sharedId: 'AB12-CD34-EF56' }));
    const controller = createSharedIdController({ transport: { identity: async () => ({ kind: 'READY', sharedId: 'K7QM-4XWD-P9TR' }), regenerate }, isCurrent: () => true });
    const view = await render(
      <AppearanceProvider authority={appearance(preference)}>
        <SharedIdPage controller={controller} language={language} palette={palette} busyChanged={() => undefined} />
      </AppearanceProvider>,
    );
    await flush();
    expect(view.getByTestId('qandeel-shared-id-value').props.children).toBe(`${String.fromCodePoint(0x2066)}K7QM-4XWD-P9TR${String.fromCodePoint(0x2069)}`);
    expect(view.getByText(copy.sharedIdPrivacy)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-shared-id-copy'));
    await flush();
    const { setStringAsync } = jest.requireMock<{ setStringAsync: jest.Mock }>('expo-clipboard');
    expect(setStringAsync).toHaveBeenCalledWith('K7QM-4XWD-P9TR');
    await fireEvent.press(view.getByTestId('qandeel-shared-id-regenerate'));
    expect(regenerate).not.toHaveBeenCalled();
    expect(view.getByText(copy.regenerateWarning)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-shared-id-regenerate-confirm'));
    await flush();
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/K7QM/u)).toBeNull();
    expect(view.getByTestId('qandeel-shared-id-value').props.children).toContain('AB12-CD34-EF56');
  });
});

describe('S4-01 copy', () => {
  it('binds the CANON names and the two APPROVED meanings exactly, with the copy gate closed', () => {
    expect(SHARED_COPY_GATE.approved).toEqual(['invitation', 'welcome']);
    expect(SHARED_COPY_GATE.proposed).toEqual([]);
    expect(SHARED_COPY_GATE.status).toMatch(/— CLOSED/u);
    expect(sharedCopy('ar').declined).toBe('تم رفض الدعوة.');
    expect(sharedCopy('ar').invalidSharedId).toBe('تأكد من المعرّف المشترك وحاول مرة أخرى.');
    expect(sharedCopy('en').invalidSharedId).toBe('Check the Shared ID and try again.');
    expect(sharedCopy('ar').switcherLabel).toBe('التنقل بين قنديل والعالم المشترك');
    expect(sharedCopy('en').switcherLabel).toBe('Switch between QANDEEL and Shared World');
    expect(sharedCopy('ar').sharedWorld).toBe('العالم المشترك');
    expect(sharedCopy('en').sharedWorld).toBe('Shared World');
    expect(sharedCopy('ar').personalWorld).toBe('قنديل');
    expect(sharedCopy('en').personalWorld).toBe('QANDEEL');
    expect(fill(sharedCopy('ar').invitation, 'محمد')).toBe('محمد يدعوك لإنشاء عالم مشترك بينكما ومع قنديل.');
    expect(fill(sharedCopy('en').invitation, 'Mohamed')).toBe('Mohamed invites you to create a Shared World together with QANDEEL.');
    expect(sharedCopy('ar').welcome).toBe('أهلًا بكما. هذا عالمكما المشترك معي.');
    expect(sharedCopy('en').welcome).toBe('Welcome. This is your Shared World with me.');
  });

  it('labels a World by its other members in join order, and by the area name when alone', () => {
    const en = sharedCopy('en');
    expect(worldLabel(en, [{ name: 'A', self: true }, { name: 'B', self: false }, { name: 'C', self: false }])).toBe('B and C');
    expect(worldLabel(sharedCopy('ar'), [{ name: 'هدير', self: false }, { name: 'أحمد', self: false }])).toBe('هدير وأحمد');
    expect(worldLabel(en, [{ name: 'A', self: true }])).toBe('Shared World');
  });

  it('draws the P2 navigation family from the generated N1 geometry: one ring, one or two points of light', () => {
    expect(P2_NAV_GLYPHS.navMine.strokes[0].d).toBe(P2_NAV_GLYPHS.navShared.strokes[0].d);
    expect(P2_NAV_GLYPHS.navMine.dots).toHaveLength(1);
    expect(P2_NAV_GLYPHS.navShared.dots).toHaveLength(2);
    expect('navPublic' in P2_NAV_GLYPHS).toBe(false);
  });
});
