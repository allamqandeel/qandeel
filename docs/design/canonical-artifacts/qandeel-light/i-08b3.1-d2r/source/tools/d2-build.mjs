/**
 * I-08B3.1-D2R — THE BUILD.
 *
 * Emits ONE page carrying all four categories, and refuses to emit it if any of six gates
 * fails. A gate here is not a test that reports; it throws, and the page is not written.
 *
 *   GATE 1  THE CHROME IS RESOLVED, NOT COPIED — by value AND by alias route, from the token
 *           files I-08B3.1-C3 sealed, vendored byte-identical under source/vendor/c3/.
 *   GATE 2  THE TYPEFACE IS A DEPENDENCY — Estedad v8.5 resolved from the project-local
 *           runtime and recorded by hash. No font byte enters this package.
 *   GATE 3  THE SETTLED RELATION PASSES 3:1 — D1's foundation alignment, re-measured here
 *           rather than inherited as a sentence.
 *   GATE 4  THE CANDIDATE LIGHT MEETS ITS OWN REQUIREMENT — the separation from Living Brass
 *           is re-derived from the colour that is about to be written into the page.
 *   GATE 5  ATMOSPHERE IS NEVER THE MOST COLOURFUL THING — every ring ink's chroma is below
 *           both the identity material's and the Light's dimmest stop.
 *   GATE 6  GEOMETRY DOES NOT MANUFACTURE MEANING — every ambient visual property is declared,
 *           and none may claim an encoding without naming a canonical contract that grants it.
 *           Added in D2R; its absence is why D2 shipped five invented encodings.
 *
 * WHY ONE PAGE AND NOT FOUR. D1 learned that capturing several sequences from one document is a
 * STRICTER control than one document each: one browser, one layer tree, one font activation, no
 * cross-page variance to explain away. It is only safe because hiding an element here writes its
 * entire hidden state — see `clear` in d2-render.mjs — and the per-frame DOM digest proves it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isMain } from './d2-main.mjs';
import { resolveChrome } from './d2-chrome.mjs';
import { resolveFont } from './d2-font.mjs';
import {
  srgbToOklch, hexToRgb8, contrastHex,
} from '../vendor/color.mjs';
import { FOUNDATION, CHROME, LIGHT, LIGHT_DIAGNOSTIC, VIEW, FRAME, MARK, ATMOSPHERE, T, TA } from '../scene/d2-foundation.mjs';
import {
  fieldData, WORLDS, PARALLAX, TOPICS, PRESENTATION_CONTRACT, contractViolations,
  TOPIC_KEYS, FIELD_KEYS,
} from '../scene/d2-world.mjs';
import {
  PATTERN_GEOMETRY, PATTERN_LOCUS, PATTERN_LABEL, PATTERN_SUBLABEL,
  INSIGHT_SITE, INSIGHT_TEXT, INSIGHT_LABEL, INSIGHT_SIZE, INSIGHT_KEEL,
} from '../scene/d2-events.mjs';
import { separationFromBrass, BRASS } from './d2-lightsearch.mjs';
import { GEO, COPY } from '../vendor/d1/d1-scene.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');
const PKG = join(SRC, '..');
const FACE = `'QD-Estedad',system-ui,sans-serif`;

/* ================================================================== gate 1: chrome ==== */
const RESOLVED = resolveChrome();

function gateChrome() {
  const expect = {
    identityMark: CHROME.identityMark,
    navigationMachinery: CHROME.navigationMachinery,
    controlFunctional: CHROME.controlFunctional,
    analysisNode: CHROME.analysisNode,
    analysisRelation: CHROME.analysisRelation,
  };
  for (const [role, hex] of Object.entries(expect)) {
    const r = RESOLVED.chrome[role];
    if (!r) throw new Error(`d2-build: gate 1 — the token tree has no role '${role}'`);
    if (r.value.toLowerCase() !== hex.toLowerCase()) {
      throw new Error(`d2-build: gate 1 — '${role}' resolves to ${r.value}, the scene says ${hex}`);
    }
    if (!Array.isArray(r.chain) || r.chain.length < 2) {
      throw new Error(`d2-build: gate 1 — '${role}' resolved without an alias chain; a value that is right by coincidence is a copy`);
    }
  }
  /**
   * THE WHOLE FROZEN FOUNDATION, not only the parts this scene paints with.
   *
   * Six roles, every one of them asserted. A build that checked only the colours it happened to
   * use would pass on a token tree in which SECONDARY had drifted, and would keep passing until
   * the first package that needed SECONDARY.
   */
  for (const [role, hex] of Object.entries(FOUNDATION)) {
    const r = RESOLVED.foundation[role];
    if (!r) throw new Error(`d2-build: gate 1 — the token tree has no foundation role '${role}'`);
    if (r.value.toLowerCase() !== hex.toLowerCase()) {
      throw new Error(`d2-build: gate 1 — foundation '${role}' resolves to ${r.value}, the scene says ${hex}`);
    }
  }
  return RESOLVED;
}

/* ==================================================================== gate 2: font ==== */
const FONT = resolveFont();

