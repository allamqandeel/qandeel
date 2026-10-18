// S6-07 (CP3, after the Copy Gate) - static contract for the governed enrollment step, the three independent consents
// and the governed install of the approved consent texts.
//
// The real behaviour is proven by the mobile tests (apps/mobile/src/introductions/__tests__/enrollment.test.tsx), the API
// enrollment spec and real PostgreSQL (database/verify-matching-consent-texts.mjs; verify-migration-0165.mjs). This contract
// pins the shape those proofs rely on, so a later edit cannot quietly widen it:
//   - the app uses exactly the approved rows (EN-01 … EN-21, RV-01 … RV-12; EN-03, RV-06, RV-08 as amended), ships no
//     consent text and no group-D sentence, and shows the server's own text for each consent;
//   - an act names only consent VERSIONS, exactly the ones it exercises, and only when each was agreed; a withdrawal names
//     one consent; nothing else (no profile field, no account) is sent;
//   - nothing is offered while the gate is closed or a deletion is pending, and no optional field is ever required;
//   - the approved texts live in ONE pinned module, are installed only through the 0165 operator function, only on a
//     loopback database, never with a gate act, and never by a migration;
//   - the proofs are wired into CI.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const MOBILE = 'apps/mobile/src';

// The Product Owner's decision of 2026-10-18, word for word, for the rows it amended.
const AMENDED = {
  'EN-03': ['المشاركة في مقترحات التعارف', 'Taking part in introduction proposals'],
  'RV-06': ['تتوقف مشاركتك في مقترحات التعارف الجديدة، دون إنهاء أي تعارف بدأ بالفعل.', 'You will stop taking part in new introduction proposals. This does not end an introduction that has already begun.'],
  'RV-08': ['لن يُسمح بتمرير مقترحات جديدة إلى الطرف الآخر استنادًا إلى هذه الموافقة.', 'This consent will no longer authorize new proposals to be forwarded to the other person.'],
  'CT-P': ['أوافق على المشاركة في مقترحات التعارف التي يقدّمها لي قنديل، ويمكنني إيقاف مشاركتي في أي وقت.', 'I agree to take part in the introduction proposals QANDEEL offers me, and I can stop taking part at any time.'],
  'CT-D': ['أوافق على أن يقدّم قنديل للطرف الآخر مقترح تعارف خاصًا ومستقلًا قبل التوافق المتبادل، دون مشاركة أي حقل من ملف التعارف الخاص بي. ويمكنني سحب هذه الموافقة في أي وقت.',
    'I agree that QANDEEL may show the other person a separate, private introduction proposal before a mutual match, without sharing any fields from my introduction profile. I can withdraw this consent at any time.'],
};
const GROUP_D = ['مقترح تعارف جديد', 'رسالة جديدة في التعارف', 'مشاركة جديدة في التعارف', 'طلب في التعارف بانتظار الرد', 'A new message in your introduction'];

const shipped = () => ({
  copy: read(`${MOBILE}/introductions/enrollment-copy.ts`),
  controller: read(`${MOBILE}/introductions/enrollment-controller.ts`),
  ui: read(`${MOBILE}/introductions/IntroductionsEnrollment.tsx`),
  proposalsCopy: read(`${MOBILE}/introductions/proposals-copy.ts`),
  surface: read(`${MOBILE}/introductions/IntroductionsSurface.tsx`),
  client: read(`${MOBILE}/runtime-entry/introductions-enrollment-api.ts`),
  runtime: read(`${MOBILE}/integration/runtime/integration-runtime.ts`),
  composition: read(`${MOBILE}/integration/composition/DepthComposition.tsx`),
  mobileSources: listSources(`${MOBILE}`).map((p) => read(p)).join('\n'),
  texts: read('database/matching-consent-texts-v1.mjs'),
  installer: read('database/install-matching-consent-texts.mjs'),
  proofStandIn: read(`${MOBILE}/integration/__validation__/s607-proof-enrollment.ts`),
  migrations: readdirSync(new URL('../database/migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).map((n) => read(`database/migrations/${n}`)).join('\n'),
  workflow: read('.github/workflows/api-ci.yml'),
  pkg: read('package.json'),
});
function listSources(dir) {
  const out = [];
  for (const entry of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== '__validation__') out.push(...listSources(path)); }
    else if (/\.tsx?$/u.test(entry.name)) out.push(path);
  }
  return out;
}
let current = shipped();
const world = () => current;
const plant = (key, from, to) => {
  const w = shipped();
  assert.ok(w[key].includes(from), `the planted defect's anchor exists in ${key}: ${from.slice(0, 80)}`);
  return { ...w, [key]: w[key].replace(from, to) };
};

