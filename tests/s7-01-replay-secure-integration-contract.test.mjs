// S7-01 - static contract for the Personal Replay secure integration and its account erasure (migration 0169) and for
// the graphics-independent API boundary over it (apps/api/src/replay).
//
// The behaviour is proven on real PostgreSQL (database/verify-migration-0169.mjs: the closed gate, the lifecycle, two
// accounts and no existence oracle, whole messages, the open head, the analysis equal to the canonical K(TC), idempotency,
// the governed erasure and six races) and by the API specs (apps/api/src/replay/replay.spec.ts). This contract pins the
// shape those proofs rely on, so a later edit cannot quietly widen it:
//   - 0169 exposes exactly eleven SECURITY INVOKER wrappers to `authenticated`, none taking a human identity; every
//     privileged body lives in `replay_private`; no application role executes a frozen I-06 core; the capability ships
//     closed (no gate row) and every command binds it before the primitive; MY_WORLD is the only source class; no command
//     reaches export, package, publication or the public bridge; the CW2-08 seam stays NOT_EVALUATED; the 0072
//     projection is called, never re-defined; the erasure registers its relations and owns the residue it cannot cover;
//   - the API module calls only those wrappers on the caller's token, reuses the T-03C mapper and depth law, and imports
//     no mobile, graphics, AI or distribution code; the application root stays untouched;
//   - no mobile surface calls a Replay route (S7-01 has no player). S7-02 RE-ANCHOR: the Personal Replay entry adds the
//     ONE mobile client, `apps/mobile/src/runtime-entry/replay-api.ts`, and it calls only the entry's routes (the
//     capability, this conversation's Replays, one Replay, create and revise a draft). No other production module calls a
//     Replay route, and no mobile code calls preview, finalize, reopen, a version, its moments or their analysis: those
//     stay S7-03's. Test doubles under `__tests__` / `__fixtures__` are not production surfaces;
//   - the proofs are wired into CI.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const sqlCode = (text) => text.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const files = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? files(path) : [path];
});

const WRAPPERS = ['read_my_replay_capability_v1', 'create_my_replay_draft_v1', 'revise_my_replay_draft_v1', 'prepare_my_replay_preview_v1',
  'finalize_my_replay_version_v1', 'reopen_my_replay_for_revision_v1', 'read_my_replay_v1', 'read_my_replay_version_v1', 'read_my_replay_moments_v1',
  'read_my_replay_moment_analysis_v1', 'list_my_conversation_replays_v1'];
const COMMANDS = ['create_my_replay_draft_v1', 'revise_my_replay_draft_v1', 'prepare_my_replay_preview_v1', 'finalize_my_replay_version_v1', 'reopen_my_replay_for_revision_v1'];
const FROZEN_CORES = ['create_replay_draft_v1', 'revise_replay_draft_v1', 'prepare_replay_preview_v1', 'finalize_replay_version_v1', 'reopen_replay_for_revision_v1'];
/** S7-02 RE-ANCHOR: the ONE mobile client of the Replay routes (the entry and selection's own). */
const S7_02_REPLAY_CLIENT = 'apps/mobile/src/runtime-entry/replay-api.ts';
const API_FILES = ['replay.controller.ts', 'replay.module.ts', 'replay.repository.ts', 'replay.service.ts', 'replay.types.ts'];

const shipped = () => ({
  migration: read('database/migrations/0169_replay_personal_secure_integration_erasure_v1.sql'),
  api: Object.fromEntries(API_FILES.map((name) => [name, read(`apps/api/src/replay/${name}`)])),
  account: read('apps/api/src/account/account.module.ts'),
  app: read('apps/api/src/app.module.ts'),
  mobile: files('apps/mobile/src').filter((path) => /\.(ts|tsx)$/u.test(path)).map((path) => [path, read(path)]),
  workflow: read('.github/workflows/api-ci.yml'),
  pkg: read('package.json'),
  focused: read('database/focused-verifiers.json'),
});
const plant = (key, from, to, inner) => {
  const w = shipped();
  if (inner) {
    assert.ok(w[key][inner].includes(from), `the planted defect's anchor exists in ${key}/${inner}: ${from.slice(0, 80)}`);
    return { ...w, [key]: { ...w[key], [inner]: w[key][inner].replace(from, to) } };
  }
  assert.ok(w[key].includes(from), `the planted defect's anchor exists in ${key}: ${from.slice(0, 80)}`);
  return { ...w, [key]: w[key].replace(from, to) };
};
/** The body of one CREATE FUNCTION, up to its closing dollar quote. */
const body = (sql, name) => {
  const start = sql.indexOf(`CREATE FUNCTION ${name}(`);
  if (start < 0) return '';
  const open = sql.indexOf('$$', start);
  return sql.slice(start, sql.indexOf('$$', open + 2) + 2);
};

