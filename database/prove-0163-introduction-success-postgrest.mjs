// S6-06 (CP1) - live proof of SUCCESS and reactivation (migration 0163) THROUGH a real PostgREST server, driven by the
// API's OWN compiled continuation service (apps/api/dist, built earlier in the same CI job).
//
// verify-migration-0163.mjs proves the boundaries under SET ROLE. This proves condition 3 on the real wire, where each
// RPC is its own transaction exactly as in production:
//
//   S01  each human sees only their own approval state
//   S02  the second approval commits; the API's system attempts then fail inside the commit (an injected 40001) - the
//        answer is still APPROVED, both approvals are intact and nothing terminal exists; the next read attempts again
//        and completes, exactly once
//   S03  both approvals stand while the gate is closed: every read attempts and answers the pending state, writing
//        nothing and opening nothing; once the gate allows, the next read completes, exactly once
//   S04  reactivation after END: NOT_AVAILABLE_NOW while the gate is closed, then one explicit REACTIVATED
//   S05  anon and service_role tokens cannot call any boundary; the frozen cores are not callable at all
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import http from 'node:http';
import process from 'node:process';
import { D, DFN, I07D_SEAMS, PFN, createIntroductionRuntime } from './introduction-lifecycle-verifier-support.mjs';

const require = createRequire(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const rt = createIntroductionRuntime(databaseUrl);
const { rows } = rt;
let stage = 'load the compiled API';
const { IntroductionContinuationRepository } = require('../apps/api/dist/introductions-continuation/introduction-continuation.repository.js');
const { IntroductionContinuationService } = require('../apps/api/dist/introductions-continuation/introduction-continuation.service.js');
const { SupabaseDataApiService } = require('../apps/api/dist/conversation/supabase-data-api.service.js');

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 900 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
function startGateway() {
  const server = http.createServer(async (request, response) => {
    try {
      if (!request.url?.startsWith('/rest/v1/')) { response.writeHead(404).end(); return; }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !['host', 'apikey', 'content-length', 'connection', 'transfer-encoding', 'keep-alive'].includes(name)));
      const upstream = await fetch(`${postgrestUrl}${request.url.slice('/rest/v1'.length)}`, {
        method: request.method, headers, body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
async function wire(token, name, body) {
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, { method: 'POST', body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const refused = (r, label) => assert.ok(([401, 403].includes(r.status) && r.body?.code === '42501') || (r.status === 404 && r.body?.code === 'PGRST202'),
  `${label} is not callable (${r.status} ${JSON.stringify(r.body)})`);

async function truth(f) {
  await rt.asRole('postgres');
  return {
    pointers: await rows(`SELECT approver_user_id, current_event_id FROM ${D.APPROVAL_STATE} WHERE transition_version_id = $1 ORDER BY approver_user_id`, [f.version]),
    events: Number((await rows(`SELECT count(*) n FROM ${D.APPROVALS} WHERE transition_version_id = $1`, [f.version]))[0].n),
    terminal: Number((await rows(`SELECT count(*) n FROM ${D.TERMINAL} WHERE introduction_record_id = $1`, [f.record]))[0].n),
    phase: (await rows('SELECT phase FROM public.shared_worlds WHERE id = $1', [f.world]))[0].phase,
  };
}

async function main() {
  await rt.client.connect();
  const humans = Array.from({ length: 6 }, () => randomUUID());
  const [a, b, c, d, e, g] = humans;
  const seams = [];
  let gateway = null;
  let failure = null;
  let injected = false;
  try {
    stage = 'gateway and fixtures';
    gateway = await startGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_PUBLISHABLE_KEY = 'prove-0163-gateway';
    const service = new IntroductionContinuationService(new IntroductionContinuationRepository(new SupabaseDataApiService()));
    service.delay = async () => undefined;
    const repository = new IntroductionContinuationRepository(new SupabaseDataApiService());
    await rt.provisionHumans(humans);
    for (const seam of [PFN.PREREQUISITES, ...I07D_SEAMS]) seams.push(await rt.captureMatchingSeam(seam));
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    const pair = async (x, y) => {
      await rt.recordFacts(x, { sex: 'FEMALE', firstName: 'Mona' });
      await rt.recordFacts(y, { sex: 'MALE', firstName: 'Omar' });
      const f = await rt.bringToSuccessProposed(x, y);
      await rt.asRole('postgres');
      return f;
    };
    const token = (uid) => jwt({ sub: uid, role: 'authenticated' });
    const restoreSuccessGate = async () => rt.restoreMatchingSeam(seams.find((s) => JSON.stringify(s).includes('resolve_introduction_success_prerequisites_v1')));

    stage = 'S01 each human sees only their own state';
    const f = await pair(a, b);
    assert.deepEqual(await service.readSuccess(token(a), f.world), { outcome: 'TRANSITION', versionId: f.version, myState: 'NONE', expectedEventId: null });
    const first = await service.approve(token(a), f.world, { commandId: randomUUID(), versionId: f.version, expectedEventId: null });
    assert.equal(first.outcome, 'APPROVED', 'S01 one approval completes nothing');
    assert.equal((await service.readSuccess(token(b), f.world)).myState, 'NONE', 'S01 the other learns nothing of it');

    stage = 'S02 the system attempt fails inside the commit: the approvals stand, the next read completes once';
    await rt.asRole('postgres');
    await rows(`CREATE FUNCTION public.s6_06_prove_inject_conflict_v1() RETURNS trigger LANGUAGE plpgsql AS $inject$
                BEGIN RAISE EXCEPTION 'injected serialization failure' USING ERRCODE = '40001'; END $inject$`);
    await rows(`CREATE TRIGGER s6_06_prove_inject_conflict BEFORE INSERT ON ${D.TERMINAL} FOR EACH ROW EXECUTE FUNCTION public.s6_06_prove_inject_conflict_v1()`);
    injected = true;
    const second = await service.approve(token(b), f.world, { commandId: randomUUID(), versionId: f.version, expectedEventId: null });
    assert.equal(second.outcome, 'APPROVED', 'S02 the approval answer survives the failed attempts');
    const held = await truth(f);
    assert.deepEqual([held.pointers.length, held.events, held.terminal, held.phase], [2, 2, 0, 'INTRODUCTION'], 'S02 both approvals intact, nothing terminal');
    await rows(`DROP TRIGGER s6_06_prove_inject_conflict ON ${D.TERMINAL}`);
    await rows('DROP FUNCTION public.s6_06_prove_inject_conflict_v1()');
    injected = false;
    assert.deepEqual(await service.readSuccess(token(a), f.world), { outcome: 'COMPLETED' }, 'S02 the next read completes');
    assert.deepEqual(await service.readSuccess(token(b), f.world), { outcome: 'COMPLETED' });
    const done = await truth(f);
    assert.deepEqual([done.terminal, done.phase, done.events, done.pointers], [1, 'STANDARD', 2, held.pointers], 'S02 exactly once; the approvals untouched');

    stage = 'S03 the gate is closed after both approvals: reads write nothing; once it allows, one commit';
    const h = await pair(c, d);
    for (const human of [c, d]) {
      const answer = (await repository.approve(token(human), randomUUID(), h.world, h.version, null))[0];
      assert.equal(answer.outcome, 'APPROVED');
    }
    await restoreSuccessGate();
    const closedTruth = await truth(h);
    for (let round = 0; round < 3; round += 1) {
      for (const human of [c, d]) assert.equal((await service.readSuccess(token(human), h.world)).myState, 'APPROVED', 'S03 still pending');
    }
    assert.deepEqual(await truth(h), closedTruth, 'S03 nothing written while the gate is closed');
    assert.equal(await rt.seamClearance('public.resolve_introduction_success_prerequisites_v1'), 'NOT_EVALUATED', 'S03 the gate was not opened');
    await rt.clearAllSeams();
    assert.deepEqual(await service.readSuccess(token(d), h.world), { outcome: 'COMPLETED' }, 'S03 the gate allows: completed');
    assert.equal((await truth(h)).terminal, 1, 'S03 exactly once');

    stage = 'S04 reactivation after END';
    await rt.recordFacts(e, { sex: 'FEMALE', firstName: 'Mona' });
    await rt.recordFacts(g, { sex: 'MALE', firstName: 'Omar' });
    const k = await rt.bringToIntroduction(e, g);
    await rt.asRole('postgres');
    assert.deepEqual((await wire(token(e), 'end_own_introduction_v1', { p_command_id: randomUUID(), p_world_id: k.world })).body, [{ outcome: 'ENDED' }]);
    const participation = await service.readParticipation(token(e));
    assert.deepEqual([participation.state, participation.pauseReason], ['PAUSED', 'POST_INTRODUCTION']);
    await rt.restoreMatchingSeam(seams.find((s) => JSON.stringify(s).includes('resolve_matching_reactivation_prerequisites_v1')));
    assert.deepEqual(await service.reactivate(token(e), { commandId: randomUUID(), expectedEventId: participation.expectedEventId }), { outcome: 'NOT_AVAILABLE_NOW' });
    await rt.clearAllSeams();
    assert.deepEqual(await service.reactivate(token(e), { commandId: randomUUID(), expectedEventId: participation.expectedEventId }), { outcome: 'REACTIVATED', state: 'ACTIVE' });

    stage = 'S05 anon and service_role refused; the frozen cores not callable';
    for (const t of [jwt({ role: 'anon' }), jwt({ role: 'service_role' })]) {
      refused(await wire(t, 'approve_my_introduction_success_v1', { p_command_id: randomUUID(), p_world_id: f.world, p_transition_version_id: f.version, p_expected_current_event_id: null }), 'approve');
      refused(await wire(t, 'complete_my_introduction_success_v1', { p_world_id: f.world }), 'complete');
      refused(await wire(t, 'reactivate_my_introductions_v1', { p_command_id: randomUUID(), p_expected_current_event_id: randomUUID(), p_entry_channel: null }), 'reactivate');
    }
    for (const t of [token(a), jwt({ role: 'service_role' })]) {
      refused(await wire(t, DFN.SUCCESS.replace(/^public\.|\(.*$/gu, ''), { p_command_id: randomUUID(), p_transition_version_id: f.version,
        p_lower_participation_event_id: randomUUID(), p_higher_participation_event_id: randomUUID() }), 'the frozen SUCCESS commit');
      refused(await wire(t, 'attempt_introduction_success_v1', { p_transition_version_id: f.version }), 'the private system attempt');
    }
    console.log(`Verified S6-06 CP1 SUCCESS and reactivation through live PostgREST ${version} with the compiled continuation service: each human sees only their own state; a failed system attempt (40001 inside the commit) leaves both approvals and nothing terminal, and the next read completes exactly once; a closed gate writes and opens nothing and the next read after it allows completes once; reactivation is gated then explicit; anon, service_role and direct core calls refused.`);
  } catch (error) {
    failure = { stage, error };
  }
  stage = 'fixture removal';
  const removal = await (async () => {
    if (gateway) { gateway.closeAllConnections(); await new Promise((resolve) => { gateway.close(() => resolve()); }); }
    await rt.asRole('postgres');
    if (injected) {
      await rows(`DROP TRIGGER IF EXISTS s6_06_prove_inject_conflict ON ${D.TERMINAL}`);
      await rows('DROP FUNCTION IF EXISTS public.s6_06_prove_inject_conflict_v1()');
    }
    for (const seam of seams.reverse()) await rt.restoreMatchingSeam(seam);
    await rt.cleanupIntroductionRace(humans);
    await rt.removeFixtureHumans(humans);
  })().then(() => null, (error) => error ?? new Error('fixture removal failed')).finally(() => rt.client.end());
  if (failure && removal) {
    stage = failure.stage;
    throw new AggregateError([failure.error, removal], `${failure.error?.message ?? failure.error}; the fixture removal ALSO failed: ${removal?.message ?? removal}`);
  }
  if (failure) { stage = failure.stage; throw failure.error; }
  if (removal) throw removal;
}

try {
  await main();
} catch (error) {
  console.error(`S6-06 CP1 SUCCESS proof (PostgREST ${version}) failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
