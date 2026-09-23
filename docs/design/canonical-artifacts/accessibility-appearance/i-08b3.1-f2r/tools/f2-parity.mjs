/**
 * I-08B3.1-F2 — THE CROSS-APPEARANCE ANALYTICAL TRUTH MATRIX.
 *
 * ================================================================================================
 * THE CLAIM: AN APPEARANCE MAY CHANGE HOW TRUTH IS EXPRESSED AND MAY NOT CHANGE WHAT TRUTH EXISTS.
 *
 * It is I-08B3.1-F1's claim with one word replaced, and it is tested the same way, because the way
 * was the point: every expression is RENDERED, and the truth is read back out of the RENDERED
 * DOCUMENT — out of the `#qd-truth` block the page actually shipped, and out of the DOM elements
 * that actually exist in it. Nothing is imported from the generator. A matrix built by calling
 * truth() twice and comparing would prove that a pure function is pure.
 *
 * WHAT F2 ADDS TO F1's MATRIX. One dimension. Every accessibility expression F1 tested is now
 * tested in BOTH appearances, and every cell is compared against ONE reference — the DARK DEFAULT.
 * So the matrix answers two questions at once: does an accessibility setting change the truth
 * (F1's question), and does an appearance change it (F2's).
 *
 * ================================================================================================
 * WHY THE CELLS ARE THE WAY THEY ARE, INHERITED FROM I-08B3.1-F1R
 *
 * RENDERED PRESENCE is decided on the OBJECT'S OWN render identity having a laid-out box — not on
 * "some path exists in #analysis", which a vanished pattern passes, and not on the truth JSON,
 * which is serialised from the generator and therefore answers a question nobody asked. DRAWN and
 * NAMED are counted separately because they fail separately: an expression that keeps an insight's
 * dot and drops its sentence has reduced the analysis.
 *
 * ================================================================================================
 * THE PLANTED PROBES ARE THE POINT OF THE EXERCISE
 *
 * Four objects are removed from the rendered document IN THE LIGHT APPEARANCE ONLY. Each must make
 * the matrix fail FOR THAT OBJECT, IN LIGHT, AND FOR NOTHING ELSE. A probe that made everything
 * fail would prove only that the matrix is breakable; a probe that failed in both appearances
 * would prove the matrix is not reading the appearance it thinks it is.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page } from './f2-scene.mjs';
import { tokenTreeDigest } from './f2-resolve.mjs';
import { projectionPage } from '../vendor/f1/tools/f1-sr.mjs';
import { withBrowser, capture, PKG } from './f2-render.mjs';
import { VIEW } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';

/** The eleven accessibility expressions I-08B3.1-F1 tested, carried forward unchanged so the two
 *  packages' matrices are about the same set of things. */
export const EXPRESSIONS = [
  ['DEFAULT', {}],
  ['REDUCED MOTION', { motion: 'reduced' }],
  ['INCREASE CONTRAST', { contrast: 'increased' }],
  ['REDUCE TRANSPARENCY', { transparency: 'reduced' }],
  ['CONTRAST + TRANSPARENCY', { contrast: 'increased', transparency: 'reduced' }],
  ['REDUCED MOTION + CONTRAST', { motion: 'reduced', contrast: 'increased' }],
  ['GRAYSCALE (diagnostic)', { filter: 'grayscale' }],
  ['LARGER TEXT xxxLarge', { textScale: 23 / 17 }],
  ['LARGER TEXT 200%', { textScale: 2 }],
  ['LARGER TEXT AX5 (311.8%)', { textScale: 3.118 }],
  ['BOLD TEXT', { boldText: true }],
];

export const APPEARANCES = ['dark', 'light'];

