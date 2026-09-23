/**
 * I-08B3.1-F1R — THE INHERITED-DEFAULT NON-REGRESSION PROOF.
 *
 * WHY THIS FILE EXISTS. F1's spectacle gate claimed to prove that the default expression was
 * unchanged. What it actually proved — and the independent review was right to separate the two
 * — is that the default expression does not NOTICE the accessibility override files. That is
 * ACCESSIBILITY-OVERRIDE ISOLATION, it is worth having, and it is not the same claim: a change
 * hardcoded into F1's own base scene would survive both sides of that comparison untouched,
 * because both sides run the same scene builder.
 *
 * So the ablation keeps its name and its scope, and the missing claim is proved here, against
 * the INHERITED PACKAGE rather than against F1's other self.
 *
 * WHAT CAN AND CANNOT BE COMPARED, STATED BEFORE THE RESULT RATHER THAN AFTER IT.
 *
 * I-08B3.1-D2R's SCENE MODULES are vendored here byte-for-byte and verified by check V-01:
 * d2-world.mjs, d2-foundation.mjs, d2-events.mjs, d2-render.mjs, d2-connection.mjs. Its PAGE —
 * the HTML scaffold that d2-render's `makeRenderer` writes into, with its `plane-N`, `.ring`,
 * `src-N` elements — is NOT vendored, so `makeRenderer` cannot be driven here: there is no
 * document for it to drive. Saying "the vendored D2R renderer was used directly" would be
 * false, and the revision says not to fabricate.
 *
 * WHAT IS THEREFORE PROVED, AND IT IS THE STRONGEST THING THIS PACKAGE'S CONTENTS ALLOW:
 *
 *   I-01  ATTRIBUTE EQUALITY, ELEMENT FOR ELEMENT. The `#atmosphere` group is read back out of
 *         F1's RENDERED default document over CDP, and compared against the geometry, ink,
 *         alpha, width and dash produced by calling D2R's OWN exported functions — contourPath,
 *         ringInk, RINGS, WORLDS, TOPICS, ATMOSPHERE — with no F1 code in the call at all. Every
 *         source-driven visual channel of the inherited layer, checked against its source.
 *
 *   I-02  PIXEL EQUALITY. A REFERENCE PAGE is built from those D2R exports alone — this file
 *         imports nothing from f1-scene.mjs or f1-resolve.mjs to build it — rasterised at the
 *         same viewport and device pixel ratio, and compared by sha256 against F1's default
 *         document with everything that is not the inherited layer removed from the DOM.
 *
 *   I-03  THE ANALYSIS LAYER'S GEOMETRY, against D2R's own PATTERN_LOCUS, PATTERN_MEMBERS,
 *         INSIGHT_SITE, INSIGHT_KEEL and topicById. Its INK is deliberately not compared here:
 *         the analytical relation's ink is the one colour an accessibility state moves, and
 *         that its DEFAULT value is E1's by E1's own route is check D-01's job, not this one's.
 *
 * WHAT REMAINS UNVERIFIED, AND IT IS NOT SMALL:
 *
 *   - THE CHROME, THE NAVIGATION AND THE PANEL. F1 composes a header, a navigation bar and a
 *     proof panel that have no counterpart in the vendored D2R material, so there is nothing
 *     inherited to compare their pixels against. They are F1's own scaffolding and the package
 *     does not claim otherwise.
 *   - THE MOTION. Every frame of every sequence is D2R's and F1 renders only the settled state;
 *     no frame-by-frame comparison is made or claimed.
 *   - THE LIGHT. QANDEEL LIGHT is not painted in this proof's settled scene at all, so its
 *     pixels are inherited by reference and not by comparison.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* D2R's OWN EXPORTS. Everything the reference is built from is on these two lines. */
import { TOPICS, RINGS, WORLDS, contourPath, ringInk, topicById } from '../vendor/d2r/scene/d2-world.mjs';
import { ATMOSPHERE, VIEW } from '../vendor/d2r/scene/d2-foundation.mjs';
import { PATTERN_MEMBERS, PATTERN_LOCUS, INSIGHT_SITE, INSIGHT_KEEL } from '../vendor/d2r/scene/d2-events.mjs';

/* F1's, used ONLY to produce the thing under test — never to build the reference. */
import { page } from './f1-scene.mjs';
import { findChrome, launch, openPage } from './f1-cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const n2 = (x) => Number(x).toFixed(2);

/* The World fill. THIS IS THE ONE LITERAL IN THE REFERENCE and it is I-08B3.1-A's frozen value,
   written here rather than resolved so that the reference cannot be contaminated by F1's own
   token tree. If F1 had moved the World, this page would still paint #101010 and I-02 would
   fail — which is exactly the failure mode the reference exists to catch. */
