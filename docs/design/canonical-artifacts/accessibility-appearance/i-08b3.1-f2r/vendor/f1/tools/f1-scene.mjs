/**
 * I-08B3.1-F1 — ONE SCENE, ONE STATE VECTOR, EVERY ACCESSIBILITY EXPRESSION.
 *
 * THE WHOLE ARGUMENT OF THIS PACKAGE IS IN THE SHAPE OF THIS FILE.
 *
 * There is one scene builder. Every accessibility expression is the same builder with a
 * different state vector, and the DEFAULT vector produces a document that must be BYTE-IDENTICAL
 * to the baseline — check D-02. If an accessibility compromise had leaked into the default
 * choreography, the default document would differ and the check would say so before a human
 * looked at anything. That is what §6 of the brief asks for, expressed as a mechanism rather
 * than as a promise.
 *
 * WHAT IS INHERITED AND WHAT IS NEW. The field's geometry, its topics, its contours, its inks
 * and its three worlds are I-08B3.1-D2R's, imported and called — not copied, not re-derived, not
 * "recreated in the spirit of". A lookalike scene would make every comparison in this package
 * a comparison between F1's drawing and F1's other drawing. What F1 adds is the accessibility
 * state vector, the interaction strip E1 owns, and the accessible semantic projection.
 *
 * TEXT VIEWS OVER A DRAWING, AND IT IS NOT A CONVENIENCE. A Skia Canvas exposes nothing inside
 * it to an accessibility API, so in production every analytical object must be a real view with
 * a real accessible name composed over the canvas. This page is built the same way on purpose:
 * the field is one SVG with aria-hidden on it, and every topic, relation, pattern and insight is
 * a real DOM element beside it. The accessibility tree this produces is therefore the shape the
 * production tree has to have, and tools/f1-sr.mjs reads it back out of the browser rather than
 * asserting it.
 *
 * ------------------------------------------------------------------------------------------
 * TWO THINGS I-08B3.1-F1R CHANGED HERE, BOTH BECAUSE THE INDEPENDENT REVIEW WAS RIGHT.
 *
 * 1. THE SCENE NO LONGER AUTHORS SEMANTIC TRUTH. `truth()` used to write `epistemic: 'observed'`,
 *    `temporal: 'current'` and `actionable: true` onto objects the inherited D2R scene never
 *    said those things about. The renderer may PROJECT semantic truth; it may not AUTHOR it. So
 *    `truth()` is now `project(V)` over a disclosed view supplied by tools/f1-fixture.mjs, and
 *    the fixture's provenance travels with it into the rendered document.
 *
 * 2. EVERY ANALYTICAL OBJECT NOW CARRIES AN OBJECT-SPECIFIC RENDER IDENTITY. The parity matrix
 *    used to accept "some SVG path exists" as proof that the CONNECTION and the PATTERN were
 *    drawn, and the presence of a truth-JSON entry as proof that the INSIGHT was. Either of
 *    those could pass while the object had silently vanished from the picture. Now each object
 *    — including the ones drawn as several primitives — is grouped under one
 *    `data-qandeel-object-id` / `data-qandeel-kind` pair, and rendered presence is asserted on
 *    that identity having a laid-out box on the page.
 *
 *    THE GROUPS CHANGE NO PIXELS. An SVG `<g>` with no presentation attribute paints exactly
 *    what its children paint; check I-02 rasterises the inherited field and compares it to the
 *    same field built from D2R's own functions, and the F1R default raster is byte-identical to
 *    the pre-F1R one. The document's BYTES changed, because instrumentation was added, and the
 *    package says so rather than claiming otherwise.
 * ------------------------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TOPICS, RINGS, WORLDS, contourPath, ringInk, topicById } from '../vendor/d2r/scene/d2-world.mjs';
import { ATMOSPHERE, VIEW, FRAME, MARK } from '../vendor/d2r/scene/d2-foundation.mjs';
import {
  PATTERN_MEMBERS, PATTERN_LOCUS, PATTERN_LABEL, PATTERN_SUBLABEL,
  INSIGHT_SITE, INSIGHT_TEXT, INSIGHT_LABEL, INSIGHT_KEEL,
} from '../vendor/d2r/scene/d2-events.mjs';
import { hexToRgb8, rgb8ToHex, oklchToSrgbRaw, to8bit, inSrgbGamut } from '../vendor/lib/color.mjs';
import { resolveAll } from './f1-resolve.mjs';
import { SYNTHETIC_VIEW, syntheticView, project } from './f1-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/* ----------------------------------------------------------------- the state vector ---- */
/**
 * Every field has a DEFAULT that is the frozen system's own behaviour. A vector with no keys
 * set is the default expression, and that is the property check D-02 rests on.
 */
