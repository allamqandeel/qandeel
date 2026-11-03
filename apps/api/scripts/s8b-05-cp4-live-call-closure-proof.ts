/**
 * S8B-05 CP4 — the synthetic live call closure proof: barge-in, typed turns in the call, reconnection (the same instance and
 * the other one), F-01, the end of a call during a reply, retrieval / export / erasure, and the injected faults of #38, over
 * TWO instances of the REAL gateway, connection, call authority repository, call turn repository (0190 – 0192), voice media
 * service and track writers, the REAL call turn engine and the REAL LIVE_CALL REALTIME reply service (the one Safety gate,
 * the behavioral policy, the one context assembler, in-call retrieval) with the REAL DeepSeek router, over a REAL local
 * PostgreSQL carrying migrations through 0192. The phone is synthetic: protocol v1 on real WebSockets, real libopus packets
 * of a generated signal, PLAYOUT as it plays, a resume that resends what it still holds.
 *
 * Stand-ins, and only these (as the CP2 proof): the PostgREST hop (pg shims as service_role / the owner), the S3 store (in
 * memory), the token check (fixed synthetic tokens), and the three providers as FAKES (a scripted recognizer whose FINALs
 * carry their stream times, a streaming DeepSeek, a Gemini that answers with Opus-encoded silence). F-01 is played from a
 * TEMPORARY fixture made here of a generated 440 Hz tone, written to a temporary directory and removed: it is not the F-01
 * voice, which is chosen by the Product Owner by listening (D-05-02), and nothing is synthesized or sent anywhere.
 * No network, no paid API, no real person, no real voice.
 *
 * Where a scenario needs time to pass that a proof cannot wait for (the 30 s grace, the call's 60 minutes), the throwaway
 * database's clock columns of THAT fixture call are moved, never a policy: the deploy guard's values stay as shipped.
 *
 * It refuses anything but a loopback database and changes the database it is given (the Voice Gate rows of THAT throwaway
 * database, restored at the end): run it only on a disposable local clone, never on a shared or hosted database.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/proof192 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-cp4-live-call-closure-proof.ts
 */
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { accountedDeepSeekStreamingChatCompletions } from '../src/ai-usage/accounted-provider-clients';
import { AiProviderCallAccounting } from '../src/ai-usage/ai-provider-call-accounting';
import { SupabaseAiProviderCallLedger } from '../src/ai-usage/ai-provider-call-ledger.repository';
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
import { readOggOpus } from '../src/voice/call/codec/ogg-opus';
import { DOWNLINK_OPUS, OpusPacketEncoder, UPLINK_OPUS } from '../src/voice/call/codec/opus-codec';
import { LiveCallGateway } from '../src/voice/call/gateway/live-call.gateway';
import { LIVE_CALL_SPEECH_SINK } from '../src/voice/call/live-call-speech.port';
import { LiveCallRepository } from '../src/voice/call/live-call.repository';
import { LiveCallService } from '../src/voice/call/live-call.service';
import { decodeReplyAudioFrame, encodeAudioFrame, LIVE_CALL_PATH, LIVE_CALL_PROTOCOL } from '../src/voice/call/live-call.protocol';
import { LIVE_CALL_STORE } from '../src/voice/call/live-call.store';
import { syntheticUplinkPackets } from '../src/voice/call/testing/synthetic-voice';
import { callFailureLine, type CallFailureLine } from '../src/voice/call-turn/call-failure-line';
import { callRetrievalTerms } from '../src/voice/call-turn/call-reply';
import { CallTurnRepository } from '../src/voice/call-turn/call-turn.repository';
import { LiveCallConversationBinding } from '../src/voice/call-turn/live-call-conversation.port';
import { LiveCallTurnEngine, type CallTurnObservation } from '../src/voice/call-turn/live-call-turn.engine';
import { FakeCallSynthesis, fakeCallSynthesisRoute } from '../src/voice/call-turn/testing/fake-call-synthesis';
import { FakeCallRecognizer, type FakeCallLine } from '../src/voice/call-turn/testing/fake-call-recognizer';
import { loadSpokenFailureLine } from '../src/voice/failure-line/spoken-failure-line';
import { pcmToWav } from '../src/voice/listen/wav';
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
const DEEPSEEK_ENV = { NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'synthetic-proof-not-a-key' } as NodeJS.ProcessEnv;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loopbackUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('S8B05_CP4_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  return url;
}

/** PostgREST's service_role hop, as a shim (the CP2 proof's): the same function, the same role, the same error identity. */
class PgServiceRoleRpc {
  constructor(private readonly pool: PgPool) {}

  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!/^(?:server_[a-z0-9_]+|begin_ai_provider_call_v[12]|settle_ai_provider_call_v1)$/u.test(name)) throw new Error('S8B05_CP4_PROOF_RPC_NAME');
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
    const userId = TOKENS.get(accessToken);
    if (!userId) throw new DataApiError(401);
    const name = /^rpc\/([a-z0-9_]+)$/u.exec(path)?.[1];
    if (!name) throw new Error('S8B05_CP4_PROOF_OWNER_PATH');
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

/** The synthetic DeepSeek (the CP2 proof's shape): a streamed reply in three pieces, a plan per reply. */
type Plan = 'OK' | 'FAIL' | 'SLOW';
class SyntheticDeepSeek {
  readonly bodies: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  plans: Plan[] = [];
  private k = 0;

