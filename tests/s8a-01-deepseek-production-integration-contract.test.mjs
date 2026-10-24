// S8A-01 — DeepSeek Production Integration & First Real Conversation: the static contract.
//
// What S8A-01 must keep true (the Product Owner's CP0 Closure & Implementation Direction, 2026-10-21):
//   - the DeepSeek router never reads the reasoning trace, sends no end-user identifier, talks only to DeepSeek's fixed
//     base URL with the SDK's OPENAI_* header sources nulled, and exists only behind the AI-COST-01 accounting;
//   - it refuses to start in production and outside SYNTHETIC_ONLY (synthetic qualification only);
//   - the reply passes the output release guard before it reaches the orchestrator;
//   - migration 0170 replaces exactly the three AI-COST-01 registries in one transaction, its begin command is 0135's
//     byte for byte except the one allow-list line, and it grants, alters or writes nothing;
//   - the record states its lifecycle without claiming a merge, the backlog carries the three admissions, the locators
//     name the record, and this contract and the 0170 verifier run in CI.
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const readIfPresent = (path) => (existsSync(join(root, path)) ? read(path) : null);
const tsCode = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const sqlCode = (text) => text.replace(/--[^\n]*/gu, '');

const ROUTER = 'apps/api/src/model-router/providers/deepseek/deepseek-model-router.ts';
const CONFIG = 'apps/api/src/model-router/providers/deepseek/deepseek-model-router.config.ts';
// RE-ANCHORED by S8A-03 (D1): the client posture and the qualification gate moved into the one shared DeepSeek client
// module, which the reply router and all seven structured adapters use. Every property below is unchanged.
const CLIENT = 'apps/api/src/model-router/providers/deepseek/deepseek-client.ts';
const M0135 = 'database/migrations/0135_ai_usage_cost_credit_ledger_v1.sql';
const M0170 = 'database/migrations/0170_s8a_01_deepseek_provider_ledger_admission_v1.sql';
const RECORD = 'docs/e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md';
const BACKLOG = 'docs/qandeel-canonical-backlog-v1.md';
const ADMITTED = {
  'QAN-BL-AI-01': ['`Stage 8A — QANDEEL AI Brain / Production LLM Runtime`', '`HIGH`'],
  'QAN-BL-AI-02': ['`Stage 8A — QANDEEL AI Brain / Production LLM Runtime`', '`HIGH`'],
  'QAN-BL-AI-03': ['`Stage 9 — Economy + Launch Closure (release-readiness gate)`', '`MEDIUM`'],
  // The closing change: the Shared / Public DEEP budget the Product Owner's DEEP decision left at 10 s.
  'QAN-BL-AI-04': ['`Stage 8A — QANDEEL AI Brain / Production LLM Runtime`', '`MEDIUM`'],
};

const world = () => ({
  router: read(ROUTER), config: read(CONFIG), client: read(CLIENT), m0135: read(M0135), m0170: read(M0170),
  record: readIfPresent(RECORD) ?? '', backlog: read(BACKLOG),
  state: readIfPresent('QANDEEL_CURRENT_STATE.md'), map: readIfPresent('QANDEEL_PROJECT_MAP.md'),
  roadmap: readIfPresent('QANDEEL_PRODUCT_ROADMAP.md'),
  pkg: JSON.parse(read('package.json')), apiCi: read('.github/workflows/api-ci.yml'),
});

/** One function's definition, from its qualified name (0135 says CREATE, 0170 CREATE OR REPLACE) to the `$$;` that closes it. */
function functionText(sql, name) {
  const start = sql.search(new RegExp(`(?<=^CREATE (OR REPLACE )?FUNCTION )public\\.${name}\\(`, 'mu'));
  if (start < 0) return null;
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5);
  return end < 0 ? null : sql.slice(start, end + 3);
}