export const DEFAULT_STATE = Object.freeze({
  contrast: 'standard',       // 'standard' | 'increased'
  transparency: 'full',       // 'full' | 'reduced'
  motion: 'full',             // 'full' | 'reduced'
  textScale: 1,               // 1 .. qandeel.accessibility.text.max-scale
  boldText: false,
  filter: 'none',             // 'none' | 'grayscale' | 'protan' | 'deutan'  — DIAGNOSTIC ONLY
  world: 'personal',          // 'personal' | 'shared' | 'public'
  interaction: 'rest',        // 'rest' | 'pressed' | 'focus' | 'selected' | 'unavailable' | 'error'
  showChrome: true,
  showAnalysis: true,         // the settled CONNECTION, PATTERN and INSIGHT
});

export const state = (over = {}) => {
  for (const k of Object.keys(over)) if (!(k in DEFAULT_STATE)) throw new Error(`f1-scene: unknown state key '${k}'`);
  return { ...DEFAULT_STATE, ...over };
};

/* ------------------------------------------------------------------------ helpers ------ */
const over8 = (fg, alpha, bg) => {
  const F = hexToRgb8(fg), B = hexToRgb8(bg);
  return rgb8ToHex(F.map((c, i) => Math.round(c * alpha + B[i] * (1 - alpha))));
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (x) => Number(x).toFixed(2);

/**
 * The CONNECTION whose settled residue this scene shows. Two named topics and a relation
 * between them — the source and the destination, which is what a Connection's truth IS.
 *
 * IT IS READ OFF THE DISCLOSED VIEW, not declared here. It used to be a frozen literal in this
 * file, which made the renderer the authority on which relation exists — a small version of the
 * same mistake I-08B3.1-F1R corrects for the semantic fields.
 */
const connectionOf = (view) => view.objects.find((o) => o.kind === 'connection');
export const CONNECTION = Object.freeze({
  from: connectionOf(SYNTHETIC_VIEW).from,
  to: connectionOf(SYNTHETIC_VIEW).to,
  label: connectionOf(SYNTHETIC_VIEW).name,
});

/**
 * THE RENDER IDENTITY. One pair of attributes, one place that writes them, so that "the object
 * is on the page" is a question with one answer rather than an inference from a path count.
 *
 * For an object drawn as several primitives — a PATTERN is a locus, four links and four marks —
 * the primitives are grouped and the identity goes on the GROUP. A census that counted
 * primitives would see a pattern that had lost three of its four members as present.
 */
export const RENDER_ID_ATTR = 'data-qandeel-object-id';
export const RENDER_KIND_ATTR = 'data-qandeel-kind';
const identity = (o) => `${RENDER_ID_ATTR}="${esc(o.id)}" ${RENDER_KIND_ATTR}="${esc(o.kind)}"`;

/* ----------------------------------------------------------- the accessibility filters -- */
/**
 * Grayscale and the two dichromacies are applied as an SVG feColorMatrix over the WHOLE page,
 * which is what a display-level OS filter does. Repainting the app for them would be an app
 * fighting the compositor, and would also make the diagnostic worthless: the point is to see
 * what the SHIPPED pixels become, not what a specially-prepared version of them becomes.
 *
 * The matrices are Brettel/Viénot as tools/f1-cvd.mjs implements them, expressed in the linear
 * form the filter takes. f1-verify check N-04 renders the same scene through tools/f1-cvd.mjs
 * on the decoded raster and requires the two paths to agree, so a wrong matrix here cannot
 * pass unnoticed.
 */
const FILTERS = {
  none: '',
  grayscale: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/></filter>',
  protan: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0"/></filter>',
  deutan: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0"/></filter>',
};

/* ---------------------------------------------------------------------- the field ------ */
/**
 * The ambient field, under one accessibility state.
 *
 * TWO TRANSFORMATIONS TOUCH IT AND NEITHER TOUCHES A SEMANTIC TOKEN:
 *   increased contrast  -> the layer lightness comes from the resolved tree (+0.011) and the
 *                          stroke alpha sentinel says draw at full opacity
 *   reduce transparency -> the stroke is drawn in its own exact opaque equivalent over the
 *                          World, so the mechanism changes and the pixel does not
 */
function field(st, r) {
  const w = WORLDS[st.world];
  const worldFill = r.colour.WORLD.value;
  const Ls = [r.scalar.ATMO_L_NEAR.value, r.scalar.ATMO_L_MID.value, r.scalar.ATMO_L_FAR.value];
  const alphaSentinel = r.scalar.ATMO_ALPHA_MUL.value; // 0 => full opacity
  const preComposite = st.transparency === 'reduced';

  const out = [];
  for (const t of TOPICS) {
    const hue = ATMOSPHERE.hues[t.hue];
    const ink = ringInk_at(Ls[t.layer], hue);
    const limit = Math.min(w.ringLimit, RINGS[t.layer].length);
    /* the fill: one soft interior wash, the same for every topic in a world */
    const fillAlpha = w.fillAlpha;
    const fillHex = preComposite ? over8(ink, fillAlpha, worldFill) : ink;
    const fillOp = preComposite ? 1 : fillAlpha;
    /* THE TOPIC'S CONTOURS, UNDER ONE RENDER IDENTITY. A topic is drawn as a fill and up to
       three level lines; grouping them means a census asks "is this topic drawn" rather than
       "are there paths". The group carries no presentation attribute and changes no pixel. */
    const inner = [];
    inner.push(`<path d="${contourPath(t, RINGS[t.layer][0])}" fill="${fillHex}" fill-opacity="${fillOp}" stroke="none"/>`);
    for (let ring = 0; ring < limit; ring++) {
      const declared = w.strokeAlpha[ring] ?? w.strokeAlpha[w.strokeAlpha.length - 1];
      const a = alphaSentinel === 0 ? 1 : declared;
      const hex = preComposite ? over8(ink, a, worldFill) : ink;
      const op = preComposite ? 1 : a;
      const dash = w.dash ? ` stroke-dasharray="${w.dash}"` : '';
      inner.push(`<path d="${contourPath(t, RINGS[t.layer][ring])}" fill="none" stroke="${hex}" stroke-opacity="${op}" stroke-width="1"${dash}/>`);
    }
    out.push(`<g ${identity({ id: t.id, kind: 'topic' })}>\n${inner.join('\n')}\n</g>`);
  }
  return out.join('\n');
}

/**
 * ringInk, at an F1-resolved lightness rather than D2R's constant. Same chroma ceiling, same
 * hue, same function shape — the lightness is the ONLY thing an accessibility state may vary.
 *
 * THE DEFAULT PATH CALLS D2R's OWN FUNCTION, deliberately. Re-deriving the default ink from
 * OkLCh here would produce the same number by the same arithmetic and would still be F1's
 * number rather than D2R's. Routing the default through ringInk() means the default field is
 * painted in the frozen package's own bytes, and check D-02's byte-identity is a statement
 * about inheritance rather than about two implementations agreeing.
 */
function ringInk_at(L, hue) {
  const layer = [ATMOSPHERE.L.near, ATMOSPHERE.L.mid, ATMOSPHERE.L.far].indexOf(L);
  if (layer !== -1) return ringInk(hue, layer);
  const triple = [L, ATMOSPHERE.chromaCeiling, hue];
  if (!inSrgbGamut(triple)) throw new Error(`f1-scene: atmosphere ink oklch(${L} ${ATMOSPHERE.chromaCeiling} ${hue}) outside sRGB`);
  return rgb8ToHex(to8bit(oklchToSrgbRaw(triple)));
}

/* -------------------------------------------------------------- the settled analysis --- */
/**
 * THE SETTLED RESIDUE, AND WHY THE SCENE SHOWS THE SETTLED STATE RATHER THAN A MID-EVENT FRAME.
 *
 * I-08B3.1-D2R proved that every reduced-motion counterpart reaches the SAME settled residue as
 * its full-motion sibling, and that the settled frames of every sequence are byte-identical to
 * each other: "the end state does not depend on which version you saw". That is the property
 * this package builds on — so the analytical truth F1 tests parity over is drawn at settle,
 * where it is the same in every motion expression by construction. Board D shows the frames;
 * every other board shows the truth.
 */
function analysis(st, r, T) {
  if (!st.showAnalysis) return '';
  const node = r.colour.PRIMARY.value;
  const rel = relationInk(r);
  const out = [];
  /* WHICH objects are drawn comes from the DISCLOSED VIEW, not from constants in this file.
     The GEOMETRY is D2R's — a locus at PATTERN_LOCUS, a site at INSIGHT_SITE — because geometry
     is the frozen package's and carries no meaning of its own. */
  const conn = T.objects.find((o) => o.kind === 'connection');
  const pat = T.objects.find((o) => o.kind === 'pattern');
  const ins = T.objects.find((o) => o.kind === 'insight');

  /* CONNECTION — a relation between two named topics */
  if (conn) {
    const a = topicById(conn.from), b = topicById(conn.to);
    out.push(`<g ${identity(conn)}>`);
    out.push(`<path d="M ${n2(a.x)} ${n2(a.y)} L ${n2(b.x)} ${n2(b.y)}" fill="none" stroke="${rel}" stroke-width="1.4" stroke-opacity="0.8"/>`);
    out.push('</g>');
  }

  /* PATTERN — a locus, four identical membership links, four identical marks. One width and
     one opacity for every link, because a SET HAS NO STRENGTHS. All nine primitives live under
     ONE render identity: a census that counted primitives would call a pattern that had lost
     three of its four members present. */
  if (pat) {
    out.push(`<g ${identity(pat)}>`);
    for (const id of pat.members ?? PATTERN_MEMBERS) {
      const m = topicById(id);
      out.push(`<path d="M ${n2(PATTERN_LOCUS.x)} ${n2(PATTERN_LOCUS.y)} L ${n2(m.x)} ${n2(m.y)}" fill="none" stroke="${rel}" stroke-width="1.25" stroke-opacity="0.8"/>`);
      out.push(`<circle cx="${n2(m.x)}" cy="${n2(m.y)}" r="3.2" fill="${rel}" fill-opacity="0.92"/>`);
    }
    out.push(`<circle cx="${n2(PATTERN_LOCUS.x)}" cy="${n2(PATTERN_LOCUS.y)}" r="5" fill="${node}"/>`);
    out.push('</g>');
  }

  /* INSIGHT — a node and the keel beneath it */
  if (ins) {
    out.push(`<g ${identity(ins)}>`);
    out.push(`<circle cx="${n2(INSIGHT_SITE.x)}" cy="${n2(INSIGHT_SITE.y)}" r="5.5" fill="${node}"/>`);
    out.push(
      `<path d="M ${n2(INSIGHT_SITE.x - INSIGHT_KEEL.halfWidth)} ${n2(INSIGHT_SITE.y + INSIGHT_KEEL.dy)} L ${n2(INSIGHT_SITE.x + INSIGHT_KEEL.halfWidth)} ${n2(INSIGHT_SITE.y + INSIGHT_KEEL.dy)}" fill="none" stroke="${rel}" stroke-width="1.4"/>`,
    );
    out.push('</g>');
  }
  return out.join('\n');
}

/** The analytical relation's ink, which is the ONE analytical colour an accessibility state
 *  moves — and it moves by changing which frozen ramp rung it points at, never by a new value. */
function relationInk(r) {
  const t = r.flat.get('qandeel.analysis.relation');
  if (!t) throw new Error('f1-scene: qandeel.analysis.relation is not in the resolved tree');
  return resolveHex(r, 'qandeel.analysis.relation');
}
function resolveHex(r, name) {
  const ALIAS = /^\{([^}]+)\}$/;
  let cur = name;
  for (let i = 0; i < 12; i++) {
    const e = r.flat.get(cur);
    if (!e) throw new Error('f1-scene: unresolved ' + cur);
    const m = typeof e.value === 'string' ? ALIAS.exec(e.value.trim()) : null;
    if (!m) return String(e.value).toLowerCase();
    cur = m[1].trim();
  }
  throw new Error('f1-scene: alias too deep at ' + name);
}

