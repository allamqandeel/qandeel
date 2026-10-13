// Static contract for LANG-01 — Arabic Language Authority & Fixed Copy Correction (the Product Owner's approval register
// of 2026-10-13; the LANG-01 Task Contract, Work Package A).
//
// Pins, each a single cited fact:
//   * the approval register is committed byte-for-byte: 109 unique IDs, 87 / 6 / 16, 39 explicit wordings, 27 individual
//     Product Owner approvals;
//   * the resolved manifest is DERIVED, never typed: every resolved text is the register's `final_text`, or else the exact
//     «Proposed» of the same unit in the pinned census, re-parsed here on every run;
//   * every ID has exactly one disposition, consistent with its category, with an owner when it is not LANG's to
//     implement;
//   * every amendment unit is quoted verbatim, original and replacement, in its controlled amendment, under its section;
//     the D4 model-facing lines are stated once;
//   * nothing frozen was rewritten: I-08A4 still matches its provenance pin and the byte-preserved proofs keep their
//     bytes; the census keeps its units and status line;
//   * Work Package D is not integrated before its independent safety gate: the six in-force replies are unchanged;
//   * the record, the locators, the backlog kickoff row and the CI registration.
//
// File reads only. No database, no network, no `.env`, no provider key.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (relative) => readFile(new URL(relative, root), 'utf8');
const readBytes = (relative) => readFile(new URL(relative, root));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const REGISTER = 'docs/e2e/lang-01/QANDEEL_LANG_Approval_Register_2026-10-13.json';
const REGISTER_SHA256 = '6ba3bc62e72938998a067e32f8c87b69c01f102f6d3c3fa98b342081cff16785';
const MANIFEST = 'docs/e2e/lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json';
const CENSUS = 'docs/e2e/QANDEEL_S6_WP0_ARABIC_FIXED_COPY_MSA_CONFLICT_CENSUS_v1.md';
const AMENDMENT = 'docs/canonical-authority/final-product-experience/lang/QANDEEL_LANG01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CONTROLLED_AMENDMENT_v1.0.md';
const G23_AMENDMENT = 'docs/design/i-08b3.1-g2.3/G2_3_LANG01_MATCHING_COPY_CONTROLLED_AMENDMENT.md';
const RECORD = 'docs/e2e/QANDEEL_LANG_01_ARABIC_LANGUAGE_AUTHORITY_FIXED_COPY_CORRECTION_RECORD_v1.md';
const I08A4 = 'docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md';
const SAFETY = 'apps/api/src/conversation/safety-response-gate.service.ts';

/** Historical evidence that the amendments must leave byte-identical (hashes read at `af94748d`). */
const BYTE_PRESERVED = {
  'docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md': 'bc79b7378f1685a2263491b7a929d9b36bf500e71699b84305d117c774a80c1c',
  'docs/design/canonical-artifacts/product-proofs/g2/g2.3/README.md': '61299856e5b4712cd568d9720103e4c903df7ac3d5bfbcb99e413ee53d2d88a3',
  'docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/src/content.mjs': '32a62b318bd4edcd9b70de48fc66c506d680d1b1afc546e96db28cae808bb618',
  'docs/design/canonical-artifacts/product-proofs/g3/g3.2/source/vendor/canon/product-copy.ts': '11f21cbe041f8ce6453bc001dd49497a4e7f3c968c6e9c4bf2a9d663b209ca5c',
  'docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/data/COPY_DECISION_TABLE.md': '55555cd49f59d1b8ce4a2114e71d8528be1d1a1dc763dbe2645539b3517c5d84',
};

/** LA-17 — the D4 model-facing lines, exactly as the amendment states them (Work Package C renders these bytes). */
export const D4_PERSONAL_LINE = 'When you reply in Arabic and neither an explicit request, a standing reply-language preference, nor a reasonably clear dialect in the user\'s own messages settles which Arabic to use, reply in neutral simplified Modern Standard Arabic. Never default to Egyptian Arabic or any other regional dialect.';
export const D4_WORLD_LINE = 'When you reply in Arabic and neither an explicit current request nor a reasonably clear dialect in the message you are answering settles which Arabic to use, reply in neutral simplified Modern Standard Arabic. Never default to Egyptian Arabic or any other regional dialect, and never treat one participant\'s language or dialect as a standing preference for anyone else.';

