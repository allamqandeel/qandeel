// S6-07 (CP3) - static contract for Introductions Activity, Push and Direct Entry (migration 0167, A3-01 G-17, the CP0
// Event Matrix with Q6 / Q10).
//
// The real behaviour is proven against PostgreSQL (database/verify-migration-0167.mjs), in the API's Jest suites
// (apps/api/src/introductions-activity) and in the mobile integration test (s6-07-introductions-direct-entry.test.tsx).
// This contract pins the shape those proofs rely on, so a later edit cannot quietly widen it:
//   - 0167 creates no relation, replaces nothing, and grants each function to exactly one role; the lister and the reads
//     write nothing; the mute command writes only the caller's own mute row and authorizes by the discovery read;
//   - every Introductions event reaches only its legitimate recipient: never a message's author, never END's actor;
//   - the capability truth is a per-user server truth (no INTRODUCTIONS_ENTERED constant) that the feed, the attention
//     summary, the preferences and the platform dispatcher all read, and a failed read is never "entered";
//   - the per-Introduction mute silences only its own World;
//   - the producer publishes through the ONE A3-01 boundary only, at L0, with the one REUSED generic sentence and no
//     label; a message is Class 4 (never a push), everything else Class 3;
//   - Direct Entry revalidates the exact World / proposal on the caller's token and never substitutes;
//   - the device decodes the destination strictly and opens it through the existing Introductions surfaces;
//   - the proofs are wired into CI.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const sql = (text) => text.replace(/--[^\n]*/gu, '');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');
const MIGRATIONS = 'database/migrations';
const M0167 = '0167_introductions_activity_direct_entry_v1.sql';
const API = 'apps/api/src';
const MOBILE = 'apps/mobile/src';
const FUNCTIONS = ['public.resolve_introductions_capability_v1', 'public.read_my_introductions_capability_v1', 'public.server_read_introductions_capability_v1',
  'public.server_read_introductions_proposal_delivery_v1', 'public.server_list_introductions_activity_v1', 'public.list_own_introduction_world_alerts_v1',
  'public.set_own_introduction_world_alerts_v1'];

const shipped = () => ({
  migration: read(`${MIGRATIONS}/${M0167}`),
  migrations: readdirSync(new URL(`../${MIGRATIONS}/`, import.meta.url)).filter((n) => n.endsWith('.sql')).sort(),
  decision: read(`${API}/activity/activity-decision.ts`),
  service: read(`${API}/activity/activity.service.ts`),
  types: read(`${API}/activity/activity.types.ts`),
  producer: read(`${API}/introductions-activity/introductions-activity.producer.ts`),
  copy: read(`${API}/introductions-activity/introductions-activity-copy.ts`),
  sources: read(`${API}/introductions-activity/introductions-activity.repository.ts`),
  dispatchModule: read(`${API}/introductions-dispatch/introductions-dispatch.module.ts`),
  pushWorker: read(`${API}/push/push-dispatcher.worker.ts`),
  pushDecision: read(`${API}/push/push-dispatch-decision.ts`),
  alerts: read(`${API}/introductions-world/introduction-world-alerts.controller.ts`),
  census: read(`${API}/http-security/route-rate-limit.census.ts`),
  enrollmentRepository: read(`${API}/introductions-enrollment/introductions-enrollment.repository.ts`),
  mobileApi: read(`${MOBILE}/runtime-entry/activity-api.ts`),
  composition: read(`${MOBILE}/integration/composition/DepthComposition.tsx`),
  sharedArea: read(`${MOBILE}/shared-world/SharedWorldArea.tsx`),
  workflow: read('.github/workflows/api-ci.yml'),
  packageJson: read('package.json'),
});

function bodies(text) {
  const out = {};
  for (const match of text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)) {
    const tail = text.slice(match.index);
    const open = tail.indexOf('AS $$') + 'AS $$'.length;
    out[match[1]] = tail.slice(open, tail.indexOf('$$', open));
  }
  return out;
}