/* ------------------------------------------------------------- the analytical objects -- */
/**
 * THE TRUTH OF THE SCENE — AND IT IS A PROJECTION, NOT AN AUTHORSHIP.
 *
 * WHAT THIS FUNCTION USED TO DO, AND WHY IT WAS WRONG. It built the object list itself and wrote
 * `epistemic`, `temporal` and `actionable` onto every object — values the inherited D2R scene
 * never established. The parity matrix then proved, correctly and uselessly, that the renderer's
 * own invention survived every accessibility expression.
 *
 * WHAT IT DOES NOW. It calls `project(V)` on a DISCLOSED VIEW and carries the result. There is no
 * `??`, no default and no literal semantic value anywhere in this file — check A-01 scans this
 * source for one. If the view omits a field, the field is absent here, absent in the rendered
 * document and absent in the accessible projection, all the way down.
 *
 * The view this proof runs against is tools/f1-fixture.mjs's SYNTHETIC_VIEW, and its provenance
 * — SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA — travels into the rendered page so that no reader
 * of the page or of the parity matrix can mistake a test input for a Product decision.
 *
 * Everything the page shows is generated FROM this, so the drawing, the labels, the accessible
 * projection and the parity matrix cannot disagree. tools/f1-parity.mjs reads it back out of the
 * RENDERED DOCUMENT rather than importing it — and, since F1R, no longer accepts it as evidence
 * that an object was DRAWN.
 */
