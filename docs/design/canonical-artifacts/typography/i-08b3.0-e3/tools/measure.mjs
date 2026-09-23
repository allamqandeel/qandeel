/**
 * I-08B3.0-E3 - rendered-text measurement in the real engine.
 *
 * Nothing in the report is quoted from a specimen page or a font's documentation. Every
 * number here comes from text actually shaped and laid out by Chrome with Estedad v8.5
 * loaded as a base64 face, then read back out of the DOM.
 *
 * Emits docs/MEASUREMENTS_rendered-text.json.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dumpDom } from './render.mjs';
import { faceCSS, SYS, WORK, PKG, S } from './ui.mjs';
import { scaleRole } from './scale.mjs';

/** Pre-compute the scaled role values in Node so the page measures, and never derives. */
function scaledAll() {
  const o = {};
  for (const sc of SYS.scales) {
    o[sc] = { mul: {}, sp: {} };
    for (const model of ['mul', 'sp']) {
      for (const role of SYS.roles) o[sc][model][role.key] = scaleRole(role, sc / 100, model);
    }
  }
  return o;
}

const probeHTML = () => `<!DOCTYPE html>
<html dir="rtl" lang="ar-EG"><head><meta charset="utf-8"><style>
${faceCSS()}
body{margin:0;background:#000;color:#fff;font-family:"QP-Estedad";}
#out{font-family:monospace;white-space:pre;font-size:10px;}
.stage{position:absolute;visibility:hidden;left:-99999px;top:0;}
</style></head><body>
<!--
  This element is load-bearing, not decoration. Chrome only activates a @font-face when
  something in the PARSED document already uses the family: document.fonts.ready resolves
  and document.fonts.check() returns true even when the face was never actually fetched,
  so an element created later and measured immediately reports FALLBACK metrics. Keeping a
  static user of every weight in the initial markup, and awaiting fonts.load() explicitly
  below, is what makes the measurements be about Estedad.
-->
<div class="stage" id="warm">
  <span style="font:400 100px 'QP-Estedad'">اللي بيتكرر هنا Confidence</span>
  <span style="font:500 100px 'QP-Estedad'">اللي بيتكرر هنا Confidence</span>
  <span style="font:600 100px 'QP-Estedad'">اللي بيتكرر هنا Confidence</span>
</div>
<div class="stage" id="stage"></div>
<pre id="out">PENDING</pre>
<script>
const SYS = ${JSON.stringify(SYS)};
const SCALED = ${JSON.stringify(scaledAll())};
const out = document.getElementById('out');
const stage = document.getElementById('stage');
function fail(e){ out.textContent = '@@ERR@@' + (e && e.stack ? e.stack : String(e)); }
addEventListener('error', (ev) => fail(ev.error || ev.message));

function mk(html, css){ const d=document.createElement('div'); d.setAttribute('style', css||''); d.innerHTML=html; stage.appendChild(d); return d; }

/** Ink box of a string, in em, relative to the alphabetic baseline. Canvas gives true ink. */
function ink(text, px, weight){
  const c = document.createElement('canvas'); c.width=1; c.height=1;
  const g = c.getContext('2d');
  g.font = (weight||400) + ' ' + px + 'px "QP-Estedad"';
  g.direction = 'rtl';
  const m = g.measureText(text);
  return {
    width: m.width,
    up: m.actualBoundingBoxAscent / px,     // ink above baseline, em
    down: m.actualBoundingBoxDescent / px,  // ink below baseline, em
    extent: (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / px,
    fontUp: m.fontBoundingBoxAscent / px,
    fontDown: m.fontBoundingBoxDescent / px,
  };
}

/** Advance width of a string at 100px, via a DOM span so OpenType features can be set. */
function adv(text, feat, px){
  const d = mk('<span id="x"></span>', 'position:absolute;white-space:pre;font-size:'+(px||100)+'px;font-family:"QP-Estedad";'+(feat?('font-feature-settings:'+feat+';'):''));
  d.firstChild.textContent = text;
  const w = d.firstChild.getBoundingClientRect().width;
  stage.removeChild(d); return w;
}

/** Visual left-to-right order of the substrings, as the bidi algorithm actually laid them out. */
function visualOrder(full, parts, px){
  const d = mk('', 'position:absolute;width:900px;font-size:'+(px||20)+'px;font-family:"QP-Estedad";direction:rtl;text-align:start;');
  d.textContent = full;
  const node = d.firstChild;
  const res = [];
  for (const p of parts){
    const i = full.indexOf(p);
    if (i < 0) continue;
    const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + p.length);
    const b = r.getBoundingClientRect();
    res.push({ part: p, left: Math.round(b.left*100)/100, right: Math.round(b.right*100)/100, width: Math.round(b.width*100)/100 });
  }
  stage.removeChild(d);
  return res.sort((a,b)=>a.left-b.left).map((x,i)=>({ rank:i, ...x }));
}

/** Lay a block of text into a column and report how it broke. */
function flow(text, width, px, lh, weight){
  const d = mk('', 'position:absolute;width:'+width+'px;font-size:'+px+'px;line-height:'+lh+'px;font-weight:'+(weight||400)+';font-family:"QP-Estedad";direction:rtl;text-align:start;letter-spacing:0;');
  d.textContent = text;
  const node = d.firstChild;
  // count lines by walking character rects and detecting top changes
  const tops = new Set(); const lineChars = {};
  for (let i=0;i<text.length;i++){
    const r=document.createRange(); r.setStart(node,i); r.setEnd(node,i+1);
    const b=r.getBoundingClientRect();
    if (b.width===0 && b.height===0) continue;
    const t=Math.round(b.top);
    tops.add(t); lineChars[t]=(lineChars[t]||0)+1;
  }
  const h = d.getBoundingClientRect().height;
  const lines = tops.size;
  const counts = Object.values(lineChars);
  const words = text.trim().split(/\\s+/).length;
  stage.removeChild(d);
  return {
    width, px, lh, lines, height: Math.round(h*10)/10,
    charsPerLine: lines ? Math.round((text.length/lines)*10)/10 : 0,
    wordsPerLine: lines ? Math.round((words/lines)*10)/10 : 0,
    minLineChars: counts.length?Math.min(...counts):0,
    maxLineChars: counts.length?Math.max(...counts):0,
  };
}

(async () => {
 try {
  // Explicitly request each weight; fonts.ready alone is NOT sufficient (see the note above).
  await Promise.race([
    Promise.all([400,500,600].map(w=>document.fonts.load(w+' 100px "QP-Estedad"'))).catch(()=>{}),
    new Promise(r=>setTimeout(r,8000)),
  ]);
  await Promise.race([document.fonts.ready.catch(()=>{}), new Promise(r=>setTimeout(r,5000))]);
  await new Promise(r=>setTimeout(r,250));
  const R = {};

  /* 1. FALLBACK GUARD ------------------------------------------------------------- */
  const probe = 'اللي بيتكرر هنا مش مجرد تردد قبل الاختيار';
  const withFont = adv(probe, null, 100);
  const dn = mk('<span id="y"></span>', 'position:absolute;white-space:pre;font-size:100px;font-family:"QP-NoSuchFace-Control";');
  dn.firstChild.textContent = probe;
  const noFont = dn.firstChild.getBoundingClientRect().width; stage.removeChild(dn);
  R.fallbackGuard = {
    estedad: Math.round(withFont*100)/100,
    noFontControl: Math.round(noFont*100)/100,
    distinct: Math.abs(withFont-noFont) > 1,
    loadedFaces: document.fonts.size,
    check: document.fonts.check('400 100px "QP-Estedad"'),
  };
  // Refuse to report anything if the measurements are of a fallback face. Every number
  // below would otherwise be plausible, self-consistent and about the wrong font.
  if (!R.fallbackGuard.distinct) {
    throw new Error('FALLBACK GUARD FAILED: shaped width with Estedad ('+withFont+') equals the '+
      'no-font control ('+noFont+'). The measurements would be of a substituted face.');
  }

  /* 2. LATIN 'i' - Estedad issue #44 ---------------------------------------------- */
  const iTests = {};
  for (const p of SYS.latinI.probes) iTests[p] = Math.round(adv(p,null,100)*100)/100;
  const iInk = ink('i', 100, 400);
  R.latinI = {
    perString: iTests,
    // if 'i' were dropped, these two would be equal
    Confidence_vs_Confdence: { with: Math.round(adv('Confidence',null,100)*100)/100, without: Math.round(adv('Confdence',null,100)*100)/100 },
    i_advance_100px: Math.round(adv('i',null,100)*100)/100,
    i_ink: { up: +iInk.up.toFixed(4), down: +iInk.down.toFixed(4), width: +iInk.width.toFixed(2) },
    dotPresent: iInk.up > 0.60,  // the tittle sits well above x-height (0.49em)
  };

  /* 3. DIACRITICS ----------------------------------------------------------------- */
  R.diacritics = { samples: {}, knownIssue: {}, stacks: {} };
  for (const s of SYS.diacritics.samples){
    const a = ink(s,100,400);
    R.diacritics.samples[s] = { up:+a.up.toFixed(4), down:+a.down.toFixed(4), extent:+a.extent.toFixed(4) };
  }
  for (const st of SYS.diacritics.stacks){
    const a = ink(st.t,100,400);
    R.diacritics.stacks[st.n] = { text:[...st.t].map(c=>'U+'+c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' '), up:+a.up.toFixed(4), down:+a.down.toFixed(4), extent:+a.extent.toFixed(4) };
  }
  // Issue #39: is the kasratan ABOVE or BELOW the shadda? Adding the mark upward raises
  // the ink ceiling; adding it correctly (below) leaves the ceiling alone.
  for (const pr of SYS.diacritics.knownIssue.pairs){
    const base = pr.base.split(' ')[0];
    const bare = ink(base,100,400);
    const shad = ink(base+'\\u0651',100,400);
    const legacy = ink(pr.l,100,400);
    const modern = ink(pr.m,100,400);
    R.diacritics.knownIssue[pr.base] = {
      bare:        { up:+bare.up.toFixed(4),   down:+bare.down.toFixed(4) },
      plusShadda:  { up:+shad.up.toFixed(4),   down:+shad.down.toFixed(4) },
      legacy_FE74: { up:+legacy.up.toFixed(4), down:+legacy.down.toFixed(4), width:+legacy.width.toFixed(2) },
      modern_064D: { up:+modern.up.toFixed(4), down:+modern.down.toFixed(4), width:+modern.width.toFixed(2) },
      legacyRaisesCeiling: legacy.up > shad.up + 0.002,
      modernRaisesCeiling: modern.up > shad.up + 0.002,
      legacyLowersFloor:   legacy.down > shad.down + 0.002,
      modernLowersFloor:   modern.down > shad.down + 0.002,
    };
  }

  /* 4. LINE BOX vs REAL INK, per role -------------------------------------------- */
  const voc = SYS.proofG.vocalised;
  const plain = SYS.proofB.sections[0].p[0];
  R.lineBox = {};
  for (const role of SYS.roles){
    const v = ink(voc, role.size, role.weight);
    const p = ink(plain, role.size, role.weight);
    R.lineBox[role.key] = {
      size: role.size, leading: role.leading, ratioDeclared: +(role.leading/role.size).toFixed(4),
      vocalisedInk_px: +(v.extent*role.size).toFixed(2),
      vocalisedInk_em: +v.extent.toFixed(4),
      plainInk_em: +p.extent.toFixed(4),
      fontLineBox_em: +(v.fontUp + v.fontDown).toFixed(4),
      vocalisedFits: (v.extent*role.size) <= role.leading,
      headroom_px: +(role.leading - v.extent*role.size).toFixed(2),
    };
  }

  /* 5. FIGURES -------------------------------------------------------------------- */
  const west='0123456789', east='٠١٢٣٤٥٦٧٨٩';
  function spread(set, feat){
    const w=[...set].map(d=>adv(d,feat,100));
    return { min:+Math.min(...w).toFixed(2), max:+Math.max(...w).toFixed(2), spread:+(Math.max(...w)-Math.min(...w)).toFixed(2) };
  }
  R.figures = {
    western_default: spread(west,null), western_tnum: spread(west,'"tnum" 1'),
    arabicIndic_default: spread(east,null), arabicIndic_tnum: spread(east,'"tnum" 1'),
    percentSign: { western:+adv('72%',null,100).toFixed(2), arabicPercent:+adv('٧٢٪',null,100).toFixed(2) },
  };

  /* 5b. SEPARATOR vs ARABIC-INDIC ZERO --------------------------------------------- */
  // The METADATA role is almost entirely digits and separators. U+00B7 MIDDLE DOT and
  // U+0660 ARABIC-INDIC DIGIT ZERO are both small round marks near the same height; if
  // their ink is close, a separator can be read as a digit at 12px.
  {
    const glyphs = { 'U+00B7 middle dot': '\\u00B7', 'U+0660 arabic-indic zero': '\\u0660',
                     'U+2022 bullet': '\\u2022', 'U+2013 en dash': '\\u2013', 'U+007C bar': '|' };
    const g = {};
    for (const [k, ch] of Object.entries(glyphs)){
      const a = ink(ch, 100, 400);
      // down is the descent below the baseline; a NEGATIVE descent means the ink floor is
      // above the baseline. Ink height is therefore up + down, not up - down.
      g[k] = { advance_em:+(adv(ch,null,100)/100).toFixed(4),
               inkTop_em:+a.up.toFixed(4), inkBottom_em:+(-a.down).toFixed(4),
               inkHeight_em:+(a.up + a.down).toFixed(4),
               inkHeight_px_at12:+((a.up + a.down) * 12).toFixed(2) };
    }
    const dot = g['U+00B7 middle dot'], zero = g['U+0660 arabic-indic zero'];
    R.separators = {
      glyphs: g,
      dotVsZero: {
        inkHeightRatio: +(dot.inkHeight_em / zero.inkHeight_em).toFixed(3),
        inkHeightDelta_px_at12: +(zero.inkHeight_px_at12 - dot.inkHeight_px_at12).toFixed(2),
        verticalCentreDelta_em: +(((dot.inkTop_em + dot.inkBottom_em) / 2) - ((zero.inkTop_em + zero.inkBottom_em) / 2)).toFixed(4),
      },
    };
  }

  /* 6. MIXED SCRIPT & BIDI -------------------------------------------------------- */
  const arabicCap = ink('الثقة',100,400), latinCap = ink('QANDEEL',100,400), latinLc = ink('Confidence',100,400);
  R.mixedScript = {
    arabicInk_em: +arabicCap.up.toFixed(4),
    latinCapHeight_em: +latinCap.up.toFixed(4),
    latinXHeight_em: +ink('conce',100,400).up.toFixed(4),
    arabicToLatinCap: +(arabicCap.up/latinCap.up).toFixed(4),
    latinLcAscender_em: +latinLc.up.toFixed(4),
  };
  R.bidi = {};
  for (const p of SYS.proofE.paragraphs){
    const parts = SYS.proofE.inlineTerms.filter(t=>p.includes(t));
    if (parts.length) R.bidi['para:'+p.slice(0,28)] = visualOrder(p, parts, 17);
  }
  for (const t of SYS.proofE.bidiProbes){
    const sent = 'القراءة مرتبطة بـ '+t+' حتى الآن.';
    R.bidi['probe:'+t] = visualOrder(sent, [t, 'القراءة', 'حتى'], 17);
  }
  // Does an isolate change anything? If not, no directional hack is warranted.
  {
    const t='PR #220';
    const bare='القراءة مرتبطة بـ '+t+' حتى الآن.';
    const iso='القراءة مرتبطة بـ \\u2068'+t+'\\u2069 حتى الآن.';
    R.bidi.isolateComparison = { bare: visualOrder(bare,[t],17), withFSI: visualOrder(iso,[t],17) };
  }

  /* 7. READING MEASURE ------------------------------------------------------------ */
  const longText = SYS.proofB.sections.map(s=>s.p.join(' ')).join(' ');
  R.readingMeasure = SYS.readingMeasures.map(m=>({ label:m.label, ...flow(longText, m.w, 17, 30, 400) }));
  R.readingMeasureWordCount = longText.trim().split(/\\s+/).length;

  /* 8. HOW THE CONVERSATION AND THE ANALYSIS REFLOW UNDER SCALING ----------------- */
  // Measured in the engine at the real device width, for both leading models, so the
  // accessibility claims are about laid-out text and not about arithmetic.
  R.scaleFlow = {};
  for (const sc of SYS.scales){
    const s = sc/100;
    R.scaleFlow[sc+'%'] = {};
    for (const model of ['mul','sp']){
      const rows = {};
      for (const dev of SYS.devices){
        const g = SYS.gutters[dev.key];
        const w = dev.w - 2*g;
        const r = SYS.roles.find(x=>x.key==='body');
        const size = SCALED[sc][model][r.key].size, lh = SCALED[sc][model][r.key].leading;
        rows[dev.key] = flow(SYS.proofB.sections[0].p[0], w, size, lh, 400);
      }
      R.scaleFlow[sc+'%'][model] = rows;
    }
  }

  /* 9. CONTROL / TOUCH TARGET BEHAVIOUR UNDER SCALING ----------------------------- */
  // Measured inside REAL container widths, because a control's behaviour is a function of
  // the box it has to live in. Three containers per device: a full-width primary action, a
  // half-width pair, and a narrow 104px slot of the kind a toolbar gives a label.
  R.controls = {};
  for (const sc of SYS.scales){
    const a = SCALED[sc].mul.action;
    R.controls[sc+'%'] = {};
    for (const dev of SYS.devices){
      const g = SYS.gutters[dev.key];
      const full = dev.w - 2*g;
      const containers = { full, half: Math.floor((full-12)/2), narrow: 104 };
      const per = {};
      for (const [cname, cw] of Object.entries(containers)){
        for (const lab of SYS.proofF.labels.concat([SYS.proofG.longAction])){
          const d = mk('<span id="b"></span>',
            'position:absolute;width:'+cw+'px;display:flex;align-items:center;justify-content:center;'+
            'min-height:48px;padding:10px 14px;box-sizing:border-box;'+
            'font-size:'+a.size+'px;line-height:'+a.leading+'px;font-weight:500;font-family:"QP-Estedad";direction:rtl;');
          d.firstChild.textContent = lab;
          const box = d.getBoundingClientRect();
          const inner = d.firstChild.getBoundingClientRect();
          per[cname+'|'+lab] = {
            container: cw,
            h: Math.round(box.height*10)/10,
            textW: Math.round(inner.width*10)/10,
            lines: Math.max(1, Math.round(inner.height / a.leading)),
            overflows: inner.width > cw - 28 + 0.5,
            meets48: box.height >= 48,
          };
          stage.removeChild(d);
        }
      }
      R.controls[sc+'%'][dev.key] = per;
    }
  }

  /* 10. HARD BIDI CASES ----------------------------------------------------------- */
  // The contract forbids manual reordering and directional hacks "unless the test exposes
  // a genuine case requiring proper isolation". These are the cases most likely to expose
  // one: a Latin+number run against Arabic punctuation, brackets, and adjacent LTR runs.
  // Per-CHARACTER visual order, so nothing depends on how a tokeniser happens to group
  // things. charOrder() returns the string as the eye actually reads it left to right.
  function charOrder(text, px){
    const d = mk('', 'position:absolute;width:900px;font-size:'+(px||17)+'px;font-family:"QP-Estedad";direction:rtl;text-align:start;');
    d.textContent = text;
    const node = d.firstChild; const pts=[];
    for (let i=0;i<text.length;i++){
      const r=document.createRange(); r.setStart(node,i); r.setEnd(node,i+1);
      const b=r.getBoundingClientRect();
      if (b.width===0 && b.height===0) continue;
      pts.push({ i, ch:text[i], x:b.left });
    }
    stage.removeChild(d);
    pts.sort((a,b)=>a.x-b.x);
    return { visual: pts.map(p=>p.ch).join(''), indices: pts.map(p=>p.i) };
  }

  R.bidiHard = {};
  for (const c of SYS.proofE.bidiHard){
    const bare = charOrder(c.text, 17);
    // Wrap each Latin/identifier run in FSI...PDI and compare the visual result.
    const isoText = c.text.replace(/([A-Za-z][A-Za-z0-9#.\\- ]*[A-Za-z0-9])/g, '\\u2068$1\\u2069');
    const iso = charOrder(isoText, 17);
    const isoVisual = iso.visual.replace(/[\\u2068\\u2069]/g,'');
    R.bidiHard[c.id] = {
      text: c.text,
      visualLTR: bare.visual,
      visualLTR_withIsolates: isoVisual,
      isolateChangesOrder: bare.visual !== isoVisual,
      // Where does the sentence-final stop actually land?
      finalStopIsLeftmost: bare.visual[0] === '.' || bare.visual[0] === '؟',
    };
  }

  out.textContent = '@@JSON@@' + JSON.stringify(R) + '@@END@@';
 } catch(e){ fail(e); }
})();
</script></body></html>`;