  readonly create = async (body: Record<string, unknown>, options: { signal?: AbortSignal } = {}): Promise<AsyncIterable<Record<string, unknown>>> => {
    const k = this.k;
    this.k += 1;
    const plan = this.plans.shift() ?? 'OK';
    const messages = body.messages as Array<{ role: string; content: string }>;
    this.bodies.push({ messages });
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
      await wait(100);
      throw Object.assign(new Error('synthetic provider unavailable'), { status: 503 });
    }
    const content = (text: string) => ({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
    const first = plan === 'SLOW' ? 2_500 : 300;
    async function* stream(): AsyncGenerator<Record<string, unknown>> {
      await wait(first);
      yield content(`أهلًا R${k}a، أنا معك ومتابع كلامك.`);
      await wait(120);
      yield content(` قل لي R${k}b أكثر عن اللي حصل النهارده بالتفصيل،`);
      await wait(120);
      yield content(` وإيه R${k}c أكتر حاجة شاغلاك دلوقتي؟`);
      yield { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
      yield { choices: [], usage: { prompt_tokens: 200, completion_tokens: 40 } };
    }
    return stream();
  };
}

interface ReplyFrame { readonly callTurnIndex: number; readonly chunkSeq: number; readonly epoch: number; readonly packet: Buffer; readonly at: number }
type Msg = Record<string, unknown> & { at: number; conn: number };

/**
 * The synthetic phone: one device across its connections. Its capture clock runs on the wall clock whatever the network
 * does; it keeps the last 2000 ms it captured and, on a resume, resends from the server's durable end. It plays a reply in
 * real time from its first frame, confirming with PLAYOUT; a control message it could not send is resent at the resume.
 */
class SyntheticPhone {
  readonly messages: Msg[] = [];
  readonly frames: ReplyFrame[] = [];
  readonly played: ReplyFrame[] = [];
  /** The frames a PLAYOUT the server received confirmed (sent live, in order): what the QANDEEL track may hold. */
  readonly confirmed: ReplyFrame[] = [];
  readonly sentUplink = new Map<number, Buffer>();
  private ws: WebSocket | null = null;
  private conn = 0;
  private epoch = 0;
  private seq = 0;
  private live = false;
  private resumeFrom: number | null = null;
  private speaking = false;
  private voiced = 0;
  private msgId = 1;
  private stopped = false;
  private loop: Promise<void> = Promise.resolve();
  private t0 = 0;
  private tick = 0;
  /** Control messages not yet sent (the network was down), resent first at the resume (P5). */
  private outbox: object[] = [];
  closedCode: Promise<number> = Promise.resolve(0);

  constructor(private readonly token: string, readonly callId: string, readonly sessionId: string, readonly instanceId: string) {}

  get captureMs(): number {
    return this.tick * 20;
  }

  async connect(url: string, resume: boolean): Promise<Msg> {
    const conn = ++this.conn;
    const ws = new WebSocket(url, { protocols: [LIVE_CALL_PROTOCOL], headers: { authorization: `Bearer ${this.token}` } } as never);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (event) => {
      const at = Date.now();
      if (typeof event.data === 'string') {
        const message = { ...(JSON.parse(event.data) as Record<string, unknown>), at, conn } as Msg;
        this.messages.push(message);
        // A resume's ACTIVE: the new epoch, seq from 0, and what the phone still holds resent from the durable end.
        if (resume && message.type === 'STATE' && message.state === 'ACTIVE' && conn === this.conn) {
          this.epoch = Number(message.epoch);
          this.seq = 0;
          this.resumeFrom = Number(message.resumeFromCaptureMs);
        }
        return;
      }
      const frame = decodeReplyAudioFrame(Buffer.from(event.data as ArrayBuffer));
      if (frame) this.frames.push({ callTurnIndex: frame.callTurnIndex, chunkSeq: frame.chunkSeq, epoch: frame.epoch, packet: Buffer.from(frame.packet), at });
    };
    this.closedCode = new Promise((resolve) => {
      ws.onclose = (event) => resolve(event.code);
    });
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('NOT_OPENED'));
    });
    this.ws = ws;
    ws.send(JSON.stringify({ type: 'HELLO', v: 1, callId: this.callId, sessionId: this.sessionId, clientInstanceId: this.instanceId, resume }));
    if (!resume) {
      const state = await this.waitFor((m) => m.conn === conn && m.state === 'CONNECTING');
      this.epoch = Number(state.epoch);
      this.live = true;
      this.startUplink();
      return state;
    }
    const state = await this.waitFor((m) => m.conn === conn && m.type === 'STATE');
    for (const message of this.outbox.splice(0)) ws.send(JSON.stringify(message));
    return state;
  }

  /** Closes everything (a proof that failed half-way must not hold the servers open). */
  abandon(): void {
    this.stopped = true;
    this.ws?.close();
  }

  /** The network goes: the socket is closed from the phone's side; the capture clock goes on. */
  drop(): void {
    this.live = false;
    this.ws?.close();
    this.ws = null;
  }

  nextMsgId(): number {
    this.msgId += 1;
    return this.msgId;
  }

  send(message: object): void {
    if (this.ws && this.live) this.ws.send(JSON.stringify(message));
    else this.outbox.push(message);
  }

  async waitFor(predicate: (m: Msg) => boolean, ms = 15_000): Promise<Msg> {
    const until = Date.now() + ms;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (Date.now() > until) throw new Error(`MESSAGE_NOT_SEEN after ${this.messages.map((m) => String(m.type) + (m.state ? ':' + String(m.state) : '') + (m.reason ? ':' + String(m.reason) : '')).slice(-8).join(' ')}`);
      await sleep(5);
    }
  }

  private startUplink(): void {
    this.t0 = Date.now();
    this.loop = (async () => {
      for (this.tick = 0; !this.stopped; this.tick += 1) {
        const due = this.t0 + this.tick * 20;
        if (due > Date.now()) await sleep(due - Date.now());
        const captureMs = this.tick * 20;
        const packet = this.speaking ? PACKETS[this.voiced++ % PACKETS.length]! : SILENCE;
        this.sentUplink.set(captureMs, packet);
        this.sentUplink.delete(captureMs - 2_000);
        if (this.resumeFrom !== null && this.ws) {
          // The resume: what it still holds, from the server's durable end, under the new epoch (P5).
          for (let at = this.resumeFrom; at < captureMs; at += 20) {
            const held = this.sentUplink.get(at);
            if (held) this.ws.send(encodeAudioFrame({ epoch: this.epoch, seq: this.seq++, captureMs: at, packet: held }));
          }
          this.resumeFrom = null;
          this.live = true;
        }
        if (this.live && this.ws) {
          this.ws.send(encodeAudioFrame({ epoch: this.epoch, seq: this.seq++, captureMs, packet }));
          if (this.tick % 50 === 49) this.ws.send(JSON.stringify({ type: 'HEARTBEAT', n: this.tick }));
        }
      }
    })();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.loop;
  }

  async say(ms: number): Promise<void> {
    this.speaking = true;
    await sleep(ms);
    this.speaking = false;
  }

  startSpeaking(): void {
    this.speaking = true;
  }

  stopSpeaking(): void {
    this.speaking = false;
  }

  replyEnd(callTurnIndex: number): Msg | undefined {
    return this.messages.find((m) => m.type === 'REPLY_END' && m.callTurnIndex === callTurnIndex);
  }

  /** Plays reply `callTurnIndex` until `limit` frames, its REPLY_END, or `stop()`; confirms every 5 frames and at the end. */
  async play(callTurnIndex: number, limit = Number.POSITIVE_INFINITY, stop: () => boolean = () => false): Promise<number> {
    let j = 0;
    let clock = 0;
    const deadline = Date.now() + 20_000;
    for (;;) {
      if (j >= limit || stop() || Date.now() > deadline) break;
      const frame = this.frames.find((f) => f.callTurnIndex === callTurnIndex && f.chunkSeq === j);
      if (!frame) {
        if (this.replyEnd(callTurnIndex)) break;
        await sleep(5);
        continue;
      }
      clock = Math.max(clock, frame.at) + 20;
      if (clock > Date.now()) await sleep(clock - Date.now());
      if (stop()) break;
      this.played.push(frame);
      const nextHere = this.frames.some((f) => f.callTurnIndex === callTurnIndex && f.chunkSeq === j + 1);
      if (j % 5 === 4 || !nextHere || j + 1 >= limit) {
        if (this.ws && this.live) this.confirmed.push(...this.played.filter((f) => f.callTurnIndex === callTurnIndex && f.chunkSeq <= j && !this.confirmed.includes(f)));
        this.send({ type: 'PLAYOUT', msgId: this.nextMsgId(), callTurnIndex, chunkSeq: j, playedMs: (j + 1) * 20 });
      }
      j += 1;
    }
    return j;
  }
}

