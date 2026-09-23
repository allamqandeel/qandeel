/**
 * I-08B3.1-F1 — THE GENERATED DOCUMENTS.
 *
 * Four documents are GENERATED FROM THE DATA rather than written beside it: the skill gate, the
 * reference gate, the validation results and the manifest. Every number in them is read from the
 * JSON the tools produced, so a document and its evidence cannot disagree.
 *
 * The other documents in docs/ are authored prose — an argument is not a table — and
 * tools/f1-consistency.mjs reads those back from disk and checks every number they quote against
 * the same data. That split is deliberate: generate what is a table, write what is an argument,
 * and check the arguments against the tables.
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const read = (f) => JSON.parse(readFileSync(join(PKG, f), 'utf8'));
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/* ------------------------------------------------------------------- the skill gate ---- */
function skillGate() {
  const g = read('data/F1_SKILLS.json');
  const L = [];
  L.push('# I-08B3.1-F1 — SKILL GATE');
  L.push('');
  L.push('**GENERATED from `data/F1_SKILLS.json` by `tools/f1-skills.mjs`.** Every row below is a');
  L.push('file hashed on the executing host, not a name recalled from a listing.');
  L.push('');
  L.push(`**STATE: ${g.state}.** ${g.inventoried} skill files enumerated from disk across all three`);
  L.push('scopes — the project `.claude/skills`, the user `~/.claude/skills`, and `~/.claude/plugins`.');
  L.push('');
  L.push('> **P-STATE.** The recorded skills live on the executing host and shipping them would');
  L.push('> redistribute someone else\'s files, so a re-run on another machine returns');
  L.push(`> \`UNVERIFIABLE\` rather than PASS or FAIL. A probe feeds that branch a synthetic empty`);
  L.push(`> inventory on every run: **${g.probe.result}**`);
  L.push('');
  L.push('## USED — with the principle read and the concrete consequence in F1');
  L.push('');
  for (const r of g.rows.filter((x) => x.status === 'USED')) {
    L.push(`### ${r.name}`);
    L.push('');
    L.push(`\`${r.path}\``  );
    L.push('');
    L.push(`\`sha256 ${r.sha256}\` · ${r.bytes} B`);
    L.push('');
    L.push(`**Evidence read.** ${r.read}`);
    L.push('');
    L.push(`**Concrete consequence.** ${r.consequence}`);
    L.push('');
  }
  L.push('## INSPECTED — NOT APPLICABLE');
  L.push('');
  L.push('| skill | copies hashed | why it was not applied |');
  L.push('|---|---|---|');
  for (const r of g.rows.filter((x) => x.status === 'INSPECTED — NOT APPLICABLE')) {
    const copies = r.copies.map((c) => `\`${c.sha256.slice(0, 12)}\` ${c.bytes} B`).join('<br>');
    L.push(`| ${esc(r.name)} | ${copies} | ${esc(r.why)} |`);
  }
  L.push('');
  L.push('> **`frontend-design` is installed in more than one scope with DIFFERENT content.** Every');
  L.push('> copy is hashed above rather than the name being treated as one thing.');
  L.push('');
  L.push('## NOT AVAILABLE');
  L.push('');
  L.push('| named | why it is listed |');
  L.push('|---|---|');
  for (const r of g.rows.filter((x) => x.status === 'NOT AVAILABLE')) L.push(`| ${esc(r.name)} | ${esc(r.why)} |`);
  L.push('');
  L.push('## The full inventory');
  L.push('');
  L.push('| sha256 | bytes | path |');
  L.push('|---|---|---|');
  for (const i of g.inventory) L.push(`| \`${i.sha256.slice(0, 16)}\` | ${i.bytes} | \`${i.path}\` |`);
  L.push('');
  return L.join('\n');
}

/* --------------------------------------------------------------- the reference gate ---- */
function referenceGate() {
  const g = read('data/F1_REFERENCES.json');
  const L = [];
  L.push('# I-08B3.1-F1 — REFERENCE GATE');
  L.push('');
  L.push('**GENERATED from `data/F1_REFERENCES.json` by `tools/f1-references.mjs`.**');
  L.push('');
  L.push(`**${g.count} sources.** ${g.changedSomething} changed something in F1;`);
  L.push(`${g.changedNothingAndSaysSo} changed nothing and says so; ${g.divergencesRecorded} record a`);
  L.push('divergence where QANDEEL does something different and says why.');
  L.push('');
  L.push('> A reference read and found not to apply is a **result**. Hiding it would make the gate');
  L.push('> look more decisive than the research was.');
  L.push('');
  L.push('## Host reachability, recorded rather than paraphrased');
  L.push('');
  L.push('| host | state |');
  L.push('|---|---|');
  for (const [k, v] of Object.entries(g.hostReachability)) L.push(`| \`${k}\` | ${esc(v)} |`);
  L.push('');
  for (const r of g.references) {
    L.push(`## ${r.source}`);
    L.push('');
    L.push(`\`${r.url}\``);
    L.push('');
    L.push(`*${r.fetched}*`);
    L.push('');
    L.push('**What it says**');
    L.push('');
    for (const s of r.says) L.push(`- ${s}`);
    L.push('');
    L.push(`**What it changed.** ${r.changed ?? 'Nothing.'}`);
    L.push('');
    if (r.didNotChange) { L.push(`**What it did NOT change.** ${r.didNotChange}`); L.push(''); }
    if (r.qandeelDifferently) { L.push(`**What QANDEEL did differently.** ${r.qandeelDifferently}`); L.push(''); }
  }
  return L.join('\n');
}

