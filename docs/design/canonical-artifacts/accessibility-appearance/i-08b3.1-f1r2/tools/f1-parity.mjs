/**
 * I-08B3.1-F1 — THE ANALYTICAL TRUTH PARITY MATRIX.
 *
 * THE CLAIM: an accessibility expression may change HOW truth is expressed and may not change
 * WHAT truth exists.
 *
 * HOW IT IS TESTED, AND WHY IT IS TESTED THIS WAY. Each expression is RENDERED, and the truth
 * is then read back out of the RENDERED DOCUMENT — out of the `#qd-truth` block that the page
 * actually shipped, and out of the DOM elements that actually exist in it. It is not imported
 * from the generator. A matrix built by calling truth() six times and comparing the results
 * would prove that a pure function is pure, which nobody doubted; this one can catch a
 * transformation that silently dropped an object on its way to the page, which is the failure
 * §3 of the brief is actually about.
 *
 * FIVE FACTS PER OBJECT, per §14:
 *   1 the object EXISTS
 *   2 its RELATIONSHIPS are the same
 *   3 its TEMPORAL truth is the same
 *   4 its UNCERTAINTY / epistemic status is the same
 *   5 the USER ACTIONS available on it are the same
 *
 * The SCREEN READER column is the projection, which is a different document entirely — so the
 * matrix crosses a rendering boundary rather than comparing six variants of one page.
 *
 * ------------------------------------------------------------------------------------------
 * WHAT I-08B3.1-F1R HAD TO REPAIR HERE, AND THE INDEPENDENT REVIEW WAS RIGHT ABOUT ALL OF IT.
 *
 * THE MATRIX COULD FALSELY PASS. Two cells were satisfied by evidence that was not about the
 * object being tested:
 *
 *   - a PATTERN or a CONNECTION counted as rendered if `#analysis` contained ANY `<path>`.
 *     Eight topics' contours are paths, and so is the other object's link. A pattern could
 *     vanish entirely and the cell stayed green.
 *   - an INSIGHT counted as rendered if the object was in the `#qd-truth` JSON. That block is
 *     serialised straight from the generator, so the cell was asking whether the generator had
 *     produced the object — which nobody doubted — and not whether the page had drawn it.
 *
 * And under the two LARGER TEXT expressions the defect was not hypothetical: above the label
 * escape scale the connection, pattern and insight had NO rendered presence at all, because the
 * map labels were suppressed and the inspection view listed only topics. The matrix reported
 * PASS. That is precisely ACCESSIBLE EXPRESSION = REDUCED ANALYSIS, which is the thing F1
 * exists to forbid.
 *
 * THE REPAIR, IN THREE PARTS.
 *
 *   1. EVERY analytical object carries an OBJECT-SPECIFIC RENDER IDENTITY —
 *      `data-qandeel-object-id` plus `data-qandeel-kind` — written by tools/f1-scene.mjs on the
 *      actual drawn or represented object, with multi-primitive objects grouped under one.
 *   2. RENDERED PRESENCE means: an element carrying that object's id exists AND has a laid-out
 *      box of non-zero extent. The truth JSON is still read, and is explicitly NOT evidence of
 *      it; check P-02 proves that by deleting the rendering and leaving the JSON in place.
 *   3. FOUR PLANTED PROBES, one per object family, each removing exactly one object from the
 *      RENDERED document and requiring the matrix to fail — for that object and for no other.
 *      A probe that made everything fail would prove only that the matrix is breakable.
 * ------------------------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page } from './f1-scene.mjs';
import { resolveAll } from './f1-resolve.mjs';
import { projection, projectionPage } from './f1-sr.mjs';
import { findChrome, launch, openPage } from './f1-cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/**
 * THE EXPRESSIONS. Reduced motion appears here as a state of the SETTLED scene, which is exactly
 * what makes the comparison legitimate rather than convenient: I-08B3.1-D2R proved that every
 * reduced counterpart reaches the SAME settled residue as its full-motion sibling and that the
 * settled frames are byte-identical across sequences. So at settle there is one scene, and the
 * question "does reduced motion delete an analytical object" is answered by asking whether the
 * settled scene still contains it. The frames themselves are Board D's job, not this matrix's.
 */
