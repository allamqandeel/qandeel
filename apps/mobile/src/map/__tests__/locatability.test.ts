import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { disclosureFixture } from '../__fixtures__/disclosure';
import { sceneOf, testStore } from '../__fixtures__/store';
import { entitledLoci, isEntitledLocus, locusForBinding, resolveLocatability } from '../inspection';

const WORLD = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '9000000', y: '0' },
];

const scene = (appearances: readonly { bindingId: string; threadId: string; readingId: string; boundSp: number }[]) =>
  sceneOf(
    testStore({ depth: 'ANALYTICAL_OBJECT' }),
    disclosureFixture({
      depth: 'ANALYTICAL_OBJECT',
      threads: WORLD,
      appearances,
      readings: [{ id: 'reading-1' }, { id: 'reading-orphan' }],
      focuses: [{ id: 'focus-1', startedSp: 1 }],
    }),
  );

describe('the locatability substrate for T-06 / T-07', () => {
  it('answers zero, one or many over disclosed V alone', () => {
    const none = scene([]);
    expect(resolveLocatability(none, 'READING', 'reading-orphan')).toEqual({ outcome: 'NO_LEGITIMATE_LOCUS' });
    expect(resolveLocatability(none, 'EMERGING_FOCUS', 'focus-1')).toEqual({ outcome: 'NO_LEGITIMATE_LOCUS' });

    const one = scene([{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }]);
    const unique = resolveLocatability(one, 'READING', 'reading-1');
    expect(unique.outcome).toBe('UNIQUE_LOCUS');

    const many = scene([
      { bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
      { bindingId: 'binding-2', threadId: 'thread-b', readingId: 'reading-1', boundSp: 3 },
    ]);
    const multiple = resolveLocatability(many, 'READING', 'reading-1');
    expect(multiple.outcome).toBe('MULTIPLE_LEGITIMATE_LOCI');
    if (multiple.outcome !== 'MULTIPLE_LEGITIMATE_LOCI') return;
    expect(multiple.loci).toHaveLength(2);
    expect(multiple.loci.every((locus) => isEntitledLocus(locus))).toBe(true);
  });

  it('a Thread is located at its own permanent Home, and an identity absent from the scene has none', () => {
    const world = scene([]);
    const thread = resolveLocatability(world, 'THREAD', 'thread-b');
    expect(thread.outcome).toBe('UNIQUE_LOCUS');
    if (thread.outcome !== 'UNIQUE_LOCUS') return;
    expect(thread.locus.locus.kind).toBe('THREAD_HOME');
    expect(thread.locus.anchor.x).toBe(9_000_000n);
    expect(thread.locus.destination).toMatchObject({ locus: 'THREAD_HOME', threadId: 'thread-b', bindingId: null });
    expect(resolveLocatability(world, 'THREAD', 'thread-absent')).toEqual({ outcome: 'NO_LEGITIMATE_LOCUS' });
  });

  it('a contextual locus carries its host Home and never a coordinate of its own', () => {
    const one = scene([{ bindingId: 'binding-1', threadId: 'thread-b', readingId: 'reading-1', boundSp: 2 }]);
    const locus = locusForBinding(one, 'READING', 'reading-1', 'binding-1');
    expect(locus).not.toBeNull();
    expect(locus?.anchor.x).toBe(9_000_000n);
    expect(locus?.destination.bindingId).toBe('binding-1');
    expect(locusForBinding(one, 'READING', 'reading-1', 'binding-absent')).toBeNull();
    expect(entitledLoci(one, 'READING', 'reading-orphan')).toEqual([]);
  });

  it('it executes none of the later-task acts it exists to serve', () => {
    const source = readFileSync(join(__dirname, '..', 'inspection', 'locatability.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
    for (const act of [
      'COMMIT_MOMENT_AND_LOCATE',
      'CHOOSE_LOCUS',
      'RETURN_LIVE_FOCUS',
      'RETURN_LIVE_HEAD',
      'GO_LIVE_AND_LOCATE',
      'RETURN_WORLD',
      'EXACT_RETURN',
      'BACK_ONE_STEP',
    ]) {
      expect(code.includes(act)).toBe(false);
    }
    expect(code.includes('dispatch')).toBe(false);
  });
});
