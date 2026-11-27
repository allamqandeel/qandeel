/**
 * CALL-ATTR-01 (T-2, 2026-11-27) — the call path's provider work through the REAL production composition, the REAL
 * AI-COST-01 accounting boundary and the REAL 0170 ledger commands, over a REAL local PostgreSQL carrying every migration.
 *
 * REAL, as shipped:
 *   - `productionLiveCallAttention` (its DeepSeek evaluator behind `costLedgerDecorator('LIVE_ATTENTION_EVALUATION')`),
 *     0204's writer and readers, 0191's shared background permits;
 *   - a `CallAnalysisWorker` composed as `CallAnalysisWorkerHost` composes it, over 0191's queue, and the
 *     `ConversationSemanticEstablishmentService` with ConversationModule's four production bindings (each a DeepSeek
 *     adapter behind its cost-ledger decorator and the foreground guard), taken from the module's own provider metadata;
 *   - `productionAiProviderCallAccounting()` -> `SupabaseAiProviderCallLedger` -> `SupabaseServiceRoleApiService`, whose
 *     every request goes to SUPABASE_URL: in the CI PostgREST loop (POSTGREST_URL and POSTGREST_JWT_SECRET set) the real
 *     PostgREST engine of that line, over the WIRE; otherwise a loopback pg shim calling the same functions as
 *     service_role, with PostgREST's error identity (42501 -> HTTP 403).
 * Replaced, and only this: DeepSeek's network transport. `fetch` to api.deepseek.com answers a deterministic completion
 * with reported usage; nothing reaches a real provider. No paid API, no person, no voice: random UUIDs, fixed synthetic
 * Arabic sentences.
 *
 *   A1  a provisional evaluation is admitted under the call connection's payer and Session with NO source turn, settled
 *       with the reported usage, and recorded by 0204;
 *   A2  a reconnect (connection epoch 2) is attributed by its own channel exactly as the first connection;
 *   A3  two people's calls evaluated concurrently are each charged to their own payer and Session only;
 *   A4  a Session that is not the payer's is refused by 0170 (42501) before any provider request;
 *   B1  a committed call half is admitted under the durable claim's payer, Session and own committed turn, and settled;
 *   B2  the same item, recovered by ANOTHER worker instance, is attributed exactly as its first attempt;
 *   B3  the boundary refuses (42501) a turn that is not the payer's in that Session, before any provider request.
 * The invalid-identity case (an identity that is not a UUID opens no scope) refuses before the ledger is reached, so it
 * needs no database: the T-1 composition spec proves it.
 *
 * It refuses anything but a loopback database and changes the database it is given (the PERSONAL_LIVE_CALL gate, restored
 * at the end; its synthetic fixtures): run it only on a disposable local clone or the CI job's own database.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55470/call_attr_t2 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/call-attr-01-attribution-proof.ts
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runWithAiUsageAttribution } from '../src/ai-usage/ai-usage-attribution';
import { costLedgerDecorator } from '../src/ai-usage/production-ai-provider-call-accounting';
import { ConversationModule } from '../src/conversation/conversation.module';
import { LiveCallReplyService } from '../src/conversation/live-call-reply.service';
import { SafetyResponseGateService } from '../src/conversation/safety-response-gate.service';
import type { SupabaseDataApiService } from '../src/conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import { DatabaseBackgroundPermitGate } from '../src/live-analysis/background-permits';
import { CallAnalysisRepository } from '../src/live-analysis/call-analysis.repository';
import { CallAnalysisWorker, callAnalysisStart } from '../src/live-analysis/call-analysis.worker';
import { CallAttentionRepository } from '../src/live-attention/call-attention.repository';
import { loadAttentionDeepSeekConfig } from '../src/live-attention/deepseek-attention-evaluator';
import { productionLiveCallAttention, signallingAttentionSettlement } from '../src/live-attention/live-attention.provider';
import { ConversationSemanticEstablishmentService } from '../src/live-focus/conversation-semantic-establishment.service';
import { ConversationSemanticRuntimeRepository } from '../src/live-focus/conversation-semantic-runtime.repository';
import { createDeepSeekClient } from '../src/model-router/providers/deepseek/deepseek-client';
import { LiveCallConversationBinding } from '../src/voice/call-turn/live-call-conversation.port';
import { LiveCallAnalysisSignal } from '../src/voice/call-turn/live-call-analysis.signal';
import type { LiveCallAttentionChannel } from '../src/voice/call-turn/live-call-attention.port';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const USER_TEXT = 'أنا وصاحبي بنفكر نفتح كافيه صغير.';
const REPLY_TEXT = 'فكرة حلوة، احكيلي أكتر.';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(url).hostname; } catch { host = ''; }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('CALL_ATTR_01_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}

const POSTGREST_URL = process.env.POSTGREST_URL?.replace(/\/$/u, '');
const POSTGREST_SECRET = process.env.POSTGREST_JWT_SECRET;
const WIRE = Boolean(POSTGREST_URL && POSTGREST_SECRET);

function signedJwt(claims: Record<string, unknown>): string {
  const b64 = (value: string) => Buffer.from(value).toString('base64url');
  const unsigned = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 1800 }))}`;
  return `${unsigned}.${createHmac('sha256', POSTGREST_SECRET!).update(unsigned).digest('base64url')}`;
}

/** A function as service_role, with JSON values (the shim's half of PostgREST): rows, or PostgREST's error identity. */
async function asServiceRole(pool: PgPool, name: string, body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  if (!/^[a-z0-9_]+$/u.test(name)) return { status: 404, body: { code: 'PGRST202', message: 'unknown function' } };
  const entries = Object.entries(body);
  const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => (Array.isArray(v) && v.length > 0 && v.every((e) => typeof e === 'string')) ? v
    : (v !== null && typeof v === 'object') ? JSON.stringify(v) : v);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE service_role');
    const result = await client.query(`SELECT * FROM public.${name}(${args})`, values);
    await client.query('COMMIT');
    return { status: 200, body: result.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const e = error as { code?: string; message?: string };
    // PostgREST's mapping for the classes met here: insufficient privilege 403, a constraint 409, anything else 400.
    const status = e.code === '42501' ? 403 : e.code?.startsWith('23') ? 409 : 400;
    return { status, body: { code: e.code, message: e.message, details: null, hint: null } };
  } finally {
    client.release();
  }
}