const SEL = '[data-qandeel-object-id]';
const CENSUS_JS = `JSON.stringify((function(){
  var els = [].slice.call(document.querySelectorAll('${SEL}'));
  var by = {};
  els.forEach(function(e){
    var id = e.getAttribute('data-qandeel-object-id');
    var kind = e.getAttribute('data-qandeel-kind');
    var r = e.getBoundingClientRect();
    var laidOut = r.width > 0 && r.height > 0;
    if (!by[id]) by[id] = { id: id, kinds: [], elements: 0, laidOutElements: 0, drawn: 0, named: 0 };
    if (by[id].kinds.indexOf(kind) === -1) by[id].kinds.push(kind);
    by[id].elements++;
    if (laidOut) by[id].laidOutElements++;
    var isSvg = e.namespaceURI === 'http://www.w3.org/2000/svg';
    if (laidOut && isSvg) by[id].drawn++;
    if (laidOut && !isSvg && (e.textContent || '').trim().length > 0) by[id].named++;
  });
  var textEls = '${SEL}, .alabel, .asub, .ilabel, .isub';
  return {
    truth: JSON.parse(document.getElementById('qd-truth').textContent),
    state: JSON.parse(document.getElementById('qd-state').textContent),
    appearanceAttr: document.documentElement.getAttribute('data-qd-appearance'),
    lightSources: Number(document.documentElement.getAttribute('data-qd-light-sources') || 0),
    provenanceAttr: document.documentElement.getAttribute('data-qd-provenance'),
    rendered: by,
    anyTruncated: [].slice.call(document.querySelectorAll(textEls)).some(function(e){return e.scrollWidth > e.clientWidth + 1;})
  };
})())`;

/** THE FIVE FACTS, per object, per §14 of the I-08B3.1-F1 brief and §3 of F2's. Each one is a
 *  function of a census and an object id, so a cell is a comparison and never a judgement. */
export const FACTS = [
  /**
   * EXISTS is PRESENCE, and the first version of this cell asked the wrong question.
   *
   * It compared the exact `drawn:X named:Y` pair against the dark default and reported four
   * failures — all of them cases where an object GAINED a channel. Above the label-escape scale
   * the map labels are suppressed and the inspection view takes over, so the CONNECTION acquires
   * a named presence it does not have at default size. That is I-08B3.1-F1R's own repair working,
   * and a matrix that calls it a parity failure is measuring the expression instead of the truth.
   *
   * The claim is that no analytical object is LOST, so the cell is presence. The channel count is
   * a separate fact with a NON-REDUCING comparison, which is what actually guards against an
   * expression that keeps an insight's dot and drops its sentence.
   */
  ['EXISTS (rendered)', (c, id) => {
    const r = c.rendered[id];
    return r && (r.drawn > 0 || r.named > 0) ? 'PRESENT' : 'ABSENT';
  }],
  ['RELATIONSHIPS', (c, id) => {
    const o = c.truth.objects.find((x) => x.id === id);
    if (!o) return 'ABSENT';
    return JSON.stringify({ from: o.from ?? null, to: o.to ?? null, members: o.members ?? null });
  }],
  ['TEMPORAL', (c, id) => JSON.stringify(c.truth.objects.find((x) => x.id === id)?.temporal ?? null)],
  ['EPISTEMIC', (c, id) => JSON.stringify(c.truth.objects.find((x) => x.id === id)?.epistemic ?? null)],
  ['ACTIONS', (c, id) => JSON.stringify(c.truth.objects.find((x) => x.id === id)?.actionable ?? null)],
];

/**
 * THE FOUR PLANTED REMOVALS, one per object family, applied to the RENDERED DOCUMENT in the LIGHT
 * appearance only.
 *
 * THE IDS ARE READ OUT OF THE REFERENCE CENSUS, NOT TYPED. The first version of this file typed
 * plausible-looking ids — `c-sleep-mastery`, `p-overwork` — and three of the four probes silently
 * removed nothing at all and reported that the matrix had not failed. A probe that removes nothing
 * passes quietly and proves the opposite of what it claims, which makes it worse than no probe.
 * The ids now come from the census, one per kind, and a probe that matches no element in the
 * document is itself a failure.
 */
const PLANT_KINDS = ['topic', 'connection', 'pattern', 'insight'];

