/**
 * I-08B3.1-F2 — THE TWELVE PRODUCT PROOF BOARDS.
 *
 * ================================================================================================
 * "THE PRODUCT OWNER MUST SEE THE PRODUCT, NOT TOKEN CHIPS." — §23
 *
 * So every tile on every board below is a REAL RENDERED QANDEEL SURFACE, captured from the same
 * scene builders the verifier measures, at the device viewport, with Arabic content and Estedad.
 * There is not one swatch on any board except Board L, whose entire subject is the role map and
 * which shows the value beside the surface it came from rather than instead of it.
 *
 * THE DARK TILES ARE CONTROLS AND THEY ARE THE REAL ONES. Board A is the accepted Living Analysis
 * World — the raster I-08B3.1-F1 shipped, whose sha256 the dark-regression gate re-derives on every
 * run — and every dark counterpart elsewhere comes out of the same builder. A control a package
 * draws for itself is not a control.
 *
 * THE BOARDS ARE A MIRROR, NOT A CASE. Where the light appearance is weaker than the dark one it
 * is shown side by side at the same scale with the measurement underneath, because a board that
 * only showed the light appearance at its best would be asking for agreement rather than judgement.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page } from './f2-scene.mjs';
import { conversation, deepAnalysis, form } from './f2-surfaces.mjs';
import { resolveAll, ROLES, tokenTreeDigest } from './f2-resolve.mjs';
import { profile, BEATS, BEATS_BY_KIND, sourcesAt } from './f2-meaning.mjs';
import { withBrowser, capture, perceptualExtent, PKG } from './f2-render.mjs';
import { lch, dEok, contrastHex, invert, f } from './f2-color.mjs';
import { VIEW } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';

const R = { dark: resolveAll({ appearance: 'dark' }), light: resolveAll({ appearance: 'light' }) };
const D = JSON.parse(readFileSync(join(PKG, 'data/F2_DERIVATION.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/**
 * A BOARD REFERENCES ITS TILES BY PATH, IT DOES NOT EMBED THEM.
 *
 * The first version inlined every tile as a base64 data URI, which shipped each raster twice —
 * once in `review/src` and once, inflated by a third, inside the board's own HTML — and made the
 * board documents unreadable. Referencing them costs nothing (the boards render from file:// with
 * local file access, which this harness already requires for the font) and it means the board
 * HTML is a composition a reviewer can actually read.
 */
const srcRef = (rel) => '../src/' + rel.split('/').pop().replace(/\.html$/, '.png');

/* ------------------------------------------------------------------- board chrome ------- */
/**
 * THE BOARD'S OWN FURNITURE, DECLARED RATHER THAN SCATTERED.
 *
 * These are the only colour literals in any F2 renderer, and they are **not QANDEEL colours**: a
 * board is a document ABOUT QANDEEL, and its furniture is deliberately neutral so it does not
 * compete with the QANDEEL inside it or with either appearance's ground.
 *
 * They are EXPORTED because two checks need to know exactly which literals are legitimate here.
 * Check A-05 scans every renderer for a typed colour and allows precisely this set in this file;
 * `tools/f2-consistency.mjs` allows the same set on the same grounds. Declaring them once means
 * neither check has to carry a hand-copied list that can drift from the CSS.
 */
export const BOARD_CHROME = Object.freeze({
  ground: '#1b1b1d', ink: '#e8e8e6', accent: '#9a8f7c', sub: '#a9a9a4',
  edge: '#333336', cap: '#c9c9c4', capStrong: '#efefec', capQuiet: '#8f8f8a',
  note: '#cfcfca', warn: '#c8785f', rule: '#37373a', head: '#252528', foot: '#7e7e79',
});
const K = BOARD_CHROME;
const BOARD_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:${K.ground};color:${K.ink};font-family:'Estedad',system-ui,sans-serif;padding:34px 34px 40px;width:WIDTHpx}
h1{font-size:23px;font-weight:700;letter-spacing:.2px;margin-bottom:5px}
h1 .id{color:${K.accent};margin-inline-end:10px}
.sub{color:${K.sub};font-size:14px;line-height:1.55;max-width:1180px;margin-bottom:22px}
.row{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;margin-bottom:22px}
.tile{display:flex;flex-direction:column;gap:9px}
.tile img{display:block;border:1px solid ${K.edge};border-radius:3px}
.cap{color:${K.cap};font-size:12.5px;line-height:1.5;max-width:420px}
.cap b{color:${K.capStrong};font-weight:600}
.cap .m{color:${K.capQuiet};font-variant-numeric:tabular-nums}
.note{border-inline-start:3px solid ${K.accent};padding:9px 0 9px 0;padding-inline-start:14px;margin:8px 0 20px;
  color:${K.note};font-size:13px;line-height:1.62;max-width:1180px}
.note b{color:${K.ink}}
.warn{border-inline-start-color:${K.warn}}
table{border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
th,td{border:1px solid ${K.rule};padding:6px 11px;text-align:start;vertical-align:top}
th{background:${K.head};color:${K.capStrong};font-weight:600}
td.sw{padding:0}
.chip{display:block;inline-size:64px;block-size:26px}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px}
.foot{color:${K.foot};font-size:11.5px;margin-top:20px;line-height:1.6}
`;

function board({ id, title, sub, body, width = 1400 }) {
  const fontPath = join(PKG, 'fonts', 'Estedad[wght].ttf').replace(/\\/g, '/');
  return `<!doctype html><html lang="en" data-qd-ready="0"><head><meta charset="utf-8"><title>${id}</title>