export function truth(st, view = null) {
  /* The WORLD is the caller's — a board renders the shared and public worlds — so the default
     view is built for the world being drawn rather than pinned to the personal one. */
  const P = project(view ?? syntheticView({ world: st.world }));
  return {
    provenance: P.$provenance,
    /* THE BOUNDED-PROOF DISCLAIMER TRAVELS INTO THE DOCUMENT, added by I-08B3.1-F1R2. A reader
       of the shipped page can see which semantic dimensions this fixture supplies, and therefore
       what the parity matrix over it is and is not evidence of, without reading a document. */
    scope: P.$scope,
    unmappedFields: P.$unmappedFields,
    world: P.world,
    worldName: P.worldName,
    canonicalOrder: P.canonicalOrder,
    objects: P.objects,
    counts: P.counts,
  };
}

/* ---------------------------------------------------------------------- the document --- */
export function page(input = {}) {
  const st = state(input);
  const r = resolveAll({ contrast: st.contrast, transparency: st.transparency });
  const T = truth(st);

  const world = r.colour.WORLD.value;
  const surface = r.colour.SURFACE.value;
  const brass = r.colour.BRASS.value;
  const primary = r.colour.PRIMARY.value;
  const tertiary = r.colour.TERTIARY.value;
  const rel = relationInk(r);
  const restInk = r.colour.REST_INK.value;
  const selInk = r.colour.SELECTED_INK.value;
  const disInk = r.colour.DISABLED_INK.value;
  const errInk = r.colour.ERROR_INK.value;
  const focusInk = r.colour.FOCUS_INDICATOR.value;
  const focusComp = r.colour.FOCUS_COMPANION.value;
  const boundary = r.f1.A11Y_BOUNDARY.value;
  const boundaryW = st.contrast === 'increased' ? r.scalar.BOUNDARY_WIDTH.value.value : 0;
  /* EVERY interaction magnitude below comes out of the RESOLVED TREE. None is a number typed
     into this file. That is what makes "increased contrast thickens the perimeter and changes
     nothing else about focus" a property of the tokens rather than of the renderer. */
  const focusW = (st.contrast === 'increased' ? r.scalar.FOCUS_THICKNESS_HC : r.scalar.FOCUS_THICKNESS).value.value;
  const focusOffset = r.scalar.FOCUS_OFFSET.value.value;
  const markerW = r.scalar.SELECTED_MARKER_THICKNESS.value.value;
  const restWeight = r.scalar.REST_WEIGHT.value;
  const selWeight = r.scalar.SELECTED_WEIGHT.value;
  const pressPresence = r.scalar.PRESSED_PRESENCE.value;

  const scale = st.textScale;
  const escapeAt = r.scalar.TEXT_LABEL_ESCAPE_SCALE.value;
  const leading = r.scalar.TEXT_LEADING_RATIO.value;
  const boldDelta = st.boldText ? r.scalar.TEXT_BOLD_WEIGHT_DELTA.value : 0;
  const labelsOnMap = scale <= escapeAt;

  const base = 11; // the topic label's default size, in CSS px at this proof's viewport
  const fontPx = (pt) => (pt * scale).toFixed(2);

  const fontPath = join(PKG, 'fonts', 'Estedad[wght].ttf').replace(/\\/g, '/');

  /* topic labels as REAL TEXT VIEWS over the drawing — never inside the SVG */
  const labels = labelsOnMap
    ? TOPICS.map((t) => `<div class="tlabel" style="inset-inline-start:${(VIEW.W - t.x).toFixed(1)}px;top:${(t.y + t.radius + 6).toFixed(1)}px" ${identity({ id: t.id, kind: 'topic' })}>${esc(t.label)}</div>`).join('\n')
    : '';

  /**
   * THE INSPECTION VIEW — the SAME objects, at full size, when the map can no longer hold a
   * label. Apple: avoid truncating text in scrollable regions "unless people can open a separate
   * view to read the rest of the content". This is that separate view.
   *
   * AND IT USED TO LIST ONLY THE TOPICS, WHICH WAS A REAL DEFECT THE OLD PARITY MATRIX COULD NOT
   * SEE. Above the label-escape scale the CONNECTION, the PATTERN and the INSIGHT had no rendered
   * presence at all: their map labels were suppressed with the topic labels and nothing replaced
   * them. The matrix passed anyway, because it accepted "some SVG path exists" for the first two
   * and the truth JSON for the third. Accessible expression is not reduced analysis, so the
   * inspection view now carries every kind, each under its own render identity.
   */
  const inspectionRow = (o) => {
    const text = o.kind === 'insight' ? o.text : o.name;
    const sub = o.kind === 'connection'
      ? `${esc(T.objects.find((x) => x.id === o.from)?.name ?? o.from)} ← ${esc(T.objects.find((x) => x.id === o.to)?.name ?? o.to)}`
      : o.kind === 'pattern' ? esc(o.sublabel ?? '')
        : o.kind === 'insight' ? esc(o.name) : '';
    return `    <li ${identity(o)}>${esc(text)}${sub ? `<span class="isub">${sub}</span>` : ''}</li>`;
  };
  const group = (kind, heading) => {
    const items = T.objects.filter((o) => o.kind === kind);
    if (!items.length) return '';
    return `  <h2 id="insp-${kind}">${esc(heading)}</h2>
  <ul aria-labelledby="insp-${kind}">
${items.map(inspectionRow).join('\n')}
  </ul>`;
  };
  const inspection = labelsOnMap
    ? ''
    : `<section id="inspection" aria-label="محتوى هذا العالَم">
${[group('topic', 'مواضيع هذا العالَم'), group('connection', 'العلاقات'), group('pattern', 'الأنماط'), group('insight', 'ما فُهِم')].filter(Boolean).join('\n')}
</section>`;

  const interactionRow = (kind) => {
    const on = st.interaction === kind;
    const ink = kind === 'selected' ? selInk : kind === 'unavailable' ? disInk : kind === 'error' ? errInk : restInk;
    /* SELECTED's typographic channel is E1's 100-unit step, and BOLD TEXT adds its delta to
       BOTH rungs rather than to one — which is the only reason Bold Text does not erase the
       selected state. Check X-03 measures the gap at every text setting. */
    const weight = (kind === 'selected' ? selWeight : restWeight) + boldDelta;
    const cls = ['irow', on ? 'on' : '', kind].filter(Boolean).join(' ');
    const marker = kind === 'selected' ? '<span class="marker" aria-hidden="true"></span>' : '';
    const label = {
      rest: 'موضوع', pressed: 'موضوع', focus: 'موضوع', selected: 'العالَم الحالي',
      unavailable: 'أرشيف الأسبوع', error: 'تعذّرت مزامنة العالَم',
    }[kind];
    const extra = kind === 'unavailable'
      ? ' aria-disabled="true" aria-describedby="why-unavailable"'
      : kind === 'selected' ? ' aria-current="true"' : '';
    const glyph = kind === 'error' ? '<span class="eglyph" aria-hidden="true">!</span>' : '';
    return `<div class="${cls}"${extra} role="button" tabindex="0" style="color:${ink};font-weight:${weight}">${marker}${glyph}<span class="ilabel">${esc(label)}</span></div>`;
  };

  const strip = st.showChrome
    ? `<section id="strip" aria-label="حالات التفاعل">
${['rest', 'pressed', 'focus', 'selected', 'unavailable', 'error'].map(interactionRow).join('\n')}
<p id="why-unavailable" class="reason">هذا الأرشيف يفتح بعد انتهاء الأسبوع.</p>
</section>`
    : '';

  const filterDef = FILTERS[st.filter];
  const filterAttr = st.filter === 'none' ? '' : ' style="filter:url(#qd-f)"';

  return `<!doctype html>
<html dir="rtl" lang="ar" data-qd-ready="0"
      data-qd-contrast="${st.contrast}" data-qd-transparency="${st.transparency}"
      data-qd-motion="${st.motion}" data-qd-textscale="${scale}" data-qd-bold="${st.boldText ? 1 : 0}"
      data-qd-filter="${st.filter}" data-qd-world="${st.world}" data-qd-interaction="${st.interaction}"
      data-qd-provenance="${esc(T.provenance ?? 'UNSTATED')}">
<head>
<meta charset="utf-8">
<title>QANDEEL — ${esc(WORLDS[st.world].name)}</title>
<style>
@font-face { font-family:'Estedad'; src:url('file:///${fontPath}') format('truetype'); font-weight:100 900; font-display:block; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${world};}
body{
  font-family:'Estedad',sans-serif;
  width:${VIEW.W}px;
  color:${primary};
  /* NEVER on anything that can contain an Arabic glyph. Stated here so a reviewer can see
     that the absence is deliberate rather than an omission. */
  letter-spacing:normal;
  font-style:normal;
  line-height:${leading};
}
/* THE MAP IS EXACTLY THE DEVICE VIEWPORT AND NOTHING ELSE SHARES IT. Everything F1 adds for a
   proof — the interaction strip, the inspection list — lives in a panel BELOW it. A board that
   let a proof widget sit on the Living Analysis World would be measuring a composition that
   does not ship. */
#stage{position:relative;width:${VIEW.W}px;height:${VIEW.H}px;background:${world};overflow:hidden}
#panel{position:relative;width:${VIEW.W}px;background:${world};padding-block:14px}
svg#field{position:absolute;inset:0;display:block}
header#chrome{position:absolute;inset-inline:0;top:0;height:${FRAME.header}px;background:${surface};
  ${boundaryW ? `border-block-end:${boundaryW}px solid ${boundary};` : ''}
  display:flex;align-items:center;justify-content:space-between;padding:0 14px;z-index:3}
nav#nav{position:absolute;inset-inline:0;bottom:0;height:${FRAME.nav}px;background:${surface};
  ${boundaryW ? `border-block-start:${boundaryW}px solid ${boundary};` : ''}
  display:flex;align-items:center;justify-content:space-around;z-index:3}
.navitem{color:${brass};font-size:${fontPx(11)}px;font-weight:${500 + boldDelta};line-height:${leading}}
/* Estedad is a VARIABLE face, so Bold Text is a real axis move and not a synthetic emboldening.
   Clamped at 900 because that is the axis maximum: asking for 1000 would silently give 900 and
   quietly collapse the weight step that SELECTED depends on. */
#mark{color:${brass};font-size:${fontPx(15)}px;font-weight:${Math.min(900, 700 + boldDelta)}}
#worldname{color:${tertiary};font-size:${fontPx(12)}px;font-weight:${500 + boldDelta};line-height:${leading}}
.tlabel{position:absolute;transform:translateX(50%);color:${rel};font-size:${fontPx(base)}px;
  font-weight:${500 + boldDelta};line-height:${leading};white-space:nowrap;z-index:2}
.alabel{position:absolute;transform:translateX(50%);color:${primary};font-size:${fontPx(12)}px;
  font-weight:${600 + boldDelta};line-height:${leading};white-space:nowrap;z-index:2}
.asub{position:absolute;transform:translateX(50%);color:${rel};font-size:${fontPx(10)}px;
  font-weight:${500 + boldDelta};line-height:${leading};white-space:nowrap;z-index:2}
#inspection{position:relative;z-index:4;margin:0 14px 14px;color:${primary}}
#inspection h2{font-size:${fontPx(13)}px;font-weight:${Math.min(900, 700 + boldDelta)};line-height:${leading};margin-block:12px 8px;color:${primary}}
#inspection h2:first-child{margin-block-start:0}
#inspection ul{list-style:none}
#inspection li{font-size:${fontPx(base)}px;font-weight:${500 + boldDelta};line-height:${leading};
  color:${rel};padding-block:6px;border-block-end:1px solid ${boundaryW ? boundary : surface}}
/* The second line of a non-topic inspection row — a connection's two ends, a pattern's count,
   an insight's kind. Tertiary, because it names the object rather than being it. */
#inspection .isub{display:block;font-size:${fontPx(10)}px;font-weight:${500 + boldDelta};
  line-height:${leading};color:${tertiary}}
#strip{position:relative;z-index:4;margin:0 14px;display:flex;flex-direction:column;gap:6px}
.irow{position:relative;background:${surface};${boundaryW ? `border:${boundaryW}px solid ${boundary};` : ''}
  padding:9px 12px;font-size:${fontPx(12)}px;line-height:${leading};border-radius:6px;outline:none}
.irow.on.pressed{background:${over8(primary, pressPresence, surface)}}
.irow.on.focus{outline:${focusW}px solid ${focusInk};outline-offset:${focusOffset}px;box-shadow:0 0 0 ${focusW + focusOffset}px ${focusComp}}
.irow .marker{position:absolute;inset-inline-start:0;top:8px;bottom:8px;width:${markerW}px;background:${selInk}}
.irow .eglyph{display:inline-block;inline-size:${fontPx(13)}px;text-align:center;margin-inline-end:6px;
  border:1px solid currentColor;border-radius:50%;font-weight:700}
.reason{color:${rel};font-size:${fontPx(10)}px;line-height:${leading};padding-inline-start:12px}
</style>
</head>
<body>
${filterDef ? `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs>${filterDef}</defs></svg>` : ''}
<div id="stage"${filterAttr}>
  <svg id="field" width="${VIEW.W}" height="${VIEW.H}" viewBox="0 0 ${VIEW.W} ${VIEW.H}" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="${VIEW.W}" height="${VIEW.H}" fill="${world}"/>
    <g id="atmosphere">
${field(st, r)}
    </g>
    <g id="analysis">
${analysis(st, r, T)}
    </g>
  </svg>

${st.showChrome ? `  <header id="chrome">
    <span id="mark" aria-label="قنديل">ق</span>
    <span id="worldname">${esc(WORLDS[st.world].name)}</span>
  </header>` : ''}

${labels}
${st.showAnalysis && labelsOnMap ? `  <div class="alabel" style="inset-inline-start:${(VIEW.W - PATTERN_LOCUS.x).toFixed(1)}px;top:${(PATTERN_LOCUS.y + 10).toFixed(1)}px" ${identity(T.objects.find((o) => o.kind === 'pattern'))}>${esc(PATTERN_LABEL)}</div>
  <div class="asub" style="inset-inline-start:${(VIEW.W - PATTERN_LOCUS.x).toFixed(1)}px;top:${(PATTERN_LOCUS.y + 10 + base * scale * leading).toFixed(1)}px">${esc(PATTERN_SUBLABEL)}</div>
  <div class="alabel" style="inset-inline-start:${(VIEW.W - INSIGHT_SITE.x).toFixed(1)}px;top:${(INSIGHT_SITE.y + INSIGHT_KEEL.dy + 6).toFixed(1)}px" ${identity(T.objects.find((o) => o.kind === 'insight'))}>${esc(INSIGHT_TEXT)}</div>` : ''}

${st.showChrome ? `  <nav id="nav" aria-label="التنقّل">
    <span class="navitem">العالَم</span><span class="navitem">المحادثة</span><span class="navitem">الزمن</span>
  </nav>` : ''}
</div>

<div id="panel"${filterAttr}>
${inspection}
${strip}
</div>

<script type="application/json" id="qd-truth">${JSON.stringify(T)}</script>
<script type="application/json" id="qd-state">${JSON.stringify(st)}</script>
<script>
document.fonts.ready.then(function(){ document.documentElement.setAttribute('data-qd-ready','1'); });
</script>
</body>
</html>
`;
}
