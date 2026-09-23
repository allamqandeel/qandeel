/**
 * I-08B3.1-F2 — THE TOKEN FILES AND THE DERIVATION, HELD TOGETHER.
 *
 * ================================================================================================
 * WHY THIS TOOL CHECKS RATHER THAN GENERATES
 *
 * The obvious way to keep a token file in step with a derivation is to generate it. That would
 * make the agreement true by construction and therefore worth nothing: a check that the generator
 * produced what the generator produced is the shape of test I-08B3.1-F1R had to remove from the
 * parity matrix.
 *
 * So the token files are AUTHORED — they carry the Product's reasoning, its freeze classification
 * and its prose, and those are not derivable from arithmetic — and this tool asserts that every
 * value in them is the value the derivation reached. A number that drifts between the record and
 * the shipped tree fails here, before any raster is drawn.
 *
 * With `--write` it writes the derived values into the files instead, which is how the authored
 * files are brought back into step when a requirement changes and the search moves. The prose is
 * never touched by that path, and the check is what catches prose that then disagrees with it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hexToRgb8 } from './f2-color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const D = () => JSON.parse(readFileSync(join(PKG, 'data/F2_DERIVATION.json'), 'utf8'));

/** Every authored value, the file it lives in, the path to it, and where the derivation puts it. */
export const BINDINGS = (d) => [
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.world', 'colour', d.light.WORLD],
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.surface', 'colour', d.light.SURFACE],
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.content.primary', 'colour', d.light.PRIMARY],
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.content.secondary', 'colour', d.light.SECONDARY],
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.content.tertiary', 'colour', d.light.TERTIARY],
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.scrim', 'colour', d.light.SCRIM_INK],
  ['tokens/appearance/light/b4r.light.tokens.json', 'qandeel.expression.scrim', 'alpha', d.light.SCRIM_ALPHA],
  ['tokens/appearance/light/c3.light.material.tokens.json', 'qandeel.expression.material.living-brass.body', 'colour', d.light.BRASS],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.illumination.core', 'colour', d.light.CORE],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.illumination.mid', 'colour', d.light.MID],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.illumination.low', 'colour', d.light.LOW],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.illumination.bloom.split', 'number', d.winningFamily.shape.split],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.illumination.bloom.glaze-width', 'number', d.winningFamily.shape.width],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.atmosphere.luminance.near', 'number', d.atmosphere.layers[0].lightL],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.atmosphere.luminance.mid', 'number', d.atmosphere.layers[1].lightL],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.atmosphere.luminance.far', 'number', d.atmosphere.layers[2].lightL],
  ['tokens/appearance/light/d2r.light.illumination.tokens.json', 'qandeel.expression.atmosphere.chroma-ceiling', 'number', d.atmosphereCeilingLight],
  ['tokens/appearance/light/e1.light.interaction.tokens.json', 'qandeel.expression.status.error', 'colour', d.light.ERROR],
  ['tokens/appearance/light/e1.light.interaction.tokens.json', 'qandeel.expression.state.disabled', 'colour', d.light.DISABLED],
  ['tokens/appearance/light/f1.light.accessibility.tokens.json', 'qandeel.expression.accessibility.atmosphere.lightness-near', 'number', d.atmosphere.layers[0].lightL],
  ['tokens/appearance/light/f1.light.accessibility.tokens.json', 'qandeel.expression.accessibility.atmosphere.lightness-mid', 'number', d.atmosphere.layers[1].lightL],
  ['tokens/appearance/light/f1.light.accessibility.tokens.json', 'qandeel.expression.accessibility.atmosphere.lightness-far', 'number', d.atmosphere.layers[2].lightL],
  ['tokens/contrast/light.increased.tokens.json', 'qandeel.expression.accessibility.atmosphere.lightness-near', 'number', d.increasedContrast.lightnessNear],
  ['tokens/contrast/light.increased.tokens.json', 'qandeel.expression.accessibility.atmosphere.lightness-mid', 'number', d.increasedContrast.lightnessMid],
  ['tokens/contrast/light.increased.tokens.json', 'qandeel.expression.accessibility.atmosphere.lightness-far', 'number', d.increasedContrast.lightnessFar],
  ['tokens/transparency/light.reduced.tokens.json', 'qandeel.expression.scrim', 'colour', d.scrim.suppressed],
  ['tokens/base/appearance.tokens.json', 'qandeel.appearance.light-world-lightness', 'number', d.chosen.Lw],
];

const at = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

function readValue(file, path, kind) {
  const tree = JSON.parse(readFileSync(join(PKG, file), 'utf8'));
  const node = at(tree, path);
  if (!node || !('$value' in node)) return { missing: true };
  const v = node.$value;
  if (kind === 'colour') return { value: (v && typeof v === 'object' ? v.hex : v)?.toLowerCase() ?? null };
  if (kind === 'alpha') return { value: v && typeof v === 'object' ? v.alpha ?? null : null };
  return { value: v };
}

function writeValue(file, path, kind, want) {
  const p = join(PKG, file);
  const tree = JSON.parse(readFileSync(p, 'utf8'));
  const node = at(tree, path);
  if (!node) throw new Error(`f2-tokens: ${file} has no ${path}`);
  if (kind === 'colour') {
    const rgb = hexToRgb8(want).map((c) => +(c / 255).toFixed(6));
    node.$value = typeof node.$value === 'object' && node.$value.alpha !== undefined
      ? { colorSpace: 'srgb', components: rgb, alpha: node.$value.alpha, hex: want }
      : { colorSpace: 'srgb', components: rgb, hex: want };
  } else if (kind === 'alpha') {
    node.$value = { ...node.$value, alpha: want };
  } else {
    node.$value = want;
  }
  writeFileSync(p, JSON.stringify(tree, null, 2) + '\n', 'utf8');
}

export function check() {
  const d = D();
  return BINDINGS(d).map(([file, path, kind, want]) => {
    const got = readValue(file, path, kind);
    const ok = !got.missing && (kind === 'colour' ? got.value === String(want).toLowerCase() : got.value === want);
    return { file, path, kind, want, got: got.missing ? 'MISSING' : got.value, ok };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const write = process.argv.includes('--write');
  if (write) {
    const d = D();
    for (const [file, path, kind, want] of BINDINGS(d)) writeValue(file, path, kind, want);
    console.log('wrote', BINDINGS(d).length, 'derived values into the authored token files');
  }
  const rows = check();
  const bad = rows.filter((r) => !r.ok);
  for (const r of bad) console.log('  MISMATCH', r.file, r.path, 'token has', JSON.stringify(r.got), 'derivation says', JSON.stringify(r.want));
  console.log(`${rows.length - bad.length}/${rows.length} authored token values agree with data/F2_DERIVATION.json`);
  if (bad.length) process.exit(1);
}
