/**
 * I-08B3.1-B4.8 - THE ANTI-CARDIFICATION PRODUCTION GUARD.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT THIS CHECKS, AND WHY IT IS NOT A GREP
 * ---------------------------------------------------------------------------------------------
 *
 * The eight failures B4.8 names are failures of RESULT, not of syntax. "Every section boxed" is not
 * a string anybody types; it is what a screen turns out to be after twelve reasonable-looking
 * commits. A source grep for `background:` would catch the World and miss a card assembled from a
 * shared style object, which is how cardification actually arrives.
 *
 * So the guard runs on COMPUTED STYLE. A composition is laid out in the browser, every element in
 * every product frame reports what it actually resolved to - background colour, box-shadow, radius,
 * borders, where it sits, how much text it holds - and the rules are evaluated against that. It
 * cannot be fooled by indirection, because it reads the end of the pipeline.
 *
 * ---------------------------------------------------------------------------------------------
 * AND IT IS FIRED AT THE PREDECESSOR'S OWN FAILURE CAPTURES
 * ---------------------------------------------------------------------------------------------
 *
 * The violating fixtures are not written for this file. They are the cardification failures the
 * SEALED I-08B3.1-B3R package already draws on purpose - `fieldCard`, `boxNodes`, `cards`, `boxed` -
 * rendered through the sealed stylesheet with the sealed switches. A guard that rejects markup
 * written to be rejected proves the rule parses. A guard that rejects the previous release's own
 * recorded failures proves the rule is about QANDEEL.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { WORK } from './b4-tokens.mjs';
import {
  envWork, envMap, envUtil, envMini, faceCSS, frameCSS, FONT_GUARD_HTML,
} from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-ui.mjs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/**
 * B4's OWN reporter. The sealed package's reporter measures geometry and focus topology; this one
 * measures MATERIAL. Written as a plain string with no template interpolation anywhere inside it,
 * for the same reason the sealed one is.
 */
const CARD_REPORTER = `<script>addEventListener('load',function(){
var rows=[];
var frames=[].slice.call(document.querySelectorAll('[data-qp-frame]'));
frames.forEach(function(f,fi){
  var all=[f].concat([].slice.call(f.querySelectorAll('*')));
  all.forEach(function(e,i){
    var s=getComputedStyle(e);
    var r=e.getBoundingClientRect();
    if(r.width<=0||r.height<=0) return;
    var plane=!!e.closest('.wk-plane,.mp-plane,.ut-plane');
    var own=[];
    for(var k=0;k<e.classList.length;k++) own.push(e.classList[k]);
    rows.push({f:fi,i:i,tag:e.tagName,cls:own.join(' '),
      bg:s.backgroundColor,shadow:s.boxShadow,radius:s.borderTopLeftRadius,
      bw:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].join('|'),
      bc:[s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor].join('|'),
      backdrop:s.backdropFilter||'none',
      plane:plane,text:(e.children.length?0:(e.textContent||'').trim().length),
      textAll:(e.textContent||'').trim().length,
      focusables:e.querySelectorAll('a[href],button,input,textarea,select,[tabindex]').length,
      w:Math.round(r.width),h:Math.round(r.height)});
  });
});
var tag=document.createElement('script');
tag.type='application/json';tag.id='b4-card';
tag.textContent=JSON.stringify(rows);
document.body.appendChild(tag);
});</script>`;