const DETECTORS = {
  migrationViolations(w) {
    const out = [];
    const sql = sqlCode(w.migration);
    const publicFunctions = [...sql.matchAll(/CREATE FUNCTION public\.([a-z0-9_]+)\(/gu)].map((m) => m[1]);
    if (JSON.stringify(publicFunctions) !== JSON.stringify(WRAPPERS)) out.push('0169 exposes exactly the eleven wrappers');
    const replaced = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(/gu)].map((m) => m[1]);
    if (JSON.stringify(replaced) !== JSON.stringify(['server_read_account_erasure_operations_v1'])) out.push('0169 forward-replaces only the 0164 operations reader in public');
    for (const name of WRAPPERS) {
      const fn = body(sql, `public.${name}`);
      if (!/LANGUAGE sql (?:STABLE|VOLATILE) SECURITY INVOKER SET search_path = '' AS \$\$/u.test(fn)) out.push(`${name} is a SECURITY INVOKER sql wrapper`);
      if (!fn.includes(`FROM replay_private.${name}(`)) out.push(`${name} is one call into its replay_private definer`);
      const args = fn.slice(fn.indexOf('(') + 1, fn.indexOf(')'));
      if (/user|owner|actor|creator|source_class|unit|manifest/iu.test(args)) out.push(`${name} takes no human identity, source class or source-internal identity`);
    }
    for (const name of COMMANDS) {
      const fn = body(sql, `replay_private.${name}`);
      const gate = fn.indexOf('replay_private.bind_replay_launch_gate_v1()');
      const core = fn.search(new RegExp(`public\\.(?:${FROZEN_CORES.join('|')})\\(`, 'u'));
      const evidence = fn.indexOf('INSERT INTO replay_private.personal_replay_launch_evidence');
      if (!/SECURITY DEFINER/u.test(fn) || !fn.includes('v_user uuid := (SELECT auth.uid());')) out.push(`${name}: the actor is auth.uid() inside a definer`);
      if (!(gate > 0 && core > gate && evidence > core)) out.push(`${name}: the gate is bound before the frozen primitive, the evidence after it`);
      if (!/WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN/u.test(fn)) out.push(`${name}: 40001 / PT409 are absorbed into a bounded word`);
      if (/export|publish|distribut|package|public_bridge|audience/iu.test(fn)) out.push(`${name}: no command reaches export, publication or distribution`);
    }
    if (!/'MY_WORLD', p_session_id, NULL, v_range\.unit_ids/u.test(body(sql, 'replay_private.create_my_replay_draft_v1'))) out.push('MY_WORLD is the only source class a draft is born from');
    // Only the operator setter writes a gate row; the migration itself writes none.
    if (/INSERT INTO replay_private\.replay_launch_capability_states/u.test(sql.replace(body(sql, 'replay_private.set_replay_launch_capability_v1'), ''))) {
      out.push('the capability ships closed: no gate row');
    }
    if (/GRANT[^;]*\b(?:create|revise|prepare|finalize|reopen)_replay_[a-z_]*_v1\(/iu.test(sql.replace(/\b(?:create|revise|prepare|finalize|reopen)_my_replay/gu, 'x'))) {
      out.push('no role is granted a frozen I-06 core');
    }
    if (/GRANT[^;]*\bTO (?:anon|PUBLIC)\b/iu.test(sql)) out.push('nothing is granted to anon or PUBLIC');
    if (/GRANT[^;]*replay_private\.(?:set_replay_launch_capability_v1|bind_replay_launch_gate_v1|derive_identity_v1|resolve_personal_range_v1|version_viewing_state_v1)/u.test(sql)) {
      out.push('no application role executes the operator setter, the bare gate binding or a helper');
    }
    if (/CREATE (?:OR REPLACE )?FUNCTION public\.get_session_historical_projection_v1/u.test(sql)) out.push('the 0072 projection is called, never re-defined');
    if (!body(sql, 'replay_private.read_my_replay_moment_analysis_v1').includes('public.replay_analytical_projection_point_digest_v1(')) {
      out.push('the moment analysis is served only when it re-digests to what the version froze');
    }
    if (!/IS DISTINCT FROM 'NOT_EVALUATED' THEN\s+RAISE EXCEPTION 'S7-01: the CW2-08/u.test(sql)) out.push('the CW2-08 seam is asserted still NOT_EVALUATED');
    if (/CREATE (?:OR REPLACE )?FUNCTION public\.[a-z0-9_]*cw2_08|replay_distribution_prerequisite[a-z_]*\s*\(\s*\)\s*RETURNS/iu.test(sql)) out.push('the CW2-08 seam is not re-defined');
    if (!sql.includes("('REPLAY_OUTSIDE_PERSONAL', false, 'QAN-BL-ACCT-03 - not opened: non-Personal Replay sources and Replay distribution')")) {
      out.push('the residue the erasure cannot cover is owned by QAN-BL-ACCT-03');
    }
    if (!/CREATE FUNCTION account_erasure_private\.erase_personal_replays_v1\(p_deletion_id uuid, p_user uuid\)/u.test(sql)) out.push('the erasure is one module of the governed coordinator');
    if (/QAN-BL-PROD-09|QAN-BL-PRIV-05/u.test(sql.replace(/'[^']*'/gu, ''))) out.push('0169 takes neither PROD-09 nor PRIV-05');
    return out;
  },

  apiViolations(w) {
    const out = [];
    const repository = tsCode(w.api['replay.repository.ts']);
    const called = [...repository.matchAll(/this\.rpc\(token, '([a-z0-9_]+)'/gu)].map((m) => m[1]);
    if (JSON.stringify([...called].sort()) !== JSON.stringify([...WRAPPERS].sort())) out.push('the repository calls exactly the eleven wrappers');
    if (/service[-_]?role|ServiceRole/iu.test(Object.values(w.api).map(tsCode).join('\n'))) out.push('the Replay module holds no service_role path');
    if (/p_user|p_owner|p_actor|p_source_class|unit_ids/u.test(repository)) out.push('the repository sends no human identity or source-internal identity');
    const service = tsCode(w.api['replay.service.ts']);
    if (!service.includes("from '../historical-projection/historical-projection-mapper'") || !service.includes('mapHistoricalAnalyticalFamilies(row.analysis, tc)')) {
      out.push('the moment analysis is mapped by the T-03C mapper');
    }
    if (!service.includes('discloseAnalyticalRungs(')) out.push('the moment analysis is disclosed by the T-03C depth law');
    for (const [name, text] of Object.entries(w.api)) {
      const source = tsCode(text);
      for (const target of [...source.matchAll(/from '([^']+)'/gu)].map((m) => m[1])) {
        if (!(target.startsWith('./') || ['@nestjs/common', '@qandeel/runtime', '../auth/authenticated-request', '../auth/supabase-auth.guard', '../auth/supabase-auth.service',
          '../conversation/supabase-data-api.service', '../historical-projection/historical-disclosure', '../historical-projection/historical-projection-mapper'].includes(target))) {
          out.push(`${name} imports only auth, the Data API transport and the T-03C functions (${target})`);
        }
      }
      if (/apps\/mobile|react|skia|LivingAnalysis|MapSurface|temporal-navigation|model-router/iu.test(source)) out.push(`${name} imports no mobile, graphics or AI code`);
      if (/colou?r|#[0-9a-f]{6}\b|easing|keyframe/iu.test(source)) out.push(`${name} authors no colour or motion`);
      for (const match of source.matchAll(/^(export\s+)?import(\s+type)?\s[^\n]*'@qandeel\/runtime'/gmu)) {
        if (!/import type/u.test(match[0])) out.push(`${name} imports @qandeel/runtime as a type`);
      }
    }
    const controller = tsCode(w.api['replay.controller.ts']);
    if (/@(?:Post|Get)\('[^']*(?:export|publish|share|download|distribut|library)/iu.test(controller)) out.push('no route exports, publishes, shares, downloads or lists a library');
    if (!/@Controller\('replay'\)\s*@UseGuards\(SupabaseAuthGuard\)/u.test(controller)) out.push('every Replay route is behind the verified token');
    if (!/ReplayModule\]/u.test(w.account) || !w.account.includes("import { ReplayModule } from '../replay/replay.module';")) out.push('the Account module composes ReplayModule');
    if (/replay/iu.test(w.app)) out.push('the application root is untouched');
    return out;
  },

  mobileViolations(w) {
    const out = [];
    for (const [path, text] of w.mobile) {
      if (/create_my_replay|ReplayModule/u.test(text)) out.push(`${path}: no mobile code names a Replay wrapper or the API module`);
      if (/\/__(tests|fixtures)__\//u.test(path)) continue;
      const calls = /['`]\/replay\/|\/replay\b['`]/u.test(text);
      if (calls && path !== S7_02_REPLAY_CLIENT) out.push(`${path}: S7-01 has no player or client; S7-02's one client is ${S7_02_REPLAY_CLIENT}`);
      if (calls && /\/(preview|finalize|reopen|versions|moments|analysis)\b/u.test(tsCode(text))) out.push(`${path}: the player's routes stay S7-03's`);
    }
    return out;
  },

  wiringViolations(w) {
    const out = [];
    const pkg = JSON.parse(w.pkg).scripts;
    if (pkg['verify:replay-personal-secure-integration:integration'] !== 'node --env-file-if-exists=.env database/verify-migration-0169.mjs') out.push('the 0169 verifier script');
    if (pkg['test:s7-01-replay-secure-integration-contract'] !== 'node --test tests/s7-01-replay-secure-integration-contract.test.mjs') out.push('this contract script');
    if (!w.workflow.includes('run: npm run verify:replay-personal-secure-integration:integration')) out.push('CI runs the 0169 verifier');
    if (!w.workflow.includes('run: npm run test:s7-01-replay-secure-integration-contract}')) out.push('CI runs this contract');
    const group = JSON.parse(w.focused).groups['s7-01'];
    if (!group || group.verifiers[0] !== 'database/verify-migration-0169.mjs'
        || !['0100', '0101', '0102', '0103', '0104', '0105', '0106', '0107', '0072', '0164', '0166', '0130', '0150'].every((n) => group.verifiers.includes(`database/verify-migration-${n}.mjs`))) {
      out.push('the focused s7-01 group runs 0169 with every verifier it must leave unchanged');
    }
    return out;
  },
};

test('the shipped S7-01 change satisfies every detector', () => {
  const w = shipped();
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(w), [], name);
});

const PLANTED = [
  ['a wrapper that takes a human identity', 'migrationViolations', () => plant('migration', 'CREATE FUNCTION public.read_my_replay_v1(p_replay_id uuid)', 'CREATE FUNCTION public.read_my_replay_v1(p_user_id uuid)')],
  ['a wrapper that runs as definer', 'migrationViolations', () => plant('migration', `CREATE FUNCTION public.read_my_replay_moments_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (selected_ordinal integer, tc integer, source_role text, original_medium text,
               omitted_before integer, source_text text)
LANGUAGE sql STABLE SECURITY INVOKER`, `CREATE FUNCTION public.read_my_replay_moments_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (selected_ordinal integer, tc integer, source_role text, original_medium text,
               omitted_before integer, source_text text)
LANGUAGE sql STABLE SECURITY DEFINER`)],
  ['a pre-opened capability', 'migrationViolations', () => plant('migration', 'GRANT USAGE ON SCHEMA replay_private TO authenticated;',
    "INSERT INTO replay_private.replay_launch_capability_states (capability_scope) VALUES ('PERSONAL_REPLAY');\nGRANT USAGE ON SCHEMA replay_private TO authenticated;")],
  ['a frozen core granted to the client', 'migrationViolations', () => plant('migration', 'GRANT USAGE ON SCHEMA replay_private TO authenticated;',
    'GRANT EXECUTE ON FUNCTION public.finalize_replay_version_v1(uuid, uuid, uuid) TO authenticated;\nGRANT USAGE ON SCHEMA replay_private TO authenticated;')],
  ['a helper granted to the client', 'migrationViolations', () => plant('migration', '  replay_private.read_my_replay_capability_v1(),\n  replay_private.create_my_replay_draft_v1',
    '  replay_private.read_my_replay_capability_v1(),\n  replay_private.resolve_personal_range_v1(uuid, integer, integer),\n  replay_private.create_my_replay_draft_v1')],
  ['a source class other than MY_WORLD', 'migrationViolations', () => plant('migration', "'MY_WORLD', p_session_id, NULL, v_range.unit_ids", "'SHARED_WORLD', p_session_id, NULL, v_range.unit_ids")],
  ['an analysis served without its digest', 'migrationViolations', () => plant('migration', `  v_digest := public.replay_analytical_projection_point_digest_v1(
    v_projected.tc,`, `  v_digest := v_point.point_digest; PERFORM (
    v_projected.tc,`)],
  ['a re-defined projection', 'migrationViolations', () => plant('migration', 'GRANT USAGE ON SCHEMA replay_private TO authenticated;',
    'CREATE OR REPLACE FUNCTION public.get_session_historical_projection_v1() RETURNS void LANGUAGE sql AS $f$ SELECT $f$;\nGRANT USAGE ON SCHEMA replay_private TO authenticated;')],
  ['an unowned residue class', 'migrationViolations', () => plant('migration', "'QAN-BL-ACCT-03 - not opened: non-Personal Replay sources and Replay distribution')", "'nobody')")],
  ['the repository calling a frozen core', 'apiViolations', () => plant('api', "this.rpc(token, 'finalize_my_replay_version_v1'", "this.rpc(token, 'finalize_replay_version_v1'", 'replay.repository.ts')],
  ['a mobile import in the API', 'apiViolations', () => plant('api', "import { ReplayRepository, type ReplayRow } from './replay.repository';", "import { ReplayRepository, type ReplayRow } from './replay.repository';\nimport { LivingAnalysisSurface } from '../../../mobile/src/living-analysis';", 'replay.service.ts')],
  ['a second mapper', 'apiViolations', () => plant('api', 'mapHistoricalAnalyticalFamilies(row.analysis, tc)', 'mapOwnAnalysis(row.analysis, tc)', 'replay.service.ts')],
  ['a publish route', 'apiViolations', () => plant('api', "  @Post(':replayId/reopen')", "  @Post(':replayId/publish')\n  @HttpCode(200)\n  publish() { return null; }\n\n  @Post(':replayId/reopen')", 'replay.controller.ts')],
  ['the module composed in the application root', 'apiViolations', () => ({ ...shipped(), app: `${shipped().app}\n// ReplayModule\n` })],
  ['a mobile client of the Replay routes', 'mobileViolations', () => ({ ...shipped(), mobile: [...shipped().mobile, ['apps/mobile/src/replay/api.ts', "fetch(`${base}/replay/drafts`); request('/replay/capability')"]] })],
  ['a player route in the S7-02 client', 'mobileViolations', () => ({ ...shipped(), mobile: shipped().mobile.map(([path, text]) => [path, path === S7_02_REPLAY_CLIENT ? `${text}\nthis.read(\`/replay/\${id}/preview\`);` : text]) })],
  ['a Replay wrapper named in a mobile test', 'mobileViolations', () => ({ ...shipped(), mobile: [...shipped().mobile, ['apps/mobile/src/replay-entry/__tests__/x.test.ts', "rpc('create_my_replay_draft_v1')"]] })],
  ['the verifier left out of CI', 'wiringViolations', () => plant('workflow', 'run: npm run verify:replay-personal-secure-integration:integration', 'run: true')],
];

for (const [label, detector, world] of PLANTED) {
  test(`the ${detector} detector catches ${label}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], label);
  });
}
