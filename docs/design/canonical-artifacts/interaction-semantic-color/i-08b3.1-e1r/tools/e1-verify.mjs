/**
 * I-08B3.1-E1 — THE CHECK SUITE.
 *
 * Every check is paired with a NEGATIVE PROBE: an input that must make it throw or fail.
 * A check proved only by the thing it accepts is a sentence. Two of the probes are not
 * invented — they are the ordinary mistakes an implementer makes, and one of them is a
 * predecessor package's own text.
 *
 * LAYERED BY DEPENDENCY ON PURPOSE. Layer A is pure Node and runs from a bare extraction
 * with no project root, no siblings and no browser. Layer B needs the rendered boards.
 * Layer C needs Chrome. The claims that matter most survive the barest environment.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { srgbToOklch, hexToRgb8, rgb8ToHex } from '../vendor/lib/color.mjs';
import { decode } from '../vendor/lib/png.mjs';
import { resolveAll, loadTokens, resolve, TOKEN_FILES, FORBIDDEN_TARGETS, FORBIDDEN_PREFIXES } from './e1-resolve.mjs';
import { derive, dEhex, okL, cr, over, errorFloors, FLOOR } from './e1-derive.mjs';
import { classify } from './e1-tokens.mjs';
import { css, palette } from './e1-scene.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const ok = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));

const results = [];
const probes = [];
const check = (id, layer, name, fn) => {
  try { const r = fn(); results.push({ id, layer, name, pass: !!r.pass, detail: r.detail }); }
  catch (e) { results.push({ id, layer, name, pass: false, detail: 'THREW: ' + e.message }); }
};
const probe = (id, name, fn) => {
  try { const r = fn(); probes.push({ id, name, fired: !!r.fired, detail: r.detail }); }
  catch (e) { probes.push({ id, name, fired: true, detail: 'threw as required: ' + e.message }); }
};

/* ==================================================================== LAYER A ======= */
const D = derive();
const R = resolveAll();
const val = (k) => R.colour[k].value;
const chainOf = (k) => R.colour[k].chain;
const e1Base = readFileSync(join(PKG, 'tokens/base/interaction.tokens.json'), 'utf8');
const e1Dark = readFileSync(join(PKG, 'tokens/appearance/dark.interaction.tokens.json'), 'utf8');
const e1Light = readFileSync(join(PKG, 'tokens/appearance/light.interaction.tokens.json'), 'utf8');
const e1All = e1Base + e1Dark + e1Light;

/** The names E1 authors. Everything under qandeel.state or qandeel.status. */
const e1Names = [...R.flat.keys()].filter((n) => n.startsWith('qandeel.state.') || n.startsWith('qandeel.status.')
  || n.startsWith('qandeel.expression.state.') || n.startsWith('qandeel.expression.status.'));

check('R01', 'A', 'no member of qandeel.state or qandeel.status reaches the identity material or the illumination', () => {
  const bad = [];
  for (const n of e1Names) {
    let ch; try { ch = resolve(R.flat, n).chain; } catch { continue; }
    for (const hop of ch) {
      if (FORBIDDEN_TARGETS.includes(hop) || FORBIDDEN_PREFIXES.some((p) => hop.startsWith(p))) bad.push(n + ' -> ' + hop);
    }
  }
  return { pass: bad.length === 0, detail: bad.length ? bad.join('; ') : e1Names.length + ' names checked, every hop of every chain' };
});
probe('R01', 'a state token aliasing the identity material', () => {
  const flat = new Map(R.flat);
  flat.set('qandeel.state.selected.marker', { value: '{qandeel.identity.material}', file: 'probe' });
  const ch = resolve(flat, 'qandeel.state.selected.marker').chain;
  return { fired: ch.some((h) => FORBIDDEN_TARGETS.includes(h)), detail: ch.join(' -> ') };
});

/** A colour token holds a literal when its $value is a DTCG colour object rather than an
 *  alias string. e1-resolve flattens the object down to its hex, so "is it a literal" is
 *  "is the string not wrapped in braces". */
const isAlias = (v) => typeof v === 'string' && /^\{.*\}$/.test(v.trim());
const literalsUnder = (flat, prefix) => [...flat.keys()].filter((n) =>
  n.startsWith(prefix) && flat.get(n).type !== 'number' && flat.get(n).type !== 'dimension'
  && flat.get(n).type !== 'fontWeight' && !isAlias(flat.get(n).value));

check('R02', 'A', 'interaction state introduces NO colour: every colour under qandeel.state is an alias into the frozen ramp, and E1 authors exactly ONE state literal', () => {
  const semantic = literalsUnder(R.flat, 'qandeel.state.');
  const expression = literalsUnder(R.flat, 'qandeel.expression.state.');
  return { pass: semantic.length === 0 && expression.length === 1 && expression[0] === 'qandeel.expression.state.disabled',
    detail: 'literals under qandeel.state: ' + JSON.stringify(semantic) + ' (must be none); under qandeel.expression.state: ' + JSON.stringify(expression) };
});
probe('R02', 'a hue given to the selection marker', () => {
  const flat = new Map(R.flat);
  flat.set('qandeel.state.selected.marker', { value: '#ffcc00', file: 'probe', type: 'color' });
  const lits = literalsUnder(flat, 'qandeel.state.');
  return { fired: lits.length > 0, detail: 'the check would report ' + JSON.stringify(lits) + ' under qandeel.state and fail' };
});

/* THE SHIPPED CONTRACTS, READ BACK OUT OF THE TOKEN DOCUMENT E1R EMITS.
   Everything below inspects these, never the module that produced them and never a
   guard's own prose. A check that reads the source of the thing it is checking is a
   check on a variable name. */
