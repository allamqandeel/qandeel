// S6-07 (CP2) - live wire proof of the migration 0166 forward dispatcher THROUGH a real PostgREST server, driven by the
// COMPILED API worker (apps/api/dist) exactly as it runs in production: its repository on the server channel, through a
// minimal Supabase-shaped gateway (`/rest/v1/*` -> PostgREST), against the PostgREST lines CI starts (`POSTGREST_VERSION`):
//
//   * the dispatcher and the lister take exactly the parameters the API sends (checked against the live catalog);
//   * anon and authenticated tokens cannot call either, and the ledger is not exposed;
//   * the dispatch module composes with no controller; nothing due is NONE_DUE and the cycle ends at once;
//   * with the real CW2-08 seam a realistic fixture is SKIPPED_NOT_CLEARED: nothing delivered, the candidate sees nothing;
//   * a 40001 and a PT409 underneath the forward (a committed fixture trigger) are each answered ONCE, HTTP 200,
//     SKIPPED_STALE, on every line - including the lines before v16 that re-run a 40001 transaction without bound;
//   * once nothing is stale the worker forwards exactly once and the candidate's own token reads the neutral row;
//   * the Activity recovery path: a publication that fails after the committed forward is published on the next cycle,
//     exactly once, and a third cycle has nothing left (the notifier here is a FIXTURE of the CP3 producer).
//
// Every fixture is removed afterwards: the humans and everything they own, the policies, the fixture trigger, and the
// CW2-08 seam is restored byte for byte.
//
// It needs DATABASE_URL (the fixture owner), POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the
// throwaway PostgREST container; never a deployment credential), and a built API (`npm run build` in apps/api).
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import http from 'node:http';
import { createRequire } from 'node:module';
import process from 'node:process';
import { CLEAN, createMatchRuntime, PFN } from './matching-match-verifier-support.mjs';

const databaseUrl = process.env.DATABASE_URL;
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!databaseUrl || !secret) throw new Error('DATABASE_URL and POSTGREST_JWT_SECRET are required.');

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { IntroductionsDispatchModule } = require('../apps/api/dist/introductions-dispatch/introductions-dispatch.module.js');
const { IntroductionsForwardDispatcherWorker } = require('../apps/api/dist/introductions-dispatch/introductions-forward-dispatcher.worker.js');
const { IntroductionsForwardDispatchRepository } = require('../apps/api/dist/introductions-dispatch/introductions-forward-dispatch.repository.js');
const { SupabaseServiceRoleApiService } = require('../apps/api/dist/conversation/supabase-service-role-api.service.js');

const rt = createMatchRuntime(databaseUrl);
const { q, rows } = rt;
let stage = 'connect';

const DISPATCH = 'server_forward_approved_matching_proposals_v1';
const LISTER = 'server_list_proposal_delivery_activity_reconciliation_v1';

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 900 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
const service = () => jwt({ role: 'service_role' });

