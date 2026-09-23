/**
 * I-08B3.1-F1 — THE CONSISTENCY CHECK.
 *
 * It reads the SHIPPED ARTEFACTS BACK FROM DISK — the authored documents, the token files, the
 * README — and checks every load-bearing number and claim in them against the data the tools
 * produced. A document and its evidence cannot disagree without this saying so.
 *
 * THIS EXISTS BECAUSE OF A SPECIFIC FAILURE MODE THIS TRACK HAS SEEN: a contract corrected in
 * one document while a token `$description` and a board caption went on carrying the withdrawn
 * claim. **A correction is not done until every generated surface agrees.** So the check is on
 * the surfaces, not on the intentions.
 *
 * IT EXCLUDES ITS OWN REPORT BY PATH, because a report about a stale number has to be able to
 * name the stale number.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const read = (f) => JSON.parse(readFileSync(join(PKG, f), 'utf8'));
const text = (f) => readFileSync(join(PKG, f), 'utf8');

const D = read('data/F1_DERIVATION.json');
const V = read('data/F1_VALIDATION.json');
const P = read('data/F1_PARITY.json');
const M = read('data/F1_MOTION.json');
const S = read('data/F1_SCREEN_READER.json');
const SP = read('data/F1_SPECTACLE.json');
const K = read('data/F1_SKILLS.json');
const R = read('data/F1_REFERENCES.json');
/* added by I-08B3.1-F1R */
const I = read('data/F1_INHERITED_DEFAULT.json');
const KL = V.results.find((r) => r.id === 'K-01');

/** Every document F1 AUTHORS as prose. The generated ones are excluded: checking a document
 *  against the data it was generated from proves the generator ran. */
const AUTHORED = readdirSync(join(PKG, 'docs'))
  .filter((f) => f.endsWith('.md'))
  .filter((f) => !['F1_SKILL_GATE.md', 'F1_REFERENCE_GATE.md', 'F1_VALIDATION_RESULTS.md', 'F1_MANIFEST.md'].includes(f))
  .map((f) => 'docs/' + f)
  .concat(['README.md']);

/**
 * EACH SURFACE IS CARRIED TWICE: as it is written, and UNWRAPPED.
 *
 * I-08B3.1-F1R2 added `flat`, and it had to. Half the claims below look for a SENTENCE — "no
 * screen reader was run", "exhaustive against the actual user-exposable V schema" — and a sentence
 * in a hard-wrapped Markdown file is split across lines at whatever column it reached. Every one of
 * those claims was silently reporting MISSING for sentences that are plainly present, which is the
 * worst way for a staleness check to fail: it does not say the document is wrong, it says the
 * document is silent, and a reader believes it.
 *
 * The negative checks stay on `body` deliberately. A FORBIDDEN pattern uses `[^.\n]` to keep a
 * match inside one line, which is how it limits how far a claim may reach; flattening would let it
 * join two unrelated sentences and report a claim nobody made.
 */
/**
 * UNWRAPPING IS NOT THE SAME AS COLLAPSING WHITESPACE, and the first version of `flat` learned
 * that the hard way: a blockquote keeps its `>` in the middle of the reassembled sentence, and
 * `**bold**` splits a phrase wherever the emphasis happens to start. Both produced a MISSING for a
 * sentence sitting in plain sight two lines apart.
 *
 * So `flat` strips the LINE-LEADING Markdown furniture and then the inline emphasis characters,
 * and is used only for "does this sentence appear" questions.
 */