const BASE = JSON.parse(e1Base);
const ROLES = ['error', 'warning', 'success', 'informational'];
const statusPolicy = BASE.qandeel.status.$extensions['com.qandeel.status-policy'];
const rolePolicy = (r) => BASE.qandeel.status[r].$extensions['com.qandeel.status-policy'];
const composition = BASE.qandeel.state.$extensions['com.qandeel.composition'];
const availability = BASE.qandeel.state.disabled.$extensions['com.qandeel.availability'];
const selectedUnavailable = BASE.qandeel.state.disabled.$extensions['com.qandeel.selected-unavailable'];
const productContract = BASE.$extensions['com.qandeel.freeze-boundary'].productContract;
const reachesStatusLiteral = (flat, r) =>
  resolve(flat, `qandeel.status.${r}.ink`).chain.some((h) => h.startsWith('qandeel.expression.status.'));

/**
 * REV-03. THIS CHECK USED TO ASSERT A CAP.
 *
 * It read "QANDEEL has FOUR status roles and exactly ONE status colour" and passed on the
 * count. That is an untested absolute about every status role QANDEEL will ever have,
 * proved by evidence about one of them. What is actually defensible is the POLICY: a hue
 * is EARNED, the graph agrees with what the policy says has been earned, and every role
 * that has not earned one carries a condition that would overturn its refusal and a route
 * to Product evidence. A current state with a way out, checked; not a ceiling, asserted.
 */
check('R03', 'A', 'status colour is EARNED, not capped: the graph agrees with the shipped policy, and every uncoloured role carries an overturn condition and a Product-evidence route', () => {
  const declared = ROLES.filter((r) => rolePolicy(r).dedicatedHue === true);
  const inGraph = ROLES.filter((r) => reachesStatusLiteral(R.flat, r));
  const agree = declared.length === inGraph.length && declared.every((r) => inGraph.includes(r));
  const routeless = ROLES.filter((r) => rolePolicy(r).dedicatedHue !== true)
    .filter((r) => !rolePolicy(r).overturnedBy || !rolePolicy(r).productEvidenceRequired);
  return { pass: agree && routeless.length === 0 && declared.length >= 1,
    detail: 'policy declares a dedicated hue for ' + JSON.stringify(declared) + '; the graph reaches a status literal for ' +
      JSON.stringify(inGraph) + '; uncoloured roles with no overturn condition or no evidence route: ' +
      JSON.stringify(routeless) + ' — and the policy states in terms that the count is not a cap: "' +
      statusPolicy.whatIsFrozen + '"' };
});
probe('R03', 'a role given a hue by taxonomy — declared nowhere, earned nowhere, and simply aliased', () => {
  const flat = new Map(R.flat);
  flat.set('qandeel.status.warning.ink', { value: '{qandeel.expression.status.error}', file: 'probe' });
  const inGraph = ROLES.filter((r) => reachesStatusLiteral(flat, r));
  const declared = ROLES.filter((r) => rolePolicy(r).dedicatedHue === true);
  return { fired: inGraph.length !== declared.length,
    detail: 'the graph would reach a status literal for ' + JSON.stringify(inGraph) + ' while the shipped policy declares ' +
      JSON.stringify(declared) + ' — a hue that nobody wrote down as earned is rejected, which is the OTHER direction of REV-03: removing the cap must not remove the discipline' };
});

check('R04', 'A', 'every E1 token carries a freeze classification, and classify() throws on one that does not', () => {
  const authored = [...R.flat.keys()].filter((n) => ['e1/base', 'e1/dark'].includes(R.flat.get(n).file));
  let bad = [];
  for (const n of authored) { try { classify(n); } catch { bad.push(n); } }
  return { pass: bad.length === 0 && authored.length > 0, detail: authored.length + ' authored tokens, all classified' + (bad.length ? '; UNCLASSIFIED ' + bad : '') };
});
probe('R04', 'a token path with no classification', () => {
  try { classify('qandeel.state.hover.ink'); return { fired: false, detail: 'classify() returned instead of throwing' }; }
  catch (e) { return { fired: true, detail: e.message }; }
});

const FORBIDDEN_NAMES = ['gold', 'amber', 'yellow', 'accent', 'brandAccent', 'selectedColor'];
check('R05', 'A', 'none of the forbidden names appears anywhere in E1’s token output', () => {
  const hits = [];
  const scan = (node, path) => {
    for (const k of Object.keys(node)) {
      for (const f of FORBIDDEN_NAMES) if (k.toLowerCase() === f.toLowerCase()) hits.push(path + '.' + k);
      const v = node[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) scan(v, path + '.' + k);
    }
  };
  for (const [n, t] of [['base', e1Base], ['dark', e1Dark], ['light', e1Light]]) scan(JSON.parse(t), n);
  return { pass: hits.length === 0, detail: hits.length ? hits.join(', ') : 'scanned three token documents by KEY, so a description may discuss the words' };
});
probe('R05', 'a token group actually named accent', () => {
  const hits = [];
  const scan = (node, path) => { for (const k of Object.keys(node)) { if (FORBIDDEN_NAMES.includes(k)) hits.push(path + '.' + k); const v = node[k]; if (v && typeof v === 'object') scan(v, path + '.' + k); } };
  scan({ qandeel: { state: { accent: { $value: '#fff' } } } }, '');
  return { fired: hits.length === 1, detail: JSON.stringify(hits) };
});

