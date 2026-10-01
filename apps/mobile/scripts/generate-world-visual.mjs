#!/usr/bin/env node
// VPORT-01 — generate the Living Analysis World's production visual constants FROM THE FROZEN SOURCES.
//
// The same discipline as `generate-conversation-visual.mjs`: nothing below is typed by hand. The I-08B1
// unified source (`wf-living-constellation.html`, pinned to its closure SHA-256) is read, and the parts of
// it that are MATERIAL — the palette block `P`, the distance schedule, the sprite falloffs, the local
// ground, the node morphologies and the dust generator — are taken from it in one of two ways:
//
//   EXECUTED. `dustTile`, `sprite`, `shadeSprite` and `nodePath` are lifted out of the canonical file as
//   text and run, unmodified, against a recording 2D context. What they would have drawn is what is
//   emitted: the dust specks, the gradient stops, the shapes. No speck, stop or proportion is re-typed.
//
//   SOURCE-LOCKED. The distance schedule (`S.lod = …`, `S.map = …`, …) is copied expression for
//   expression into a worklet, and the material numbers the canonical painter reads (`P.ground`,
//   `P.halo.obj`, …) are evaluated from the canonical `P` literal itself.
//
// The star and nebula strata are the one place a LAYOUT is generated rather than copied: the canonical
// layouts are drawn around the fixture world's own centre, which is fixture geography and not a fact of
// any reader's world. Their MATERIAL is the canonical one (the population mix, the size and alpha laws,
// the gradient stops), copied by exact text, and the layout is a seamless tile from an authored
// presentation seed — which D2R explicitly permits for ambient composition ("an AUTHORED PRESENTATION
// SEED belonging to the scene … a later release may reseed the whole field and lose nothing").
//
// The interaction, contrast and parallax values come from the frozen token tree through F2 FINAL's own
// resolver, exactly as the Conversation generator takes them.
//
//   node apps/mobile/scripts/generate-world-visual.mjs          write the two modules
//   node apps/mobile/scripts/generate-world-visual.mjs --check  exit 1 if either module is stale
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const I08B1 = join(REPO, 'docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html');
const I08B1_SHA256 = '4dfd9d27d752c3a445168c0cc7067d71df4ada84bc61b806d12c8bb3202bc413';
const F2R = join(REPO, 'docs/design/canonical-artifacts/accessibility-appearance/i-08b3.1-f2r');
const OUT_VISUAL = join(REPO, 'apps/mobile/src/map/visual/world-visual.generated.ts');
const OUT_FIELD = join(REPO, 'apps/mobile/src/map/visual/world-field.generated.ts');

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rel = (path) => relative(REPO, path).replace(/\\/gu, '/');
const fail = (message) => {
  throw new Error(`generate-world-visual: ${message}`);
};

// ------------------------------------------------------------------------------------- the source
if (sha(I08B1) !== I08B1_SHA256) fail(`the I-08B1 unified source is not the closed one (${sha(I08B1)})`);
const html = readFileSync(I08B1, 'utf8').replace(/\r\n/gu, '\n');

/** The exact text of one top-level declaration, from its opening line to its balanced closing brace. */
function block(opening) {
  const start = html.indexOf(opening);
  if (start < 0) fail(`declaration not found: ${opening}`);
  const brace = html.indexOf('{', start + opening.length - 1);
  let depth = 0;
  for (let index = brace; index < html.length; index += 1) {
    const char = html[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const end = html[index + 1] === ';' ? index + 2 : index + 1;
        return html.slice(start, end);
      }
    }
  }
  return fail(`unbalanced declaration: ${opening}`);
}

/** One line of the canonical file, required to be present exactly. */
function exactLine(text) {
  if (!html.includes(text)) fail(`the canonical source no longer contains: ${text}`);
  return text;
}

const HELPERS = [
  exactLine('function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}'),
  exactLine('const lerp=(a,b,t)=>a+(b-a)*t;'),
  exactLine('const clamp=(v,a,b)=>v<a?a:v>b?b:v;'),
  exactLine('const ss=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)};'),
  exactLine('const TAU=Math.PI*2;'),
].join('\n');