/** Every refusal the database answered at the gateway: the function, the HTTP status and the SQLSTATE (never content). */
const refusals: Array<{ readonly rpc: string; readonly status: number; readonly code: string | null }> = [];
const noteRefusal = (url: string, status: number, body: Buffer | string): void => {
  if (status < 400) return;
  let code: string | null = null;
  try { code = (JSON.parse(String(body)) as { code?: string }).code ?? null; } catch { code = null; }
  refusals.push({ rpc: /\/rpc\/([a-z0-9_]+)$/u.exec(url)?.[1] ?? url, status, code });
};

/** The Supabase gateway's shape at SUPABASE_URL: `/rest/v1/*` to the PostgREST engine (WIRE) or to the pg shim. */
function startRestGateway(pool: PgPool): Promise<Server> {
  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (!request.url?.startsWith('/rest/v1/')) return void response.writeHead(404).end();
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        if (WIRE) {
          const headers = Object.fromEntries(Object.entries(request.headers)
            .filter(([n]) => !['host', 'apikey', 'content-length', 'connection', 'transfer-encoding', 'keep-alive'].includes(n))) as Record<string, string>;
          const upstream = await fetch(`${POSTGREST_URL}${request.url.slice('/rest/v1'.length)}`, { method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
          const bytes = Buffer.from(await upstream.arrayBuffer());
          noteRefusal(request.url, upstream.status, bytes);
          response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
          return void response.end(bytes);
        }
        const name = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/u.exec(request.url)?.[1];
        if (!name || request.method !== 'POST') return void response.writeHead(404).end();
        const answer = await asServiceRole(pool, name, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>);
        const text = JSON.stringify(answer.body);
        noteRefusal(request.url, answer.status, text);
        response.writeHead(answer.status, { 'content-type': 'application/json' });
        response.end(text);
      } catch {
        response.writeHead(502).end();
      }
    })();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ------------------------------------------------------------------------------------------------ DeepSeek's transport