const detectors = {
  routerViolations(w) {
    const out = [];
    const code = tsCode(w.router);
    const client = tsCode(w.client);
    if (/reasoning_content/u.test(code)) out.push('the router never reads the reasoning trace');
    if (/\buser(_id)?\s*:/u.test(code) || /safety_identifier|metadata\s*:/u.test(code)) out.push('the router sends no end-user identifier');
    if (!/baseURL: DEEPSEEK_API_BASE_URL,/u.test(client)) out.push('the client talks to the fixed DeepSeek base URL');
    for (const header of ['organization', 'project', 'adminAPIKey', 'webhookSecret']) {
      if (!new RegExp(`\\b${header}: null,`, 'u').test(client)) out.push(`the client nulls the SDK's ${header} source`);
    }
    if (!/static fromEnvironment\(telemetry: TelemetryService \| undefined, accounting: AiProviderCallAccounting\)/u.test(code)) out.push('the environment composition requires the accounting');
    if (!/accountedDeepSeekChatCompletionsClient\(createDeepSeekClient\(config\), 'CONVERSATION_REPLY', accounting\)/u.test(code)) out.push('the environment composition is accounted');
    if (!/content: releaseModelOutput\(candidate, serverGuidance\),/u.test(code)) out.push('the reply passes the output release guard');
    if (!/choice\?\.finish_reason !== 'stop'/u.test(code)) out.push('only a complete answer is a reply');
    if (!/stream: false,/u.test(code) || !/maxRetries: 0, signal/u.test(code)) out.push('one non-streamed attempt per turn');
    return out;
  },

  configViolations(w) {
    const out = [];
    const code = `${tsCode(w.config)}\n${tsCode(w.client)}`;
    if (!/environment\.NODE_ENV === 'production'\) \{\s*throw/u.test(code)) out.push('the router refuses to start in production');
    if (!/DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE = 'SYNTHETIC_ONLY'/u.test(code) || !/environment\.DEEPSEEK_QUALIFICATION_MODE\?\.trim\(\) !== DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE\)/u.test(code)) out.push('the router starts only in SYNTHETIC_ONLY');
    if (!/DEEPSEEK_API_BASE_URL = 'https:\/\/api\.deepseek\.com'/u.test(code)) out.push('the base URL is DeepSeek\'s, fixed in code');
    if (/DEEPSEEK_BASE_URL|environment\.[A-Z_]*BASE_URL|process\.env\.[A-Z_]*BASE_URL/u.test(code)) out.push('no environment variable can redirect the DeepSeek call');
    return out;
  },

  migrationViolations(w) {
    const out = [];
    const sql = sqlCode(w.m0170);
    if ((sql.match(/^BEGIN;$/gmu) ?? []).length !== 1 || (sql.match(/^COMMIT;$/gmu) ?? []).length !== 1) out.push('0170 is one transaction');
    const replaced = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(/gu)].map((m) => m[1]).sort();
    if (JSON.stringify(replaced) !== JSON.stringify(['ai_complete_usage_kinds_v1', 'ai_provider_operation_is_known_v1', 'begin_ai_provider_call_v1'])) out.push('0170 replaces exactly the three AI-COST-01 registries');
    const outsideBodies = sql.replace(/AS \$\$[\s\S]*?\$\$;/gu, '');
    if (/\b(GRANT|REVOKE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b|CREATE (TABLE|INDEX|POLICY|TRIGGER)/u.test(outsideBodies)) out.push('0170 grants, alters and writes nothing');
    if (!/ELSE ARRAY\[\]::text\[\]/u.test(sql)) out.push('an unlisted provider gets an empty usage partition (fails closed)');
    const before = functionText(sqlCode(w.m0135), 'begin_ai_provider_call_v1')?.split('\n');
    const after = functionText(sql, 'begin_ai_provider_call_v1')?.split('\n');
    if (!before || !after || before.length !== after.length) out.push('0170 carries the 0135 begin command');
    else {
      const changed = before.map((line, i) => [line, after[i]]).filter(([a, b]) => a !== b);
      if (changed.length !== 1 || changed[0][1].trim() !== "IF p_provider NOT IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK') THEN") out.push('0170 changes only the begin allow-list line');
    }
    return out;
  },

  governanceViolations(w) {
    const out = [];
    if (w.record === '') return [`${RECORD} exists`];
    const status = w.record.split('\n').find((line) => line.startsWith('**Status:**')) ?? '';
    if (status === '') out.push('the record states its lifecycle');
    if (/\bMERGED\b(?! \/)/u.test(status)) out.push('the record never claims its own merge');
    if (!w.record.includes('26d05fff999b1188137ec0d2220f64ac5e7e456b')) out.push('the record names its base');
    const index = w.backlog.slice(w.backlog.indexOf('## 4. Index'), w.backlog.indexOf('## 5. Items'));
    for (const [id, [owner, severity]] of Object.entries(ADMITTED)) {
      const row = index.split('\n').find((line) => line.startsWith(`| \`${id}\` |`));
      if (!row || !row.includes(`| ${owner} | ${severity} | \`DEFERRED — OWNED\` |`)) out.push(`the backlog index admits ${id}`);
      if (!w.backlog.includes(`### \`${id}\` — `)) out.push(`the backlog carries ${id} in full`);
    }
    for (const [name, text] of [['Current State', w.state], ['the Project Map', w.map], ['the Roadmap', w.roadmap]]) {
      // A checkout without the root locators (the forward-safety mirror) has nothing to check here.
      if (text !== null && !text.includes(RECORD)) out.push(`${name} names the S8A-01 record`);
    }
    if (w.pkg.scripts['test:s8a-01-deepseek-production-integration-contract'] !== 'node --test tests/s8a-01-deepseek-production-integration-contract.test.mjs') out.push('the contract has its npm script');
    if (w.pkg.scripts['verify:ai-usage-deepseek-admission:integration'] !== 'node --env-file-if-exists=.env database/verify-migration-0170.mjs') out.push('the 0170 verifier has its npm script');
    if (!/run: npm run test:s8a-01-deepseek-production-integration-contract\}/u.test(w.apiCi)) out.push('API CI runs this contract');
    if (!/run: npm run verify:ai-usage-deepseek-admission:integration/u.test(w.apiCi)) out.push('API CI runs the 0170 verifier');
    return out;
  },
};