const WORLD_FILL = '#101010';

/**
 * THE INHERITED ATMOSPHERE, from D2R's functions alone.
 *
 * Deliberately written in the same emission order F1 uses — fill first, then level lines, topic
 * by topic — because I-01 compares element for element in document order, and a comparison that
 * had to sort first would be a weaker one.
 */
export function d2rAtmosphere(worldKey = 'personal') {
  const w = WORLDS[worldKey];
  const out = [];
  for (const t of TOPICS) {
    const hue = ATMOSPHERE.hues[t.hue];
    const ink = ringInk(hue, t.layer);
    const limit = Math.min(w.ringLimit, RINGS[t.layer].length);
    out.push({
      topic: t.id, role: 'fill',
      d: contourPath(t, RINGS[t.layer][0]),
      fill: ink, fillOpacity: String(w.fillAlpha), stroke: 'none', strokeOpacity: null, strokeWidth: null, dash: null,
    });
    for (let ring = 0; ring < limit; ring++) {
      const a = w.strokeAlpha[ring] ?? w.strokeAlpha[w.strokeAlpha.length - 1];
      out.push({
        topic: t.id, role: `ring-${ring}`,
        d: contourPath(t, RINGS[t.layer][ring]),
        fill: 'none', fillOpacity: null, stroke: ink, strokeOpacity: String(a), strokeWidth: '1', dash: w.dash ?? null,
      });
    }
  }
  return out;
}

/** The analysis layer's GEOMETRY, from D2R's own sites. Ink is not asserted here — see I-03. */
export function d2rAnalysisGeometry(connectionFrom, connectionTo) {
  const a = topicById(connectionFrom), b = topicById(connectionTo);
  const g = [{ role: 'connection', d: `M ${n2(a.x)} ${n2(a.y)} L ${n2(b.x)} ${n2(b.y)}` }];
  for (const id of PATTERN_MEMBERS) {
    const m = topicById(id);
    g.push({ role: `pattern-link:${id}`, d: `M ${n2(PATTERN_LOCUS.x)} ${n2(PATTERN_LOCUS.y)} L ${n2(m.x)} ${n2(m.y)}` });
    g.push({ role: `pattern-mark:${id}`, cx: n2(m.x), cy: n2(m.y), r: '3.2' });
  }
  g.push({ role: 'pattern-locus', cx: n2(PATTERN_LOCUS.x), cy: n2(PATTERN_LOCUS.y), r: '5' });
  g.push({ role: 'insight-node', cx: n2(INSIGHT_SITE.x), cy: n2(INSIGHT_SITE.y), r: '5.5' });
  g.push({
    role: 'insight-keel',
    d: `M ${n2(INSIGHT_SITE.x - INSIGHT_KEEL.halfWidth)} ${n2(INSIGHT_SITE.y + INSIGHT_KEEL.dy)} L ${n2(INSIGHT_SITE.x + INSIGHT_KEEL.halfWidth)} ${n2(INSIGHT_SITE.y + INSIGHT_KEEL.dy)}`,
  });
  return g;
}

/** THE REFERENCE PAGE. Nothing from F1 reaches this string. */
export function referencePage(worldKey = 'personal') {
  const rows = d2rAtmosphere(worldKey);
  const body = rows.map((e) => (e.role === 'fill'
    ? `<path d="${e.d}" fill="${e.fill}" fill-opacity="${e.fillOpacity}" stroke="none"/>`
    : `<path d="${e.d}" fill="none" stroke="${e.stroke}" stroke-opacity="${e.strokeOpacity}" stroke-width="${e.strokeWidth}"${e.dash ? ` stroke-dasharray="${e.dash}"` : ''}/>`)).join('\n');
  return `<!doctype html>
<html dir="rtl" lang="ar" data-qd-ready="1">
<head><meta charset="utf-8"><title>D2R INHERITED ATMOSPHERE — REFERENCE</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${WORLD_FILL}}
body{width:${VIEW.W}px}
#stage{position:relative;width:${VIEW.W}px;height:${VIEW.H}px;background:${WORLD_FILL};overflow:hidden}
svg#field{position:absolute;inset:0;display:block}
</style></head>
<body><div id="stage">
<svg id="field" width="${VIEW.W}" height="${VIEW.H}" viewBox="0 0 ${VIEW.W} ${VIEW.H}" aria-hidden="true" focusable="false">
<rect x="0" y="0" width="${VIEW.W}" height="${VIEW.H}" fill="${WORLD_FILL}"/>
<g id="atmosphere">
${body}
</g>
</svg>
</div></body></html>
`;
}

