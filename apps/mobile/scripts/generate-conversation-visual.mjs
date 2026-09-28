#!/usr/bin/env node
// W1A-01 — generate the Conversation surface's canonical visual constants FROM THE FROZEN SOURCES.
//
// Nothing below is typed by hand. Every colour is resolved through the vendored DTCG token tree by the
// canonical resolver (G3.2 `tokens.mjs`, which itself refuses to emit when a resolved value disagrees
// with the frozen brief); every glyph is produced by P2's own geometry functions (`sig.mjs` for the
// signature family, `utility.mjs` for the curated Hugeicons Free back chevron); the type roles come
// from I-08B3.0-E3's `system.json`; and the Conversation ↔ Analysis cross-fade comes from F2's own
// appearance-switch token. The output records a sha256 of every source it read, so a later change to
// any of them is visible as drift rather than silently inherited.
//
//   node apps/mobile/scripts/generate-conversation-visual.mjs          write the module
//   node apps/mobile/scripts/generate-conversation-visual.mjs --check  exit 1 if the module is stale
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const G32 = join(REPO, 'docs/design/canonical-artifacts/product-proofs/g3/g3.2/source');
const P2 = join(REPO, 'docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/source');
const E3_SYSTEM = join(REPO, 'docs/design/canonical-artifacts/typography/i-08b3.0-e3/tools/system.json');
const F2_TOKENS = join(G32, 'vendor/tokens/base/f2.appearance.tokens.json');
const OUT = join(REPO, 'apps/mobile/src/conversation/visual/canonical-visual.generated.ts');

const { palette } = await import(pathToFileURL(join(G32, 'src/tokens.mjs')).href);
const { SIG, NUANCES, strokeFor } = await import(pathToFileURL(join(P2, 'src/sig.mjs')).href);
const { utilInner } = await import(pathToFileURL(join(P2, 'src/utility.mjs')).href);

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rel = (path) => relative(REPO, path).replace(/\\/gu, '/');

// ---------------------------------------------------------------------------------------- colour
// The Conversation paints only in the Dark appearance in W1A (P1: Dark is the default and no
// appearance preference exists yet). Standard and Increased Contrast are both resolved.
function colours(contrast) {
  const p = palette('dark', { contrast });
  const c = p.colors;
  return {
    world: c.world,
    field: c.field,
    utterance: c.functional,
    primary: c.primary,
    secondary: c.secondary,
    tertiary: c.tertiary,
    restInk: c.restInk,
    pressedInk: c.pressedInk,
    pressedPresence: p.numbers.pressedPresence,
    focusIndicator: c.focusIndicator,
    focusCompanion: c.focusCompanion,
    focusThickness: p.numbers.focusThickness,
    focusCompanionThickness: p.numbers.focusCompanionThickness,
    focusOffset: p.numbers.focusOffset,
    error: c.error,
    routes: {
      world: p.routes.world.join(' → '),
      field: p.routes.field.join(' → '),
      utterance: p.routes.functional.join(' → '),
      restInk: p.routes.restInk.join(' → '),
      error: p.routes.error.join(' → '),
    },
  };
}

// ----------------------------------------------------------------------------------------- glyphs
/** Parse P2's inner SVG markup into drawing primitives Skia can take verbatim. */
function primitives(markup) {
  const strokes = [...markup.matchAll(/<path d="([^"]+)"[^>]*?stroke-width="([0-9.]+)"/gu)].map((m) => ({ d: m[1], strokeWidth: Number(m[2]) }));
  const dots = [...markup.matchAll(/<circle cx="([0-9.]+)" cy="([0-9.]+)" r="([0-9.]+)" fill="currentColor"/gu)]
    .map((m) => ({ cx: Number(m[1]), cy: Number(m[2]), r: Number(m[3]) }));
  if (strokes.length === 0) throw new Error(`no stroked path in glyph markup: ${markup}`);
  return { strokes, dots };
}