const registerBytes = await readBytes(REGISTER);
const register = JSON.parse(registerBytes.toString('utf8'));
const manifest = JSON.parse(await read(MANIFEST));
const census = await read(CENSUS);
const amendment = await read(AMENDMENT);
const g23 = await read(G23_AMENDMENT);
const record = await read(RECORD);
const backlog = await read('docs/qandeel-canonical-backlog-v1.md');
const currentState = await read('QANDEEL_CURRENT_STATE.md');
const projectMap = await read('QANDEEL_PROJECT_MAP.md');
const packageJson = JSON.parse(await read('package.json'));
const apiCi = await read('.github/workflows/api-ci.yml');

/** The census units: `**ID · title** — KIND — *STATUS*`, then `- Original: «…»`, `- Proposed: «…»`, … */
function censusUnits(text) {
  const units = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    const heading = /^\*\*([A-Z]+-\d{2}) · (.+?)\*\* — (.+?) — \*(.+)\*$/u.exec(line);
    if (heading) { current = { id: heading[1], status: heading[4], fields: {} }; units.set(current.id, current); continue; }
    if (/^#{2,3} /u.test(line)) { current = null; continue; }
    const field = current && /^- (Original|Proposed): «(.*)»$/u.exec(line);
    if (field) current.fields[field[1]] = field[2];
  }
  return units;
}
const units = censusUnits(census);

const CATEGORY = {
  'controlled-copy-amendment-required': 'CONTROLLED_COPY_AMENDMENT_REQUIRED',
  'safety-review-required': 'SAFETY_REVIEW_REQUIRED',
  'future-copy-gate-only': 'FUTURE_OWNING_COPY_GATE_ONLY',
};
const DISPOSITIONS = {
  CONTROLLED_COPY_AMENDMENT_REQUIRED: ['IMPLEMENT', 'AMENDED_IN_LANG_RUNTIME_USE_OWNED_BY_S6', 'AMENDED_DOCUMENT_ONLY'],
  SAFETY_REVIEW_REQUIRED: ['BLOCKED_PENDING_INDEPENDENT_SAFETY_REVIEW'],
  FUTURE_OWNING_COPY_GATE_ONLY: ['ROUTED_TO_FUTURE_COPY_GATE', 'NOT_TO_BE_IMPLEMENTED'],
};

test('the approval register is the committed attachment: 109 unique IDs, 87 / 6 / 16, 39 explicit wordings, 27 individual', () => {
  assert.equal(sha256(registerBytes), REGISTER_SHA256, 'the register is byte-identical to the Product Owner attachment');
  assert.equal(register.base_main_sha, 'af94748de73cca744c466d8db526984427b94b38');
  assert.equal(register.total, 109);
  const ids = register.items.map((item) => item.id);
  assert.equal(ids.length, 109);
  assert.equal(new Set(ids).size, 109, 'IDs are unique');
  const byCategory = {};
  for (const item of register.items) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  assert.deepEqual(byCategory, { 'controlled-copy-amendment-required': 87, 'safety-review-required': 6, 'future-copy-gate-only': 16 });
  assert.equal(register.items.filter((item) => item.final_text !== null).length, 39);
  assert.equal(register.explicit_overrides, 39);
  assert.equal(register.items.filter((item) => item.decision === 'approved_explicitly_by_product_owner').length, 27);
  assert.equal(register.owner_individual_approvals, 27);
});

test('the manifest is derived: final_text exactly, else the pinned census «Proposed» verbatim', () => {
  assert.equal(units.size, 109, 'the census still has its 109 units');
  assert.equal(manifest.approvalRegister.sha256, REGISTER_SHA256);
  assert.deepEqual(manifest.items.map((item) => item.id), register.items.map((item) => item.id), 'one manifest item per register item, in order');
  for (const [index, entry] of register.items.entries()) {
    const unit = units.get(entry.id);
    assert.ok(unit, `${entry.id} is a census unit`);
    const item = manifest.items[index];
    const explicit = entry.final_text !== null;
    assert.equal(entry.selection, explicit ? 'exact_explicit_text' : 'verbatim_Proposed_from_pinned_census', `${entry.id} selection`);
    const expected = explicit ? entry.final_text : unit.fields.Proposed;
    assert.equal(typeof expected, 'string', `${entry.id} resolves to a string`);
    assert.equal(item.resolvedText, expected, `${entry.id}: resolved text`);
    assert.equal(item.textSource, explicit ? 'REGISTER_FINAL_TEXT' : 'CENSUS_PROPOSED_VERBATIM', `${entry.id}: source`);
    assert.equal(item.original, unit.fields.Original, `${entry.id}: original`);
    assert.equal(item.resolvedTextSha256, sha256(expected), `${entry.id}: hash`);
    assert.equal(item.category, CATEGORY[entry.category], `${entry.id}: category`);
  }
});