/** Read the inherited layer's written attributes back out of a rendered page. */
const ATMO_JS = `JSON.stringify([].slice.call(document.querySelectorAll('#atmosphere path')).map(function(p){
  var g = p.closest('[data-qandeel-object-id]');
  return {
    topic: g ? g.getAttribute('data-qandeel-object-id') : null,
    d: p.getAttribute('d'),
    fill: p.getAttribute('fill'),
    fillOpacity: p.getAttribute('fill-opacity'),
    stroke: p.getAttribute('stroke'),
    strokeOpacity: p.getAttribute('stroke-opacity'),
    strokeWidth: p.getAttribute('stroke-width'),
    dash: p.getAttribute('stroke-dasharray')
  };
}))`;

const ANALYSIS_JS = `JSON.stringify([].slice.call(document.querySelectorAll('#analysis path, #analysis circle')).map(function(p){
  return { tag: p.tagName, d: p.getAttribute('d'), cx: p.getAttribute('cx'), cy: p.getAttribute('cy'), r: p.getAttribute('r') };
}))`;

/** Strip everything that is NOT the inherited layer, so the raster compares like with like. */
const ISOLATE_JS = `(function(){
  ['#chrome','#nav','#panel','#analysis'].forEach(function(s){ var e = document.querySelector(s); if (e) e.remove(); });
  [].slice.call(document.querySelectorAll('.tlabel,.alabel,.asub')).forEach(function(e){ e.remove(); });
  document.body.style.width = '${VIEW.W}px';
  return String(document.querySelectorAll('#atmosphere path').length);
})()`;

