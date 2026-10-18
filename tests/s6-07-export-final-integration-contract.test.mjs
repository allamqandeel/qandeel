// S6-07 (CP4) - static contract for Export My Data's Matching and Introductions section and its photo bundle
// (QAN-BL-PRIV-04; GATE-19, CA-EXP, Q7' / Q7'', Q9) and for the final integration journey.
//
// The behaviour is proven on real PostgreSQL (database/verify-migration-0168.mjs, database/verify-s6-07-final-journey.mjs),
// on the wire with the compiled API, PostgREST and a real S3 server (database/prove-0168-export-bundle-postgrest.mjs), by
// the API specs (privacy-export-bundle.spec.ts) and by the mobile tests (export-bundle-file.test.ts, the W3-MEGA-S
// integration test). This contract pins the shape those proofs rely on, so a later edit cannot quietly widen it:
//   - 0168 re-states the builder with ONE section keyed on the reader, adds one owner-only photo reader and nothing else,
//     withholds the arrival instant and every pair-bound relation, and keeps `notYetIncluded` at shared / public / replay;
//   - the API answers the package unchanged on the old route; the bundle re-authorizes every photo on the reader's own
//     token before any key is read; the 32 MiB guard bounds one answer and a file route carries the rest; nothing partial
//     is answered; no identifier leaves; the file route is not throttled like a password route;
//   - the app writes the photos first, the server's manifest next and the package last, checks each file on disk, removes
//     the folder on any failure, and adds no new sentence;
//   - the proofs are wired into CI.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const code = (text) => text.split('\n').filter((line) => !line.trimStart().startsWith('--') && !line.trimStart().startsWith('//')
  && !line.trimStart().startsWith('*')).join('\n');

const shipped = () => ({
  migration: read('database/migrations/0168_personal_export_matching_introductions_v1.sql'),
  service: read('apps/api/src/account/privacy-data.service.ts'),
  controller: read('apps/api/src/account/privacy-data.controller.ts'),
  disclosure: read('apps/api/src/introductions-disclosure/introduction-disclosure.service.ts'),
  census: read('apps/api/src/http-security/route-rate-limit.census.ts'),
  client: read('apps/mobile/src/runtime-entry/account/account-api.ts'),
  privacyController: read('apps/mobile/src/settings/privacy-data-controller.ts'),
  save: read('apps/mobile/src/settings/export-file.ts'),
  settingsCopy: read('apps/mobile/src/settings/copy.ts'),
  workflow: read('.github/workflows/api-ci.yml'),
  pkg: read('package.json'),
});
let current = shipped();
const world = () => current;
const plant = (key, from, to) => {
  const w = shipped();
  assert.ok(w[key].includes(from), `the planted defect's anchor exists in ${key}: ${from.slice(0, 80)}`);
  return { ...w, [key]: w[key].replace(from, to) };
};
const section = (m) => {
  const start = m.indexOf("'matchingAndIntroductions', jsonb_build_object(");
  return start < 0 ? '' : m.slice(start, m.indexOf("'notYetIncluded'", start));
};