const open = NUANCES.open;
const glyphs = {
  // The composer's Send, at the proof's 24 px render size. Vertical: it never mirrors.
  send: { size: 24, mirrorsInRtl: false, ...primitives(SIG.send(open, 24)) },
  // «تحليل المحادثة»: the open world of THIS conversation, at the header's 22 px render size.
  depth: { size: 22, mirrorsInRtl: false, ...primitives(SIG.depth(open, 22)) },
};
// «المحادثة» (Analysis → Conversation): the curated Hugeicons Free chevron, re-weighted to the P2
// optical stroke. P2 draws "back" as the chevron turned to point backwards in a left-to-right reading
// (a horizontal flip), and flips it again under RTL: a directional glyph mirrors by MEANING.
const back = utilInner('back', { size: 22 });
if (!/<g transform="translate\(24 0\) scale\(-1 1\)">/u.test(back.inner)) throw new Error('P2 back is no longer the flipped chevron');
// The raw path is the library's right-pointing chevron: flipped horizontally for a left-to-right
// reading (so it points back, to the left) and drawn as-is for right-to-left (back is to the right).
glyphs.back = { size: 22, mirrorsInRtl: true, flipForLtr: true, ...primitives(back.inner) };
if (glyphs.back.strokes[0].strokeWidth !== strokeFor(22)) throw new Error('P2 back is not at the optical stroke for 22 px');

// ------------------------------------------------------------------------------------------ type
const system = JSON.parse(readFileSync(E3_SYSTEM, 'utf8'));
const role = (key) => {
  const r = system.roles.find((entry) => entry.key === key);
  if (!r) throw new Error(`E3 role ${key} is missing`);
  return { size: r.size, leading: r.leading, weight: r.weight };
};
const type = { body: role('body'), supporting: role('supporting'), action: role('action'), metadata: role('metadata') };
for (const [name, r] of Object.entries(type)) {
  if (r.leading / r.size < 1.6) throw new Error(`E3 ${name} leading falls under the Arabic 1.6 floor`);
  if (r.weight !== 400 && r.weight !== 500) throw new Error(`E3 ${name} needs weight ${r.weight}, which W1A does not ship`);
}

// ----------------------------------------------------------------------------------------- motion
const f2 = JSON.parse(readFileSync(F2_TOKENS, 'utf8')).qandeel.appearance.switch;
const crossfade = f2.crossfade.$value;
const crossfadeReduced = f2['crossfade-reduced-motion'].$value;
if (crossfade.unit !== 'ms' || crossfadeReduced.unit !== 'ms') throw new Error('F2 cross-fade is no longer in milliseconds');

// Exactly the token files the Dark resolution reads (standard + increased contrast), in load order.
const tokenFiles = ['base', 'dark', 'contrast'].flatMap((dir) =>
  readdirSync(join(G32, 'vendor/tokens', dir))
    .filter((name) => name.endsWith('.json') && (dir !== 'contrast' || name.startsWith('f1.dark')))
    .sort()
    .map((name) => join(G32, 'vendor/tokens', dir, name)));
const sources = [
  join(G32, 'src/tokens.mjs'),
  ...tokenFiles,
  join(P2, 'src/sig.mjs'),
  join(P2, 'src/utility.mjs'),
  join(P2, 'vendor/utility/utility-glyphs.json'),
  E3_SYSTEM,
];

const data = {
  palette: { standard: colours('standard'), increased: colours('increased') },
  glyphs,
  type,
  crossfadeMs: crossfade.value,
  crossfadeReducedMotionMs: crossfadeReduced.value,
};

const banner = `/**
 * GENERATED by apps/mobile/scripts/generate-conversation-visual.mjs — do not edit by hand.
 *
 * W1A-01: the Conversation surface's visual constants, resolved from the frozen canonical sources and
 * never copied from prose. Regenerate after any source changes; the W1A-01 contract fails on drift.
 *
 * Sources (sha256):
${sources.map((path) => ` *   ${rel(path)}  ${sha(path)}`).join('\n')}
 */
`;

const body = `${banner}
export const CANONICAL_VISUAL = ${JSON.stringify(data, null, 2)} as const;
`;

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8').replace(/\r\n/gu, '\n'); } catch { current = ''; }
  if (current !== body) {
    console.error(`${rel(OUT)} is stale: regenerate it with node apps/mobile/scripts/generate-conversation-visual.mjs`);
    process.exit(1);
  }
  console.log(`${rel(OUT)} is current`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body);
  console.log(`wrote ${rel(OUT)}`);
}