<style>@font-face{font-family:'Estedad';src:url('file:///${fontPath}') format('truetype');font-weight:100 900;font-display:block}
${BOARD_CSS.replace('WIDTHpx', width + 'px')}</style></head><body>
<h1><span class="id">${id}</span>${esc(title)}</h1>
<div class="sub">${sub}</div>
${body}
<div class="foot">I-08B3.1-F2 — LIGHT APPEARANCE + CROSS-APPEARANCE INTEGRATION. Every tile is a rendered QANDEEL surface at ${VIEW.W}x${VIEW.H} CSS px, DPR ${VIEW.DPR}, Estedad v8.5, Arabic content. REVIEW CANDIDATE — nothing here is frozen.</div>
<script>document.fonts.ready.then(function(){document.documentElement.setAttribute('data-qd-ready','1')});</script>
</body></html>`;
}

/** The caption is bounded by the tile's OWN width. Without it a five-frame motion strip wraps
 *  after four, because `.cap`'s max-width is wider than a strip frame and the flex row sizes to
 *  the caption — so the strip stopped reading as a strip. */
const tile = (uri, cap, w = 390) => `<div class="tile" style="max-width:${Math.max(w, 200)}px">`
  + `<img src="${uri}" width="${w}"><div class="cap" style="max-width:${Math.max(w, 200)}px">${cap}</div></div>`;

/* ================================================================== the run ================ */
export async function run() {
  mkdirSync(join(PKG, 'review/board'), { recursive: true });
  mkdirSync(join(PKG, 'review/src'), { recursive: true });

  return withBrowser(async (browser) => {
    const shot = async (rel, html, height = VIEW.H, full = false, dpr = VIEW.DPR) => {
      const c = await capture(browser, { html, rel, height, full, dpr, savePng: true });
      return { uri: srcRef(rel), sha: c.sha, png: c.png };
    };
    /* THE MOTION STRIPS CAPTURE AT DPR 1. Thirty event-beat frames at DPR 2 are four megabytes of
       evidence displayed 280 px wide — the resolution is not carrying anything the reader can use,
       and the boards embed every frame as a data URI, so the cost is paid twice. The surfaces a
       reviewer actually inspects closely are all still captured at the device's own DPR 2. */
    const strip = async (rel, html) => shot(rel, html, VIEW.H, false, 1);

    /* ---- the sources every board draws on ---- */
    const src = {};
    src.darkWorld = await shot('review/src/a-dark-world.html', page({ appearance: 'dark' }));
    src.lightWorld = await shot('review/src/b-light-world.html', page({ appearance: 'light' }));

    /**
     * THE THREE MEANING CATEGORIES, EACH ON ITS OWN CLOCK — I-08B3.1-F2R's correction.
     *
     * F2 sampled all three at one set of times, and CONNECTION does not share them: it peaks at
     * 1050 ms while PATTERN peaks at 3010 and INSIGHT at 2920, so the frame captioned
     * "CONNECTION — PEAK" was CONNECTION at 42 per cent of its own level, on its tail. The
     * independent review compared that frame against REST, found the light event near-static, and
     * was right about the frame. The beats now come from D2R's own event functions, per category.
     */
    src.events = {};
    for (const kind of ['connection', 'pattern', 'insight']) {
      const b = BEATS_BY_KIND[kind];
      const beats = [['REST', b.REST], ['RISE', b.RISE], ['PEAK', b.PEAK], ['FALL', b.FALL], ['SETTLE', b.SETTLE]];
      src.events[kind] = { beats, peakLevel: b.peakLevel };
      for (const app of ['light', 'dark']) {
        src.events[kind][app] = [];
        for (const [name, t] of beats) {
          const s = await strip(`review/src/${kind}-${app}-${name.toLowerCase()}.html`, page({ appearance: app, event: { kind, t } }));
          src.events[kind][app].push({ name, t, ...s });
        }
      }
    }

    /**
     * THE SCENE-SCALE EXTENT, MEASURED ON THE FRAMES THE BOARDS PUBLISH — I-08B3.1-F2R's addition.
     *
     * R-FOOTPRINT and check C-06 bound the extent of ONE source along its own falloff. That is the
     * right instrument for a shape and the wrong one for a stain, because the stain risk is at scene
     * scale: five INSIGHT lobes can each satisfy a per-source bound and still cover the world between
     * them, and that is precisely the failure an earlier selection rule produced and the numbers
     * could not report. This compares each category's PEAK frame against its own REST frame and
     * counts the fraction of the world that moved by more than a just-noticeable step, per appearance
     * — so "the light appearance does not flood the World" is a claim about the World.
     *
     * It is computed here rather than in a gate of its own because these are the rasters a reviewer
     * looks at. Measuring one set of pixels and publishing another is the gap this package keeps
     * finding in its own work.
     */
    const sceneExtent = [];
    for (const kind of ['connection', 'pattern', 'insight']) {
      const row = { kind, peakAt: BEATS_BY_KIND[kind].PEAK, peakLevel: BEATS_BY_KIND[kind].peakLevel };
      for (const app of ['dark', 'light']) {
        const frames = src.events[kind][app];
        const rest = frames.find((f) => f.name === 'REST');
        const peak = frames.find((f) => f.name === 'PEAK');
        row[app] = await perceptualExtent(rest.png, peak.png, D.adopted.JND_DEOK);
      }
      row.lightOverDark = row.dark.changedBeyondAJND > 0
        ? +(row.light.changedBeyondAJND / row.dark.changedBeyondAJND).toFixed(4) : null;
      /* THE CLAIM: an alternate appearance may not make a meaning event cover MORE of the world than
         its counterpart does. Non-exceeding, not matching — the same shape of requirement as
         R-FOOTPRINT, for the same reason: a tighter light is not a worse light. */
      row.lightDoesNotExceedDark = row.light.fractionOfTheWorld <= row.dark.fractionOfTheWorld + 0.01;
      sceneExtent.push(row);
    }

    /**
     * AND THE INSTRUMENT IS PROBED WHERE THE PIXELS ARE, because a measurement that reports 3% has
     * to be shown capable of reporting 100%. Readings this small are exactly the shape a broken
     * comparison produces — wrong stride, wrong decode, a cache key that collides — and every one of
     * those failures also reports "almost nothing changed". So the light PEAK frame is compared
     * against the DARK REST frame: two different appearances, where the ground itself differs, so
     * nearly every pixel must register. If this does not come back near the whole world, the small
     * numbers above are an artefact and not a finding.
     */
    const flood = await perceptualExtent(
      src.events.insight.dark.find((f) => f.name === 'REST').png,
      src.events.insight.light.find((f) => f.name === 'PEAK').png,
      D.adopted.JND_DEOK,
    );
    const sceneExtentProbe = {
      name: 'the light INSIGHT peak measured against the DARK rest frame — a whole appearance apart, not one scene lit',
      fractionOfTheWorld: flood.fractionOfTheWorld,
      worstDEok: flood.worstDEok,
      rejected: flood.fractionOfTheWorld > 0.9,
      whatItProves: 'the comparison can report a flood, so the three readings above are a property of the events rather than of the instrument',
    };

    src.conv = {}; src.deep = {}; src.form = {};
    for (const app of ['light', 'dark']) {
      src.conv[app] = await shot(`review/src/conversation-${app}.html`, conversation({ appearance: app }), VIEW.H, true);
      src.deep[app] = await shot(`review/src/deep-${app}.html`, deepAnalysis({ appearance: app }), 1180, true);
      src.form[app] = await shot(`review/src/form-${app}.html`, form({ appearance: app }), 700, true);
    }

    /* the five interaction states, light */
    src.states = {};
    for (const st of ['rest', 'pressed', 'focus', 'selected', 'unavailable', 'error']) {
      src.states[st] = await shot(`review/src/state-${st}-light.html`, page({ appearance: 'light', interaction: st }), VIEW.H);
    }
    src.statesDark = await shot('review/src/states-dark.html', page({ appearance: 'dark', interaction: 'selected' }), VIEW.H);

    /* the accessibility combinations, light */
    const COMBOS = [
      ['LIGHT DEFAULT', {}],
      ['LIGHT + INCREASE CONTRAST', { contrast: 'increased' }],
      ['LIGHT + REDUCE TRANSPARENCY', { transparency: 'reduced' }],
      ['LIGHT + REDUCED MOTION', { motion: 'reduced' }],
      ['LIGHT + CONTRAST + TRANSPARENCY', { contrast: 'increased', transparency: 'reduced' }],
      ['LIGHT + LARGER TEXT AX5 (311.8%)', { textScale: 3.118 }],
      ['LIGHT + BOLD TEXT', { boldText: true }],
      ['LIGHT + GRAYSCALE (diagnostic)', { filter: 'grayscale' }],
      ['LIGHT + DEUTERANOPIA (diagnostic)', { filter: 'deutan' }],
    ];
    src.combos = [];
    for (const [name, st] of COMBOS) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      src.combos.push({ name, ...(await shot(`review/src/combo-${slug}.html`, page({ appearance: 'light', ...st }), VIEW.H, st.textScale ? true : false)) });
    }
    src.comboError = await shot('review/src/combo-light-error-grayscale.html', page({ appearance: 'light', interaction: 'error', filter: 'grayscale' }), VIEW.H);

    /* ---------------------------------------------------------------- the boards -------- */
    const boards = [];
    const emit = async (id, html, width) => {
      const c = await capture(browser, { html, rel: `review/board/${id}.html`, width, height: 900, full: true, savePng: true });
      boards.push({ id, sha: c.sha, bytes: c.png.length });
      return c;
    };

    /* A — the dark control */
    const acceptedSha = JSON.parse(readFileSync(join(PKG, 'data/F2_DARK_REGRESSION.json'), 'utf8')).pixel.acceptedSha;
    await emit('a-living-analysis-world-dark-control', board({
      id: 'BOARD A', title: 'LIVING ANALYSIS WORLD — DARK CONTROL',
      sub: 'The appearance F2 is <b>not allowed to touch</b>. This is the control every other board is judged against, and it is the accepted raster rather than a re-creation: <span class="mono">' + acceptedSha.slice(0, 24) + '</span> is the sha256 I-08B3.1-F1 shipped, and tools/f2-regression.mjs re-renders it with F1\'s own scene builder on every run and requires byte identity.',
      body: `<div class="row">${tile(src.darkWorld.uri, '<b>DARK DEFAULT.</b> World <span class="mono">' + R.dark.colour.WORLD.value + '</span> · Surface <span class="mono">' + R.dark.colour.SURFACE.value + '</span> · Living Brass <span class="mono">' + R.dark.colour.BRASS.value + '</span>. <span class="m">Re-rendered raster ' + src.darkWorld.sha.slice(0, 16) + '</span>')}
      <div class="tile"><div class="note"><b>THE GATE, NOT THE PICTURE, IS THE PROOF.</b> Four layers, each of which fails differently: every frozen dark LITERAL through F1\'s own resolver; every alias ROUTE; all five F1 accessibility STATES, because a default-only gate is satisfied by a package that changed only the overrides; and the PIXELS. Four planted probes sit under them — a World normalised to #121212, a role re-pointed to the same colour by a shorter route, an override moved in a non-default state only, and a scrim alpha softened with its ink unchanged.</div>
      <div class="note"><b>WHY A SECOND APPEARANCE ENDANGERS THE FIRST.</b> Not vandalism — unification. A value nudged so one token serves both, a ramp flattened so a formula works in both directions, a scrim softened so one alpha reads on both grounds. Every one of those is described afterwards as consistency.</div></div></div>`,
    }), 1400);

    /* B — the light world */
    await emit('b-living-analysis-world-light', board({
      id: 'BOARD B', title: 'LIVING ANALYSIS WORLD — LIGHT',
      sub: 'The same world, the same geometry, the same eight topics, the same six hues, the same contour harmonics, the same ring counts, the same parallax ladder. What changed is the luminance environment.',
      body: `<div class="row">${tile(src.lightWorld.uri, '<b>LIGHT DEFAULT.</b> World <span class="mono">' + R.light.colour.WORLD.value + '</span> · Surface <span class="mono">' + R.light.colour.SURFACE.value + '</span> · Living Brass <span class="mono">' + R.light.colour.BRASS.value + '</span>.')}
      ${tile(src.darkWorld.uri, '<b>DARK, for reference.</b> Not a target — a counterpart.')}
      <div class="tile" style="max-width:460px">
      <div class="note"><b>THE GROUND IS AS LIGHT AS IT CAN BE WHILE A LIGHT CAN STILL HAPPEN IN IT.</b> Its lightness is not a comfort judgement and not a mirror of #101010: the search swept OKLCh L 0.880 to 0.985, and at ' + '0.955 no expression family could produce a source that rises above this ground by more than a just-noticeable step, because the ground had taken the ceiling the source needed.</div>
      <div class="note"><b>THE ATMOSPHERE CROSSES THE GROUND.</b> Brighter than the World in dark, deeper than it in light — each layer at the lightness that preserves its own contour contrast, 5.263:1 / 3.941:1 / 2.921:1. The depth cue therefore reverses, which costs nothing: D2R declares ring layer, contour count, contour shape, radius and hue all <span class="mono">encodes: null</span>.</div>
      <div class="note warn"><b>FOR THE PRODUCT OWNER.</b> This is the board on which "does Light still feel like QANDEEL" is decided. The package can prove the field was not simplified — it can not prove that the result is beautiful.</div>
      </div></div>`,
    }), 1400);

    /* C, D, E — the three meaning categories, with motion */
    const evBoard = async (letter, kind, title, grammar) => {
      const strip = (app) => src.events[kind][app].map((b) => tile(b.uri, `<b>${b.name}</b> <span class="m">t=${b.t} ms</span>`, 280)).join('');
      await emit(`${letter}-${kind}-light`, board({
        id: `BOARD ${letter.toUpperCase()}`, title,
        sub: grammar + ' The beats are <b>this category\'s own</b>, derived from I-08B3.1-D2R\'s event function by scanning the level it returns — peak at the argmax, rise and fall at its half-level crossings. The source list, geometry, falloff, envelope and settle are D2R\'s, called at a time in milliseconds. F2 changes <b>what the intensity paints</b>, never when.',
        body: `<div class="row">${strip('light')}</div>
        <div class="note"><b>THE SAME BEATS IN DARK, for comparison.</b> Same times, same geometry, same envelope — only the expression differs.</div>
        <div class="row">${strip('dark')}</div>
        <div class="note"><b>THE BEATS ARE PER CATEGORY, AND I-08B3.1-F2 GOT THIS WRONG.</b> F2 sampled all three categories at one set of times. PATTERN peaks at 3010 ms and INSIGHT at 2920, so those two were well served; <b>CONNECTION peaks at ${BEATS_BY_KIND.connection.PEAK} ms</b>, and at 2900 it is at 0.363 of its own level. The frame captioned "CONNECTION — PEAK" was showing CONNECTION on its tail, and the independent review that compared it against REST and found the light event near-static was reading that frame correctly. This category peaks at <span class="mono">t = ${BEATS_BY_KIND[kind].PEAK} ms</span>, level <span class="mono">${BEATS_BY_KIND[kind].peakLevel}</span>.</div>
        <div class="note"><b>SIGNED BLOOM.</b> The source floods toward the ceiling of what sRGB holds at the Light\'s hue; the falloff lays a warm glaze around it. Both signs, one event, and it returns to <b>exactly</b> the unilluminated ground — asserted on the quantised hex, because a residue of one 8-bit step is a permanent glow no float comparison would report, and on the shape one intensity step above zero, because a value at zero is a special case every profile has.</div>
        <div class="note warn"><b>THE MAGNITUDES ARE NOT EQUAL AND THIS PACKAGE DOES NOT CLAIM THEY ARE.</b> Measured as each appearance's event averaged over the source's disc, in the units of that appearance's own smallest reading step: <b>dark ${D.magnitudeInReadingSteps.darkAreaMeanOverDarkReadingStep}</b>, <b>light ${D.magnitudeInReadingSteps.lightAreaMeanOverLightReadingStep}</b>. A dark ground lends a meaning event the whole empty luminance range above it; a light ground has already spent that range on the ground, so almost all of the light event is the glaze around the source rather than the source — by <b>${D.winningFamily.dipOverRise} to 1</b>.</div>
        <div class="note warn"><b>AND THE VERSION THAT CLOSES THE GAP WAS BUILT, RENDERED AND REJECTED — WHICH IS WHY THERE IS A NEW REQUIREMENT.</b> Preserving the ratio needs an area mean of <span class="mono">${D.magnitudeInReadingSteps.ratioPreservingFloorWouldBe}</span>, and that <b>is reachable</b>: ${D.chosen.ratioFloorCost ? D.chosen.ratioFloorCost.countAbove.toLocaleString('en-US') : 'thousands of'} configurations reach it. The one that reaches it best passed every requirement this package stated at the time — hue drift inside tolerance, ladder preserved, separations clear, a clean settle — and rendered as an <b>opaque brown-grey sphere sitting on the World</b>. A configuration that passes every check and fails on sight means a check is missing, not that the eye is wrong. The missing one is <b>R-SOURCE-DOMINANCE</b>: no stop of the Meaning Light may be darker than the World under its own passage scrim, <span class="mono">L ${D.magnitudeInReadingSteps.suppressedWorldLightness}</span> — this ramp's deepest stop is <span class="mono">L ${D.magnitudeInReadingSteps.winnerMinStopLightness}</span>, the rejected one's was <span class="mono">L ${D.chosen.ratioFloorCost ? D.chosen.ratioFloorCost.itsMinStopLightness : '—'}</span>. All ${D.chosen.ratioFloorCost ? D.chosen.ratioFloorCost.countAbove.toLocaleString('en-US') : ''} of them fail that one requirement and no other, so the gap is a consequence of a ground at L 0.9491 rather than a limit of the search.</div>
        <div class="note"><b>IT IS NOT A FLOOD, AND THAT IS MEASURED ON THESE FRAMES RATHER THAN ON A FALLOFF.</b> Comparing the PEAK frame above against its own REST frame, pixel by pixel in OKLab: the light event moves <b>${(sceneExtent.find((r) => r.kind === kind).light.fractionOfTheWorld * 100).toFixed(2)}%</b> of the world beyond a just-noticeable step, against <b>${(sceneExtent.find((r) => r.kind === kind).dark.fractionOfTheWorld * 100).toFixed(2)}%</b> in dark — a ratio of <span class="mono">${sceneExtent.find((r) => r.kind === kind).lightOverDark}</span>. <b>The two appearances' events are nearly identical in EXTENT and differ in MAGNITUDE.</b> The event happens in the same place, over the same area, on the same clock; what differs is how loudly. R-FOOTPRINT bounds one source along its own falloff, which cannot see five INSIGHT lobes covering the world between them — this can, and check C-10 requires the light appearance never to exceed the dark one.</div>`,
      }), 1560);
    };
    await evBoard('c', 'connection', 'CONNECTION — DIRECTIONAL RELATION — LIGHT', 'CONNECTION = A relates to B. One travelling source along the route, in both appearances.');
    await evBoard('d', 'pattern', 'PATTERN — CONVERGENCE — LIGHT', 'PATTERN = A + B + C are one larger structure. Four sources, one per member, all at the same level — a set has no strengths.');
    await evBoard('e', 'insight', 'INSIGHT — EMERGENCE — LIGHT', 'INSIGHT = something new is understood. Five lobes gathering, then a node and the keel beneath it.');

    /* F — the quiet surface */
    await emit('f-conversation-light', board({
      id: 'BOARD F', title: 'PERSONAL CONVERSATION — LIGHT',
      sub: 'The Product at its most ordinary, which is where a ground\'s reading comfort is actually decided. QANDEEL\'s turns are <b>not</b> put on a bubble: a bubble is a container, and I-08B3.1-B4R froze that QANDEEL has one functional Surface and no container roles.',
      body: `<div class="row">${tile(src.conv.light.uri, '<b>LIGHT.</b> Person on the one functional Surface; QANDEEL on the World, marked by the brass ق.')}
      ${tile(src.conv.dark.uri, '<b>DARK.</b> The same exchange, the same composition.')}
      <div class="tile" style="max-width:460px">
      <div class="note"><b>THE LAST LINE IS THE LOAD-BEARING ONE.</b> «هذا ما لاحظتُه في عالَمك. ولستُ على يقين من السبب.» An analytical product that never admits the limit of its own evidence is not being careful, it is being confident. It is set in the tertiary rung so it reads as QANDEEL qualifying itself rather than as a second claim.</div>
      <div class="note"><b>IT IS THE SAME ANALYTICAL CONTENT AS THE MAP.</b> «الإتقان يسبق السهر بيومين» is the sentence the Living Analysis World settles on, arriving here in words. Two surfaces, one Product.</div>
      </div></div>`,
    }), 1400);

    /* G — deep analysis reading */
    const lead = contrastHex(R.light.colour.PRIMARY.value, R.light.colour.WORLD.value);
    const bodyC = contrastHex(R.light.colour.SECONDARY.value, R.light.colour.WORLD.value);
    const asideC = contrastHex(R.light.colour.TERTIARY.value, R.light.colour.WORLD.value);
    await emit('g-deep-analysis-reading-light', board({
      id: 'BOARD G', title: 'DEEP ANALYSIS READING — LIGHT',
      sub: 'Long-form Arabic on the light ground. §6 asks for clear, comfortable, sustained reading rather than maximum contrast, and says plainly that pure black on pure white is not automatically superior.',
      body: `<div class="row">${tile(src.deep.light.uri, '<b>LIGHT.</b> Lead <span class="m">' + f(lead, 2) + ':1</span> · body <span class="m">' + f(bodyC, 2) + ':1</span> · aside <span class="m">' + f(asideC, 2) + ':1</span>, against 12.95 / 8.38 / 5.44 in dark.')}
      ${tile(src.deep.dark.uri, '<b>DARK.</b> The same three ratios, on the other ground.')}
      <div class="tile" style="max-width:460px">
      <div class="note"><b>THE PRIMARY INK IS NOT BLACK.</b> Pure black on this ground would be 18.1:1. The ramp holds the frozen ratios instead, because QANDEEL\'s hierarchy IS the set of ratios and maximising the first rung would compress every rung below it.</div>
      <div class="note"><b>THE INK IS TINTED, NOT GREY.</b> It would have been easy to solve the light inks as neutral greys at the right luminances and the contrast checks would be identical. They are solved at the frozen ramp\'s own hue — 91.6 to 94.2 degrees, chroma held — so the reading ink carries the system\'s own warmth.</div>
      <div class="note"><b>LEADING.</b> ${R.light.scalar.TEXT_LEADING_RATIO.value}, unchanged from dark and above the ${R.light.scalar.TEXT_LEADING_FLOOR.value} threshold that currently instruments <span class="mono">text.arabic-must-not-clip</span>. No letter-spacing and no italics anywhere near an Arabic glyph, in either appearance.</div>
      </div></div>`,
    }), 1400);

    /* H — utility / form / error */
    await emit('h-utility-form-error-light', board({
      id: 'BOARD H', title: 'UTILITY, FORM AND ERROR — LIGHT',
      sub: 'The surface where colour is most tempted to carry meaning alone.',
      body: `<div class="row">${tile(src.form.light.uri, '<b>LIGHT.</b> Error <span class="mono">' + R.light.colour.ERROR_INK.value + '</span> at ' + f(contrastHex(R.light.colour.ERROR_INK.value, R.light.colour.WORLD.value), 2) + ':1.')}
      ${tile(src.form.dark.uri, '<b>DARK.</b> Error <span class="mono">' + R.dark.colour.ERROR_INK.value + '</span> — frozen, Product-approved, untouched.')}
      ${tile(src.comboError.uri, '<b>LIGHT + GRAYSCALE.</b> The error is still an error with the colour gone: glyph, boundary and words.')}
      <div class="tile" style="max-width:440px">
      <div class="note"><b>ONE ERROR FAMILY.</b> Hue <span class="mono">${f(lch(R.dark.colour.ERROR_INK.value)[2], 1)}°</span> in dark and <span class="mono">${f(lch(R.light.colour.ERROR_INK.value)[2], 1)}°</span> in light; chroma <span class="mono">${f(lch(R.dark.colour.ERROR_INK.value)[1])}</span> and <span class="mono">${f(lch(R.light.colour.ERROR_INK.value)[1])}</span>. Error stays the most chromatic thing on a QANDEEL screen in both appearances.</div>
      <div class="note"><b>THE ROAD NOT TAKEN.</b> Reproducing the dark 8.61:1 ratio gives <span class="mono">#801c11</span> — dEok 0.3716 from the frozen value against the chosen 0.2361, and visibly a maroon rather than a coral. The rule is: meet the 4.5:1 ink floor, then move the smallest distance that allows.</div>
      <div class="note"><b>AN INVERSION WOULD HAVE GIVEN <span class="mono">#016f81</span></b> — teal. That is what §4 is protecting against, in one value.</div>
      </div></div>`,
    }), 1620);

    /* I — interaction states */
    const stTiles = ['rest', 'pressed', 'focus', 'selected', 'unavailable', 'error']
      .map((s) => tile(src.states[s].uri, `<b>${s.toUpperCase()}</b>`, 300)).join('');
    await emit('i-focus-selected-disabled-light', board({
      id: 'BOARD I', title: 'REST · PRESSED · FOCUS · SELECTED · UNAVAILABLE · ERROR — LIGHT',
      sub: 'I-08B3.1-E1 froze the state grammar. F2 changes none of it and supplies only the values its aliases resolve to — every one of these six is an alias in both appearances.',
      body: `<div class="row">${stTiles}</div>
      <div class="note"><b>THEY ARE TOLD APART BY MORPHOLOGY, NOT BY INK.</b> SELECTED is an <b>attached marker</b> plus a permitted ${R.light.scalar.SELECTED_WEIGHT.value - R.light.scalar.REST_WEIGHT.value}-unit weight step. FOCUS is a <b>detached perimeter</b> — ${R.light.scalar.FOCUS_THICKNESS.value.value} px at ${R.light.scalar.FOCUS_OFFSET.value.value} px offset, with a companion. PRESSED is a <b>transient ground response</b>. None of the three is identified by its colour, which is why none of them collapses into another when the appearance changes or the colour is removed.</div>
      <div class="note"><b>UNAVAILABLE KEEPS BOTH OF ITS RELATIONS.</b> ${f(contrastHex(R.light.colour.DISABLED_INK.value, R.light.colour.WORLD.value), 2)}:1 against the World — below 4.5:1, which WCAG 2.2 exempts for inactive components, and below the tertiary rung. Raising it to meet 4.5:1 would compress its distance from the resting ink, and <b>that distance is the availability signal</b>. Its reason is in words, on a real control, through a real accessible description.</div>
      <div class="note"><b>NONE OF THE THREE IS BRASS.</b> Living Brass is identity material and is state-invariant in value and in appearance. Focus, Selected and Pressed all reach the frozen reading ramp.</div>`,
    }), 1400);

    /* J — dark ↔ light identity */
    const ladder = D.crossAppearance.darkBands.map((b, i) => {
      const l = D.crossAppearance.lightBands[i];
      return `<tr><th>${b.band}</th><td class="mono">${f(b.min)} – ${f(b.max)}</td><td class="mono">${f(l.min)} – ${f(l.max)}</td></tr>`;
    }).join('');
    await emit('j-dark-light-identity-comparison', board({
      id: 'BOARD J', title: 'DARK ↔ LIGHT — IS THIS THE SAME PRODUCT AT THE SAME QUALITY LEVEL?',
      sub: '§22 says the question is not whether they look identical. Same scale, side by side, no annotation between them.',
      body: `<div class="row">${tile(src.darkWorld.uri, '', 430)}${tile(src.lightWorld.uri, '', 430)}
      <div class="tile"><table><tr><th>role family</th><th>chroma in DARK</th><th>chroma in LIGHT</th></tr>${ladder}</table>
      <div class="cap" style="margin-top:10px">The cross-appearance identity mechanism, and it was <b>found rather than imposed</b>: I-08B3.1-A, C3, D2R and E1 each chose their own value for their own reason, and this ladder is what fell out. An appearance may move every lightness in the system and may not reorder it.</div></div></div>
      <div class="note"><b>WHAT AN INVERSION WOULD HAVE PRODUCED.</b> Mean hue rotation <span class="mono">${D.inversionMeanHueRotation}°</span>: Living Brass 75° → 256° (<b>blue</b>), Error 30° → 214° (<b>teal</b>), the reading ramp 94° → 273° (<b>blue-violet</b>). An inversion does not produce different values, it produces a different Product. §4 stops being a preference.</div>
      <div class="note"><b>AND THE SCRIM DOES NOT FLIP AT ALL.</b> Neutral black in both appearances, at alpha 0.5 and ${D.scrim.alpha}. Suppression is subtraction, not a direction on the lightness axis, and a white scrim over a light World is the stacked-light-translucency case where legibility collapses. It is the role an inversion would most obviously flip and the one role that must not.</div>`,
    }), 1500);

    /* K — accessibility combinations */
    const combos = src.combos.map((c) => tile(c.uri, `<b>${c.name}</b>`, 300)).join('');
    const ic = D.increasedContrast;
    await emit('k-light-accessibility-combinations', board({
      id: 'BOARD K', title: 'LIGHT × THE FROZEN I-08B3.1-F1 TRANSFORMATIONS',
      sub: 'Apple asks for content to be tested with Increase Contrast and Reduce Transparency on, "both separately and together". §18 asks the same. The transformations are not redesigned — they are re-run.',
      body: `<div class="row">${combos}</div>
      <div class="note"><b>MOST OF F1 NEEDED NOTHING FROM F2, AND THAT IS THE RESULT.</b> F1\'s increased-contrast context re-points two <b>aliases</b> — the analytical relation and the functional control ink, one rung up the frozen ramp — and thickens the focus perimeter, which is a dimension. All three are appearance-independent and all three are loaded for both appearances from the same file. Only three atmosphere lightnesses and one computed scrim literal are appearance-bound.</div>
      <div class="note"><b>THE SAME LAW REPRODUCES ITSELF ON THE OTHER GROUND.</b> Worst contour ${ic.defaultWorstRatio}:1 → full alpha clears ${ic.casesClearedByAlphaAlone}/${ic.casesTotal} cases → one lightness delta of <span class="mono">${ic.lightnessDelta}</span> closes the residue at ${ic.finalWorstRatio}:1. In dark the delta is <span class="mono">+0.011</span> and it clears the same 12 of 15. The sign is the whole difference: a contour buys contrast by lifting off black and by deepening against white.</div>
      <div class="note"><b>HIGH CONTRAST IS STILL NOT HIGH IMPORTANCE.</b> The meaning-hierarchy ratio is ${ic.meaningHierarchy.ratioDefault} by default, collapses to ${ic.meaningHierarchy.ratioIfOnlyAtmosphereRose} if only the atmosphere rises, and widens to ${ic.meaningHierarchy.ratioIncreased} when the analytical relation rises with it. Dark\'s three figures are 1.2914, 1.028 and 1.524.</div>
      <div class="note warn"><b>NO REAL VOICEOVER OR TALKBACK RUN EXISTS, IN EITHER APPEARANCE.</b> I-08B3.1-F1 recorded that as a mandatory implementation gate and F2 does not discharge it. The screen-reader projection is appearance-independent by construction — it has no appearance at all — and the parity matrix confirms the two are identical, which is evidence about the projection and not about a device.</div>`,
    }), 1620);

    /* L — the cross-appearance role map */
    const roleRows = ROLES.map(([role]) => {
      const d = R.dark.colour[role], l = R.light.colour[role];
      const isAlias = d.chain.length > 2;
      const drift = (() => {
        const a = lch(d.value)[2], b = lch(l.value)[2];
        if (Number.isNaN(a) || Number.isNaN(b)) return '—';
        const x = Math.abs(b - a) % 360;
        return f(x > 180 ? 360 - x : x, 2) + '°';
      })();
      return `<tr><th>${role}</th><td class="mono">${d.token}</td>
        <td class="sw"><span class="chip" style="background:${d.value}"></span></td><td class="mono">${d.value}${d.alpha !== undefined ? ' @' + d.alpha : ''}</td>
        <td class="sw"><span class="chip" style="background:${l.value}"></span></td><td class="mono">${l.value}${l.alpha !== undefined ? ' @' + l.alpha : ''}</td>
        <td class="mono">${drift}</td><td>${isAlias ? 'alias' : '<b>literal</b>'}</td></tr>`;
    }).join('');
    await emit('l-cross-appearance-role-map', board({
      id: 'BOARD L', title: 'THE CROSS-APPEARANCE SEMANTIC ROLE MAP',
      sub: 'Every Product role, both appearances, the hue drift between them, and whether the appearance owns a value for it or it follows an alias. <b>This is the only board with swatches on it, and its subject is the map.</b>',
      body: `<table><tr><th>role</th><th>semantic token</th><th colspan="2">DARK</th><th colspan="2">LIGHT</th><th>hue drift</th><th>kind</th></tr>${roleRows}</table>
      <div class="note"><b>TWELVE LITERALS. EVERYTHING ELSE IS AN ALIAS.</b> That is why a second appearance is twelve derivations rather than a second design system, and why cross-appearance semantic parity is <b>structural</b> rather than maintained: the roles cannot diverge, because there is only one set of them. Check P-02 walks every chain in both appearances and requires the two route sets to be character-for-character identical.</div>
      <div class="note"><b>THE MAXIMUM HUE DRIFT ACROSS THE WHOLE SYSTEM IS ${D.crossAppearance.maxHueDrift}°</b>, against a declared tolerance of 3. Role identity, not hex identity — and the hue is what carries it.</div>`,
    }), 1400);

    return { boards, sceneExtent, sceneExtentProbe };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { boards, sceneExtent, sceneExtentProbe } = await run();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_BOARDS.json'), JSON.stringify({
    generatedBy: 'tools/f2-boards.mjs',
    /* BOUND TO THE TOKEN TREE BY CONTENT, like the three delegated gates — because check C-10 now
       reads this record, and a record a check believes has to be able to say which tree it is
       about without relying on a filesystem timestamp that archiving destroys. */
    tokenTree: tokenTreeDigest(),
    count: boards.length, boards,
    sceneExtentJND: D.adopted.JND_DEOK,
    sceneExtent, sceneExtentProbe,
  }, null, 2) + '\n');
  for (const b of boards) console.log('  ' + b.id.padEnd(46) + b.sha.slice(0, 16) + '  ' + b.bytes + ' B');
  console.log(boards.length + ' boards');
  console.log('\nSCENE-SCALE EXTENT — fraction of the world moved beyond a JND, REST to PEAK');
  for (const r of sceneExtent) {
    console.log('  ' + r.kind.padEnd(11) + 'peak t=' + String(r.peakAt).padStart(4)
      + '  dark ' + (r.dark.fractionOfTheWorld * 100).toFixed(2).padStart(6) + '%'
      + '  light ' + (r.light.fractionOfTheWorld * 100).toFixed(2).padStart(6) + '%'
      + '  light/dark ' + String(r.lightOverDark).padStart(7)
      + '  ' + (r.lightDoesNotExceedDark ? 'does not exceed' : 'EXCEEDS'));
  }
  console.log('  probe: ' + sceneExtentProbe.name);
  console.log('         ' + (sceneExtentProbe.fractionOfTheWorld * 100).toFixed(2) + '% of the world -> '
    + (sceneExtentProbe.rejected ? 'the instrument can see a flood' : 'PROBE DID NOT REJECT — the small readings above are an artefact'));
}