/* ================================================== gate 3: the settled relation ====== */
const RELATION_CONTRAST = {
  hex: CHROME.analysisRelation,
  ratio: +contrastHex(CHROME.analysisRelation, FOUNDATION.WORLD).toFixed(2),
  superseded: { hex: '#4a4740', ratio: +contrastHex('#4a4740', FOUNDATION.WORLD).toFixed(2) },
};
function gateRelation() {
  if (RELATION_CONTRAST.ratio < 3) {
    throw new Error(`d2-build: gate 3 — the settled relation is ${RELATION_CONTRAST.ratio}:1 on the World and a graphical object needs 3:1 under WCAG 2.2 SC 1.4.11`);
  }
}

/* ===================================================== gate 4: the candidate Light ==== */
const LIGHT_SEPARATION = separationFromBrass({ CORE: LIGHT.CORE, MID: LIGHT.MID, LOW: LIGHT.LOW });
function gateLight() {
  if (LIGHT_SEPARATION.dE + 1e-9 < LIGHT.separationRequired) {
    throw new Error(`d2-build: gate 4 — the candidate Light is ${LIGHT_SEPARATION.dE.toFixed(4)} from Living Brass and its own requirement is ${LIGHT.separationRequired}`);
  }
  if (Math.abs(LIGHT_SEPARATION.dE - LIGHT.separationFromBrass) > 5e-4) {
    throw new Error(`d2-build: gate 4 — the scene records a separation of ${LIGHT.separationFromBrass} and the colour in it measures ${LIGHT_SEPARATION.dE.toFixed(4)}`);
  }
}

/* ============================================ gate 5: atmosphere is the quiet one ===== */
const chromaOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255))[1];
const FIELD = fieldData();

function gateAtmosphere() {
  const brassC = chromaOf(BRASS);
  const lightC = Math.min(...['CORE', 'MID', 'LOW'].map((k) => chromaOf(LIGHT[k])));
  for (const t of FIELD) {
    const c = chromaOf(t.ink);
    if (c >= lightC || c >= brassC) {
      throw new Error(`d2-build: gate 5 — the ring ink for '${t.id}' is chroma ${c.toFixed(4)}, which is not below Light (${lightC.toFixed(4)}) and Matter (${brassC.toFixed(4)})`);
    }
  }
  return { brassC, lightC, ringMax: Math.max(...FIELD.map((t) => chromaOf(t.ink))) };
}

/* ========================== gate 6: GEOMETRY DOES NOT MANUFACTURE MEANING ============= */
/**
 * THE GATE I-08B3.1-D2 DID NOT HAVE, AND THE REASON IT SHIPPED A CONTRADICTION.
 *
 * D2 attached Product meaning to presentation geometry — radius as quantity, depth as recency,
 * a contour gap as a sharing fraction, dimness as how much was known, contour shape as a
 * permanent identity — none of it authorised by any frozen contract. Nothing in the build could
 * see it, because the claims lived in prose and prose is not an input to anything.
 *
 * So the claims now live in a DATA STRUCTURE the build reads: every ambient visual property is
 * declared in PRESENTATION_CONTRACT, and a property that claims to encode anything must name the
 * canonical source that grants it. Three further assertions stop a quantity sneaking back in by
 * the side door — a new key on a topic record, a new key crossing the wire to the page, or a
 * per-topic value on the world treatments, which is exactly where D2's dash pattern hid.
 */
function gateGeometry() {
  const fail = [...contractViolations()];

  const declared = new Set(Object.keys(PRESENTATION_CONTRACT));
  for (const need of ['ring.radius', 'ring.layer', 'ring.contourCount', 'ring.contourShape', 'ring.hue', 'world.treatment', 'field.parallax']) {
    if (!declared.has(need)) fail.push(`the presentation contract does not declare '${need}'`);
  }

  for (const t of TOPICS) {
    for (const k of Object.keys(t)) {
      if (!TOPIC_KEYS.includes(k)) fail.push(`topic '${t.id}' carries '${k}', which is not a declared presentation key — a number in a scene file is a thing a later reader will find a use for`);
    }
  }
  for (const f of FIELD) {
    for (const k of Object.keys(f)) {
      if (!FIELD_KEYS.includes(k)) fail.push(`the field data sent to the page carries '${k}', which is not a declared presentation key`);
    }
  }
  /* A world treatment must be uniform. Anything indexed by topic here is a per-topic quantity. */
  for (const [name, w] of Object.entries(WORLDS)) {
    for (const [k, v] of Object.entries(w)) {
      if (k === 'strokeAlpha') continue;
      if (Array.isArray(v) || (v && typeof v === 'object')) {
        fail.push(`world '${name}' property '${k}' is a collection; a world treatment must be one value applied identically to every topic`);
      }
    }
  }

  if (fail.length) {
    throw new Error('d2-build: gate 6 — GEOMETRY DOES NOT MANUFACTURE MEANING —\n  - ' + fail.join('\n  - '));
  }
  return { declared: declared.size, topics: TOPICS.length, worlds: Object.keys(WORLDS).length };
}

