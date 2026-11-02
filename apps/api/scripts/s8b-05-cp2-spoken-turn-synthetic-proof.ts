/**
 * S8B-05 CP2 — the synthetic spoken-turn proof: a whole live call, voice in and QANDEEL's voice out, over the REAL gateway,
 * connection, call authority repository, call turn repository (0190), voice media service and track writers, the REAL call
 * turn engine (endpointer, commit, reply sink, playout truth), the REAL LIVE_CALL REALTIME reply service (the one Safety
 * gate, the behavioral policy with TM-02, the one context assembler, the call window and in-call retrieval) and the REAL
 * DeepSeek router with its accounted streaming client, all over a REAL local PostgreSQL carrying migrations through 0190.
 * The phone is synthetic: protocol v1 on a real WebSocket, real libopus packets of a generated signal, PLAYOUT as it plays.
 *
 * Stand-ins, and only these:
 *   - the PostgREST hop, unless POSTGREST_URL and POSTGREST_JWT_SECRET are set (the CI PostgREST loop: every server call
 *     and every owner read then goes over the WIRE through the real engine; otherwise pg shims call the same functions as
 *     service_role, or as `authenticated` with the owner's claims);
 *   - the S3 object store (the repository's own in-memory store), the Supabase token check (a fixed synthetic token);
 *   - the three providers, as FAKES with the delays of contract §8.1 (S8B-01 measurements, seeded log-normal draws):
 *     Speechmatics (a scripted recognizer: FINAL per ForceEndOfUtterance), DeepSeek (the SDK's `create`, streaming chunks:
 *     first token T 690 / 903 ms, first releasable piece G 136 / 243 ms after it) and Gemini TTS (first byte S 655 / 764 ms);
 *   - Memory and the durable preferences: empty (their real services are proven elsewhere).
 * No network, no paid API, no real person, no real voice. The humans are random UUIDs and the audio is generated.
 *
 * It refuses anything but a loopback database, and it changes the database it is given (the Voice Gate rows of THAT
 * throwaway database, restored at the end): run it only on a disposable local clone, never on a shared or hosted database.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/proof190 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-cp2-spoken-turn-synthetic-proof.ts
 */
import 'reflect-metadata';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Module, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { accountedDeepSeekStreamingChatCompletions } from '../src/ai-usage/accounted-provider-clients';
import { AiProviderCallAccounting } from '../src/ai-usage/ai-provider-call-accounting';
import { SupabaseAiProviderCallLedger } from '../src/ai-usage/ai-provider-call-ledger.repository';
import { SupabaseAuthService } from '../src/auth/supabase-auth.service';
import { BehavioralResponsePolicyService } from '../src/conversation/behavioral-response-policy.service';
import { CALL_CONTEXT_POLICY, LiveCallReplyService } from '../src/conversation/live-call-reply.service';
import { SafetyResponseGateService } from '../src/conversation/safety-response-gate.service';
import { DataApiError, SupabaseDataApiService } from '../src/conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import type { HypothesisReasoningContextService } from '../src/hypothesis/hypothesis-reasoning-context.service';
import { BoundedForegroundIntelligenceGathererService } from '../src/intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import { IntegratedContextBudgetAssemblerService } from '../src/intelligence-runtime/integrated-context-budget-assembler.service';
import type { InteractionPreferencesRepository } from '../src/interaction-preferences/interaction-preferences.repository';
import { InteractionPreferencesService } from '../src/interaction-preferences/interaction-preferences.service';
import type { MemoryRetrieverService } from '../src/memory/memory-retriever.service';
import { DeepSeekModelRouter } from '../src/model-router/providers/deepseek/deepseek-model-router';
import { loadDeepSeekLiveCallConfig } from '../src/model-router/providers/deepseek/deepseek-model-router.config';
import { correlation } from '../src/observability/shared-correlation';
import { TelemetryService } from '../src/observability/telemetry.service';
import { InMemoryPrivateAudioObjectStore } from '../src/voice-media/private-audio-object.store';
import { VoiceMediaRepository } from '../src/voice-media/voice-media.repository';
import { VoiceMediaService } from '../src/voice-media/voice-media.service';
import { readOggOpus } from '../src/voice/call/codec/ogg-opus';
import { DOWNLINK_OPUS, OpusPacketDecoder, OpusPacketEncoder, UPLINK_OPUS } from '../src/voice/call/codec/opus-codec';
import { LiveCallGateway } from '../src/voice/call/gateway/live-call.gateway';
import { LIVE_CALL_SPEECH_SINK } from '../src/voice/call/live-call-speech.port';
import { LiveCallRepository } from '../src/voice/call/live-call.repository';
import { LiveCallService } from '../src/voice/call/live-call.service';
import { decodeReplyAudioFrame, encodeAudioFrame, LIVE_CALL_PATH, LIVE_CALL_PROTOCOL } from '../src/voice/call/live-call.protocol';
import { LIVE_CALL_STORE } from '../src/voice/call/live-call.store';
import { syntheticUplinkPackets } from '../src/voice/call/testing/synthetic-voice';
import { callRetrievalTerms } from '../src/voice/call-turn/call-reply';
import { CallTurnRepository } from '../src/voice/call-turn/call-turn.repository';
import { LiveCallConversationBinding } from '../src/voice/call-turn/live-call-conversation.port';
import { LiveCallTurnEngine, type CallTurnObservation } from '../src/voice/call-turn/live-call-turn.engine';
import { FakeCallSynthesis, fakeCallSynthesisRoute } from '../src/voice/call-turn/testing/fake-call-synthesis';
import { FAKE_CALL_INTERIM, FakeCallRecognizer } from '../src/voice/call-turn/testing/fake-call-recognizer';
import type { RealtimeRecognition } from '../src/voice/live-note/live-voice-note.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const TOKENS = new Map<string, string>();
const PACKETS = syntheticUplinkPackets(500);
const SILENCE = (() => {
  const encoder = new OpusPacketEncoder(UPLINK_OPUS.rate, UPLINK_OPUS.bitrate);
  try {
    return encoder.encode(Buffer.alloc((UPLINK_OPUS.rate * 20 * 2) / 1000));
  } finally {
    encoder.close();
  }
})();
/** The synthetic DeepSeek is qualification-only: the live call config refuses production and needs SYNTHETIC_ONLY. */
const DEEPSEEK_ENV = { NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'synthetic-proof-not-a-key' } as NodeJS.ProcessEnv;

/** Contract §8.1 (S8B-01, measured): P50 / P95 of the stages a fake stands in for. */
const DELAYS = { T: [690, 903], G: [136, 243], S: [655, 764] } as const;
/** The network the loopback proof does not have (contract §8.1, N): added to the estimate, never measured here. */
const NETWORK_MS = [100, 200] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error('S8B05_CP2_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  }
  return url;
}