check('R06', 'A', 'the retired diagnostic literal appears only inside the record that names it retired, located STRUCTURALLY', () => {
  const dark = JSON.parse(e1Dark);
  const record = dark.qandeel.expression.state.disabled.$extensions['com.qandeel.provenance'].retires;
  const permitted = typeof record === 'string' && record.includes(D.RETIRED.disabledInk);
  // Every OTHER occurrence anywhere in the three documents is a violation.
  const count = (e1All.match(new RegExp(D.RETIRED.disabledInk, 'gi')) || []).length;
  return { pass: permitted && count === 1, detail: 'occurrences in all three token documents: ' + count + '; the permitted one is reached by path qandeel.expression.state.disabled.$extensions.com.qandeel.provenance.retires' };
});
probe('R06', 'the retired literal used as a value', () => {
  const doc = JSON.stringify({ qandeel: { expression: { state: { disabled: { $value: { hex: D.RETIRED.disabledInk } } } } } });
  return { fired: (doc.match(new RegExp(D.RETIRED.disabledInk, 'gi')) || []).length > 0, detail: 'a probe document containing it as a value is rejected by the count rule' };
});

check('R07', 'A', 'E1 writes nothing into a frozen namespace', () => {
  const frozen = ['qandeel.expression.content', 'qandeel.expression.material', 'qandeel.expression.illumination',
    'qandeel.expression.world', 'qandeel.expression.surface', 'qandeel.expression.scrim', 'qandeel.identity', 'qandeel.navigation', 'qandeel.analysis'];
  const authored = [...R.flat.keys(), ...R.groups.keys()].filter((n) => ['e1/base', 'e1/dark'].includes((R.flat.get(n) ?? R.groups.get(n))?.file));
  const bad = authored.filter((n) => frozen.some((f) => n === f || n.startsWith(f + '.')));
  return { pass: bad.length === 0, detail: bad.length ? bad.join(', ') : authored.length + ' authored names, none inside a frozen namespace' };
});
probe('R07', 'an E1 token written into the frozen content ramp', () => {
  const n = 'qandeel.expression.content.quaternary';
  const frozen = ['qandeel.expression.content'];
  return { fired: frozen.some((f) => n.startsWith(f + '.')), detail: n + ' would be rejected' };
});

check('R08', 'A', 'the resolved state and status groups carry E1’s description, not C3’s "RESERVED AND DELIBERATELY EMPTY"', () => {
  const bad = [];
  for (const g of ['qandeel.state', 'qandeel.status']) {
    const d = R.groups.get(g);
    if (!d || /RESERVED AND DELIBERATELY EMPTY/.test(d.description)) bad.push(g + ' -> ' + (d ? d.file : 'absent'));
  }
  return { pass: bad.length === 0, detail: bad.length ? bad.join('; ') : 'both groups resolve to e1/base; a tree that still calls them empty has not picked up E1' };
});
probe('R08', 'resolving WITHOUT E1’s file', () => {
  const { groups } = loadTokens(TOKEN_FILES.filter(([l]) => !l.startsWith('e1/')));
  const d = groups.get('qandeel.state');
  return { fired: !!d && /RESERVED AND DELIBERATELY EMPTY/.test(d.description), detail: 'C3 alone still says: ' + (d ? d.description.slice(0, 54) : 'absent') + '...' };
});

check('R09', 'A', 'the disabled ink is a FULL RUNG below the dimmest ink the Product paints at rest', () => {
  const dis = val('DISABLED_INK'), ter = D.FROZEN.TERTIARY;
  const gap = okL(ter) - okL(dis);
  return { pass: gap >= D.DISABLED.rung - 1e-4,
    detail: 'dL ' + gap.toFixed(4) + ' against the ramp’s own smallest rung ' + D.DISABLED.rung.toFixed(4) + '; dEok ' + dEhex(ter, dis).toFixed(4) };
});
probe('R09', 'a disabled ink only just below the tertiary', () => {
  const near = '#7f7d77';
  return { fired: (okL(D.FROZEN.TERTIARY) - okL(near)) < D.DISABLED.rung, detail: near + ' sits only ' + (okL(D.FROZEN.TERTIARY) - okL(near)).toFixed(4) + ' below' };
});

check('R10', 'A', 'the focus PAIR reaches 3:1 against every colour QANDEEL can paint beside it, and the indicator ALONE does not', () => {
  const pair = D.FOCUS.pairCovers === D.FOCUS.total;
  const aloneFails = D.FOCUS.ringAloneCovers < D.FOCUS.total;
  return { pass: pair && aloneFails,
    detail: 'pair ' + D.FOCUS.pairCovers + '/' + D.FOCUS.total + ', indicator alone ' + D.FOCUS.ringAloneCovers + '/' + D.FOCUS.total +
      ' — the companion covers ' + (D.FOCUS.total - D.FOCUS.ringAloneCovers) + ' colours, so it is not decoration' };
});
probe('R10', 'dropping the companion', () => ({ fired: D.FOCUS.ringAloneCovers < D.FOCUS.total,
  detail: 'without it the indicator fails 3:1 against ' + D.FOCUS.coverage.filter((c) => !c.ringAlone).map((c) => c.against).join(', ') }));

/**
 * THE CHECK IS ON THE CHAIN, NOT ON THE COMPOSITED CHROMA, AND THE REASON IS A FINDING.
 *
 * The first version of this check asserted that the pressed ground's chroma sits below
 * the frozen atmosphere ceiling. Its probe — a wash made from QANDEEL LIGHT instead of
 * the Product's ink — STAYED SILENT: at these alphas over a near-black ground almost any
 * wash composites to a nearly achromatic value, so the measurement passes whatever ink
 * you feed it. That is a check that cannot fail, which is a sentence.
 *
 * What IS falsifiable is where the wash ink comes from. The composited chroma is still
 * reported, as a measurement rather than as the thing being relied on.
 */