export const EXPRESSIONS = [
  ['DEFAULT', {}],
  ['REDUCED MOTION', { motion: 'reduced' }],
  ['INCREASE CONTRAST', { contrast: 'increased' }],
  ['REDUCE TRANSPARENCY', { transparency: 'reduced' }],
  ['CONTRAST + TRANSPARENCY', { contrast: 'increased', transparency: 'reduced' }],
  ['REDUCED MOTION + CONTRAST', { motion: 'reduced', contrast: 'increased' }],
  ['GRAYSCALE (diagnostic)', { filter: 'grayscale' }],
  /* xxxLarge is the largest NON-accessibility Dynamic Type size — iOS Body 23 pt against a
     default of 17 — and it is the size most people who enlarge text actually reach. Testing only
     the accessibility sizes would skip the common case. */
  ['LARGER TEXT xxxLarge', { textScale: 23 / 17 }],
  ['LARGER TEXT 200%', { textScale: 2 }],
  ['LARGER TEXT AX5 (311.8%)', { textScale: 3.118 }],
  ['BOLD TEXT', { boldText: true }],
];

/**
 * THE CENSUS. Read out of the rendered page, in the page.
 *
 * `rendered` is the load-bearing field and it is built object by object: every element carrying
 * a `data-qandeel-object-id` is collected, grouped by that id, and each group is asked whether
 * ANY of its elements has a laid-out box with non-zero extent. An attribute on an element that
 * was never laid out is not a rendered object, and neither is an entry in the truth JSON.
 *
 * `truth` is still read, because the matrix needs the object's FACTS from somewhere — but it is
 * never consulted for the question "was it drawn".
 */
const SEL = '[data-qandeel-object-id]';
/**
 * THE LEADING THRESHOLD IS READ FROM THE TOKEN TREE, not typed here. It used to be the literal
 * 1.6 inside this script, which meant the census and the contract could drift apart silently.
 *
 * AND I-08B3.1-F1R2 CHANGED WHAT IT IS. F1R made 1.6 a PRODUCT CONTRACT binding every
 * Arabic-bearing element at every size forever. It is not: it is the threshold at which THIS
 * face, at THESE sizes, on THIS renderer, was measured to clip. The contract is
 * `text.arabic-must-not-clip` — no clipping, no lost diacritics, no destructive collision — and
 * this number is the instrument that currently tests it. So the census reports the MEASURED
 * minimum ratio alongside the boolean, because a measurement a reader can see is what lets a
 * later face or platform re-instantiate the threshold without anyone pretending the contract
 * moved.
 */
