// W3-MEGA-M — Conversational Memory Control & Trust (E2E-D-13): static contract.
//
// Each detector guards one property the task froze, runs clean on the shipped source, and is proven able to fail by
// planted defects below. Behaviour is proven elsewhere (API Jest on the production route; real PostgreSQL in
// database/verify-migration-0128.mjs); this contract keeps the SHAPE from drifting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) { if (name !== 'node_modules' && name !== '__tests__') out.push(...walk(path)); } else out.push(path);
  }
  return out;
}

const shipped = Object.freeze({
  migration: read('database/migrations/0128_conversational_memory_control_v1.sql'),
  interpreter: read('apps/api/src/memory/memory-control.interpreter.ts'),
  resolution: read('apps/api/src/memory/memory-control.resolution.ts'),
  service: read('apps/api/src/memory/memory-control.service.ts'),
  copy: read('apps/api/src/memory/memory-control.copy.ts'),
  controlRepository: read('apps/api/src/memory/memory-control.repository.ts'),
  orchestrator: read('apps/api/src/conversation/conversation-orchestrator.service.ts'),
  conversationRepository: read('apps/api/src/conversation/conversation.repository.ts'),
  enrichment: read('apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts'),
  evaluator: read('apps/api/src/memory/memory-write-evaluator.service.ts'),
  mobileNames: walk('apps/mobile/src').join('\n'),
  mobileSource: walk('apps/mobile/src').filter((path) => /\.(?:ts|tsx)$/u.test(path)).map((path) => read(path)).join('\n'),
  packageJson: read('package.json'),
  ci: read('.github/workflows/api-ci.yml'),
});
const controlModules = (w) => [w.interpreter, w.resolution, w.service, w.copy, w.controlRepository].join('\n');
const sqlFunction = (sql, name) => {
  const start = sql.indexOf(`CREATE FUNCTION public.${name}(`);
  return start < 0 ? '' : sql.slice(start, sql.indexOf('$$;', start) + 3);
};

