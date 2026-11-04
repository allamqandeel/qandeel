/**
 * S8B-06 CP3 — the device proof's integrated server: the REAL S8B-05 live call (gateway, connection, call authority
 * repository, call turn repository 0190 – 0192, voice media service and track writers, the REAL call turn engine and the
 * REAL LIVE_CALL REALTIME reply service: the one Safety gate, the behavioral policy, the one context assembler) and the
 * REAL `GET /voice/calls/truth` and the REAL Voice Notes controller (`GET /voice/capability`), over a REAL local PostgreSQL carrying migrations through
 * 0192, for a REAL phone (the CP3 proof app) reached through `adb reverse`. It is not CP2's fake gateway.
 *
 * Stand-ins, and only these (as the S8B-05 CP4 proof): the PostgREST hop (pg shims as service_role / the owner), the S3
 * store (in memory), the token check (ONE fixed synthetic bearer, for the ONE synthetic person below), and the three
 * providers as FAKES: a scripted recognizer (each end of an utterance the engine detects is answered with the next
 * numbered synthetic line, so the words committed are the script's, not the person's), a streaming DeepSeek (fixed proof
 * text) and a speech synthesis that answers with a generated tone (so the reply can be HEARD and cut on the phone). The
 * conversation's history and its written-turn route are answered here from the same database, in the API's own shape: the
 * proof stands in for the conversation service, never for the call. F-01 is NOT installed (D-05-02: its voice waits on the
 * Product Owner): a reply that produces nothing closes FAILED in silence. No network, no paid API, no real voice, no
 * transcript of the person: the recognizer never hears words, and nothing is logged but counts and identifiers of THIS
 * synthetic proof.
 *
 * Host-only control routes (`/proof/*`, loopback, no bearer) let the operator read the evidence (the call, its exchanges,
 * its tracks), move THIS fixture call's start so its 60 minutes end soon (T-5 / T-1 / MAX_LENGTH), as the CP4 proof, and
 * set THIS throwaway database's realtime capacity (0 for the CAPACITY_FULL case, then back to the shipped 2).
 *
 * It refuses anything but a loopback database and changes the database it is given (the Voice Gate rows of THAT
 * throwaway database, one synthetic person and Session): run it only on a disposable local clone.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/proof806 PORT=8806 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-06-cp3-device-proof-server.ts
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import {
  Body, Controller, Get, HttpCode, HttpException, Module, Param, Post, Query, UnauthorizedException, UseGuards, type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { accountedDeepSeekStreamingChatCompletions } from '../src/ai-usage/accounted-provider-clients';
import { AiProviderCallAccounting } from '../src/ai-usage/ai-provider-call-accounting';
import { SupabaseAiProviderCallLedger } from '../src/ai-usage/ai-provider-call-ledger.repository';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { SupabaseAuthService } from '../src/auth/supabase-auth.service';
import { BehavioralResponsePolicyService } from '../src/conversation/behavioral-response-policy.service';
import { LiveCallReplyService } from '../src/conversation/live-call-reply.service';
import { SafetyResponseGateService } from '../src/conversation/safety-response-gate.service';
import { DataApiError, type SupabaseDataApiService } from '../src/conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
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
import { VoiceNotesRepository } from '../src/voice-media/voice-notes.repository';
import { VoiceNotesController } from '../src/voice-media/voice-notes.controller';
import { VoiceNotesService } from '../src/voice-media/voice-notes.service';
import { readOggOpus } from '../src/voice/call/codec/ogg-opus';
import { LiveCallGateway } from '../src/voice/call/gateway/live-call.gateway';
import { LiveCallConnection } from '../src/voice/call/live-call.connection';
import { LIVE_CALL_SPEECH_SINK } from '../src/voice/call/live-call-speech.port';
import { LiveCallTruthController } from '../src/voice/call/live-call-truth.controller';
import { LiveCallRepository } from '../src/voice/call/live-call.repository';
import { LiveCallService } from '../src/voice/call/live-call.service';
import { LIVE_CALL_PATH } from '../src/voice/call/live-call.protocol';
import { LIVE_CALL_STORE } from '../src/voice/call/live-call.store';
import type { CallFailureLine } from '../src/voice/call-turn/call-failure-line';
import { CallTurnRepository } from '../src/voice/call-turn/call-turn.repository';
import { LiveCallConversationBinding } from '../src/voice/call-turn/live-call-conversation.port';
import { LiveCallTurnEngine, type CallTurnObservation } from '../src/voice/call-turn/live-call-turn.engine';
import { fakeCallSynthesisRoute } from '../src/voice/call-turn/testing/fake-call-synthesis';
import { FakeCallRecognizer, type FakeCallLine } from '../src/voice/call-turn/testing/fake-call-recognizer';
import type { RealtimeRecognition } from '../src/voice/live-note/live-voice-note.service';
import {
  type SpeechSynthesisAdapter, type SpeechSynthesisRequest, type SpeechSynthesisResult, type SpeechSynthesisSession,
} from '../src/voice/speech-synthesis.adapter';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

/** The ONE synthetic person of the proof and the proof app's matching in-memory identity (s806cp3-proof-world.ts). */
export const PROOF_USER = 'a8060000-0000-4000-8000-0000000000a1';
export const PROOF_SESSION = 'a8060000-0000-4000-8000-000000000003';
export const PROOF_BEARER = 's806cp3-proof-bearer';
const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const DEEPSEEK_ENV = { NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'synthetic-proof-not-a-key' } as NodeJS.ProcessEnv;
const EVENTS = process.env.PROOF_EVENTS_FILE ?? null;

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('S806CP3_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}

/** An evidence line: counts, timings and THIS proof's identifiers only. */
function evidence(kind: string, detail: Record<string, unknown>): void {
  const line = JSON.stringify({ at: Date.now(), kind, ...detail });
  process.stdout.write(`${line}\n`);
  if (EVENTS) appendFileSync(EVENTS, `${line}\n`);
}

/** PostgREST's service_role hop, as a shim (the CP4 proof's): the same function, the same role, the same error identity. */
class PgServiceRoleRpc {
  constructor(private readonly pool: PgPool) {}

  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!/^(?:server_[a-z0-9_]+|begin_ai_provider_call_v[12]|settle_ai_provider_call_v1)$/u.test(name)) throw new Error('S806CP3_PROOF_RPC_NAME');
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

/** PostgREST's owner hop, as a shim: `authenticated` with the owner's claims, RPC only. */
class PgOwnerDataApi {
  constructor(private readonly pool: PgPool) {}

  async request<T>(accessToken: string, path: string, init: { body?: string } = {}): Promise<T> {
    if (accessToken !== PROOF_BEARER) throw new DataApiError(401);
    const name = /^rpc\/([a-z0-9_]+)$/u.exec(path)?.[1];
    if (!name) throw new Error('S806CP3_PROOF_OWNER_PATH');
    const entries = Object.entries(JSON.parse(init.body ?? '{}') as Record<string, unknown>);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: PROOF_USER, role: 'authenticated' })]);
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