const LEADING_FLOOR = resolveAll().scalar.TEXT_LEADING_FLOOR.value;
const CENSUS_JS = `JSON.stringify((function(){
  var els = [].slice.call(document.querySelectorAll('${SEL}'));
  var by = {};
  els.forEach(function(e){
    var id = e.getAttribute('data-qandeel-object-id');
    var kind = e.getAttribute('data-qandeel-kind');
    var r = e.getBoundingClientRect();
    var laidOut = r.width > 0 && r.height > 0;
    if (!by[id]) by[id] = { id: id, kinds: [], elements: 0, laidOutElements: 0, drawn: 0, named: 0, maxW: 0, maxH: 0 };
    if (by[id].kinds.indexOf(kind) === -1) by[id].kinds.push(kind);
    by[id].elements++;
    if (laidOut) by[id].laidOutElements++;
    /* TWO KINDS OF PRESENCE, COUNTED SEPARATELY, because they fail separately.
       DRAWN: the object is painted in the field. NAMED: the object's own words are on the page.
       An INSIGHT whose content is a sentence is not expressed by a dot and a keel, so an
       expression that keeps the drawing and drops the reading has reduced the analysis. */
    var isSvg = e.namespaceURI === 'http://www.w3.org/2000/svg';
    if (laidOut && isSvg) by[id].drawn++;
    if (laidOut && !isSvg && (e.textContent || '').trim().length > 0) by[id].named++;
    by[id].maxW = Math.max(by[id].maxW, Math.round(r.width * 100) / 100);
    by[id].maxH = Math.max(by[id].maxH, Math.round(r.height * 100) / 100);
  });
  var textEls = '${SEL}, .alabel, .asub, .ilabel, .isub';
  return {
    truth: JSON.parse(document.getElementById('qd-truth').textContent),
    state: JSON.parse(document.getElementById('qd-state').textContent),
    provenanceAttr: document.documentElement.getAttribute('data-qd-provenance'),
    rendered: by,
    svgPaths: document.querySelectorAll('#analysis path').length,
    svgMarks: document.querySelectorAll('#analysis circle').length,
    topicsLaidOut: Object.keys(by).filter(function(k){ return by[k].kinds.indexOf('topic') !== -1 && by[k].laidOutElements > 0; }).length,
    anyTruncated: [].slice.call(document.querySelectorAll(textEls)).some(function(e){return e.scrollWidth > e.clientWidth + 1;}),
    anyClipped: [].slice.call(document.querySelectorAll(textEls + ', .reason')).filter(function(e){return e.namespaceURI !== 'http://www.w3.org/2000/svg';}).some(function(e){var cs=getComputedStyle(e);return parseFloat(cs.lineHeight) < parseFloat(cs.fontSize) * ${LEADING_FLOOR};}),
    /* THE MEASUREMENT ITSELF, not only the verdict against one threshold. */
    minLeadingRatio: (function(){
      var rs = [].slice.call(document.querySelectorAll(textEls + ', .reason'))
        .filter(function(e){return e.namespaceURI !== 'http://www.w3.org/2000/svg';})
        .map(function(e){var cs=getComputedStyle(e);return parseFloat(cs.lineHeight)/parseFloat(cs.fontSize);})
        .filter(function(n){return isFinite(n);});
      return rs.length ? Math.round(Math.min.apply(null, rs) * 1000) / 1000 : null;
    })(),
    restWeight: (function(){var e=document.querySelector('.irow.rest'); return e? getComputedStyle(e).fontWeight : null;})(),
    selWeight: (function(){var e=document.querySelector('.irow.selected'); return e? getComputedStyle(e).fontWeight : null;})(),
    minFontPx: Math.min.apply(null, [].slice.call(document.querySelectorAll('.tlabel, .alabel, .ilabel, #inspection li')).map(function(e){return parseFloat(getComputedStyle(e).fontSize);}))
  };
})())`;

/** Remove one analytical object from the RENDERED document and leave the truth JSON alone.
 *  This is the planted probe, and it is done in the page rather than by editing the source so
 *  that what is proved is "the census notices a disappearance", whatever caused it. */
const REMOVE_JS = (id) => `(function(){
  var els = [].slice.call(document.querySelectorAll('[data-qandeel-object-id="' + ${JSON.stringify(id)} + '"]'));
  els.forEach(function(e){ e.parentNode.removeChild(e); });
  return String(els.length);
})()`;