/** The one replaced transport: DeepSeek answers here, deterministically, with reported usage. Nothing else is touched. */
class DeepSeekTransport {
  readonly requests: { readonly system: string; readonly data: string }[] = [];
  hold: Promise<void> | null = null;
  private readonly original = globalThis.fetch;

  install(): void {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith('https://api.deepseek.com')) return this.answer(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      const host = new URL(url).hostname;
      if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error(`CALL_ATTR_01_PROOF: a non-loopback request was attempted (${host})`);
      return this.original(input, init);
    }) as typeof fetch;
  }

  restore(): void {
    globalThis.fetch = this.original;
  }

  private async answer(body: Record<string, unknown>): Promise<Response> {
    const messages = body.messages as Array<{ role: string; content: string }>;
    const system = messages[0]?.content ?? '';
    const data = messages[1]?.content ?? '';
    this.requests.push({ system, data });
    if (this.hold) await this.hold;
    // Attention: no development. Segmentation: the turn as one whole unit. The next layers an empty object, which their
    // adapter refuses AFTER the accounted attempt settled (the item is then a counted retry: B2 recovers it).
    let content = '{}';
    if (system.includes('"developments"')) content = JSON.stringify({ developments: [], contextCarry: null });
    else if (system.includes('"units"') && data.includes(USER_TEXT)) content = JSON.stringify({ units: [{ text: USER_TEXT, occurrence: 1 }] });
    // The usage identifies the request it settles: 111 prompt tokens, or 222 for the text marked "marker-two".
    const prompt = data.includes('marker-two') ? 222 : 111;
    return new Response(JSON.stringify({
      id: 'call-attr-01', object: 'chat.completion', created: 0, model: 'deepseek-v4-flash',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
      usage: { prompt_tokens: prompt, prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: prompt - 100, completion_tokens: 7, total_tokens: prompt + 7 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
}

const checks: string[] = [];
function check(name: string, ok: boolean, detail: unknown = ''): void {
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${text ? ` (${text})` : ''}`;
  checks.push(line);
  process.stdout.write(`  ${line}\n`);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 16 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const gateway = await startRestGateway(pool);
  process.env.SUPABASE_URL = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = WIRE ? signedJwt({ role: 'service_role' }) : 'call-attr-01-synthetic-service-role';
  // Synthetic qualification only: the key below is not a credential, and DeepSeek's transport never leaves this process.
  process.env.DEEPSEEK_API_KEY = 'call-attr-01-synthetic-key';
  process.env.DEEPSEEK_QUALIFICATION_MODE = 'SYNTHETIC_ONLY';
  process.env.LIVE_CALL_PROVISIONAL_ATTENTION = 'ON';
  delete process.env.EMERGENCY_CALL_SPEND_USD;
  if (process.env.NODE_ENV === 'production') throw new Error('CALL_ATTR_01_PROOF_REFUSED: NODE_ENV=production');
  const deepseek = new DeepSeekTransport();
  deepseek.install();
  process.stdout.write(`CALL-ATTR-01 T-2 (transport: ${WIRE ? `PostgREST ${process.env.POSTGREST_VERSION ?? ''}`.trim() : 'pg shim as service_role'})\n`);

  const serverApi = new SupabaseServiceRoleApiService();
  const permits = new DatabaseBackgroundPermitGate(serverApi);
  const humans: string[] = [];
  const calls: string[] = [];
  const gatesBefore = await sql("SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = 'PERSONAL_LIVE_CALL'");

  /** The ledger's rows for a person, oldest first, with their usage (ids, identities and quantities; never content). */
  const ledgerOf = async (user: string) => (await sql(`SELECT c.id, c.user_id, c.session_id, c.source_turn_id, c.feature_family, c.attempt_number,
      c.call_state, c.usage_completeness,
      coalesce((SELECT jsonb_object_agg(u.usage_kind, u.quantity) FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id), '{}'::jsonb) AS usage
    FROM public.ai_provider_calls c WHERE c.user_id = $1 ORDER BY c.started_at, c.id`, [user])).map((r) => ({
    user: String(r.user_id), session: r.session_id as string | null, turn: r.source_turn_id as string | null, family: String(r.feature_family),
    attempt: Number(r.attempt_number), state: String(r.call_state), completeness: r.usage_completeness as string | null,
    usage: Object.fromEntries(Object.entries(r.usage as Record<string, unknown>).map(([k, v]) => [k, Number(v)])),
  }));
  const waitFor = async (what: () => Promise<boolean>, label: string, timeoutMs = 60_000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await what()) return;
      await sleep(100);
    }
    throw new Error(`CALL_ATTR_01_PROOF_TIMEOUT ${label}`);
  };
  const person = async () => {
    const user = randomUUID();
    const session = randomUUID();
    humans.push(user);
    await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    return { user, session };
  };

  try {
    await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1('PERSONAL_LIVE_CALL', 'ENABLED', 'SATISFIED', 'call-attr-01-proof', 'local synthetic proof')");

    // ======================================================================== A: provisional attention
    const lane = productionLiveCallAttention(process.env, serverApi, permits)!;
    assert.ok(lane, 'the lane is ON');
    /** An ACTIVE call with its recording (the fixture shape of the INTEL-LIVE-01 CP1 corpus proof). */
    const attentionCall = async (p: { user: string; session: string }) => {
      const call = randomUUID();
      const recording = randomUUID();
      calls.push(call);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const t = String((await client.query('SELECT clock_timestamp()::text AS t')).rows[0]!.t);
        await client.query(`INSERT INTO voice_private.calls (id, user_id, session_id, client_instance_id, state, connection_epoch, created_at,
            connect_deadline, seat_lease_until)
          VALUES ($1, $2, $3, $1, 'CONNECTING', 1, $4::timestamptz - interval '1 second', clock_timestamp() + interval '15 seconds',
            clock_timestamp() + interval '20 seconds')`, [call, p.user, p.session, t]);
        await client.query("UPDATE voice_private.calls SET state = 'ACTIVE', started_at = $2::timestamptz WHERE id = $1", [call, t]);
        await client.query(`INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
            recording_state, sealed_by)
          VALUES ($1, $2, $3, 'LIVE_CALL', $4, $5::timestamptz, $5::timestamptz + interval '30 days', 'STORED', 'WRITER')`, [recording, p.user, p.session, call, t]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return call;
    };
    const channel = (userId: string, sessionId: string, callId: string, epoch: number): LiveCallAttentionChannel => ({
      userId, sessionId, callId, epoch, latestCaptureMs: () => 10_000,
    });
    const evaluationsOf = async (call: string) => (await sql(`SELECT connection_epoch, outcome, prompt_tokens FROM voice_private.call_attention_evaluations
      WHERE call_id = $1 ORDER BY eval_seq`, [call])).map((r) => ({ epoch: Number(r.connection_epoch), outcome: String(r.outcome), prompt: r.prompt_tokens === null ? null : Number(r.prompt_tokens) }));

    process.stdout.write('A. provisional attention (the production lane)\n');
    const a = await person();
    const aCall = await attentionCall(a);
    const first = lane.open(channel(a.user, a.session, aCall, 1));
    first.evidence('USER', USER_TEXT, 0, 2_000);
    await waitFor(async () => (await evaluationsOf(aCall)).length >= 1, 'A1 the evaluation record');
    const a1 = await ledgerOf(a.user);
    check('A1 admitted under the connection\'s payer and Session with NO source turn, family LIVE_ATTENTION_EVALUATION',
      a1.length === 1 && a1[0]!.session === a.session && a1[0]!.turn === null && a1[0]!.family === 'LIVE_ATTENTION_EVALUATION', a1.map(({ usage, ...r }) => ({ ...r, user: r.user === a.user })));
    check('A1 settled once with the reported usage (miss 11, cache read 100, output 7), COMPLETE',
      a1.length === 1 && a1[0]!.state === 'SUCCEEDED_USAGE_REPORTED' && a1[0]!.completeness === 'COMPLETE'
        && JSON.stringify(a1[0]!.usage) === JSON.stringify({ INPUT_TOKEN: 11, OUTPUT_TOKEN: 7, CACHE_READ_INPUT_TOKEN: 100 }), a1.map((r) => [r.state, r.completeness, r.usage]));
    const e1 = await evaluationsOf(aCall);
    check('A1 0204 recorded the evaluation (NONE, epoch 1, 111 prompt tokens)', JSON.stringify(e1) === JSON.stringify([{ epoch: 1, outcome: 'NONE', prompt: 111 }]), e1);

    await first.handover();
    await sql('UPDATE voice_private.calls SET connection_epoch = connection_epoch + 1 WHERE id = $1', [aCall]);
    const second = lane.open(channel(a.user, a.session, aCall, 2));
    second.evidence('USER', `${USER_TEXT} تاني`, 2_000, 4_000);
    await waitFor(async () => (await evaluationsOf(aCall)).some((e) => e.epoch === 2 && e.outcome === 'NONE'), 'A2 the second connection\'s record');
    const a2 = await ledgerOf(a.user);
    check('A2 the reconnect\'s evaluation is attributed by its own channel exactly as the first (payer, Session, no turn), settled',
      a2.length === 2 && a2.every((r) => r.session === a.session && r.turn === null && r.family === 'LIVE_ATTENTION_EVALUATION' && r.state === 'SUCCEEDED_USAGE_REPORTED'),
      a2.map((r) => [r.session === a.session, r.turn, r.state]));
    second.close();

    const b = await person();
    const c = await person();
    const bCall = await attentionCall(b);
    const cCall = await attentionCall(c);
    let release!: () => void;
    deepseek.hold = new Promise<void>((resolve) => { release = resolve; });
    const before = deepseek.requests.length;
    const one = lane.open(channel(b.user, b.session, bCall, 1));
    const two = lane.open(channel(c.user, c.session, cCall, 1));
    one.evidence('USER', `${USER_TEXT} marker-one`, 0, 2_000);
    two.evidence('USER', `${USER_TEXT} marker-two`, 0, 2_000);
    await waitFor(async () => deepseek.requests.length - before === 2, 'A3 both provider requests in flight');
    release();
    deepseek.hold = null;
    await waitFor(async () => (await evaluationsOf(bCall)).length >= 1 && (await evaluationsOf(cCall)).length >= 1, 'A3 both records');
    const lb = await ledgerOf(b.user);
    const lc = await ledgerOf(c.user);
    const tokens = (r: { usage: Record<string, number> }) => (r.usage.INPUT_TOKEN ?? 0) + (r.usage.CACHE_READ_INPUT_TOKEN ?? 0);
    check('A3 two concurrent calls: each request charged to its own payer and Session only (111 the first person\'s, 222 the second\'s)',
      lb.length === 1 && lc.length === 1 && lb[0]!.session === b.session && lc[0]!.session === c.session && tokens(lb[0]!) === 111 && tokens(lc[0]!) === 222
        && lb[0]!.turn === null && lc[0]!.turn === null,
      { first: lb.map((r) => [r.session === b.session, tokens(r)]), second: lc.map((r) => [r.session === c.session, tokens(r)]) });
    one.close();
    two.close();

    const x = await person();
    const xCall = await attentionCall(x);
    const beforeRefusal = deepseek.requests.length;
    const refusalsBeforeA4 = refusals.length;
    const refused = lane.open(channel(x.user, c.session, xCall, 1)); // a Session that is not the payer's
    refused.evidence('USER', USER_TEXT, 0, 2_000);
    await waitFor(async () => (await evaluationsOf(xCall)).length >= 1, 'A4 the refused evaluation\'s record');
    refused.close();
    const lx = await ledgerOf(x.user);
    const ex = await evaluationsOf(xCall);
    const a4 = refusals.slice(refusalsBeforeA4);
    check('A4 another person\'s Session is refused by 0170 (42501) before any provider request: no ledger row, no request, PROVIDER_FAILED recorded',
      a4.length >= 1 && a4.every((r) => r.rpc === 'begin_ai_provider_call_v1' && r.status === 403 && r.code === '42501')
        && lx.length === 0 && deepseek.requests.length === beforeRefusal && ex.length >= 1 && ex.every((e) => e.outcome === 'PROVIDER_FAILED'),
      { refusals: [...new Set(a4.map((r) => `${r.rpc} ${r.status} ${r.code}`))], ledgerRows: lx.length, providerRequests: deepseek.requests.length - beforeRefusal, outcomes: [...new Set(ex.map((e) => e.outcome))] });
    check('A4 nothing was charged to the Session\'s owner either', (await ledgerOf(c.user)).length === 1);
    // The fixture calls end here: an ACTIVE call holds a seat of the live call capacity B's real call needs.
    await sql(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
      seat_lease_until = NULL WHERE id = ANY($1::uuid[]) AND state <> 'ENDED'`, [calls]);

    // ======================================================================== B: committed call analysis
    process.stdout.write(`B. committed call analysis (the production worker composition, start ${callAnalysisStart()})\n`);
    // ConversationModule's own factory over the four binding values it registers, read from its provider metadata.
    const semantic = (): ConversationSemanticEstablishmentService => {
      const providers = Reflect.getMetadata('providers', ConversationModule) as Array<{ provide?: unknown; useValue?: unknown; useFactory?: (...args: unknown[]) => unknown; inject?: unknown[] }>;
      const registered = (token: unknown): unknown => providers.find((entry) => entry.provide === token)!.useValue;
      const service = providers.find((entry) => entry.provide === ConversationSemanticEstablishmentService)!;
      const [, segmentation, focus, thread, continuity] = service.inject!;
      return service.useFactory!(new ConversationSemanticRuntimeRepository(serverApi), registered(segmentation), registered(focus), registered(thread),
        registered(continuity), permits) as ConversationSemanticEstablishmentService;
    };
    const endedCallSafety = new LiveCallReplyService(new LiveCallConversationBinding(), {} as SupabaseDataApiService, new SafetyResponseGateService(),
      {} as never, {} as never, {} as never, {} as never, null);
    const worker = () => new CallAnalysisWorker({
      store: new CallAnalysisRepository(serverApi), semantic: semantic(), permits, safety: endedCallSafety, start: callAnalysisStart(),
      attentionSettlement: signallingAttentionSettlement(new CallAttentionRepository(serverApi), lane),
    });
    const queueOf = async (session: string) => (await sql(`SELECT call_turn_index i, half, turn_id, queue_state s, attempt_count a
      FROM voice_private.call_analysis_queue WHERE session_id = $1 ORDER BY call_turn_index, CASE half WHEN 'EXCHANGE' THEN 0 WHEN 'USER' THEN 1 ELSE 2 END`, [session]))
      .map((r) => ({ item: `${r.i}:${r.half}`, turn: String(r.turn_id), state: String(r.s), attempts: Number(r.a) }));

    const p = await person();
    const asOwner = async (name: string, args: unknown[]) => (await sql(`SELECT * FROM public.${name}(${args.map((_, i) => `$${i + 1}`).join(', ')})`, args))[0]!;
    await asOwner('server_grant_voice_recording_consent_v1', [p.user, randomUUID(), VOICE_CONSENT_V3]);
    const call = randomUUID();
    calls.push(call);
    assert.equal((await asOwner('server_begin_call_v1', [p.user, p.session, call, randomUUID()])).outcome, 'BEGUN');
    const activated = await asOwner('server_activate_call_v1', [p.user, call, 1]);
    assert.equal(activated.outcome, 'ACTIVE');
    const recording = String(activated.recording_id);
    assert.equal((await sql('SELECT * FROM public.server_add_call_segment_v2($1, $2, 1, $3, $4, $5, $6, 4096, 20)', [p.user, recording, 'USER', 0, 0, 1000]))[0]!.outcome, 'ADDED');
    const committed = (await sql("SELECT * FROM public.server_commit_live_call_turn_v1($1, $2, 1, $3, $4, 'SPEECH', $5, 'HIGH', $6, $7, $8, $9, $10)",
      [p.user, call, randomUUID(), randomUUID(), USER_TEXT, 0, 1000, [], randomUUID(), randomUUID()]))[0]!;
    assert.equal(committed.outcome, 'COMMITTED');
    const idx = Number(committed.call_turn_index);
    assert.equal((await asOwner('server_store_call_turn_safety_v1', [p.user, call, idx, 'ALLOW'])).outcome, 'STORED');
    assert.equal((await sql('SELECT * FROM public.server_register_call_reply_segment_v1($1, $2, 1, $3, 0, $4, 0, 400, $5)', [p.user, call, idx, REPLY_TEXT, []]))[0]!.outcome, 'REGISTERED');
    assert.equal((await sql("SELECT * FROM public.server_finish_call_reply_generation_v1($1, $2, 1, $3, 'COMPLETE', 400)", [p.user, call, idx]))[0]!.outcome, 'FINISHED');
    assert.equal((await sql('SELECT * FROM public.server_confirm_call_playout_v1($1, $2, 1, $3, 400, $4)', [p.user, call, idx, 0]))[0]!.outcome, 'ADVANCED');
    assert.equal((await sql('SELECT * FROM public.server_add_call_segment_v2($1, $2, 1, $3, $4, $5, $6, 4096, 20)', [p.user, recording, 'QANDEEL', 0, 0, 400]))[0]!.outcome, 'ADDED');
    assert.equal((await sql("SELECT * FROM public.server_close_live_call_exchange_v1($1, $2, 1, $3, 'PLAYED_OUT', $4, $5)", [p.user, call, idx, randomUUID(), randomUUID()]))[0]!.outcome, 'CLOSED');
    assert.equal((await asOwner('server_end_call_v1', [p.user, call, 1, 'USER_ENDED'])).outcome, 'ENDED');
    const userItem = (await queueOf(p.session)).find((i) => i.item === `${idx}:USER`)!;
    assert.ok(userItem, 'the USER half was queued');

    const signal = new LiveCallAnalysisSignal();
    const w1 = worker();
    signal.bind(w1);
    w1.start();
    signal.kick(p.session, 'TURN_COMMITTED');
    await waitFor(async () => (await queueOf(p.session)).some((i) => i.item === userItem.item && i.attempts === 1 && i.state !== 'CLAIMED'), 'B1 the first attempt settled');
    await w1.stop();
    signal.bind(null);
    const b1 = await ledgerOf(p.user);
    check('B1 every admitted attempt is the claim\'s payer and Session, its source turn the half\'s own committed turn',
      b1.length >= 2 && b1.every((r) => r.session === p.session && r.turn === userItem.turn && r.attempt === 1),
      b1.map((r) => [r.family, r.session === p.session, r.turn === userItem.turn, r.attempt]));
    check('B1 the chain was admitted past segmentation under the same scope', b1.some((r) => r.family === 'CU_SEGMENTATION') && b1.some((r) => r.family !== 'CU_SEGMENTATION'),
      [...new Set(b1.map((r) => r.family))]);
    check('B1 every begun attempt settled once with the reported usage (nothing PENDING)',
      b1.every((r) => r.state === 'SUCCEEDED_USAGE_REPORTED' && r.completeness === 'COMPLETE' && tokens(r) === 111), b1.map((r) => [r.state, r.completeness]));
    const afterFirst = (await queueOf(p.session)).find((i) => i.item === userItem.item)!;
    check('B1 the refused layer answer is a counted retry of the item (RETRY_WAIT, attempt 1), never a lost or unattributed one',
      afterFirst.state === 'RETRY_WAIT' && afterFirst.attempts === 1, afterFirst);

    // Another worker instance recovers the same item when its retry falls due (the first instance is gone).
    await sql(`UPDATE voice_private.call_analysis_queue SET next_attempt_at = clock_timestamp() WHERE session_id = $1 AND queue_state = 'RETRY_WAIT'`, [p.session]);
    const w2 = worker();
    signal.bind(w2);
    w2.start();
    signal.kick(p.session, 'TURN_COMMITTED');
    await waitFor(async () => (await queueOf(p.session)).some((i) => i.item === userItem.item && i.attempts === 2 && i.state !== 'CLAIMED'), 'B2 the recovered attempt settled');
    await w2.stop();
    signal.bind(null);
    const b2 = (await ledgerOf(p.user)).slice(b1.length);
    check('B2 the recovered item, re-claimed by another worker instance, is attributed exactly as its first attempt (payer, Session, turn)',
      b2.length === b1.length && b2.every((r, k) => r.session === b1[k]!.session && r.turn === b1[k]!.turn && r.family === b1[k]!.family && r.user === p.user),
      b2.map((r) => [r.family, r.session === p.session, r.turn === userItem.turn, r.attempt]));
    check('B2 the recovery\'s attempts are numbered after the first (0170 counts per source turn)', b2.every((r) => r.attempt === 2) && b2.every((r) => r.state === 'SUCCEEDED_USAGE_REPORTED'),
      b2.map((r) => [r.attempt, r.state]));

    // The boundary itself, as the worker's scope would carry a turn that is not the payer's in that Session.
    const q = await person();
    const beforeTurnRefusal = deepseek.requests.length;
    const refusalsBeforeB3 = refusals.length;
    const config = loadAttentionDeepSeekConfig(process.env);
    const accounted = costLedgerDecorator('CU_SEGMENTATION')(createDeepSeekClient(config));
    const crossTurn = await runWithAiUsageAttribution({ userId: q.user, sessionId: q.session, sourceTurnId: userItem.turn }, () => accounted.chat.completions.create(
      { model: config.model, messages: [{ role: 'system', content: '"units"' }, { role: 'user', content: USER_TEXT }] } as never,
    )).then(() => 'ADMITTED', (error: unknown) => (error as { constructor?: { name?: string } }).constructor?.name ?? 'REFUSED');
    check('B3 a turn that is not the payer\'s in that Session is refused by 0170 (42501) before any provider request',
      crossTurn !== 'ADMITTED' && JSON.stringify(refusals.slice(refusalsBeforeB3)) === JSON.stringify([{ rpc: 'begin_ai_provider_call_v1', status: 403, code: '42501' }])
        && deepseek.requests.length === beforeTurnRefusal && (await ledgerOf(q.user)).length === 0,
      { outcome: crossTurn, refusals: refusals.slice(refusalsBeforeB3).map((r) => `${r.rpc} ${r.status} ${r.code}`), providerRequests: deepseek.requests.length - beforeTurnRefusal });
    check('B3 nothing more was charged to the turn\'s owner', (await ledgerOf(p.user)).length === b1.length * 2);
  } finally {
    deepseek.restore();
    // No call outlives the proof (a later proof's capacity counts ACTIVE calls); no queue item stays claimable.
    await sql(`UPDATE voice_private.calls SET state = 'ENDED', end_reason = 'USER_ENDED', ended_at = clock_timestamp(), grace_until = NULL,
      seat_lease_until = NULL WHERE id = ANY($1::uuid[]) AND state <> 'ENDED'`, [calls]).catch(() => undefined);
    await sql('DELETE FROM voice_private.call_analysis_queue WHERE user_id = ANY($1::uuid[])', [humans]).catch(() => undefined);
    for (const gate of gatesBefore) {
      await sql('SELECT * FROM voice_private.set_voice_launch_capability_v1($1, $2, $3, $4, $5)',
        [gate.capability_scope, gate.feature_flag_state, gate.condition_state, 'call-attr-01-proof', 'restored after the local synthetic proof']).catch(() => undefined);
    }
    await new Promise<void>((resolve) => gateway.close(() => resolve()));
    await pool.end();
  }
  const failed = checks.filter((line) => line.startsWith('FAIL'));
  process.stdout.write(`CALL-ATTR-01 T-2: ${checks.length - failed.length}/${checks.length} PASS\n`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`CALL-ATTR-01 T-2 FAILED: ${(error as Error).stack ?? error}\n`);
  process.exitCode = 1;
});