// ------------------------------------------------------------------------- a recording 2D context
/** Just enough of CanvasRenderingContext2D for the four canonical painters to run, recording what they do. */
function recorder() {
  const events = [];
  let path = [];
  const gradient = (kind, args) => {
    const stops = [];
    return { kind, args, stops, addColorStop: (offset, color) => stops.push([offset, color]) };
  };
  const ctx = {
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    createRadialGradient: (...args) => gradient('radial', args),
    createLinearGradient: (...args) => gradient('linear', args),
    save: () => path.push(['save']),
    restore: () => path.push(['restore']),
    translate: (x, y) => path.push(['translate', x, y]),
    rotate: (angle) => path.push(['rotate', angle]),
    scale: (x, y) => path.push(['scale', x, y]),
    beginPath: () => {
      path = [];
    },
    closePath: () => path.push(['close']),
    moveTo: (x, y) => path.push(['M', x, y]),
    lineTo: (x, y) => path.push(['L', x, y]),
    quadraticCurveTo: (cx, cy, x, y) => path.push(['Q', cx, cy, x, y]),
    arc: (x, y, r, a0, a1) => path.push(['arc', x, y, r, a0, a1]),
    ellipse: (x, y, rx, ry, rotation, a0, a1) => path.push(['ellipse', x, y, rx, ry, rotation, a0, a1]),
    fill: () => events.push({ op: 'fill', path: [...path], style: ctx.fillStyle, alpha: ctx.globalAlpha }),
    stroke: () => events.push({ op: 'stroke', path: [...path], style: ctx.strokeStyle, alpha: ctx.globalAlpha }),
    fillRect: (x, y, w, h) => events.push({ op: 'fillRect', x, y, w, h, style: ctx.fillStyle, alpha: ctx.globalAlpha }),
    putImageData: () => undefined,
  };
  return { ctx, events, path: () => path };
}