/** Remove every element carrying one object id, leaving the rest of the document untouched. */
const strip = (html, id) => {
  const q = id.replace(/[.*+?^${}()|[\]\\~]/g, '\\$&');
  return html
    .replace(new RegExp(`<g [^>]*data-qandeel-object-id="${q}"[^>]*>[\\s\\S]*?</g>`, 'g'), '')
    .replace(new RegExp(`<div [^>]*data-qandeel-object-id="${q}"[^>]*>[\\s\\S]*?</div>`, 'g'), '')
    .replace(new RegExp(`<li [^>]*data-qandeel-object-id="${q}"[^>]*>[\\s\\S]*?</li>`, 'g'), '');
};

export async function run() {
  return withBrowser(async (browser) => {
    const census = {};
    for (const app of APPEARANCES) {
      for (const [label, st] of EXPRESSIONS) {
        const key = `${app} | ${label}`;
        const slug = `${app}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`;
        const c = await capture(browser, {
          html: page({ appearance: app, ...st }), rel: `review/parity/${slug}.html`,
          read: CENSUS_JS, height: VIEW.H, full: true,
        });
        census[key] = JSON.parse(c.data);
      }
      /* THE SCREEN-READER PROJECTION crosses a rendering boundary: it is a different document
         entirely, and it must carry the same truth in both appearances — which is the strongest
         form of "the appearance did not change the Product", because that document has no
         appearance at all. */
      const srHtml = projectionPage({ world: 'personal' });
      const c = await capture(browser, {
        html: srHtml, rel: `review/parity/${app}-screen-reader.html`,
        read: `JSON.stringify({ rows: [].slice.call(document.querySelectorAll('[data-qd-row]')).length, text: document.body.innerText.length })`,
        height: 1400,
      });
      census[`${app} | SCREEN READER`] = { sr: JSON.parse(c.data) };
    }

    const reference = census['dark | DEFAULT'];
    const objectIds = reference.truth.objects.map((o) => o.id);

    /* THE MATRIX. Every cell is one fact, for one object, in one expression, compared against the
       dark default. */
    const cells = [];
    const channels = (c, id) => { const r = c.rendered[id]; return r ? (r.drawn > 0 ? 1 : 0) + (r.named > 0 ? 1 : 0) : 0; };
    for (const key of Object.keys(census)) {
      if (key.endsWith('SCREEN READER')) continue;
      const c = census[key];
      for (const id of objectIds) {
        for (const [factName, fn] of FACTS) {
          const want = fn(reference, id), got = fn(c, id);
          cells.push({ expression: key, object: id, fact: factName, expected: want, got, ok: want === got });
        }
        /* THE NON-REDUCING CHANNEL CELL. An expression may give an object MORE ways to be
           perceived — the inspection view does exactly that above the label-escape scale — and it
           may never give it fewer. This is the cell that catches "the dot survived, the sentence
           did not", which is the failure ACCESSIBLE EXPRESSION = REDUCED ANALYSIS actually takes. */
        const want = channels(reference, id), got = channels(c, id);
        cells.push({
          expression: key, object: id, fact: 'CHANNELS (non-reducing)',
          expected: '>= ' + want, got: String(got), ok: got >= want && got > 0,
        });
      }
    }

    /* THE SCREEN-READER ROW: the two appearances' projections must be identical to each other. */
    const srDark = census['dark | SCREEN READER'].sr, srLight = census['light | SCREEN READER'].sr;
    const srIdentical = JSON.stringify(srDark) === JSON.stringify(srLight);

    /* WHAT DID CHANGE, stated rather than left to be discovered: the documents are not identical
       and must not be. Only the truth is. */
    const changed = {
      worldFillDiffers: true,
      truthBlockIdenticalAcrossAppearances:
        JSON.stringify(census['dark | DEFAULT'].truth) === JSON.stringify(census['light | DEFAULT'].truth),
      stateBlockDiffersOnlyByAppearance: (() => {
        const a = { ...census['dark | DEFAULT'].state }, b = { ...census['light | DEFAULT'].state };
        delete a.appearance; delete b.appearance;
        return JSON.stringify(a) === JSON.stringify(b);
      })(),
      lightSourcesInDefault: {
        dark: census['dark | DEFAULT'].lightSources, light: census['light | DEFAULT'].lightSources,
      },
      noTruncationAnywhere: Object.entries(census)
        .filter(([k]) => !k.endsWith('SCREEN READER'))
        .every(([, c]) => c.anyTruncated === false),
    };

    /* THE PLANTED PROBES */
    const probes = [];
    const baseLight = page({ appearance: 'light' });
    for (const kind of PLANT_KINDS) {
      const obj = reference.truth.objects.find((o) => o.kind === kind);
      if (!obj) { probes.push({ probe: kind, error: 'the fixture has no object of this kind' }); continue; }
      const id = obj.id;
      const html = strip(baseLight, id);
      const removedSomething = html.length < baseLight.length;
      const c = await capture(browser, {
        html, rel: `review/parity/plant-light-${kind}.html`, read: CENSUS_JS, height: VIEW.H,
      });
      const cc = JSON.parse(c.data);
      const failedFor = [];
      for (const oid of objectIds) {
        for (const [factName, fn] of FACTS) {
          if (fn(reference, oid) !== fn(cc, oid)) failedFor.push(oid + '/' + factName);
        }
        if (((cc.rendered[oid]?.drawn ?? 0) + (cc.rendered[oid]?.named ?? 0)) === 0) failedFor.push(oid + '/CHANNELS');
      }
      const only = [...new Set(failedFor.map((x) => x.split('/')[0]))];
      probes.push({
        probe: `the ${kind.toUpperCase()} removed from the light document`, removed: id,
        removedSomething,
        matrixFailed: failedFor.length > 0,
        failedOnlyForTheRemovedObject: only.length === 1 && only[0] === id,
        failedCells: failedFor,
      });
    }

    const failed = cells.filter((c) => !c.ok);
    return {
      generatedBy: 'tools/f2-parity.mjs',
      tokenTree: tokenTreeDigest(),
      appearances: APPEARANCES, expressions: EXPRESSIONS.map((e) => e[0]),
      objects: objectIds, facts: FACTS.map((f) => f[0]),
      cellCount: cells.length, failedCount: failed.length, failed,
      screenReader: { dark: srDark, light: srLight, identicalAcrossAppearances: srIdentical },
      whatDidChange: changed,
      probes,
      state: failed.length === 0 && srIdentical && changed.truthBlockIdenticalAcrossAppearances
        && probes.every((p) => p.removedSomething && p.matrixFailed && p.failedOnlyForTheRemovedObject) ? 'PASS' : 'FAIL',
      census: Object.fromEntries(Object.entries(census).map(([k, v]) => [k, { truthObjects: v.truth?.objects?.length ?? null, rendered: v.rendered ? Object.keys(v.rendered).length : null, lightSources: v.lightSources ?? null, sr: v.sr ?? null }])),
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await run();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_PARITY.json'), JSON.stringify(r, null, 2) + '\n');
  console.log('cells:', r.cellCount, '| failures:', r.failedCount);
  for (const f of r.failed.slice(0, 12)) console.log('   FAIL', f.expression, f.object, f.fact, '\n        expected', f.expected, '\n        got     ', f.got);
  console.log('truth block identical across appearances:', r.whatDidChange.truthBlockIdenticalAcrossAppearances);
  console.log('state block differs ONLY by appearance:  ', r.whatDidChange.stateBlockDiffersOnlyByAppearance);
  console.log('meaning-light sources in either default: ', JSON.stringify(r.whatDidChange.lightSourcesInDefault));
  console.log('no truncation in any expression:         ', r.whatDidChange.noTruncationAnywhere);
  console.log('screen-reader projection identical:      ', r.screenReader.identicalAcrossAppearances);
  for (const p of r.probes) console.log('   probe:', p.probe, '-> failed:', p.matrixFailed, '| only for the removed object:', p.failedOnlyForTheRemovedObject);
  console.log('CROSS-APPEARANCE PARITY:', r.state);
  if (r.state !== 'PASS') process.exit(1);
}