const DETECTORS = {
  migrationViolations(w) {
    const out = [];
    const sql = code(w.migration);
    const defined = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z0-9_.]+)\(/giu)].map((m) => m[1]);
    if (JSON.stringify(defined) !== JSON.stringify(['personal_data_private.build_personal_export_v1', 'public.list_my_introduction_photo_renditions_v1'])) {
      out.push('0168 defines exactly the builder and the one photo reader');
    }
    if (/CREATE TABLE|ALTER TABLE|CREATE POLICY|CREATE TRIGGER|INSERT INTO|UPDATE public|DELETE FROM/iu.test(sql)) out.push('0168 adds no relation and writes no row');
    if (!sql.includes("'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'));")) out.push('shared, public and replay stay not yet included');
    if (/GRANT EXECUTE ON FUNCTION personal_data_private\.build_personal_export_v1/iu.test(sql)) out.push('no role executes the builder');
    const s = section(sql);
    if (s === '') out.push('the section exists');
    // Every pair-bound relation and every internal evaluation stays out (GATE-19, CW2-06 §28 / §33 / §38 / §53).
    for (const banned of ['matching_eligibility_snapshot', 'matching_hard_requirement_results', 'matching_private_reasoning_notes',
      'matching_safe_conclusion_candidates', 'matching_permitted_safe_conclusions', 'matching_sensitive_filter_refusals',
      'matching_recipient_proposal_views', 'matching_recipient_proposal_view_fields', 'matching_match_handoff', 'payload_digest',
      'body_digest', 'private_reason_code', 'proposal_state', 'recipient_role', 'subject_first_name', 'presented_first_name', 'storage_key',
      'media_object_ref', 'materialized_at', 'expires_at AS', "'receivedAt'", "'deliveredAt'"]) {
      if (s.includes(banned)) out.push(`the section reads or prints ${banned}`);
    }
    // A proposal is the reader's only once DELIVERED to them; the word is the screen's own resolver over the reader.
    if (!/FROM public\.matching_proposal_delivery_view_bindings b\s+WHERE b\.recipient_user_id = p_subject/u.test(s)) out.push('proposals only once delivered to the reader');
    if (!s.includes('public.resolve_matching_proposal_neutral_outcome_v1(p.id, p_subject)')) out.push('the neutral word is the screen\'s resolver');
    // Messages: the reader's own, the Introduction era only; an owner-deleted body is absent by the join.
    if (!/m\.author_user_id = p_subject AND m\.material_kind = 'HUMAN_TEXT'\s+AND shared_private\.is_introduction_era_history_item_v1/u.test(s)) out.push('own messages of the Introduction era only');
    if (!/\n\s+JOIN public\.introduction_disclosure_text_payloads t ON t\.resource_version_id = v\.id/u.test(s)) out.push('a deleted share is absent (an inner join on its payload)');
    if (!/'endedByYou', CASE WHEN r\.introduction_status = 'CLOSED' THEN EXISTS \(\s*SELECT 1 FROM public\.introduction_ended_events e\s+WHERE e\.introduction_record_id = r\.id AND e\.actor_user_id = p_subject\) END/u.test(s)) out.push('only whether the reader ended it');
    // The photo reader: the caller's own series only.
    const reader = sql.slice(sql.indexOf('CREATE FUNCTION public.list_my_introduction_photo_renditions_v1'));
    if (!reader.includes('WHERE s.owner_user_id = v_user') || !reader.includes("s.series_state IN ('READY', 'DISCLOSING', 'RETIRED')")) out.push('the photo reader answers the caller\'s own existing renditions only');
    if (!/GRANT EXECUTE ON FUNCTION public\.list_my_introduction_photo_renditions_v1\(\) TO authenticated;/u.test(sql)
      || /GRANT EXECUTE ON FUNCTION public\.list_my_introduction_photo_renditions_v1\(\) TO (?:anon|service_role)/u.test(sql)) out.push('the photo reader is authenticated only');
    return out;
  },
  apiViolations(w) {
    const out = [];
    const service = code(w.service);
    const bundle = service.slice(service.indexOf('async downloadExportBundle('), service.indexOf('async downloadExportPhoto('));
    const file = service.slice(service.indexOf('async downloadExportPhoto('), service.indexOf('private ownPhotos('));
    if (!bundle.includes('const base = await this.downloadExport(accessToken, clientIp);')) out.push('the bundle answers exactly the existing package');
    if (!/if \(inlineBytes \+ media\.bytes\.length > EXPORT_BUNDLE_INLINE_MAX_BYTES\) break;/u.test(bundle)) out.push('the guard moves the rest to the file route, never refuses the export');
    if (/capacity|status\(413\)|PayloadTooLarge/iu.test(service)) out.push('no size refusal of the export');
    if (!service.includes('export const EXPORT_BUNDLE_INLINE_MAX_BYTES = 32 * 1024 * 1024;')) out.push('the one-answer guard is 32 MiB');
    if (!/throw unavailable\(\);\s+\}\s+\}/u.test(bundle) || !bundle.includes("error instanceof ExportMediaIntegrityError ? 'integrity_failure'")) out.push('nothing partial: any failure is 503');
    if (!file.includes('manifestToken(instant(row.available_until), entries) !== token') || !file.includes('throw changed();')) out.push('the file route checks the manifest token and answers CHANGED');
    const disclosure = code(w.disclosure);
    const media = disclosure.slice(disclosure.indexOf('async ownMediaForExport('), disclosure.indexOf('private async discard('));
    const auth = media.indexOf('this.authorizedForExport(token, worldId, handle)');
    const key = media.indexOf('this.repository.mediaKey(handle)');
    if (auth < 0 || key < 0 || auth > key) out.push('every photo is authorized on the reader\'s own token before its key is read');
    if (!media.includes('if (bytes === null) throw new ExportMediaIntegrityError();')) out.push('a missing object is an integrity failure');
    if (!disclosure.includes("'list_my_introduction_photo_renditions_v1'") && !read('apps/api/src/introductions-disclosure/introduction-disclosure.repository.ts').includes("'list_my_introduction_photo_renditions_v1'")) out.push('the own-renditions reader is the source');
    const controller = code(w.controller);
    if ((controller.match(/@Header\(\.\.\.NO_STORE\)/gu) ?? []).length !== 7) out.push('every route is no-store');
    if (!w.census.includes("'GET /account/privacy/export/download/bundle/files/:fileName': 'AUTHENTICATED',")) out.push('the file route is not throttled like a password route');
    if (!w.census.includes("'GET /account/privacy/export/download': 'SECURITY_SENSITIVE'")) out.push('the existing route keeps its class');
    return out;
  },
  mobileViolations(w) {
    const out = [];
    const save = code(w.save);
    const body = save.slice(save.indexOf('export async function saveExportBundle('));
    const photos = body.indexOf("folder.createFile(fileName, 'image/jpeg')");
    const manifest = body.indexOf('folder.createFile(exportManifestName(now)');
    const pkg = body.indexOf('folder.createFile(exportFileName(now)');
    if (!(photos > 0 && manifest > photos && pkg > manifest)) out.push('photos first, the manifest next, the package last');
    if (!body.includes('if (!file.exists || file.size !== photo.bytes) throw')) out.push('each photo is checked on disk');
    if (!body.includes('folder.delete();')) out.push('any failure removes the folder');
    if (!body.includes('if (photos === null) return saveExportDocument(document, now);')) out.push('without photos the package is saved as before');
    if (/'SAVED'[^;]*catch/u.test(body)) out.push('no partial SAVED');
    const client = code(w.client);
    if (!client.includes("'/account/privacy/export/download/bundle'") || !client.includes("'x-qandeel-export-manifest': token")) out.push('the bundle and file routes, under the token');
    if (!client.includes('if (total > EXPORT_BUNDLE_INLINE_MAX_BYTES) return null;') || !client.includes('base64Length(bytesBase64) !== bytes')) out.push('the decoder fails closed');
    if (/setTimeout|setInterval/u.test(client)) out.push('the runtime-entry layer owns no timer');
    if (!code(w.privacyController).includes('const handle = setTimer(() => abort.abort(), ms);')) out.push('the bound is the controller\'s injectable timer');
    // No new sentence: the existing three say everything (exportSaved, exportSaveFailed, network).
    if ((w.settingsCopy.match(/export[A-Z][A-Za-z]*:/gu) ?? []).some((k) => /Photo|Bundle|Folder/u.test(k))) out.push('no new export sentence');
    return out;
  },
  wiringViolations(w) {
    const out = [];
    for (const script of ['verify:personal-export-matching-introductions:integration', 'verify:s6-07-final-journey:integration']) {
      if (!w.workflow.includes(`run: npm run ${script}`)) out.push(`${script} runs in API CI`);
    }
    if (!w.workflow.includes('npm run --silent prove:export-bundle:postgrest')) out.push('the wire proof runs on every PostgREST line');
    for (const name of ['verify-migration-0168.mjs', 'verify-s6-07-final-journey.mjs', 'prove-0168-export-bundle-postgrest.mjs']) {
      if (!w.pkg.includes(`database/${name}`)) out.push(`${name} has a script`);
    }
    if (!w.pkg.includes('"test:s6-07-export-final-integration-contract": "node --test tests/s6-07-export-final-integration-contract.test.mjs"')) out.push('this contract has a script');
    return out;
  },
};

