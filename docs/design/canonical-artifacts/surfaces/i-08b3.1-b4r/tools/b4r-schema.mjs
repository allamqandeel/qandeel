/**
 * I-08B3.1-B4R - OFFICIAL DTCG 2025.10 SCHEMA VALIDATION.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------------------------------------------------------------------------
 *
 * B4 validated its resolver document with a checker B4 wrote, against a shape B4 believed. Both
 * agreed, and both were wrong: the document was not conformant to the published 2025.10 Resolver
 * Module, and nothing in the package could have said so, because the package was the only witness.
 * A validator authored beside the artefact it validates cannot discover that its model of the
 * standard is wrong - it can only discover that the artefact disagrees with that model.
 *
 * So conformance is settled here by two things this package did NOT author:
 *
 *   1. the OFFICIAL JSON Schema, vendored byte-for-byte under `schemas/2025.10/` with provenance;
 *   2. AJV, a third-party JSON Schema implementation, resolved from the repository's own
 *      `node_modules` rather than reimplemented.
 *
 * `tools/b4-validate.mjs` still runs its own V-11, and that is not duplication: see the long note
 * on `validateResolver` there. The schema owns SYNTAX; the runtime check owns the obligations the
 * schema states in its own `$comment` that it cannot express. Where they could ever disagree on a
 * syntax question, THE OFFICIAL SCHEMA WINS - and this file would report the disagreement rather
 * than resolve it quietly.
 *
 * ---------------------------------------------------------------------------------------------
 * THE FIRST CHECK IS THE VENDORED SCHEMA ITSELF
 * ---------------------------------------------------------------------------------------------
 *
 * A vendored copy of an authority is only an authority while it is unaltered, and an edited schema
 * would make every check below pass for the wrong reason - the most comfortable failure available
 * to this package. So S-01 re-hashes every vendored file against `PROVENANCE.json` before any
 * document is validated, and additionally recomputes each file's GIT BLOB SHA-1, which was verified
 * at vendoring time against the blob shas the GitHub tree API reports for the official repository.
 * That is what makes "the official schema" a checkable claim here rather than a filename.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
import { validateResolver } from './b4-validate.mjs';
import { TOKENS_DIR, WORK, PKG } from './b4-tokens.mjs';

const Ajv = AjvModule.default ?? AjvModule;
const addFormats = addFormatsModule.default ?? addFormatsModule;

export const SCHEMA_DIR = join(PKG, 'schemas', '2025.10');
const RESOLVER_ID = 'https://www.designtokens.org/schemas/2025.10/resolver.json';
const FORMAT_ID = 'https://www.designtokens.org/schemas/2025.10/format.json';

const sha256 = (b) => createHash('sha256').update(b).digest('hex').toUpperCase();
const blobSha = (b) => createHash('sha1')
  .update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ok = (detail) => ({ pass: true, detail });
const no = (detail) => ({ pass: false, detail });

/* ------------------------------------------------------------ the vendored authority ---- */

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function integrity() {
  const prov = readJson(join(SCHEMA_DIR, 'PROVENANCE.json'));
  const problems = [];
  const checked = [];
  for (const f of prov.files) {
    const abs = join(SCHEMA_DIR, f.published);
    let buf;
    try { buf = readFileSync(abs); } catch { problems.push(`${f.published} is missing`); continue; }
    const s = sha256(buf);
    const b = blobSha(buf);
    if (s !== f.sha256) problems.push(`${f.published}: SHA-256 ${s} != recorded ${f.sha256}`);
    if (b !== f.gitBlobSha1) problems.push(`${f.published}: git blob ${b} != recorded ${f.gitBlobSha1}`);
    if (f.gitBlobSha1Reported && f.gitBlobSha1 !== f.gitBlobSha1Reported) {
      problems.push(`${f.published}: recorded blob sha disagrees with the sha the GitHub tree API reported`);
    }
    checked.push(f.published);
  }
  /* A file present in the directory but absent from the provenance record is unaccounted for. */
  const onDisk = walk(SCHEMA_DIR).map((p) => relative(SCHEMA_DIR, p).replace(/\\/g, '/'))
    .filter((r) => r !== 'PROVENANCE.json');
  const unrecorded = onDisk.filter((r) => !prov.files.some((f) => f.published === r));
  for (const u of unrecorded) problems.push(`${u} is present but not recorded in PROVENANCE.json`);
  return { prov, problems, checked, onDisk };
}

