/**
 * T-10.0 — the static guard the exploration contract requires (§9.1): production code cannot
 * import the Motion Lab. The lab is a disposable prototype owner; the Map barrel, the orientation
 * chrome, the app shell and every runtime Product module must stay unaware of it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..', '..');
const LAB = join(SRC, 'motion-lab');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/u.test(entry)) out.push(full);
  }
  return out;
}

const read = (file: string): string => readFileSync(file, 'utf8').replace(/\r\n/gu, '\n');

describe('motion lab isolation', () => {
  const production = walk(SRC).filter((file) => !file.startsWith(LAB + sep));

  test('no source file outside the lab imports, requires or mentions the lab', () => {
    expect(production.length).toBeGreaterThan(50);
    for (const file of production) {
      const text = read(file);
      expect({ file: relative(SRC, file), mentions: text.includes('motion-lab') }).toEqual({ file: relative(SRC, file), mentions: false });
    }
  });

  test('the app container and the technical shell are untouched by the lab', () => {
    const appEntries = readdirSync(join(SRC, 'app')).sort();
    expect(appEntries).toEqual(['_layout.tsx', 'index.tsx']);
    for (const file of ['app/_layout.tsx', 'app/index.tsx', 'shell/FoundationShell.tsx']) {
      const text = read(join(SRC, file));
      expect(text).not.toMatch(/MotionLab|motion-lab|LabWorld/u);
    }
  });

  test('the lab reaches production layers only through their public barrels', () => {
    const OWNER_BARRELS = new Set(['map', 'state', 'projection', 'temporal-navigation', 'return-navigation', 'orientation-chrome', 'timeline']);
    for (const file of walk(LAB)) {
      const text = read(file);
      for (const match of text.matchAll(/from\s+'(\.\.\/\.\.\/[^']+|\.\.\/[^']+)'/gu)) {
        const specifier = match[1];
        if (!specifier.startsWith('../../') && !file.endsWith('MotionLab.tsx') && !file.includes(`${sep}__tests__${sep}`)) continue;
        const outside = specifier.replace(/^(\.\.\/)+/u, '');
        if (specifier.startsWith('../../') || file.endsWith('MotionLab.tsx')) {
          expect({ file: relative(SRC, file), specifier, viaBarrel: OWNER_BARRELS.has(outside) }).toEqual({ file: relative(SRC, file), specifier, viaBarrel: true });
        }
      }
    }
  });

  test('the lab adds no dependency: every package it imports is already declared by the mobile app', () => {
    const manifest = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    const declared = new Set([...Object.keys(manifest.dependencies), 'react', 'react-native']);
    for (const file of walk(LAB)) {
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      const text = read(file);
      for (const match of text.matchAll(/from\s+'([^'.][^']*)'/gu)) {
        const specifier = match[1];
        const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
        expect({ file: relative(SRC, file), specifier, declared: declared.has(pkg) }).toEqual({ file: relative(SRC, file), specifier, declared: true });
      }
    }
  });

  test('no lab module reaches the canonical store except through the executors that already exist', () => {
    for (const file of walk(LAB)) {
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      const text = read(file);
      expect({ file: relative(SRC, file), direct: /\.dispatch(?:Map|Temporal|Return)?\(/u.test(text) }).toEqual({ file: relative(SRC, file), direct: false });
      // The lab never mints an authorization and never invents a Product act.
      expect(text).not.toMatch(/authorized\.add|WeakSet<|navigate\(|goHome\(|reset\(\)/u);
    }
  });
});