test('1 - the shipped export section, bundle, save and journey hold every property', () => {
  current = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(world()), [], name);
});

test('2 - every detector catches a planted defect', () => {
  for (const [label, detector, make] of [
    ['the other human\'s messages exported', 'migrationViolations', () => plant('migration', "m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'", "m.material_kind = 'HUMAN_TEXT'")],
    ['a proposal never delivered exported', 'migrationViolations', () => plant('migration', 'WHERE b.recipient_user_id = p_subject', 'WHERE p_subject IS NOT NULL')],
    ['the arrival instant exported (Q9)', 'migrationViolations', () => plant('migration', "'yourDecisions', coalesce((", "'deliveredAt', x.first_delivered,\n                           'yourDecisions', coalesce((")],
    ['a conclusion exported', 'migrationViolations', () => plant('migration', "'confirmedFacts', coalesce((", "'conclusions', (SELECT jsonb_agg(c.permitted_text) FROM public.matching_permitted_safe_conclusions c WHERE c.for_recipient_user_id = p_subject),\n            'confirmedFacts', coalesce((")],
    ['who ended it exported', 'migrationViolations', () => plant('migration', 'WHERE e.introduction_record_id = r.id AND e.actor_user_id = p_subject) END', 'WHERE e.introduction_record_id = r.id) END')],
    ['a deleted share exported', 'migrationViolations', () => plant('migration', 'JOIN public.introduction_disclosure_text_payloads t ON t.resource_version_id = v.id', 'LEFT JOIN public.introduction_disclosure_text_payloads t ON t.resource_version_id = v.id')],
    ['introductions left not yet included', 'migrationViolations', () => plant('migration', "'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'));", "'notYetIncluded', jsonb_build_array('shared', 'public', 'replay', 'introductions'));")],
    ['another human\'s renditions read', 'migrationViolations', () => plant('migration', 'WHERE s.owner_user_id = v_user', 'WHERE v_user IS NOT NULL')],
    ['the photo reader granted to service_role', 'migrationViolations', () => plant('migration', 'GRANT EXECUTE ON FUNCTION public.list_my_introduction_photo_renditions_v1() TO authenticated;', 'GRANT EXECUTE ON FUNCTION public.list_my_introduction_photo_renditions_v1() TO authenticated;\n    GRANT EXECUTE ON FUNCTION public.list_my_introduction_photo_renditions_v1() TO service_role;')],
    ['a table added', 'migrationViolations', () => plant('migration', 'COMMIT;', 'CREATE TABLE public.export_photo_cache (k text);\nCOMMIT;')],
    ['the guard refusing the export', 'apiViolations', () => plant('service', 'if (inlineBytes + media.bytes.length > EXPORT_BUNDLE_INLINE_MAX_BYTES) break;', "if (inlineBytes + media.bytes.length > EXPORT_BUNDLE_INLINE_MAX_BYTES) throw new Error('capacity');")],
    ['a key read before the authorization', 'apiViolations', () => plant('disclosure', "    if (!(await this.authorizedForExport(token, worldId, handle))) return { kind: 'NOT_AVAILABLE' };\n    const key: unknown = await this.repository.mediaKey(handle);",
      "    const key: unknown = await this.repository.mediaKey(handle);\n    if (!(await this.authorizedForExport(token, worldId, handle))) return { kind: 'NOT_AVAILABLE' };")],
    ['a missing object exported as nothing', 'apiViolations', () => plant('disclosure', 'if (bytes === null) throw new ExportMediaIntegrityError();', "if (bytes === null) return { kind: 'NOT_AVAILABLE' };")],
    ['the token not checked', 'apiViolations', () => plant('service', 'manifestToken(instant(row.available_until), entries) !== token', 'false')],
    ['the file route throttled like a password', 'apiViolations', () => plant('census', "'GET /account/privacy/export/download/bundle/files/:fileName': 'AUTHENTICATED',", "'GET /account/privacy/export/download/bundle/files/:fileName': 'SECURITY_SENSITIVE',")],
    ['the package written before the photos', 'mobileViolations', () => plant('save', `    for (const [i, fileName] of photos.fileNames.entries()) {`, `    folder.createFile(exportFileName(now), 'application/json').write(JSON.stringify(document));\n    for (const [i, fileName] of photos.fileNames.entries()) {`)],
    ['a photo not checked on disk', 'mobileViolations', () => plant('save', 'if (!file.exists || file.size !== photo.bytes) throw', 'if (!file.exists) throw')],
    ['no rollback', 'mobileViolations', () => plant('save', '      folder.delete();', '      void folder;')],
    ['a timer in the runtime-entry layer', 'mobileViolations', () => plant('client', 'async downloadDataExportBundle(signal?: AbortSignal)', 'async downloadDataExportBundle(signal: AbortSignal = (() => { const c = new AbortController(); setTimeout(() => c.abort(), 1); return c.signal; })())')],
    ['the journey not in CI', 'wiringViolations', () => plant('workflow', 'run: npm run verify:s6-07-final-journey:integration', 'run: echo skipped')],
    ['the wire proof not in CI', 'wiringViolations', () => plant('workflow', 'npm run --silent prove:export-bundle:postgrest', 'echo skipped')],
  ]) {
    assert.notDeepEqual(DETECTORS[detector](make()), [], `the contract catches: ${label}`);
  }
});