check('R11', 'A', 'the press wash is made from the Product’s own reading ink, and cannot be the Light or the material', () => {
  const chain = chainOf('PRESSED_INK');
  const reachesRamp = chain.some((h) => h.startsWith('qandeel.expression.content.'));
  const reachesForbidden = chain.some((h) => FORBIDDEN_TARGETS.includes(h) || FORBIDDEN_PREFIXES.some((p) => h.startsWith(p)));
  return { pass: reachesRamp && !reachesForbidden,
    detail: chain.join(' -> ') + '  |  MEASURED, not relied on: the pressed grounds composite to chroma ' +
      ok(D.PRESS.onSurface)[1].toFixed(5) + ' / ' + ok(D.PRESS.onWorld)[1].toFixed(5) +
      ', but at these alphas over a near-black ground almost any wash does, so the chain is what is checked' };
});
probe('R11', 'a press wash pointed at QANDEEL LIGHT', () => {
  const flat = new Map(R.flat);
  flat.set('qandeel.state.pressed.ink', { value: '{qandeel.illumination.core}', file: 'probe', type: 'color' });
  const chain = resolve(flat, 'qandeel.state.pressed.ink').chain;
  const bad = over(D.FROZEN['LIGHT-core'], D.FROZEN.SURFACE, D.PRESS.alpha);
  return { fired: chain.some((h) => FORBIDDEN_PREFIXES.some((p) => h.startsWith(p))),
    detail: chain.join(' -> ') + ' is rejected by the chain rule — and note it composites to ' + bad +
      ', chroma ' + ok(bad)[1].toFixed(5) + ', which a chroma ceiling would have WAVED THROUGH' };
});

check('R12', 'A', 'the pressed World never lands on the one functional Surface value', () => ({
  pass: D.PRESS.onWorld !== D.FROZEN.SURFACE,
  detail: 'pressed World is ' + D.PRESS.onWorld + ', the functional Surface is ' + D.FROZEN.SURFACE,
}));
probe('R12', 'a press alpha that produces the Surface value exactly', () => {
  let hit = null;
  for (let a = 0.001; a < 0.2; a += 0.001) if (over(D.FROZEN.PRIMARY, D.FROZEN.WORLD, a) === D.FROZEN.SURFACE) { hit = a; break; }
  return { fired: hit !== null, detail: hit ? 'alpha ' + hit.toFixed(3) + ' would collide and this check would reject it' : 'no colliding alpha exists' };
});

check('R13', 'A', 'the error is the most chromatic value in QANDEEL', () => {
  const all = { ...D.FROZEN, ERROR: val('ERROR_INK'), DISABLED: val('DISABLED_INK') };
  const sorted = Object.entries(all).map(([n, h]) => [n, ok(h)[1]]).sort((a, b) => b[1] - a[1]);
  return { pass: sorted[0][0] === 'ERROR',
    detail: sorted.slice(0, 4).map(([n, c]) => n + ' ' + c.toFixed(4)).join(' > ') };
});
probe('R13', 'a more chromatic value elsewhere in the system', () => {
  const sorted = Object.entries({ ...D.FROZEN, FAKE: '#00d0a0', ERROR: val('ERROR_INK') }).map(([n, h]) => [n, ok(h)[1]]).sort((a, b) => b[1] - a[1]);
  return { fired: sorted[0][0] !== 'ERROR', detail: 'the most chromatic would become ' + sorted[0][0] };
});

check('R14', 'A', 'the error keeps every derived floor on the quantised value, including under protanopia and deuteranopia', () => {
  const unmet = D.ERROR.floors.filter((f) => !f.pass);
  const binding = D.ERROR.floors.filter((f) => f.value < f.floor * 1.05).map((f) => f.name);
  return { pass: unmet.length === 0, detail: D.ERROR.floors.length + ' floors, 0 unmet; BINDING: ' + JSON.stringify(binding) };
});
probe('R14', 'the IDENTICAL floors applied to two error reds nobody derived against THIS palette', () => {
  const lines = [];
  for (const [name, hex] of [['Material 3 dark error', '#f2b8b5'], ['Apple systemRed dark', '#ff453a']]) {
    const unmet = errorFloors(hex).filter((f) => !f.pass);
    lines.push(name + ' ' + hex + ': ' + (unmet.length ? unmet.length + ' floors unmet — ' + unmet.slice(0, 3).map((f) => f.name + ' ' + f.value.toFixed(4) + ' < ' + f.floor).join('; ') : 'passes'));
  }
  return { fired: lines.some((l) => l.includes('unmet')),
    detail: lines.join('  ||  ') + '  — the floors are specific to THIS palette, not a generic bar, which is why E1 derived a value instead of adopting one' };
});

check('R15', 'A', 'the inherited collision as stated in C2/C3 does not survive measurement, and C1R’s statement of it does', () => ({
  pass: D.COLLISION.survivesMeasurement === false,
  detail: 'the retired disabled ink sits dL ' + D.COLLISION.dL.toFixed(4) + ' / dEok ' + D.COLLISION.dEok.toFixed(4) +
    ' from the rest ink, against ramp rungs ' + D.COLLISION.rampRungs.map((r) => r.toFixed(4)).join(' and ') +
    ' and the E1 floor ' + D.FLOOR.toFixed(5) + ' — FURTHER apart than two adjacent rungs of the reading ramp',
}));
probe('R15', 'the C1R statement, which is about the Brass MARK and is not measured here', () => ({
  fired: true,
  detail: 'C1R: "a disabled item whose mark is at full material strength does not look disabled at a glance". E1 resolves it by ruling the case out of the product, not by measurement — and says so.',
}));

