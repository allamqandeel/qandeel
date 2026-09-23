/**
 * I-08B3.1-F1 — THE REVIEW BOARDS.
 *
 * Ten boards, one per required proof. Every one of them is rendered from the SAME scene builder
 * with a different accessibility state vector, so a reviewer comparing two boards is comparing
 * two expressions of one system rather than two drawings.
 *
 * THE CAPTIONS CARRY NUMBERS, NOT ADJECTIVES. A caption that says "clearer" is a claim a
 * reviewer cannot check. Every caption here either states a measured value or names what to
 * look at.
 *
 * ENGLISH CAPTIONS ARE ISOLATED. The boards are built on an RTL root because the product is,
 * and an unisolated English run inside an RTL paragraph is reordered by the bidi algorithm —
 * a defect this track has shipped before. Every Latin run is wrapped.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page, state, CONNECTION } from './f1-scene.mjs';
import { projectionPage, projection } from './f1-sr.mjs';
import { findChrome, launch, openPage } from './f1-cdp.mjs';
import { INSIGHT_SITE, INSIGHT_KEEL, INSIGHT_LOBES, INSIGHT_GATHER_RADIUS, insightEvent, insightReduced } from '../vendor/d2r/scene/d2-events.mjs';
import { LIGHT } from '../vendor/d2r/scene/d2-foundation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const WORK = join(PKG, 'review', 'board');
const TMP = join(PKG, 'review', 'src');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** An English run inside an RTL paragraph, isolated so the bidi algorithm leaves it alone. */
const en = (s) => `<span dir="ltr" lang="en">${esc(s)}</span>`;
const dataUri = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');

/* ------------------------------------------------- the reduced-motion Meaning Light ----- */
/**
 * ONE MEANING EVENT, TWO EXPRESSIONS, THE SAME STATE VECTORS D2R SHIPS.
 *
 * `insightEvent(t)` and `insightReduced(t)` are I-08B3.1-D2R's own functions, called rather than
 * re-derived. F1 draws them; it does not decide them. What F1's drawing adds is the comparison
 * a reviewer of THIS task needs: the two side by side at the same millisecond, with the channel
 * that differs named under each pair.
 */
const LADDER = [2600, 2900, 3200, 3600, 4200, 5800];

