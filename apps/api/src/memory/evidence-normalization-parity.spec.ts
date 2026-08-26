import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeExact, projectEligibleEvidence } from './evidence.service';
import type { MemoryRecord } from './memory.types';

// The golden fixtures are the shared contract between this projector and the
// canonical SQL primitive public.canonical_evidence_content_key_v1 added by
// migration 0028. This file proves the TypeScript half; database/
// verify-migration-0028.mjs proves the PostgreSQL half against the same file,
// which is what makes the two behaviourally identical rather than merely
// similar.
const FIXTURE_PATH = join(__dirname, '..', '..', '..', '..', 'database', 'fixtures', 'canonical-evidence-normalization-v1.json');

interface NormalizationFixture { readonly name: string; readonly raw: string; readonly expected: string }
interface FixtureFile {
  readonly contract: string;
  readonly normalization: ReadonlyArray<NormalizationFixture>;
  readonly duplicateGroups: ReadonlyArray<ReadonlyArray<string>>;
}

const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as FixtureFile;
const byName = new Map(fixtures.normalization.map((row) => [row.name, row]));
const NOW = new Date('2026-08-17T12:00:00.000Z');

function memory(id: string, content: string, updatedAt: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id, user_id: 'user-1', scope: 'USER', type: 'PERSONAL_FACT', content, source: 'USER_STATED',
    confidence: 0.9, importance: 0.6, status: 'ACTIVE', version: 1,
    created_at: '2026-08-10T10:00:00.000Z', updated_at: updatedAt,
    expires_at: null, supersedes_memory_id: null, ...overrides,
  };
}

describe('canonical Evidence normalization parity fixtures', () => {
  it('states the canonical contract it is a golden file for', () => {
    expect(fixtures.contract).toBe(String.raw`value.normalize('NFKC').trim().replace(/\s+/gu, ' ')`);
    expect(fixtures.normalization.length).toBeGreaterThanOrEqual(20);
  });

  it.each(fixtures.normalization.map((row) => [row.name, row.raw, row.expected] as const))(
    'normalizes %s to the golden key', (_name, raw, expected) => expect(normalizeExact(raw)).toBe(expected),
  );

  it('covers every whitespace class the parity contract names', () => {
    const covered = new Set(fixtures.normalization.map((row) => row.name));
    for (const required of [
      'ascii-leading-trailing', 'ascii-repeated-interior', 'tab', 'newline-crlf',
      'nbsp-u00a0', 'em-space-u2003', 'ideographic-space-u3000', 'ogham-space-u1680',
      'line-paragraph-separator', 'bom-zwnbsp-ufeff', 'fullwidth-nfkc', 'ligature-nfkc',
      'nfd-combining-accent', 'mixed-unicode-whitespace-nfkc',
    ]) expect(covered.has(required)).toBe(true);
  });

  it.each(fixtures.duplicateGroups.map((names, index) => [index, names] as const))(
    'collapses duplicate group %i to a single Evidence item', (_index, names) => {
      const candidates = names.map((name, position) => memory(
        `${String(position).padStart(8, '0')}-0000-4000-8000-000000000000`,
        byName.get(name)!.raw,
        // Newest first so the first name in the group is the canonical winner.
        new Date(Date.parse('2026-08-16T10:00:00.000Z') - position * 60_000).toISOString(),
      ));
      const items = projectEligibleEvidence('user-1', candidates, NOW);
      expect(items).toHaveLength(1);
      expect(items[0].statement).toBe(byName.get(names[0])!.raw);
    },
  );

  it('keeps rows apart when the normalized content, source, or type differs', () => {
    const canonical = byName.get('already-canonical')!.raw;
    const conflict = byName.get('semantic-conflict')!.raw;
    const items = projectEligibleEvidence('user-1', [
      memory('00000000-0000-4000-8000-000000000001', canonical, '2026-08-16T10:00:00.000Z'),
      memory('00000000-0000-4000-8000-000000000002', conflict, '2026-08-16T09:00:00.000Z'),
      memory('00000000-0000-4000-8000-000000000003', canonical, '2026-08-16T08:00:00.000Z', { source: 'USER_CONFIRMED' }),
      memory('00000000-0000-4000-8000-000000000004', canonical, '2026-08-16T07:00:00.000Z', { type: 'GOAL' }),
    ], NOW);
    expect(items.map((item) => item.originatingMemoryId)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004',
    ]);
  });

  it('breaks a duplicate tie on equal updated_at by the lowest id', () => {
    const raw = byName.get('ascii-leading-trailing')!.raw;
    const items = projectEligibleEvidence('user-1', [
      memory('00000000-0000-4000-8000-00000000000b', raw, '2026-08-16T10:00:00.000Z'),
      memory('00000000-0000-4000-8000-00000000000a', byName.get('already-canonical')!.raw, '2026-08-16T10:00:00.000Z'),
    ], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].originatingMemoryId).toBe('00000000-0000-4000-8000-00000000000a');
  });
});