export async function run() {
  const out = join(PKG, 'review', 'inherit');
  mkdirSync(out, { recursive: true });
  const chrome = findChrome();
  if (!chrome) return { state: 'UNVERIFIABLE — no Chrome on this host' };
  const browser = await launch({ chrome, port: 9453 });
  try {
    /* ---- the thing under test: F1's DEFAULT document ---- */
    const f1File = join(out, 'f1-default.html');
    writeFileSync(f1File, page({}));
    const p1 = await openPage(browser, { url: pathToFileURL(f1File).href, width: VIEW.W, height: VIEW.H, dpr: VIEW.DPR });
    const f1Atmo = JSON.parse(await p1.evalIn(ATMO_JS));
    const f1Analysis = JSON.parse(await p1.evalIn(ANALYSIS_JS));
    await p1.evalIn(ISOLATE_JS);
    const f1Png = await p1.shot({ full: true });
    writeFileSync(join(out, 'f1-default-inherited-layer.png'), f1Png);
    await p1.close();

    /* ---- the reference: built from D2R's exports only ---- */
    const refFile = join(out, 'd2r-reference.html');
    writeFileSync(refFile, referencePage());
    const p2 = await openPage(browser, { url: pathToFileURL(refFile).href, width: VIEW.W, height: VIEW.H, dpr: VIEW.DPR });
    const refPng = await p2.shot({ full: true });
    writeFileSync(join(out, 'd2r-reference.png'), refPng);
    await p2.close();

    /* ---- THE PROBE for I-02: the same reference with ONE contour displaced by one pixel.
            If the comparison could not tell these apart it would not be a comparison. ---- */
    const probeFile = join(out, 'd2r-reference-probe.html');
    writeFileSync(probeFile, referencePage().replace(/<path d="M ([\d.]+) /, (m, x) => m.replace(x, String(Number(x) + 1))));
    const p3 = await openPage(browser, { url: pathToFileURL(probeFile).href, width: VIEW.W, height: VIEW.H, dpr: VIEW.DPR });
    const probePng = await p3.shot({ full: true });
    await p3.close();

    /* ---- I-01: attribute equality, element for element ---- */
    const expected = d2rAtmosphere('personal');
    const diffs = [];
    if (f1Atmo.length !== expected.length) {
      diffs.push({ kind: 'count', f1: f1Atmo.length, d2r: expected.length });
    } else {
      for (let i = 0; i < expected.length; i++) {
        const a = f1Atmo[i], b = expected[i];
        for (const k of ['d', 'fill', 'fillOpacity', 'stroke', 'strokeOpacity', 'strokeWidth', 'dash']) {
          const av = a[k] ?? null, bv = b[k] ?? null;
          if (String(av) !== String(bv)) diffs.push({ index: i, topic: b.topic, role: b.role, field: k, f1: av, d2r: bv });
        }
        if (a.topic !== b.topic) diffs.push({ index: i, field: 'renderIdentity', f1: a.topic, d2r: b.topic });
      }
    }

    /* ---- I-03: the analysis layer's geometry ---- */
    const expectedGeom = d2rAnalysisGeometry('task-delay', 'comparison');
    const geomDiffs = [];
    if (f1Analysis.length !== expectedGeom.length) {
      geomDiffs.push({ kind: 'count', f1: f1Analysis.length, d2r: expectedGeom.length });
    } else {
      for (let i = 0; i < expectedGeom.length; i++) {
        const a = f1Analysis[i], b = expectedGeom[i];
        for (const k of ['d', 'cx', 'cy', 'r']) {
          const av = a[k] ?? null, bv = b[k] ?? null;
          if (String(av) !== String(bv)) geomDiffs.push({ index: i, role: b.role, field: k, f1: av, d2r: bv });
        }
      }
    }

    return {
      state: 'COMPARED',
      i01: {
        what: 'Every written attribute of the inherited ATMOSPHERE layer, read out of F1\'s rendered default document, against the same channel computed by calling I-08B3.1-D2R\'s own exported functions.',
        elementsCompared: f1Atmo.length,
        fieldsPerElement: 7,
        diffs,
        pass: diffs.length === 0 && f1Atmo.length > 0,
        probe: (() => {
          /* one alpha perturbed, fed to the same comparison */
          const wrong = expected.map((e, i) => (i === 1 ? { ...e, strokeOpacity: '0.5' } : e));
          let n = 0;
          for (let i = 0; i < wrong.length; i++) if (String(f1Atmo[i]?.strokeOpacity ?? null) !== String(wrong[i].strokeOpacity ?? null)) n++;
          return { input: 'the same comparison with one stroke alpha changed to 0.5', rejected: n > 0 };
        })(),
      },
      i02: {
        what: 'F1\'s DEFAULT document with everything that is not the inherited layer removed from the DOM, rasterised at 390x844 dpr 2, against a reference page built from D2R\'s exports alone.',
        f1Sha: sha(f1Png),
        referenceSha: sha(refPng),
        identical: sha(f1Png) === sha(refPng),
        pass: sha(f1Png) === sha(refPng),
        probe: { input: 'the same reference with one contour displaced by one pixel', rejected: sha(probePng) !== sha(refPng) },
      },
      i03: {
        what: 'The settled analysis layer\'s GEOMETRY against D2R\'s own PATTERN_LOCUS, PATTERN_MEMBERS, INSIGHT_SITE, INSIGHT_KEEL and topicById. Its INK is check D-01\'s subject, not this one\'s.',
        elementsCompared: f1Analysis.length,
        diffs: geomDiffs,
        pass: geomDiffs.length === 0 && f1Analysis.length > 0,
      },
      unverified: [
        'THE CHROME, THE NAVIGATION AND THE PANEL. F1 composes a header, a navigation bar and a proof panel with no counterpart in the vendored D2R material. There is nothing inherited to compare their pixels against, and this package does not claim there is.',
        'THE MOTION. F1 renders only the settled state. No frame of any sequence is compared, and no claim about the frames is made here — D2R proved the settled residue and F1 builds on that finding rather than re-establishing it.',
        'QANDEEL LIGHT. It is not painted in the settled scene, so its pixels are inherited by reference rather than by comparison.',
        'D2R\'S OWN PAGE. Its HTML scaffold is not vendored in this package, so `makeRenderer` cannot be driven here. The reference is built from D2R\'s data and geometry functions instead, and this file says so rather than claiming the renderer was used.',
      ],
    };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = await run();
  writeFileSync(join(PKG, 'data/F1_INHERITED_DEFAULT.json'), JSON.stringify({ generatedBy: 'tools/f1-inherit.mjs', ...res }, null, 2) + '\n');
  if (res.state !== 'COMPARED') { console.log(res.state); process.exit(1); }
  console.log('I-01 attribute equality —', res.i01.elementsCompared, 'elements x', res.i01.fieldsPerElement, 'fields |', res.i01.diffs.length ? JSON.stringify(res.i01.diffs.slice(0, 4)) : 'no differences', '| PASS:', res.i01.pass, '| probe rejected:', res.i01.probe.rejected);
  console.log('I-02 pixel equality    —', res.i02.f1Sha.slice(0, 24), 'vs', res.i02.referenceSha.slice(0, 24), '| identical:', res.i02.identical, '| probe rejected a 1px shift:', res.i02.probe.rejected);
  console.log('I-03 analysis geometry —', res.i03.elementsCompared, 'elements |', res.i03.diffs.length ? JSON.stringify(res.i03.diffs.slice(0, 4)) : 'no differences', '| PASS:', res.i03.pass);
  console.log('\nUNVERIFIED:');
  for (const u of res.unverified) console.log('  -', u.split('.')[0] + '.');
  if (!(res.i01.pass && res.i02.pass && res.i03.pass && res.i01.probe.rejected && res.i02.probe.rejected)) process.exit(1);
}