export async function run(outDir) {
  mkdirSync(outDir, { recursive: true });
  const chrome = findChrome();
  if (!chrome) return { state: 'UNVERIFIABLE — no Chrome on this host' };
  const browser = await launch({ chrome, port: 9441 });
  const rows = [];
  try {
    for (const [label, st] of EXPRESSIONS) {
      const file = join(outDir, `parity-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`);
      writeFileSync(file, page(st));
      const p = await openPage(browser, { url: pathToFileURL(file).href, width: 390, height: 844, dpr: 2 });
      const census = JSON.parse(await p.evalIn(CENSUS_JS));
      await p.close();
      rows.push({ label, state: st, census });
    }
    /* the screen-reader column, from the OTHER document */
    const srFile = join(outDir, 'parity-screen-reader.html');
    writeFileSync(srFile, projectionPage());
    const sp = await openPage(browser, { url: pathToFileURL(srFile).href, width: 390, height: 1400, dpr: 2 });
    const srCensus = JSON.parse(await sp.evalIn(`JSON.stringify({
      projection: JSON.parse(document.getElementById('qd-projection').textContent),
      domIds: [...document.querySelectorAll('[data-qandeel-object-id]')].filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(function(e){return e.getAttribute('data-qandeel-object-id');})
    })`));
    await sp.close();
    rows.push({ label: 'SCREEN READER PROJECTION', state: { projection: true }, srCensus });

    /* ---------------------------------------------------- THE FOUR PLANTED REMOVALS ------- */
    /**
     * One per analytical object family, chosen from the DEFAULT row's own truth rather than
     * hardcoded, so a later change to the scene cannot leave a probe pointing at nothing.
     *
     * Each probe renders the DEFAULT expression, deletes exactly one object's rendered elements
     * IN THE PAGE, and re-censuses. The truth JSON is untouched — which is the whole point:
     * these four runs are also the proof that the truth JSON alone cannot satisfy rendered
     * presence, because in every one of them the object is still in the JSON and must still be
     * reported ABSENT.
     */
    const base = rows.find((r) => r.label === 'DEFAULT');
    const victims = ['topic', 'connection', 'pattern', 'insight'].map((kind) => {
      const o = base.census.truth.objects.find((x) => x.kind === kind);
      return { kind, id: o.id };
    });
    const planted = [];
    for (const v of victims) {
      const file = join(outDir, `plant-removed-${v.kind}.html`);
      writeFileSync(file, page({}));
      const p = await openPage(browser, { url: pathToFileURL(file).href, width: 390, height: 844, dpr: 2 });
      const removedCount = Number(await p.evalIn(REMOVE_JS(v.id)));
      const census = JSON.parse(await p.evalIn(CENSUS_JS));
      await p.close();
      planted.push({ ...v, elementsRemoved: removedCount, stillInTruthJSON: census.truth.objects.some((o) => o.id === v.id), census });
    }
    rows.push({ label: 'PLANTED', planted });
  } finally {
    await browser.close();
  }
  return { state: 'RENDERED', rows };
}

/**
 * RENDERED PRESENCE, as ONE predicate used by the matrix and by every planted probe alike.
 *
 * An object is rendered when at least one element carries its OWN id and that element was laid
 * out with non-zero extent. No path count, no truth-JSON entry, no sibling object's evidence.
 */
export function renderedPresence(census, object) {
  const g = census.rendered?.[object.id];
  if (!g) return { present: false, named: false, why: 'no element carries this object\'s render identity' };
  if (!g.kinds.includes(object.kind)) return { present: false, named: false, why: `render identity declares kind ${g.kinds.join('/')}, not ${object.kind}` };
  if (!(g.laidOutElements > 0)) return { present: false, named: false, why: 'the render identity exists but nothing carrying it has a laid-out box' };
  return {
    present: true,
    /* NAMED is reported alongside PRESENT rather than folded into it, so a failure says WHICH
       of the two went missing. The matrix requires both. */
    named: g.named > 0,
    drawnElements: g.drawn,
    namedElements: g.named,
    elements: g.elements,
    laidOutElements: g.laidOutElements,
    box: [g.maxW, g.maxH],
  };
}