test('interpolation, isolation and directional marks survive resolution byte-exact', () => {
  const item = (id) => manifest.items.find((entry) => entry.id === id);
  assert.ok(item('PW-09').original.includes('‎@qandeel') && item('PW-09').resolvedText.includes('‎@qandeel'), 'PW-09 keeps U+200E before @qandeel');
  assert.ok(item('Q-01').resolvedText.includes('${isolate(displayName)}'));
  assert.ok(item('A-08').resolvedText.includes('${isolate(email)}'));
  assert.ok(item('PC-02').resolvedText.includes('${digits(max)}'));
  for (const id of ['MEM-20', 'MEM-21', 'MEM-22', 'MEM-23']) {
    const placeholders = (text) => text.match(/\$\{[^}]+\}/gu) ?? [];
    assert.deepEqual(placeholders(item(id).resolvedText), placeholders(item(id).original), `${id} keeps its placeholders`);
  }
  for (const entry of manifest.items) {
    const slots = (text) => (text.match(/\{\d\}/gu) ?? []).length;
    if (slots(entry.original) > 0) assert.ok(slots(entry.resolvedText) >= 1, `${entry.id} keeps its {0} slot`);
  }
});

test('every ID has exactly one disposition, consistent with its category, and the counts add up', () => {
  const byDisposition = {};
  for (const item of manifest.items) {
    assert.ok(DISPOSITIONS[item.category].includes(item.disposition), `${item.id}: ${item.disposition} under ${item.category}`);
    byDisposition[item.disposition] = (byDisposition[item.disposition] ?? 0) + 1;
    assert.equal(item.category === 'CONTROLLED_COPY_AMENDMENT_REQUIRED', item.amendmentSection !== null, `${item.id}: an amendment section exactly when amended`);
    if (item.disposition !== 'IMPLEMENT') assert.ok(typeof item.owner === 'string' && item.owner.length > 0, `${item.id} names its owner`);
    if (item.disposition === 'IMPLEMENT') {
      assert.ok(item.locations.length > 0, `${item.id} names its production source`);
      for (const location of item.locations) assert.ok(existsSync(new URL(location.path, root)), `${item.id}: ${location.path} exists`);
    }
  }
  assert.deepEqual(byDisposition, {
    AMENDED_IN_LANG_RUNTIME_USE_OWNED_BY_S6: 3, ROUTED_TO_FUTURE_COPY_GATE: 15, NOT_TO_BE_IMPLEMENTED: 1, IMPLEMENT: 83,
    BLOCKED_PENDING_INDEPENDENT_SAFETY_REVIEW: 6, AMENDED_DOCUMENT_ONLY: 1,
  });
  assert.deepEqual(manifest.counts.byDisposition, byDisposition);
  assert.equal(manifest.items.find((item) => item.id === 'M-13').disposition, 'NOT_TO_BE_IMPLEMENTED', 'M-13 is never implemented');
  assert.deepEqual(manifest.items.filter((item) => item.disposition === 'AMENDED_IN_LANG_RUNTIME_USE_OWNED_BY_S6').map((item) => item.id), ['M-01', 'M-02', 'M-03']);
});

test('every amendment unit is quoted verbatim, original and replacement, under its section', () => {
  assert.match(amendment, /^\*\*Status:\*\* `CANONICAL PRODUCT DECISION RECORD \/ CONTROLLED AMENDMENT — EFFECTIVE \/ FROZEN ON MERGE`$/mu);
  assert.match(g23, /^\*\*Status:\*\* `CANONICAL CONTROLLED AMENDMENT — EFFECTIVE \/ FROZEN ON MERGE`$/mu);
  const escape = (text) => text.replaceAll('|', '\\|');
  for (const item of manifest.items.filter((entry) => entry.amendmentSection !== null)) {
    if (['M-01', 'M-02', 'M-03'].includes(item.id)) {
      assert.ok(g23.includes(`> **${item.original}**`), `${item.id}: the G2.3 amendment quotes the original`);
      assert.ok(g23.includes(`> **${item.resolvedText}**`), `${item.id}: the G2.3 amendment states the replacement`);
      continue;
    }
    const section = item.amendmentSection.split(' ')[0];
    const start = amendment.indexOf(`\n### ${section} — `);
    assert.ok(start > 0, `${item.id}: section ${section} exists`);
    const end = amendment.indexOf('\n### ', start + 1);
    const body = amendment.slice(start, end === -1 ? undefined : end);
    assert.ok(body.includes(`| ${item.id} | «${escape(item.original)}» | «${escape(item.resolvedText)}» |`), `${item.id}: row under ${section}`);
  }
  for (const id of ['S-01', 'M-04', 'M-13', 'V-01']) assert.ok(!amendment.includes(`| ${id} | «`), `${id} is not amended here`);
});