async function main() {
  const p = join(WORK, 'probe.html');
  writeFileSync(p, probeHTML(), 'utf8');
  const url = `file:///${p.replace(/\\/g, '/')}`;
  const dom = await dumpDom(url, 1400, 900);
  const pre = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!pre) throw new Error('probe: no <pre id="out"> in the dumped DOM');
  const raw = pre[1];
  if (raw.startsWith('@@ERR@@')) throw new Error('probe threw in-page:\n' + decodeEnt(raw.slice(7)));
  const a = raw.indexOf('@@JSON@@'), b = raw.indexOf('@@END@@');
  if (a < 0 || b < 0) throw new Error('probe did not complete; #out was: ' + raw.slice(0, 400));
  const R = JSON.parse(decodeEnt(raw.slice(a + 8, b)));

  // Everything computed in Node (not in the page) goes in here.
  R.scaleTable = {};
  for (const sc of SYS.scales) {
    const s = sc / 100;
    R.scaleTable[sc + '%'] = SYS.roles.map((role) => ({
      role: role.name,
      mul: scaleRole(role, s, 'mul'),
      sp: scaleRole(role, s, 'sp'),
    }));
  }
  R.contrast = contrastTable();
  R.generated = new Date().toISOString();

  const outPath = join(PKG, 'docs', 'MEASUREMENTS_rendered-text.json');
  writeFileSync(outPath, JSON.stringify(R, null, 1), 'utf8');
  console.log('measure: wrote', outPath);
  return R;
}

function decodeEnt(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** WCAG 2.x relative luminance and contrast, for the declared control palette. */
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastTable() {
  const bg = lum(S.bg);
  const t = {};
  for (const k of ['primary', 'secondary', 'chrome', 'rule', 'controlEdge']) {
    const l = lum(S[k]);
    const hi = Math.max(l, bg), lo = Math.min(l, bg);
    t[k] = { hex: S[k], ratio: +(((hi + 0.05) / (lo + 0.05)).toFixed(2)) };
  }
  t._bg = S.bg;
  return t;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
