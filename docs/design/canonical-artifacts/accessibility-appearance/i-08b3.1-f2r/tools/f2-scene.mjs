/**
 * I-08B3.1-F2 — ONE SCENE, TWO APPEARANCES, EVERY ACCESSIBILITY EXPRESSION.
 *
 * ================================================================================================
 * THE SHAPE OF THIS FILE IS THE ARGUMENT, AGAIN.
 *
 * I-08B3.1-F1 built one scene whose state vector carried every accessibility expression, so that
 * "an accessibility setting changes representation and nothing else" was a property of a builder
 * rather than a promise in a document. F2 adds ONE FIELD to that vector — `appearance` — and
 * changes nothing else about how the scene is made. Every colour still comes out of the resolved
 * tree by its Product ROLE; not one hex is typed into this file; and the analytical truth is
 * still `project(V)` over the same disclosed view, in both appearances, from the same fixture.
 *
 * That is what makes cross-appearance semantic parity STRUCTURAL rather than maintained. The two
 * appearances are not two scenes that have to be kept in step. They are one scene resolved twice.
 *
 * ================================================================================================
 * WHAT IS INHERITED AND WHAT IS NEW
 *
 * The field's geometry, its topics, its contours, its three worlds, the falloff law, the meaning
 * lifecycle and every event's source list are I-08B3.1-D2R's, imported and called. The render
 * identity, the interaction strip, the inspection view and the accessible projection are
 * I-08B3.1-F1's, carried forward unchanged. What F2 adds is the appearance projection and the
 * meaning-light rendering in the appearance that did not have one.
 *
 * ================================================================================================
 * THE DARK PATH IS DELIBERATELY UNTOUCHED, DOWN TO WHICH FUNCTION COMPUTES THE INK
 *
 * When the appearance is dark and the atmosphere is at its inherited lightnesses, the field is
 * painted by calling I-08B3.1-D2R's OWN ringInk(). Re-deriving the default ink from OkLCh here
 * would produce the same number by the same arithmetic and it would still be F2's number rather
 * than D2R's. Routing the default through the frozen package's own function is what lets the
 * dark-regression gate be a statement about inheritance instead of about two implementations
 * agreeing — and tools/f2-regression.mjs goes further still and re-renders the accepted scene with
 * F1's own builder, because a gate that only compares F2 against F2 is a gate against nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TOPICS, RINGS, WORLDS, contourPath, ringInk, topicById } from '../vendor/f1/vendor/d2r/scene/d2-world.mjs';
import { ATMOSPHERE, VIEW, FRAME } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';
import {
  PATTERN_MEMBERS, PATTERN_LOCUS, PATTERN_LABEL, PATTERN_SUBLABEL,
  INSIGHT_SITE, INSIGHT_TEXT, INSIGHT_KEEL,
} from '../vendor/f1/vendor/d2r/scene/d2-events.mjs';
import { hexToRgb8, rgb8ToHex, oklchToSrgbRaw, to8bit, inSrgbGamut, srgbToOklch } from '../vendor/f1/vendor/lib/color.mjs';
import { syntheticView, project } from '../vendor/f1/tools/f1-fixture.mjs';
import { resolveAll } from './f2-resolve.mjs';
import { profile, radialStops, sourcesAt, sourceGeometry, RECEDE_OPACITY, BEATS } from './f2-meaning.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/* ----------------------------------------------------------------- the state vector ---- */
export const DEFAULT_STATE = Object.freeze({
  appearance: 'dark',         // 'dark' | 'light'   — THE ONE FIELD F2 ADDS
  contrast: 'standard',       // 'standard' | 'increased'
  transparency: 'full',       // 'full' | 'reduced'
  motion: 'full',             // 'full' | 'reduced'
  textScale: 1,
  boldText: false,
  filter: 'none',             // 'none' | 'grayscale' | 'protan' | 'deutan'  — DIAGNOSTIC ONLY
  world: 'personal',
  interaction: 'rest',
  showChrome: true,
  showAnalysis: true,
  event: null,                // null | { kind: 'connection'|'pattern'|'insight', t: ms }
});