export function build() {
  const { prov, problems, checked, onDisk } = integrity();
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
  addFormats(ajv);
  const added = [];
  if (!problems.length) {
    for (const f of prov.files) {
      const doc = readJson(join(SCHEMA_DIR, f.published));
      ajv.addSchema(doc, doc.$id);
      added.push(doc.$id);
    }
  }
  return { ajv, prov, problems, checked, onDisk, added };
}

/** Validate `doc` against a registered schema id; returns `null` on success or an error list. */
export function against(ajv, id, doc) {
  const v = ajv.getSchema(id);
  if (!v) return [`schema ${id} is not registered`];
  if (v(doc)) return null;
  return v.errors.map((e) => `${e.instancePath || '/'} ${e.keyword}: ${e.message}`);
}

/* -------------------------------------------------------------------- the checks -------- */

const TOKEN_FILES = ['base/semantic.tokens.json', 'appearance/dark.tokens.json',
  'appearance/light.tokens.json', 'contrast/standard.tokens.json', 'contrast/increased.tokens.json',
  'qandeel-surface.tokens.json'];

export const CHECKS = [
  {
    id: 'S-01', title: 'The vendored official schemas are unaltered',
    why: 'Everything below is only as good as this.',
    run(ctx) {
      if (ctx.problems.length) return no(ctx.problems.join('; '));
      const verified = ctx.prov.files.filter((f) => f.blobShaVerified).length;
      return ok(`${ctx.checked.length} schema files re-hashed; SHA-256 and git blob SHA-1 both match ` +
        `\`PROVENANCE.json\`; ${verified} of ${ctx.prov.files.length} blob shas were verified at ` +
        'vendoring time against the shas the GitHub tree API reports for the official repository; ' +
        '0 unrecorded files present');
    },
  },
  {
    id: 'S-02', title: 'The resolver document is VALID against the official DTCG 2025.10 Resolver Schema',
    why: 'The blocker raised as B4R-REV-01.',
    run(ctx) {
      const errs = against(ctx.ajv, RESOLVER_ID, ctx.resolver);
      if (errs) return no(`${errs.length} schema violation(s): ${errs.slice(0, 8).join('; ')}`);
      return ok(`valid against \`${RESOLVER_ID}\` (draft-07, resolved through its 3 sub-schemas), ` +
        'validated by ajv - a third-party implementation this package did not author');
    },
  },
  {
    id: 'S-03', title: 'Every shipped token file is VALID against the official DTCG 2025.10 Format Schema',
    run(ctx) {
      const bad = [];
      for (const rel of TOKEN_FILES) {
        const errs = against(ctx.ajv, FORMAT_ID, readJson(join(TOKENS_DIR, rel)));
        if (errs) bad.push(`${rel}: ${errs.slice(0, 4).join(' | ')}`);
      }
      if (bad.length) return no(bad.join('; '));
      return ok(`${TOKEN_FILES.length} token files valid against \`${FORMAT_ID}\`, including the two ` +
        'value-free appearance sets and the canonical deliverable');
    },
  },
  {
    id: 'S-04', title: 'The document declares the schema it is actually valid against',
    why: 'A `$schema` naming a document nobody checked is decoration.',
    run(ctx) {
      if (ctx.resolver.$schema !== RESOLVER_ID) {
        return no(`\`$schema\` is ${JSON.stringify(ctx.resolver.$schema)}, not \`${RESOLVER_ID}\``);
      }
      const prov = ctx.prov.files.find((f) => f.id === RESOLVER_ID);
      if (!prov) return no('the declared schema id is not among the vendored schemas');
      return ok(`\`$schema\` is \`${RESOLVER_ID}\`, and that id is the \`$id\` of the vendored file ` +
        `\`schemas/2025.10/${prov.published}\` which S-02 validated against`);
    },
  },
  {
    id: 'S-05', title: 'The official schema and the custom validator do not disagree',
    why: 'The stop condition the independent review set. They must partition the spec, not contradict ' +
      'each other on it.',
    run(ctx) {
      const schemaErrs = against(ctx.ajv, RESOLVER_ID, ctx.resolver);
      const customErrs = validateResolver(ctx.resolver);
      if (!schemaErrs && !customErrs.length) {
        return ok('both accept the shipped resolver document; no disagreement to resolve');
      }
      if (schemaErrs && customErrs.length) return no('both reject the shipped document (see S-02, V-11)');
      if (schemaErrs) {
        return no('THE OFFICIAL SCHEMA REJECTS a document the custom validator accepts - the schema ' +
          `wins and the custom rule is wrong: ${schemaErrs.join('; ')}`);
      }
      return no('the custom validator rejects a document the official schema accepts. This is only a ' +
        'failure HERE, where the shipped document is supposed to be conformant; on a probe it is the ' +
        `expected division of labour: ${customErrs.join('; ')}`);
    },
  },
];