const RPC_TIMEOUT_MS = 30_000;
async function rpc(token, name, body) {
  const started = Date.now();
  const response = await fetch(`${postgrestUrl}/rpc/${name}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  }).then((answered) => answered, (error) => {
    throw new Error(`POST /rpc/${name} was not answered (${error?.name ?? 'Error'}: ${error?.message ?? error})`, { cause: error });
  });
  const text = await response.text();
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null, ms: Date.now() - started };
}
function assertNotCallable(response, label) {
  const refused = [401, 403].includes(response.status) && response.body?.code === '42501';
  const hidden = response.status === 404 && response.body?.code === 'PGRST202';
  assert.ok(refused || hidden, `${label} is not callable (got ${response.status} ${JSON.stringify(response.body)})`);
}
const outcomeOf = (response, label) => {
  assert.equal(response.status, 200, `${label} is answered (${response.status} ${JSON.stringify(response.body)})`);
  assert.ok(Array.isArray(response.body) && response.body.length === 1, `${label} answers one row`);
  assert.deepEqual(Object.keys(response.body[0]), ['outcome'], `${label} answers one word and no identity`);
  return response.body[0].outcome;
};

/** The Supabase gateway's shape, minimally: `/rest/v1/*` to PostgREST. */
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

/** A proposal in FIRST_FORWARD_APPROVED through the real cores (the offer needs the seam cleared; the caller restores it). */
async function approved(first, candidate) {
  for (const [human, sex, firstName] of [[first, 'FEMALE', 'Mona'], [candidate, 'MALE', 'Omar']]) await rt.recordFacts(human, { sex, firstName });
  const f = await rt.seedEligible(first, candidate);
  const forFirst = await rt.permitted(f.snapshot, first, candidate, `${CLEAN} A settled and unhurried outlook on both sides.`);
  await rt.permitted(f.snapshot, candidate, first, `${CLEAN} The same unhurried outlook, from the other side of it.`);
  const proposal = randomUUID();
  await rt.prepare(proposal, f.snapshot, first);
  const firstView = randomUUID();
  await rt.offer(randomUUID(), proposal, firstView, forFirst.id);
  await rt.actAs(first);
  await rt.approveForward(randomUUID(), proposal, firstView);
  await rt.asRole('postgres');
  return { ...f, proposal, firstView };
}
const makeDue = (proposal) => q(`UPDATE matching_forward_private.proposal_forward_attempts
  SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE proposal_id = $1 AND next_attempt_at IS NOT NULL`, [proposal]);
const delivered = async (proposal) => Number((await rows(`SELECT count(*) n FROM public.matching_proposal_delivery_view_bindings
  WHERE proposal_id = $1 AND delivery_state = 'FORWARDED_TO_SECOND'`, [proposal]))[0].n);

async function main() {
  await rt.client.connect();
  const humans = [randomUUID(), randomUUID()];
  const [first, candidate] = humans;
  const seam = await rt.captureMatchingSeam(PFN.PREREQUISITES);
  let gateway = null;
  let context = null;
  let failure = null;
  try {
    stage = 'the request shapes are the live signatures';
    assert.deepEqual(await rt.inputParameters(`public.${DISPATCH}(integer)`), ['p_max']);
    assert.deepEqual(await rt.inputParameters(`public.${LISTER}(integer)`), ['p_limit']);

    stage = 'anon and authenticated tokens cannot call either; the ledger is not exposed';
    for (const role of ['anon', 'authenticated']) {
      const token = jwt({ sub: first, role });
      assertNotCallable(await rpc(token, DISPATCH, { p_max: 1 }), `${role} ${DISPATCH}`);
      assertNotCallable(await rpc(token, LISTER, { p_limit: 10 }), `${role} ${LISTER}`);
    }
    for (const token of [service(), jwt({ sub: first, role: 'authenticated' })]) {
      const ledger = await fetch(`${postgrestUrl}/proposal_forward_attempts`, {
        headers: { Authorization: `Bearer ${token}`, 'Accept-Profile': 'matching_forward_private' }, signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
      assert.notEqual(ledger.status, 200, `the ledger is not readable on the wire (${ledger.status})`);
      await ledger.arrayBuffer();
    }
    const bad = await rpc(service(), DISPATCH, { p_max: 2 });
    assert.deepEqual([bad.status, bad.body?.code], [400, '22023'], 'p_max is 1, on the wire');

    stage = 'the compiled module composes with no controller; nothing due ends the cycle at once';
    gateway = await startGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${gateway.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = service();
    process.env.INTRODUCTIONS_FORWARD_DISPATCH_DISABLED = 'true';
    context = await NestFactory.createApplicationContext(IntroductionsDispatchModule, { logger: false });
    const signals = [];
    const telemetry = { recordOperationalOutcome: (...label) => signals.push(label.join('/')) };
    const repository = context.get(IntroductionsForwardDispatchRepository);
    const worker = new IntroductionsForwardDispatcherWorker(repository, telemetry);
    assert.ok(context.get(IntroductionsForwardDispatcherWorker) instanceof IntroductionsForwardDispatcherWorker, 'the module provides the worker');
    assert.deepEqual(await worker.runOnce(), { attempts: 0, forwarded: 0, skipped: 0, busy: 0, held: 0, failed: 0, published: 0, publishFailed: 0 });
    assert.deepEqual(signals, [], 'NONE_DUE emits nothing');

    stage = 'fixtures: one approved proposal (the seam cleared only to build it, then restored)';
    await rt.provisionHumans(humans);
    await rt.clearProposalPrerequisites();
    const f = await approved(first, candidate);
    await rt.restoreMatchingSeam(seam);

    stage = 'the real CW2-08 seam: SKIPPED_NOT_CLEARED, nothing delivered, the candidate sees nothing';
    assert.deepEqual(await worker.runOnce(), { attempts: 1, forwarded: 0, skipped: 1, busy: 0, held: 0, failed: 0, published: 0, publishFailed: 0 });
    assert.deepEqual(signals.splice(0), ['INTRODUCTIONS_FORWARD/dispatch/blocked_expected']);
    assert.equal(await delivered(f.proposal), 0);
    const nothing = await rpc(jwt({ sub: candidate, role: 'authenticated' }), 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal });
    assert.deepEqual([nothing.status, nothing.body], [200, []], 'the candidate reads nothing before the delivery');

    stage = 'a 40001 and a PT409 underneath the forward are answered ONCE, HTTP 200 SKIPPED_STALE, on this line';
    await rt.clearProposalPrerequisites();
    for (const code of ['40001', 'PT409']) {
      await q(`CREATE FUNCTION public.s6_07_wire_forward_stale_v1() RETURNS trigger LANGUAGE plpgsql AS $probe$
               BEGIN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '${code}'; END$probe$`);
      await q(`CREATE TRIGGER s6_07_wire_forward_stale BEFORE INSERT ON public.matching_proposal_delivery_view_bindings
               FOR EACH ROW EXECUTE FUNCTION public.s6_07_wire_forward_stale_v1()`);
      try {
        await makeDue(f.proposal);
        const answered = await rpc(service(), DISPATCH, { p_max: 1 });
        assert.equal(outcomeOf(answered, `${code} underneath`), 'SKIPPED_STALE', `${code} is the bounded SKIPPED_STALE`);
        assert.ok(answered.ms < RPC_TIMEOUT_MS, `${code} answered within the bound (${answered.ms} ms)`);
        assert.equal(await delivered(f.proposal), 0, `${code}: nothing delivered`);
      } finally {
        await q('DROP TRIGGER IF EXISTS s6_07_wire_forward_stale ON public.matching_proposal_delivery_view_bindings');
        await q('DROP FUNCTION IF EXISTS public.s6_07_wire_forward_stale_v1()');
      }
    }

    stage = 'nothing stale: the compiled worker forwards exactly once; the candidate\'s own token reads the neutral row';
    await makeDue(f.proposal);
    assert.deepEqual(await worker.runOnce(), { attempts: 1, forwarded: 1, skipped: 0, busy: 0, held: 0, failed: 0, published: 0, publishFailed: 0 });
    assert.deepEqual(signals.splice(0), ['INTRODUCTIONS_FORWARD/dispatch/success']);
    assert.equal(await delivered(f.proposal), 1);
    assert.equal((await worker.runOnce()).attempts, 0, 'a forwarded proposal is never due again');
    const seen = await rpc(jwt({ sub: candidate, role: 'authenticated' }), 'get_my_matching_proposal_v1', { p_proposal_id: f.proposal });
    assert.equal(seen.status, 200);
    assert.equal(seen.body.length, 1, 'the candidate reads exactly one neutral row after the delivery');

    stage = 'the Activity recovery path: a failed publication is published on the next cycle, exactly once';
    let down = true;
    const notifier = {
      async publishDelivered(d) {
        if (down) throw new Error('activity unavailable');
        const answer = await rpc(service(), 'server_publish_activity_candidate_v1', {
          p_user_id: d.recipientUserId, p_candidate_key: d.candidateKey, p_source_ref: `proposal-delivered:${d.deliveryTransitionId}`,
          p_category: 'INTRODUCTIONS', p_kind: 'INTRODUCTION', p_interruption_class: 3, p_critical: false, p_requested: false,
          p_context_kind: 'INTRODUCTIONS', p_context_ref: null, p_context_label_ar: null, p_context_label_en: null,
          p_entry_destination: 'INTRODUCTIONS', p_entry_ref: `proposal:${d.proposalId}`, p_speaker: 'PRODUCT', p_body_ar: null,
          p_body_en: 'prove-0166 fixture', p_secondary_ar: null, p_secondary_en: null, p_actionable: false, p_disclosure_max: 'L0',
          p_occurred_at: d.deliveredAt, p_expires_at: null });
        assert.equal(answer.status, 200, `the fixture publication (${JSON.stringify(answer.body)})`);
      },
    };
    const recovering = new IntroductionsForwardDispatcherWorker(new IntroductionsForwardDispatchRepository(new SupabaseServiceRoleApiService()), telemetry, notifier);
    assert.deepEqual(await recovering.runOnce(), { attempts: 0, forwarded: 0, skipped: 0, busy: 0, held: 0, failed: 0, published: 0, publishFailed: 1 });
    down = false;
    assert.equal((await recovering.runOnce()).published, 1, 'published on the next cycle');
    assert.equal((await recovering.runOnce()).published, 0, 'a third cycle has nothing left');
    assert.deepEqual(signals.splice(0), ['INTRODUCTIONS_FORWARD/reconcile/integrity_failure', 'INTRODUCTIONS_FORWARD/reconcile/success',
      'INTRODUCTIONS_FORWARD/reconcile/success']);
    assert.equal(Number((await rows(`SELECT count(*) n FROM public.activity_item_members WHERE user_id = $1`, [candidate]))[0].n), 1,
      'exactly one notification');
    assert.equal(Number((await rows(`SELECT count(*) n FROM public.activity_item_members WHERE user_id = $1`, [first]))[0].n), 0,
      'and none for the first recipient');
    console.log(`prove-0166 PostgREST ${version}: anon / authenticated refused; NONE_DUE; SKIPPED_NOT_CLEARED behind the real seam; 40001 and PT409 answered once as SKIPPED_STALE; one forward by the compiled worker; a failed publication recovered once`);
  } catch (error) {
    failure = error;
  }
  const cleanup = await (async () => {
    if (context) await context.close();
    if (gateway) await new Promise((resolve) => { gateway.close(resolve); });
    await q('DROP TRIGGER IF EXISTS s6_07_wire_forward_stale ON public.matching_proposal_delivery_view_bindings');
    await q('DROP FUNCTION IF EXISTS public.s6_07_wire_forward_stale_v1()');
    await rt.restoreMatchingSeam(seam);
    await rt.cleanupRace(humans);
    await rt.removeFixtureHumans(humans);
  })().then(() => null, (error) => error ?? new Error('fixture removal failed')).finally(() => rt.client.end());
  if (failure) throw new Error(`prove-0166 (PostgREST ${version}) failed at stage: ${stage}: ${failure.message}`, { cause: failure });
  if (cleanup) throw cleanup;
}

await main();
