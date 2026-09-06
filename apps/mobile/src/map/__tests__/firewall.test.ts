import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACTION_CATALOG,
  KERNEL_ACTION_TYPES,
  MAP_ACTION_TYPES,
  METADATA_ONLY_ACTION_TYPES,
  PRODUCT_ACT_IDS,
  RETURN_ACTION_TYPES,
  RH_ACTION_IDS,
  catalogEntry,
  effectiveTC,
  OwnedByLaterTask,
} from '../../state';
import { disclosureFixture } from '../__fixtures__/disclosure';
import { contextOf, envelope, testStore } from '../__fixtures__/store';
import { exploreViewport, panByTranslation, zoomSemanticStep } from '../camera';
import { directJump, inspectObject, switchContext } from '../inspection';

const MAP_DIR = join(__dirname, '..');

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === '__fixtures__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...productionFiles(full));
    else if (/\.tsx?$/u.test(entry)) out.push(full);
  }
  return out;
}

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

const productionCode = productionFiles(MAP_DIR)
  .map((file) => stripComments(readFileSync(file, 'utf8')))
  .join('\n');

/** The kernel's own source: the fail-closed rule over the later-owner LEVEL is asserted, not assumed. */
const productionState = stripComments(readFileSync(join(MAP_DIR, '..', 'state', 'store.ts'), 'utf8'));

const DISCLOSURE = () =>
  disclosureFixture({
    depth: 'ANALYTICAL_OBJECT',
    threads: [
      { id: 'thread-a', x: '0', y: '0' },
      { id: 'thread-b', x: '2000000', y: '0' },
    ],
    appearances: [
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ],
    readings: [{ id: 'reading-1' }],
    focuses: [{ id: 'focus-1', startedSp: 1 }],
  });