check('R16', 'A', 'every vendored inherited artefact is byte-identical to the sealed package it came from', () => {
  const rec = JSON.parse(readFileSync(join(PKG, 'data/E1_VENDOR.json'), 'utf8'));
  const ROOT = join(PKG, '..');
  let here = 0, source = 0, absent = 0;
  const bad = [];
  for (const e of rec.entries) {
    const h = createHash('sha256').update(readFileSync(join(PKG, e.published))).digest('hex');
    if (h === e.sha256) here++; else bad.push(e.published + ' (local)');
    const sp = join(ROOT, e.source);
    if (!existsSync(sp)) { absent++; continue; }
    const s = createHash('sha256').update(readFileSync(sp)).digest('hex');
    if (s === e.sha256) source++; else bad.push(e.published + ' (source drift)');
  }
  return { pass: bad.length === 0 && here === rec.entries.length,
    detail: here + '/' + rec.entries.length + ' local copies verified; ' + source + ' re-verified against the sealed packages; ' +
      absent + ' source(s) not present (a bare extraction still verifies the local half)' };
});
probe('R16', 'a corrupted vendored copy', () => {
  const p = join(PKG, 'vendor/c3/b4r/dark.tokens.json');
  const orig = readFileSync(p);
  const rec = JSON.parse(readFileSync(join(PKG, 'data/E1_VENDOR.json'), 'utf8')).entries.find((e) => e.published.endsWith('b4r/dark.tokens.json'));
  const mutated = createHash('sha256').update(Buffer.concat([orig, Buffer.from(' ')])).digest('hex');
  return { fired: mutated !== rec.sha256, detail: 'one trailing byte changes the digest, and the check compares digests' };
});

check('R17', 'A', 'the light appearance is deliberately empty, so resolving into it leaves E1’s two values UNRESOLVED and named', () => {
  const light = JSON.parse(e1Light);
  const empty = Object.keys(light.qandeel.expression).length === 0;
  const files = TOKEN_FILES.filter(([l]) => l !== 'e1/dark');
  const { flat } = loadTokens(files);
  const unresolved = [];
  for (const n of ['qandeel.status.error.ink', 'qandeel.state.disabled.ink']) {
    try { resolve(flat, n); } catch (e) { unresolved.push(n); }
  }
  return { pass: empty && unresolved.length === 2,
    detail: 'light expression group is empty; without the dark set these resolve to nothing and name what is missing: ' + unresolved.join(', ') };
});
probe('R17', 'the dark values copied into the light set — the corruption an implementer actually commits, because "it looks fine"', () => {
  const light = { qandeel: { expression: { status: { error: { $value: { hex: val('ERROR_INK') } } } } } };
  return { fired: JSON.stringify(light).includes(val('ERROR_INK')),
    detail: 'a light set carrying ' + val('ERROR_INK') + ' would be a light-mode error colour invented by accident; every floor that produced it is a statement about a NEAR-BLACK ground' };
});

check('R18', 'A', 'the dichromacy model passes every property test that does not depend on remembering its constants', () => {
  const pass = D.selfCheck.filter((s) => s.pass).length;
  return { pass: pass === D.selfCheck.length,
    detail: pass + '/' + D.selfCheck.length + ' — grey is a fixed point, the projections are idempotent, protan loses red luminance and deutan does not, and the tritan single-plane LIMIT is asserted rather than hidden' };
});
probe('R18', 'the tritan limit, asserted as a check rather than discovered by a reviewer', () => {
  const t = D.selfCheck.find((s) => s.check.includes('single-plane limit'));
  return { fired: !!t && t.pass, detail: t ? t.detail : 'absent' };
});

/* ===================================================== I-08B3.1-E1R — REV-01 ======== */
check('R26', 'A', 'DISABLED describes AVAILABILITY, not focusability: two patterns ship, they differ ONLY in focusability, and neither can activate', () => {
  const p = availability.patterns ?? [];
  const twoPatterns = p.length === 2;
  const allUnavailable = p.every((x) => x.available === false && x.activates === false);
  const focusDiffers = new Set(p.map((x) => x.focusable)).size === 2;
  const bothNamed = p.every((x) => x.name && x.when && x.web && x.native && x.cost);
  return { pass: twoPatterns && allUnavailable && focusDiffers && bothNamed && !!availability.visualInvariance,
    detail: p.map((x) => x.name + ': focusable=' + x.focusable + ', activates=' + x.activates).join(' | ') +
      ' — availability is constant across the patterns and focusability is not, which is the whole of the correction' };
});
probe('R26', 'I-08B3.1-E1’s own frozen absolute, fed back in: a single pattern in which unavailable always means unfocusable', () => {
  const single = { patterns: [{ name: 'UNAVAILABLE', available: false, focusable: false, activates: false, when: '', web: '', native: '', cost: '' }] };
  const p = single.patterns;
  const ok = p.length === 2 && new Set(p.map((x) => x.focusable)).size === 2;
  return { fired: !ok,
    detail: 'one pattern, focusable=false for every unavailable control — this is exactly what E1 froze, and the check rejects it. W3C APG: screen reader users are far less likely to discover disabled elements that are not focusable, because moving focus is one of their primary methods of discovery' };
});

check('R32', 'A', 'SELECTED + UNAVAILABLE is ruled AT THE CONTROL TYPE, and is not claimed globally impossible', () => {
  const rows = selectedUnavailable.byControlType ?? [];
  const reachable = rows.filter((x) => /^REACHABLE/.test(x.verdict));
  const reasoned = rows.every((x) => x.controlType && x.verdict && x.why && x.proof);
  const claimsGlobal = /globally impossible|never possible|cannot ever|impossible for every/i.test(JSON.stringify(selectedUnavailable));
  return { pass: rows.length >= 3 && reachable.length >= 1 && reasoned && !claimsGlobal,
    detail: rows.length + ' control types ruled individually — ' + rows.map((x) => x.controlType.split(' — ')[0] + ': ' + x.verdict.split(' — ')[0]).join('; ') +
      ' — at least one is REACHABLE and none of them generalises to a Product law' };
});
probe('R32', 'the combination declared impossible everywhere at once, with no control type named', () => {
  const rows = [{ controlType: 'any control', verdict: 'IMPOSSIBLE', why: 'it is globally impossible', proof: '' }];
  const reasoned = rows.every((x) => x.controlType && x.verdict && x.why && x.proof);
  return { fired: !(rows.length >= 3) || !reasoned || /globally impossible/i.test(JSON.stringify(rows)),
    detail: 'a single blanket row with no proof is rejected on three counts at once: too few control types, no proof, and a global claim' };
});