export function matrix(rows) {
  const base = rows.find((r) => r.label === 'DEFAULT');
  if (!base) throw new Error('f1-parity: no DEFAULT row');
  const baseObjects = base.census.truth.objects;
  const key = (o) => o.id;

  /* `exists` is NOT in here any more. It used to be the constant `true`, which is what let a
     fact table describe an object that was not on the page. Existence is now decided only by
     renderedPresence(), against the expression's own census. */
  const facts = (o) => ({
    relationship: o.kind === 'connection' ? `${o.from}->${o.to}` : o.kind === 'pattern' ? [...o.members].sort().join('+') : null,
    temporal: o.temporal ?? 'ABSENT',
    epistemic: o.epistemic ?? 'ABSENT',
    actionable: o.actionable ?? 'ABSENT',
  });
  const baseFacts = Object.fromEntries(baseObjects.map((o) => [key(o), facts(o)]));

  const cells = [];
  for (const r of rows) {
    if (r.label === 'PLANTED') continue;
    if (r.srCensus) {
      /* the projection column: the objects are the axis items, and the DOM ids prove each one
         reached the page rather than only the JSON */
      const items = r.srCensus.projection.axes.flatMap((a) => a.items);
      const present = new Set(r.srCensus.domIds);
      for (const o of baseObjects) {
        const it = items.find((x) => x.id === o.id);
        const b = baseFacts[key(o)];
        cells.push({
          expression: r.label, object: o.id, kind: o.kind,
          exists: !!it && present.has(o.id),
          /* in the projection every render identity is on a text element carrying the object's
             own words, so presence there IS naming — but it is asserted rather than assumed */
          named: !!it && present.has(o.id),
          relationshipSame: o.kind === 'connection' ? it?.from === o.from && it?.to === o.to
            : o.kind === 'pattern' ? [...(it?.members ?? [])].sort().join('+') === b.relationship
              : true,
          /* ABSENT is normalised the same way on both sides, so "the view stated nothing" is a
             fact that must be preserved across the boundary rather than a hole that matches
             anything. A projection that invented `current` for the object whose temporal state
             was never supplied would fail this cell. */
          temporalSame: (it?.temporal ?? 'ABSENT') === b.temporal,
          epistemicSame: (it?.epistemic ?? 'ABSENT') === b.epistemic,
          actionsSame: (it?.actionable ?? 'ABSENT') === b.actionable,
        });
      }
      continue;
    }
    const objs = r.census.truth.objects;
    for (const o of baseObjects) {
      const here = objs.find((x) => key(x) === key(o));
      const f = here ? facts(here) : null;
      const b = baseFacts[key(o)];
      /* EVERY KIND IS ASKED THE SAME QUESTION, AGAINST ITS OWN RENDER IDENTITY. There is no
         longer a per-kind fallback, because every per-kind fallback this file had was a way of
         accepting someone else's evidence. */
      const rp = renderedPresence(r.census, o);
      cells.push({
        expression: r.label, object: o.id, kind: o.kind,
        exists: rp.present,
        named: rp.named,
        renderedPresence: rp,
        inTruthJSON: !!here,
        relationshipSame: f?.relationship === b.relationship,
        temporalSame: f?.temporal === b.temporal,
        epistemicSame: f?.epistemic === b.epistemic,
        actionsSame: f?.actionable === b.actionable,
      });
    }
  }

  const ok = (c) => c.exists && c.relationshipSame && c.temporalSame && c.epistemicSame && c.actionsSame;
  const failures = cells.filter((c) => !ok(c));

  /* ---------------------------------------------------------- NAMING, AND WHAT IT PROVED -- */
  /**
   * A SECOND AXIS, ADDED IN F1R, AND THE FIRST THING IT FOUND WAS A FACT ABOUT THE FROZEN
   * DESIGN RATHER THAN A DEFECT IN F1.
   *
   * "Rendered" and "named" fail separately. An INSIGHT whose content is a sentence is not
   * expressed by a dot and a keel; an expression that keeps the drawing and drops the reading
   * has reduced the analysis while passing every existence cell.
   *
   * So the census counts the two separately — DRAWN is an SVG element carrying the object's
   * identity, NAMED is a text element carrying it with words in it — and the first run reported
   * that the CONNECTION is drawn and never named in the default visual expression. That is
   * true, it is I-08B3.1-D2R's frozen grammar (a relation is a stroke between two named
   * topics), and F1 may not add a label to the Living Analysis World: doing so would change the
   * accepted default pixels, which the revision forbids outright.
   *
   * THE REQUIREMENT IS THEREFORE ABOUT REGRESSION, WHICH IS WHAT THE LAW ACTUALLY SAYS.
   * ACCESSIBLE EXPRESSION ≠ REDUCED ANALYSIS is a comparison with the default, not an absolute:
   *
   *   N-a  no accessibility expression may name FEWER objects than the DEFAULT names;
   *   N-b  EVERY object must be named in the screen-reader projection, with no exception,
   *        because there the drawing is not available at all;
   *   N-c  every object must be named in the INSPECTION VIEW — the expression that exists
   *        precisely because the map can no longer carry a label.
   *
   * N-c is the one that failed before this repair, and it is why the inspection view now lists
   * every kind instead of only the topics.
   */
  const namedSet = (label) => new Set(cells.filter((c) => c.expression === label && c.named).map((c) => c.object));
  const defaultNamed = namedSet('DEFAULT');
  const naming = [...new Set(cells.map((c) => c.expression))].map((label) => {
    const here = namedSet(label);
    const lost = [...defaultNamed].filter((id) => !here.has(id));
    return { expression: label, namedCount: here.size, lostRelativeToDefault: lost, regression: lost.length > 0 };
  });
  const srNamed = namedSet('SCREEN READER PROJECTION');
  const objectsNotNamedInProjection = baseObjects.filter((o) => !srNamed.has(o.id)).map((o) => o.id);
  /* the inspection view is whichever expression escapes the map — AX5 is the largest */
  const inspectionNamed = namedSet('LARGER TEXT AX5 (311.8%)');
  const objectsNotNamedInInspectionView = baseObjects.filter((o) => !inspectionNamed.has(o.id)).map((o) => o.id);
  const namedOnlyInTheDefaultDrawing = baseObjects.filter((o) => !defaultNamed.has(o.id)).map((o) => o.id);

  const namingPass =
    naming.every((n) => !n.regression) &&
    objectsNotNamedInProjection.length === 0 &&
    objectsNotNamedInInspectionView.length === 0;

  /* --------------------------------------------- THE FOUR PLANTED REMOVALS, EVALUATED ---- */
  /**
   * Each planted row is put through the SAME predicate. Three things must hold for each:
   *
   *   1. the removed object is reported ABSENT — the matrix fails for it;
   *   2. the object is STILL IN THE TRUTH JSON — so the failure proves that the JSON alone does
   *      not satisfy rendered presence;
   *   3. NO OTHER object is disturbed — the probe is specific, not a demolition.
   */
  const plantedRow = rows.find((r) => r.label === 'PLANTED');
  const planted = (plantedRow?.planted ?? []).map((p) => {
    const results = baseObjects.map((o) => ({ id: o.id, kind: o.kind, present: renderedPresence(p.census, o).present }));
    const victim = results.find((x) => x.id === p.id);
    const others = results.filter((x) => x.id !== p.id);
    return {
      removed: { kind: p.kind, id: p.id },
      elementsRemoved: p.elementsRemoved,
      stillInTruthJSON: p.stillInTruthJSON,
      victimReportedAbsent: victim ? victim.present === false : false,
      everyOtherObjectStillPresent: others.every((x) => x.present),
      othersDisturbed: others.filter((x) => !x.present).map((x) => x.id),
      caught: !!victim && victim.present === false && p.stillInTruthJSON && others.every((x) => x.present),
    };
  });
  const plantedAllCaught = planted.length === 4 && planted.every((p) => p.caught);

  /* THE STRUCTURAL PROBE, kept from F1: the same predicate fed a fabricated cell in which an
     object is missing. It costs nothing and it demonstrates the failure branch even on a host
     with no browser at all. */
  const probeCell = { expression: 'PROBE', object: 'probe:absent', exists: false, relationshipSame: true, temporalSame: true, epistemicSame: true, actionsSame: true };
  const probeCaught = !ok(probeCell);

  return {
    /**
     * WHAT THIS MATRIX IS EVIDENCE OF — READ OUT OF THE RENDERED DOCUMENT'S OWN SCOPE BLOCK,
     * added by I-08B3.1-F1R2 (REV-01, REV-06).
     *
     * The cells below are a BOUNDED PROOF. Every one of them is evidence about the semantic
     * dimensions the disclosed view actually supplies — and F1R's documents described that
     * three-field allowlist as "the complete list of what a projection may carry", which turned a
     * bounded test into a claim about the Product's whole semantic model.
     *
     * The Product contract is wider than this matrix and always will be: NO USER-EXPOSABLE
     * DISCLOSED ANALYTICAL TRUTH MAY BE LOST SOLELY BECAUSE THE EXPRESSION IS ACCESSIBLE. The
     * complete production mapping is validated against the real canonical V schema at integration.
     */
    scope: {
      boundedTo: base.census.truth.scope?.fieldsSuppliedByThisFixture ?? null,
      exhaustive: base.census.truth.scope?.exhaustive ?? null,
      whatTheseCellsProve: 'Rendered presence, naming, structure, relationships, and preservation of the semantic dimensions this fixture supplies — across every expression.',
      whatTheseCellsDoNotProve: 'That the projection carries every semantic field a real canonical V may expose. No canonical V exists in this package.',
      productContract: base.census.truth.scope?.productContract ?? null,
      implementationDependency: base.census.truth.scope?.implementationDependency ?? null,
      unmappedFieldsDetected: base.census.truth.unmappedFields ?? [],
    },
    expressions: rows.filter((r) => r.label !== 'PLANTED').map((r) => r.label),
    objects: baseObjects.map((o) => ({ id: o.id, kind: o.kind })),
    cells,
    cellCount: cells.length,
    failures,
    naming: {
      perExpression: naming,
      objectsNotNamedInTheScreenReaderProjection: objectsNotNamedInProjection,
      objectsNotNamedInTheInspectionView: objectsNotNamedInInspectionView,
      drawnButNotNamedInTheDefaultVisualExpression: namedOnlyInTheDefaultDrawing,
      note: 'The last row is an INHERITED property of I-08B3.1-D2R\'s grammar, not an F1 decision: a relation is drawn as a stroke between two named topics and carries no label of its own. F1 may not add one, because that would change the accepted default pixels. It is named in the inspection view and in the screen-reader projection, and F1_KNOWN_LIMITATIONS.md records it.',
      pass: namingPass,
    },
    planted,
    plantedAllCaught,
    truthJsonIsNotEvidenceOfRendering: planted.every((p) => p.stillInTruthJSON && p.victimReportedAbsent),
    probe: { cell: probeCell, caught: probeCaught },
    pass: failures.length === 0 && probeCaught && plantedAllCaught && namingPass,
  };
}

