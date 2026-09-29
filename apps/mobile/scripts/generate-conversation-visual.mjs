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

// W3-01: F2 FINAL_CANONICAL — the general appearance authority — and its OWN resolver.
const F2R = join(REPO, 'docs/design/canonical-artifacts/accessibility-appearance/i-08b3.1-f2r');

const { palette } = await import(pathToFileURL(join(G32, 'src/tokens.mjs')).href);
const f2r = await import(pathToFileURL(join(F2R, 'tools/f2-resolve.mjs')).href);
const { SIG, NUANCES, strokeFor } = await import(pathToFileURL(join(P2, 'src/sig.mjs')).href);
const { utilInner } = await import(pathToFileURL(join(P2, 'src/utility.mjs')).href);

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rel = (path) => relative(REPO, path).replace(/\\/gu, '/');

// ---------------------------------------------------------------------------------------- colour
// W3-01: both canonical appearances, each at Standard and Increased Contrast. P1 §12 makes Dark the
// new-user default and lets the reader choose Light or System for non-Analysis surfaces. Nothing here
// is hand-picked: every family is resolved by F2 FINAL's OWN resolver (`f2-resolve.mjs`), which defines
// the four contexts — and in particular that Light + Increased Contrast loads F1's appearance-independent
// increased overrides (the control ink one rung up, the thicker focus perimeter) AND F2's Light file
// (`MODIFIERS.contrast.increased.light`). The G3.2 proof resolver loads only F2's Light file there, so its
// Light-increased family omits F1's overrides; for the three contexts it DOES compose like F2, the build
// refuses to emit unless it agrees with F2 value for value — which is also what proves the Dark family the
// app already shipped is unchanged — and `palette()` still asserts the brief's frozen literals.
// The Analysis consumes only the Dark family.

/** Each generated role, by the SAME semantic token the G3.2 palette resolves (its `ROLE_PATHS` key beside it). */
const ROLE_TOKENS = {
  world: ['qandeel.world.fill', 'world'],
  field: ['qandeel.role.field.fill', 'field'],
  utterance: ['qandeel.role.utterance.fill', 'functional'],
  primary: ['qandeel.content.primary', 'primary'],
  secondary: ['qandeel.content.secondary', 'secondary'],
  tertiary: ['qandeel.content.tertiary', 'tertiary'],
  restInk: ['qandeel.state.rest.ink', 'restInk'],
  pressedInk: ['qandeel.state.pressed.ink', 'pressedInk'],
  focusIndicator: ['qandeel.state.focus.indicator', 'focusIndicator'],
  focusCompanion: ['qandeel.state.focus.companion', 'focusCompanion'],
  error: ['qandeel.status.error.ink', 'error'],
  // E1R's selected state: the ink and the marker a selected choice carries — the marker is a SHAPE, so a
  // selected appearance is never told by colour alone.
  selectedInk: ['qandeel.state.selected.ink', 'selectedInk'],
  selectedMarker: ['qandeel.state.selected.marker', 'selectedMarker'],
};
const NUMBER_TOKENS = {
  pressedPresence: ['qandeel.state.pressed.presence', 'pressedPresence'],
  focusThickness: ['qandeel.state.focus.thickness', 'focusThickness'],
  focusCompanionThickness: ['qandeel.state.focus.companion-thickness', 'focusCompanionThickness'],
  focusOffset: ['qandeel.state.focus.offset', 'focusOffset'],
  markerThickness: ['qandeel.state.selected.marker-thickness', 'markerThickness'],
};
const ROUTED = ['world', 'field', 'utterance', 'restInk', 'error', 'selectedMarker'];

/** The contexts the G3.2 resolver composes exactly as F2 does: every one must agree with F2. */
const G32_COMPOSES_LIKE_F2 = (appearance, contrast) => !(appearance === 'light' && contrast === 'increased');

/**
 * The one role F2's tree does not carry: G1.1's utterance alias (closure §3), an appearance-independent
 * ALIAS to the functional Surface. It is read from its own frozen file and added to F2's resolution as the
 * alias it is — it supplies no value, so every appearance and contrast still owns the colour it reaches.
 */
const G11_UTTERANCE = join(G32, 'vendor/tokens/base/g11.utterance.alias.tokens.json');
const g11Alias = JSON.parse(readFileSync(G11_UTTERANCE, 'utf8')).qandeel.role.utterance.fill;
if (!/^\{[^}]+\}$/u.test(g11Alias.$value)) throw new Error('G1.1 utterance fill is no longer an alias');