/** Seeded draws (mulberry32 + Box-Muller): a log-normal with the given P50 and P95. */
function lognormal(seed: number, [p50, p95]: readonly [number, number]): () => number {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const sigma = Math.log(p95 / p50) / 1.6449;
  return () => {
    const z = Math.sqrt(-2 * Math.log(Math.max(uniform(), 1e-12))) * Math.cos(2 * Math.PI * uniform());
    return Math.round(p50 * Math.exp(sigma * z));
  };
}

const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
};
const mean = (values: number[]): number | null => (values.length === 0 ? null : Math.round(values.reduce((s, v) => s + v, 0) / values.length));

/** PostgREST's service_role hop, as a shim: the same function, the same role, JSON values, the same error identity. */
class PgServiceRoleRpc {
  constructor(private readonly pool: PgPool) {}

  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!/^(?:server_[a-z0-9_]+|begin_ai_provider_call_v[12]|settle_ai_provider_call_v1)$/u.test(name)) throw new Error('S8B05_CP2_PROOF_RPC_NAME');
    const entries = Object.entries(body);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      const result = await client.query(`SELECT * FROM public.${name}(${args})`, entries.map(([, v]) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v)));
      await client.query('COMMIT');
      return JSON.parse(JSON.stringify(result.rows)) as T;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const e = error as { code?: string; message?: string };
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
    }
  }
}

/** PostgREST's owner hop, as a shim: `authenticated`, the owner's claims (RLS and auth.uid() as on the wire), RPC only. */
class PgOwnerDataApi {
  constructor(private readonly pool: PgPool) {}

  async request<T>(accessToken: string, path: string, init: { body?: string } = {}): Promise<T> {
    const userId = TOKENS.get(accessToken);
    if (!userId) throw new DataApiError(401);
    const name = /^rpc\/([a-z0-9_]+)$/u.exec(path)?.[1];
    if (!name) throw new Error('S8B05_CP2_PROOF_OWNER_PATH');
    const entries = Object.entries(JSON.parse(init.body ?? '{}') as Record<string, unknown>);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
      const result = await client.query(`SELECT * FROM public.${name}(${args})`, entries.map(([, v]) => v));
      await client.query('COMMIT');
      return JSON.parse(JSON.stringify(result.rows)) as T;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const e = error as { code?: string; message?: string };
      throw new DataApiError(400, { databaseCode: e.code, databaseMessage: e.message });
    } finally {
      client.release();
    }
  }
}

const POSTGREST_URL = process.env.POSTGREST_URL?.replace(/\/$/u, '');
const POSTGREST_SECRET = process.env.POSTGREST_JWT_SECRET;
const WIRE = Boolean(POSTGREST_URL && POSTGREST_SECRET);
/** The PostgREST loop's mode: call A alone (every transport-bearing check); the window comparison is a measurement, run once. */
const SINGLE_CALL = process.env.S8B05_CP2_PROOF_SINGLE_CALL === '1';

function signedJwt(claims: Record<string, unknown>): string {
  const b64 = (value: string) => Buffer.from(value).toString('base64url');
  const unsigned = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 1800 }))}`;
  return `${unsigned}.${createHmac('sha256', POSTGREST_SECRET!).update(unsigned).digest('base64url')}`;
}

/** The Supabase gateway's shape, minimally: `/rest/v1/*` to PostgREST. */
function startRestGateway(): Promise<Server> {
  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (!request.url?.startsWith('/rest/v1/')) return void response.writeHead(404).end();
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        const headers = Object.fromEntries(Object.entries(request.headers)
          .filter(([n]) => !['host', 'apikey', 'content-length', 'connection', 'transfer-encoding', 'keep-alive'].includes(n))) as Record<string, string>;
        const upstream = await fetch(`${POSTGREST_URL}${request.url.slice('/rest/v1'.length)}`, { method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
        response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
        response.end(Buffer.from(await upstream.arrayBuffer()));
      } catch {
        response.writeHead(502).end();
      }
    })();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

interface ReplyFrame { readonly callTurnIndex: number; readonly chunkSeq: number; readonly offsetMs: number; readonly epoch: number; readonly packet: Buffer; readonly at: number }
type Playout = 'ALL' | 'HALF' | 'NONE';

/**
 * The synthetic phone: a continuous 20 ms uplink (the generated voice while it "speaks", Opus silence otherwise), and a
 * player that plays QANDEEL's reply in real time from its first frame, confirming with PLAYOUT every 100 ms and whenever
 * it runs out of audio (a phone's playout report), as far as its policy for that reply lets it.
 */
class SyntheticPhone {
  readonly messages: Array<Record<string, unknown> & { at: number }> = [];
  readonly frames: ReplyFrame[] = [];
  readonly played: ReplyFrame[] = [];
  readonly closed: Promise<number>;
  uplinkPackets = 0;
  lastVoicedEnd = 0;
  private readonly ws: WebSocket;
  private speaking = false;
  private voiced = 0;
  private msgId = 1;
  private stopUplink = false;
  private uplinkDone: Promise<void> = Promise.resolve();

  constructor(url: string, token: string) {
    this.ws = new WebSocket(url, { protocols: [LIVE_CALL_PROTOCOL], headers: { authorization: `Bearer ${token}` } } as never);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = (event) => {
      const at = Date.now();
      if (typeof event.data === 'string') {
        this.messages.push({ ...(JSON.parse(event.data) as Record<string, unknown>), at });
        return;
      }
      const frame = decodeReplyAudioFrame(Buffer.from(event.data as ArrayBuffer));
      if (frame) this.frames.push({ ...frame, packet: Buffer.from(frame.packet), at });
    };
    this.closed = new Promise((resolve) => {
      this.ws.onclose = (event) => resolve(event.code);
    });
  }