export const state = (over = {}) => {
  for (const k of Object.keys(over)) if (!(k in DEFAULT_STATE)) throw new Error(`f2-scene: unknown state key '${k}'`);
  return { ...DEFAULT_STATE, ...over };
};

/* ------------------------------------------------------------------------ helpers ------ */
const over8 = (fg, alpha, bg) => {
  const F = hexToRgb8(fg), B = hexToRgb8(bg);
  return rgb8ToHex(F.map((c, i) => Math.round(c * alpha + B[i] * (1 - alpha))));
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (x) => Number(x).toFixed(2);

export const RENDER_ID_ATTR = 'data-qandeel-object-id';
export const RENDER_KIND_ATTR = 'data-qandeel-kind';
const identity = (o) => `${RENDER_ID_ATTR}="${esc(o.id)}" ${RENDER_KIND_ATTR}="${esc(o.kind)}"`;

const FILTERS = {
  none: '',
  grayscale: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/></filter>',
  protan: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0"/></filter>',
  deutan: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0"/></filter>',
};

/* ---------------------------------------------------------------------- the field ------ */
/**
 * THE AMBIENT FIELD, UNDER ONE APPEARANCE AND ONE ACCESSIBILITY STATE.
 *
 * The geometry, the six hues, the harmonics, the ring counts and the per-world alphas are D2R's
 * and are IDENTICAL in both appearances. What the appearance supplies is the three layer
 * lightnesses — and they cross the ground, because a field that stayed brighter than a near-white
 * World would not be visible in it. §10 of the brief asks that the light World keep its depth,
 * atmosphere, colour and micro-richness: it keeps them by being the same field.
 */
function field(st, r, chromaCeiling) {
  const w = WORLDS[st.world];
  const worldFill = r.colour.WORLD.value;
  const Ls = [r.scalar.ATMO_L_NEAR.value, r.scalar.ATMO_L_MID.value, r.scalar.ATMO_L_FAR.value];
  const alphaSentinel = r.scalar.ATMO_ALPHA_MUL.value; // 0 => full opacity
  const preComposite = st.transparency === 'reduced';

  const out = [];
  for (const t of TOPICS) {
    const hue = ATMOSPHERE.hues[t.hue];
    const ink = ringInkAt(Ls[t.layer], hue, chromaCeiling);
    const limit = Math.min(w.ringLimit, RINGS[t.layer].length);
    const fillAlpha = w.fillAlpha;
    const fillHex = preComposite ? over8(ink, fillAlpha, worldFill) : ink;
    const fillOp = preComposite ? 1 : fillAlpha;
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
 * ringInk, at the appearance's resolved layer lightness and the appearance's chroma ceiling.
 *
 * THE INHERITED DARK PATH CALLS D2R's OWN FUNCTION, deliberately and unchanged from F1.
 */
function ringInkAt(L, hue, chromaCeiling) {
  const layer = [ATMOSPHERE.L.near, ATMOSPHERE.L.mid, ATMOSPHERE.L.far].indexOf(L);
  if (layer !== -1 && chromaCeiling === ATMOSPHERE.chromaCeiling) return ringInk(hue, layer);
  const triple = [L, chromaCeiling, hue];
  if (!inSrgbGamut(triple)) throw new Error(`f2-scene: atmosphere ink oklch(${L} ${chromaCeiling} ${hue}) outside sRGB`);
  return rgb8ToHex(to8bit(oklchToSrgbRaw(triple)));
}

/**
 * THE ATMOSPHERE'S CHROMA CEILING IS DERIVED FROM THE APPEARANCE'S OWN LIGHT, NOT READ FROM A
 * CONSTANT — which is I-08B3.1-D2R's own design and its own stated reason: "Deriving it means the
 * rule survives the Light being re-chosen. If a later package picks a paler Light, the atmosphere
 * gets quieter on its own, and nobody has to remember that the two numbers were related."
 *
 * F2 is that later package. It re-chooses the Light in one appearance, and the ceiling follows by
 * itself: 0.0197 in dark, 0.0195 in light. Check X-02 asserts the derived value matches the one
 * the light token file records, so the documentation cannot drift from the arithmetic.
 */
export function chromaCeilingOf(r) {
  const stops = [r.colour.LIGHT_CORE.value, r.colour.LIGHT_MID.value, r.colour.LIGHT_LOW.value];
  const chromaOf = (h) => srgbToOklch(hexToRgb8(h).map((c) => c / 255))[1];
  return +(0.62 * Math.min(...stops.map(chromaOf))).toFixed(4);
}

/* -------------------------------------------------------------- the settled analysis --- */
function analysis(st, r, T) {
  if (!st.showAnalysis) return '';
  const node = r.colour.NODE.value;
  const rel = r.colour.RELATION.value;
  const out = [];
  const conn = T.objects.find((o) => o.kind === 'connection');
  const pat = T.objects.find((o) => o.kind === 'pattern');
  const ins = T.objects.find((o) => o.kind === 'insight');

  if (conn) {
    const a = topicById(conn.from), b = topicById(conn.to);
    out.push(`<g ${identity(conn)}>`);
    out.push(`<path d="M ${n2(a.x)} ${n2(a.y)} L ${n2(b.x)} ${n2(b.y)}" fill="none" stroke="${rel}" stroke-width="1.4" stroke-opacity="0.8"/>`);
    out.push('</g>');
  }
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
  if (ins) {
    out.push(`<g ${identity(ins)}>`);
    out.push(`<circle cx="${n2(INSIGHT_SITE.x)}" cy="${n2(INSIGHT_SITE.y)}" r="5.5" fill="${node}"/>`);
    out.push(`<path d="M ${n2(INSIGHT_SITE.x - INSIGHT_KEEL.halfWidth)} ${n2(INSIGHT_SITE.y + INSIGHT_KEEL.dy)} L ${n2(INSIGHT_SITE.x + INSIGHT_KEEL.halfWidth)} ${n2(INSIGHT_SITE.y + INSIGHT_KEEL.dy)}" fill="none" stroke="${rel}" stroke-width="1.4"/>`);
    out.push('</g>');
  }
  return out.join('\n');
}

/* ----------------------------------------------------------------- the meaning light --- */
/**
 * QANDEEL LIGHT, PAINTED FROM THE PROFILE THE DERIVATION MEASURED.
 *
 * Each source becomes one radial gradient whose stops are the profile EVALUATED along D2R's
 * falloff — not a gradient authored to look like the profile. The sources, their radii and their
 * levels come out of D2R's own event functions at a time in milliseconds, so what changes between
 * the two appearances is the colour at a given intensity and nothing else: same places, same
 * sizes, same lifecycle, same settle.
 *
 * UNDER REDUCED MOTION the sources are taken at the SETTLE beat instead of the peak, which is
 * I-08B3.1-D2R's proven property — every reduced counterpart reaches the same settled residue —
 * rather than a new behaviour F2 invented.
 */
/**
 * THE GEOMETRY IS I-08B3.1-D2R's, AND THE FIRST VERSION OF THIS FUNCTION INVENTED ITS OWN.
 *
 * It painted each source as a CIRCLE of the falloff's full REACH — r x (1.5 + 2.5 x level),
 * about four times D2R's own source size — and ignored `elong` and `angle` entirely. Five lobes
 * at four times their size covered half the world, IN BOTH APPEARANCES, and the light appearance
 * was about to be blamed for it. D2R paints an ELLIPSE at `s.r`, with axes from `elong`, rotated
 * by `angle`, at `level x WASH_OPACITY`, and dims the field by `fieldRecede` while the event
 * happens. All four are read from D2R's own renderer and its own signal.
 *
 * The lesson is the one this track keeps relearning: a control that the package draws itself is
 * not a control. The dark appearance here is the thing the light appearance is judged against,
 * and it has to be D2R's dark, not F2's idea of it.
 */
function meaning(st, r) {
  const prof = profile(r);
  if (!st.event) return { defs: '', paint: '', technique: prof.technique, sourceCount: 0, recede: 0, t: null };
  const t = st.motion === 'reduced' ? BEATS.SETTLE : st.event.t;
  const { sources, signal } = sourcesAt(st.event.kind, t);
  const defs = [], paint = [];
  sources.forEach((s, i) => {
    if (!s || s.level <= 0.002) return;
    const g = sourceGeometry(s);
    const stops = radialStops(prof, s.level);
    const id = `qd-light-${st.event.kind}-${i}`;
    defs.push(`<radialGradient id="${id}" gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="0.5">`
      + stops.map((p) => `<stop offset="${p.offset}%" stop-color="${p.colour}" stop-opacity="${p.opacity}"/>`).join('')
      + '</radialGradient>');
    paint.push(`<ellipse cx="${n2(g.cx)}" cy="${n2(g.cy)}" rx="${n2(g.rx)}" ry="${n2(g.ry)}" fill="url(#${id})"`
      + ` opacity="${g.opacity.toFixed(4)}" transform="rotate(${g.angle.toFixed(2)} ${n2(g.cx)} ${n2(g.cy)})"`
      + ` data-qd-light-source="${i}" data-qd-light-level="${n2(s.level)}"/>`);
  });
  const recede = RECEDE_OPACITY * (signal.fieldRecede ?? 0);
  return { defs: defs.join('\n'), paint: paint.join('\n'), technique: prof.technique, sourceCount: paint.length, recede, t };
}

/* ------------------------------------------------------------- the analytical objects -- */
export function truth(st, view = null) {
  const P = project(view ?? syntheticView({ world: st.world }));
  return {
    provenance: P.$provenance, scope: P.$scope, unmappedFields: P.$unmappedFields,
    world: P.world, worldName: P.worldName, canonicalOrder: P.canonicalOrder,
    objects: P.objects, counts: P.counts,
  };
}

/* ---------------------------------------------------------------------- the document --- */
export function page(input = {}) {
  const st = state(input);
  const r = resolveAll({ appearance: st.appearance, contrast: st.contrast, transparency: st.transparency });
  const T = truth(st);
  const ceiling = chromaCeilingOf(r);

  const world = r.colour.WORLD.value;
  const surface = r.colour.SURFACE.value;
  const brass = r.colour.BRASS.value;
  const primary = r.colour.PRIMARY.value;
  const tertiary = r.colour.TERTIARY.value;
  const rel = r.colour.RELATION.value;
  const restInk = r.colour.REST_INK.value;
  const selInk = r.colour.SELECTED_INK.value;
  const disInk = r.colour.DISABLED_INK.value;
  const errInk = r.colour.ERROR_INK.value;
  const focusInk = r.colour.FOCUS_INDICATOR.value;
  const focusComp = r.colour.FOCUS_COMPANION.value;
  const boundary = r.flat.get('qandeel.accessibility.contrast.boundary')
    ? resolveHex(r, 'qandeel.accessibility.contrast.boundary') : primary;
  const boundaryW = st.contrast === 'increased' ? r.scalar.BOUNDARY_WIDTH.value.value : 0;
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

  const base = 11;
  const fontPx = (pt) => (pt * scale).toFixed(2);
  const fontPath = join(PKG, 'fonts', 'Estedad[wght].ttf').replace(/\\/g, '/');

  const labels = labelsOnMap
    ? TOPICS.map((t) => `<div class="tlabel" style="inset-inline-start:${(VIEW.W - t.x).toFixed(1)}px;top:${(t.y + t.radius + 6).toFixed(1)}px" ${identity({ id: t.id, kind: 'topic' })}>${esc(t.label)}</div>`).join('\n')
    : '';

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
    return `  <h2 id="insp-${kind}">${esc(heading)}</h2>\n  <ul aria-labelledby="insp-${kind}">\n${items.map(inspectionRow).join('\n')}\n  </ul>`;
  };
  const inspection = labelsOnMap ? '' : `<section id="inspection" aria-label="محتوى هذا العالَم">
${[group('topic', 'مواضيع هذا العالَم'), group('connection', 'العلاقات'), group('pattern', 'الأنماط'), group('insight', 'ما فُهِم')].filter(Boolean).join('\n')}
</section>`;

  const interactionRow = (kind) => {
    const on = st.interaction === kind;
    const ink = kind === 'selected' ? selInk : kind === 'unavailable' ? disInk : kind === 'error' ? errInk : restInk;
    const weight = (kind === 'selected' ? selWeight : restWeight) + boldDelta;
    const cls = ['irow', on ? 'on' : '', kind].filter(Boolean).join(' ');
    const marker = kind === 'selected' ? '<span class="marker" aria-hidden="true"></span>' : '';
    const label = {
      rest: 'موضوع', pressed: 'موضوع', focus: 'موضوع', selected: 'العالَم الحالي',
      unavailable: 'أرشيف الأسبوع', error: 'تعذّرت مزامنة العالَم',
    }[kind];
    const extra = kind === 'unavailable' ? ' aria-disabled="true" aria-describedby="why-unavailable"'
      : kind === 'selected' ? ' aria-current="true"' : '';
    const glyph = kind === 'error' ? '<span class="eglyph" aria-hidden="true">!</span>' : '';
    return `<div class="${cls}"${extra} role="button" tabindex="0" style="color:${ink};font-weight:${weight}">${marker}${glyph}<span class="ilabel">${esc(label)}</span></div>`;
  };

  const strip = st.showChrome ? `<section id="strip" aria-label="حالات التفاعل">
${['rest', 'pressed', 'focus', 'selected', 'unavailable', 'error'].map(interactionRow).join('\n')}
<p id="why-unavailable" class="reason">هذا الأرشيف يفتح بعد انتهاء الأسبوع.</p>
</section>` : '';

  const filterDef = FILTERS[st.filter];
  const filterAttr = st.filter === 'none' ? '' : ' style="filter:url(#qd-f)"';
  const M = meaning(st, r);

  return `<!doctype html>
<html dir="rtl" lang="ar" data-qd-ready="0"
      data-qd-appearance="${st.appearance}"
      data-qd-contrast="${st.contrast}" data-qd-transparency="${st.transparency}"
      data-qd-motion="${st.motion}" data-qd-textscale="${scale}" data-qd-bold="${st.boldText ? 1 : 0}"
      data-qd-filter="${st.filter}" data-qd-world="${st.world}" data-qd-interaction="${st.interaction}"
      data-qd-event="${st.event ? esc(st.event.kind + '@' + M.t) : 'none'}"
      data-qd-technique="${esc(M.technique ?? '')}" data-qd-light-sources="${M.sourceCount ?? 0}"
      data-qd-chroma-ceiling="${ceiling}"
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
  /* NEVER on anything that can contain an Arabic glyph, in either appearance. */
  letter-spacing:normal;
  font-style:normal;
  line-height:${leading};
}
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
    ${M.defs ? `<defs>\n${M.defs}\n</defs>` : ''}
    <rect x="0" y="0" width="${VIEW.W}" height="${VIEW.H}" fill="${world}"/>
    <g id="atmosphere"${M.recede ? ` opacity="${(1 - M.recede).toFixed(4)}"` : ''}>
${field(st, r, ceiling)}
    </g>
${M.paint ? `    <g id="meaning">\n${M.paint}\n    </g>` : ''}
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

function resolveHex(r, name) {
  const ALIAS = /^\{([^}]+)\}$/;
  let cur = name;
  for (let i = 0; i < 12; i++) {
    const e = r.flat.get(cur);
    if (!e) throw new Error('f2-scene: unresolved ' + cur);
    const m = typeof e.value === 'string' ? ALIAS.exec(e.value.trim()) : null;
    if (!m) return String(e.value).toLowerCase();
    cur = m[1].trim();
  }
  throw new Error('f2-scene: alias too deep at ' + name);
}
