/**
 * COSMOS-INT-01 Slice D CP4 (Contract §19.17) — the three-world closure invariants of the ONE Detail Sheet.
 *
 * Read from the shipped sources, so that a later change cannot quietly break the closure:
 *   - ONE sheet implementation (`cosmos/product/sheet/`), drawn by exactly the three World hosts: Personal
 *     (`LivingAnalysisMap`), Shared (`SharedLivingAnalysis`) and Public (`PublicLivingAnalysis`);
 *   - G-7: Personal is PEEK only (`allowExpanded={false}`); Shared and Public may expand;
 *   - SD-5: ONE authoritative hardware Back handler per host, and it asks the sheet FIRST; no sheet, and no Personal or
 *     Shared host component, registers a listener of its own;
 *   - SD-4: the Personal context choice has ONE home (the rail's instance draws none; the PEEK's draws only it);
 *   - SD-3 / G-7: the Personal PEEK carries no Conversation or Replay entry of its own.
 * The behaviour behind each line is proven by the World suites (`personal-detail-sheet`, `shared-detail-sheet`,
 * `public-detail-sheet`) and on the HONOR (§19.17); this file guards their shape.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

function production(dir: string): string[] {
  return readdirSync(join(SRC, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(SRC, path)).isDirectory()) return /^__\w+__$/u.test(name) ? [] : production(path);
    return /\.(ts|tsx)$/u.test(name) ? [path] : [];
  });
}

const PERSONAL = 'integration/composition/LivingAnalysisMap.tsx';
const SHARED = 'shared-world/field/SharedLivingAnalysis.tsx';
const PUBLIC = 'public-world/field/PublicLivingAnalysis.tsx';
const HOSTS = [PERSONAL, SHARED, PUBLIC];

describe('Slice D CP4 — one Detail Sheet across the three Worlds', () => {
  it('has ONE implementation, drawn by exactly the three World hosts', () => {
    const all = production('.').map((path) => relative('.', path).split('\\').join('/'));
    const drawing = all.filter((path) => /<CosmosDetailSheet\b/u.test(code(path))).sort();
    expect(drawing).toEqual([...HOSTS].sort());
    const defining = all.filter((path) => /export function (CosmosDetailSheet|useDetailSheet)\b/u.test(code(path))).sort();
    expect(defining).toEqual(['cosmos/product/sheet/CosmosDetailSheet.tsx', 'cosmos/product/sheet/useDetailSheet.ts']);
  });

  it('Personal is PEEK only; Shared and Public may expand (G-7)', () => {
    expect(code(PERSONAL)).toMatch(/<CosmosDetailSheet[^>]*\ballowExpanded=\{false\}/u);
    for (const host of [SHARED, PUBLIC]) expect(code(host)).toMatch(/<CosmosDetailSheet[^>]*\ballowExpanded(?=[\s>])/u);
  });

  it('every host has ONE hardware Back handler, and it asks the sheet first (SD-5)', () => {
    // Personal: the Analysis depth's handler in DepthComposition; Shared: the area's; Public: the field's own.
    const depth = code('integration/composition/DepthComposition.tsx');
    expect(depth.match(/sheetBack\.current\?\.\(\)/gu)).toHaveLength(1);
    expect(depth).toMatch(/if \(sheetBack\.current\?\.\(\) === true\) return true;\s*cross\('CONVERSATION'\);/u);
    const area = code('shared-world/SharedWorldArea.tsx');
    expect(area.match(/BackHandler\.addEventListener/gu)).toHaveLength(1);
    expect(area).toMatch(/sheetBack\.current\?\.\(\) === true\) return true;/u);
    expect(code(PUBLIC).match(/BackHandler\.addEventListener\('hardwareBackPress', \(\) => sheetBack\(\) \|\| controller\.back\(\)\)/gu)).toHaveLength(1);
    // No sheet, and no Personal or Shared host, listens on its own.
    for (const path of [PERSONAL, SHARED, ...production('cosmos/product/sheet')]) expect(code(path)).not.toMatch(/BackHandler/u);
  });

  it('the Personal context choice has ONE home, and the PEEK holds no Conversation or Replay entry (SD-3, SD-4)', () => {
    const personal = code(PERSONAL);
    // The rail's acts, the PEEK's choice and Overview's companion chip. An instance draws the choice unless it says
    // `choice={false}` or `extras={false}` (the prop defaults to `extras`, which defaults to true).
    const instances = personal.match(/<CosmosContextualActs\b[\s\S]*?\/>/gu) ?? [];
    expect(instances).toHaveLength(3);
    const drawing = instances.filter((props) => !/\bchoice=\{false\}|\bextras=\{false\}/u.test(props));
    expect(drawing).toHaveLength(1);
    expect(drawing[0]).toMatch(/\bacts=\{\[\]\}[\s\S]*\bnote=\{false\}[\s\S]*\btestID=\{PERSONAL_PEEK_CHOICE_TEST_ID\}/u);
    const peek = personal.slice(personal.indexOf('function PersonalPeek('));
    expect(peek).not.toMatch(/Replay|depth-to-conversation|openConversation/u);
  });
});