  opened(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('NOT_OPENED'));
    });
  }

  send(message: object | Buffer): void {
    this.ws.send(Buffer.isBuffer(message) ? message : JSON.stringify(message));
  }

  nextMsgId(): number {
    this.msgId += 1;
    return this.msgId;
  }

  async waitFor(predicate: (m: Record<string, unknown>) => boolean, ms = 15_000): Promise<Record<string, unknown> & { at: number }> {
    const until = Date.now() + ms;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (Date.now() > until) throw new Error('MESSAGE_NOT_SEEN');
      await sleep(5);
    }
  }

  /** The uplink, paced on the wall clock (drift-corrected), epoch 1, capture clock from 0, a HEARTBEAT each second. */
  startUplink(): void {
    const started = Date.now();
    this.uplinkDone = (async () => {
      for (let i = 0; !this.stopUplink; i += 1) {
        const due = started + i * 20;
        if (due > Date.now()) await sleep(due - Date.now());
        const voiced = this.speaking;
        this.send(encodeAudioFrame({ epoch: 1, seq: i, captureMs: i * 20, packet: voiced ? PACKETS[this.voiced++ % PACKETS.length]! : SILENCE }));
        this.uplinkPackets = i + 1;
        if (voiced) this.lastVoicedEnd = Date.now();
        if (i % 50 === 49) this.send({ type: 'HEARTBEAT', n: i });
      }
    })();
  }

  async stop(): Promise<void> {
    this.stopUplink = true;
    await this.uplinkDone;
  }

  async say(ms: number): Promise<number> {
    this.speaking = true;
    await sleep(ms);
    this.speaking = false;
    return this.lastVoicedEnd;
  }

  replyEnd(callTurnIndex: number): (Record<string, unknown> & { at: number }) | undefined {
    return this.messages.find((m) => m.type === 'REPLY_END' && m.callTurnIndex === callTurnIndex);
  }

  /** Plays reply `callTurnIndex` per the policy; resolves when it stops (played out, its REPLY_END, or its limit). */
  /** HALF stops after 14 frames (280 ms): past the scripted first piece (240 ms of audio), short of the whole reply. */
  async play(callTurnIndex: number, policy: Playout, halfFrames = 14): Promise<void> {
    if (policy === 'NONE') return;
    const limit = policy === 'HALF' ? halfFrames : Number.POSITIVE_INFINITY;
    let j = 0;
    let clock = 0;
    const deadline = Date.now() + 20_000;
    for (;;) {
      if (j >= limit || this.replyEnd(callTurnIndex) || Date.now() > deadline) return;
      const frame = this.frames.find((f) => f.callTurnIndex === callTurnIndex && f.chunkSeq === j);
      if (!frame) {
        await sleep(5);
        continue;
      }
      clock = Math.max(clock, frame.at) + 20;
      if (clock > Date.now()) await sleep(clock - Date.now());
      this.played.push(frame);
      const nextHere = this.frames.some((f) => f.callTurnIndex === callTurnIndex && f.chunkSeq === j + 1);
      if (j % 5 === 4 || !nextHere || j + 1 >= limit) {
        this.send({ type: 'PLAYOUT', msgId: this.nextMsgId(), callTurnIndex, chunkSeq: j, playedMs: (j + 1) * 20 });
      }
      j += 1;
    }
  }

  /** Waits until no reply frame of `callTurnIndex` has arrived for `quietMs` (its generation is over). */
  async replyQuiet(callTurnIndex: number, quietMs = 900): Promise<void> {
    const until = Date.now() + 15_000;
    for (;;) {
      const last = this.frames.filter((f) => f.callTurnIndex === callTurnIndex).at(-1)?.at ?? 0;
      if (last > 0 && Date.now() - last >= quietMs) return;
      if (Date.now() > until) return;
      await sleep(20);
    }
  }
}

interface TurnPlan { readonly text: string; readonly playout: Playout; readonly provider: 'OK' | 'WITHHELD' | 'FAIL' }

/**
 * The scripted call: 16 spoken turns. Turn 0 names a ticket number that turn 14 recalls ("فاكر ... قلتلك"), after the
 * window has moved past it (in-call retrieval). Turn 3 is interrupted (half played), turn 6 is never heard, turn 9's
 * stream breaks after its first piece (WITHHELD_TAIL), turn 11 fails before any word (FAILED); the rest play out.
 */
const SCRIPT: TurnPlan[] = [
  { text: 'رقم التذكرة 4471 للرحلة بكرة الصبح من المطار', playout: 'ALL', provider: 'OK' },
  { text: 'النهارده كان يوم طويل جدا في الشغل', playout: 'ALL', provider: 'OK' },
  { text: 'المدير طلب تقرير جديد قبل الخميس', playout: 'ALL', provider: 'OK' },
  { text: 'وأنا لسه ما خلصتش التقرير القديم أصلا', playout: 'HALF', provider: 'OK' },
  { text: 'استنى، خليني أكمل كلامي عن الاجتماع', playout: 'ALL', provider: 'OK' },
  { text: 'الاجتماع اتأجل مرتين الأسبوع ده', playout: 'ALL', provider: 'OK' },
  { text: 'ومش عارف هل ده كويس ولا وحش', playout: 'NONE', provider: 'OK' },
  { text: 'أنا ما سمعتش ردك خالص', playout: 'ALL', provider: 'OK' },
  { text: 'المهم إني محتاج أرتب أولوياتي', playout: 'ALL', provider: 'OK' },
  { text: 'عندي كمان موضوع الإيجار والشقة', playout: 'ALL', provider: 'WITHHELD' },
  { text: 'صاحب الشقة عايز يزود الإيجار', playout: 'ALL', provider: 'OK' },
  { text: 'وأنا مش متأكد أقبل ولا أدور على شقة تانية', playout: 'ALL', provider: 'FAIL' },
  { text: 'طيب نرجع للشغل تاني', playout: 'ALL', provider: 'OK' },
  { text: 'التقرير لازم يتسلم يوم الخميس الصبح', playout: 'ALL', provider: 'OK' },
  { text: 'فاكر رقم التذكرة اللي قلتلك عليه في الأول', playout: 'ALL', provider: 'OK' },
  { text: 'شكرا، كده تمام ونكمل بكرة', playout: 'ALL', provider: 'OK' },
];

/**
 * The synthetic DeepSeek: the SDK's streaming `create` with the measured delays. Each reply carries markers (R<n>a in its
 * first piece, R<n>b after it) so the proof can tell, without reading words, which part of a reply a later turn received.
 */
class SyntheticDeepSeek {
  readonly bodies: Array<{ max_tokens?: number; thinking?: { type?: string }; stream?: boolean; messages: Array<{ role: string; content: string }>; hadSignal: boolean }> = [];
  plans: Array<TurnPlan['provider']> = [];
  private drawT = lognormal(1, DELAYS.T);
  private drawG = lognormal(2, DELAYS.G);
  private reply = 0;

  reset(): void {
    this.drawT = lognormal(1, DELAYS.T);
    this.drawG = lognormal(2, DELAYS.G);
    this.reply = 0;
  }