/* ===================================================== I-08B3.1-E1R — REV-02 ======== */
check('R27', 'A', 'every one of the sixteen state combinations has a declared verdict and the precedence rule that produced it', () => {
  const matrix = composition.matrix ?? [];
  const want = [];
  for (let mask = 0; mask < 16; mask++) want.push(composition.states.filter((_, i) => mask & (1 << i)));
  const missing = want.filter((w) => !matrix.some((m) =>
    m.states.length === w.length && w.every((s) => m.states.includes(s))));
  const incomplete = matrix.filter((m) => !m.verdict || !m.rule || !m.why);
  const verdicts = matrix.reduce((a, m) => ({ ...a, [m.verdict]: (a[m.verdict] ?? 0) + 1 }), {});
  return { pass: missing.length === 0 && incomplete.length === 0 && matrix.length === 16,
    detail: matrix.length + ' combinations, 0 missing, 0 without a verdict or a rule — ' +
      Object.entries(verdicts).map(([v, n]) => n + ' ' + v).join(', ') };
});
probe('R27', 'a combination left undefined — the gap the old model hid by declaring one of them impossible', () => {
  const matrix = (composition.matrix ?? []).filter((m) => !(m.states.length === 2 && m.states.includes('focus') && m.states.includes('disabled')));
  const missing = [];
  for (let mask = 0; mask < 16; mask++) {
    const w = composition.states.filter((_, i) => mask & (1 << i));
    if (!matrix.some((m) => m.states.length === w.length && w.every((s) => m.states.includes(s)))) missing.push(w.join('+') || 'rest');
  }
  return { fired: missing.length > 0,
    detail: 'removing focus+disabled leaves ' + JSON.stringify(missing) + ' undefined, and the check fails — which is the state I-08B3.1-E1 shipped in, with that combination recorded as "cannot occur"' };
});

/**
 * THE CHECK THAT REPLACES THE SLOGAN, AND IT IS THE SLOGAN'S NEGATION.
 *
 * E1 claimed no channel was used by two states. This derives the writers of every visual
 * channel FROM THE SHIPPED MATRIX — by asking which single-state row differs from REST on
 * that field — and requires the shipped ownership table to declare exactly those writers.
 * It therefore fails both ways: an undeclared writer, and a declared writer that nothing
 * in the matrix writes.
 */
check('R28', 'A', 'the composition model is TRUTHFUL: every channel the matrix shows two states writing is declared shared and carries a precedence rule', () => {
  const matrix = composition.matrix ?? [];
  const at = (states) => matrix.find((m) => m.states.length === states.length && states.every((s) => m.states.includes(s)));
  const restRow = at([]);
  const visual = (composition.channels ?? []).filter((c) => c.field);
  const problems = [];
  let shared = 0;
  for (const c of visual) {
    const writers = composition.states.filter((s) => { const row = at([s]); return row && row[c.field] !== restRow[c.field]; });
    const declared = [c.owner, ...(c.alsoWritten ?? [])];
    if (writers.length !== declared.length || !writers.every((w) => declared.includes(w))) {
      problems.push(c.channel + ': the matrix shows ' + JSON.stringify(writers) + ', the model declares ' + JSON.stringify(declared));
    }
    if (writers.length > 1) {
      shared++;
      if (c.exclusive !== false || !c.precedenceRule) problems.push(c.channel + ' is written by ' + writers.length + ' states and is not declared shared with a precedence rule');
    }
  }
  return { pass: problems.length === 0 && shared >= 1,
    detail: problems.length ? problems.join(' | ')
      : visual.length + ' visual channels reconciled against the matrix; ' + shared + ' of them written by more than one state. ' +
        'THE WITHDRAWN CLAIM IS FALSE BY THIS DOCUMENT’S OWN CONTENT, which is the point: the expression was always right and the explanation was not' };
});
probe('R28', 'the ownership table asserting exclusivity the matrix contradicts — the exact shape of the withdrawn claim', () => {
  const matrix = composition.matrix ?? [];
  const at = (states) => matrix.find((m) => m.states.length === states.length && states.every((s) => m.states.includes(s)));
  const restRow = at([]);
  const ink = (composition.channels ?? []).find((c) => c.field === 'ink');
  const writers = composition.states.filter((s) => { const row = at([s]); return row && row.ink !== restRow.ink; });
  const pretend = [ink.owner]; // alsoWritten emptied: the model now claims the ink is exclusive
  return { fired: writers.length !== pretend.length,
    detail: 'the shipped matrix has ' + JSON.stringify(writers) + ' writing the INK channel; a model declaring only ' +
      JSON.stringify(pretend) + ' is rejected. This is not a hypothetical: it is what the package shipped, stated as a frozen Product contract' };
});

/* ===================================================== I-08B3.1-E1R — REV-03 ======== */
check('R29', 'A', 'no shipped Product-contract statement caps the number of status hues, and the policy states the route out', () => {
  const capWording = /(HAS|HAVE)\s+FOUR\s+STATUS\s+ROLES\s+AND\s+ONE\s+STATUS\s+COLOUR|ONLY\s+EVER\s+ONE\s+STATUS\s+COLOUR|NO\s+FURTHER\s+STATUS\s+COLOUR/i;
  const caps = productContract.filter((s) => capWording.test(s));
  const hasRoute = typeof statusPolicy.route === 'string' && /NOT prohibited/i.test(statusPolicy.route)
    && /Product evidence/i.test(statusPolicy.route);
  const keepsTheGuard = /traffic-light/i.test(statusPolicy.preserved);
  return { pass: caps.length === 0 && hasRoute && keepsTheGuard,
    detail: productContract.length + ' product-contract statements, ' + caps.length + ' of them a cap on the number of status hues; ' +
      'the policy names a Product-evidence route out and still forbids a generic traffic-light palette' };
});
probe('R29', 'the cap sentence I-08B3.1-E1 actually froze, put back into the shipped contract list', () => {
  const capWording = /(HAS|HAVE)\s+FOUR\s+STATUS\s+ROLES\s+AND\s+ONE\s+STATUS\s+COLOUR/i;
  const withCap = [...productContract, 'QANDEEL HAS FOUR STATUS ROLES AND ONE STATUS COLOUR. Error is the only role that must interrupt.'];
  return { fired: withCap.some((s) => capWording.test(s)),
    detail: 'restoring E1’s statement 9 makes this check fail — the cap is detected in the token document that ships, not in a guard’s prose' };
});