describe('M04-14 — the Live Focus firewall', () => {
  it('every T-04 act leaves LF object-identical, and none of them can even name it', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const lf = store.getState().live.LF;
    const live = store.getState().live;

    inspectObject(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-1' } });
    switchContext(store, context, { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-2' } });
    directJump(store, context, { family: 'THREAD', id: 'thread-b' });
    panByTranslation(store, -30, 12);
    exploreViewport(store, envelope(), 'UP');
    zoomSemanticStep(store, 'OUT');

    expect(store.getState().history.length).toBeGreaterThanOrEqual(5);
    expect(store.getState().live.LF).toBe(lf);
    expect(store.getState().live).toBe(live);
    expect(store.getState().live.LH).toBe(live.LH);

    for (const id of [...KERNEL_ACTION_TYPES, ...MAP_ACTION_TYPES]) {
      expect(ACTION_CATALOG[id].authority.includes('LF')).toBe(false);
      expect(ACTION_CATALOG[id].authority.includes('LH')).toBe(false);
    }
  });

  it('no T-04 act moves the temporal state', () => {
    const store = testStore({ depth: 'ANALYTICAL_OBJECT' });
    const context = contextOf(store, DISCLOSURE());
    const temporal = store.getState().temporal;
    const tc = effectiveTC(store.getState());

    inspectObject(store, context, { family: 'THREAD', id: 'thread-a' });
    directJump(store, context, { family: 'THREAD', id: 'thread-b' });
    panByTranslation(store, 60, 0);
    zoomSemanticStep(store, 'OUT');

    expect(store.getState().temporal).toEqual(temporal);
    expect(effectiveTC(store.getState())).toBe(tc);
    for (const id of MAP_ACTION_TYPES) expect(ACTION_CATALOG[id].authority.includes('TM')).toBe(false);
  });
});

describe('M04-15 — the registry and scope firewall', () => {
  it('the three promoted acts keep their frozen identity, authority and RH behaviour', () => {
    expect([...MAP_ACTION_TYPES]).toEqual(['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP']);
    for (const id of MAP_ACTION_TYPES) {
      const entry = ACTION_CATALOG[id];
      expect(entry.level).toBe('EXECUTABLE');
      expect(entry.owner).toBe('T-04');
      expect(entry.cls).toBe('A');
      expect(entry.transactional).toBe('RH_CHECKPOINT');
      expect(RH_ACTION_IDS).toContain(id);
    }
    expect([...ACTION_CATALOG.INSPECT_OBJECT.authority]).toEqual(['IF_ref']);
    expect([...ACTION_CATALOG.SWITCH_CONTEXT.authority]).toEqual(['IF_ref']);
    expect([...ACTION_CATALOG.DIRECT_JUMP.authority].sort()).toEqual([
      'IF_ref',
      'MC.anchor',
      'MC.depth',
      'MC.destination',
      'MC.orientation',
      'MC.scale',
    ]);
  });

  it('no act of a neighbouring promoted family reaches the Map seam; the general rule is not weakened', () => {
    const store = testStore();
    const before = store.getState();
    // T-06 re-anchor: `COMMIT_MOMENT_AND_LOCATE` and `CHOOSE_LOCUS` left the later-owner set when
    // T-06 landed their substrate. T-07 re-anchor: the six return identities left it too, behind
    // their OWN runtime authority, so the set is now empty. The rule this test guards is unweakened
    // and is now stated in both directions: the fail-closed rule over the LEVEL still exists and
    // still refuses anything registered at it, and every promoted act of a neighbouring family is
    // refused BY IDENTITY at the Map seam, before any authority is consulted.
    expect([...METADATA_ONLY_ACTION_TYPES]).toEqual([]);
    expect(productionState.includes("if (entry.level === 'METADATA_ONLY') throw new OwnedByLaterTask(entry.id, entry.owner);")).toBe(true);
    expect(OwnedByLaterTask).toBeDefined();
    for (const id of ['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS', ...RETURN_ACTION_TYPES] as const) {
      expect(() => store.dispatchMap({ type: id } as never)).toThrow(/is not a promoted Map act/u);
      expect(ACTION_CATALOG[id].level).toBe('EXECUTABLE');
    }
    // ...and the raw dispatch surface reaches none of them either.
    for (const id of RETURN_ACTION_TYPES) {
      expect(() => store.dispatch({ type: id } as never)).toThrow(/authorized return seam/u);
      expect(ACTION_CATALOG[id].owner).toBe('T-07');
    }
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('MAP_FOCUS_OBJECT and a generic navigate identity do not exist anywhere', () => {
    expect(catalogEntry('MAP_FOCUS_OBJECT')).toBeUndefined();
    expect(catalogEntry('NAVIGATE')).toBeUndefined();
    expect(PRODUCT_ACT_IDS.includes('MAP_FOCUS_OBJECT' as never)).toBe(false);
    for (const forbidden of ["'MAP_FOCUS_OBJECT'", 'MAP_FOCUS_OBJECT', "'NAVIGATE'", 'function navigate(', 'export function navigate', 'WORLD_TRUTH', "'INVALIDATE'", "'REFRESH'", "'SYNC_ALL'"]) {
      expect(productionCode.includes(forbidden)).toBe(false);
    }
  });

  it('the Map layer implements no T-06 or T-07 act and no new authoritative event', () => {
    for (const forbidden of [
      'COMMIT_MOMENT_AND_LOCATE',
      'CHOOSE_LOCUS',
      'RETURN_LIVE_HEAD',
      'RETURN_LIVE_FOCUS',
      'GO_LIVE_AND_LOCATE',
      'RETURN_WORLD',
      'EXACT_RETURN',
      'BACK_ONE_STEP',
      'PREVIEW_TEMPORAL_TARGET',
      'CANCEL_PREVIEW',
      'PTC',
      'ingest(',
      'LIVE_HEAD_ADVANCED',
      'LIVE_FOCUS_TRANSITION',
    ]) {
      expect(productionCode.includes(forbidden)).toBe(false);
    }
  });

  it('the Map layer never writes canonical state except through the T-02 store dispatch', () => {
    expect(productionCode.includes('createCanonicalStore')).toBe(false);
    expect(productionCode.includes('useReducer')).toBe(false);
    for (const forbidden of ['expo-router', 'useRouter', 'router.push', 'router.back', 'usePathname', 'useSegments', 'Linking']) {
      expect(productionCode.includes(forbidden)).toBe(false);
    }
    // Exactly one place dispatches, and it is the shared outcome helper.
    const dispatchSites = productionCode.match(/store\.dispatch\(/gu) ?? [];
    expect(dispatchSites).toHaveLength(1);
  });

  it('the Map layer adds no dependency beyond the authorized renderer, gesture handler, React and React Native', () => {
    const specifiers = new Set<string>();
    for (const file of productionFiles(MAP_DIR)) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const match of code.matchAll(/from\s+'([^']+)'/gu)) {
        if (!match[1].startsWith('.')) specifiers.add(match[1]);
      }
    }
    expect([...specifiers].sort()).toEqual([
      '@qandeel/runtime',
      '@shopify/react-native-skia',
      'react',
      'react-native',
      'react-native-gesture-handler',
    ]);
  });
});