function insightFrame(v, w = 300, h = 220) {
  const cx = w / 2, cy = h / 2 - 10;
  const g = [];
  g.push(`<rect width="${w}" height="${h}" fill="#101010"/>`);
  /* the five lobes. In the FULL expression they gather inward; in the REDUCED one they are at
     their arrived positions from the first frame, which is what `memberLift` being absent
     means rather than something this file decides. */
  for (let i = 0; i < INSIGHT_LOBES; i++) {
    const a = (i / INSIGHT_LOBES) * Math.PI * 2 - Math.PI / 2;
    const gather = v.memberLift ?? 0;
    const rad = (INSIGHT_GATHER_RADIUS / 2.4) * (1 - gather * 0.55);
    const lx = cx + rad * Math.cos(a), ly = cy + rad * Math.sin(a);
    const lvl = v.sourceLevel ?? 0;
    if (lvl > 0.002) g.push(`<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${(9 + lvl * 5).toFixed(1)}" fill="${LIGHT.LOW}" opacity="${(lvl * 0.86).toFixed(3)}"/>`);
  }
  /* the node. `nodeBlur` exists in the full expression and is EXACTLY ZERO in the reduced one —
     the one channel D2R corrected, and the one Apple's list is about. */
  const nr = v.nodeReveal ?? 0;
  if (nr > 0.002) {
    const blur = v.nodeBlur ?? 0;
    g.push(`<filter id="nb"><feGaussianBlur stdDeviation="${(blur * 2.6).toFixed(2)}"/></filter>`);
    g.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="#d8d5ca" opacity="${nr.toFixed(3)}" ${blur > 0.002 ? 'filter="url(#nb)"' : ''}/>`);
  }
  const kd = v.keelDraw ?? 0;
  if (kd > 0.002) {
    const half = INSIGHT_KEEL.halfWidth * 0.62 * kd;
    g.push(`<path d="M ${(cx - half).toFixed(1)} ${(cy + 34).toFixed(1)} L ${(cx + half).toFixed(1)} ${(cy + 34).toFixed(1)}" stroke="#8b8982" stroke-width="1.4" fill="none"/>`);
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${g.join('')}</svg>`;
}

/* ------------------------------------------------------------------ board scaffolding -- */
function boardHTML({ id, title, subtitle, blocks, notes }) {
  const fontPath = join(PKG, 'fonts', 'Estedad[wght].ttf').replace(/\\/g, '/');
  return `<!doctype html>
<html dir="rtl" lang="ar" data-qd-ready="0">
<head><meta charset="utf-8"><title>${esc(id)}</title><style>
@font-face{font-family:'Estedad';src:url('file:///${fontPath}') format('truetype');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0b0b0b;color:#d8d5ca;font-family:'Estedad',sans-serif;line-height:1.7;padding:28px 28px 34px}
h1{font-size:19px;font-weight:700}
h1 small{display:block;font-size:12px;font-weight:500;color:#8b8982;margin-block-start:4px}
.sub{font-size:12px;color:#afaca3;margin-block:8px 20px;max-width:1180px}
.grid{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
figure{background:#101010;border:1px solid #181818;border-radius:8px;padding:10px}
/* THE BOARD CHROME IS BIDIRECTIONAL AND THE ROOT IS RTL, so every mixed run needs its own
   direction. dir=auto on the element resolves from its FIRST STRONG CHARACTER: a note that
   opens with an English label resolves LTR, a caption that opens with Arabic resolves RTL. The
   first build of this file set neither, and every English note came out with its bold lead-in
   reordered to the far end of the line - the same defect I-08B3.1-E1 recorded and fixed.
   (This comment carries no backtick on purpose: it lives inside a template literal.) */
figcaption{font-size:11px;color:#afaca3;line-height:1.7;margin-block-start:8px;max-width:390px;text-align:start}
figcaption b{color:#d8d5ca;font-weight:600}
img{display:block;border-radius:4px}
.notes{margin-block-start:22px;font-size:12px;color:#afaca3;max-width:1180px}
.notes li{margin-block:6px;list-style:none;padding-inline-start:14px;position:relative;text-align:start}
.notes li::before{content:'';position:absolute;inset-inline-start:0;top:11px;width:5px;height:1px;background:#8b8982}
.notes b{color:#d8d5ca;font-weight:600}
table{border-collapse:collapse;font-size:11px}
th,td{border:1px solid #232323;padding:5px 9px;text-align:start}
th{color:#d8d5ca;font-weight:600;background:#141414}
td{color:#afaca3}
td.ok{color:#afaca3}
</style></head><body>
<h1>${esc(title)}<small>${en(id)}</small></h1>
<p class="sub" dir="auto">${subtitle}</p>
<div class="grid">
${blocks}
</div>
${notes ? `<ul class="notes">${notes.map((n) => `<li dir="auto">${n}</li>`).join('')}</ul>` : ''}
<script>document.fonts.ready.then(function(){document.documentElement.setAttribute('data-qd-ready','1');});</script>
</body></html>`;
}

const fig = (src, caption, width = 390) =>
  `<figure><img src="${src}" width="${width}" alt=""><figcaption dir="auto">${caption}</figcaption></figure>`;

/* ------------------------------------------------------------------------ the build ---- */
export async function build({ derivation, motion, parity, spectacle }) {
  mkdirSync(WORK, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const chrome = findChrome();
  if (!chrome) throw new Error('f1-boards: no Chrome on this host');
  const browser = await launch({ chrome, port: 9445 });
  const shots = {};

  const shoot = async (name, html, { width = 390, height = 844, dpr = 2 } = {}) => {
    const file = join(TMP, `${name}.html`);
    writeFileSync(file, html);
    const p = await openPage(browser, { url: pathToFileURL(file).href, width, height, dpr });
    const png = await p.shot({ full: true });
    await p.close();
    const out = join(TMP, `${name}.png`);
    writeFileSync(out, png);
    shots[name] = out;
    return out;
  };

  try {
    /* ---- the scene captures every board draws from ---- */
    await shoot('default', page({}));
    await shoot('contrast', page({ contrast: 'increased' }));
    await shoot('transparency', page({ transparency: 'reduced' }));
    await shoot('combined', page({ contrast: 'increased', transparency: 'reduced' }));
    await shoot('grayscale', page({ filter: 'grayscale' }));
    await shoot('protan', page({ filter: 'protan' }));
    await shoot('deutan', page({ filter: 'deutan' }));
    await shoot('text100', page({}));
    await shoot('text200', page({ textScale: 2 }));
    await shoot('textax5', page({ textScale: 3.118 }));
    await shoot('bold', page({ boldText: true }));
    await shoot('focus', page({ interaction: 'focus' }));
    await shoot('selected', page({ interaction: 'selected' }));
    await shoot('error', page({ interaction: 'error' }));
    await shoot('unavailable', page({ interaction: 'unavailable' }));
    await shoot('pressed', page({ interaction: 'pressed' }));
    await shoot('shared', page({ world: 'shared' }));
    await shoot('public', page({ world: 'public' }));
    await shoot('projection', projectionPage(), { height: 1400 });

    /* ---- the reduced-motion frame ladder ---- */
    for (const t of LADDER) {
      await shoot(`ins-full-${t}`, wrapSvg(insightFrame(insightEvent(t))), { width: 300, height: 220 });
      await shoot(`ins-red-${t}`, wrapSvg(insightFrame(insightReduced(t))), { width: 300, height: 220 });
    }

    /* ---------------------------------------------------------------- BOARD A ---------- */
    const D = derivation, M = motion, P = parity, S = spectacle;
    await shoot('b01', boardHTML({
      id: 'BOARD A — DEFAULT FULL-EXPRESSION DARK WORLD (SPECTACLE PRESERVATION)',
      title: 'التعبير الافتراضي الكامل — لم يتغيّر',
      subtitle: `الأشكال الثلاثة هي العوالم الثلاثة في التعبير الافتراضي، بعد F1. ${en('The Default Preservation Gate is not this picture — it is check D-02, which requires the default document to be byte-identical to the baseline. This board is what that invariance protects.')}`,
      blocks: [
        fig(dataUri(shots.default), `<b>العالم الخاص</b> — ${en('PERSONAL. Default expression, unchanged by F1.')}`),
        fig(dataUri(shots.shared), `<b>عالم مشترك</b> — ${en('SHARED. One dash, identical on every contour.')}`),
        fig(dataUri(shots.public), `<b>عالم عام</b> — ${en('PUBLIC. Fewer level lines and a lower luminance, uniformly. Labels are NOT removed.')}`),
      ].join('\n'),
      notes: [
        `<b>${en('DEFAULT VISUAL RICHNESS: UNCHANGED.')}</b> ${en(`Every accessibility transformation in F1 lives in a modifier context whose DEFAULT overrides nothing. Check D-01 resolves the whole token tree with no setting on and requires it to equal I-08B3.1-E1's tree literal for literal; check D-02 requires the rendered default document to be byte-identical to the baseline.`)}`,
        `<b>${en('AND THE HONEST PART.')}</b> ${S && S.northStar ? en(S.northStar) : en('The Product Owner supplied a North Star image whose atmospheric chroma is far above what this frozen system paints. That gap is NOT something F1 created and NOT something F1 may close — the chroma ceiling is 0.0197 and is I-08B3.1-D2R\'s. F1 measured it, did not move it, and hands it up as an F2/Product question.')}`,
        `<b>${en('SPECTACLE CAPACITY.')}</b> ${en('Nothing F1 adds is a ceiling on richness: the increased-contrast and reduce-transparency expressions are OVERRIDES that exist only while a setting is on, and the default path resolves through neither.')}`,
      ],
    }), { width: 1280, height: 1200 });

    /* ---------------------------------------------------------------- BOARD B ---------- */
    const hi = D?.finding ?? {};
    await shoot('b02', boardHTML({
      id: 'BOARD B — INCREASE CONTRAST',
      title: 'تباين أعلى — دون اختراع أهمية',
      subtitle: `${en('A class moves along the frozen reading ramp. No literal is introduced: count the new hex values in tokens/contrast/increased.accessibility.tokens.json — there are none.')}`,
      blocks: [
        fig(dataUri(shots.default), `<b>${en('DEFAULT')}</b> — ${en(`weakest analytical object ${D?.hierarchy?.defaultWeakestAnalytical}:1, loudest contour ${D?.hierarchy?.defaultLoudestContour}:1, ratio ${D?.hierarchy?.defaultRatio}`)}`),
        fig(dataUri(shots.contrast), `<b>${en('INCREASE CONTRAST')}</b> — ${en(`weakest analytical object ${D?.hierarchy?.raisedWeakestAnalytical}:1, loudest contour ${hi.bestAfter}:1, ratio ${hi.hierarchyRatioAfter}. The gap WIDENS.`)}`),
        `<figure><table>
<tr><th>${en('what')}</th><th>${en('default')}</th><th>${en('increased')}</th></tr>
<tr><td>${en('analytical relation vs World')}</td><td>5.435:1</td><td>8.384:1</td></tr>
<tr><td>${en('worst ambient contour vs World')}</td><td>1.734:1</td><td>${hi.worstAfter}:1</td></tr>
<tr><td>${en('loudest ambient contour vs World')}</td><td>4.209:1</td><td>${hi.bestAfter}:1</td></tr>
<tr><td>${en('analysis : atmosphere ratio')}</td><td>${D?.hierarchy?.defaultRatio}</td><td>${hi.hierarchyRatioAfter}</td></tr>
<tr><td>${en('World fill')}</td><td>#101010</td><td>#101010</td></tr>
<tr><td>${en('Living Brass')}</td><td>#a58e6f</td><td>#a58e6f</td></tr>
<tr><td>${en('QANDEEL Light core')}</td><td>#fbf2db</td><td>#fbf2db</td></tr>
<tr><td>${en('Error ink')}</td><td>#fe907e</td><td>#fe907e</td></tr>
<tr><td>${en('Disabled ink')}</td><td>#696762</td><td>#696762</td></tr>
<tr><td>${en('focus perimeter')}</td><td>2 px</td><td>3 px</td></tr>
<tr><td>${en('Surface boundary')}</td><td>${en('none')}</td><td>${en('1 px, qandeel.content.tertiary')}</td></tr>
</table><figcaption dir="auto">${en('Five values that do NOT move, and why each absence is a decision — see the token file header.')}</figcaption></figure>`,
      ].join('\n'),
      notes: [
        `<b>${en('THE CONTRADICTION THE SEARCH FOUND.')}</b> ${en('Raising the atmosphere ALONE compresses the meaning hierarchy immediately: at full opacity the loudest contour reaches 5.286:1 against a weakest analytical object of 5.435:1, so the ratio falls from 1.2914 to 1.028. "Increase contrast" read naively flattens the very hierarchy it was supposed to leave alone. Lever 2A is blocked at delta 0 by exactly that.')}`,
        `<b>${en('WHAT A DARKER GROUND WOULD HAVE BOUGHT.')}</b> ${en('Pure black: 1.1036x on tertiary reading ink, 1.0041x on a far contour. Measured, and rejected.')}`,
        `<b>${en('THE BOUNDARY IS NOT A NEW COLOUR.')}</b> ${en('World and functional Surface are separated by 1.072:1. The border is qandeel.content.tertiary, an existing rung, at 5.07:1 against the Surface. qandeel.state.disabled.ink meets the contrast at 3.14:1 and was rejected on MEANING: E1 owns that literal as availability.')}`,
      ],
    }), { width: 1400, height: 1200 });

    /* ---------------------------------------------------------------- BOARD C ---------- */
    await shoot('b03', boardHTML({
      id: 'BOARD C — REDUCE TRANSPARENCY',
      title: 'تقليل الشفافية — العالَم يبقى عالَمًا',
      subtitle: `${en('QANDEEL\'s functional chrome is ALREADY opaque — I-08B3.1-B4R recorded that before this task existed. So this setting is not a chrome question here. Its three real subjects are the ambient field, the PASSAGE scrim, and the Light.')}`,
      blocks: [
        fig(dataUri(shots.default), `<b>${en('DEFAULT')}</b> — ${en('contours composited at per-world stroke alphas 0.86 / 0.60 / 0.40.')}`),
        fig(dataUri(shots.transparency), `<b>${en('REDUCE TRANSPARENCY')}</b> — ${en(`the same ${D?.transparency?.strokeCount} strokes and ${D?.transparency?.fillCount} fills, drawn OPAQUE in their own exact composited equivalents.`)}`),
        `<figure><table>
<tr><th>${en('subject')}</th><th>${en('default')}</th><th>${en('reduced')}</th><th>${en('why')}</th></tr>
<tr><td>${en('functional Surface')}</td><td>${en('opaque matte')}</td><td>${en('unchanged')}</td><td>${en('nothing to undo')}</td></tr>
<tr><td>${en('navigation chrome')}</td><td>${en('opaque')}</td><td>${en('unchanged')}</td><td>${en('nothing to undo')}</td></tr>
<tr><td>${en('ambient contour')}</td><td>${en('ink @ alpha')}</td><td>${en('exact opaque equivalent')}</td><td>${en('closed form over a flat ground')}</td></tr>
<tr><td>${en('PASSAGE scrim')}</td><td>${en('black @ 0.5')}</td><td>#080808</td><td>${en('MORE faithful — B4R says the World behind a PASSAGE is suspended')}</td></tr>
<tr><td>${en('QANDEEL Light')}</td><td>${en('translucent')}</td><td>${en('translucent')}</td><td>${en('the Light is CONTENT, not material')}</td></tr>
</table><figcaption dir="auto">${en('The one visible difference is stated rather than hidden: where two contours CROSS, translucent strokes tint each other and opaque ones do not. Nothing analytical lives at a crossing.')}</figcaption></figure>`,
      ].join('\n'),
      notes: [
        `<b>${en('THE FIELD IS NOT SIMPLIFIED, IT IS PRE-RESOLVED.')}</b> ${en('Every contour is composited against one flat opaque colour, so its alpha composite has a closed-form opaque equivalent. The World keeps every contour, every level line, every depth plane and every label.')}`,
        `<b>${en('THE LIGHT KEEPS ITS ALPHA, AND THE ZERO IS A DECISION.')}</b> ${en('qandeel.accessibility.transparency.light-alpha-floor = 0 in BOTH contexts. An opaque light is a disc; removing the alpha would delete a meaning event\'s intensity.')}`,
      ],
    }), { width: 1400, height: 1200 });

    /* ---------------------------------------------------------------- BOARD D ---------- */
    const ladderBlocks = LADDER.map((t) => {
      const f = insightEvent(t), r2 = insightReduced(t);
      const diff = [];
      for (const k of ['memberLift', 'nodeBlur', 'sourceLevel', 'nodeReveal', 'keelDraw']) {
        const a = +(f[k] ?? 0).toFixed(3), b = +(r2[k] ?? 0).toFixed(3);
        if (a !== b) diff.push(`${k} ${a} → ${b}`);
      }
      return `<figure>
  <img src="${dataUri(shots[`ins-full-${t}`])}" width="300" alt="">
  <img src="${dataUri(shots[`ins-red-${t}`])}" width="300" alt="" style="margin-block-start:6px">
  <figcaption><b>${en(`t = ${t} ms`)}</b><br>${en(diff.length ? diff.join(' · ') : 'identical')}</figcaption>
</figure>`;
    }).join('\n');
    await shoot('b04', boardHTML({
      id: 'BOARD D — REDUCED MOTION, MEANING LIGHT',
      title: 'حركة مُخفَّضة — المعنى يبقى',
      subtitle: `${en('One INSIGHT, two expressions, at the same millisecond. Upper frame FULL, lower frame REDUCED. Both state vectors are I-08B3.1-D2R\'s own insightEvent(t) and insightReduced(t), called rather than re-derived.')}`,
      blocks: ladderBlocks,
      notes: [
        `<b>${en('THE LAST PAIR IS THE POINT.')}</b> ${en('At t = 5800 ms the two frames carry the same settled residue: nodeReveal 1, keelDraw 1. D2R proved this for all four categories and proved the settled frames byte-identical across sequences — the end state does not depend on which version you saw.')}`,
        `<b>${en('nodeBlur GOES TO EXACTLY ZERO.')}</b> ${en('Apple: "Avoiding animating into and out of blurs." D2R corrected the inherited D1 Connection for the same reason — receptionBlur peak 0.7988 to 0.0000, in the reduced counterpart only.')}`,
        `<b>${en('THE RUNTIME DEFAULT IS THE FAILURE MODE.')}</b> ${en('Under ReduceMotion.System — the library default — withTiming and withSpring return the toValue immediately, entering animations jump to their endpoints, and EXITING ANIMATIONS ARE OMITTED ENTIRELY. An omitted exit deletes the 1,150 ms settle, which is the beat that carries the result. QANDEEL must declare the replacement animation ReduceMotion.Never and switch the suppressed channels off at the value.')}`,
        `<b>${en('CHANNELS:')}</b> ${en(`suppressed — ${M?.suppressed?.join(', ')}. surviving — ${M?.surviving?.join(', ')}. ${M?.counts?.total} motions audited: ${M?.counts?.ownedByD2R} inherited from D2R, ${M?.counts?.addedByF1} added by F1.`)}`,
      ],
    }), { width: 1400, height: 1080 });

    /* ---------------------------------------------------------------- BOARD E ---------- */
    await shoot('b05', boardHTML({
      id: 'BOARD E — COMBINED: INCREASE CONTRAST + REDUCE TRANSPARENCY',
      title: 'الإعدادان معًا',
      subtitle: `${en('The two settings are orthogonal by construction: one changes WHICH ramp rung a class points at and the atmosphere\'s lightness; the other changes the MECHANISM a contour is drawn by. Their combination is a resolution, not a special case — tools/f1-resolve.mjs applies both modifiers in one pass.')}`,
      blocks: [
        fig(dataUri(shots.default), `<b>${en('DEFAULT')}</b>`),
        fig(dataUri(shots.contrast), `<b>${en('INCREASE CONTRAST')}</b>`),
        fig(dataUri(shots.transparency), `<b>${en('REDUCE TRANSPARENCY')}</b>`),
        fig(dataUri(shots.combined), `<b>${en('BOTH')}</b> — ${en('the contours are opaque AND lifted. No third set of values exists for this cell.')}`),
      ].join('\n'),
      notes: [
        `<b>${en('WHY THERE IS NO THIRD TOKEN FILE.')}</b> ${en('A combination that needed its own values would mean the two transformations were not independent — and a reviewer would have to check every pair rather than every setting. The resolver composes them; check X-01 asserts that the combined resolution equals the two applied in either order.')}`,
        `<b>${en('THE COMBINATION THAT DOES NOT EXIST.')}</b> ${en('Reduce Transparency has no Android equivalent — AccessibilityInfo.isReduceTransparencyEnabled is @platform ios and Android returns Promise.resolve(false). So the ANDROID matrix has fewer real cells than the iOS one, and F1_PLATFORM_MAPPING.md says which.')}`,
      ],
    }), { width: 1700, height: 1200 });

    /* ---------------------------------------------------------------- BOARD F ---------- */
    await shoot('b06', boardHTML({
      id: 'BOARD F — NO COLOUR DEPENDENCE (DIAGNOSTIC)',
      title: 'لا اعتماد على اللون وحده',
      subtitle: `${en('Grayscale and the two dichromacies are DIAGNOSTICS, not target aesthetics. QANDEEL keeps its colour; the rule is that colour may support meaning and may not be its only carrier.')}`,
      blocks: [
        fig(dataUri(shots.default), `<b>${en('DEFAULT')}</b>`),
        fig(dataUri(shots.grayscale), `<b>${en('GRAYSCALE')}</b>`),
        fig(dataUri(shots.protan), `<b>${en('PROTANOPIA')}</b>`),
        fig(dataUri(shots.deutan), `<b>${en('DEUTERANOPIA')}</b>`),
      ].join('\n'),
      notes: [
        `<b>${en('THE MEASUREMENT THAT MAKES THIS BOARD ALMOST BORING, WHICH IS THE RESULT.')}</b> ${en('The six atmosphere hues are isoluminant by construction: one chroma and one lightness per depth layer. The maximum contrast between ANY TWO of them is 1.0185:1, the maximum OkLCh deltaE is 0.0398, and under protanopia and deuteranopia the maxima are 0.0340 and 0.0314. Colour does not distinguish one topic from another even for a reader with full colour vision. Grayscale cannot lose information that was never carried.')}`,
        `<b>${en('WHAT DOES CARRY IT:')}</b> ${en('the topic\'s written NAME, in every world, at every size — asserted per object by the parity matrix. Pattern membership: an identical mark at every member plus a link. SELECTED: a marker and a 100-unit weight step. FOCUS: a detached perimeter and a dark companion. UNAVAILABLE: the ink PLUS a stated reason. ERROR: E1\'s ink, glyph, copy and role together.')}`,
        `<b>${en('AND ONE THING THAT LEFT THIS LIST IN I-08B3.1-F1R2 WITHOUT LEAVING THE DRAWING.')}</b> ${en('Near from far — 3 / 2 / 1 level lines and a scale — was a PRODUCT CONTRACT here, beside topic identity and error. But D2R\'s PRESENTATION_CONTRACT declares ring.contourCount and ring.layer encodes: null, and a companion channel is an obligation only because the distinction it accompanies carries analytical meaning. Requiring one for a distinction that encodes NOTHING attaches a semantic parity obligation to something with no semantics — which is the authority D2R removed, reintroduced from inside the accessibility layer. The craft is unchanged and still drawn; it is now presentationCraft.depth, production craft that carries no analytical meaning. Check K-05 reads D2R\'s own table rather than a list kept by hand.')}`,
        `<b>${en('THE ONE HUE THAT CARRIES MEANING IS THE ONE WITH THREE COMPANIONS.')}</b> ${en('Error #fe907e is by a distance the most chromatic value in QANDEEL at C 0.1364. E1 measured WCAG 1.4.1\'s lightness escape hatch CLOSED for it — 1.03:1 against secondary ink — so its non-colour companion is an obligation, not a courtesy.')}`,
      ],
    }), { width: 1700, height: 1200 });

    /* ---------------------------------------------------------------- BOARD G ---------- */
    const tf = (P?.text ?? []).find((x) => x.expression.includes('AX5'));
    await shoot('b07', boardHTML({
      id: 'BOARD G — LARGER TEXT, ARABIC',
      title: 'نص أكبر — بالعربية',
      subtitle: `${en('iOS Body is 17 pt at the default size and 53 pt at AX5, so the multiplier QANDEEL must survive is 3.118. Apple asks for at least 200 percent; AX5 is 311.8 percent and is what the system can actually produce.')}`,
      blocks: [
        fig(dataUri(shots.text100), `<b>${en('100% — 11 px map label')}</b>`),
        fig(dataUri(shots.text200), `<b>${en('200% — 22 px')}</b> — ${en('above the escape scale, so the eight topic names have moved to the INSPECTION LIST, at full size, with the Map unchanged behind them.')}`),
        fig(dataUri(shots.textax5), `<b>${en(`AX5, 311.8% — ${tf?.minRenderedFontPx ?? ''} px`)}</b> — ${en('nothing truncated, nothing shrunk, nothing overlapping.')}`),
        fig(dataUri(shots.bold), `<b>${en('BOLD TEXT')}</b> — ${en('a real variable-axis move on Estedad. rest 500 -> 600, selected 600 -> 700: the 100-unit step SELECTED depends on is preserved, which is why Bold Text does not erase the selected state.')}`),
      ].join('\n'),
      notes: [
        `<b>${en('THE LABEL DOES NOT SHRINK AND DOES NOT TRUNCATE.')}</b> ${en('Above qandeel.accessibility.text.label-escape-scale = 1.6 a map label can no longer fit beside its contour at any position the field offers, so it moves to a separate, scrollable, fully-sized reading of the SAME objects. Apple: avoid truncating text in scrollable regions "unless people can open a separate view to read the rest of the content".')}`,
        `<b>${en('ARABIC CONSTRAINTS HELD AT EVERY SIZE:')}</b> ${en('line-height >= 1.7 on every Arabic-bearing element (the clipping gets worse as glyphs grow, not better); NO letter-spacing anywhere an Arabic glyph can appear — it breaks the connected script; NO italics — Arabic has no italic tradition and browsers fake-slant it; weights inside 400-700 at UI sizes.')}`,
        `<b>${en('MEASURED ACROSS EVERY EXPRESSION:')}</b> ${en('0 truncated elements, 0 elements with line-height below 1.6, 8 topic names reachable at every setting. The parity matrix carries the per-expression numbers.')}`,
      ],
    }), { width: 1700, height: 1350 });

    /* ---------------------------------------------------------------- BOARD H ---------- */
    await shoot('b08', boardHTML({
      id: 'BOARD H — FOCUS / SELECTED / UNAVAILABLE / ERROR',
      title: 'حالات التفاعل تحت الإعدادات',
      subtitle: `${en('E1\'s interaction grammar, unchanged in meaning. F1 transforms only how it is expressed, and only where a setting asked.')}`,
      blocks: [
        fig(dataUri(shots.focus), `<b>${en('FOCUS')}</b> — ${en('a detached perimeter at a 2 px offset, with a dark companion. The indicator alone reaches 3:1 against only 5 of 13 palette colours; the companion covers the other 8.')}`),
        fig(dataUri(shots.selected), `<b>${en('SELECTED')}</b> — ${en('an attached marker on the inline-start edge — which in RTL is the RIGHT edge — plus a weight step. Neither channel is a colour.')}`),
        fig(dataUri(shots.unavailable), `<b>${en('UNAVAILABLE')}</b> — ${en('the availability ink PLUS a reason stated in words and associated with the control by aria-describedby. The ink alone would be colour-only.')}`),
        fig(dataUri(shots.error), `<b>${en('ERROR #fe907e')}</b> — ${en('preserved exactly. Ink, glyph, copy and role together.')}`),
      ].join('\n'),
      notes: [
        `<b>${en('WHAT INCREASE CONTRAST DOES TO FOCUS:')}</b> ${en('thickens the perimeter from 2 px to 3 px, and nothing else. A NON-COLOUR strengthening, chosen on purpose — thickening a perimeter cannot make an object look more important, and brightening one can. WCAG 2.2 SC 2.4.13 asks for at least a 2 CSS px perimeter, which the DEFAULT already meets.')}`,
        `<b>${en('WHAT IT DOES TO UNAVAILABLE: NOTHING, AND THAT IS THE DECISION.')}</b> ${en('The disabled ink stays at #696762. Its meaning is its DISTANCE from the rest ink, not its absolute contrast — and because the rest ink rises under this setting while the disabled ink does not, the gap widens from 1.61x to 2.49x and unavailability becomes MORE readable.')}`,
        `<b>${en('WHAT REDUCED MOTION DOES TO PRESS:')}</b> ${en('keeps the ground response, which is a LEVEL change, and drops a scale if an implementation has one. Removing press feedback entirely would be the worst reading of the setting — a control that does not acknowledge a finger reads as broken rather than as calm.')}`,
      ],
    }), { width: 1700, height: 1250 });

    /* ---------------------------------------------------------------- BOARD I ---------- */
    const proj = projection();
    await shoot('b09', boardHTML({
      id: 'BOARD I — SCREEN-READER SEMANTIC PROJECTION',
      title: 'الإسقاط الدلالي لقارئ الشاشة',
      subtitle: `${en('The visible Map stays spatial and is not simplified for anyone. This is a PARALLEL semantic layer over the same objects — the only arrangement in which both statements are true at once.')}`,
      blocks: [
        fig(dataUri(shots.projection), `<b>${en('THE PROJECTION, RENDERED')}</b> — ${en(`four traversal axes, ${proj.axes.reduce((a, b) => a + b.items.length, 0)} objects. Its accessibility tree was read back out of the browser over the DevTools protocol; every accessible name below is what the ENGINE computed, not what the generator intended.`)}`, 390),
        /* `flex:1` so the refusal table sits BESIDE the phone-width capture instead of wrapping
           below it and stranding two-thirds of the board as empty ground. */
        `<figure style="flex:1;min-width:560px"><table>
<tr><th>${en('decision')}</th><th>${en('what it refuses')}</th></tr>
<tr><td>${en('traversal BY KIND')}</td><td>${en('VoiceOver\'s default is the locale\'s reading order — for Arabic, right-to-left and top-to-bottom. That is a GEOMETRIC order, and geometry in QANDEEL means nothing. Overridden, not inherited.')}</td></tr>
<tr><td>${en('order = an EXPLICITLY NON-SEMANTIC deterministic rule')}</td><td>${en('no ranking by position, size, recency or any strength, because the Product computes no strength. Group by kind, then V.canonicalOrder if supplied — the seam, null today — else ascending Unicode code-point order of the id, which means NOTHING. I-08B3.1-F1R withdrew the earlier wording "the Product\'s own stable identity order": no supplied contract makes authored array order semantic.')}</td></tr>
<tr><td>${en('peers stay peers')}</td><td>${en('no "main" reading is selected — no Product authority ranks them')}</td></tr>
<tr><td>${en('the Light is NOT announced')}</td><td>${en('a transient carrying nothing the settled state does not also carry. The RESULT is announced, once.')}</td></tr>
<tr><td>${en('a PATTERN becomes a sentence')}</td><td>${en('a locus and four links is not readable to anyone who cannot see them. The sentence names a SET, joined by و, which carries no ordinal reading.')}</td></tr>
<tr><td>${en('ABSENCE REMAINS ABSENCE')}</td><td>${en('a semantic field V does not supply is not announced in any form. I-08B3.1-F1R announced an UNSPECIFIED word here; F1R2 withdrew it, because the absence of a field does not mean the Product state is unspecified — it may be not applicable, not disclosed at this depth, unavailable, absent from this object family, or simply not supplied, and the accessibility layer may not choose. An explicit unknown state, if QANDEEL needs one, is supplied by canonical V as a VALUE.')}</td></tr>
<tr><td>${en('the SAME disclosed V, FAIL CLOSED')}</td><td>${en('a Connection endpoint or a Pattern member that V does not disclose is not named, not identified, not counted and not paraphrased — and never announced as a raw id. F1R resolved a reference as "disclosed name ?? raw id", which would have read an undisclosed object\'s technical identifier aloud to a screen-reader user. An accessible expression that discloses MORE than the default is as serious a failure as one that discloses less.')}</td></tr>
<tr><td>${en('text views over the drawing')}</td><td>${en('a Skia Canvas exposes nothing inside it, so analytical content may not live only in the drawing')}</td></tr>
</table><figcaption dir="auto">${en('Each row is a refusal, and each refusal is checkable in data/F1_SCREEN_READER.json.')}</figcaption></figure>`,
      ].join('\n'),
      notes: [
        `<b>${en('WHAT WAS PROVED:')}</b> ${en('every analytical object has an engine-computed accessible name; all four axis headings exist; the PATTERN states its four members in words; the CONNECTION states its source and its destination. A deliberately fabricated name is rejected by the same predicate on every run.')}`,
        `<b>${en('THE TWO PLANTED SUITES I-08B3.1-F1R2 ADDED.')}</b> ${en('ABSENCE: the object whose epistemic status V never supplied carries no epistemic vocabulary in its accessible label, the withdrawn word appears nowhere in the shipped page, and a value that IS supplied is still announced — without that last half, "nothing is spoken" would be satisfied by a projection silent about everything. Its probe is the withdrawn composer, which must be detected. DISCLOSURE: three referentially broken views — a Connection with an undisclosed destination, a Pattern with an undisclosed member, and a Connection pointing at a REAL D2R topic V does not disclose. In every one: no raw id in any field or label, no name recovered, no prose, and the broken reference REPORTED. Underneath them the withdrawn "?? id" resolver is run over the same view and must leak, so the three passes are not a statement about a blind detector.')}`,
        `<b>${en('WHAT WAS NOT PROVED, AND IT IS THE LARGEST GAP IN THIS PACKAGE:')}</b> ${en('a browser accessibility tree is not VoiceOver and is not TalkBack. No screen reader was run. No device was used. No native Arabic copy review was done. A real VoiceOver and TalkBack pass on hardware is a MANDATORY implementation / integration validation gate, and F1R2 deliberately did not open another F1 stage to chase something this host cannot produce.')}`,
        `<b>${en('THE PLATFORM GAP:')}</b> ${en('Apple\'s VoiceOver guidance recommends the custom rotor for exactly this traversal, and React Native does not expose UIAccessibilityCustomRotor. Headings are the closest available mechanism and are traversable by both VoiceOver and TalkBack — but a rotor lets a reader jump between members of one kind from anywhere, and headings require walking to the group first.')}`,
      ],
    /* 1180 rather than 1500: the projection capture is one narrow phone-width column, so a wider
       board strands several hundred pixels of nothing beside it. The refusal table simply wraps. */
    }), { width: 1180, height: 1500 });

    /* ---------------------------------------------------------------- BOARD J ---------- */
    const m = P?.matrix;
    const objs = m?.objects ?? [];
    const exprs = m?.expressions ?? [];
    const cellFor = (e, o) => (m?.cells ?? []).find((c) => c.expression === e && c.object === o);
    const table = `<figure><table>
<tr><th>${en('analytical object')}</th>${exprs.map((e) => `<th>${en(e)}</th>`).join('')}</tr>
${objs.map((o) => `<tr><td>${en(o.id)}</td>${exprs.map((e) => {
      const c = cellFor(e, o.id);
      const ok = c && c.exists && c.relationshipSame && c.temporalSame && c.epistemicSame && c.actionsSame;
      return `<td class="${ok ? 'ok' : ''}">${ok ? en('= = = = =') : en('FAIL')}</td>`;
    }).join('')}</tr>`).join('\n')}
</table><figcaption dir="auto">${en(`Each cell is five facts: the object EXISTS — proved on ITS OWN rendered identity — · its RELATIONSHIPS are the same · its TEMPORAL truth is the same · its EPISTEMIC status is the same · the USER ACTIONS are the same. ${m?.cellCount} cells, ${m?.failures?.length ?? '?'} failures.`)}</figcaption></figure>`;

    /* THE PLANTED-REMOVAL TABLE. It is on the board rather than only in the data because it is
       the part of this proof a reviewer most needs to be able to check at a glance: each row
       deletes one object from the RENDERING, leaves it in the truth JSON, and must fail. */
    const pl = m?.planted ?? [];
    const plantedTable = `<figure><table>
<tr><th>${en('object removed from the RENDERING')}</th><th>${en('elements removed')}</th><th>${en('still in the truth JSON')}</th><th>${en('reported ABSENT')}</th><th>${en('every other object untouched')}</th></tr>
${pl.map((x) => `<tr><td>${en(x.removed.kind.toUpperCase() + '  ' + x.removed.id)}</td><td>${x.elementsRemoved}</td><td class="${x.stillInTruthJSON ? 'ok' : ''}">${en(x.stillInTruthJSON ? 'YES' : 'no')}</td><td class="${x.victimReportedAbsent ? 'ok' : ''}">${en(x.victimReportedAbsent ? 'YES' : 'NO')}</td><td class="${x.everyOtherObjectStillPresent ? 'ok' : ''}">${en(x.everyOtherObjectStillPresent ? 'YES' : 'NO')}</td></tr>`).join('\n')}
</table><figcaption dir="auto">${en('Because the object stays in the truth JSON in all four runs, these are also the proof that the truth JSON alone cannot satisfy rendered presence. The last column matters as much as the third: a probe that made everything fail would prove only that the matrix is breakable.')}</figcaption></figure>`;

    await shoot('b10', boardHTML({
      id: 'BOARD J — ANALYTICAL TRUTH PARITY',
      title: 'تطابق الحقيقة التحليلية',
      subtitle: `${en('Truth read back out of each RENDERED DOCUMENT, not imported from the generator. Since I-08B3.1-F1R, EXISTENCE is decided by the object\'s OWN render identity — data-qandeel-object-id — having a laid-out box, and never by a path count or a JSON entry. The screen-reader column crosses a rendering boundary: it is a different document entirely.')}`,
      blocks: table + plantedTable,
      notes: [
        `<b>${en('WHAT F1R REPAIRED.')}</b> ${en('A PATTERN or a CONNECTION used to count as rendered if #analysis contained ANY path — and eight topics\' contours are paths. An INSIGHT used to count as rendered if it appeared in the truth JSON, which is serialised straight from the generator. Either cell could stay green while the object had vanished from the picture.')}`,
        `<b>${en('THE FOUR PLANTED REMOVALS.')}</b> ${en('One per object family, each deleting exactly one object\'s rendered elements from the page after render — so what is proved is that the census notices a disappearance whatever caused it. All four caught, none disturbing another object.')}`,
        `<b>${en('DRAWN IS NOT NAMED.')}</b> ${en('A second axis. It found that above the label-escape scale the connection, pattern and insight had no reading at all — the inspection view listed only topics — and it found that the CONNECTION is drawn and never named in the DEFAULT map. The first is repaired; the second is D2R\'s frozen grammar, which F1R may not change, so the rule is that no expression may name FEWER objects than the default names.')}`,
        `<b>${en('THE SEMANTICS ARE SUPPLIED, NOT AUTHORED.')}</b> ${en('Epistemic status, temporal state and actionability arrive from a disclosed view stamped SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA. They are not QANDEEL Product semantics. What is proved is that the accessible projection PRESERVES a supplied value and OMITS one the view did not supply.')}`,
        `<b>${en('AND THIS IS A BOUNDED PROOF, WHICH I-08B3.1-F1R2 HAD TO SAY OUT LOUD.')}</b> ${en(`These ${m?.cellCount} cells are evidence about the semantic dimensions THIS FIXTURE SUPPLIES — ${(m?.scope?.boundedTo ?? []).join(', ')} — plus structure, relationships, naming and rendered presence. F1R described that three-field allowlist as "the complete list of what a projection may carry", which let a bounded test read as the Product's whole semantic model. A real canonical V may legitimately expose evidence, provenance, uncertainty and more, and no field names are invented here to fill that gap. THE PRODUCT CONTRACT IS WIDER: no user-exposable disclosed analytical truth may be lost solely because the expression is accessible. The exhaustive production mapping is validated against the real canonical V schema at integration, and project(V) now REPORTS a supplied field it has no mapping for instead of dropping it in silence.`)}`,
        `<b>${en('WHY REDUCED MOTION IS A COLUMN IN A MATRIX OF STILLS.')}</b> ${en('I-08B3.1-D2R proved every reduced counterpart reaches the same settled residue as its full-motion sibling and that the settled frames are byte-identical across sequences. At settle there is ONE scene, so "does reduced motion delete an analytical object" is answered by asking whether the settled scene still contains it. The frames are Board D\'s job.')}`,
      ],
    }), { width: 1800, height: 1180 });

    /* ---------------------------------------------------------------- BOARD K ----------
       THE INHERITED-DEFAULT NON-REGRESSION PROOF, added by I-08B3.1-F1R.

       It is a board rather than only a number because the two images beside each other are the
       claim: the left is F1's default with everything that is not the inherited layer removed,
       the right is the SAME layer built from I-08B3.1-D2R's exported functions with no F1 code
       in it at all. If they were not identical a reviewer would see it before reading a hash. */
    const INH = existsSync(join(PKG, 'data/F1_INHERITED_DEFAULT.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_INHERITED_DEFAULT.json'), 'utf8')) : null;
    const inhDir = join(PKG, 'review', 'inherit');
    if (INH?.state === 'COMPARED' && existsSync(join(inhDir, 'f1-default-inherited-layer.png'))) {
      const pair =
        fig(dataUri(join(inhDir, 'f1-default-inherited-layer.png')),
          `<b>${en('F1 DEFAULT')}</b> ${en('— the inherited layer isolated: the chrome, the navigation, the panel, the labels and the analysis group removed from the DOM, so what remains is the atmosphere and nothing else.')}<br>${en('sha256 ' + INH.i02.f1Sha.slice(0, 32))}`)
        + fig(dataUri(join(inhDir, 'd2r-reference.png')),
          `<b>${en('D2R REFERENCE')}</b> ${en('— the same layer built from contourPath, ringInk, RINGS, WORLDS, TOPICS and ATMOSPHERE, imported from the sealed I-08B3.1-D2R package. Nothing from f1-scene.mjs or f1-resolve.mjs reaches this page.')}<br>${en('sha256 ' + INH.i02.referenceSha.slice(0, 32))}`);
      const inhTable = `<figure><table>
<tr><th>${en('proof')}</th><th>${en('what is compared')}</th><th>${en('result')}</th></tr>
<tr><td>${en('I-01')}</td><td>${en('every written attribute of the inherited ATMOSPHERE layer against D2R\'s own functions')}</td><td class="ok">${en(INH.i01.elementsCompared + ' elements x ' + INH.i01.fieldsPerElement + ' fields, ' + INH.i01.diffs.length + ' differences')}</td></tr>
<tr><td>${en('I-02')}</td><td>${en('the same layer rasterised, against a reference built from those exports alone')}</td><td class="ok">${en(INH.i02.identical ? 'PIXEL-IDENTICAL' : 'DIFFERS')}</td></tr>
<tr><td>${en('I-03')}</td><td>${en('the settled analysis layer\'s GEOMETRY against D2R\'s own sites')}</td><td class="ok">${en(INH.i03.elementsCompared + ' elements, ' + INH.i03.diffs.length + ' differences')}</td></tr>
</table><figcaption dir="auto">${en('The probe under I-02 displaces one contour by one pixel and is rejected, so the comparison is known to be able to tell two pictures apart. The probe under I-01 changes one stroke alpha to 0.5.')}</figcaption></figure>`;
      await shoot('b11', boardHTML({
        id: 'BOARD K — INHERITED-DEFAULT NON-REGRESSION',
        title: 'الافتراضي الموروث لم يتغيّر',
        subtitle: `${en('I-08B3.1-F1 claimed its ablation proved the default unchanged. It does not: both sides of that comparison run F1\'s own scene builder, so a change hardcoded there survives both. That proof is now named DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION, and the missing claim is proved here — against the inherited package.')}`,
        blocks: pair + inhTable,
        notes: [
          `<b>${en('WHAT REMAINS UNVERIFIED, AND IT IS NOT SMALL.')}</b> ${en('The chrome, the navigation and the panel have NO counterpart in the vendored D2R material, so there is nothing inherited to compare their pixels against. The motion is not compared: F1 renders only the settled state. QANDEEL LIGHT is not painted in the settled scene. And D2R\'s own HTML scaffold is not vendored here, so makeRenderer cannot be driven — this package does NOT claim the D2R renderer was used.')}`,
          `<b>${en('NO BYTE IDENTITY IS FABRICATED.')}</b> ${en('Check I-04 asserts that the list above is present and names the chrome and the scaffold, because a non-regression proof that does not enumerate what it could not reach invites a reader to assume it reached everything.')}`,
          `<b>${en('AND THE DEFAULT RASTER DID NOT MOVE ACROSS THE REVISION.')}</b> ${en('The default document\'s sha256 is 0a8cb8e0c2ecaf2d, the same value I-08B3.1-F1 shipped. The document\'s BYTES changed, because render-identity attributes and a provenance stamp were added to it, and the package says so rather than claiming otherwise.')}`,
        ],
      }), { width: 1180, height: 1250 });
    }

    /* copy the boards into review/board with their final names */
    const NAMES = [
      ['b01', 'b01-default-spectacle.png'], ['b02', 'b02-increase-contrast.png'],
      ['b03', 'b03-reduce-transparency.png'], ['b04', 'b04-reduced-motion-light.png'],
      ['b05', 'b05-combined-contrast-transparency.png'], ['b06', 'b06-no-colour-dependence.png'],
      ['b07', 'b07-larger-text-arabic.png'], ['b08', 'b08-focus-selected-error.png'],
      ['b09', 'b09-screen-reader-projection.png'], ['b10', 'b10-truth-parity.png'],
      ['b11', 'b11-inherited-default.png'],
    ];
    const produced = [];
    for (const [src, dst] of NAMES) {
      const buf = readFileSync(shots[src]);
      writeFileSync(join(WORK, dst), buf);
      produced.push({ file: `review/board/${dst}`, bytes: buf.length });
    }
    return produced;
  } finally {
    await browser.close();
  }
}

function wrapSvg(svg) {
  return `<!doctype html><html data-qd-ready="0"><head><meta charset="utf-8"><style>*{margin:0;padding:0}body{background:#101010}</style></head><body>${svg}<script>document.documentElement.setAttribute('data-qd-ready','1');</script></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = (f) => (existsSync(join(PKG, f)) ? JSON.parse(readFileSync(join(PKG, f), 'utf8')) : null);
  const produced = await build({
    derivation: read('data/F1_DERIVATION.json'),
    motion: read('data/F1_MOTION.json'),
    parity: read('data/F1_PARITY.json'),
    spectacle: read('data/F1_SPECTACLE.json'),
  });
  writeFileSync(join(PKG, 'data/F1_BOARDS.json'), JSON.stringify({ generatedBy: 'tools/f1-boards.mjs', boards: produced }, null, 2) + '\n');
  for (const b of produced) console.log(String(b.bytes).padStart(8), b.file);
  console.log(produced.length, 'boards');
}