// 1. The provider is never Memory authority, and Memory is not QANDEEL Understanding.
function authorityViolations(w) {
  const out = [];
  const code = controlModules(w);
  if (/model-router|MODEL_ROUTER|\.generate\(|provider/iu.test(code.replace(/\/\/.*$/gmu, '').replace(/\/\*[\s\S]*?\*\//gu, ''))) out.push('a Memory-control module reaches a model or provider');
  if (/from '\.\.\/(?:understanding|hypothesis|human-model)/u.test(code) || /hypothes|understanding_/iu.test(w.migration.replace(/--.*$/gmu, ''))) out.push('Memory control depends on QANDEEL Understanding / Hypothesis');
  for (const pure of [w.interpreter, w.resolution]) {
    if (/from '(?!\.\/memory(?:-control)?\.types')/u.test(pure) || /await |fetch\(|Date\.now/u.test(pure)) out.push('interpretation / resolution is not pure and CPU-only');
  }
  if ((w.orchestrator.match(/this\.router\.generate\(/gu) ?? []).length !== 1) out.push('a second provider call appeared on the turn path');
  return out;
}

// 2. One boundary on the real turn route: after Safety, ALLOW only, before every other lane, finalized atomically.
function routeViolations(w) {
  const out = [];
  const o = w.orchestrator;
  const block = o.indexOf("safety.disposition === 'BLOCK'");
  const allow = o.indexOf("if (safety.disposition === 'ALLOW') {\n        const previousUserContent");
  const plan = o.indexOf("this.engine('memory_control',selection.path,()=>this.memoryControl.plan(");
  const finalize = o.indexOf('this.repository.finalizeMemoryControlTurn(');
  const him = o.indexOf("const himForegroundLanePromise = this.engine('him_context'");
  if (!(block > 0 && block < allow && allow < plan && plan < finalize && finalize < him)) out.push('the Memory boundary is not Safety-gated, ALLOW-only and ahead of every other lane');
  if ((o.match(/this\.memoryControl\.plan\(/gu) ?? []).length !== 1) out.push('more than one Memory-control entry on the turn path');
  if (!/if \(!finalized\) return this\.currentResult\(accessToken, userId, claimed\);\n\s+this\.telemetry\.recordTurnOutcome\('completed',selection\.path\);\n\s+return \{ userTurn: finalized\.userTurn, assistantTurn: finalized\.assistantTurn \};\n\s+\}\n\s+\}\n/u.test(o.slice(finalize)))
    out.push('a Memory-control turn does not end with its own atomic finalization');
  if (!w.conversationRepository.includes("this.serviceApi.rpc<Array<{ outcome: MemoryControlOutcome; user_turn: ConversationTurn; assistant_turn: ConversationTurn }>>('server_finalize_memory_control_turn_v1'"))
    out.push('the Memory command is not the server-authority atomic RPC');
  if (/dataApi\.request[^;]*server_finalize_memory_control_turn_v1/u.test(w.conversationRepository)) out.push('the Memory command runs with a caller token');
  return out;
}

// 3. The atomic command: the change, the record and the canonical finalization in ONE transaction; the reply is the
//    one for the outcome actually committed; a turn that is not GENERATING writes nothing.
function atomicViolations(w) {
  const out = [];
  const fn = sqlFunction(w.migration, 'server_finalize_memory_control_turn_v1');
  if (!fn) return ['the atomic command is missing'];
  if (!/t\.role='USER' AND t\.status='GENERATING'\s+FOR UPDATE;\s+IF NOT FOUND THEN RETURN; END IF;/u.test(fn)) out.push('the source turn is not locked GENERATING first, or a stale turn still writes');
  const insert = fn.indexOf('INSERT INTO public.memory_control_commands');
  const finalize = fn.indexOf('FROM public.finalize_conversation_turn_v2(');
  if (!(insert > 0 && insert < finalize)) out.push('the command is not recorded in the same transaction before finalization');
  if (!/IF finalized_user IS NULL THEN RAISE EXCEPTION/u.test(fn)) out.push('an unfinalized turn could keep its Memory change');
  if (!/IF applied='TARGET_CHANGED' THEN reply := p_reply_if_changed; END IF;/u.test(fn)) out.push('the reply is not chosen from the committed outcome');
  if (/'TARGET_CHANGED'\s*,\s*'CLARIFICATION|p_outcome NOT IN \([^)]*TARGET_CHANGED/u.test(fn)) out.push('TARGET_CHANGED can be requested instead of decided');
  for (const primitive of ['server_create_memory_v1', 'server_supersede_memory_v1', 'server_mark_memory_deleted_v1', 'server_disable_memory_v1']) {
    if (!fn.includes(`public.${primitive}(`)) out.push(`the command does not reuse ${primitive}`);
  }
  if (/'USER_STATED'/u.test(fn) === false || /p_source\b|p_status\b/u.test(fn)) out.push('the caller chooses source or status');
  if (/DELETE FROM public\.memories/u.test(w.migration)) out.push('forget is a physical DELETE');
  return out;
}

// 4. The DISABLED primitive: narrow, owner-bound, locked, status-only, convergent, server-only; no generic updater.
function disableViolations(w) {
  const out = [];
  const fn = sqlFunction(w.migration, 'server_disable_memory_v1');
  if (!fn) return ['the DISABLED primitive is missing'];
  if (!fn.includes('CREATE FUNCTION public.server_disable_memory_v1(p_user_id uuid, p_memory_id uuid)')) out.push('the primitive takes more than an owner and a Memory');
  if (!/m\.id=p_memory_id AND m\.user_id=p_user_id FOR UPDATE/u.test(fn)) out.push('the target is not owner-bound and row-locked');
  if (!/IF target\.status='DISABLED' THEN RETURN NEXT target; RETURN; END IF;/u.test(fn)) out.push('a repeat does not converge');
  if (!/SET status='DISABLED', updated_at=CURRENT_TIMESTAMP\s+WHERE/u.test(fn)) out.push('the primitive moves more than status and updated_at');
  if (!/GRANT EXECUTE ON FUNCTION public\.server_disable_memory_v1\(uuid,uuid\) TO service_role;/u.test(w.migration)
    || /server_disable_memory_v1\(uuid,uuid\) TO (?:authenticated|anon|PUBLIC)/u.test(w.migration)) out.push('the primitive is not service-role only');
  if (/GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.(?:memories|memory_control_commands)/u.test(w.migration)) out.push('a role regained direct write');
  if (/SET status\s*=\s*p_/u.test(w.migration)) out.push('a generic status updater appeared');
  return out;
}

// 5. No guessed mutation: only a unique full match is RESOLVED; a pointer ("that information") always asks.
function guessViolations(w) {
  const out = [];
  if (!w.resolution.includes("if (full.length === 1) return { state: 'RESOLVED', memory: full[0].memory };")) out.push('RESOLVED is not the unique full match');
  if ((w.resolution.match(/state: 'RESOLVED'/gu) ?? []).length !== 2) out.push('a second path to RESOLVED exists');
  const deictic = w.service.slice(w.service.indexOf('private deictic('), w.service.indexOf('private correction('));
  if (!deictic || /lifecycleChange|targetMemoryId/u.test(deictic)) out.push('a pointer to earlier words can change Memory without asking');
  if (/targetMemoryId: (?!target\.id)/u.test(w.service)) out.push('a target id comes from somewhere other than a canonical row');
  if (!/if \(resolution\.state !== 'RESOLVED'\) return null;/u.test(w.service)) out.push('an answer in words is acted on without a unique match');
  return out;
}

// 6. Replies are Conversation, not diagnostics; nothing Memory-shaped is logged; background never re-applies a command.
function replyViolations(w) {
  const out = [];
  if (/\.id\b|status|confidence|importance|\bACTIVE\b|\bDISABLED\b|\bDELETED\b/u.test(w.copy.replace(/\/\/.*$/gmu, '').replace(/import[^;]+;/gu, '').replace(/Extract<[^>]+>|case '[A-Z_]+'/gu, ''))) out.push('a reply can carry an id, a status or a score');
  if (/console\.|Logger|logger\./u.test(controlModules(w))) out.push('Memory control logs');
  if (!/if\(decision\.decision==='SKIP'\)return decision;if\(interpretMemoryControl\(currentUserContent\)\)return\{decision:'SKIP',reason:'MEMORY_CONTROL_COMMAND'\};/u.test(w.enrichment)) out.push('background inference can re-apply an explicit Memory command');
  if (!/\(\?<!\[\\p\{L\}\\p\{N\}_\]\)\(\?:password\|passwd\|passcode\|كلمة السر/u.test(w.evaluator)) out.push('the Arabic secret screen is ASCII-bounded again');
  return out;
}

// 7. Conversation-first: no Memory editor, page or Settings destination in the product.
function surfaceViolations(w) {
  const out = [];
  if (/memory/iu.test(w.mobileNames.split('\n').map((path) => path.split('/').pop()).join('\n'))) out.push('a Memory screen / file appeared in the mobile product');
  if (/memory_control|memory-control|MemoryEditor|MemoryScreen|ذاكرة قنديل/iu.test(w.mobileSource)) out.push('the mobile product reaches Memory control outside the Conversation');
  return out;
}

// 8. Registration.
function registrationViolations(w) {
  const out = [];
  const scripts = JSON.parse(w.packageJson).scripts ?? {};
  if (scripts['test:w3-mega-m-conversational-memory-control-contract'] !== 'node --test tests/w3-mega-m-conversational-memory-control-contract.test.mjs') out.push('the contract script is not registered');
  if (scripts['verify:conversational-memory-control:integration'] !== 'node --env-file-if-exists=.env database/verify-migration-0128.mjs') out.push('the verifier script is not registered');
  const contract = w.ci.indexOf('npm run test:w3-mega-m-conversational-memory-control-contract');
  if (contract < 0 || contract > w.ci.indexOf('Apply all migrations to fresh PostgreSQL')) out.push('API CI does not run the static contract before the database bootstrap');
  if (!w.ci.includes('run: npm run verify:conversational-memory-control:integration')) out.push('API CI does not run the real-PostgreSQL verifier');
  return out;
}

const DETECTORS = { authorityViolations, routeViolations, atomicViolations, disableViolations, guessViolations, replyViolations, surfaceViolations, registrationViolations };

test('W3-MEGA-M: every detector is clean on the shipped source', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(shipped), [], name);
});

const src = shipped;
const PLANTED = [
  ['a provider decides the target', 'authorityViolations', () => ({ ...src, service: `${src.service}\nimport { MODEL_ROUTER } from '../model-router/model-router.types';` })],
  ['Memory control reads Understanding', 'authorityViolations', () => ({ ...src, service: `${src.service}\nimport { UnderstandingService } from '../understanding/understanding.service';` })],
  ['resolution awaits I/O', 'authorityViolations', () => ({ ...src, resolution: `${src.resolution}\nconst x = await fetch('x');` })],
  ['a second provider call', 'authorityViolations', () => ({ ...src, orchestrator: `${src.orchestrator}\nthis.router.generate({});` })],
  ['GUIDED turns reach the boundary', 'routeViolations', () => ({ ...src, orchestrator: src.orchestrator.replace("if (safety.disposition === 'ALLOW') {\n        const previousUserContent", "if (safety.disposition !== 'BLOCK') {\n        const previousUserContent") })],
  ['Human Intelligence launched before the Memory boundary', 'routeViolations', () => ({ ...src, orchestrator: src.orchestrator.replace("if (safety.disposition === 'ALLOW') {\n        const previousUserContent", "const himForegroundLanePromise = this.engine('him_context', selection.path, work);\n      if (safety.disposition === 'ALLOW') {\n        const previousUserContent") })],
  ['the command runs with the caller token', 'routeViolations', () => ({ ...src, conversationRepository: src.conversationRepository.replace("this.serviceApi.rpc<Array<{ outcome: MemoryControlOutcome; user_turn: ConversationTurn; assistant_turn: ConversationTurn }>>('server_finalize_memory_control_turn_v1'", "this.dataApi.request(token, 'rpc/server_finalize_memory_control_turn_v1'") })],
  ['a stale turn still writes', 'atomicViolations', () => ({ ...src, migration: src.migration.replace("t.role='USER' AND t.status='GENERATING'\n    FOR UPDATE;\n  IF NOT FOUND THEN RETURN; END IF;", "t.role='USER'\n    FOR UPDATE;") })],
  ['the reply is the requested one whatever happened', 'atomicViolations', () => ({ ...src, migration: src.migration.replace("IF applied='TARGET_CHANGED' THEN reply := p_reply_if_changed; END IF;", '') })],
  ['finalization in a separate step', 'atomicViolations', () => ({ ...src, migration: src.migration.replace('FROM public.finalize_conversation_turn_v2(', 'FROM public.not_finalizing(') })],
  ['forget as physical DELETE', 'atomicViolations', () => ({ ...src, migration: `${src.migration}\nDELETE FROM public.memories WHERE id = p_target_memory_id;` })],
  ['a caller-chosen status', 'atomicViolations', () => ({ ...src, migration: src.migration.replace("p_type text, p_content text,", "p_type text, p_content text, p_status text,") })],
  ['disable rewrites content', 'disableViolations', () => ({ ...src, migration: src.migration.replace("SET status='DISABLED', updated_at=CURRENT_TIMESTAMP\n    WHERE", "SET status='DISABLED', updated_at=CURRENT_TIMESTAMP, content='x'\n    WHERE") })],
  ['disable granted to clients', 'disableViolations', () => ({ ...src, migration: `${src.migration}\nGRANT EXECUTE ON FUNCTION public.server_disable_memory_v1(uuid,uuid) TO authenticated;` })],
  ['a generic status updater', 'disableViolations', () => ({ ...src, migration: `${src.migration}\nUPDATE public.memories SET status = p_status;` })],
  ['disable without the row lock', 'disableViolations', () => ({ ...src, migration: src.migration.replace('m.id=p_memory_id AND m.user_id=p_user_id FOR UPDATE', 'm.id=p_memory_id') })],
  ['best-of-several is acted on', 'guessViolations', () => ({ ...src, resolution: src.resolution.replace("if (full.length > 1) return { state: 'AMBIGUOUS'", "if (full.length > 1) return { state: 'RESOLVED', memory: full[0].memory }; if (false) return { state: 'AMBIGUOUS'") })],
  ['a pointer changes Memory directly', 'guessViolations', () => ({ ...src, service: src.service.replace("if (pointed.state === 'RESOLVED') return clarification(kind, language, [pointed.memory]);", "if (pointed.state === 'RESOLVED') return lifecycleChange(kind, language, pointed.memory);") })],
  ['a words answer acted on loosely', 'guessViolations', () => ({ ...src, service: src.service.replace("if (resolution.state !== 'RESOLVED') return null;", "if (resolution.state === 'NONE') return null;") })],
  ['a reply shows an id', 'replyViolations', () => ({ ...src, copy: `${src.copy}\nexport const leak = (m: { id: string }) => m.id;` })],
  ['Memory control logs content', 'replyViolations', () => ({ ...src, service: `${src.service}\nconsole.log(turn.content);` })],
  ['background re-applies the command', 'replyViolations', () => ({ ...src, enrichment: src.enrichment.replace("if(interpretMemoryControl(currentUserContent))return{decision:'SKIP',reason:'MEMORY_CONTROL_COMMAND'};", '') })],
  ['the Arabic secret screen regresses', 'replyViolations', () => ({ ...src, evaluator: src.evaluator.replace('(?<![\\p{L}\\p{N}_])(?:password|passwd|passcode|كلمة السر', '\\b(?:password|passwd|passcode|كلمة السر') })],
  ['a Memory editor screen', 'surfaceViolations', () => ({ ...src, mobileNames: `${src.mobileNames}\napps/mobile/src/memory/MemoryEditorScreen.tsx` })],
  ['a Settings destination for Memory', 'surfaceViolations', () => ({ ...src, mobileSource: `${src.mobileSource}\nconst rows = [{ key: 'memory_control', label: 'ذاكرة قنديل' }];` })],
  ['the verifier is not run', 'registrationViolations', () => ({ ...src, ci: src.ci.replace('run: npm run verify:conversational-memory-control:integration', 'run: echo skipped') })],
];

for (const [label, detector, plant] of PLANTED) {
  test(`W3-MEGA-M planted defect is caught: ${label}`, () => {
    assert.notDeepEqual(DETECTORS[detector](plant()), [], `${detector} missed: ${label}`);
  });
}