/** The synthetic DeepSeek: one fixed proof reply per turn, streamed in three pieces (fixture text, not a model's). */
class SyntheticDeepSeek {
  private k = 0;

  readonly create = async (_body: Record<string, unknown>, options: { signal?: AbortSignal } = {}): Promise<AsyncIterable<Record<string, unknown>>> => {
    this.k += 1;
    const k = this.k;
    const signal = options.signal;
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    });
    const content = (text: string) => ({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
    async function* stream(): AsyncGenerator<Record<string, unknown>> {
      await wait(300);
      yield content(`هذا رد اختباري رقم ${k} من خادم الإثبات.`);
      await wait(120);
      yield content(' الصوت الذي تسمعه نغمة مولدة وليس صوت قنديل،');
      await wait(120);
      yield content(' ويمكنك مقاطعتها بالكلام أو بإرسال رسالة مكتوبة في أي وقت.');
      yield { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
      yield { choices: [], usage: { prompt_tokens: 200, completion_tokens: 40 } };
    }
    return stream();
  };
}

/**
 * The reply's voice in the proof: a generated two-tone signal (PCM 24 kHz, 40 ms chunks), about six seconds per reply,
 * so it can be heard, cut by speech (barge-in) and cut by a sent message (T1) on the real phone. Not a voice.
 */
class ProofToneSynthesis implements SpeechSynthesisAdapter {
  readonly provider = 'GEMINI' as const;
  readonly supportsHints = true;
  private static readonly CHUNKS = 150;

  synthesize(request: SpeechSynthesisRequest): SpeechSynthesisSession {
    let settle!: (result: SpeechSynthesisResult) => void;
    const result = new Promise<SpeechSynthesisResult>((resolve) => { settle = resolve; });
    result.catch(() => undefined);
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    return {
      result,
      chunks: {
        async *[Symbol.asyncIterator]() {
          await sleep(250);
          let produced = 0;
          for (let i = 0; i < ProofToneSynthesis.CHUNKS; i += 1) {
            if (request.signal.aborted) {
              settle({ operation: 'GEMINI_SPEECH_GENERATION', voiceId: request.voiceId, hintApplied: true, usage: { completeness: 'ABSENT' } });
              return;
            }
            if (i > 0) await sleep(10);
            const pcm = Buffer.alloc(1_920);
            const frequency = Math.floor(i / 25) % 2 === 0 ? 392 : 523;
            for (let s = 0; s < 960; s += 1) {
              const t = (i * 960 + s) / 24_000;
              pcm.writeInt16LE(Math.round(5_000 * Math.sin(2 * Math.PI * frequency * t)), s * 2);
            }
            produced += 1;
            yield { sequence: i, audio: pcm, contentType: 'audio/pcm' };
          }
          settle({
            operation: 'GEMINI_SPEECH_GENERATION', voiceId: request.voiceId, hintApplied: true, pcmSampleRate: 24_000,
            usage: { completeness: 'COMPLETE', source: 'PROVIDER_REPORTED', inputTokens: Math.ceil(request.text.length / 4), audioOutputTokens: produced * 25 },
          } as SpeechSynthesisResult);
        },
      },
    };
  }
}

/**
 * Proof instrumentation only: WHICH check of the connection refused the phone (PROTOCOL_VIOLATION / OVERLOADED), as the
 * source line of its caller and the connection's phase. No message content, no audio.
 */
function instrumentRefusals(): void {
  const proto = LiveCallConnection.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const name of ['violation', 'overloaded']) {
    const original = proto[name]!;
    proto[name] = function (this: { phase?: string }, ...args: unknown[]) {
      const caller = (new Error().stack ?? '').split('\n')[2]?.trim().replace(/^at /u, '').replace(/.*[\\/]src[\\/]/u, 'src/') ?? '?';
      evidence('refusal', { check: name, caller, phase: this.phase ?? null });
      return original.apply(this, args);
    };
  }
  // An exception inside a queued handler closes with PROTOCOL_VIOLATION too (reason INTERNAL): every close code is noted.
  const lose = proto.lose!;
  proto.lose = function (this: { phase?: string }, ...args: unknown[]) {
    evidence('connection-lose', { code: args[0] ?? null, reason: args[1] ?? null, phase: this.phase ?? null });
    return lose.apply(this, args);
  };
}