/* -------------------------------------------------------------------- the probes -------- */

/**
 * The five malformed resolvers, run against BOTH validators, with what each is expected to do.
 *
 * The expectations are the finding. A and B and C are syntax, and the official schema rejects them
 * on its own. D and E are not syntax at all - a `$ref` to a set that does not exist is a perfectly
 * good URI reference, and a `default` naming a missing context is a plain string - so the official
 * schema ACCEPTS both, exactly as its own `$comment` warns it must. A package that had replaced its
 * custom validator with schema validation, believing the schema to be strictly better, would have
 * shipped both defects with a clean report.
 *
 * `s-n0` is not a synthetic probe: it is the resolver document B4 actually shipped, read from the
 * sealed package. The suite is required to reject it.
 */
const B4_SHIPPED = join(PKG, '..', 'I-08B3.1-B4-SURFACE-PRODUCTION-SPEC-FREEZE',
  'tokens', 'qandeel-surface.resolver.json');

export const PROBES = [
  {
    id: 's-n0', label: 'THE DOCUMENT B4 SHIPPED', schema: 'REJECT', custom: 'REJECT',
    why: 'Read from the sealed B4 package. If the corrected suite cannot reject the exact bytes that ' +
      'caused this revision, the correction is a rewording.',
    make: () => readJson(B4_SHIPPED),
  },
  {
    id: 's-nA', label: 'PROBE A - `sets` as an array', schema: 'REJECT', custom: 'REJECT',
    make: (r) => ({ ...r, sets: Object.entries(r.sets).map(([name, s]) => ({ name, ...s })) }),
  },
  {
    id: 's-nB', label: 'PROBE B - `modifiers` as an array', schema: 'REJECT', custom: 'REJECT',
    make: (r) => ({ ...r, modifiers: Object.entries(r.modifiers).map(([name, m]) => ({ name, ...m })) }),
  },
  {
    id: 's-nC', label: 'PROBE C - `{ type, name }` in resolutionOrder for a ROOT-declared set',
    schema: 'REJECT', custom: 'REJECT',
    make: (r) => ({ ...r, resolutionOrder: [
      { type: 'set', name: 'semantic' },
      { type: 'modifier', name: 'appearance' },
      { type: 'modifier', name: 'contrast' },
    ] }),
  },
  {
    id: 's-nD', label: 'PROBE D - `$ref` to an undeclared set',
    schema: 'ACCEPT', custom: 'REJECT',
    why: 'Syntactically a valid URI reference. JSON Schema has no way to know whether the pointer ' +
      'lands on anything, so this one is caught only at runtime.',
    make: (r) => ({ ...r, resolutionOrder: [{ $ref: '#/sets/foundation' }, ...r.resolutionOrder.slice(1)] }),
  },
  {
    id: 's-nE', label: 'PROBE E - modifier `default` naming a context it does not have',
    schema: 'ACCEPT', custom: 'REJECT',
    why: 'The official schema carries a `$comment` saying precisely this cannot be validated by JSON ' +
      'Schema and must be checked at runtime.',
    make: (r) => ({ ...r, modifiers: { ...r.modifiers,
      appearance: { ...r.modifiers.appearance, default: 'darkMode' } } }),
  },
];