function colours(appearance, contrast) {
  const { flat, applied } = f2r.loadTokens({ appearance, contrast });
  if (applied.appearance !== appearance || applied.contrast !== contrast) throw new Error(`F2 resolved ${JSON.stringify(applied)}, not ${appearance}/${contrast}`);
  if (flat.has('qandeel.role.utterance.fill')) throw new Error('F2 now defines the utterance role itself; drop the G1.1 alias here');
  flat.set('qandeel.role.utterance.fill', { value: g11Alias.$value, file: 'g11/base', type: 'color', node: g11Alias });
  const out = {};
  const routes = {};
  for (const [role, [token]] of Object.entries(ROLE_TOKENS)) {
    const r = f2r.resolve(flat, token);
    if (typeof r.value !== 'string' || !/^#[0-9a-f]{6}$/u.test(r.value) || (r.alpha !== undefined && r.alpha !== 1)) {
      throw new Error(`${appearance}/${contrast} ${token} did not resolve to an opaque colour: ${JSON.stringify(r.value)}`);
    }
    out[role] = r.value;
    if (ROUTED.includes(role)) routes[role] = r.chain.join(' → ');
  }
  for (const [name, [token]] of Object.entries(NUMBER_TOKENS)) {
    const v = f2r.resolve(flat, token).value;
    out[name] = typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
    if (typeof out[name] !== 'number') throw new Error(`${appearance}/${contrast} ${token} is not a number`);
  }
  if (G32_COMPOSES_LIKE_F2(appearance, contrast)) {
    const g = palette(appearance, { contrast });
    for (const [role, [token, key]] of Object.entries(ROLE_TOKENS)) {
      if (g.colors[key] !== out[role]) throw new Error(`F2 and G3.2 DISAGREE: ${appearance}/${contrast} ${token} F2 ${out[role]} vs G3.2 ${g.colors[key]}`);
    }
    for (const [name, [token, key]] of Object.entries(NUMBER_TOKENS)) {
      if (g.numbers[key] !== out[name]) throw new Error(`F2 and G3.2 DISAGREE: ${appearance}/${contrast} ${token} F2 ${out[name]} vs G3.2 ${g.numbers[key]}`);
    }
  }
  return {
    world: out.world,
    field: out.field,
    utterance: out.utterance,
    primary: out.primary,
    secondary: out.secondary,
    tertiary: out.tertiary,
    restInk: out.restInk,
    pressedInk: out.pressedInk,
    pressedPresence: out.pressedPresence,
    focusIndicator: out.focusIndicator,
    focusCompanion: out.focusCompanion,
    focusThickness: out.focusThickness,
    focusCompanionThickness: out.focusCompanionThickness,
    focusOffset: out.focusOffset,
    error: out.error,
    selectedInk: out.selectedInk,
    selectedMarker: out.selectedMarker,
    markerThickness: out.markerThickness,
    routes,
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
// W3-01 — «الإعدادات» / Settings (P4-C1 S-B): P2's curated Hugeicons Free `settings` utility glyph, at the
// 22 px the S-B proof drew it, re-weighted to the P2 optical stroke. A gear is not directional: it never mirrors.
const settings = utilInner('settings', { size: 22 });
glyphs.settings = { size: 22, mirrorsInRtl: false, ...primitives(settings.inner) };
if (glyphs.settings.strokes.some((stroke) => stroke.strokeWidth !== strokeFor(22))) throw new Error('P2 settings is not at the optical stroke for 22 px');

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
// W1B-01: E3's display role, for the account entry's titles and the first-use statements. E3 froze
// its leading with the role; the 1.6 floor above governs running text, and this role sets short
// statements only. It is set in the Medium face W1A already ships.
const display = { statement: role('statement') };
if (display.statement.weight !== 500) throw new Error(`E3 statement needs weight ${display.statement.weight}, which the app does not ship`);

// ----------------------------------------------------------------------------------------- motion
const f2 = JSON.parse(readFileSync(F2_TOKENS, 'utf8')).qandeel.appearance.switch;
const crossfade = f2.crossfade.$value;
const crossfadeReduced = f2['crossfade-reduced-motion'].$value;
if (crossfade.unit !== 'ms' || crossfadeReduced.unit !== 'ms') throw new Error('F2 cross-fade is no longer in milliseconds');

// Exactly the token files the Dark and Light resolutions read (standard + increased contrast), in load order.
const tokenFiles = ['base', 'dark', 'light', 'contrast'].flatMap((dir) =>
  readdirSync(join(G32, 'vendor/tokens', dir))
    .filter((name) => name.endsWith('.json') && (dir !== 'contrast' || name.startsWith('f1.dark') || name.startsWith('f2.light')))
    .sort()
    .map((name) => join(G32, 'vendor/tokens', dir, name)));
// W3-01: F2's resolver and every F2 token file it loads for the four contexts, in first-load order.
const f2TokenFiles = [...new Set(['dark', 'light'].flatMap((appearance) => ['standard', 'increased']
  .flatMap((contrast) => f2r.loadTokens({ appearance, contrast }).sources.map((source) => source.rel))))]
  .map((path) => join(F2R, path));
const sources = [
  join(G32, 'src/tokens.mjs'),
  ...tokenFiles,
  join(F2R, 'tools/f2-resolve.mjs'),
  ...f2TokenFiles,
  G11_UTTERANCE,
  join(P2, 'src/sig.mjs'),
  join(P2, 'src/utility.mjs'),
  join(P2, 'vendor/utility/utility-glyphs.json'),
  E3_SYSTEM,
];

const data = {
  // Keyed by the effective appearance the app's ONE appearance authority publishes (`DARK` | `LIGHT`).
  palettes: {
    DARK: { standard: colours('dark', 'standard'), increased: colours('dark', 'increased') },
    LIGHT: { standard: colours('light', 'standard'), increased: colours('light', 'increased') },
  },
  glyphs,
  type,
  display,
  crossfadeMs: crossfade.value,
  crossfadeReducedMotionMs: crossfadeReduced.value,
};

const banner = `/**
 * GENERATED by apps/mobile/scripts/generate-conversation-visual.mjs — do not edit by hand.
 *
 * W1A-01: the Conversation surface's visual constants, resolved from the frozen canonical sources and
 * never copied from prose. Regenerate after any source changes; the W1A-01 contract fails on drift.
 * W3-01: the Light family beside the Dark one, from the same resolver and the frozen Light token files.
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