const DETECTORS = {
  copyViolations(w) {
    const out = [];
    for (const id of ['EN-03', 'RV-06', 'RV-08']) {
      const [ar, en] = AMENDED[id];
      const row = new RegExp(`\\{ id: '${id}', ar: '${ar.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}', en: '${en.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/'/gu, "\\\\'")}' \\}`, 'u');
      if (!row.test(w.copy)) out.push(`${id} is the Product Owner's amended wording`);
    }
    const ids = [...w.copy.matchAll(/\{ id: '((?:EN|RV)-\d\d)'/gu)].map((m) => m[1]);
    const expected = [...Array.from({ length: 21 }, (_, i) => `EN-${String(i + 1).padStart(2, '0')}`), ...Array.from({ length: 12 }, (_, i) => `RV-${String(i + 1).padStart(2, '0')}`)];
    if (JSON.stringify(ids) !== JSON.stringify(expected)) out.push('exactly EN-01 … EN-21 and RV-01 … RV-12, once each, in order');
    if (!/status: 'S6-07 CP3 PRODUCT COPY GATE — CLOSED/u.test(w.copy)) out.push('the gate is recorded closed');
    for (const fragment of [...Object.values(AMENDED).filter((_, i) => i >= 3).flat(), 'أوافق على أن يستند قنديل', ...GROUP_D]) {
      if (w.mobileSources.includes(fragment)) out.push(`the app ships no consent text or group-D sentence (${fragment.slice(0, 30)})`);
    }
    if (!/language === 'ar' \? text\.textAr : text\.textEn/u.test(w.ui)) out.push("each consent shows the server's own current text");
    // CP3 review: RECONFIRM_CONSENT reads the approved «تأكيد»; EN-19 only after CONSENT_OUTDATED proved the wording changed.
    if (/RECONFIRM_CONSENT: 'reconfirm'/u.test(w.ui)
      || !/notice\.key === 'consentOutdated' \? copy\.reconfirm : proposalsCopy\(ctx\.language\)\.confirm/u.test(w.ui)
      || !/confirm: \{ ar: 'تأكيد', en: 'Confirm' \}, \/\/ APPROVED/u.test(w.proposalsCopy)) out.push('RECONFIRM_CONSENT reads «تأكيد»; EN-19 only where a changed wording is proven');
    return out;
  },
  actViolations(w) {
    const out = [];
    if (!/if \(!view\.available \|\| view\.accountDeletionPending\) return null;/u.test(w.controller)) out.push('nothing is offered while the gate is closed or a deletion is pending');
    if (!/if \(text === null \|\| !agreed\.has\(consent\)\) return null;\n\s+versions\[consent\] = text\.version;/u.test(w.controller)) out.push('an act names each exercised consent by the version shown, and only when agreed');
    if (/profile\.(shortIntroduction|workField)|draft\.facts|draft\.profile/u.test(w.controller)) out.push('the offer never depends on an optional field (D-CP1-1 = B)');
    if (!/draft\.review\.state === 'REVIEWED'/u.test(w.controller)) out.push('ENROLL and CORRECTION need a reviewed draft');
    const body = /'\/introductions\/enrollment', \{\n\s+commandId, kind, expectedDraftVersion,\n\s+consents: \{ participation: consents\.participation, contextGrant: consents\.contextGrant, disclosureAuthority: consents\.disclosureAuthority \},\n\s+\}\)/u;
    if (!body.test(w.client)) out.push('the act sends exactly the act, the reviewed version and the consent versions');
    if (!/'\/introductions\/enrollment\/revocation', \{ commandId, consent \}\)/u.test(w.client)) out.push('a withdrawal names exactly one consent');
    if (!/if \(available && \(participation === null \|\| contextGrant === null \|\| disclosureAuthority === null\)\) return null;/u.test(w.client)) out.push('an "available" view without every text is not believed');
    if (!/introductionEnrollment: createEnrollmentController\(\{ transport: entry\.introductionsEnrollmentFor\(bundle\), isCurrent \}\)/u.test(w.runtime)
        || !/session\.introductionEnrollment\.retire\(\);/u.test(w.runtime)) out.push('one enrollment controller per runtime generation, retired with it');
    if (!/enrollment=\{runtime\.introductionEnrollment\}/u.test(w.composition)) out.push('the preparation surface is given the enrollment controller');
    // Withdrawal is drawn wherever the reader can be: the read-only (closed / deletion pending) state included.
    if ((w.surface.match(/\{consents\}/gu) ?? []).length < 3) out.push('the consent controls are drawn in the reviewed, intro and read-only states');
    return out;
  },
  installViolations(w) {
    const out = [];
    for (const id of ['CT-P', 'CT-D']) {
      const [ar, en] = AMENDED[id];
      if (!w.texts.includes(`textAr: '${ar}'`) || !w.texts.includes(`textEn: '${en}'`)) out.push(`${id} is the Product Owner's amended text`);
    }
    if (!/sha256\(text\.textAr\) !== text\.sha256Ar \|\| sha256\(text\.textEn\) !== text\.sha256En/u.test(w.texts)) out.push('every text is pinned by its digest');
    if (!/const LOOPBACK = new Set\(\['localhost', '127\.0\.0\.1', '::1', '\[::1\]'\]\);/u.test(w.installer) || !/if \(!LOOPBACK\.has\(host\)\)/u.test(w.installer)) out.push('only a loopback database');
    if (!/assertLoopbackDatabase\(databaseUrl\);\n\s+const client = new pg\.Client/u.test(w.installer)) out.push('the host is checked before connecting');
    // Comments excluded: the installer's header SAYS it never calls set_gate_v1.
    const installerCode = w.installer.replace(/^\s*\/\/[^\n]*$/gmu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
    if (/set_gate_v1|gate_states\s+(SET|VALUES)|INSERT INTO \S*gate/u.test(installerCode)) out.push('the installer never acts on a gate');
    if (!/JSON\.stringify\(after\) !== JSON\.stringify\(before\)/u.test(w.installer)) out.push('the installer proves the gate unchanged');
    if (!/install_consent_text_v1\(\$1, \$2, \$3, \$4\)/u.test(w.installer)) out.push('texts enter only through the 0165 operator function');
    if (/INSERT INTO \S*consent_texts/u.test(w.installer)) out.push('no direct write of the catalogue');
    if (/MATCHING_PARTICIPATION_V1|PRE_MATCH_DISCLOSURE_AUTHORITY_V1/u.test(w.migrations)) out.push('no migration installs the approved texts');
    // The device proof photographs exactly the approved texts: its validation-only stand-in copies them verbatim.
    const approved = [...w.texts.matchAll(/version: '([A-Z_0-9]+)',\n\s+textAr: '([^']+)',\n\s+textEn: '([^']+)'/gu)].map((m) => m.slice(1).join('|'));
    const copied = [...w.proofStandIn.matchAll(/version: '([A-Z_0-9]+)',\n\s+textAr: '([^']+)',\n\s+textEn: '([^']+)'/gu)].map((m) => m.slice(1).join('|'));
    if (approved.length !== 3 || JSON.stringify(copied) !== JSON.stringify(approved)) out.push('the proof stand-in shows exactly the approved texts');
    return out;
  },
  wiringViolations(w) {
    const out = [];
    if (!/"verify:matching-consent-texts:integration": "node --env-file-if-exists=\.env database\/verify-matching-consent-texts\.mjs"/u.test(w.pkg)) out.push('the verifier has its script');
    if (!/run: npm run verify:matching-consent-texts:integration/u.test(w.workflow)) out.push('the verifier runs in API CI');
    if (!/run: npm run test:s6-07-enrollment-consent-surface-contract/u.test(w.workflow)) out.push('this contract runs in API CI');
    return out;
  },
};

test('1 - the shipped enrollment step, consents and installer hold every property', () => {
  current = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(world()), [], name);
});