/** Runs canonical declarations in a fresh sandbox whose `document` hands out recording canvases. */
function sandbox(code, expose) {
  const canvases = [];
  const context = vm.createContext({
    Math,
    document: {
      createElement: () => {
        const r = recorder();
        const canvas = { width: 0, height: 0, getContext: () => r.ctx, __r: r };
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  vm.runInContext(`${HELPERS}\n${code}\n;globalThis.__out = { ${expose.join(', ')} };`, context);
  return { out: context.__out, canvases };
}

// --------------------------------------------------------------------------------- the palette P
const P = sandbox(block('const P={'), ['P']).out.P;
const material = {
  ground: P.ground,
  vignette: P.vignette,
  grain: P.grain,
  haloObj: P.halo.obj,
  haloObjMinor: P.halo.objMinor,
  objGnd: { a: P.objGnd.a, r: P.objGnd.r },
  relGnd: { a: P.relGnd.a, w: P.relGnd.w, k: P.relGnd.k, max: P.relGnd.max },
  rel: { a: P.rel.a, w: P.rel.w, bead: P.rel.bead },
  neb: { a: P.neb.a, sat: P.neb.sat },
};
for (const [name, value] of Object.entries(material)) if (value === undefined) fail(`P no longer carries ${name}`);

// The map floor: the one rgba literal the painter lays on the ground at map scale (WS7R-Q §Q2).
exactLine('ctx.fillStyle=`rgba(4,15,24,${(0.44*S.mapA).toFixed(4)})`;');
const floor = { rgb: [4, 15, 24], alpha: 0.44 };
// The vignette: its two stop positions and its ink (renderComposite).
exactLine("g.addColorStop(0.62,`rgba(1,2,5,${P.vignette*0.36*(1-S.map*0.25)})`);");
exactLine("g.addColorStop(1,`rgba(1,2,5,${P.vignette*(1-S.map*0.25)})`);");
exactLine('const g=vctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*0.30,cw/2,ch/2,Math.hypot(cw,ch)*0.60);');
const vignette = { rgb: [1, 2, 5], inner: 0.3, outer: 0.6, midStop: 0.62, midShare: 0.36, mapRelief: 0.25 };
// The ground gradient's direction (renderLight).
exactLine('const g=ctx.createLinearGradient(0,0,cw*0.35,ch);');
const groundDirection = { x: 0.35, y: 1 };

// The world's colour. The I-08B1 notes record it: "territory atmosphere (in/out) | 170 | 170 | unchanged —
// the world's colour, and FAR is made of it". It is the hue the world body, the object material and the
// relations are all made of; it is read from the canonical territory table rather than retyped.
const notes = readFileSync(join(dirname(I08B1), 'I-08B1-WS7R-NOTES.md'), 'utf8');
if (!/territory atmosphere \(in\/out\) \| 170 \| 170 \| unchanged — the world's colour, and FAR is made of it/u.test(notes)) {
  fail('the I-08B1 notes no longer name 170 as the world\'s colour');
}
const workLine = exactLine("  {id:'work',  n:AR.work,   x:1205,y: 682,r:338,hue:170,d:0.16},");
const worldHue = Number(/hue:(\d+)/u.exec(workLine)[1]);
// Object atmospheres and relations join the medium on approach: "+16*S.lod" (WS7R-V2 §W5).
exactLine('const oh=t.hue+16*S.lod;');
const mediumShift = 16;

// Object mark material (§14): lightness / saturation / alpha laws, major and minor.
exactLine('const L=(o.minor?74:82)-o.d*16+S.map*5, Sc=((o.minor?40:58)-o.d*10)*(1-S.map*0.40);');
exactLine('const al=clamp(((o.minor?0.62:0.94)*dep+0.10)*vis2*fade*(0.62+0.38*ov),0,1);');
exactLine("if(hs>0.004) glow(ctx,o.x,o.y,r*(o.minor?4.2:6.6),oh,58,70,'wide',hs);");
exactLine("glow(ctx,o.x,o.y,r*(o.minor?9:15),oh,58,56,'soft',");
exactLine('ctx.lineWidth=Math.max(0.5/V.zs,rd*0.24);');
exactLine('const la=al*lum*0.38;');
exactLine('ctx.lineWidth=Math.max(0.5/V.zs,rd*0.52);');
exactLine('al*lum*(o.minor?0.16:0.24));');
const mark = {
  major: { light: 82, sat: 58, alpha: 0.94 + 0.1, halo: 6.6, haloWide: 15, core: 1.22, coreAlpha: 0.24 },
  minor: { light: 74, sat: 40, alpha: 0.62 + 0.1, halo: 4.2, haloWide: 9, core: 1.05, coreAlpha: 0.16 },
  mapLight: 5,
  mapDesaturate: 0.4,
  haloSat: 58,
  haloLight: 70,
  haloWideLight: 56,
  haloNearGain: 4.6,
  haloWideShare: 0.3,
  rimWidth: 0.24,
  limbWidth: 0.52,
  limbShare: 0.38,
  coreSatShare: 0.8,
};

// Relation material (§13): the core gradient's end and middle stops, the NEAR body, the local ground.
exactLine('g.addColorStop(0,`hsla(${q.hue},58%,88%,${ca*eA*q.prof[0]})`);');
exactLine('const eA=lerp(1.00,0.34,S.lod), mA=lerp(0.46,1.00,S.lod);');
exactLine('const mS=48+S.lod*18, mL=80-S.lod*9;');
exactLine(':`rgba(3,5,11,${ga0})`;');
exactLine('const ha=q.al*q.core*0.17*S.lod;');
exactLine('ctx.lineWidth=relW*4.6;');
exactLine('const relW=P.rel.w*S.relBead*S.relW/V.zs*1.3;');
exactLine("ctx.fillStyle=`hsla(${hue},40%,94%,${Math.min(0.96,al*1.9*(1+land*0.7))})`;");
const relation = {
  end: { sat: 58, light: 88 },
  middle: { sat: 48, satNear: 18, light: 80, lightNear: -9 },
  endAlpha: [1, 0.34],
  middleAlpha: [0.46, 1],
  ground: { rgb: [3, 5, 11] },
  body: { sat: 54, light: 68, share: 0.17, width: 4.6, max: 0.4 },
  bead: { sat: 40, light: 94, share: 1.9, max: 0.96 },
  widthScale: 1.3,
};

// ----------------------------------------------------------------------------- the distance schedule
const SCHEDULE_KEYS = ['lod', 'map', 'mapA', 'far', 'cosmos', 'rel', 'relBead', 'relGnd', 'relW', 'objMin', 'objMaj', 'objMat', 'objGnd', 'hier'];
const scheduleLines = SCHEDULE_KEYS.map((key) => {
  const match = new RegExp(`^\\s*S\\.${key}\\s*=\\s*(.+?);(?:\\s*//.*)?$`, 'mu').exec(html);
  if (match === null) fail(`schedule line S.${key} not found`);
  return { key, expression: match[1].trim() };
});
for (const { key, expression } of scheduleLines) {
  if (/[^\w\s.,()*+\-/?:<>=!&|]/u.test(expression)) fail(`S.${key} uses a construct the port does not carry: ${expression}`);
  for (const name of expression.match(/\b[A-Za-z_]\w*\b/gu) ?? []) {
    if (!['ss', 'lerp', 'clamp', 'Math', 'min', 'max', 'A', 'S', 'LODON', 'MAPON', 'FARCAL', ...SCHEDULE_KEYS].includes(name)) {
      fail(`S.${key} reads ${name}, which the port does not carry`);
    }
  }
}
// The three switches the closed prototype ships ON (I-08B1-CANONICAL-STATE.md: "J … ships on").
for (const flag of ['let HIER=true;', 'let LODON=true;', 'let MAPON=true;', 'let FARCAL=true;']) exactLine(flag);

// The field width at approach A, so a stratum can be sized in the same units the canonical painter uses.
exactLine('const FIELD_FAR=3600, FIELD_NEAR=640;');
exactLine('const fieldAt =t=>Math.exp(lerp(LOGF,LOGN,clamp(t,0,1)));');
const field = { far: 3600, near: 640 };

// --------------------------------------------------------------------------------------- sprites
const spriteRun = sandbox(`${block('function sprite(hue,sat,light,profile){')}\n${block('function shadeSprite(){')}`.replace('function sprite(', 'const SPR=new Map();\nfunction sprite('), ['sprite', 'shadeSprite']);
const profiles = {};
for (const profile of ['point', 'wide', 'core', 'soft']) {
  const canvas = spriteRun.out.sprite(100, 50, 50, profile);
  const fill = canvas.__r.events.find((event) => event.op === 'fillRect');
  profiles[profile] = fill.style.stops.map(([offset, color]) => [offset, Number(/,([0-9.]+)\)$/u.exec(color)[1])]);
}
const shadeEvents = spriteRun.out.shadeSprite().__r.events.find((event) => event.op === 'fillRect');
const shade = shadeEvents.style.stops.map(([offset, color]) => {
  const [r, g, b, a] = /rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/u.exec(color).slice(1).map(Number);
  return { offset, rgb: [r, g, b], alpha: a };
});

// ------------------------------------------------------------------------------ node morphologies
const K_LINE = exactLine('const K={MOMENT:0,THREAD:1,READING:2,MEMO:3,OPEN:4};');
const K = sandbox(K_LINE, ['K']).out.K;
const nodeRun = sandbox(`${K_LINE}\n${block('function nodePath(ctx,k,x,y,r,rot){')}`, ['nodePath']);
/** The canonical path of one morphology at unit radius, centred, with its rotation factor measured. */
function morphology(k) {
  // Drawn twice: once unrotated, for the shape, and once with `rot = 1`, so the rotation factor is
  // MEASURED from what the canonical function does with it rather than read off its text. A transformed
  // slot reports it through `rotate(·)`; the open arc carries it in its own start angle.
  const still = recorder();
  nodeRun.out.nodePath(still.ctx, k, 0, 0, 1, 0);
  const turned = recorder();
  nodeRun.out.nodePath(turned.ctx, k, 0, 0, 1, 1);
  const rotate = turned.path().find((op) => op[0] === 'rotate');
  const arcStill = still.path().find((op) => op[0] === 'arc');
  const arcTurned = turned.path().find((op) => op[0] === 'arc');
  const rotation = rotate !== undefined ? rotate[1] : arcStill !== undefined ? arcTurned[4] - arcStill[4] : 0;
  return { rotation, ops: still.path().filter((op) => !['save', 'restore', 'translate', 'rotate'].includes(op[0])) };
}
const round = (value, digits = 4) => Number(value.toFixed(digits));
const shapes = {};
for (const [family, slot] of [['THREAD', K.THREAD], ['READING', K.READING], ['EMERGING_FOCUS', K.OPEN]]) {
  const { rotation, ops } = morphology(slot);
  shapes[family] = { slot: Object.keys(K).find((name) => K[name] === slot), rotation: round(rotation), ops: ops.map((op) => [op[0], ...op.slice(1).map((v) => round(v))]) };
}
// Only the OPEN slot is stroked; every other morphology is filled.
exactLine('const stroked=k=>k===K.OPEN;');
for (const [family, shape] of Object.entries(shapes)) shape.stroked = family === 'EMERGING_FOCUS';

// --------------------------------------------------------------------------------------- the dust
const dustRun = sandbox(`let DUSTQ=null;\n${block('function dustTile(){')}`, ['dustTile']);
const dustCanvas = dustRun.out.dustTile();
const dustTileSize = dustCanvas.width;
const parseHsl = (text) => {
  const m = /hsla?\((\d+(?:\.\d+)?),(\d+)%,(\d+)%/u.exec(text);
  if (m === null) fail(`not an hsl colour: ${text}`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
};
const specks = [];
for (const event of dustCanvas.__r.events) {
  if (event.op === 'fillRect') {
    specks.push({ x: event.x + event.w / 2, y: event.y + event.h / 2, r: event.w / 2, colour: parseHsl(event.style), alpha: event.alpha, soft: false });
  } else if (event.op === 'fill') {
    const arc = event.path.find((op) => op[0] === 'arc');
    if (typeof event.style === 'string') specks.push({ x: arc[1], y: arc[2], r: arc[3], colour: parseHsl(event.style), alpha: event.alpha, soft: false });
    else specks.push({ x: arc[1], y: arc[2], r: arc[3], colour: parseHsl(event.style.stops[0][1]), alpha: event.alpha, soft: true, stops: event.style.stops.map(([o, c]) => [o, Number(/,([0-9.]+)\)$/u.exec(c)[1])]) });
  }
}
if (specks.length < 3000) fail(`the dust tile drew only ${specks.length} specks`);

// ---------------------------------------------------------------------------------- colour helpers
function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}
const rgba = ([r, g, b], alpha) => `rgba(${r},${g},${b},${round(alpha, 3)})`;

/** Specks of one kind, bucketed by colour, size and alpha so one Skia `Points` call draws each bucket. */
function bucketise(points, { hueStep, radiusStep, alphaStep }) {
  const buckets = new Map();
  for (const p of points) {
    const h = Math.round(p.colour.h / hueStep) * hueStep;
    const r = Math.max(radiusStep, Math.round(p.r / radiusStep) * radiusStep);
    const a = Math.max(alphaStep, Math.round(p.alpha / alphaStep) * alphaStep);
    const key = `${h}|${p.colour.s}|${p.colour.l}|${round(r, 3)}|${round(a, 3)}|${p.soft ? 1 : 0}`;
    const bucket = buckets.get(key) ?? { colour: rgba(hslToRgb(h, p.colour.s, p.colour.l), a), width: round(2 * r, 3), soft: p.soft, points: [] };
    bucket.points.push(round(p.x, 1), round(p.y, 1));
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, bucket]) => bucket);
}
const dust = {
  tile: dustTileSize,
  specks: specks.length,
  buckets: bucketise(specks.filter((s) => !s.soft), { hueStep: 8, radiusStep: 0.3, alphaStep: 0.08 }),
  soft: bucketise(specks.filter((s) => s.soft), { hueStep: 12, radiusStep: 1, alphaStep: 0.015 }),
};

// ------------------------------------------------------------------- stars and nebula: canonical material
// The star population law (buildWorld, "cosmos strata"), copied by exact text.
exactLine('    const warm=R()<0.11;');
exactLine('    const hue=warm? 24+R()*26 : 194+R()*38;');
exactLine("    stars.push({x,y,m:0.28+Math.pow(R(),3.1)*1.5,a:0.09+Math.pow(R(),1.9)*0.58,");
exactLine("                rank:R(),hue,css:`hsl(${hue.toFixed(0)},22%,93%)`});");
exactLine('  for(let k=0;k<34000;k++){');
exactLine('    const x=WC.x+(R()*2-1)*1980, y=WC.y+(R()*2-1)*1240;');
exactLine("              px:1.02};");
exactLine('  S.stars  = {cut: lerp(0.24,0.40,ss(0.08,0.52,A))*(1-ss(0.62,1.0,A)*0.28),');
exactLine('              a: (1-ss(0.30,0.80,A)*0.44+ss(0.78,1.0,A)*0.16)*(1+S.lod*0.26)');
exactLine('                 *(1-S.map*0.42),               // WS7R-R: uniform star noise is what the reference has least of');
// The nebula population law and its three gradient passes (renderLight §3), copied by exact text.
exactLine("    neb.push({x,y,r:220+Math.pow(R(),1.6)*660,");
exactLine("              hue:u<0.80?[196,206,216,186,176][Math.floor(R()*5)]");
exactLine("                 :u<0.94?[230,242][Math.floor(R()*2)]:[30,42][Math.floor(R()*2)],");
exactLine('              a:0.010+R()*0.026,rank:R()});');
exactLine('  for(let k=0;k<138;k++){');
exactLine("        [0,`hsla(${b.hue},${P.neb.sat}%,50%,1)`],");
exactLine("        [0.45,`hsla(${b.hue},${P.neb.sat-6}%,42%,0.40)`],");
exactLine("        [1,`hsla(${b.hue},${P.neb.sat-10}%,38%,0)`]]);");
exactLine("          [0,`hsla(${b.hue},${P.neb.sat+30}%,30%,1)`],");
exactLine("          [0.42,`hsla(${b.hue},${P.neb.sat+26}%,27%,0.44)`],");
exactLine("          [0.78,`hsla(${b.hue},${P.neb.sat+22}%,24%,0.11)`],");
exactLine("          [1,`hsla(${b.hue},${P.neb.sat+22}%,22%,0)`]]);");
exactLine("          [0,`hsla(${b.hue},${P.neb.sat+34}%,30%,1)`],");
exactLine("          [0.45,`hsla(${b.hue},${P.neb.sat+30}%,27%,0.42)`],");
exactLine("          [1,`hsla(${b.hue},${P.neb.sat+26}%,24%,0)`]]);");
exactLine('      ctx.globalAlpha=b.a*P.neb.a*S.cosmos;');
exactLine('        ctx.globalAlpha=Math.min(1,b.a*P.neb.a*S.cosmos*S.mapA*2.8);');
exactLine('        ctx.globalAlpha=Math.min(1,b.a*P.neb.a*S.cosmos*S.far*2.75);');
exactLine('      if(b.rank>P.neb.cut) continue;');

// The canonical areas, so a tile carries the canonical DENSITY: 34,000 stars over 3,960 × 2,480 units,
// 138 clouds over 3,800 × 2,320.
const STAR_AREA = 3960 * 2480;
const NEB_AREA = 3800 * 2320;
// One authored presentation seed per stratum (D2R `atmosphere.contour`: an authored, reseedable scene seed,
// "deliberately NOT from … analytical identity"). These are VPORT-01's, recorded here and nowhere else.
const STAR_SEED = 80871;
const NEB_SEED = 80872;
const STAR_TILE = 1024;
const NEB_TILE = 2048;

const { out: rng } = sandbox('', ['mulberry32']);
function starTile() {
  const R = rng.mulberry32(STAR_SEED);
  const count = Math.round((34000 * STAR_TILE * STAR_TILE) / STAR_AREA);
  const kept = [];
  for (let k = 0; k < count; k += 1) {
    const x = R() * STAR_TILE;
    const y = R() * STAR_TILE;
    const warm = R() < 0.11;
    const hue = warm ? 24 + R() * 26 : 194 + R() * 38;
    const m = 0.28 + Math.pow(R(), 3.1) * 1.5;
    const a = 0.09 + Math.pow(R(), 1.9) * 0.58;
    const rank = R();
    // Only the ranks any distance can ever admit (the cut never exceeds 0.40) are kept.
    if (rank <= 0.4) kept.push({ x, y, r: m * 1.02, colour: { h: Math.round(hue), s: 22, l: 93 }, alpha: a, rank, soft: false });
  }
  const band = (lo, hi) => bucketise(kept.filter((s) => s.rank > lo && s.rank <= hi), { hueStep: 8, radiusStep: 0.3, alphaStep: 0.08 });
  // Three admission bands of the rank cut, so the distance can open the census as the canonical cut does.
  return { tile: STAR_TILE, count: kept.length, bands: [{ upTo: 0.24, buckets: band(-1, 0.24) }, { upTo: 0.32, buckets: band(0.24, 0.32) }, { upTo: 0.4, buckets: band(0.32, 0.4) }] };
}
function nebulaTile() {
  const R = rng.mulberry32(NEB_SEED);
  const count = Math.round((138 * NEB_TILE * NEB_TILE) / NEB_AREA);
  const clouds = [];
  for (let k = 0; k < count; k += 1) {
    const x = R() * NEB_TILE;
    const y = R() * NEB_TILE;
    const u = R();
    const r = 220 + Math.pow(R(), 1.6) * 660;
    const hue = u < 0.8 ? [196, 206, 216, 186, 176][Math.floor(R() * 5)] : u < 0.94 ? [230, 242][Math.floor(R() * 2)] : [30, 42][Math.floor(R() * 2)];
    const a = 0.01 + R() * 0.026;
    const rank = R();
    if (rank > 0.86) continue; // P.neb.cut
    clouds.push({ x: round(x, 1), y: round(y, 1), r: round(r, 1), hue, a: round(a, 4) });
  }
  const sat = material.neb.sat;
  const stops = (rows) => rows.map(([offset, ds, l, alpha]) => [offset, sat + ds, l, alpha]);
  return {
    tile: NEB_TILE,
    clouds,
    // [offset, saturation, lightness, alpha] — the three canonical passes.
    base: stops([[0, 0, 50, 1], [0.45, -6, 42, 0.4], [1, -10, 38, 0]]),
    far: stops([[0, 30, 30, 1], [0.42, 26, 27, 0.44], [0.78, 22, 24, 0.11], [1, 22, 22, 0]]),
    map: stops([[0, 34, 30, 1], [0.45, 30, 27, 0.42], [1, 26, 24, 0]]),
    gain: { far: 2.75, map: 2.8 },
  };
}
const stars = starTile();
const nebula = nebulaTile();

// ------------------------------------------------------------------------- tokens (F2 FINAL resolver)
const f2r = await import(pathToFileURL(join(F2R, 'tools/f2-resolve.mjs')).href);
function tokens(contrast) {
  const { flat, applied, sources } = f2r.loadTokens({ appearance: 'dark', contrast });
  if (applied.appearance !== 'dark' || applied.contrast !== contrast) fail(`F2 resolved ${JSON.stringify(applied)}`);
  const colour = (token) => {
    const r = f2r.resolve(flat, token);
    if (typeof r.value !== 'string' || !/^#[0-9a-f]{6}$/u.test(r.value)) fail(`${token} is not an opaque colour: ${JSON.stringify(r.value)}`);
    return { value: r.value, route: r.chain.join(' → ') };
  };
  const number = (token) => {
    const v = f2r.resolve(flat, token).value;
    const n = typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
    if (typeof n !== 'number') fail(`${token} is not a number`);
    return n;
  };
  const node = colour('qandeel.analysis.node');
  const relationInk = colour('qandeel.analysis.relation');
  const marker = colour('qandeel.state.selected.marker');
  const selectedInk = colour('qandeel.state.selected.ink');
  return {
    sources,
    value: {
      world: colour('qandeel.world.fill').value,
      analysisNode: node.value,
      analysisRelation: relationInk.value,
      selectedInk: selectedInk.value,
      selectedMarker: marker.value,
      markerThickness: number('qandeel.state.selected.marker-thickness'),
      // F1: ZERO is the sentinel for "ignore the per-world alphas and draw at full opacity".
      strokeAlphaMultiplier: number('qandeel.expression.accessibility.atmosphere.stroke-alpha-multiplier'),
      routes: { analysisNode: node.route, analysisRelation: relationInk.route, selectedMarker: marker.route },
    },
  };
}
const standard = tokens('standard');
const increased = tokens('increased');
const parallaxFlat = f2r.loadTokens({ appearance: 'dark', contrast: 'standard' }).flat;
const num = (token) => {
  const v = f2r.resolve(parallaxFlat, token).value;
  return typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
};
const parallax = {
  near: num('qandeel.atmosphere.parallax.near'),
  mid: num('qandeel.atmosphere.parallax.mid'),
  far: num('qandeel.atmosphere.parallax.far'),
  reducedDifferential: num('qandeel.illumination.reduced.parallax-differential'),
};
if (parallax.near !== 1 || parallax.reducedDifferential !== 0) fail('the D2R parallax contract moved');
if (standard.value.strokeAlphaMultiplier !== 1 || increased.value.strokeAlphaMultiplier !== 0) fail('the F1 stroke-alpha sentinel moved');

// ----------------------------------------------------------------------------------------- emit
const visual = {
  source: { file: rel(I08B1), sha256: I08B1_SHA256 },
  worldHue,
  mediumShift,
  material,
  floor,
  vignette,
  groundDirection,
  mark,
  relation,
  field,
  profiles,
  shade,
  shapes,
  palettes: { standard: standard.value, increased: increased.value },
  parallax,
};

const tokenSources = [...new Set([...standard.sources, ...increased.sources].map((source) => source.rel))].map((path) => join(F2R, path));
const sources = [I08B1, join(dirname(I08B1), 'I-08B1-WS7R-NOTES.md'), join(F2R, 'tools/f2-resolve.mjs'), ...tokenSources];
const header = (what) => `/**
 * GENERATED by apps/mobile/scripts/generate-world-visual.mjs — do not edit by hand.
 *
 * VPORT-01: ${what}
 * Regenerate after any source changes; the VPORT-01 contract fails on drift.
 *
 * Sources (sha256):
${sources.map((path) => ` *   ${rel(path)}  ${sha(path)}`).join('\n')}
 */
`;

const scheduleBody = scheduleLines.map(({ key, expression }) => `  S.${key} = ${expression};`).join('\n');
const visualBody = `${header('the Living Analysis World\'s material, morphology, distance schedule and state tokens, from the closed I-08B1 source and the frozen token tree.')}
export const WORLD_VISUAL = ${JSON.stringify(visual, null, 2)} as const;

/** The canonical distance schedule — each line below is the I-08B1 \`schedule(A)\` expression of the same name. */
export interface WorldSchedule {
${SCHEDULE_KEYS.map((key) => `  ${key}: number;`).join('\n')}
}

export function worldSchedule(A: number): WorldSchedule {
  'worklet';
  const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
${scheduleLines.some(({ expression }) => expression.includes('lerp(')) ? '  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;\n' : ''}  const ss = (e0: number, e1: number, x: number): number => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const LODON = true;
  const MAPON = true;
  const FARCAL = true;
  const S = {} as WorldSchedule;
${scheduleBody}
  return S;
}

/** The canonical star admission and weight at approach A (\`S.stars\`). */
export function worldStars(A: number, S: WorldSchedule): { cut: number; a: number } {
  'worklet';
  const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const ss = (e0: number, e1: number, x: number): number => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  return {
    cut: lerp(0.24, 0.4, ss(0.08, 0.52, A)) * (1 - ss(0.62, 1.0, A) * 0.28),
    a: (1 - ss(0.3, 0.8, A) * 0.44 + ss(0.78, 1.0, A) * 0.16) * (1 + S.lod * 0.26) * (1 - S.map * 0.42),
  };
}
`;

const fieldBody = `${header('the non-semantic particulate and cloud strata. The dust is the canonical `dustTile()` output itself; the stars and clouds carry the canonical population laws on an authored presentation seed.')}
export const WORLD_DUST = ${JSON.stringify(dust)} as const;

export const WORLD_STARS = ${JSON.stringify(stars)} as const;

export const WORLD_NEBULA = ${JSON.stringify(nebula)} as const;
`;

const outputs = [
  [OUT_VISUAL, visualBody],
  [OUT_FIELD, fieldBody],
];
if (process.argv.includes('--check')) {
  let stale = false;
  for (const [path, body] of outputs) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8').replace(/\r\n/gu, '\n');
    } catch {
      current = '';
    }
    if (current !== body) {
      console.error(`${rel(path)} is stale: regenerate it with node apps/mobile/scripts/generate-world-visual.mjs`);
      stale = true;
    } else console.log(`${rel(path)} is current`);
  }
  if (stale) process.exit(1);
} else {
  for (const [path, body] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    console.log(`wrote ${rel(path)} (${body.length} bytes)`);
  }
  console.log(`dust specks ${dust.specks} in ${dust.buckets.length}+${dust.soft.length} buckets; stars ${stars.count}; clouds ${nebula.clouds.length}`);
}