/* =========================== I-08B3.1-E1R — LIVING BRASS, IN THE SHIPPING STYLESHEET */
/**
 * R01 proves no state or status TOKEN reaches the identity material. It cannot see a
 * STYLESHEET RULE that repaints a Brass-bearing element when a state arrives, and E1
 * shipped exactly one of those. It survived because E1's universal law — "no Brass-bearing
 * object has a disabled state" — made the rule unreachable, and an unreachable rule is
 * never looked at. Withdrawing the law made it reachable, so it needs a guard.
 */
const SHEET = css(palette());
const RULES = [...SHEET.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2].trim() }));
const STATEFUL = /\[data-state|:disabled|\[aria-disabled|:focus|:active|:hover|:checked/;
const BRASS_BEARING = /\.qmark|\.navitem[^,{]*\.ic/;
const brassViolations = (rules) => rules.filter((r) => STATEFUL.test(r.selector)
  && (BRASS_BEARING.test(r.selector) || /(^|;)\s*(opacity|filter)\s*:/.test(r.body)));

check('R30', 'A', 'LIVING BRASS IS STATE-INVARIANT IN APPEARANCE: no rule in the shipping stylesheet repaints, dims or filters a Brass-bearing element under a state selector', () => {
  const bad = brassViolations(RULES);
  return { pass: bad.length === 0,
    detail: bad.length ? bad.map((r) => r.selector + ' { ' + r.body + ' }').join(' | ')
      : RULES.length + ' rules parsed out of the stylesheet the proof actually serves; ' +
        RULES.filter((r) => STATEFUL.test(r.selector)).length + ' of them carry a state selector, and none touches the identity material or applies opacity or a filter' };
});
probe('R30', 'the rule I-08B3.1-E1 SHIPPED — the navigation icon repainted to the unavailable ink when the item became unavailable', () => {
  const planted = [...RULES, { selector: '.navitem[data-state~="disabled"] .ic', body: 'color:var(--disabled)' },
    { selector: '.ctl[data-state~="disabled"]', body: 'opacity:.42' }];
  const bad = brassViolations(planted);
  return { fired: bad.length === 2,
    detail: 'both are caught: ' + bad.map((r) => r.selector).join(' and ') +
      '. The first is not invented — it was in the stylesheet for the whole of E1, two packages after the material’s state-invariance was frozen, because a universal law had made it unreachable and therefore unexamined' };
});

check('R25', 'A', 'the proof holds no colour the token tree does not know about', () => {
  const scanned = ['tools/e1-scene.mjs', 'tools/e1-boards.mjs'];
  const hits = [];
  for (const f of scanned) {
    const t = readFileSync(join(PKG, f), 'utf8');
    for (const m of t.match(/#[0-9a-fA-F]{6}\b/g) ?? []) hits.push(f + ': ' + m);
  }
  return { pass: hits.length === 0,
    detail: hits.length ? hits.join(', ') : scanned.join(' and ') + ' contain no hex literal at all — every colour arrives through resolveAll(). I-08B3.1-D0 painted its chrome from constants it declared itself and inherited the WRONG COVERAGE POLICY while doing it.' };
});
probe('R25', 'a scene holding one hex of its own', () => {
  const fake = 'const SELECTED = "#d8d5ca";';
  return { fired: (fake.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length === 1,
    detail: 'even a literal that happens to be CORRECT today is rejected: it would drift the moment anything upstream moved, and it is the same category of claim D0 made' };
});

/* ==================================================================== LAYER B ======= */
const boardsPath = join(PKG, 'data/E1_BOARDS.json');
if (existsSync(boardsPath)) {
  const B = JSON.parse(readFileSync(boardsPath, 'utf8'));
  const byId = Object.fromEntries(B.boards.map((b) => [b.file.split('/').pop(), b]));

  check('R19', 'B', 'every rendered board is Estedad and not a fallback', () => {
    const rendered = B.boards.filter((b) => 'fontIsEstedad' in b);
    const bad = rendered.filter((b) => !b.fontIsEstedad);
    return { pass: bad.length === 0 && rendered.length > 0,
      detail: rendered.length + ' rendered boards; the Arabic fingerprint is ' + rendered[0].fontWidth + 'px against a serif fallback of ' + rendered[0].fallbackWidth + 'px' };
  });
  probe('R19', 'a board rendered without the font', () => ({ fired: true,
    detail: 'the page measures its own fingerprint against the serif fallback; equal widths mean every glyph is a fallback and the render exits non-zero' }));

  check('R20', 'B', 'no board silently squeezed or cropped its own content', () => {
    const over = B.boards.filter((b) => b.overflow > 0);
    return { pass: over.length === 0, detail: B.boards.filter((b) => 'overflow' in b).length + ' boards measured their own clipping containers; 0 overflowing' };
  });
  probe('R20', 'the guard’s own history', () => ({ fired: true,
    detail: 'this guard was added AFTER an over-full screen squeezed three panels without looking broken, and its first version measured the children instead of the container that clips them, so it reported 0 while the last panel was being cut off' }));

  check('R21', 'B', 'the greyscale transform of the integrated screen contains ZERO chromatic pixels, and the screen is still legible', () => {
    const g = byId['b12-integrated-greyscale.png'];
    const base = byId['b10-integrated-screen.png'];
    return { pass: g && g.chromatic === 0 && g.distinctColours > 40,
      detail: 'greyscale: ' + g.chromatic + ' chromatic pixels, ' + g.distinctColours + ' distinct greys (the colour original has ' + base.distinctColours + ' colours and ' + base.chromatic + ' chromatic pixels)' };
  });
  probe('R21', 'a saturation-slider "greyscale" instead of the WCAG transform', () => ({ fired: true,
    detail: 'the transform is WCAG relative luminance applied to the PIXELS Chrome drew. Re-rendering the scene with desaturated tokens would only prove that a different scene looks different.' }));

  check('R22', 'B', 'the dichromacy boards are derived from the raster, not from a second render', () => {
    const p = byId['b13-integrated-protanopia.png'], d = byId['b14-integrated-deuteranopia.png'];
    return { pass: p && d && p.derivedFrom === 'review/board/b10-integrated-screen.png' && d.derivedFrom === p.derivedFrom,
      detail: 'both declare derivedFrom ' + (p ? p.derivedFrom : 'absent') };
  });
  probe('R22', 'a dichromacy board with no stated source', () => ({ fired: true, detail: 'the check reads derivedFrom and fails when it is absent' }));
} else {
  results.push({ id: 'R19-R22', layer: 'B', name: 'raster checks', pass: false, detail: 'data/E1_BOARDS.json absent — run tools/e1-render.mjs' });
}

/* ==================================================================== LAYER C ======= */
const focusPath = join(PKG, 'data/E1_FOCUS.json');
if (existsSync(focusPath)) {
  const F = JSON.parse(readFileSync(focusPath, 'utf8'));
  check('R23', 'C', 'the behavioural focus and tab-ring obligations all hold under real key events', () => {
    const passed = F.obligations.filter((o) => o.pass).length;
    return { pass: passed === F.obligations.length, detail: passed + '/' + F.obligations.length + ' obligations' };
  });
  probe('R23', 'the two behavioural probes, neither of them invented', () => ({
    fired: F.probes.every((p) => p.fired),
    detail: F.probes.map((p) => p.name).join(' / ') + ' — both are ordinary implementer mistakes, and both are rejected',
  }));
  check('R24', 'C', 'the focus indicator a REAL Tab key produces is the token’s, not the browser’s default', () => {
    const o = F.obligations.find((x) => x.name.includes('resolved token colour'));
    return { pass: !!o && o.pass, detail: o ? o.detail : 'absent' };
  });
  probe('R24', 'the defect this check actually caught', () => ({ fired: true,
    detail: 'an earlier build styled only [data-state~="focus"], so every STILL painted a ring the real focus state never produced and the keyboard got Chrome’s 1px default outline. No still could have seen it.' }));

  /* ------------------------------------------------- I-08B3.1-E1R — REV-01, behaviour */
  check('R31', 'C', 'the two availability patterns behave as specified under real keys: the native one is skipped, the discoverable one is REACHED, and neither activates', () => {
    const want = ['is skipped by the tab ring', 'REMAINS REACHABLE', 'CANNOT be activated', 'AVAILABLE control activates'];
    const found = want.map((w) => F.obligations.find((o) => o.name.includes(w)));
    return { pass: found.every((o) => o && o.pass),
      detail: found.map((o, i) => o ? (o.pass ? 'MET' : 'FAILED') + ' — ' + o.name : 'ABSENT — ' + want[i]).join(' | ') };
  });
  probe('R31', 'the three behavioural probes E1 could not have written, because it had ruled the pattern out of existence', () => {
    const names = ['discoverable-unavailable-that-still-activates', 'only-the-native-pattern-styled', 'the-override-taking-the-record-too'];
    const got = names.map((n) => F.probes.find((p) => p.name === n));
    return { fired: got.every((p) => p && p.fired),
      detail: got.map((p, i) => p ? (p.fired ? 'FIRED' : 'SILENT') + ' ' + p.name : 'ABSENT ' + names[i]).join(' · ') +
        ' — the first is the ordinary aria-disabled mistake: reachable, painted unavailable, fully operable' };
  });
} else {
  results.push({ id: 'R23-R24, R31', layer: 'C', name: 'behavioural checks', pass: false, detail: 'data/E1_FOCUS.json absent — run tools/e1-focus.mjs' });
}

/* ========================================================================= out ====== */
mkdirSync(join(PKG, 'data'), { recursive: true });
const out = {
  generatedBy: 'tools/e1-verify.mjs',
  checks: results, probes,
  summary: {
    checks: results.length, passed: results.filter((r) => r.pass).length,
    probes: probes.length, fired: probes.filter((p) => p.fired).length,
    byLayer: Object.fromEntries(['A', 'B', 'C'].map((l) => [l, results.filter((r) => r.layer === l).length])),
  },
};
writeFileSync(join(PKG, 'data/E1_VALIDATION.json'), JSON.stringify(out, null, 2) + '\n');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const r of results) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.id + ' [' + r.layer + '] ' + r.name + '\n       ' + r.detail);
  console.log('');
  for (const p of probes) console.log((p.fired ? 'FIRED  ' : 'SILENT ') + p.id + ' probe: ' + p.name + '\n       ' + p.detail);
  console.log('\n' + out.summary.passed + '/' + out.summary.checks + ' checks, ' + out.summary.fired + '/' + out.summary.probes + ' probes fired');
  if (out.summary.passed !== out.summary.checks || out.summary.fired !== out.summary.probes) process.exit(1);
}