/** A temporary F-01 fixture: a generated 440 Hz tone per language (NOT the F-01 voice), pinned by digest, then removed. */
function temporaryToneFailureLine(): { line: CallFailureLine; frames: number; dispose: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 's8b05-cp4-f01-'));
  const tone = (ms: number) => {
    const samples = (DOWNLINK_OPUS.rate * ms) / 1000;
    const pcm = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i += 1) pcm.writeInt16LE(Math.round(6_000 * Math.sin((2 * Math.PI * 440 * i) / DOWNLINK_OPUS.rate)), i * 2);
    return pcmToWav(pcm, DOWNLINK_OPUS.rate);
  };
  const ar = tone(400);
  const en = tone(300);
  writeFileSync(join(dir, 'tone-ar.wav'), ar);
  writeFileSync(join(dir, 'tone-en.wav'), en);
  const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    line: 'F-01', purpose: 'S8B-05 CP4 synthetic proof only: a generated tone, not the F-01 voice', state: 'INSTALLED',
    files: { ar: { file: 'tone-ar.wav', sha256: digest(ar), contentType: 'audio/wav' }, en: { file: 'tone-en.wav', sha256: digest(en), contentType: 'audio/wav' } },
  }));
  const line = callFailureLine(loadSpokenFailureLine(dir));
  if (!line) throw new Error('S8B05_CP4_TONE_NOT_LOADED');
  return { line, frames: line.ar.length, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

async function teardown(pool: PgPool, humans: string[], gates: Array<Record<string, unknown>>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
    const keys = (await client.query(`SELECT storage_key FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans])).rows.map((r) => r.storage_key);
    await client.query('DELETE FROM introduction_sharing_private.media_erasure_queue WHERE storage_key = ANY($1::text[])', [keys]);
    await client.query('DELETE FROM account_erasure_private.media_pending WHERE storage_key = ANY($1::text[])', [keys]);
    await client.query(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
    await client.query(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
    await client.query('DELETE FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[])', [humans]);
    const owned = await client.query(`SELECT table_schema, table_name FROM information_schema.columns
      WHERE column_name = 'user_id' AND table_schema IN ('voice_private', 'public', 'private', 'personal_data_private') AND table_name NOT IN ('users')
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

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 12 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  const serverApi = new PgServiceRoleRpc(pool) as unknown as SupabaseServiceRoleApiService;
  const ownerApi = new PgOwnerDataApi(pool) as unknown as SupabaseDataApiService;
  process.stdout.write('S8B-05 CP4 synthetic live call closure (transport: pg shims (service_role / authenticated), two instances)\n');

  // ---------------------------------------------------------------- the composition: real services, three fake providers
  const telemetry = new TelemetryService(correlation);
  const accounting = new AiProviderCallAccounting(new SupabaseAiProviderCallLedger(serverApi), telemetry, () => correlation.current());
  const deepseek = new SyntheticDeepSeek();
  const router = new DeepSeekModelRouter(loadDeepSeekLiveCallConfig(DEEPSEEK_ENV), { chat: { completions: { create: async () => { throw new Error('S8B05_CP4_NO_UNARY'); } } } } as never,
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
  // The recognizer's script is set per scenario (and may be filled in just before the utterance it answers).
  let script: FakeCallLine[] = [];
  const recognition: RealtimeRecognition = { openStream: (request) => new FakeCallRecognizer(script, { finalDelayMs: 120 }).openStream(request) };
  const synthesis = new FakeCallSynthesis({ firstByteMs: 120, chunkMs: 8 });
  const tone = temporaryToneFailureLine();
  let failureInstalled = false;
  // F-01 as the engines see it: the tone while "installed", nothing otherwise (the NOT_INSTALLED state).
  const failureLine: CallFailureLine = { get ar() { return failureInstalled ? tone.line.ar : []; }, get en() { return failureInstalled ? tone.line.en : []; } };
  const observations: Array<CallTurnObservation & { instance: string }> = [];
  const objects = new InMemoryPrivateAudioObjectStore();
  const auth = {
    authenticate: async (authorization: string | undefined) => {
      const token = /^Bearer (.+)$/u.exec(authorization ?? '')?.[1] ?? '';
      const userId = TOKENS.get(token);
      if (!userId) throw new UnauthorizedException();
      return { userId, accessToken: token };
    },
  };
  const instance = async (name: string): Promise<{ app: INestApplication; url: string }> => {
    const engine = new LiveCallTurnEngine(new CallTurnRepository(serverApi), binding, recognition, fakeCallSynthesisRoute(synthesis), telemetry, undefined, failureLine);
    engine.observe((o) => observations.push({ ...o, instance: name }));
    const media = new VoiceMediaService(new VoiceMediaRepository(serverApi), objects);
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
    class InstanceModule {}
    const app = await NestFactory.create(InstanceModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    return { app, url: `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}${LIVE_CALL_PATH}` };
  };
  const A = await instance('A');
  const B = await instance('B');

  const SCOPES = ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE'];
  const humans: string[] = [];
  const phones: SyntheticPhone[] = [];
  let stepName = 'start';
  const step = (name: string) => {
    stepName = name;
    process.stdout.write(`  step ${name}
`);
  };
  const gatesBefore = await sql('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = ANY($1::text[])', [SCOPES]);
  const gatesEnabledBefore = Number((await sql("SELECT count(*) AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED'"))[0]!.n);
  for (const scope of SCOPES) {
    await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, 'ENABLED', 'SATISFIED', 's8b-05-cp4-proof', 'local synthetic proof')", [scope]);
  }
  const person = async () => {
    const user = randomUUID();
    const session = randomUUID();
    humans.push(user);
    await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    const token = `synthetic-${randomUUID()}`;
    TOKENS.set(token, user);
    await serverApi.rpc('server_grant_voice_recording_consent_v1', { p_user_id: user, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });
    const phone = new SyntheticPhone(token, randomUUID(), session, randomUUID());
    phones.push(phone);
    return { user, session, token, phone };
  };

  const results: Record<string, { pass: boolean; detail: Record<string, unknown> }> = {};
  const record = (name: string, pass: boolean, detail: Record<string, unknown>) => {
    results[name] = { pass, detail };
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name}\n${JSON.stringify(detail)}\n`);
  };
  const exchangesOf = (call: string) => sql(`SELECT e.call_turn_index::int AS k, e.delivery_state, e.generation_state, e.heard_mark_ms::int AS heard,
      e.produced_audio_ms::int AS produced, e.close_reason, e.safety_disposition, e.barge_in_capture_ms::int AS barge_in, e.committed_epoch::int AS epoch,
      e.text_reply_state, ct.turn_channel, u.content AS user_text, t.content AS reply_text, v.anchor_start_ms::int AS anchor_start, v.anchor_end_ms::int AS anchor_end
      FROM voice_private.call_exchanges e JOIN public.conversation_turns u ON u.id = e.user_turn_id
      JOIN public.conversation_call_turns ct ON ct.turn_id = e.user_turn_id
      LEFT JOIN public.conversation_turns t ON t.id = e.assistant_turn_id
      LEFT JOIN public.conversation_turn_voice_sources v ON v.turn_id = e.user_turn_id
      WHERE e.call_id = $1 ORDER BY e.call_turn_index`, [call]);
  /** The fixture call's started_at, moved so that its 60 minutes end in `seconds` (the transition guard bypassed for THIS row only). */
  const moveStartedAt = async (call: string, seconds: number) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query("UPDATE voice_private.calls SET started_at = clock_timestamp() - interval '3600 seconds' + make_interval(secs => $2) WHERE id = $1", [call, seconds]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
  const trackPackets = async (call: string, track: string) => {
    const segments = await sql(`SELECT o.storage_key, o.clock_start_ms::int AS s, o.clock_end_ms::int AS e FROM voice_private.recording_objects o
        JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.call_id = $1 AND o.track = $2 ORDER BY o.segment_index`, [call, track]);
    return segments.flatMap((s) => {
      const object = objects.objects.get(String(s.storage_key));
      return object ? readOggOpus(object.bytes).packets : [Buffer.from('missing')];
    });
  };
  const lastIndex = (phone: SyntheticPhone) => Math.max(0, ...phone.messages.filter((m) => m.type === 'TURN_COMMITTED' && m.role === 'USER').map((m) => Number(m.callTurnIndex)));
  /** One spoken turn: its FINALs set just before it, the utterance, the commit seen. */
  const spoken = async (phone: SyntheticPhone, line: string | FakeCallLine, ms = 900): Promise<number> => {
    const before = lastIndex(phone);
    script.push(typeof line === 'string' ? { text: line } : line);
    await sleep(200);
    await phone.say(ms);
    const committed = await phone.waitFor((m) => m.type === 'TURN_COMMITTED' && m.role === 'USER' && Number(m.callTurnIndex) > before);
    return Number(committed.callTurnIndex);
  };

  try {
    // ============================================================ call 1, instance A: barge-in, a typed turn, reconnects
    const p = await person();
    const phone = p.phone;
    script = [];
    deepseek.plans = [];
    await phone.connect(A.url, false);

    step('X1');
    // X1 — BARGE_IN (P4, §5.2): QANDEEL stops at once; the residual echo before the onset is never the person's; N1 closes
    // the reply INTERRUPTED with only what was heard; the QANDEEL track holds exactly the packets the phone played.
    const k1 = await spoken(phone, 'احكيلي عن يومك النهارده');
    let barged = false;
    const playing1 = phone.play(k1, Number.POSITIVE_INFINITY, () => barged);
    await phone.waitFor((m) => m.type === 'ACK', 10_000).catch(() => null);
    for (const until = Date.now() + 10_000; phone.played.filter((f) => f.callTurnIndex === k1).length < 30 && Date.now() < until;) await sleep(10);
    const onset = phone.captureMs;
    // The phone hears itself over QANDEEL's voice for 100 ms before its detector fires: that is the echo the ASR returns.
    const bargeMsgId = phone.nextMsgId();
    barged = true;
    await playing1;
    phone.send({ type: 'BARGE_IN', msgId: bargeMsgId, callTurnIndex: k1, captureMs: onset });
    const bargeAck = await phone.waitFor((m) => m.type === 'ACK' && m.msgId === bargeMsgId);
    const heardFrames1 = phone.played.filter((f) => f.callTurnIndex === k1).length;
    const k2 = await spoken(phone, [
      { text: 'قل لي أكثر عن اللي حصل', startMs: onset - 100, endMs: onset - 20 },
      { text: 'استنى لحظة خليني أكمل', startMs: onset + 40, endMs: onset + 700 },
    ]);
    const after1 = phone.frames.filter((f) => f.callTurnIndex === k1 && f.at > bargeAck.at).length;
    {
      const rows = await exchangesOf(p.phone.callId);
      const e1 = rows.find((r) => r.k === k1)!;
      const e2 = rows.find((r) => r.k === k2)!;
      const playedMark = heardFrames1 * 20;
      record('X1 BARGE_IN stops QANDEEL at once; the echo before the onset is left out; N1 closes the reply INTERRUPTED with what was heard',
        after1 === 0 && e1.barge_in === onset && e1.delivery_state === 'INTERRUPTED' && e1.close_reason === 'NEXT_TURN'
        && Number(e1.heard) <= playedMark && String(e1.reply_text).includes(`R0a`) && !String(e1.reply_text).includes('R0c')
        && e2.user_text === 'استنى لحظة خليني أكمل' && Number(e2.anchor_start) >= onset - 20
        && observations.some((o) => o.kind === 'ECHO_EXCLUDED') && phone.replyEnd(k1)?.deliveryState === 'INTERRUPTED',
        { replyFramesAfterTheAck: after1, bargeInRecorded: e1.barge_in === onset, delivery: e1.delivery_state, heardMs: e1.heard, playedMs: playedMark,
          heardTextHasOnlyTheFirstPieces: !String(e1.reply_text).includes('R0c'), nextTurnIsThePersonsWordsOnly: e2.user_text === 'استنى لحظة خليني أكمل',
          nextAnchorFromTheOnset: Number(e2.anchor_start) >= onset - 20, echoExcludedObserved: observations.some((o) => o.kind === 'ECHO_EXCLUDED'),
          phoneReplyEnd: phone.replyEnd(k1)?.deliveryState ?? null, closeReason: e1.close_reason, heardTextHasTheFirstPiece: String(e1.reply_text).includes('R0a') });
    }

    step('X2');
    // X2 — TEXT_TURN while QANDEEL speaks (#40, D-05-07): QANDEEL stops, the typed turn commits once by its clientTurnId (a
    // resend is ACKed, nothing twice), it is answered in text; the REST text path is refused during the call (0131 race).
    let stopped2 = false;
    const playing2 = phone.play(k2, Number.POSITIVE_INFINITY, () => stopped2);
    for (const until = Date.now() + 10_000; phone.played.filter((f) => f.callTurnIndex === k2).length < 8 && Date.now() < until;) await sleep(10);
    stopped2 = true;
    await playing2;
    const clientTurnId = randomUUID();
    const typed = 'وبعدين المدير طلب مني تقرير جديد قبل الخميس';
    const textMsg = phone.nextMsgId();
    phone.send({ type: 'TEXT_TURN', msgId: textMsg, clientTurnId, text: typed });
    const textAck = await phone.waitFor((m) => m.type === 'ACK' && m.msgId === textMsg);
    const resendMsg = phone.nextMsgId();
    phone.send({ type: 'TEXT_TURN', msgId: resendMsg, clientTurnId, text: typed });
    await phone.waitFor((m) => m.type === 'ACK' && m.msgId === resendMsg);
    const userCommitted = await phone.waitFor((m) => m.type === 'TURN_COMMITTED' && m.role === 'USER' && m.clientTurnId === clientTurnId);
    const k3 = Number(userCommitted.callTurnIndex);
    const textEnd = await phone.waitFor((m) => m.type === 'REPLY_END' && m.callTurnIndex === k3);
    const assistant = phone.messages.find((m) => m.type === 'TURN_COMMITTED' && m.role === 'ASSISTANT' && m.callTurnIndex === k3);
    const restRefused = await sql(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, content, status) VALUES ($1, $2, $3, 'USER', 'نص', 'RECEIVED')`,
      [randomUUID(), p.session, p.user]).then(() => 'INSERTED', (e: { code?: string }) => e.code ?? 'ERROR');
    {
      const rows = await exchangesOf(phone.callId);
      const e2 = rows.find((r) => r.k === k2)!;
      const e3 = rows.find((r) => r.k === k3)!;
      const after2 = phone.frames.filter((f) => f.callTurnIndex === k2 && f.at > textAck.at).length;
      const typedCommits = rows.filter((r) => r.user_text === typed).length;
      record('X2 TEXT_TURN during QANDEEL\'s voice: stopped (INTERRUPTED), committed once by its clientTurnId, answered in text; the REST path refused in the call',
        after2 === 0 && e2.delivery_state === 'INTERRUPTED' && typedCommits === 1 && e3.turn_channel === 'TEXT' && e3.close_reason === 'TEXT_REPLIED'
        && e3.delivery_state === 'COMPLETE' && String(e3.reply_text).length > 0 && assistant !== undefined && Number(textEnd.chunks) === 0
        && phone.frames.every((f) => f.callTurnIndex !== k3) && restRefused === '55000',
        { replyFramesAfterTheAck: after2, spokenReplyDelivery: e2.delivery_state, typedCommits, typedChannel: e3.turn_channel, typedClose: e3.close_reason,
          typedDelivery: e3.delivery_state, assistantAnnounced: assistant !== undefined, replyEndChunks: textEnd.chunks, restTextTurnDuringTheCall: restRefused });
    }

    step('X3');
    // X3 — reconnect on the SAME instance while QANDEEL speaks and the person is speaking (P5): the connection drains (the
    // words said so far are one committed turn), the phone resumes inside the grace, resends its audio and its unsent
    // control messages; the next turn closes the exchange; no word lost, no duplicate, no reply audio after the drop.
    const k4 = await spoken(phone, 'وأنا لسه ما خلصتش التقرير القديم أصلا');
    let stopped4 = false;
    const playing4 = phone.play(k4, Number.POSITIVE_INFINITY, () => stopped4);
    for (const until = Date.now() + 10_000; phone.played.filter((f) => f.callTurnIndex === k4).length < 6 && Date.now() < until;) await sleep(10);
    // The person speaks over QANDEEL (no barge-in detected: the phone simply stops playing when the network goes).
    stopped4 = true;
    await playing4;
    script.push({ text: 'وكمان عندي موضوع الإيجار' });
    phone.startSpeaking();
    await sleep(700);
    const droppedAt = Date.now();
    const lastPlayout = { type: 'PLAYOUT', msgId: phone.nextMsgId(), callTurnIndex: k4, chunkSeq: phone.played.filter((f) => f.callTurnIndex === k4).length - 1,
      playedMs: phone.played.filter((f) => f.callTurnIndex === k4).length * 20 };
    phone.drop();
    phone.stopSpeaking();
    phone.send(lastPlayout); // not sent: the network is down; resent first at the resume
    await sleep(1_500);
    const resumed = await phone.connect(A.url, true);
    const resumedAt = Date.now();
    await phone.waitFor((m) => m.type === 'ACK' && m.msgId === lastPlayout.msgId).catch(() => null);
    const k6 = await spoken(phone, 'المهم إني محتاج أرتب أولوياتي');
    {
      const rows = await exchangesOf(phone.callId);
      const drained = rows.filter((r) => r.user_text === 'وكمان عندي موضوع الإيجار');
      const e4 = rows.find((r) => r.k === k4)!;
      const gaps = await sql(`SELECT g.gap_kind, g.clock_start_ms::int AS s, g.clock_end_ms::int AS e FROM voice_private.recording_gaps g
          JOIN voice_private.recordings r ON r.id = g.recording_id WHERE r.call_id = $1 AND g.track = 'USER'`, [phone.callId]);
      const framesAfterDrop = phone.frames.filter((f) => f.callTurnIndex === k4 && f.at > droppedAt).length;
      const indexes = rows.map((r) => r.k);
      record('X3 a drop on the same instance mid-reply and mid-utterance: drained (one turn, every word), resumed inside 30 s, no duplicate, the exchange closed',
        resumed.state === 'ACTIVE' && Number(resumed.epoch) === 2 && drained.length === 1 && e4.delivery_state === 'INTERRUPTED' && framesAfterDrop === 0
        && new Set(indexes).size === indexes.length && indexes.every((k, i) => k === i + 1) && rows.find((r) => r.k === k6)?.epoch === 2
        && gaps.every((g) => g.gap_kind === 'RECONNECTION') && resumedAt - droppedAt < 30_000 && observations.some((o) => o.kind === 'DRAINED' && o.instance === 'A'),
        { resumedEpoch: resumed.epoch, resumeFromCaptureMs: resumed.resumeFromCaptureMs, drainedTurns: drained.length, drainedTurnEpoch: drained[0]?.epoch,
          interruptedReply: e4.delivery_state, replyFramesAfterTheDrop: framesAfterDrop, callTurnIndexes: indexes,
          gaps: gaps.map((g) => g.gap_kind), resumeWithinMs: resumedAt - droppedAt });
    }

    step('X4');
    // X4 — a drop during generation, resumed on the OTHER instance (P5 across instances): A's reply never reaches the phone
    // again; B settles the exchange it inherits and closes it by N1; an old epoch is never accepted again.
    deepseek.plans.push('SLOW');
    const k7 = await spoken(phone, 'صاحب الشقة عايز يزود الإيجار');
    await sleep(400);
    const dropped2 = Date.now();
    phone.drop();
    await sleep(1_000);
    const resumedB = await phone.connect(B.url, true);
    const k8 = await spoken(phone, 'طيب نرجع للشغل تاني');
    const playing8 = phone.play(k8);
    await phone.waitFor((m) => m.type === 'REPLY_END' && m.callTurnIndex === k8, 20_000).catch(() => null);
    await playing8;
    const stale = await serverApi.rpc<Array<{ outcome: string }>>('server_commit_live_call_turn_v1', {
      p_user_id: p.user, p_call_id: phone.callId, p_connection_epoch: 2, p_turn_id: randomUUID(), p_commit_id: randomUUID(), p_turn_channel: 'TEXT',
      p_content: 'قديم', p_asr_confidence_band: null, p_anchor_start_ms: null, p_anchor_end_ms: null, p_retrieval_terms: [],
      p_close_assistant_turn_id: randomUUID(), p_close_event_id: randomUUID(),
    }).then((rows) => rows[0]!.outcome, () => 'ERROR');
    {
      const rows = await exchangesOf(phone.callId);
      const e7 = rows.find((r) => r.k === k7)!;
      const e8 = rows.find((r) => r.k === k8)!;
      const lateFrames = phone.frames.filter((f) => f.callTurnIndex === k7 && f.at > dropped2).length;
      record('X4 a drop during generation, resumed on the other instance: the inherited exchange settled and closed by N1, no late audio, an old epoch FENCED',
        resumedB.state === 'ACTIVE' && Number(resumedB.epoch) === 3 && e7.delivery_state === 'INTERRUPTED' && e7.safety_disposition !== null
        && lateFrames === 0 && e8.epoch === 3 && e8.delivery_state === 'COMPLETE' && stale === 'FENCED',
        { resumedEpoch: resumedB.epoch, inheritedDelivery: e7.delivery_state, inheritedSafetyStored: e7.safety_disposition !== null, lateReplyFrames: lateFrames,
          nextTurnEpoch: e8.epoch, nextDelivery: e8.delivery_state, staleEpochCommit: stale });
    }

    step('X5');
    // X5 — injected faults (#38): a PLAYOUT after the close, a repeated PLAYOUT, a BARGE_IN for a closed reply: each ACKed,
    // nothing changed (P3); a BARGE_IN lost with the network and resent at the resume inside the grace is applied once.
    {
      const before = await exchangesOf(phone.callId);
      const late = phone.nextMsgId();
      phone.send({ type: 'PLAYOUT', msgId: late, callTurnIndex: k1, chunkSeq: 0, playedMs: 20 });
      await phone.waitFor((m) => m.type === 'ACK' && m.msgId === late);
      phone.send({ type: 'PLAYOUT', msgId: late, callTurnIndex: k1, chunkSeq: 0, playedMs: 20 });
      const lateBarge = phone.nextMsgId();
      phone.send({ type: 'BARGE_IN', msgId: lateBarge, callTurnIndex: k1, captureMs: onset + 400 });
      await phone.waitFor((m) => m.type === 'ACK' && m.msgId === lateBarge);
      const k9 = await spoken(phone, 'التقرير لازم يتسلم يوم الخميس');
      let stop9 = false;
      const playing9 = phone.play(k9, Number.POSITIVE_INFINITY, () => stop9);
      for (const until = Date.now() + 10_000; phone.played.filter((f) => f.callTurnIndex === k9).length < 5 && Date.now() < until;) await sleep(10);
      stop9 = true;
      await playing9;
      const lostOnset = phone.captureMs;
      phone.drop();
      phone.send({ type: 'BARGE_IN', msgId: phone.nextMsgId(), callTurnIndex: k9, captureMs: lostOnset });
      await sleep(800);
      await phone.connect(B.url, true);
      await sleep(300);
      const k10 = await spoken(phone, 'شكرا كده تمام');
      const after = await exchangesOf(phone.callId);
      const e1Before = before.find((r) => r.k === k1)!;
      const e1After = after.find((r) => r.k === k1)!;
      const e9 = after.find((r) => r.k === k9)!;
      const [late1] = await sql('SELECT late_rejections::int AS n FROM voice_private.call_exchanges WHERE call_id = $1 AND call_turn_index = $2', [phone.callId, k1]);
      record('X5 injected faults: late / repeated PLAYOUT and a late BARGE_IN change nothing (counted); a BARGE_IN lost with the network, resent at the resume, applied once',
        e1After.heard === e1Before.heard && e1After.barge_in === e1Before.barge_in && Number(late1!.n) >= 1 && e9.barge_in === lostOnset
        && e9.delivery_state === 'INTERRUPTED' && after.find((r) => r.k === k10) !== undefined,
        { heardUnchanged: e1After.heard === e1Before.heard, onsetUnchanged: e1After.barge_in === e1Before.barge_in, lateRejectionsCounted: late1!.n,
          resentBargeInApplied: e9.barge_in === lostOnset, resentDelivery: e9.delivery_state });
    }

    step('X6');
    // X6 — the call ends at its maximum length during a reply (D-05-06): what was said is committed, the reply closes
    // CALL_ENDING with what was heard, the recording is sealed, every ledger row settled. (The fixture call's started_at is
    // moved back so the 60 minutes end now; the policy stays 3600 s.)
    {
      const k11 = await spoken(phone, 'فاكر رقم التذكرة اللي قلتلك عليه');
      let stop11 = false;
      const playing11 = phone.play(k11, Number.POSITIVE_INFINITY, () => stop11);
      for (const until = Date.now() + 10_000; phone.played.filter((f) => f.callTurnIndex === k11).length < 4 && Date.now() < until;) await sleep(10);
      // The phone's player stalls (its buffer, say): the reply is still open, unheard beyond this point, when the end comes.
      stop11 = true;
      await playing11;
      await moveStartedAt(phone.callId, 3);
      const ended = await phone.waitFor((m) => m.type === 'STATE' && m.state === 'ENDED', 15_000).catch(() => null);
      await phone.stop();
      await phone.closedCode;
      for (let i = 0; i < 100; i += 1) {
        const pending = Number((await sql("SELECT count(*) AS n FROM public.ai_provider_calls WHERE user_id = $1 AND call_state = 'PENDING'", [p.user]))[0]!.n);
        if (pending === 0) break;
        await sleep(50);
      }
      const rows = await exchangesOf(phone.callId);
      const e11 = rows.find((r) => r.k === k11)!;
      const [rec] = await sql('SELECT recording_state FROM voice_private.recordings WHERE call_id = $1', [phone.callId]);
      const [call] = await sql('SELECT state, end_reason FROM voice_private.calls WHERE id = $1', [phone.callId]);
      const pending = Number((await sql("SELECT count(*) AS n FROM public.ai_provider_calls WHERE user_id = $1 AND call_state = 'PENDING'", [p.user]))[0]!.n);
      const qandeel = await trackPackets(phone.callId, 'QANDEEL');
      // Heard = recorded (#10): the QANDEEL track is exactly the frames the phone confirmed live, in order, byte for byte (a
      // frame played but never confirmed, and a confirmation resent to a connection that never had that audio, are not).
      const played = phone.confirmed;
      const heardIsRecorded = qandeel.length === played.length && qandeel.every((packet, i) => packet.equals(played[i]!.packet));
      // Every reconnection's hole was within what the phone holds (2000 ms): the USER track is whole, one packet per 20 ms.
      const userPackets = (await trackPackets(phone.callId, 'USER')).length;
      const [userEnd] = await sql(`SELECT max(o.clock_end_ms)::int AS e, count(*) FILTER (WHERE o.object_state <> 'STORED')::int AS not_stored FROM voice_private.recording_objects o
          JOIN voice_private.recordings r ON r.id = o.recording_id WHERE r.call_id = $1 AND o.track = 'USER'`, [phone.callId]);
      const userGaps = Number((await sql(`SELECT count(*)::int AS n FROM voice_private.recording_gaps g JOIN voice_private.recordings r ON r.id = g.recording_id
          WHERE r.call_id = $1 AND g.track = 'USER'`, [phone.callId]))[0]!.n);
      const userWhole = userGaps === 0 && userPackets * 20 === Number(userEnd!.e) && Number(userEnd!.not_stored) === 0;
      record('X6 the 60 minutes end during a reply: SERVER_ENDED, the reply closed CALL_ENDING with what was heard, sealed, nothing PENDING, heard = recorded',
        ended?.endReason === 'SERVER_ENDED' && call!.state === 'ENDED' && e11.close_reason === 'CALL_ENDING' && e11.delivery_state === 'INTERRUPTED'
        && rows.every((r) => r.close_reason !== null) && rec!.recording_state === 'STORED' && pending === 0 && heardIsRecorded && userWhole,
        { endReason: ended?.endReason ?? null, lastReplyClose: e11.close_reason, lastDelivery: e11.delivery_state, everyExchangeClosed: rows.every((r) => r.close_reason !== null),
          recording: rec!.recording_state, pendingLedgerRows: pending, qandeelPacketsStored: qandeel.length, packetsConfirmed: played.length, packetsPlayed: phone.played.length, heardIsRecorded,
          userTrack: { packets: userPackets, endMs: userEnd!.e, gaps: userGaps, whole: userWhole } });
    }

    step('X7');
    // X7 — the whole call in order: every call turn once, 1..n, the channels as spoken / typed, the context of the reply
    // after the typed turn carrying it and its text reply; retrieval finds the typed turn; the export carries TEXT_REPLIED.
    {
      const rows = await exchangesOf(phone.callId);
      const typedIndex = rows.find((r) => r.turn_channel === 'TEXT')!.k;
      const nextBody = deepseek.bodies.find((b) => b.messages.some((m) => m.role === 'user' && m.content.includes('وأنا لسه ما خلصتش')));
      const carried = nextBody !== undefined && nextBody.messages.some((m) => m.role === 'user' && m.content.includes(typed))
        && nextBody.messages.some((m) => m.role === 'assistant' && m.content === String(rows.find((r) => r.k === typedIndex)!.reply_text));
      const retrieval = await ownerApi.request<Array<{ call_turn_index: number }>>(p.token, 'rpc/call_turn_retrieval_v1', {
        method: 'POST', body: JSON.stringify({ p_call_id: phone.callId, p_terms: callRetrievalTerms(typed), p_recall_cue: true, p_before_index: 100 }),
      } as never).catch(() => []);
      const [{ doc }] = await sql('SELECT personal_data_private.build_personal_export_v1($1) AS doc', [p.user]) as Array<{ doc: unknown }>;
      const exported = JSON.stringify(doc);
      record('X7 one order: every call turn once (1..n), spoken and typed in place; the next reply\'s context carries the typed turn and its reply; retrieval; export',
        rows.every((r, i) => r.k === i + 1) && carried && retrieval.some((r) => Number(r.call_turn_index) === typedIndex)
        && exported.includes('"deliveryState"'),
        { turns: rows.length, channels: rows.map((r) => r.turn_channel), contextCarriesTheTypedExchange: carried,
          retrievalFindsTheTypedTurn: retrieval.some((r) => Number(r.call_turn_index) === typedIndex), retrievalRows: retrieval.length });
    }

    // ============================================================ call 2, instance B: F-01 (installed, then not installed)
    step('X8');
    // X8 — a reply that produced nothing plays F-01 (here the generated tone), heard on the QANDEEL track, never reply
    // speech (FAILED, heard 0, no text); without the files nothing is played and it closes FAILED with no chunk.
    {
      const q = await person();
      script = [];
      failureInstalled = true;
      deepseek.plans.push('FAIL');
      await q.phone.connect(B.url, false);
      const f1 = await spoken(q.phone, 'مرحبا يا قنديل');
      const played1 = await q.phone.play(f1);
      const end1 = await q.phone.waitFor((m) => m.type === 'REPLY_END' && m.callTurnIndex === f1);
      failureInstalled = false;
      deepseek.plans.push('FAIL');
      const f2 = await spoken(q.phone, 'أنا هنا');
      const end2 = await q.phone.waitFor((m) => m.type === 'REPLY_END' && m.callTurnIndex === f2);
      await sleep(300);
      await q.phone.stop();
      q.phone.send({ type: 'END', msgId: q.phone.nextMsgId() });
      await q.phone.waitFor((m) => m.type === 'STATE' && m.state === 'ENDED');
      await q.phone.closedCode;
      const rows = await exchangesOf(q.phone.callId);
      const qandeel = await trackPackets(q.phone.callId, 'QANDEEL');
      const toneRecorded = qandeel.length === played1 && qandeel.every((packet, i) => packet.equals(tone.line.ar[i]!));
      record('X8 F-01: played when nothing was produced (heard on the QANDEEL track, FAILED, heard 0); not installed: nothing played, FAILED, no chunk',
        Number(end1.chunks) === tone.frames && end1.deliveryState === 'FAILED' && played1 === tone.frames && toneRecorded
        && rows[0]!.delivery_state === 'FAILED' && rows[0]!.heard === 0 && Number(end2.chunks) === 0 && end2.deliveryState === 'FAILED'
        && q.phone.frames.every((f) => f.callTurnIndex !== f2),
        { f01Chunks: end1.chunks, f01Played: played1, f01OnTheQandeelTrack: toneRecorded, firstDelivery: rows[0]!.delivery_state, firstHeardMs: rows[0]!.heard,
          notInstalledChunks: end2.chunks, notInstalledDelivery: end2.deliveryState });

      step('X9');
    // X9 — deletion: the account erasure removes the call's exchanges (with their barge-in onsets and text replies), its
      // turns and its recording rows; the export of an erased person holds nothing of the call.
      const [del] = await sql(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
          VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [p.user]);
      const [erased] = await sql('SELECT public.server_erase_account_v1($1) AS outcome', [del!.id]);
      const [left] = await sql(`SELECT (SELECT count(*) FROM voice_private.call_exchanges WHERE user_id = $1)::int AS exchanges,
          (SELECT count(*) FROM public.conversation_call_turns WHERE user_id = $1)::int AS call_turns,
          (SELECT count(*) FROM voice_private.recordings WHERE user_id = $1)::int AS recordings`, [p.user]);
      record('X9 the account erasure removes every row of the call (exchanges with their onsets and text replies, call turns, recordings)',
        erased!.outcome === 'ERASED' && Object.values(left!).every((n) => n === 0), { erasure: erased!.outcome, left });
    }
  } catch (error) {
    process.stdout.write(`FAIL at step ${stepName}: ${error instanceof Error ? error.message : String(error)}
`);
    results[`step ${stepName}`] = { pass: false, detail: {} };
  } finally {
    for (const phone of phones) phone.abandon();
    tone.dispose();
    await A.app.close();
    await B.app.close();
    await teardown(pool, humans, gatesBefore);
    await pool.end();
  }
  const check = new Pool({ connectionString: loopbackUrl(), max: 1 });
  try {
    const [left] = (await check.query(`SELECT (SELECT count(*) FROM voice_private.calls WHERE user_id = ANY($1::uuid[]))::int AS calls,
        (SELECT count(*) FROM voice_private.call_exchanges WHERE user_id = ANY($1::uuid[]))::int AS exchanges,
        (SELECT count(*) FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))::int AS recordings,
        (SELECT count(*) FROM public.conversation_call_turns WHERE user_id = ANY($1::uuid[]))::int AS call_turns,
        (SELECT count(*) FROM public.runtime_event_outbox WHERE subject_user_id = ANY($1::uuid[]))::int AS outbox_events,
        (SELECT count(*) FROM public.ai_provider_calls WHERE user_id = ANY($1::uuid[]))::int AS ledger_rows,
        (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))::int AS users,
        ((SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED') - $2)::int AS gates_enabled_beyond_before`, [humans, gatesEnabledBefore])).rows;
    record('X10 teardown: no fixture row left, every voice gate as it was', Object.values(left!).every((n) => n === 0), left!);
  } finally {
    await check.end();
  }
  const passed = Object.values(results).every((r) => r.pass);
  process.stdout.write(`${JSON.stringify({ proof: 'S8B-05 CP4 synthetic live call closure', passed, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.pass])) })}\n`);
  process.exitCode = passed ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`S8B05_CP4_PROOF_FAILED ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