/* ================================================================ module inlining ===== */
/**
 * A MINI-BUNDLER, AND IT HAD TO BE ONE.
 *
 * D1 inlined its modules by stripping `import`/`export` tokens and concatenating. That works
 * when the modules share no export names. D2 inlines NINE modules, three of them D1's own, and
 * they collide six times over — `T`, `LIGHT`, `CHROME`, `FOUNDATION`, `VIEW`, `KEYFRAMES`,
 * `mix` and `makeRenderer` all exist twice. Concatenating would produce a duplicate `const` in
 * one scope, which is a SyntaxError, and the page would render nothing.
 *
 * So each module becomes a closure that returns its own exports, and each module's imports
 * become a destructure from the namespace it named. The transform is crude and it is CHECKED:
 * an unresolved import name, a surviving ES token, or a module that exports nothing all throw.
 */
const NS = (rel) => 'M_' + rel.replace(/^.*\//, '').replace(/\.mjs$/, '').replace(/[^a-zA-Z0-9]/g, '_');

function bundle(rels) {
  const out = [];
  const known = new Map();
  for (const rel of rels) {
    const text = readFileSync(join(SRC, rel), 'utf8');
    const ns = NS(rel);

    const imports = [];
    let body = text.replace(/^import\s+\{([\s\S]*?)\}\s+from\s+'([^']*)';?[ \t]*$/gm, (_, names, from) => {
      const target = NS(from);
      if (!known.has(target)) {
        throw new Error(`d2-build: ${rel} imports from '${from}' which has not been bundled yet`);
      }
      const list = names.split(',').map((s) => s.trim()).filter(Boolean);
      for (const n of list) {
        if (!known.get(target).includes(n)) {
          throw new Error(`d2-build: ${rel} imports '${n}' from '${from}', which does not export it`);
        }
      }
      imports.push(`const { ${list.join(', ')} } = ${target};`);
      return '';
    });

    const names = new Set();
    body = body.replace(/^export\s+(const|function|let|class)\s+([A-Za-z0-9_$]+)/gm, (_, kind, name) => {
      names.add(name);
      return `${kind} ${name}`;
    });
    body = body.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_, list) => {
      for (const n of list.split(',').map((s) => s.trim()).filter(Boolean)) names.add(n);
      return '';
    });

    const leak = body.match(/^[ \t]*(import|export)\b.*$/m);
    if (leak) throw new Error(`d2-build: inlining left an ES token in ${rel}: ${JSON.stringify(leak[0].trim())}`);
    if (!names.size) throw new Error(`d2-build: ${rel} exported nothing after inlining, which means the transform missed it`);

    known.set(ns, [...names]);
    out.push(`/* ==== ${rel} ==== */\nconst ${ns} = (function(){\n${imports.join('\n')}\n${body}\nreturn { ${[...names].join(', ')} };\n})();`);
  }
  return { code: out.join('\n\n'), known };
}

/* ------------------------------------------------------------------ canonical Q ------ */
/** Parsed out of the canonical master, never transcribed. */
function canonicalQ() {
  const svg = readFileSync(join(SRC, 'vendor', 'QANDEEL_Q_BASE_MASTER.svg'), 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/);
  const ds = [...svg.matchAll(/<path id="(q-[a-z-]+)" d="([^"]+)"\/>/g)].map((m) => m[2]);
  if (!vb || ds.length !== 3) {
    throw new Error(`d2-build: the canonical Q master did not parse (viewBox=${!!vb}, paths=${ds.length})`);
  }
  return { viewBox: vb[1], paths: ds };
}