/** The text-specific observations the matrix cannot express as an object fact. */
export function textFindings(rows) {
  return rows
    .filter((r) => r.census)
    .map((r) => ({
      expression: r.label,
      textScale: r.census.state.textScale,
      bold: r.census.state.boldText,
      labelsVisibleOnMapOrList: r.census.topicsLaidOut,
      /* EVERY KIND, NOT ONLY THE TOPICS. The old row counted topic labels and called it
         reachability, which is how the missing connection, pattern and insight above the label
         escape scale went unnoticed for a whole package. */
      objectsRenderedByKind: (() => {
        const by = { topic: 0, connection: 0, pattern: 0, insight: 0 };
        for (const g of Object.values(r.census.rendered ?? {})) {
          if (g.laidOutElements > 0) for (const k of g.kinds) if (k in by) by[k]++;
        }
        return by;
      })(),
      anyTruncated: r.census.anyTruncated,
      /* THE CONTRACT IS `text.arabic-must-not-clip`; this row is the current instrument reading.
         The field keeps a threshold-free name since F1R2, because the old `anyLineHeightBelow1_6`
         froze a production default into an identifier — which is how a tunable number starts
         looking like a law. */
      anyArabicLeadingBelowThreshold: r.census.anyClipped,
      minMeasuredLeadingRatio: r.census.minLeadingRatio,
      minRenderedFontPx: r.census.minFontPx,
      restWeight: r.census.restWeight,
      selectedWeight: r.census.selWeight,
      weightStepPreserved: r.census.restWeight && r.census.selWeight ? Number(r.census.selWeight) - Number(r.census.restWeight) : null,
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = join(PKG, 'review', 'parity');
  const res = await run(out);
  if (res.state !== 'RENDERED') { console.log(res.state); process.exit(1); }
  const m = matrix(res.rows);
  const t = textFindings(res.rows);
  writeFileSync(join(PKG, 'data/F1_PARITY.json'), JSON.stringify({ generatedBy: 'tools/f1-parity.mjs', matrix: m, text: t }, null, 2) + '\n');
  console.log('expressions:', m.expressions.length, '| objects:', m.objects.length, '| cells:', m.cellCount);
  console.log('failures:', m.failures.length ? JSON.stringify(m.failures.slice(0, 6), null, 2) : 'none');
  console.log('probe caught a fabricated missing object:', m.probe.caught);
  console.log('\nPLANTED REMOVALS — one object deleted from the rendering, truth JSON untouched:');
  for (const p of m.planted) {
    console.log('  ', (p.removed.kind + ' ' + p.removed.id).padEnd(44),
      'elements removed', String(p.elementsRemoved).padStart(2),
      '| still in truth JSON', String(p.stillInTruthJSON).padEnd(5),
      '| reported ABSENT', String(p.victimReportedAbsent).padEnd(5),
      '| others untouched', String(p.everyOtherObjectStillPresent).padEnd(5),
      '=>', p.caught ? 'CAUGHT' : 'MISSED' + (p.othersDisturbed.length ? ' (also disturbed: ' + p.othersDisturbed.join(',') + ')' : ''));
  }
  console.log('  truth JSON alone cannot satisfy rendered presence:', m.truthJsonIsNotEvidenceOfRendering);
  console.log('\nNAMING — an accessible expression may not name fewer objects than the default:');
  for (const n of m.naming.perExpression) {
    console.log('  ', n.expression.padEnd(28), 'named', String(n.namedCount).padStart(2), n.regression ? 'REGRESSION: lost ' + n.lostRelativeToDefault.join(',') : '');
  }
  console.log('  not named in the SR projection:', m.naming.objectsNotNamedInTheScreenReaderProjection.join(',') || 'none');
  console.log('  not named in the inspection view:', m.naming.objectsNotNamedInTheInspectionView.join(',') || 'none');
  console.log('  drawn but not named in the DEFAULT visual expression (inherited from D2R):', m.naming.drawnButNotNamedInTheDefaultVisualExpression.join(',') || 'none');
  console.log('\ntext findings:');
  for (const r of t) {
    console.log('  ', r.expression.padEnd(26), 'scale', String(r.textScale).padEnd(6), 'topics', String(r.labelsVisibleOnMapOrList).padStart(2),
      'byKind', JSON.stringify(r.objectsRenderedByKind).padEnd(52),
      'trunc', String(r.anyTruncated).padEnd(6), 'clip', String(r.anyArabicLeadingBelowThreshold).padEnd(6), 'minlead', String(r.minMeasuredLeadingRatio).padEnd(6),
      'minpx', String(r.minRenderedFontPx).padEnd(7), 'w', r.restWeight + '/' + r.selectedWeight, 'step', r.weightStepPreserved);
  }
  console.log('\nPARITY:', m.pass ? 'PASS' : 'FAIL');
  if (!m.pass) process.exit(1);
}