async function main(): Promise<void> {
  instrumentRefusals();
  const pool = new Pool({ connectionString: loopbackUrl(), max: 16 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const asServiceRole = async (text: string, values: unknown[]) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      const result = await client.query(text, values);
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
  const serverApi = new PgServiceRoleRpc(pool) as unknown as SupabaseServiceRoleApiService;
  const ownerApi = new PgOwnerDataApi(pool) as unknown as SupabaseDataApiService;

  // ---------------------------------------------------------------- the synthetic person, the gates of THIS database
  await sql('INSERT INTO auth.users(id) VALUES ($1) ON CONFLICT DO NOTHING', [PROOF_USER]);
  await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT') ON CONFLICT DO NOTHING", [PROOF_SESSION, PROOF_USER]);
  for (const scope of ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE']) {
    await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, 'ENABLED', 'SATISFIED', 's8b-06-cp3-device-proof', 'local synthetic device proof')", [scope]);
  }
  await serverApi.rpc('server_grant_voice_recording_consent_v1', { p_user_id: PROOF_USER, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });

  // ---------------------------------------------------------------- the composition: real services, three fake providers
  const telemetry = new TelemetryService(correlation);
  const accounting = new AiProviderCallAccounting(new SupabaseAiProviderCallLedger(serverApi), telemetry, () => correlation.current());
  const deepseek = new SyntheticDeepSeek();
  const router = new DeepSeekModelRouter(loadDeepSeekLiveCallConfig(DEEPSEEK_ENV), { chat: { completions: { create: async () => { throw new Error('S806CP3_NO_UNARY'); } } } } as never,
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
  // The scripted recognizer: each end of an utterance is the next numbered synthetic line (never the person's words).
  const script: FakeCallLine[] = Array.from({ length: 400 }, (_, i) => ({ text: `جملة اختبارية رقم ${i + 1}` }));
  const recognizer = new FakeCallRecognizer(script, { finalDelayMs: 150 });
  const recognition: RealtimeRecognition = { openStream: (request) => recognizer.openStream(request) };
  const failureLine: CallFailureLine = { ar: [], en: [] };
  const engine = new LiveCallTurnEngine(new CallTurnRepository(serverApi), binding, recognition, fakeCallSynthesisRoute(new ProofToneSynthesis()), telemetry, undefined, failureLine);
  engine.observe((o: CallTurnObservation) => evidence('turn', o as unknown as Record<string, unknown>));
  const objects = new InMemoryPrivateAudioObjectStore();
  const media = new VoiceMediaService(new VoiceMediaRepository(serverApi), objects);
  const notes = new VoiceNotesService(new VoiceNotesRepository(serverApi), serverApi, null as never);
  const notesRepository = new VoiceNotesRepository(serverApi);
  const auth = {
    authenticate: async (authorization: string | undefined) => {
      const token = /^Bearer (.+)$/u.exec(authorization ?? '')?.[1] ?? '';
      if (token !== PROOF_BEARER) throw new UnauthorizedException();
      return { userId: PROOF_USER, accessToken: token };
    },
  };

  // ---------------------------------------------------------------- the conversation stand-in (the API's own shape)
  const exchanges = async (limit: number) => {
    const users = (await sql(`SELECT id, content, idempotency_key, created_at, status FROM public.conversation_turns
        WHERE session_id = $1 AND role = 'USER' ORDER BY created_at DESC, id DESC LIMIT $2`, [PROOF_SESSION, limit + 1]));
    const hasOlder = users.length > limit;
    const page = users.slice(0, limit).reverse();
    const ids = page.map((u) => u.id);
    const replies = ids.length === 0 ? [] : await sql(`SELECT id, content, created_at, source_turn_id FROM public.conversation_turns
        WHERE session_id = $1 AND role = 'ASSISTANT' AND status = 'COMPLETED' AND source_turn_id = ANY($2::uuid[])`, [PROOF_SESSION, ids]);
    const bySource = new Map(replies.map((r) => [String(r.source_turn_id), r]));
    const delivery = replies.length === 0 ? [] : await notesRepository.callReplyDelivery(PROOF_USER, PROOF_SESSION, replies.map((r) => String(r.id)));
    const deliveryOf = new Map(delivery.map((d) => [d.turn_id, d.delivery_state]));
    const iso = (v: unknown) => new Date(String(v)).toISOString();
    return {
      exchanges: page.map((u) => {
        const reply = bySource.get(String(u.id));
        return {
          userTurn: { id: u.id, content: u.content, idempotencyKey: u.idempotency_key, createdAt: iso(u.created_at) },
          replyState: reply ? 'COMPLETED' : u.status === 'FAILED' ? 'FAILED' : 'PENDING',
          assistantTurn: reply ? { id: reply.id, content: reply.content, createdAt: iso(reply.created_at) } : null,
          ...(reply && deliveryOf.has(String(reply.id)) ? { deliveryState: deliveryOf.get(String(reply.id)) } : {}),
        };
      }),
      hasOlder,
    };
  };

  @Controller('conversation/sessions')
  @UseGuards(SupabaseAuthGuard)
  class ProofConversationController {
    @Get(':sessionId/turns')
    async history(@Param('sessionId') sessionId: string, @Query('limit') limit?: string) {
      if (sessionId !== PROOF_SESSION) throw new HttpException('not found', 404);
      const page = await exchanges(Math.min(Number(limit ?? 30) || 30, 100));
      evidence('history', { exchanges: page.exchanges.length });
      return page;
    }

    @Post(':sessionId/turns')
    @HttpCode(201)
    async submit(@Param('sessionId') sessionId: string, @Body() body: { content?: string; idempotencyKey?: string }) {
      if (sessionId !== PROOF_SESSION || typeof body.content !== 'string' || typeof body.idempotencyKey !== 'string') throw new HttpException('bad request', 400);
      // The database's own turn authorities (create as the owner, claim and finalize as service_role); only the reply text
      // is the proof's fixed line (outside a call; inside one the phone writes over the call, D-05-07).
      let user = (await sql("SELECT * FROM public.conversation_turns WHERE session_id = $1 AND idempotency_key = $2 AND role = 'USER'", [PROOF_SESSION, body.idempotencyKey]))[0];
      if (!user) {
        [user] = await ownerApi.request<Array<Record<string, unknown>>>(PROOF_BEARER, 'rpc/create_user_conversation_turn', {
          body: JSON.stringify({ p_id: randomUUID(), p_session_id: PROOF_SESSION, p_content: body.content, p_idempotency_key: body.idempotencyKey }),
        });
      }
      const answered = await sql("SELECT 1 FROM public.conversation_turns WHERE source_turn_id = $1 AND role = 'ASSISTANT'", [user!.id]);
      if (answered.length === 0) {
        await asServiceRole('SELECT * FROM public.claim_conversation_turn($1, $2, $3, $4, $5)', [PROOF_SESSION, PROOF_USER, user!.id, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT']);
        await asServiceRole('SELECT * FROM public.finalize_conversation_turn_v2($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL)',
          [PROOF_SESSION, PROOF_USER, user!.id, randomUUID(), 'رد اختباري مكتوب من خادم الإثبات.', 'ALLOW', randomUUID()]);
        user = (await sql('SELECT * FROM public.conversation_turns WHERE id = $1', [user!.id]))[0];
      }
      const reply = (await sql("SELECT * FROM public.conversation_turns WHERE source_turn_id = $1 AND role = 'ASSISTANT'", [user!.id]))[0];
      evidence('written-turn', { userTurn: user!.id });
      return { userTurn: user, ...(reply ? { assistantTurn: reply } : {}) };
    }
  }

  @Controller('proof')
  class ProofControlController {
    @Get('state')
    async state() {
      const call = (await sql(`SELECT id, state, connection_epoch::int AS epoch, started_at, ended_at, end_reason FROM voice_private.calls
          WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [PROOF_USER]))[0] ?? null;
      if (!call) return { call: null };
      const rows = await sql(`SELECT e.call_turn_index::int AS k, e.delivery_state, e.generation_state, e.heard_mark_ms::int AS heard,
          e.produced_audio_ms::int AS produced, e.close_reason, e.barge_in_capture_ms::int AS barge_in, e.committed_epoch::int AS epoch,
          ct.turn_channel, u.content AS user_text, t.content AS reply_text
          FROM voice_private.call_exchanges e JOIN public.conversation_turns u ON u.id = e.user_turn_id
          JOIN public.conversation_call_turns ct ON ct.turn_id = e.user_turn_id
          LEFT JOIN public.conversation_turns t ON t.id = e.assistant_turn_id
          WHERE e.call_id = $1 ORDER BY e.call_turn_index`, [call.id]);
      const segments = await sql(`SELECT o.track, o.storage_key, o.clock_start_ms::int AS s, o.clock_end_ms::int AS e FROM voice_private.recording_objects o
          JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.call_id = $1 ORDER BY o.track, o.segment_index`, [call.id]);
      const tracks: Record<string, { segments: number; packets: number; clockMs: number }> = {};
      for (const s of segments) {
        const t = (tracks[String(s.track)] ??= { segments: 0, packets: 0, clockMs: 0 });
        const object = objects.objects.get(String(s.storage_key));
        t.segments += 1;
        t.packets += object ? readOggOpus(object.bytes).packets.length : 0;
        t.clockMs += Number(s.e) - Number(s.s);
      }
      const recording = await sql('SELECT recording_state, started_at, retention_expires_at FROM voice_private.recordings WHERE call_id = $1', [call.id]);
      return { call, exchanges: rows, tracks, recording };
    }

    /** THIS throwaway database's realtime capacity (the operator act of 0189), for the CAPACITY_FULL case; 2 is the shipped value. */
    @Post('capacity')
    async capacity(@Query('seats') seats: string) {
      const n = Number(seats);
      if (!Number.isInteger(n) || n < 0 || n > 2) throw new HttpException('seats 0..2', 400);
      await sql("SELECT voice_private.set_live_call_policy_v1($1, 30, 15, 20, 3600, 's8b-06-cp3-device-proof', 'local synthetic device proof: capacity case')", [n]);
      evidence('capacity', { seats: n });
      return { seats: n };
    }

    /** THIS fixture call's start, moved so its 60 minutes end in `seconds` (the CP4 proof's move; no policy changed). */
    @Post('ends-in')
    async endsIn(@Query('seconds') seconds: string) {
      const s = Number(seconds);
      if (!Number.isFinite(s) || s < 5 || s > 600) throw new HttpException('seconds 5..600', 400);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL session_replication_role = 'replica'");
        const moved = await client.query(`UPDATE voice_private.calls SET started_at = clock_timestamp() - interval '3600 seconds' + make_interval(secs => $2)
            WHERE user_id = $1 AND state <> 'ENDED' RETURNING id`, [PROOF_USER, s]);
        await client.query('COMMIT');
        evidence('ends-in', { seconds: s, moved: moved.rows.length });
        return { moved: moved.rows.length };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  @Module({
    controllers: [LiveCallTruthController, VoiceNotesController, ProofConversationController, ProofControlController],
    providers: [
      { provide: SupabaseAuthService, useValue: auth },
      SupabaseAuthGuard,
      { provide: VoiceNotesService, useValue: notes },
      { provide: LIVE_CALL_STORE, useValue: new LiveCallRepository(serverApi) },
      { provide: VoiceMediaService, useValue: media },
      { provide: LIVE_CALL_SPEECH_SINK, useValue: engine },
      LiveCallService,
      LiveCallGateway,
    ],
  })
  class ProofModule {}

  const app: INestApplication = await NestFactory.create(ProofModule, { logger: ['error', 'warn'] });
  const port = Number(process.env.PORT ?? 8806);
  await app.listen(port, '127.0.0.1');
  evidence('listening', { port, ws: `ws://127.0.0.1:${port}${LIVE_CALL_PATH}`, user: PROOF_USER, session: PROOF_SESSION });
  const stop = async () => {
    await app.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((error: unknown) => {
  process.stderr.write(`S806CP3_PROOF_SERVER_FAILED ${(error as Error).message}\n`);
  process.exit(1);
});