function migrationViolations(w) {
  const out = [];
  const statements = sql(w.migration);
  const fns = bodies(w.migration);
  if (w.migrations[w.migrations.indexOf(M0167) - 1] !== '0166_matching_forward_dispatch_v1.sql') out.push('0167 directly follows 0166');
  const created = [...statements.matchAll(/CREATE (OR REPLACE )?FUNCTION ([a-z_]+\.[a-z0-9_]+)\(/gu)].map((m) => `${m[1] ?? ''}${m[2]}`);
  if (JSON.stringify(created) !== JSON.stringify(FUNCTIONS)) out.push(`exactly the seven functions are created, nothing replaced (got ${created})`);
  if (/CREATE TABLE|ALTER TABLE|CREATE POLICY|ON TABLE|\bDROP\s/iu.test(statements)) out.push('no relation, policy or table grant; nothing dropped');
  const grants = [...statements.matchAll(/GRANT EXECUTE ON FUNCTION ([\s\S]*?) TO (\w+)/gu)].map((m) => `${m[2]}:${m[1].replace(/'\s*\|\|\s*'/gu, '').replace(/\s+/gu, ' ').replace(/'/gu, '').trim()}`);
  if (JSON.stringify(grants) !== JSON.stringify([
    'authenticated:public.read_my_introductions_capability_v1(), public.list_own_introduction_world_alerts_v1(), public.set_own_introduction_world_alerts_v1(uuid, boolean)',
    'service_role:public.server_read_introductions_capability_v1(uuid[]), public.server_read_introductions_proposal_delivery_v1(uuid), public.server_list_introductions_activity_v1(integer)',
  ])) out.push(`each function granted to exactly one role (got ${grants})`);
  for (const name of FUNCTIONS.filter((f) => f !== 'public.set_own_introduction_world_alerts_v1')) {
    if (/(INSERT\s+INTO|UPDATE\s|DELETE\s+FROM)/iu.test(sql(fns[name] ?? 'missing UPDATE '))) out.push(`${name} writes nothing`);
  }
  const mute = sql(fns['public.set_own_introduction_world_alerts_v1'] ?? '');
  const writes = [...mute.matchAll(/(?:INSERT INTO|DELETE FROM)\s+([a-z_.]+)/gu)].map((m) => m[1]);
  if (JSON.stringify(writes) !== JSON.stringify(['public.activity_context_mutes', 'public.activity_context_mutes'])
      || !/VALUES \(v_user, p_world_id::text\)/u.test(mute) || !/m\.user_id = v_user AND m\.context_ref = p_world_id::text/u.test(mute)) {
    out.push('the mute command writes only the caller\'s own mute row of the one World');
  }
  if (!/IF NOT EXISTS \(SELECT 1 FROM public\.list_my_introduction_worlds_v1\(\) l WHERE l\.world_id = p_world_id\) THEN\s+RETURN QUERY SELECT 'UNAVAILABLE'::text;/u.test(mute)) {
    out.push('the mute is authorized by the caller\'s own discovery read, one UNAVAILABLE otherwise');
  }
  const lister = sql(fns['public.server_list_introductions_activity_v1'] ?? '');
  if (!/SELECT 'HUMAN_TEXT', CASE WHEN m\.author_user_id = l\.lower_user_id THEN l\.higher_user_id ELSE l\.lower_user_id END/u.test(lister)) out.push('a message tells the other human, never its author');
  if (!/SELECT 'ENDED', CASE WHEN x\.actor_user_id = r\.lower_user_id THEN r\.higher_user_id ELSE r\.lower_user_id END/u.test(lister)) out.push('an ending tells the human who did not end it, never the actor');
  if (!/SELECT 'DISCLOSURE', g\.counterpart_user_id/u.test(lister)) out.push('a disclosure tells its counterpart only');
  if (!/WHERE NOT EXISTS \(SELECT 1 FROM public\.activity_item_members am WHERE am\.user_id = q\.recipient AND am\.candidate_key = q\.ckey\)\n/u.test(lister)) out.push('an event already told is never listed again');
  if (!/resolve_shared_world_material_v1\(d\.world_id, d\.recipient\)/u.test(lister) || !/resolve_shared_world_introduction_disclosure_v1\(d\.world_id, d\.recipient\)/u.test(lister)
      || !/WHERE p\.event NOT IN \('HUMAN_TEXT', 'DISCLOSURE'\)\s+OR EXISTS/u.test(lister)) out.push('a message or a disclosure is listed only while it still resolves to its recipient');
  if (!/interval '7 days'/u.test(lister) || !/p_limit < 1 OR p_limit > 100/u.test(lister)) out.push('the lister is bounded in time and size');
  if (/text_body\s*,|\bname\b|first_name|ckey \|\| /u.test(lister.replace(/res\.text_body IS NOT NULL/gu, ''))) out.push('the lister returns no content and no name');
  return out;
}

function apiViolations(w) {
  const out = [];
  const decision = code(w.decision);
  if (/INTRODUCTIONS_ENTERED/u.test(code(w.decision) + code(w.service))) out.push('no global Introductions constant');
  if (!/if \(!introductionsEntered\) return 'INTRODUCTIONS_NOT_ENTERED';\n\s+\/\/[^\n]*\n\s+if \(item\.context_ref !== null && mutes\.has\(item\.context_ref\)\) return 'MUTED_CONTEXT';/u.test(w.decision)) {
    out.push('Introductions: entered first, then the World\'s own mute');
  }
  if (!/silenceOf\(item, prefs, mutes, input\.introductionsEntered === true\)/u.test(decision)) out.push('the interruption verdict reads the capability truth');
  const service = code(w.service);
  if ((service.match(/this\.enteredOf\(token\)/gu) ?? []).length !== 5 || !/introductions: \{ available: entered, alerts: prefs\.introductionsAlerts \}/u.test(service)
      || !/if \(typeof answer !== 'boolean'\) throw new Error\('ACTIVITY_CAPABILITY_MALFORMED'\);/u.test(service)) {
    out.push('feed, attention and preferences read the caller\'s own capability truth, strictly');
  }
  if (!/const worlds = await this\.repository\.ownIntroductionWorlds\(token\);\n\s+if \(Array\.isArray\(worlds\) && worlds\.some\(\(w\) => w\?\.world_id === id\)\)/u.test(service)
      || !/const proposals = await this\.repository\.ownProposal\(token, id\);\n\s+if \(Array\.isArray\(proposals\) && proposals\.length === 1 && proposals\[0\]\?\.matching_proposal_id === id\)/u.test(service)
      || !/if \(row\.context_ref !== id\) throw new Error\('ACTIVITY_OPEN_MALFORMED'\);/u.test(service)) {
    out.push('Direct Entry revalidates the exact World or proposal on the caller\'s token');
  }
  if (!/'SHARED_WORLD', 'PUBLIC_WORLD', 'INTRODUCTIONS'\]\);/u.test(w.types)) out.push('INTRODUCTIONS is executable');
  const producer = code(w.producer);
  if (!/event\.event === 'HUMAN_TEXT' \? 4 : 3/u.test(producer) || /interruptionClass: [12]\b/u.test(producer)) out.push('a message is Class 4, everything else Class 3');
  if ((producer.match(/disclosureMax: 'L[0-3]'/gu) ?? []).join() !== "disclosureMax: 'L0'" || !/contextLabel: null/u.test(producer) || !/secondary: null/u.test(producer)
      || !/body: INTRODUCTIONS_ACTIVITY_COPY\.update/u.test(producer)) out.push('L0, no label, no secondary, the one reused sentence');
  if (!/update: LOCK_SCREEN_COPY\.generic\.INTRODUCTIONS as Bilingual/u.test(w.copy) || /ar: '|en: '/u.test(code(w.copy))) out.push('the sentence is REUSED, never new copy');
  if (/repository\.publish|server_publish|activity\/activity\.repository/u.test(producer) || !/this\.publisher\.publish\(/u.test(producer)) out.push('only through the ONE A3-01 boundary');
  if (!/if \(source === null \|\| source\.recipientUserId !== delivery\.recipientUserId \|\| source\.proposalId !== delivery\.proposalId\) return;/u.test(producer)) {
    out.push('a delivery is re-read before it is told');
  }
  if (!/\{ provide: INTRODUCTIONS_DELIVERY_NOTIFIER, useExisting: IntroductionsActivityProducer \}/u.test(w.dispatchModule)) out.push('the producer is the dispatcher\'s notifier');
  if (!/\.catch\(\(\) => new Map<string, boolean>\(\)\)/u.test(w.pushWorker) || !/introductionsEntered: entered\.get\(c\.userId\) === true/u.test(w.pushWorker)
      || !/introductionsEntered: claim\.introductionsEntered === true,/u.test(w.pushDecision)) out.push('the platform dispatcher revalidates the capability; a failed read is not entered');
  const alerts = code(w.alerts);
  if (!/'rpc\/list_own_introduction_world_alerts_v1'/u.test(alerts) || !/'rpc\/set_own_introduction_world_alerts_v1'/u.test(alerts) || /ServiceRole|service_role/u.test(alerts)) {
    out.push('the alerts run on the caller\'s own token, through 0167 only');
  }
  for (const route of ["'GET /introductions/alerts': 'AUTHENTICATED'", "'PUT /introductions/worlds/:worldId/alerts': 'AUTHENTICATED'", "'POST /introductions/enrollment/revocation': 'AUTHENTICATED'"]) {
    if (!w.census.includes(route)) out.push(`route census: ${route}`);
  }
  const revocation = w.enrollmentRepository.slice(w.enrollmentRepository.indexOf('const REVOCATION'), w.enrollmentRepository.indexOf('});', w.enrollmentRepository.indexOf('const REVOCATION')));
  if (![...revocation.matchAll(/'([a-z_]+_v1)'/gu)].map((m) => m[1]).every((fn) => ['turn_off_matching_participation_v1', 'revoke_matching_context_v1', 'revoke_pre_match_disclosure_authority_v1'].includes(fn))
      || (revocation.match(/_v1'/gu) ?? []).length !== 3) out.push('a withdrawal reaches exactly the three retained 0109 withdrawal commands');
  return out;
}

function mobileViolations(w) {
  const out = [];
  if (!/if \(value\.kind === 'INTRODUCTIONS' && hasExactly\(value, \['kind', 'target'\]\) && isRecord\(value\.target\)\)/u.test(w.mobileApi)
      || !/t\.kind === 'WORLD' && hasExactly\(t, \['kind', 'worldId'\]\) && typeof t\.worldId === 'string' && UUID\.test\(t\.worldId\)/u.test(w.mobileApi)
      || !/t\.kind === 'PROPOSAL' && hasExactly\(t, \['kind', 'proposalId'\]\) && typeof t\.proposalId === 'string' && UUID\.test\(t\.proposalId\)/u.test(w.mobileApi)) {
    out.push('the device decodes the Introductions destination strictly');
  }
  const entry = w.composition.slice(w.composition.indexOf("if (destination.kind === 'INTRODUCTIONS') {"), w.composition.indexOf("setArea('MY_WORLD');\n    if (destination.kind === 'PERSONAL_CONVERSATION')"));
  if (!/setIntroductionEntry\(\{ worldId: destination\.target\.worldId, n: introductionEntries\.current \}\);\n\s+setArea\('SHARED_WORLD'\);/u.test(entry)
      || !/setProposalsShown\(true\);/u.test(entry)) out.push('the device opens the exact target through the existing Introductions surfaces');
  if (!/if \(introductionEntry != null && introductions !== undefined && introductionEntry !== takenEntry\) \{\n\s+setTakenEntry\(introductionEntry\);\n\s+setIntroduction\(introductionEntry\.worldId\);\n\s+\}/u.test(w.sharedArea)) out.push('the Shared area opens exactly the named Introduction World, once per entry');
  // CP3 R1: the entry is taken while rendering, never by a synchronous setState inside an effect (react-hooks/set-state-in-effect).
  if (/useEffect\(\(\) => \{\n\s+if \(introductionEntry/u.test(w.sharedArea)) out.push('the Direct Entry is not taken by a setState inside an effect');
  return out;
}

function wiringViolations(w) {
  const out = [];
  for (const [script, file] of [['verify:introductions-activity:integration', 'database/verify-migration-0167.mjs'],
    ['test:s6-07-activity-direct-entry-contract', 'tests/s6-07-activity-direct-entry-contract.test.mjs']]) {
    if (!w.packageJson.includes(`"${script}": "`) || !w.packageJson.includes(file)) out.push(`package.json ${script}`);
  }
  if (!w.workflow.includes('run: npm run verify:introductions-activity:integration')) out.push('CI runs verify-0167');
  if (!w.workflow.includes('run: npm run test:s6-07-activity-direct-entry-contract')) out.push('CI runs this contract');
  return out;
}

const DETECTORS = { migrationViolations, apiViolations, mobileViolations, wiringViolations };
const plant = (key, from, to) => {
  const w = shipped();
  assert.ok(w[key].includes(from), `planted anchor exists in ${key}: ${from.slice(0, 60)}`);
  return { ...w, [key]: w[key].replace(from, to) };
};

test('1 - the shipped migration, API, device and wiring hold every property', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

test('2 - every detector catches a planted defect', () => {
  for (const [label, detector, world] of [
    ['the lister granted to authenticated', 'migrationViolations', () => plant('migration', "public.server_list_introductions_activity_v1(integer) TO service_role';",
      "public.server_list_introductions_activity_v1(integer) TO service_role';\n    GRANT EXECUTE ON FUNCTION public.server_list_introductions_activity_v1(integer) TO authenticated;")],
    ['a new table', 'migrationViolations', () => plant('migration', 'BEGIN;\n', 'BEGIN;\nCREATE TABLE public.introduction_activity_log (id uuid);\n')],
    ['a message told to its author', 'migrationViolations', () => plant('migration', "SELECT 'HUMAN_TEXT', CASE WHEN m.author_user_id = l.lower_user_id THEN l.higher_user_id ELSE l.lower_user_id END",
      "SELECT 'HUMAN_TEXT', m.author_user_id")],
    ['an ending told to its actor', 'migrationViolations', () => plant('migration', "SELECT 'ENDED', CASE WHEN x.actor_user_id = r.lower_user_id THEN r.higher_user_id ELSE r.lower_user_id END",
      "SELECT 'ENDED', x.actor_user_id")],
    ['a deleted message still told', 'migrationViolations', () => plant('migration', "   WHERE p.event NOT IN ('HUMAN_TEXT', 'DISCLOSURE')\n      OR EXISTS", "   WHERE true\n      OR EXISTS")],
    ['an event told twice', 'migrationViolations', () => plant('migration', 'WHERE am.user_id = q.recipient AND am.candidate_key = q.ckey', 'WHERE am.user_id = q.recipient AND am.candidate_key = q.ckey AND false')],
    ['a mute of any World', 'migrationViolations', () => plant('migration', '  IF NOT EXISTS (SELECT 1 FROM public.list_my_introduction_worlds_v1() l WHERE l.world_id = p_world_id) THEN', '  IF false THEN')],
    ['a mute written for someone else', 'migrationViolations', () => plant('migration', 'VALUES (v_user, p_world_id::text) ON CONFLICT DO NOTHING', 'VALUES (p_world_id, p_world_id::text) ON CONFLICT DO NOTHING')],
    ['the global constant back', 'apiViolations', () => plant('decision', 'export function silenceOf(', 'export const INTRODUCTIONS_ENTERED = true;\nexport function silenceOf(')],
    ['the Introduction mute ignored', 'apiViolations', () => plant('decision', "      if (item.context_ref !== null && mutes.has(item.context_ref)) return 'MUTED_CONTEXT';\n      return prefs.introductionsAlerts", '      return prefs.introductionsAlerts')],
    ['a guessed capability', 'apiViolations', () => plant('service', "    if (typeof answer !== 'boolean') throw new Error('ACTIVITY_CAPABILITY_MALFORMED');", '')],
    ['a World opened without its read', 'apiViolations', () => plant('service', 'if (Array.isArray(worlds) && worlds.some((w) => w?.world_id === id)) {', 'if (true) {')],
    ['a message pushed', 'apiViolations', () => plant('producer', "event.event === 'HUMAN_TEXT' ? 4 : 3", '3')],
    ['a richer Lock Screen', 'apiViolations', () => plant('producer', "disclosureMax: 'L0' as const", "disclosureMax: 'L2' as const")],
    ['new copy shipped', 'apiViolations', () => plant('copy', 'update: LOCK_SCREEN_COPY.generic.INTRODUCTIONS as Bilingual,', "update: { ar: 'رسالة جديدة', en: 'A new message' },")],
    ['a delivery told without its re-read', 'apiViolations', () => plant('producer', 'if (source === null || source.recipientUserId !== delivery.recipientUserId || source.proposalId !== delivery.proposalId) return;', 'if (source === null) return;')],
    ['a failed capability read counted as entered', 'apiViolations', () => plant('pushWorker', 'introductionsEntered: entered.get(c.userId) === true', 'introductionsEntered: entered.get(c.userId) !== false')],
    ['a withdrawal reaching a creation command', 'apiViolations', () => plant('enrollmentRepository', "participation: ['turn_off_matching_participation_v1',", "participation: ['activate_matching_participation_v1',")],
    ['a loose destination decoder', 'mobileViolations', () => plant('mobileApi', "t.kind === 'WORLD' && hasExactly(t, ['kind', 'worldId']) && typeof t.worldId === 'string' && UUID.test(t.worldId)", "t.kind === 'WORLD'")],
    ['a guessed World on the device', 'mobileViolations', () => plant('sharedArea', 'setIntroduction(introductionEntry.worldId);', 'setIntroduction(introductions.getState().worlds[0]?.worldId ?? null);')],
    ['the verifier not in CI', 'wiringViolations', () => plant('workflow', 'run: npm run verify:introductions-activity:integration', 'run: echo skipped')],
  ]) {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `the contract catches: ${label}`);
  }
});

test('3 - 0167 changes no frozen source and opens nothing', () => {
  const text = sql(read(`${MIGRATIONS}/${M0167}`));
  assert.doesNotMatch(text, /CREATE OR REPLACE FUNCTION/u, '0167 replaces no earlier function');
  assert.doesNotMatch(text, /\b(?:set_gate_v1|install_consent_text_v1|install_matching_proposal_polic|server_publish_activity_candidate_v1)/u, 'no gate, consent text, policy or Activity item');
  assert.doesNotMatch(text, /_core_v1|lock_matching|enroll_my_matching_setup_v1|server_forward_approved/u, 'no Matching core, lock or command is reached');
});