test('LA-17 states the two D4 lines once each, and the language authorities are all settled', () => {
  for (const line of [D4_PERSONAL_LINE, D4_WORLD_LINE]) assert.equal(amendment.split(line).length - 1, 1, 'each D4 line is stated exactly once');
  for (let index = 1; index <= 17; index += 1) {
    const id = `LA-${String(index).padStart(2, '0')}`;
    assert.match(amendment, new RegExp(`^### ${id} — `, 'mu'), `${id} is settled`);
  }
});

test('nothing frozen was rewritten: provenance pins, byte-preserved proofs and the census status hold', async () => {
  const provenance = await read('docs/canonical-authority/final-product-experience/FINAL_PRODUCT_EXPERIENCE_SOURCE_PROVENANCE.sha256');
  const [pinned] = provenance.split('\n').filter((line) => line.includes('QANDEEL_I-08A4_')).map((line) => line.split(/\s+/u)[0]);
  assert.equal(sha256(await readBytes(I08A4)), pinned, 'I-08A4 matches its provenance pin');
  for (const [path, hash] of Object.entries(BYTE_PRESERVED)) assert.equal(sha256(await readBytes(path)), hash, `${path} is byte-preserved`);
  assert.match(census, /^\*\*Status:\*\* `PROPOSED — CENSUS AND DRAFT CONTROLLED COPY AMENDMENTS — NOT APPROVED — NOTHING IMPLEMENTED`\.$/mu,
    'the census keeps its publication status line');
  assert.match(census, /^> \*\*LANG-01 note \(2026-10-13\)\.\*\*/mu);
});

test('Work Package D is not integrated before its independent safety gate', async () => {
  const safety = await read(SAFETY);
  for (const item of manifest.items.filter((entry) => entry.category === 'SAFETY_REVIEW_REQUIRED')) {
    assert.equal(item.disposition, 'BLOCKED_PENDING_INDEPENDENT_SAFETY_REVIEW', `${item.id} stays blocked`);
    assert.ok(safety.includes(item.original), `${item.id}: the in-force reply is unchanged until the safety gate passes`);
    assert.ok(!safety.includes(item.resolvedText), `${item.id}: the approved draft is not integrated yet`);
  }
});

test('the record, the locators and the backlog kickoff row point at the manifest and the amendments', () => {
  assert.match(record, /^# QANDEEL — LANG-01 — Arabic Language Authority & Fixed Copy Correction — Record v1$/mu);
  assert.match(record, /^\*\*Status:\*\* `ACTIVE — /mu);
  assert.match(record, /WORK PACKAGE D BLOCKED \(INDEPENDENT SAFETY REVIEW\)/u);
  for (const text of [currentState, projectMap]) {
    assert.ok(text.includes('docs/e2e/lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json'), 'locator links the manifest');
    assert.ok(text.includes(AMENDMENT), 'locator links the amendment');
  }
  assert.match(backlog, /^\| `LANG-01 — Arabic Language Authority & Fixed Copy Correction` \| none — no item names it/mu, 'BG-05 kickoff row');
});

test('this contract is registered as a root script and runs once in API CI, before the forward-safety gate', () => {
  assert.equal(packageJson.scripts['test:lang-01-arabic-language-authority-contract'],
    'node --test tests/lang-01-arabic-language-authority-contract.test.mjs');
  const step = 'run: npm run test:lang-01-arabic-language-authority-contract}';
  assert.equal(apiCi.split(step).length - 1, 1, 'exactly one api-ci step runs this contract');
  assert.ok(apiCi.indexOf(step) < apiCi.indexOf('run: npm run test:forward-safety-contract}'), 'before the forward-safety gate');
});