const unwrap = (body) => body
  .split('\n')
  .map((l) => l.replace(/^\s*(?:[>#]+|[-*+]\s|\d+\.\s)?\s*/, ''))
  .join(' ')
  .replace(/[*`_]/g, '')
  .replace(/\s+/g, ' ');

const CORPUS = AUTHORED.map((f) => {
  const body = text(f);
  return { f, body, flat: unwrap(body) };
});
const TOKENS = [
  'tokens/base/accessibility.tokens.json',
  'tokens/appearance/dark.accessibility.tokens.json',
  'tokens/contrast/increased.accessibility.tokens.json',
  'tokens/transparency/reduced.accessibility.tokens.json',
  'tokens/qandeel-accessibility.resolver.json',
].map((f) => ({ f, body: text(f) }));

const rows = [];
const claim = (what, expected, pass, where) => rows.push({ what, expected: String(expected), pass: !!pass, where });

/**
 * Does this string appear in at least one authored surface, as a WHOLE TOKEN?
 *
 * The first version used a plain substring test, and the citation column filled with documents
 * that merely happened to contain "18" inside "1.8" or "118". The assertion itself was still
 * right — it compares the data to the quoted string — but a citation list that names every
 * document is not a citation list, and a reviewer cannot use it. Numeric claims are matched on a
 * boundary so the column says where the number is actually quoted.
 */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inDocs = (s) => {
  const re = /^[\d./\s]+$/.test(s) ? new RegExp(`(^|[^\\d.])${esc(s)}([^\\d.]|$)`) : null;
  return CORPUS.filter((c) => (re ? re.test(c.body) : c.body.includes(s))).map((c) => c.f);
};
/** Does it appear in a token file? */
const inTokens = (s) => TOKENS.filter((c) => c.body.includes(s)).map((c) => c.f);

/* ---------------------------------------- the numbers the argument actually rests on ---- */
/**
 * THE CHECK CARRIES NO EXPECTED VALUE OF ITS OWN, and that is the second correction this file
 * needed. The first version listed, beside each measurement, the string it expected the
 * documents to quote — and those literals went stale the moment a test point was added to the
 * parity matrix and a file to the skill inventory. **A staleness check that can itself go stale
 * is one more surface to keep in sync.**
 *
 * So the assertion is now purely relational: take the number the TOOLS produced, and require it
 * to appear — as a whole token — in at least one authored surface. There is nothing here for a
 * later edit to invalidate except the data itself.
 */
const NUM = [
  ['the increased-contrast lightness delta', D.finding.lightnessDelta],
  ['the increased-contrast layer lightnesses', D.finding.layersAfter.join(' / ')],
  ['the worst contour after', D.finding.worstAfter],
  ['the loudest contour after', D.finding.bestAfter],
  ['the default hierarchy ratio', D.hierarchy.defaultRatio],
  ['the raised hierarchy ratio', D.finding.hierarchyRatioAfter],
  ['the weakest analytical object, default', D.hierarchy.defaultWeakestAnalytical],
  ['the weakest analytical object, raised', D.hierarchy.raisedWeakestAnalytical],
  ['the loudest contour, default', D.hierarchy.defaultLoudestContour],
  ['the stroke substitutions', D.transparency.strokeCount],
  ['the fill substitutions', D.transparency.fillCount],
  ['the parity cell count', P.matrix.cellCount],
  ['the parity expression count', P.matrix.expressions.length],
  ['the motion inventory size', M.counts.total],
  ['the motions inherited from D2R', M.counts.ownedByD2R],
  ['the motions added by F1', M.counts.addedByF1],
  ['the check count', V.checks],
  ['the AX nodes read', S.checks.axNodes],
  ['the analytical objects in the projection', S.checks.expectedObjects],
  ['the skill files enumerated', K.inventoried],
  ['the reference count', R.count],
  /* ------------------------------------------------ the I-08B3.1-F1R repairs ------------ */
  ['the planted removals', P.matrix.planted.length],
  ['the inherited-layer elements compared by attribute', I.i01.elementsCompared],
  ['the analysis-layer elements compared by geometry', I.i03.elementsCompared],
  ['the token values F1 authors', KL.detail.tokens],
  ['the product-contract tokens', KL.detail.byClass['product-contract']],
  ['the production-default tokens', KL.detail.byClass['production-default']],
  ['the implementation-strategy tokens', KL.detail.byClass['implementation-strategy']],
];
for (const [what, actual] of NUM) {
  const cited = inDocs(String(actual));
  claim(`${what} = ${actual} — is it cited in an authored surface?`, actual, cited.length > 0, cited.join(', ') || 'NOT CITED ANYWHERE');
}

/* ------------------------------------------- claims that must appear, and must be true -- */
claim('the ablation passed and the documents say the default is byte-identical',
  'byte-identical',
  SP.raw.ablation.pass && inDocs('byte-identical').length > 0,
  inDocs('byte-identical').join(', '));

/**
 * AND THIS ONE HAD THE VERY DEFECT THE HEADER OF THIS FILE WARNS ABOUT.
 *
 * It read `inDocs('31/31 probes')` — a literal count typed into the check — and went stale the
 * moment I-08B3.1-F1R took the verifier from 31 checks to 52. A staleness check that can itself
 * go stale is one more surface to keep in sync. The count is now BUILT FROM THE DATA, so there
 * is nothing here for a later edit to invalidate except the data.
 */
const probeClaim = `${V.probes.rejecting}/${V.probes.total} probes`;
claim('every probe rejects, and the documents claim it in those terms',
  probeClaim,
  V.probes.rejecting === V.probes.total && CORPUS.some((c) => c.body.includes(probeClaim)),
  CORPUS.filter((c) => c.body.includes(probeClaim)).map((c) => c.f).join(', ') || 'NOT CITED ANYWHERE');

/**
 * AND THE OTHER HALF OF THAT CLAIM, WHICH I-08B3.1-F1R2 HAD TO ADD AFTER FINDING WHAT IT MISSED.
 *
 * The check above asserts the CURRENT count appears SOMEWHERE. It did — and meanwhile
 * `F1_ACCESSIBILITY_CONTRACT.md` §8 still read "31/31 checks pass, 31/31 probes reject", F1's
 * count, left behind when F1R took the verifier to 52. A green consistency run and a document
 * quoting a number two revisions old, at the same time.
 *
 * "At least one surface is right" is a weaker property than anyone reading that line would assume.
 * So: EVERY `n/n checks` or `n/n probes` figure quoted anywhere in the corpus must be the current
 * one. The withdrawal window applies, because a revision record has to be able to say what the
 * count USED to be.
 */
const COUNT_CLAIM = /(\d{1,3})\s*\/\s*(\d{1,3})\s*(checks|probes)/gi;
const staleCounts = [];
for (const c of CORPUS) {
  const lines = c.body.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(COUNT_CLAIM)) {
      const [, a, b, kind] = m;
      const current = kind.toLowerCase() === 'checks' ? [V.passed, V.checks] : [V.probes.rejecting, V.probes.total];
      if (Number(a) === current[0] && Number(b) === current[1]) continue;
      const window = lines.slice(Math.max(0, i - 2), i + 3).join(' ').replace(/\s+/g, ' ');
      if (/was |used to|withdraw|F1 shipped|before I-08B3\.1-F1R|up from|previously/i.test(window)) continue;
      staleCounts.push(`${c.f}:${i + 1} "${m[0]}"`);
    }
  });
}
claim('NO surface quotes a stale check or probe count',
  `${V.passed}/${V.checks} checks, ${V.probes.rejecting}/${V.probes.total} probes`,
  staleCounts.length === 0,
  staleCounts.join(' · ') || 'every quoted count is current');

claim('F1 introduces no colour literal, and the ONE computed substitution is named',
  '#080808',
  inTokens('#080808').length > 0 && inDocs('#080808').length > 0,
  [...inTokens('#080808'), ...inDocs('#080808')].join(', '));

claim('the chroma ceiling is quoted correctly wherever it appears',
  '0.0197',
  inDocs('0.0197').length > 0,
  inDocs('0.0197').join(', '));

claim('the North Star painted-pixel ratio is cited, not only the framing ratios',
  '1.41',
  inDocs('1.41').length > 0,
  inDocs('1.41').join(', '));

/* ---------------------------------------------------- the I-08B3.1-F1R claims ----------- */
/**
 * THE DEFAULT RASTER HASH IS CARRIED IN THE DOCUMENTS, not only in a data file, because "the
 * pixels did not change" is the single claim a reviewer of this revision most needs to be able
 * to check without running anything. A short prefix is enough to be checkable and short enough
 * to read; the full value is in data/F1_SPECTACLE.json.
 */
const defaultPng = SP.raw.ablation.defaultHash.png;
claim('the DEFAULT raster sha256 is quoted in an authored surface',
  defaultPng.slice(0, 16),
  inDocs(defaultPng.slice(0, 16)).length > 0,
  inDocs(defaultPng.slice(0, 16)).join(', ') || 'NOT CITED ANYWHERE');

claim('the inherited layer is stated as PIXEL-IDENTICAL to a reference built from D2R\'s exports',
  'pixel-identical',
  I.i02.identical && CORPUS.some((c) => /pixel-identical/i.test(c.body)),
  CORPUS.filter((c) => /pixel-identical/i.test(c.body)).map((c) => c.f).join(', ') || 'NOT STATED');

claim('DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION is named, so the narrower claim has a name',
  'DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION',
  CORPUS.some((c) => /DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION/.test(c.body)),
  CORPUS.filter((c) => /DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION/.test(c.body)).map((c) => c.f).join(', ') || 'NOT NAMED');

claim('the synthetic fixture\'s provenance appears in the documents, not only in the data',
  'SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA',
  CORPUS.some((c) => c.body.includes('SYNTHETIC TEST FIXTURE')),
  CORPUS.filter((c) => c.body.includes('SYNTHETIC TEST FIXTURE')).map((c) => c.f).join(', ') || 'NOT STATED');

claim('ACCESSIBLE SEMANTICS = PROJECT(V) is stated in the documents AND in the token tree',
  'PROJECT(V)',
  CORPUS.some((c) => /PROJECT\(V\)/.test(c.body)) && inTokens('project-V').length > 0,
  [...CORPUS.filter((c) => /PROJECT\(V\)/.test(c.body)).map((c) => c.f), ...inTokens('project-V')].join(', '));

/* ---------------------------------------------------- the I-08B3.1-F1R2 claims --------- */
claim('the parity proof is described as BOUNDED to the dimensions the fixture supplies',
  'bounded',
  P.matrix.scope?.exhaustive === false && CORPUS.some((c) => /bounded/i.test(c.body)),
  CORPUS.filter((c) => /bounded/i.test(c.body)).map((c) => c.f).join(', ') || 'NOT STATED');

const DEPENDENCY = /EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V SCHEMA/i;
claim('the completeness contract is stated in the documents AND in the token tree',
  'exhaustive-against-user-exposable-V',
  CORPUS.some((c) => DEPENDENCY.test(c.flat)) && inTokens('exhaustive-against-user-exposable-V').length > 0,
  [...CORPUS.filter((c) => DEPENDENCY.test(c.flat)).map((c) => c.f),
    ...inTokens('exhaustive-against-user-exposable-V')].join(', '));

claim('the disclosure boundary is stated in the documents AND in the token tree',
  'same-V-fail-closed',
  S.disclosure?.pass === true && CORPUS.some((c) => /FAIL CLOSED/i.test(c.flat)) && inTokens('same-V-fail-closed').length > 0,
  [...CORPUS.filter((c) => /FAIL CLOSED/i.test(c.flat)).map((c) => c.f), ...inTokens('same-V-fail-closed')].join(', '));

const NO_CLIP = /ARABIC TEXT MUST NOT CLIP/i;
claim('the Arabic Product contract is stated as NO CLIPPING rather than as a line-height number',
  'adequate-glyph-extents',
  inTokens('adequate-glyph-extents').length > 0 && CORPUS.some((c) => NO_CLIP.test(c.flat)),
  [...CORPUS.filter((c) => NO_CLIP.test(c.flat)).map((c) => c.f), ...inTokens('adequate-glyph-extents')].join(', '));

claim('the measured minimum Arabic leading ratio is cited, not only the verdict',
  P.text[0].minMeasuredLeadingRatio,
  inDocs(String(P.text[0].minMeasuredLeadingRatio)).length > 0,
  inDocs(String(P.text[0].minMeasuredLeadingRatio)).join(', ') || 'NOT CITED ANYWHERE');

claim('the North Star is stated as an OPEN obligation owned by G',
  'G — INTEGRATED PRODUCT PROOF',
  SP.verdict.northStarStatus?.state?.startsWith('OPEN') && CORPUS.some((c) => /G — INTEGRATED PRODUCT PROOF/.test(c.body)),
  CORPUS.filter((c) => /G — INTEGRATED PRODUCT PROOF/.test(c.body)).map((c) => c.f).join(', ') || 'NOT STATED');

/* ------------------------------------------------- withdrawn or forbidden claims -------- */
/**
 * THE NEGATIVE CHECKS. These are the sentences that MUST NOT appear anywhere, because each one
 * would be a claim this package deliberately does not make.
 */
const FORBIDDEN = [
  ['a frozen claim', /\bF1 is (now )?frozen\b/i],
  ['a claim that F is closed', /\bF is (now )?(closed|frozen)\b/i],
  ['a light-appearance design claim', /\bF1 (designs|defines|ships) (the )?[Ll]ight [Aa]ppearance\b/],
  /* TIGHTENED BY I-08B3.1-F1R2. The old pattern was `(VoiceOver|TalkBack) (was )?(run|tested)`,
     which fires on "a real VoiceOver RUN is a mandatory gate" — a sentence saying the opposite of
     the thing forbidden. A guard that cannot tell a claim from its denial makes the package harder
     to state the truth in, so it now requires the CLAIM's own grammar. */
  ['a claim that a screen reader was run', /\b(VoiceOver|TalkBack)\s+(was|has been|were)\s+(run|tested|used)\b/i],
  ['a claim of device validation', /\btested on (a )?device\b/i],
  ['a cross-platform parity claim for Reduce Transparency', /Reduce Transparency[^.]{0,40}\bon both platforms\b/i],
  /* added by I-08B3.1-F1R: the two overclaims the independent review found */
  ['a claim that the ablation proves the pre-F1 default unchanged', /ablation[^.\n]{0,80}proves[^.\n]{0,60}(D2R|pre-F1|inherited)[^.\n]{0,40}unchanged/i],
  ['a claim that North Star spectacle capacity is proven', /(North Star|spectacle)[^.\n]{0,60}capacity[^.\n]{0,30}\b(is|has been)\s+(proven|demonstrated|met)\b/i],
  ['the withdrawn "Product\'s own stable identity order"', /the Product's own stable identity order(?![^\n]{0,80}(withdraw|F1R|no supplied|gave a technical))/i],
  /* added by I-08B3.1-F1R2: the four overclaims this revision withdraws */
  /* THE LOOKAHEAD WINDOWS CROSS LINE BREAKS ON PURPOSE. A retraction that lands on the next line
     is still a retraction, and `[^\n]` would have made every one of these fire on the paragraph
     doing the retracting — the same defect check G-02 had to fix. */
  ['a claim that the fixture\'s field list is the complete semantic model', /complete list of what a projection may carry(?![\s\S]{0,160}(withdraw|nothing of the sort|is not|NOT the complete))/i],
  ['a claim that the parity matrix proves every possible analytical fact', /(matrix|132 cells)[^.\n]{0,60}prov(es|en)[^.\n]{0,40}(every|all)[^.\n]{0,30}(semantic field|analytical fact)/i],
  ['a claim that 1.6 is an irreversible universal Arabic law', /1\.6[^.\n]{0,80}\b(irreversible|universal|never be (lowered|changed))\b(?![\s\S]{0,400}(withdraw|over-froze|is not|reclassif|production[- ]default|threshold|measured))/i],
  ['a claim that browser AX-tree evidence equals screen-reader validation', /(AX[- ]tree|accessibility tree|browser tree)[^.\n]{0,40}\b(is|equals|counts as|amounts to)\s+(a\s+|real\s+|the\s+)*(VoiceOver|TalkBack|screen[- ]reader validation|device validation)/i],
];
for (const [what, re] of FORBIDDEN) {
  const hits = CORPUS.filter((c) => re.test(c.body)).map((c) => c.f);
  claim(`NO ${what} appears anywhere`, 'absent', hits.length === 0, hits.join(', ') || 'absent');
}

/* --------------------------------- the limitations a reviewer must be able to find ------ */
const MUST_STATE = [
  ['no screen reader was run', /NO SCREEN READER WAS RUN/i],
  ['no device', /NO DEVICE/i],
  ['no native Arabic copy review', /NO NATIVE ARABIC COPY REVIEW/i],
  ['the crossing-contour difference', /cross/i],
  ['the dragging-movements obligation', /2\.5\.7|Dragging Movements/i],
  /* added by I-08B3.1-F1R */
  ['what the inherited-default proof does NOT verify', /remains unverified|not verified|does NOT claim the D2R renderer/i],
  ['that absence of a prohibition is not Product authority', /ABSENCE OF A PROHIBITION IS NOT PRODUCT AUTHORITY|NOT A PERMISSION/i],
  ['that D and E are CLOSED / FROZEN', /CLOSED \/ FROZEN/],
  ['that the CONNECTION is drawn and not named in the default map', /drawn and never named|drawn but not named/i],
  /* added by I-08B3.1-F1R2 */
  ['that the parity proof is BOUNDED to the tested dimensions', /bounded (proof|to the (tested|semantic) dimensions)/i],
  ['the production-mapping integration dependency', /EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V SCHEMA/i],
  ['that where V supplies no value the projection announces none', /(ABSENCE REMAINS ABSENCE|DOES NOT ANNOUNCE THAT\s+SEMANTIC VALUE|announces no value)/i],
  ['that the projection may not expand disclosure and fails closed', /FAIL CLOSED/i],
  ['that a device screen-reader run is a MANDATORY validation gate', /MANDATORY IMPLEMENTATION \/ INTEGRATION VALIDATION GATE/i],
  ['that browser AX-tree evidence is NOT screen-reader validation', /AX-tree evidence is not screen-reader/i],
  ['that a property encoding nothing is not a required semantic carrier', /encodes: null/i],
];
for (const [what, re] of MUST_STATE) {
  /* `flat`, because a sentence that wraps is still a sentence */
  const hits = CORPUS.filter((c) => re.test(c.flat)).map((c) => c.f);
  claim(`the package STATES: ${what}`, 'present', hits.length > 0, hits.join(', ') || 'MISSING');
}

/* ------------------------------------------------------------------ the self-probe ------ */
/** A number that is deliberately wrong, fed to the same predicate, so the failure branch is
 *  demonstrated on every run rather than only when a document goes stale. */
const probe = (() => {
  const wrong = '0.0139';
  return { input: `a lightness delta of ${wrong}, which no document quotes`, rejected: inDocs(wrong).length === 0 ? true : false };
})();

const passed = rows.filter((r) => r.pass).length;
const report = {
  generatedBy: 'tools/f1-consistency.mjs',
  note: 'Reads the SHIPPED documents and token files back from disk. Excludes the generated documents, which are generated from this same data, and excludes its own report by path.',
  surfacesRead: [...AUTHORED, ...TOKENS.map((t) => t.f)],
  claims: rows.length,
  passed,
  failed: rows.length - passed,
  probe,
  rows,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(join(PKG, 'data/F1_CONSISTENCY.json'), JSON.stringify(report, null, 2) + '\n');
  for (const r of rows) console.log((r.pass ? 'OK   ' : 'STALE') + '  ' + r.what.padEnd(78) + '  ' + r.where);
  console.log(`\n${passed}/${rows.length} surfaces agree | probe rejected a fabricated number: ${probe.rejected}`);
  if (passed !== rows.length) process.exit(1);
}