/* ------------------------------------------------------------------------ markup ----- */
const navIcon = (d) => `<svg class="nav-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const NAV = [
  '<path d="M4 12h16M4 7h16M10 17h10"/>',
  '<circle cx="12" cy="12" r="7.5"/><path d="M12 7.5v5l3 2"/>',
  '<path d="M12 4.5 19 9v10H5V9z"/>',
  '<path d="M6 18V9M12 18V5M18 18v-6"/>',
  '<circle cx="12" cy="9" r="3.2"/><path d="M5.5 19c1.2-3 3.8-4.5 6.5-4.5S17.3 16 18.5 19"/>',
].map(navIcon).join('');

const quietMarkup = GEO.quiet.map((q, i) => `
      <div class="quiet-item" style="left:${q.x}px;top:${q.y}px;font-size:${q.size}px" data-qi="${i}">${q.text}</div>`).join('');

function atmosMarkup() {
  return [2, 1, 0].map((p) => {
    const inPlane = FIELD.map((t, i) => ({ t, i })).filter((r) => r.t.layer === p);
    const fills = inPlane.map(({ t, i }) => `
        <path class="ring-fill" data-topic="${i}" d="${t.rings[0].d}" fill="${t.ink}" opacity="0"/>`).join('');
    const strokes = inPlane.map(({ t, i }) => t.rings.map((r, ri) => `
        <path class="ring" data-topic="${i}" data-ring="${ri}" d="${r.d}" fill="none" stroke="${t.ink}" stroke-width="1" opacity="0"/>`).join('')).join('');
    return `      <g id="plane-${p}">${fills}${strokes}
      </g>`;
  }).join('\n');
}

function labelMarkup() {
  return [2, 1, 0].map((p) => {
    const items = FIELD.map((t, i) => ({ t, i })).filter((r) => r.t.layer === p)
      /* AT THE CENTRE OF ITS OWN CONTOUR, the way a name sits inside a contour on a map — and
         the way I-08B3.1-D1's quiet analytical material already sits, at these same
         coordinates. Hung below the ring instead, the same eight names produced two labelling
         conventions in one world the moment the inherited control was rendered beside them. */
      .map(({ t, i }) => `
      <div class="topic-label" data-topic="${i}" style="left:${t.x}px;top:${t.y}px;font-size:${p === 0 ? 12 : p === 1 ? 11.5 : 11}px">${t.label}</div>`).join('');
    return `    <div class="label-plane" id="labels-${p}">${items}
    </div>`;
  }).join('\n');
}

const G = PATTERN_GEOMETRY;
/** One membership link per member, EACH DRAWN FROM THE LOCUS OUTWARD so they grow together. */
const linkPaths = G.links.map((l) => `M ${l.from.x.toFixed(2)} ${l.from.y.toFixed(2)} L ${l.to.x.toFixed(2)} ${l.to.y.toFixed(2)}`);
const keelPath = `M ${(INSIGHT_SITE.x - INSIGHT_KEEL.halfWidth).toFixed(2)} ${(INSIGHT_SITE.y + INSIGHT_KEEL.dy).toFixed(2)} L ${(INSIGHT_SITE.x + INSIGHT_KEEL.halfWidth).toFixed(2)} ${(INSIGHT_SITE.y + INSIGHT_KEEL.dy).toFixed(2)}`;

/* ========================================================================== the page == */
function page() {
  const Q = canonicalQ();
  const qW = (23 * 1.02).toFixed(2);
  const { code } = bundle([
    'vendor/color.mjs',
    'vendor/d1/d1-scene.mjs',
    'vendor/d1/d1-render.mjs',
    'vendor/d1/d1-arrivals.mjs',
    'scene/d2-foundation.mjs',
    'scene/d2-world.mjs',
    'scene/d2-events.mjs',
    'scene/d2-connection.mjs',
    'scene/d2-render.mjs',
  ]);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>QANDEEL — I-08B3.1-D2R — نظام الضوء</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
/* THE TYPEFACE IS A DEPENDENCY, NOT A PAYLOAD. Estedad ${FONT.version}, sha256
   ${FONT.sha256}, referenced from the project-local runtime and NOT shipped
   inside this package in any encoding. */
@font-face{
  font-family:'QD-Estedad';
  font-style:normal;
  font-weight:100 900;
  font-display:block;
  src:url(${JSON.stringify(FONT.url)}) format('woff2');
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:${FOUNDATION.WORLD};height:100%;overflow:hidden}
body{font-family:${FACE};-webkit-font-smoothing:antialiased}

#stage{position:relative;width:${VIEW.W}px;height:${VIEW.H}px;background:${FOUNDATION.WORLD};overflow:hidden}

/* THE ATMOSPHERE. Static geometry, computed at build time, painted once. The only thing ever
   written to it at runtime is a translateX carrying the user's own hand. */
#atmos{position:absolute;inset:0;width:100%;height:100%;z-index:0}
#atmos g{will-change:transform}
.ring{stroke-linejoin:round;vector-effect:non-scaling-stroke}

.label-plane{position:absolute;inset:0;z-index:2;pointer-events:none;will-change:transform}
/* No letter-spacing anywhere an Arabic glyph can appear, and 1.7 leading: Arabic ascenders,
   descenders and diacritics clip below about 1.6. */
.topic-label{
  position:absolute;transform:translate(-50%,-50%);white-space:nowrap;
  color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 420;line-height:1.7;opacity:0;
}

#lights,#structure,#field{position:absolute;inset:0;width:100%;height:100%;z-index:1}

/* qandeel.analysis.relation -> qandeel.content.tertiary. NEUTRAL, permanently. The structure a
   meaning event leaves behind is analytical geometry and is never luminous. */
#keel{stroke:${CHROME.analysisRelation};fill:none;stroke-linecap:round}
/* qandeel.analysis.relation -> qandeel.content.tertiary. A membership link is an analytical
   relation stroke, so it carries that token — one colour for all four, on the group. */
.link,.mark{stroke:${CHROME.analysisRelation};fill:none;stroke-linecap:round}
/* qandeel.analysis.node -> qandeel.content.primary. The pattern's locus IS an analytical node. */
#plocus-mark{stroke:${CHROME.analysisNode};fill:none}
#plocus{position:absolute;left:${PATTERN_LOCUS.x}px;top:${PATTERN_LOCUS.y + 38}px;transform:translate(-50%,-50%);text-align:center;z-index:4;opacity:0;white-space:nowrap}
#plocus-text{font-size:17px;color:${FOUNDATION.PRIMARY};font-variation-settings:'wght' 540;display:block;line-height:1.7}
#plocus-sub{font-size:11.5px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;display:block;margin-top:4px;opacity:.78}

#hdr{
  position:absolute;top:0;right:0;left:0;height:${FRAME.header}px;
  background:${FOUNDATION.SURFACE};
  display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:6;
}
#hdr::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:#202020}
#hdr .env{font-size:12.5px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 420;line-height:1.7}
#q-wrap{position:relative;width:${qW}px;height:${MARK.h}px}
#q-wrap svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
/* qandeel.identity.mark -> qandeel.identity.material -> …living-brass.body */
#q-base{color:${CHROME.identityMark}}
/* Light ACTING ON the material. At opacity 0 nothing is composited and the mark is
   byte-identical to the unlit one. The Brass never becomes a source. */
#q-light{color:${LIGHT.MID};mix-blend-mode:screen;opacity:0}

/* THE PERSISTENT NAVIGATION ICON FAMILY. P2. One colour on the group, inherited through
   currentColor: the token names ONE FAMILY, and five declarations are five places to drift. */
#nav{
  position:absolute;left:0;right:0;bottom:0;height:${FRAME.nav}px;
  background:${FOUNDATION.SURFACE};
  display:flex;align-items:center;justify-content:space-around;
  padding:0 10px 6px;z-index:6;color:${CHROME.navigationMachinery};
}
#nav::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:#202020}
.nav-i{width:22px;height:22px}

.obj{position:absolute;white-space:nowrap;z-index:4;will-change:transform}
#current{left:${GEO.current.x}px;top:${GEO.current.y}px;transform:translate(-50%,-50%);text-align:right}
#current-text{font-size:${GEO.current.size}px;color:${FOUNDATION.PRIMARY};font-variation-settings:'wght' ${GEO.current.weight};display:block;line-height:1.7}
#current-label{font-size:${GEO.currentLabel.size}px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;opacity:.62;display:block;margin-top:5px}
#prior{left:${GEO.prior.depth.x}px;top:${GEO.prior.depth.y}px;text-align:right}
#prior-text{font-size:${GEO.prior.relation.size}px;display:block;line-height:1.7}
#prior-label{font-size:${GEO.priorLabel.size}px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;display:block;margin-top:5px}
#prior-ghost{
  left:${GEO.prior.depth.x}px;top:${GEO.prior.depth.y}px;text-align:right;display:none;
  transform:translate(-50%,-50%) scale(${GEO.prior.depth.scale.toFixed(4)});
  filter:blur(${GEO.prior.depth.blur.toFixed(3)}px);
}
#prior-ghost .gt{font-size:${GEO.prior.relation.size}px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' ${Math.round(GEO.prior.depth.weight)};display:block;line-height:1.7}
#prior-ghost .gl{font-size:${GEO.priorLabel.size}px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;display:block;margin-top:5px;opacity:.72}

#quiet-layer{position:absolute;inset:0;z-index:2;transform-origin:50% 50%}
.quiet-item{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;opacity:.34;line-height:1.7}

/* THE NEW CONCLUSION. An ordinary analytical node once it exists — same ink, same plane, same
   kind of object as everything else on the map. It is not a card and not a notification. */
#inode{position:absolute;left:${INSIGHT_SITE.x}px;top:${INSIGHT_SITE.y}px;transform:translate(-50%,-50%);text-align:center;z-index:4;opacity:0;white-space:nowrap}
#inode-text{font-size:${INSIGHT_SIZE}px;color:${FOUNDATION.SECONDARY};font-variation-settings:'wght' 520;display:block;line-height:1.7}
#inode-label{font-size:11.5px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;display:block;margin-top:5px;opacity:.72}

/* TITLE CARDS FOR THE COHERENCE FILM. Four categories cut together with nothing between them is
   four clips; the cards are what make it one film. They exist only in the film — no captured
   frame of any category sequence has this element visible, and guard G2 checks that. */
#card{position:absolute;inset:0;z-index:9;background:${FOUNDATION.WORLD};display:none;
  flex-direction:column;align-items:center;justify-content:center;gap:10px}
#card-title{font-size:27px;color:${FOUNDATION.PRIMARY};font-variation-settings:'wght' 560;line-height:1.7}
#card-sub{font-size:13px;color:${FOUNDATION.TERTIARY};font-variation-settings:'wght' 400;line-height:1.7}

#probe-box{position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}
#probe-box span{position:absolute;white-space:nowrap;font-family:${FACE};font-size:100px}
</style>
</head>
<body>
<div id="probe-box" aria-hidden="true">
  <span id="pw400" style="font-variation-settings:'wght' 400">${COPY.prior}</span>
  <span id="pw560" style="font-variation-settings:'wght' 560">${COPY.prior}</span>
  <span id="pw700" style="font-variation-settings:'wght' 700">${COPY.prior}</span>
</div>

<div id="stage">
  <svg id="atmos" viewBox="0 0 ${VIEW.W} ${VIEW.H}" preserveAspectRatio="none" aria-hidden="true">
${atmosMarkup()}
  </svg>

${labelMarkup()}

  <svg id="lights" viewBox="0 0 ${VIEW.W} ${VIEW.H}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <radialGradient id="g-wash-2">
        <stop offset="0%"   stop-color="${LIGHT.MID}" stop-opacity=".55"/>
        <stop offset="42%"  stop-color="${LIGHT.LOW}" stop-opacity=".20"/>
        <stop offset="100%" stop-color="${LIGHT.LOW}" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-soft-2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4"/></filter>
    </defs>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse id="src-${i}" cx="0" cy="0" rx="0" ry="0" fill="url(#g-wash-2)" opacity="0" filter="url(#f-soft-2)"/>`).join('\n    ')}
  </svg>

  <svg id="field" viewBox="0 0 ${VIEW.W} ${VIEW.H}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <radialGradient id="g-wash">
        <stop offset="0%"   stop-color="${LIGHT.MID}" stop-opacity=".55"/>
        <stop offset="42%"  stop-color="${LIGHT.LOW}" stop-opacity=".20"/>
        <stop offset="100%" stop-color="${LIGHT.LOW}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-presence">
        <stop offset="0%"   stop-color="#2a2a2a" stop-opacity=".62"/>
        <stop offset="100%" stop-color="#2a2a2a" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4"/></filter>
      <filter id="f-softer" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <!-- The two presence gradients belong to the INHERITED CONTROL's two text objects. They are
         written every frame rather than left at a markup opacity, because in three of the four
         categories those objects do not exist and a ground under nothing is a smudge. -->
    <ellipse id="current-ground" cx="${GEO.current.x}" cy="${GEO.current.y}" rx="96" ry="34" fill="url(#g-presence)" opacity="0"/>
    <ellipse id="prior-ground" cx="${GEO.prior.depth.x}" cy="${GEO.prior.depth.y}" rx="74" ry="30" fill="url(#g-presence)" opacity="0"/>
    <ellipse id="recv" cx="0" cy="0" rx="0" ry="0" fill="url(#g-wash)" opacity="0" filter="url(#f-soft)"/>
    <ellipse id="wash" cx="0" cy="0" rx="0" ry="0" fill="url(#g-wash)" opacity="0"/>
    <path id="relation-prov" fill="none" stroke="${CHROME.analysisRelation}" stroke-width="1" stroke-linecap="butt" opacity="0" style="display:none"/>
    <path id="relation" fill="none" stroke="${CHROME.analysisRelation}" stroke-width="1" stroke-linecap="round" opacity="0"/>
    <path id="thread-halo" fill="none" stroke="${LIGHT.LOW}" stroke-width="8" stroke-linecap="round" opacity="0" filter="url(#f-softer)"/>
    <path id="thread-tail" fill="none" stroke="${LIGHT.LOW}" stroke-width="0.9" stroke-linecap="round" opacity="0"/>
    <path id="thread-mid"  fill="none" stroke="${LIGHT.MID}"  stroke-width="1.1" stroke-linecap="round" opacity="0"/>
    <path id="thread-core" fill="none" stroke="${LIGHT.CORE}" stroke-width="1.5" stroke-linecap="round" opacity="0"/>
    <circle id="thread-head" r="2.6" fill="${LIGHT.CORE}" opacity="0"/>
  </svg>

  <svg id="structure" viewBox="0 0 ${VIEW.W} ${VIEW.H}" preserveAspectRatio="none" aria-hidden="true">
    <!-- MEMBERSHIP. One link per member, every one identical in every written property, all
         drawn together. A stagger would be an order and a width would be a strength, and the
         Product knows neither: it knows a SET. -->
    ${linkPaths.map((d, i) => `<path class="link" id="link-${i}" d="${d}" opacity="0"/>`).join('\n    ')}
    <!-- The membership mark, AT the member, so membership is legible without reading a line
         whose length is an accident of layout. Identical radius on every member. -->
    ${G.links.map((l, i) => `<circle class="mark" id="mark-${i}" cx="${l.to.x.toFixed(2)}" cy="${l.to.y.toFixed(2)}" r="5.5" fill="none" opacity="0"/>`).join('\n    ')}
    <!-- The pattern's own analytical object. Its position is AUTHORED LAYOUT: it is where the
         drawing fits, and it is not derived from where the members are. -->
    <circle id="plocus-mark" cx="${PATTERN_LOCUS.x}" cy="${PATTERN_LOCUS.y}" r="4.2" fill="none" opacity="0"/>
    <path id="keel" d="${keelPath}" opacity="0"/>
  </svg>

  <div id="quiet-layer"><div id="quiet">${quietMarkup}
  </div></div>

  <div class="obj" id="prior-ghost" aria-hidden="true">
    <span class="gt">${COPY.prior}</span>
    <span class="gl">${COPY.priorLabel}</span>
  </div>
  <div class="obj" id="prior">
    <span id="prior-text">${COPY.prior}</span>
    <span id="prior-label">${COPY.priorLabel}</span>
  </div>
  <div class="obj" id="current">
    <span id="current-text">${COPY.current}</span>
    <span id="current-label">${COPY.currentLabel}</span>
  </div>

  <div id="inode">
    <span id="inode-text">${INSIGHT_TEXT}</span>
    <span id="inode-label">${INSIGHT_LABEL}</span>
  </div>

  <div id="plocus">
    <span id="plocus-text">${PATTERN_LABEL}</span>
    <span id="plocus-sub">${PATTERN_SUBLABEL}</span>
  </div>

  <header id="hdr">
    <div id="q-wrap" role="img" aria-label="قنديل">
      <svg id="q-base" viewBox="${Q.viewBox}" fill="currentColor" fill-rule="nonzero" aria-hidden="true" focusable="false">${Q.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>
      <svg id="q-light" viewBox="${Q.viewBox}" fill="currentColor" fill-rule="nonzero" aria-hidden="true" focusable="false">${Q.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>
    </div>
    <span class="env" id="env-name">العالم الخاص</span>
  </header>

  <nav id="nav" aria-label="التنقّل">${NAV}</nav>

  <div id="card" aria-hidden="true"><span id="card-title"></span><span id="card-sub"></span></div>
</div>

<script>
${code}

/* ---------------------------------------------------------------------- the driver -- */
const FIELD = ${JSON.stringify(FIELD)};
const WORLDS = ${JSON.stringify(WORLDS)};
const PARALLAX = ${JSON.stringify(PARALLAX)};
const PATTERN_MEMBERS = ${JSON.stringify(PATTERN_GEOMETRY.members.map((m) => m.id))};

const d2apply = M_d2_render.makeRenderer(document, FIELD, WORLDS, PARALLAX);
const hideEvents = M_d2_render.makeEventHider(document);
const d1apply = M_d1_render.makeRenderer(document);

const d1Text = ['quiet-layer', 'prior', 'current'].map((id) => document.getElementById(id));
const currentGround = document.getElementById('current-ground');
const priorGround = document.getElementById('prior-ground');
/* THE INHERITED CONTROL BRINGS ITS OWN NAMES. D1 draws five of these eight topics as its quiet
   analytical material, at exactly these coordinates, and its renderer animates that layer as
   part of the selected expression. So during CONNECTION the field keeps its contours and drops
   its labels: one world, one set of names, and the inherited beat untouched. */
const labelPlanes = [0, 1, 2].map((p) => document.getElementById('labels-' + p));
const envName = document.getElementById('env-name');
const WORLD_NAMES = { personal: 'العالم الخاص', shared: 'عالم مشترك', public: 'عالم عام' };

let CATEGORY = 'ambient';
let REDUCED = false;

function setMode(category, reduced) {
  CATEGORY = category;
  REDUCED = !!reduced;
}

function stateAt(t) {
  if (CATEGORY === 'ambient') {
    const A = M_d2_world.ambient(t, REDUCED);
    return { kind: 'ambient', world: A.world, dx: A.dx, reduced: REDUCED, sources: [] };
  }
  if (CATEGORY === 'connection') {
    const S = REDUCED ? M_d2_connection.connectionReduced(t) : M_d2_connection.connectionEvent(t);
    return { kind: 'connection', d1: S, world: 'personal', dx: 0, reduced: REDUCED, sources: [],
      fieldRecede: S.fieldRecede || 0 };
  }
  const ev = M_d2_events.EVENTS[CATEGORY];
  const S = REDUCED ? ev.reduced(t) : ev.apply(t);
  return Object.assign({ kind: CATEGORY, world: 'personal', dx: 0, reduced: REDUCED,
    members: CATEGORY === 'pattern' ? PATTERN_MEMBERS : [] }, S);
}

function apply(t) {
  const S = stateAt(t);
  const isConnection = S.kind === 'connection';

  /* The inherited control keeps its own text objects; the other three categories do not have
     them at all, and hiding them is a display write rather than an opacity one so that no
     antialiased edge of a hidden word can reach any raster. */
  for (const n of d1Text) n.style.display = isConnection ? '' : 'none';
  for (const n of labelPlanes) n.style.display = isConnection ? 'none' : '';
  envName.textContent = WORLD_NAMES[S.world];

  if (isConnection) {
    hideEvents();
    currentGround.style.opacity = '0.5';
    d2apply(Object.assign({}, S, { skipMark: true }));
    d1apply(S.d1);
  } else {
    d1apply(M_d1_scene.ZERO_STATE);
    currentGround.style.opacity = '0';
    priorGround.style.opacity = '0';
    d2apply(S);
  }
  return S;
}

/* A SHA-256 of every attribute of every identified element, sorted, with no rasteriser in it.
   D1 learned this the hard way: "the shared phase is the same event" was never a claim about
   Chrome, and hashing the document is what found a renderer defect three packages old. */
async function digest() {
  const parts = [];
  const nodes = document.querySelectorAll('#stage [id], #stage .ring, #stage .ring-fill, #stage .topic-label, #stage .quiet-item, #stage .tie');
  for (const n of nodes) {
    const key = n.id || (n.className.baseVal || n.className) + ':' + (n.dataset.topic || '') + ':' + (n.dataset.ring || '') + ':' + (n.dataset.qi || '');
    const attrs = [...n.attributes].map((a) => a.name + '=' + a.value).sort().join('|');
    parts.push(key + '{' + attrs + '}');
  }
  const text = parts.join(';;');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const card = document.getElementById('card');
const cardTitle = document.getElementById('card-title');
const cardSub = document.getElementById('card-sub');
function setCard(title, sub) {
  if (title === null) { card.style.display = 'none'; cardTitle.textContent = ''; cardSub.textContent = ''; return; }
  cardTitle.textContent = title;
  cardSub.textContent = sub || '';
  card.style.display = 'flex';
}

/**
 * THE SEMANTIC PROBE — what the document actually wrote, for the guards that must not be
 * satisfied by prose.
 *
 * Guards S3, S4 and S5 exist because I-08B3.1-D2 encoded quantities in exactly these three
 * places: a per-link weight would be a strength, a per-topic dash was a sharing fraction, and a
 * suppressed label was a claim about what the user is allowed to know. Reading the rule text
 * back would prove nothing, so this reads the written attributes off the live elements.
 */
function probe() {
  const all = (sel) => [...document.querySelectorAll(sel)];
  return {
    links: all('.link').map((n) => n.style.strokeWidth + '|' + n.style.opacity),
    marks: all('.mark').map((n) => n.style.strokeWidth + '|' + n.style.opacity),
    ringDash: all('.ring').map((n) => n.style.strokeDasharray || ''),
    labelOpacity: all('.topic-label').map((n) => +(n.style.opacity || 0)),
    labelCount: all('.topic-label').length,
    cardShown: document.getElementById('card').style.display === 'flex',
  };
}

window.QD = {
  setMode, apply, digest, stateAt, setCard, probe,
  T: ${JSON.stringify(T)},
  TA: ${JSON.stringify(TA)},
  get category() { return CATEGORY; },
  get reduced() { return REDUCED; },
  ready: false,
};

document.fonts.ready.then(() => {
  apply(0);
  window.QD.ready = true;
});

/* No CSS animation, no CSS transition, no clock. The prototype drives itself from rAF only so
   a human can watch it; the capture harness seeks it to an exact millisecond instead. */
let t0 = null;
function frame(ts) {
  if (t0 === null) t0 = ts;
  const span = CATEGORY === 'ambient' ? ${TA.TOTAL} : ${T.TOTAL};
  apply((ts - t0) % span);
  requestAnimationFrame(frame);
}
if (!location.search.includes('static')) requestAnimationFrame(frame);
</script>
</body>
</html>
`;
}

/* ============================================================================ main ==== */
export function build() {
  gateChrome();
  gateRelation();
  gateLight();
  const atmos = gateAtmosphere();
  const geometry = gateGeometry();

  const html = page();
  mkdirSync(join(PKG, 'prototypes'), { recursive: true });
  mkdirSync(join(PKG, 'data'), { recursive: true });
  const out = join(PKG, 'prototypes', 'D2_LIGHT_SYSTEM.html');
  writeFileSync(out, html);

  const resolution = {
    generated: 'source/tools/d2-build.mjs',
    chrome: RESOLVED.chrome,
    foundation: RESOLVED.foundation,
    font: FONT,
    relationContrast: RELATION_CONTRAST,
    light: { ...LIGHT, measuredSeparation: LIGHT_SEPARATION, diagnostic: LIGHT_DIAGNOSTIC },
    atmosphere: { ...ATMOSPHERE, ...atmos, ringInks: FIELD.map((t) => ({ id: t.id, hue: t.hue, ink: t.ink })) },
    pattern: {
      members: PATTERN_GEOMETRY.members.map((m) => m.id),
      locus: PATTERN_LOCUS,
      locusIsAuthored: true,
      derivedFromMemberPositions: 'nothing',
      note: 'I-08B3.1-D2 fitted a principal axis to the member positions and drew residuals from it. Screen positions are a LAYOUT and carry no analytical authority, so that statistic said nothing about the pattern. D2R draws membership only: one locus, four identical links, four identical marks.',
    },
    insight: { site: INSIGHT_SITE, text: INSIGHT_TEXT },
    presentationContract: PRESENTATION_CONTRACT,
    geometryGate: geometry,
    topics: TOPICS.map((t) => ({ id: t.id, x: t.x, y: t.y, layer: t.layer, from: t.from })),
    inherited: ['vendor/d1/d1-scene.mjs', 'vendor/d1/d1-render.mjs', 'vendor/d1/d1-arrivals.mjs'].map((rel) => ({
      file: rel,
      sha256: createHash('sha256').update(readFileSync(join(SRC, rel))).digest('hex'),
    })),
    prototype: { file: 'prototypes/D2_LIGHT_SYSTEM.html', bytes: Buffer.byteLength(html) },
  };
  writeFileSync(join(PKG, 'data', 'D2_RESOLUTION.json'), JSON.stringify(resolution, null, 2) + '\n');
  return { out, bytes: Buffer.byteLength(html), resolution };
}

if (isMain(import.meta.url)) {
  const r = build();
  console.log('D2 BUILD');
  console.log(`  gate 1 chrome      OK — ${Object.keys(RESOLVED.chrome).length} roles resolved with alias chains`);
  console.log(`  gate 2 font        OK — Estedad ${FONT.version} sha256 ${FONT.sha256.slice(0, 12)}…, 0 font bytes in this package`);
  console.log(`  gate 3 relation    OK — ${RELATION_CONTRAST.hex} is ${RELATION_CONTRAST.ratio}:1 on the World (superseded ${RELATION_CONTRAST.superseded.hex} was ${RELATION_CONTRAST.superseded.ratio}:1)`);
  console.log(`  gate 4 Light       OK — ΔEok ${LIGHT_SEPARATION.dE.toFixed(4)} from Living Brass, required ${LIGHT.separationRequired}`);
  console.log(`  gate 5 atmosphere  OK — ring chroma max ${r.resolution.atmosphere.ringMax.toFixed(4)} < Light ${r.resolution.atmosphere.lightC.toFixed(4)} and Matter ${r.resolution.atmosphere.brassC.toFixed(4)}`);
  console.log(`  gate 6 geometry    OK — ${r.resolution.geometryGate.declared} visual properties declared, every one encoding nothing except the world treatment, which cites its source`);
  console.log(`  pattern            membership only: ${r.resolution.pattern.members.length} members, 1 authored locus, nothing derived from member positions`);
  console.log(`  wrote ${r.out} (${r.bytes} bytes)`);
}