test('2 - every detector catches a planted defect', () => {
  for (const [label, detector, make] of [
    ['EN-03 in its old wording', 'copyViolations', () => plant('copy', "ar: 'المشاركة في مقترحات التعارف', en: 'Taking part in introduction proposals'", "ar: 'المشاركة في التعارف', en: 'Taking part in Introductions'")],
    ['RV-08 in its old wording', 'copyViolations', () => plant('copy', "en: 'This consent will no longer authorize new proposals to be forwarded to the other person.'", "en: 'Introduction proposals stop being shown to anyone.'")],
    ['a consent text shipped in the app', 'copyViolations', () => plant('mobileSources', 'export function enrollmentCopy', `const CT = '${AMENDED['CT-P'][0]}';\nexport function enrollmentCopy`)],
    ['a group-D sentence used', 'copyViolations', () => plant('mobileSources', 'export function enrollmentCopy', "const X = 'رسالة جديدة في التعارف';\nexport function enrollmentCopy")],
    ['EN-19 on every RECONFIRM_CONSENT', 'copyViolations', () => plant('ui', '? copy.reconfirm : proposalsCopy(ctx.language).confirm', '? copy.reconfirm : copy.reconfirm')],
    ['a hard-coded consent text', 'copyViolations', () => plant('ui', "language === 'ar' ? text.textAr : text.textEn", "copy.agree")],
    ['an act offered behind a closed gate', 'actViolations', () => plant('controller', 'if (!view.available || view.accountDeletionPending) return null;', 'if (view.accountDeletionPending) return null;')],
    ['an unagreed consent sent', 'actViolations', () => plant('controller', 'if (text === null || !agreed.has(consent)) return null;', 'if (text === null) return null;')],
    ['an optional field required', 'actViolations', () => plant('controller', "const reviewed = draft !== null && draft.review.state === 'REVIEWED' ? draft.version : null;", "const reviewed = draft !== null && draft.review.state === 'REVIEWED' && draft.profile.workField !== null ? draft.version : null;")],
    ['a profile field sent', 'actViolations', () => plant('client', '      commandId, kind, expectedDraftVersion,\n', '      commandId, kind, expectedDraftVersion, profile: {},\n')],
    ['two consents withdrawn at once', 'actViolations', () => plant('client', "'/introductions/enrollment/revocation', { commandId, consent })", "'/introductions/enrollment/revocation', { commandId, consent, also: 'contextGrant' })")],
    ['no withdrawal while read-only', 'actViolations', () => plant('surface', "        {consents}\n        {draft === null ? null : <DiscardBlock", "        {draft === null ? null : <DiscardBlock")],
    ['CT-D in its old wording', 'installViolations', () => plant('texts', AMENDED['CT-D'][1], 'I agree that, before a mutual match, an introduction proposal may be shown to the other person without any personal details from my profile. I can withdraw this consent at any time.')],
    ['a hosted database accepted', 'installViolations', () => plant('installer', '  if (!LOOPBACK.has(host)) {', '  if (false) {')],
    ['the gate opened with the texts', 'installViolations', () => plant('installer', '    const after = await gateSnapshot(client);', "    await client.query(`SELECT * FROM ${S}.set_gate_v1('ENABLED', 'SATISFIED', 'x', 'y')`);\n    const after = await gateSnapshot(client);")],
    ['a direct catalogue write', 'installViolations', () => plant('installer', '      results.push({ version: text.version, result: \'INSTALLED\' });', "      await client.query(`INSERT INTO ${S}.consent_texts VALUES ($1)`, [1]);\n      results.push({ version: text.version, result: 'INSTALLED' });")],
    ['a proof photograph of other words', 'installViolations', () => plant('proofStandIn', "version: 'MATCHING_CONTEXT_GRANT_V1',", "version: 'MATCHING_CONTEXT_GRANT_V9',")],
    ['a migration installing the texts', 'installViolations', () => ({ ...shipped(), migrations: `${shipped().migrations}\nSELECT matching_enrollment_private.install_consent_text_v1('MATCHING_PARTICIPATION_V1', 'MATCHING_PARTICIPATION', 'x', 'y');` })],
    ['the verifier not in CI', 'wiringViolations', () => plant('workflow', 'run: npm run verify:matching-consent-texts:integration', 'run: echo skipped')],
  ]) {
    assert.notDeepEqual(DETECTORS[detector](make()), [], `the contract catches: ${label}`);
  }
});