for (const [name, detect] of Object.entries(detectors)) {
  test(`S8A-01: ${name.replace('Violations', '')} holds`, () => assert.deepEqual(detect(world()), []));
}

test('every detector catches a planted defect', () => {
  const planted = [
    ['routerViolations', (w) => ({ ...w, router: w.router.replace('const candidate = choice?.message?.content;', 'const candidate = choice?.message?.content ?? (choice?.message as never as { reasoning_content: string }).reasoning_content;') }), 'the router never reads the reasoning trace'],
    ['routerViolations', (w) => ({ ...w, router: w.router.replace('stream: false,', 'stream: false, user: SYNTHETIC,') }), 'the router sends no end-user identifier'],
    ['routerViolations', (w) => ({ ...w, client: w.client.replace('    project: null,\n', '') }), "the client nulls the SDK's project source"],
    ['routerViolations', (w) => ({ ...w, router: w.router.replace('content: releaseModelOutput(candidate, serverGuidance),', 'content: candidate.trim(),') }), 'the reply passes the output release guard'],
    ['configViolations', (w) => ({ ...w, client: w.client.replace("environment.NODE_ENV === 'production'", "environment.NODE_ENV === 'staging'") }), 'the router refuses to start in production'],
    ['configViolations', (w) => ({ ...w, client: w.client.replace("DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE = 'SYNTHETIC_ONLY'", "DEEPSEEK_SYNTHETIC_QUALIFICATION_MODE = 'REAL_USERS'") }), 'the router starts only in SYNTHETIC_ONLY'],
    ['migrationViolations', (w) => ({ ...w, m0170: w.m0170.replace("IF p_provider NOT IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK') THEN", "IF p_provider NOT IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK', 'QWEN') THEN") }), '0170 changes only the begin allow-list line'],
    ['migrationViolations', (w) => ({ ...w, m0170: w.m0170.replace('    ELSE ARRAY[]::text[]\n', '') }), 'an unlisted provider gets an empty usage partition (fails closed)'],
    ['migrationViolations', (w) => ({ ...w, m0170: w.m0170.replace('COMMIT;', 'GRANT EXECUTE ON FUNCTION public.begin_ai_provider_call_v1 TO authenticated;\nCOMMIT;') }), '0170 grants, alters and writes nothing'],
    ['governanceViolations', (w) => ({ ...w, record: w.record.replace(/^\*\*Status:\*\* .*$/mu, '**Status:** CLOSED / MERGED') }), 'the record never claims its own merge'],
    ['governanceViolations', (w) => ({ ...w, backlog: w.backlog.replace('| `QAN-BL-AI-02` |', '| `QAN-BL-AI-0X` |') }), 'the backlog index admits QAN-BL-AI-02'],
    ['governanceViolations', (w) => ({ ...w, map: (w.map ?? '').replaceAll(RECORD, 'docs/e2e/S8A.md') }), 'the Project Map names the S8A-01 record'],
  ];
  for (const [detector, plant, expected] of planted) {
    const planted = plant(world());
    assert.ok(detectors[detector](planted).includes(expected), `${detector} catches: ${expected}`);
  }
});