  readonly create = async (body: Record<string, unknown>, options: { signal?: AbortSignal } = {}): Promise<AsyncIterable<Record<string, unknown>>> => {
    const k = this.reply;
    this.reply += 1;
    const plan = this.plans[k] ?? 'OK';
    const messages = body.messages as Array<{ role: string; content: string }>;
    this.bodies.push({ ...(body as object), messages, hadSignal: options.signal instanceof AbortSignal });
    const t = this.drawT();
    const g = this.drawG();
    const signal = options.signal;
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    });
    if (plan === 'FAIL') {
      await wait(150);
      throw Object.assign(new Error('synthetic provider unavailable'), { status: 503 });
    }
    const content = (text: string) => ({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
    const promptTokens = Math.ceil(Buffer.byteLength(JSON.stringify(messages), 'utf8') / 4);
    async function* stream(): AsyncGenerator<Record<string, unknown>> {
      // T: the first token. G later: the first sentence's end with the next word after it (the guard releases a piece only
      // from text no later chunk can change), so the first piece is releasable at T + G, as S8B-01 measured G.
      await wait(t);
      yield content(`أهلًا R${k}a،`);
      await wait(g);
      yield content(' أنا معك ومتابع كلامك. قل');
      await wait(120);
      if (plan === 'WITHHELD') throw Object.assign(new Error('synthetic stream cut'), { name: 'APIConnectionError' });
      yield content(` لي R${k}b أكثر، إيه أكتر حاجة شاغلاك دلوقتي؟`);
      yield { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
      yield { choices: [], usage: { prompt_tokens: promptTokens, completion_tokens: 40 } };
    }
    return stream();
  };
}

/** Leaves the database as it was: the fixture humans and every row they own, the gates restored to their snapshot. */
async function teardown(pool: PgPool, humans: string[], gates: Array<Record<string, unknown>>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
    await client.query(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
    await client.query(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
    await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[])', [humans]);
    const owned = await client.query(`SELECT table_schema, table_name FROM information_schema.columns
      WHERE column_name = 'user_id' AND table_schema IN ('voice_private', 'public', 'private') AND table_name NOT IN ('users')
        AND table_name IN (SELECT table_name FROM information_schema.tables t WHERE t.table_schema = columns.table_schema AND t.table_type = 'BASE TABLE')`);
    for (const row of owned.rows) {
      await client.query(`DELETE FROM "${String(row.table_schema)}"."${String(row.table_name)}" WHERE user_id = ANY($1::uuid[])`, [humans]);
    }
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [humans]);
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [humans]);
    for (const gate of gates) {
      await client.query(`UPDATE voice_private.voice_launch_capability_states SET feature_flag_state = $2, launch_requirements_state = $3,
          restriction_version = $4, decided_by = $5, policy_basis = $6, decided_at = $7 WHERE capability_scope = $1`,
      [gate.capability_scope, gate.feature_flag_state, gate.launch_requirements_state, gate.restriction_version, gate.decided_by, gate.policy_basis, gate.decided_at]);
      await client.query('DELETE FROM voice_private.voice_launch_capability_events WHERE capability_scope = $1 AND restriction_version > $2',
        [gate.capability_scope, gate.restriction_version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

interface Results { [scenario: string]: { pass: boolean; detail: Record<string, unknown> } }

interface TurnRun {
  /** Its position in the script (0 - 15); index is its call_turn_index (1 - 16). */
  readonly k: number;
  readonly index: number;
  readonly plan: TurnPlan;
  readonly speechEnd: number;
  readonly committedAt: number | null;
  readonly firstAudioAt: number | null;
  readonly replyEnd: Record<string, unknown> | null;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 10 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  let restGateway: Server | null = null;
  let serverApi: SupabaseServiceRoleApiService;
  let ownerApi: SupabaseDataApiService;
  if (WIRE) {
    restGateway = await startRestGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${(restGateway.address() as AddressInfo).port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = signedJwt({ role: 'service_role' });
    process.env.SUPABASE_PUBLISHABLE_KEY = 'synthetic-proof-publishable';
    serverApi = new SupabaseServiceRoleApiService();
    ownerApi = new SupabaseDataApiService();
  } else {
    serverApi = new PgServiceRoleRpc(pool) as unknown as SupabaseServiceRoleApiService;
    ownerApi = new PgOwnerDataApi(pool) as unknown as SupabaseDataApiService;
  }
  process.stdout.write(`S8B-05 CP2 synthetic spoken turn (transport: ${WIRE ? `PostgREST ${process.env.POSTGREST_VERSION ?? ''}`.trim() : 'pg shims (service_role / authenticated)'})\n`);

  // ---------------------------------------------------------------- the composition: real services, three fake providers
  const telemetry = new TelemetryService(correlation);
  const accounting = new AiProviderCallAccounting(new SupabaseAiProviderCallLedger(serverApi), telemetry, () => correlation.current());
  const deepseek = new SyntheticDeepSeek();
  const router = new DeepSeekModelRouter(loadDeepSeekLiveCallConfig(DEEPSEEK_ENV), { chat: { completions: { create: async () => { throw new Error('S8B05_CP2_NO_UNARY'); } } } } as never,
    telemetry, accountedDeepSeekStreamingChatCompletions({ chat: { completions: { create: deepseek.create } } } as never, 'CONVERSATION_REPLY', accounting));
  const binding = new LiveCallConversationBinding();
  const gatherer = new BoundedForegroundIntelligenceGathererService(
    { retrieve: async () => [] } as unknown as MemoryRetrieverService,
    { build: async () => ({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as HypothesisReasoningContextService,
    correlation, telemetry,
  );
  const replyService = new LiveCallReplyService(binding, ownerApi, new SafetyResponseGateService(), new BehavioralResponsePolicyService(),
    new InteractionPreferencesService({ read: async () => [] } as unknown as InteractionPreferencesRepository), gatherer,
    new IntegratedContextBudgetAssemblerService(telemetry), router);
  replyService.onModuleInit();
  let recognizer = new FakeCallRecognizer([]);
  const recognition: RealtimeRecognition = { openStream: (request) => recognizer.openStream(request) };
  let synthesis = new FakeCallSynthesis();
  let drawS = lognormal(3, DELAYS.S);
  const synthesisProxy = {
    provider: 'GEMINI' as const, supportsHints: true,
    synthesize: (request: Parameters<FakeCallSynthesis['synthesize']>[0]) => synthesis.synthesize(request),
  };
  const engine = new LiveCallTurnEngine(new CallTurnRepository(serverApi), binding, recognition, fakeCallSynthesisRoute(synthesisProxy), telemetry);
  const observations: CallTurnObservation[] = [];
  engine.observe((o) => observations.push(o));

  const objects = new InMemoryPrivateAudioObjectStore();
  const media = new VoiceMediaService(new VoiceMediaRepository(serverApi), objects);
  const auth = {
    authenticate: async (authorization: string | undefined) => {
      const token = /^Bearer (.+)$/u.exec(authorization ?? '')?.[1] ?? '';
      const userId = TOKENS.get(token);
      if (!userId) throw new UnauthorizedException();
      return { userId, accessToken: token };
    },
  };

  @Module({
    providers: [
      { provide: SupabaseAuthService, useValue: auth },
      { provide: LIVE_CALL_STORE, useValue: new LiveCallRepository(serverApi) },
      { provide: VoiceMediaService, useValue: media },
      { provide: LIVE_CALL_SPEECH_SINK, useValue: engine },
      LiveCallService,
      LiveCallGateway,
    ],
  })
  class ProofModule {}

  const app: INestApplication = await NestFactory.create(ProofModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const url = `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}${LIVE_CALL_PATH}`;

  // ---------------------------------------------------------------- fixtures, snapshotted first and restored at the end
  const SCOPES = ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE'];
  const humans: string[] = [];
  const gatesBefore = await sql('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = ANY($1::text[])', [SCOPES]);
  const gatesEnabledBefore = Number((await sql("SELECT count(*) AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED'"))[0]!.n);
  for (const scope of SCOPES) {
    await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, 'ENABLED', 'SATISFIED', 's8b-05-cp2-proof', 'local synthetic proof')", [scope]);
  }
  const person = async () => {
    const user = randomUUID();
    const session = randomUUID();
    humans.push(user);
    await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    const token = WIRE ? signedJwt({ sub: user, role: 'authenticated', aud: 'authenticated' }) : `synthetic-${randomUUID()}`;
    TOKENS.set(token, user);
    await serverApi.rpc('server_grant_voice_recording_consent_v1', { p_user_id: user, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });
    return { user, session, token, phone: randomUUID() };
  };

  const results: Results = {};
  const record = (name: string, pass: boolean, detail: Record<string, unknown>) => {
    results[name] = { pass, detail };
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name}\n`);
  };

  /** One whole scripted call; returns what the phone saw, the engine observed and the database holds. */
  const runCall = async (label: string) => {
    const p = await person();
    const call = randomUUID();
    recognizer = new FakeCallRecognizer(SCRIPT.map((turn) => ({ text: turn.text })), { finalDelayMs: 120 });
    drawS = lognormal(3, DELAYS.S);
    synthesis = new FakeCallSynthesis({ firstByteMs: () => drawS(), chunkMs: 8 });
    deepseek.reset();
    deepseek.plans = SCRIPT.map((turn) => turn.provider);
    const bodiesBefore = deepseek.bodies.length;
    observations.length = 0;
    const phone = new SyntheticPhone(url, p.token);
    await phone.opened();
    phone.send({ type: 'HELLO', v: 1, callId: call, sessionId: p.session, clientInstanceId: p.phone, resume: false });
    await phone.waitFor((m) => m.state === 'CONNECTING');
    phone.startUplink();
    const turns: TurnRun[] = [];
    for (const [k, plan] of SCRIPT.entries()) {
      // The call authority numbers a call's turns from 1 (0189 `next_call_turn_index`).
      const index = k + 1;
      await sleep(300);
      const speechEnd = await phone.say(1_200);
      const committed = await phone.waitFor((m) => m.type === 'TURN_COMMITTED' && m.callTurnIndex === index).catch(() => null);
      const player = phone.play(index, plan.playout);
      if (plan.provider === 'FAIL' || plan.playout === 'ALL') {
        await phone.waitFor((m) => m.type === 'REPLY_END' && m.callTurnIndex === index).catch(() => null);
      } else {
        await phone.replyQuiet(index);
      }
      await player;
      const first = phone.frames.find((f) => f.callTurnIndex === index)?.at ?? null;
      turns.push({ k, index, plan, speechEnd, committedAt: committed?.at ?? null, firstAudioAt: first, replyEnd: phone.replyEnd(index) ?? null });
      process.stdout.write(`  ${label} turn ${index}: ${plan.playout}/${plan.provider} first audio ${first && committed ? `${first - speechEnd} ms after speech end` : 'none'}\n`);
    }
    // The last REPLY_ENDs of the interrupted turns came with the next commits; the call ends after the last one.
    await sleep(300);
    await phone.stop();
    phone.send({ type: 'END', msgId: phone.nextMsgId() });
    await phone.waitFor((m) => m.state === 'ENDED');
    await phone.closed;
    // The recognizer's ledger row is settled after the connection closes; wait for nothing PENDING (bounded).
    for (let i = 0; i < 100; i += 1) {
      const pending = Number((await sql("SELECT count(*) AS n FROM public.ai_provider_calls WHERE user_id = $1 AND call_state = 'PENDING'", [p.user]))[0]!.n);
      if (pending === 0) break;
      await sleep(50);
    }
    // An interrupted reply's REPLY_END comes with the NEXT commit: read every one once the call has ended.
    const settled = turns.map((turn) => ({ ...turn, replyEnd: phone.replyEnd(turn.index) ?? null }));
    return { p, call, phone, turns: settled, bodies: deepseek.bodies.slice(bodiesBefore), observed: [...observations], synthesisRequests: synthesis.requests.length };
  };

  const exchangesOf = (call: string) => sql(`SELECT e.call_turn_index AS k, e.delivery_state, e.generation_state, e.heard_mark_ms::int AS heard, e.produced_audio_ms::int AS produced,
      e.close_reason, e.safety_disposition, t.content AS heard_text, u.content AS user_text
      FROM voice_private.call_exchanges e JOIN public.conversation_turns u ON u.id = e.user_turn_id LEFT JOIN public.conversation_turns t ON t.id = e.assistant_turn_id
      WHERE e.call_id = $1 ORDER BY e.call_turn_index`, [call]);
  const segmentsOf = (call: string) => sql(`SELECT o.track, o.segment_index, o.clock_start_ms::int AS s, o.clock_end_ms::int AS e, o.object_state, o.storage_key
      FROM voice_private.recording_objects o JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.call_id = $1 ORDER BY o.track, o.segment_index`, [call]);
  const ledgerOf = (user: string) => sql(`SELECT provider, operation, feature_family, processing_path, requested_model, call_state, usage_completeness
      FROM public.ai_provider_calls WHERE user_id = $1 ORDER BY started_at`, [user]);

  const policy = CALL_CONTEXT_POLICY as { maxExchanges: number };
  try {
    // ============================================================ call A: the approved window (D-05-08: 12 / ~1 500 / 4)
    const a = await runCall('A');
    const exchanges = await exchangesOf(a.call);
    const byK = new Map(exchanges.map((row) => [Number(row.k) - 1, row]));
    const userOf = (k: number) => SCRIPT[k]!.text;
    const replyEndOf = (k: number) => a.turns[k]!.replyEnd;

    // S1 — voice to reply: every turn committed from FINAL words only, each reply's audio well-formed and complete.
    {
      const decoder = new OpusPacketDecoder(DOWNLINK_OPUS.rate);
      let wellFormed = true;
      try {
        for (const turn of a.turns) {
          const frames = a.phone.frames.filter((f) => f.callTurnIndex === turn.index);
          frames.forEach((f, i) => {
            if (f.chunkSeq !== i || f.offsetMs !== i * 20 || f.epoch !== 1 || decoder.decode(f.packet).length / 2 !== 480) wellFormed = false;
          });
        }
      } finally {
        decoder.close();
      }
      const committed = a.phone.messages.filter((m) => m.type === 'TURN_COMMITTED');
      const allIn = JSON.stringify(exchanges.map((row) => row.user_text)) === JSON.stringify(SCRIPT.map((turn) => turn.text));
      const interimNowhere = !JSON.stringify(exchanges).includes(FAKE_CALL_INTERIM) && !JSON.stringify(a.bodies).includes(FAKE_CALL_INTERIM);
      const replyEndsMatch = a.turns.every((turn) => turn.replyEnd === null
        || Number(turn.replyEnd.chunks) === a.phone.frames.filter((f) => f.callTurnIndex === turn.index).length);
      record('S1 voice in, QANDEEL\'s voice out: 16 committed spoken turns (finals only), Opus 24 kHz replies, one REPLY_END each',
        committed.length === 16 && committed.every((m, i) => m.callTurnIndex === i + 1 && m.role === 'USER' && m.clientTurnId === null)
        && allIn && interimNowhere && wellFormed && replyEndsMatch && a.turns.every((turn) => turn.replyEnd !== null),
        { turnsCommitted: committed.length, finalsOnly: allIn && interimNowhere, replyAudioWellFormed: wellFormed,
          replyFrames: a.phone.frames.length, replyEndChunksMatchFrames: replyEndsMatch });
    }

    // S2 — the five delivery cases (CA-05-02), the phone's REPLY_END and the database agreeing on each.
    {
      const want: Record<number, string> = { 3: 'INTERRUPTED', 6: 'INTERRUPTED', 9: 'WITHHELD_TAIL', 11: 'FAILED' };
      const states = exchanges.map((row) => String(row.delivery_state));
      const expected = SCRIPT.map((_, k) => want[k] ?? 'COMPLETE');
      const phoneAgrees = a.turns.every((turn) => replyEndOf(turn.k)?.deliveryState === states[turn.k]);
      const half = byK.get(3)!;
      const none = byK.get(6)!;
      const failed = byK.get(11)!;
      const withheld = byK.get(9)!;
      const halfOk = Number(half.heard) > 0 && Number(half.heard) < Number(half.produced) && String(half.heard_text).includes('R3a') && !String(half.heard_text).includes('R3b');
      const noneOk = Number(none.heard) === 0 && String(none.heard_text) === '' && Number(none.produced) > 0;
      const failedOk = Number(failed.produced) === 0 && failed.generation_state === 'FAILED' && String(failed.heard_text) === '';
      const withheldOk = withheld.generation_state === 'WITHHELD_TAIL' && String(withheld.heard_text).includes('R9a') && !String(withheld.heard_text).includes('R9b');
      const completeOk = exchanges.filter((row) => row.delivery_state === 'COMPLETE').every((row) => Number(row.heard) === Number(row.produced)
        && String(row.heard_text).includes(`R${Number(row.k) - 1}a`) && String(row.heard_text).includes(`R${Number(row.k) - 1}b`));
      const events = Number((await sql(`SELECT count(*) AS n FROM public.runtime_event_outbox WHERE subject_session_id = $1 AND event_type = 'ConversationTurnCompleted'`, [a.p.session]))[0]!.n);
      const closedOnce = exchanges.every((row) => row.close_reason !== null);
      record('S2 the five delivery cases: COMPLETE, INTERRUPTED (part heard), INTERRUPTED (nothing heard), WITHHELD_TAIL, FAILED; phone = database; one event each',
        JSON.stringify(states) === JSON.stringify(expected) && phoneAgrees && halfOk && noneOk && failedOk && withheldOk && completeOk && events === 16 && closedOnce,
        { deliveryStates: states, closeReasons: exchanges.map((row) => row.close_reason), phoneAgrees,
          interrupted: { heardMs: half.heard, producedMs: half.produced, heardOnlyTheFirstPiece: halfOk },
          nothingHeard: { heardMs: none.heard, producedMs: none.produced, heardTextEmpty: noneOk },
          withheldTail: withheldOk, failed: { producedMs: failed.produced, ok: failedOk }, completeHeardEqualsProduced: completeOk,
          completedEvents: events });
    }

    // S3 — REALTIME (VA-1 / VA-4): every call reply is one streamed DeepSeek request, max_tokens 160, thinking disabled,
    // with the reply's abort signal; TM-02 in its guidance; nothing reached DeepSeek before its turn was committed.
    {
      const shapes = a.bodies.every((body) => body.max_tokens === 160 && body.thinking?.type === 'disabled' && body.stream === true && body.hadSignal);
      const firstReleases = a.observed.filter((o): o is Extract<CallTurnObservation, { kind: 'REPLY_OUTCOME' }> => o.kind === 'REPLY_OUTCOME');
      const commits = a.observed.filter((o): o is Extract<CallTurnObservation, { kind: 'COMMITTED' }> => o.kind === 'COMMITTED');
      const outcomeKinds = firstReleases.sort((x, y) => x.callTurnIndex - y.callTurnIndex).map((o) => o.outcome.kind);
      record('S3 the REALTIME path: 16 streamed requests (max_tokens 160, no thinking, abort signal), generated only after each commit',
        a.bodies.length === 16 && shapes && commits.length === 16 && firstReleases.every((o) => commits.some((c) => c.callTurnIndex === o.callTurnIndex && c.at <= o.at)),
        { requests: a.bodies.length, shapeOk: shapes, outcomeKinds });
    }

    // S4 — context continuity (#28): reply N+1 receives the user's words N and the HEARD reply N (never the unheard part);
    // nothing heard: the user's words N joined to N+1, no empty reply inserted; in-call retrieval brings turn 0 back at 14.
    {
      const body = (k: number) => a.bodies[k]!.messages;
      const heard3 = String(byK.get(3)!.heard_text);
      const after3 = body(4).some((m) => m.role === 'assistant' && m.content === heard3) && body(4).some((m) => m.role === 'user' && m.content.includes(userOf(3)))
        && !JSON.stringify(body(4)).includes('R3b');
      const last7 = body(7).filter((m) => m.role === 'user').at(-1)?.content ?? '';
      const after6 = last7.includes(userOf(6)) && last7.includes(userOf(7)) && !body(7).some((m) => m.role === 'assistant' && m.content.trim() === '');
      const last12 = body(12).filter((m) => m.role === 'user').at(-1)?.content ?? '';
      const after11 = last12.includes(userOf(11)) && last12.includes(userOf(12));
      const outcome14 = a.observed.find((o): o is Extract<CallTurnObservation, { kind: 'REPLY_OUTCOME' }> => o.kind === 'REPLY_OUTCOME' && o.callTurnIndex === 15);
      const retrieved = outcome14?.outcome.context?.retrieval === 'HIT' && JSON.stringify(body(14)).includes(userOf(0));
      record('S4 context continuity: the heard part of an interrupted reply, the words of an unheard / failed exchange folded, in-call retrieval',
        after3 && after6 && after11 && retrieved,
        { interruptedHeardCarried: after3, nothingHeardFolded: after6, failedFolded: after11, retrievalAtCallTurn15: outcome14?.outcome.context?.retrieval,
          retrievedCallTurn1InContext: retrieved });
    }

    // S5 — heard = recorded (#10): the QANDEEL track holds exactly the confirmed reply packets, in order, byte for byte; the
    // USER track every uplink packet; both valid Ogg Opus.
    {
      const segments = await segmentsOf(a.call);
      const storedPackets = (track: string) => segments.filter((s) => s.track === track).flatMap((s) => {
        const object = objects.objects.get(String(s.storage_key));
        if (!object) return [Buffer.from('missing')];
        const ogg = readOggOpus(object.bytes);
        if (ogg.packets.length * 20 !== Number(s.e) - Number(s.s)) return [Buffer.from('duration')];
        return ogg.packets;
      });
      const qandeel = storedPackets('QANDEEL');
      const user = storedPackets('USER');
      const confirmed = a.phone.played;
      const sameAsHeard = qandeel.length === confirmed.length && qandeel.every((packet, i) => packet.equals(confirmed[i]!.packet));
      const neverMore = qandeel.length <= a.phone.frames.length;
      record('S5 heard = recorded: the QANDEEL track is exactly the reply packets the phone confirmed, the USER track every uplink packet',
        sameAsHeard && neverMore && user.length === a.phone.uplinkPackets && segments.every((s) => s.object_state === 'STORED'),
        { qandeelPacketsStored: qandeel.length, packetsConfirmedPlayed: confirmed.length, replyPacketsSent: a.phone.frames.length, byteForByte: sameAsHeard,
          userPacketsStored: user.length, uplinkPacketsSent: a.phone.uplinkPackets,
          segments: { USER: segments.filter((s) => s.track === 'USER').length, QANDEEL: segments.filter((s) => s.track === 'QANDEEL').length } });
    }

    // S6 — accounting (AI-COST-01): one ledger row per provider attempt, every one settled (nothing PENDING): the recognizer
    // once for the connection, DeepSeek once per reply (FAST, CONVERSATION_REPLY), Gemini once per synthesis attempt.
    {
      const ledger = await ledgerOf(a.p.user);
      const of = (provider: string) => ledger.filter((row) => row.provider === provider);
      const deepseekRows = of('DEEPSEEK');
      const counts = Object.fromEntries([...new Set(ledger.map((row) => `${String(row.provider)} ${String(row.call_state)}`))].map((key) =>
        [key, ledger.filter((row) => `${String(row.provider)} ${String(row.call_state)}` === key).length]));
      record('S6 one ledger row per provider attempt, each settled once: recognizer 1, DeepSeek 16 (FAST), Gemini = synthesis attempts',
        ledger.every((row) => row.call_state !== 'PENDING') && of('SPEECHMATICS').length === 1 && deepseekRows.length === 16
        && deepseekRows.every((row) => row.processing_path === 'FAST' && row.feature_family === 'CONVERSATION_REPLY')
        && of('GEMINI').length === a.synthesisRequests,
        { rows: ledger.length, byProviderAndState: counts, synthesisAttempts: a.synthesisRequests });
    }

    // ============================================================ call B: the same call with a window of 4 (comparison only)
    let b: typeof a | null = null;
    let exchangesB: typeof exchanges = [];
    if (!SINGLE_CALL) {
      policy.maxExchanges = 4;
      b = await runCall('B');
      policy.maxExchanges = 12;
      exchangesB = await exchangesOf(b.call);
    }

    // S7 — latency stages (synthetic estimate) and the D-05-08 window against a window of 4: tokens and first audio.
    {
      const played = (run: typeof a) => run.turns.filter((t) => t.plan.provider === 'OK' && t.firstAudioAt !== null && t.committedAt !== null);
      const outcome = (run: typeof a, k: number) => run.observed.find((o): o is Extract<CallTurnObservation, { kind: 'REPLY_OUTCOME' }> => o.kind === 'REPLY_OUTCOME' && o.callTurnIndex === k + 1)?.outcome;
      const commitAt = (run: typeof a, k: number) => run.observed.find((o): o is Extract<CallTurnObservation, { kind: 'COMMITTED' }> => o.kind === 'COMMITTED' && o.callTurnIndex === k + 1)?.at;
      const serverFirstAudio = (run: typeof a, k: number) => run.observed.find((o) => o.kind === 'FIRST_AUDIO' && o.callTurnIndex === k + 1) as { at: number } | undefined;
      const stage = (run: typeof a, name: string) => played(run).map((t) => outcome(run, t.k)?.stages[name]).filter((v): v is number => typeof v === 'number');
      const series = (values: number[]) => ({ p50: percentile(values, 50), p95: percentile(values, 95), n: values.length });
      const toFirstAudio = (run: typeof a) => played(run).map((t) => t.firstAudioAt! - t.speechEnd);
      const commitWait = played(a).map((t) => t.committedAt! - t.speechEnd);
      const synthWait = played(a).map((t) => {
        const first = serverFirstAudio(a, t.k)?.at;
        const release = outcome(a, t.k)?.stages.first_release;
        const committed = commitAt(a, t.k);
        return first !== undefined && release !== undefined && committed !== undefined ? first - (committed + release) : NaN;
      }).filter((v) => Number.isFinite(v));
      const totals = toFirstAudio(a);
      const latency = {
        label: 'Synthetic estimate: loopback, fake providers with the contract §8.1 delays; network N is added, not measured',
        speechEndToCommit_E: series(commitWait),
        contextRead: series(stage(a, 'context_read')),
        safetyStored: series(stage(a, 'safety_stored')),
        contextReady: series(stage(a, 'context_ready')),
        commitToFirstRelease_TplusG: series(stage(a, 'first_release')),
        firstReleaseToFirstAudio_S: series(synthWait),
        speechEndToFirstAudio_measured: series(totals),
        speechEndToFirstAudio_withNetwork: { p50: (percentile(totals, 50) ?? 0) + NETWORK_MS[0], p95: (percentile(totals, 95) ?? 0) + NETWORK_MS[1] },
      };
      const other = b;
      if (!other) {
        record('S7 latency stages (synthetic estimate); the window comparison runs in the full mode only', totals.length >= 10,
          { latency, window: 'not run: the single-call mode of the PostgREST loop' });
      } else {
        const tokens = (run: typeof a, k: number) => outcome(run, k)?.context?.estimatedTokens;
        const windowOf = (run: typeof a, k: number) => outcome(run, k)?.context?.windowExchanges;
        const pairs = played(a).filter((t) => t.k >= 5 && played(other).some((u) => u.k === t.k)).map((t) => ({
          callTurnIndex: t.index,
          windowA: windowOf(a, t.k), windowB: windowOf(other, t.k),
          tokensA: tokens(a, t.k) ?? 0, tokensB: tokens(other, t.k) ?? 0,
          firstAudioA: t.firstAudioAt! - t.speechEnd, firstAudioB: (() => { const u = played(other).find((x) => x.k === t.k)!; return u.firstAudioAt! - u.speechEnd; })(),
        }));
        const tokenIncrease = pairs.map((x) => x.tokensA - x.tokensB);
        const firstAudioDiff = pairs.map((x) => x.firstAudioA - x.firstAudioB);
        const window = {
          policy: { maxExchanges: 12, maxEstimatedTokens: 1_500, minExchanges: 4 },
          perTurn: pairs,
          estimatedTokenIncrease: { mean: mean(tokenIncrease), max: tokenIncrease.length ? Math.max(...tokenIncrease) : null },
          firstAudioDifferenceMs: { mean: mean(firstAudioDiff), p50: percentile(firstAudioDiff, 50), p95: percentile(firstAudioDiff, 95) },
          note: 'The fake DeepSeek does not model prompt prefill: the first-audio difference here is the server side only (read, fold, assembly). The provider\'s cost of the longer prompt is measured in S8B-08.',
        };
        const windowHeld = pairs.every((x) => (x.windowA ?? 99) <= 12 && (x.windowB ?? 99) <= 4) && pairs.some((x) => (x.windowA ?? 0) > (x.windowB ?? 0));
        const sameDelivery = JSON.stringify(exchangesB.map((row) => row.delivery_state)) === JSON.stringify(exchanges.map((row) => row.delivery_state));
        record('S7 latency stages (synthetic estimate) and the call window 12 against 4: estimated tokens and first audio, the delivery unchanged',
          totals.length >= 10 && windowHeld && sameDelivery && tokenIncrease.every((n) => n >= 0),
          { latency, window, windowHeld, sameDeliveryInBothCalls: sameDelivery });
      }
    }

    // S9 — #35 (A1 §4): a long call, 165 turns (about 55 minutes at 20 s a turn), built at the database level as the call's
    // typed turns (TEXT: the same order, window and retrieval, no audio), then the REAL REALTIME reply on the last turn: what
    // was said in the call's first minute comes back by in-call retrieval, inside its 80 ms, with no provider call for it.
    {
      const p = await person();
      const call = randomUUID();
      await serverApi.rpc('server_begin_call_v1', { p_user_id: p.user, p_session_id: p.session, p_call_id: call, p_client_instance_id: p.phone });
      await serverApi.rpc('server_activate_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1 });
      const first = 'رقم الحجز 9182 للفندق في إسكندرية';
      const recall = 'فاكر رقم الحجز اللي قلتلك عليه في أول المكالمة';
      const lines = [first, ...Array.from({ length: 163 }, (_, i) => `تمام كده ${i % 2 === 0 ? 'ماشي' : 'طيب'}`), recall];
      let last = { index: 0, turnId: '' };
      for (const [i, content] of lines.entries()) {
        const [row] = await serverApi.rpc<Array<{ outcome: string; call_turn_index: number; turn_id: string }>>('server_commit_live_call_turn_v1', {
          p_user_id: p.user, p_call_id: call, p_connection_epoch: 1, p_turn_id: randomUUID(), p_commit_id: randomUUID(), p_turn_channel: 'TEXT',
          p_content: content, p_asr_confidence_band: null, p_anchor_start_ms: null, p_anchor_end_ms: null, p_retrieval_terms: callRetrievalTerms(content),
          p_close_assistant_turn_id: randomUUID(), p_close_event_id: randomUUID(),
        });
        last = { index: Number(row!.call_turn_index), turnId: String(row!.turn_id) };
        if (i < lines.length - 1) {
          await serverApi.rpc('server_store_call_turn_safety_v1', { p_user_id: p.user, p_call_id: call, p_call_turn_index: last.index, p_safety_disposition: 'ALLOW' });
        }
        if (i % 40 === 39) await serverApi.rpc('server_heartbeat_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1 });
      }
      const readStarted = performance.now();
      const direct = await ownerApi.request<unknown[]>(p.token, 'rpc/call_turn_retrieval_v1', {
        method: 'POST', body: JSON.stringify({ p_call_id: call, p_terms: callRetrievalTerms(recall), p_recall_cue: true, p_before_index: last.index - 12 }),
      });
      const readMs = Math.round(performance.now() - readStarted);
      const bodiesBefore = deepseek.bodies.length;
      deepseek.plans = [];
      const turns = new CallTurnRepository(serverApi);
      const outcome = await replyService.reply({
        userId: p.user, sessionId: p.session, callId: call, callTurnIndex: last.index, userTurnId: last.turnId, content: recall, accessToken: p.token,
        signal: new AbortController().signal,
        storeSafety: async (disposition) => {
          const stored = await turns.storeSafety({ userId: p.user, callId: call, callTurnIndex: last.index, disposition });
          if (stored !== 'STORED' && stored !== 'SAME') throw new Error('S8B05_CP2_SAFETY_NOT_STORED');
        },
        release: () => undefined,
      });
      const sent = deepseek.bodies.slice(bodiesBefore);
      const ledger = await ledgerOf(p.user);
      record('S9 minute 1 recalled at minute 55: 165 turns, in-call retrieval inside 80 ms, no provider call for it, the window still 12',
        last.index === 165 && outcome.kind === 'COMPLETE' && outcome.context?.retrieval === 'HIT' && (outcome.context?.windowExchanges ?? 99) <= 12
        && sent.length === 1 && JSON.stringify(sent[0]!.messages).includes(first)
        && ledger.filter((r) => r.provider === 'DEEPSEEK').length === 1 && ledger.length === 1,
        { turns: last.index, retrieval: outcome.context?.retrieval, windowExchanges: outcome.context?.windowExchanges, retrievedExchanges: outcome.context?.retrievedExchanges,
          directRetrievalReadMs: readMs, directRetrievalRows: Array.isArray(direct) ? direct.length : null, providerRequests: sent.length,
          ledgerRows: ledger.map((r) => `${String(r.provider)} ${String(r.call_state)}`) });
    }
  } finally {
    policy.maxExchanges = 12;
    await app.close();
    await teardown(pool, humans, gatesBefore);
    await pool.end();
    if (restGateway) await new Promise((resolve) => restGateway!.close(resolve));
  }
  const left = await (async () => {
    const check = new Pool({ connectionString: loopbackUrl(), max: 1 });
    try {
      const [row] = (await check.query(`SELECT (SELECT count(*) FROM voice_private.calls WHERE user_id = ANY($1::uuid[]))::int AS calls,
          (SELECT count(*) FROM voice_private.call_exchanges WHERE user_id = ANY($1::uuid[]))::int AS exchanges,
          (SELECT count(*) FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))::int AS recordings,
          (SELECT count(*) FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))::int AS ledger_rows,
          (SELECT count(*) FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[]))::int AS events,
          (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))::int AS users,
          ((SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED') - $2)::int AS gates_enabled_beyond_before`, [humans, gatesEnabledBefore])).rows;
      return row!;
    } finally {
      await check.end();
    }
  })();
  record('S8 teardown: no fixture row left, every voice gate as it was', Object.values(left).every((n) => n === 0), left);
  const passed = Object.values(results).every((r) => r.pass);
  process.stdout.write(`${JSON.stringify({ proof: 'S8B-05 CP2 synthetic spoken turn', passed, results }, null, 1)}\n`);
  process.exitCode = passed ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`S8B05_CP2_PROOF_FAILED ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