function pageFor(bodyHTML, width) {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en"><head><meta charset="utf-8"><title>b4 cardguard</title>
<style>
${faceCSS()}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:#333333;}
body{font-family:"QP-Estedad";-webkit-text-size-adjust:none;width:${width}px;direction:ltr;}
${frameCSS}
</style></head><body>${FONT_GUARD_HTML}${bodyHTML}${CARD_REPORTER}</body></html>`;
}

function dumpDom(url, width) {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--disable-lcd-text', '--disable-font-subpixel-positioning', '--force-color-profile=srgb',
    '--virtual-time-budget=25000', `--window-size=${width},900`, '--dump-dom', url];
  return new Promise((res) => {
    const chunks = [];
    const c = spawn(CHROME, args, { windowsHide: true });
    c.stdout.on('data', (d) => chunks.push(d));
    c.stderr.on('data', () => {});
    c.on('close', () => res(Buffer.concat(chunks).toString('utf8')));
  });
}

async function styles(name, bodyHTML, width) {
  const html = pageFor(bodyHTML, width);
  const path = join(WORK, `card-${name}.html`);
  writeFileSync(path, html, 'utf8');
  const dom = await dumpDom(`file:///${path.replace(/\\/g, '/')}`, width + 24);
  const m = dom.match(/<script type="application\/json" id="b4-card">([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`b4-cardguard: ${name} reported no computed styles`);
  return JSON.parse(m[1]);
}

/* ---------------------------------------------------------------------- the rules ----- */

const TRANSPARENT = /rgba\(0,\s*0,\s*0,\s*0\)|transparent/;
/**
 * The four frozen Product Surface roles and their permitted furniture.
 *
 * `qf-inline` is on this list because of a CLEAN-CORPUS FAILURE, and the reason is worth keeping.
 * The dense Utility screen renders an editable display name as `.qf-inline` - a FIELD, presented
 * inline inside a settings row. The first version of C2 forbade any fill inside any plane and
 * flagged it, which would have made the rule report an earned commit boundary as cardification. The
 * rule was wrong, not the screen: what a plane may not contain is an UNROLED fill.
 */
const ROLE_CLASS = ['qf-app', 'qf-aside', 'qf-sub', 'qf-passage', 'qf-field', 'qf-nested', 'qf-scrim', 'qf-inline'];

const hasRole = (r) => r.cls.split(/\s+/).some((c) => ROLE_CLASS.includes(c));
const filled = (r) => !TRANSPARENT.test(r.bg);
const surfaceish = (r) => filled(r) && !/rgb\(16,\s*16,\s*16\)/.test(r.bg);   // not the World itself

/**
 * `rgb(a, b, c)` -> a comparable key. Chrome serialises `rgba(0,0,0,0.5)` for the scrim, which is
 * not a Surface and must not be counted as a tone in the ladder rule.
 */
const opaqueKey = (bg) => {
  const m = bg.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  return m ? `${m[1]},${m[2]},${m[3]}` : null;
};

export const RULES = [
  {
    id: 'C1', title: 'No shadow expresses rank',
    covers: ['shadow/elevation used as analytical rank'],
    run(rows) {
      const bad = rows.filter((r) => r.shadow && r.shadow !== 'none' && !/\bfr\b/.test(r.cls));
      return bad.length
        ? { pass: false, detail: `${bad.length} element(s) carry a box-shadow: ` + sample(bad) }
        : { pass: true, detail: 'no box-shadow anywhere except the diagnostic focus indicator' };
    },
  },
  {
    id: 'C2', title: 'No analytical content sits inside a container',
    covers: ['analytical nodes inside cards', 'every section boxed'],
    run(rows) {
      const bad = rows.filter((r) => r.plane && surfaceish(r) && !hasRole(r));
      return bad.length
        ? { pass: false, detail: `${bad.length} unroled filled container(s) inside a plane: ` + sample(bad) }
        : { pass: true, detail: 'every plane is continuous - the only fills inside one are frozen Product roles' };
    },
  },
  {
    id: 'C3', title: 'No tonal ladder: at most one Surface value per frame',
    covers: ['multiple same-purpose Surface levels', 'Surface brightness used as importance'],
    run(rows) {
      const byFrame = new Map();
      for (const r of rows) {
        if (!surfaceish(r)) continue;
        const k = opaqueKey(r.bg);
        if (!k) continue;                                   // the scrim is not a Surface
        if (!byFrame.has(r.f)) byFrame.set(r.f, new Map());
        const m = byFrame.get(r.f);
        m.set(k, (m.get(k) || 0) + 1);
      }
      const bad = [...byFrame.entries()].filter(([, m]) => m.size > 1);
      return bad.length
        ? { pass: false, detail: bad.map(([f, m]) => `frame ${f} paints ${m.size} Surface tones: ${[...m.keys()].join(' / ')}`).join('; ') }
        : { pass: true, detail: `${byFrame.size} frame(s), each painting exactly ` +
            `${[...byFrame.values()].map((m) => m.size).join('/')} Surface tone` };
    },
  },
  {
    id: 'C4', title: 'No nested panel that is not a frozen role',
    covers: ['nested panels for hierarchy'],
    run(rows) {
      const bad = rows.filter((r) => surfaceish(r) && !hasRole(r) && !r.plane);
      return bad.length
        ? { pass: false, detail: `${bad.length} filled element(s) outside a plane carry no frozen role class: ` + sample(bad) }
        : { pass: true, detail: 'every Surface in the composition is one of the four frozen roles or its permitted furniture' };
    },
  },
  {
    id: 'C5', title: 'No Surface exists because the token exists',
    covers: ['cards created for organisation', 'Surface token used because it exists'],
    run(rows) {
      /**
       * A Surface that holds NOTHING earns nothing - the Earning Test's Q1 as a measurement.
       *
       * The first version of this rule asked whether the Surface held more than fifteen characters,
       * and the N2 composition failed it: a nested scope menu whose four Arabic labels are nine to
       * fourteen characters each is a perfectly earned ASIDE, and a threshold was the only thing
       * that said otherwise. A magic number was adjudicating copy length in a package whose whole
       * content is short Arabic labels. The rule now asks the question it meant to ask - is this
       * container EMPTY - which needs no threshold at all.
       */
      const bad = rows.filter((r) => surfaceish(r) && hasRole(r) && r.w * r.h > 0)
        .filter((r) => r.textAll === 0 && r.focusables === 0 && !/qf-scrim/.test(r.cls));
      return bad.length
        ? { pass: false, detail: `${bad.length} Surface(s) hold no content of substance: ` + sample(bad) }
        : { pass: true, detail: 'every Surface in the composition holds content that would be lost without it' };
    },
  },
];

const sample = (rows) => rows.slice(0, 4).map((r) => `${r.tag.toLowerCase()}.${r.cls.split(/\s+/)[0] || '(none)'} bg ${r.bg}` +
  (r.shadow !== 'none' ? ` shadow ${r.shadow.slice(0, 32)}` : '')).join('; ') + (rows.length > 4 ? ` (+${rows.length - 4} more)` : '');

/* -------------------------------------------------------------------- the corpus ------ */

const CARD_VARS = { '--s-card': '#232323', '--card-shadow': '0 10px 28px rgba(0,0,0,0.55)', '--radius': '14px' };

export const CLEAN = [
  { key: 'work-field', w: 720, html: () => envWork({}, { field: 'draft' }) },
  { key: 'work-aside', w: 720, html: () => envWork({}, { aside: 'menu' }) },
  { key: 'work-passage-n2', w: 720, html: () => envWork({}, { passage: true, nested: true, field: 'short' }) },
  { key: 'map', w: 800, html: () => envMap({}, { aside: 'excerpt' }) },
  { key: 'util', w: 560, html: () => envUtil({}, {}) },
];

/**
 * The violating corpus, every entry a switch the SEALED predecessor already carries for its own
 * failure captures. `expect` names the rules that must fire; anything else that fires is reported as
 * collateral rather than quietly counted as success.
 */
export const VIOLATING = [
  { key: 'field-as-card', w: 720, expect: ['C1'], html: () => envWork(CARD_VARS, { field: 'draft', fieldCard: true }),
    why: 'the FIELD drawn as an outlined card with a drop shadow instead of a commit boundary' },
  { key: 'map-boxed-nodes', w: 800, expect: ['C1', 'C2', 'C3'], html: () => envMap(CARD_VARS, { boxNodes: true }),
    why: 'analytical nodes put in boxes - the Map failure B2 drew and SG-1 forbids' },
  { key: 'util-sections-boxed', w: 560, expect: ['C1', 'C2', 'C3'], html: () => envUtil(CARD_VARS, { cards: true }),
    why: 'every section of a settings screen boxed, which is what tidying looks like from the inside' },
  { key: 'entries-boxed', w: 470, expect: ['C1', 'C2', 'C3'], html: () => envMini(CARD_VARS, { boxed: true }),
    why: 'analytical entries as cards on the World' },
];

/* ------------------------------------------------------------------------ main -------- */

export async function main() {
  mkdirSync(WORK, { recursive: true });
  console.log('I-08B3.1-B4.8 - ANTI-CARDIFICATION PRODUCTION GUARD');
  console.log('');

  const clean = [];
  for (const c of CLEAN) {
    const rows = await styles(c.key, c.html(), c.w);
    const res = RULES.map((r) => ({ id: r.id, title: r.title, ...r.run(rows) }));
    const failed = res.filter((r) => !r.pass);
    clean.push({ key: c.key, elements: rows.length, results: res, failed: failed.map((f) => f.id) });
    console.log(`  ${failed.length ? 'FAIL' : 'PASS'}  ${c.key.padEnd(18)} ${String(rows.length).padStart(4)} elements` +
      (failed.length ? `  violated ${failed.map((f) => `${f.id}: ${f.detail}`).join(' | ')}` : '  clean on all five rules'));
  }

  console.log('');
  console.log('  VIOLATING FIXTURES - the sealed predecessor\'s own cardification failure captures');
  const violating = [];
  for (const c of VIOLATING) {
    const rows = await styles(c.key, c.html(), c.w);
    const res = RULES.map((r) => ({ id: r.id, title: r.title, ...r.run(rows) }));
    const fired = res.filter((r) => !r.pass).map((r) => r.id);
    const missed = c.expect.filter((id) => !fired.includes(id));
    const extra = fired.filter((id) => !c.expect.includes(id));
    violating.push({ key: c.key, why: c.why, expect: c.expect, fired, missed, extra, results: res });
    console.log(`  ${missed.length ? 'FAIL' : 'PASS'}  ${c.key.padEnd(18)} fired [${fired.join(', ') || 'NOTHING'}]` +
      (missed.length ? `  MISSED [${missed.join(', ')}]` : '') + (extra.length ? `  also [${extra.join(', ')}]` : ''));
  }

  const cleanFails = clean.filter((c) => c.failed.length);
  const probeFails = violating.filter((v) => v.missed.length);
  console.log('');
  console.log(`  clean corpus    : ${clean.length - cleanFails.length}/${clean.length} pass all five rules`);
  console.log(`  violating corpus: ${violating.length - probeFails.length}/${violating.length} rejected as designed`);

  writeFileSync(join(WORK, 'cardguard.json'),
    JSON.stringify({ rules: RULES.map(({ run, ...r }) => r), clean, violating }, null, 2), { encoding: 'utf8' });
  return { clean, violating, cleanFails, probeFails };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = await main();
  if (r.cleanFails.length || r.probeFails.length) process.exit(1);
}