/* --------------------------------------------------------------------- runner ----------- */

export function runAll(ctx) {
  return CHECKS.map((c) => {
    let r;
    try { r = c.run(ctx); } catch (e) { r = no(`threw: ${e.message}`); }
    return { id: c.id, title: c.title, why: c.why, ...r };
  });
}

export function main() {
  const b = build();
  const resolver = readJson(join(TOKENS_DIR, 'qandeel-surface.resolver.json'));
  const ctx = { ...b, resolver };

  console.log('I-08B3.1-B4R - OFFICIAL DTCG 2025.10 SCHEMA VALIDATION');
  console.log(`  authority: ${b.prov.officialBase}, vendored from ${b.prov.repository}`);
  console.log(`  validator: ajv (third party), ${b.added.length} schemas registered by $id`);
  console.log('');

  const results = runAll(ctx);
  for (const r of results) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n          ${r.detail}`);
  const failed = results.filter((r) => !r.pass);

  console.log('');
  console.log('  NEGATIVE PROBES - official schema | custom validator');
  const probeResults = [];
  for (const p of PROBES) {
    const doc = p.make(resolver);
    const schemaErrs = against(b.ajv, RESOLVER_ID, doc);
    const customErrs = validateResolver(doc);
    const schemaGot = schemaErrs ? 'REJECT' : 'ACCEPT';
    const customGot = customErrs.length ? 'REJECT' : 'ACCEPT';
    const hit = schemaGot === p.schema && customGot === p.custom;
    /* Caught by NEITHER is the outcome that would matter most, so it is named. */
    const escaped = schemaGot === 'ACCEPT' && customGot === 'ACCEPT';
    probeResults.push({
      id: p.id, label: p.label, why: p.why,
      expected: { schema: p.schema, custom: p.custom },
      got: { schema: schemaGot, custom: customGot },
      schemaErrors: schemaErrs ? schemaErrs.length : 0,
      customErrors: customErrs.length,
      firstSchemaError: schemaErrs ? schemaErrs[0] : null,
      firstCustomError: customErrs[0] ?? null,
      hit, escaped,
    });
    console.log(`  ${hit ? 'PASS' : 'FAIL'}  ${p.id}  ${p.label}`);
    console.log(`          schema ${schemaGot} (expected ${p.schema}, ${schemaErrs ? schemaErrs.length : 0} errors) | ` +
      `custom ${customGot} (expected ${p.custom}, ${customErrs.length} errors)` + (escaped ? '  <-- CAUGHT BY NEITHER' : ''));
  }
  const probeFails = probeResults.filter((p) => !p.hit);

  console.log('');
  console.log(`  checks: ${results.length - failed.length}/${results.length} pass`);
  console.log(`  probes: ${probeResults.length - probeFails.length}/${probeResults.length} behaved as designed`);
  console.log(`  probes caught by neither validator: ${probeResults.filter((p) => p.escaped).length}`);

  mkdirSync(WORK, { recursive: true });
  writeFileSync(join(WORK, 'schema.json'), JSON.stringify({
    authority: {
      officialBase: b.prov.officialBase, repository: b.prov.repository,
      schemaSourceCommit: b.prov.schemaSourceCommit, publicationCommit: b.prov.publicationCommit,
      retrieved: b.prov.retrieved, dialect: b.prov.jsonSchemaDialect,
      files: b.prov.files.length, validator: 'ajv',
    },
    checks: results, probes: probeResults,
  }, null, 2), { encoding: 'utf8' });

  return { results, probeResults, failed, probeFails };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { failed, probeFails } = main();
  if (failed.length || probeFails.length) process.exit(1);
}