/* ------------------------------------------------------------- the validation results -- */
function validation() {
  const v = read('data/F1_VALIDATION.json');
  const L = [];
  L.push('# I-08B3.1-F1 — VALIDATION RESULTS');
  L.push('');
  L.push('**GENERATED from `data/F1_VALIDATION.json` by `tools/f1-verify.mjs`.**');
  L.push('');
  L.push(`**${v.passed}/${v.checks} checks pass. ${v.probes.rejecting}/${v.probes.total} probes reject the input built to make them fail.**`);
  L.push('');
  L.push('> Every guard is fed an input that must make it fail. **A check that cannot fail is a');
  L.push('> sentence.** A probe that stops rejecting is itself a failure.');
  L.push('');
  L.push('| id | check | result | probe |');
  L.push('|---|---|---|---|');
  for (const r of v.results) {
    L.push(`| **${r.id}** | ${esc(r.what)} | ${r.pass ? '**PASS**' : '**FAIL**'} | ${r.probe ? (r.probe.rejected ? 'rejects: ' + esc(r.probe.input) : '**NOT REJECTING**') : '—'} |`);
  }
  L.push('');
  L.push('## What each class of check is for');
  L.push('');
  L.push('| class | question it answers |');
  L.push('|---|---|');
  L.push('| **V** | did every inherited byte come from the sealed package it claims? |');
  L.push('| **D** | did F1 weaken the default? *(D-02 is the ablation — the one with teeth)* |');
  L.push('| **S** | can an accessibility override reach a colour it must never reach? |');
  L.push('| **C** | does Increase Contrast raise legibility without inventing importance? |');
  L.push('| **T** | does Reduce Transparency preserve the World? |');
  L.push('| **N** | is colour ever the only required carrier? |');
  L.push('| **X** | do the settings compose, and does text survive ×3.118? |');
  L.push('| **M** | is any semantic motion removed? |');
  L.push('| **R** | does a screen-reader user reach the same truth? |');
  L.push('| **P** | is the analytical content identical in every expression? |');
  L.push('');
  return L.join('\n');
}

/* ------------------------------------------------------------------- the manifest ------ */
function manifest() {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'src') walk(p); continue; }
      const rel = relative(PKG, p).replace(/\\/g, '/');
      const b = readFileSync(p);
      files.push({ path: rel, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') });
    }
  };
  walk(PKG);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const total = files.reduce((a, b) => a + b.bytes, 0);
  const json = {
    generatedBy: 'tools/f1-docs.mjs',
    task: 'I-08B3.1-F1 — ACCESSIBILITY TRANSFORMATIONS + SEMANTIC PARITY',
    status: 'REVIEW CANDIDATE. Not frozen. F remains OPEN until I-08B3.1-F2 completes.',
    entries: files.length,
    bytes: total,
    files,
  };
  writeFileSync(join(PKG, 'data/F1_MANIFEST.json'), JSON.stringify(json, null, 2) + '\n');

  const L = [];
  L.push('# I-08B3.1-F1 — MANIFEST');
  L.push('');
  L.push('**GENERATED from the package itself by `tools/f1-docs.mjs`.**');
  L.push('');
  L.push(`**${files.length} entries, ${total.toLocaleString('en-US')} bytes.**`);
  L.push('');
  L.push('*(`review/src/` holds the intermediate captures the boards are composed from and is');
  L.push('excluded — it is a build artefact, not a deliverable.)*');
  L.push('');
  L.push('| sha256 | bytes | path |');
  L.push('|---|---|---|');
  for (const f of files) L.push(`| \`${f.sha256.slice(0, 16)}\` | ${f.bytes} | \`${f.path}\` |`);
  L.push('');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = [
    ['docs/F1_SKILL_GATE.md', skillGate()],
    ['docs/F1_REFERENCE_GATE.md', referenceGate()],
    ['docs/F1_VALIDATION_RESULTS.md', validation()],
  ];
  for (const [p, body] of out) { writeFileSync(join(PKG, p), body.endsWith('\n') ? body : body + '\n'); console.log('wrote', p, Buffer.byteLength(body), 'B'); }
  /* the manifest LAST, so it hashes the documents this run just wrote */
  const m = manifest();
  writeFileSync(join(PKG, 'docs/F1_MANIFEST.md'), m);
  console.log('wrote docs/F1_MANIFEST.md', Buffer.byteLength(m), 'B');
}
