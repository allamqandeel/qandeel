/**
 * S8B-05 CP1 — the synthetic live-call proof: the REAL gateway, connection, call authority repository, voice media
 * service and USER track writer, over a REAL local PostgreSQL carrying migrations through 0189, driven by a synthetic
 * client that speaks protocol v1 over a real WebSocket with real libopus packets of a synthetic signal.
 *
 * Stand-ins, and only these: the PostgREST hop, unless POSTGREST_URL and POSTGREST_JWT_SECRET are set (the CI PostgREST
 * loop: then every repository call goes over the WIRE through the real engine and the real SupabaseServiceRoleApiService;
 * otherwise a pg shim calls the same `public.server_*` definers as service_role, with PostgREST's error identity), the S3 object store (the repository's own in-memory store with the adapter's exact
 * contract) and the Supabase token check (a fixed synthetic token; real authentication is proven by the gateway e2e spec).
 * No provider, no paid API, no real person, no real voice: the humans are random UUIDs and the audio is generated.
 *
 * It refuses anything but a loopback database, and it changes the database it is given (the Voice Gate rows and the call
 * policy of THAT throwaway database): run it only on a disposable local clone, never on a shared or hosted database.
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/proof189 \
 *     node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json apps/api/scripts/s8b-05-live-call-synthetic-proof.ts
 */
import 'reflect-metadata';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Module, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SupabaseAuthService } from '../src/auth/supabase-auth.service';
import { DataApiError } from '../src/conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import { InMemoryPrivateAudioObjectStore } from '../src/voice-media/private-audio-object.store';
import { VoiceMediaRepository } from '../src/voice-media/voice-media.repository';
import { VoiceMediaService } from '../src/voice-media/voice-media.service';
import { readOggOpus } from '../src/voice/call/codec/ogg-opus';
import { OpusPacketDecoder } from '../src/voice/call/codec/opus-codec';
import { LiveCallGateway } from '../src/voice/call/gateway/live-call.gateway';
import { LIVE_CALL_SPEECH_SINK, NULL_LIVE_CALL_SPEECH_SINK } from '../src/voice/call/live-call-speech.port';
import { LiveCallRepository } from '../src/voice/call/live-call.repository';
import { LiveCallService } from '../src/voice/call/live-call.service';
import { encodeAudioFrame, LIVE_CALL_PATH, LIVE_CALL_PROTOCOL } from '../src/voice/call/live-call.protocol';
import { LIVE_CALL_STORE } from '../src/voice/call/live-call.store';
import { syntheticUplinkPackets } from '../src/voice/call/testing/synthetic-voice';
import { LiveVoiceNoteRepository } from '../src/voice/live-note/live-voice-note.repository';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: { connectionString: string; max: number }) => PgPool };
interface PgClient { query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; release(): void }
interface PgPool { connect(): Promise<PgClient>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; end(): Promise<void> }

const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
const TOKENS = new Map<string, string>();
const PACKETS = syntheticUplinkPackets(700);

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
    throw new Error('S8B05_PROOF_REFUSED: DATABASE_URL must name a loopback throwaway database');
  }
  return url;
}

/** PostgREST's service_role hop, as a shim: the same definer, the same role, JSON values, the same error identity. */
class PgServiceRoleRpc {
  constructor(private readonly pool: PgPool) {}

  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!/^server_[a-z0-9_]+$/u.test(name)) throw new Error('S8B05_PROOF_RPC_NAME');
    const entries = Object.entries(body);
    const args = entries.map(([key], i) => `${key} => $${i + 1}`).join(', ');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
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

function serviceRoleJwt(): string {
  const b64 = (value: string) => Buffer.from(value).toString('base64url');
  const unsigned = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 1800 }))}`;
  return `${unsigned}.${createHmac('sha256', POSTGREST_SECRET!).update(unsigned).digest('base64url')}`;
}

/** The Supabase gateway's shape, minimally: `/rest/v1/*` to PostgREST (as prove-0187 does). */
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

interface Results { [scenario: string]: { pass: boolean; detail: Record<string, unknown> } }

class SyntheticPhone {
  readonly messages: Array<Record<string, unknown>> = [];
  readonly closed: Promise<number>;
  private readonly ws: WebSocket;

  constructor(url: string, token: string) {
    this.ws = new WebSocket(url, { protocols: [LIVE_CALL_PROTOCOL], headers: { authorization: `Bearer ${token}` } } as never);
    this.ws.onmessage = (event) => void this.messages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
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

  drop(): void {
    this.ws.close();
  }

  async waitFor(predicate: (m: Record<string, unknown>) => boolean, ms = 8000): Promise<Record<string, unknown>> {
    const until = Date.now() + ms;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (Date.now() > until) throw new Error('MESSAGE_NOT_SEEN');
      await sleep(10);
    }
  }

  /** Packets paced a little faster than real time (12 ms), seq and capture clock as a phone keeps them. */
  async speak(epoch: number, count: number, seq0: number, capture0: number, offset = 0): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      this.send(encodeAudioFrame({ epoch, seq: seq0 + i, captureMs: capture0 + i * 20, packet: PACKETS[(offset + i) % PACKETS.length]! }));
      if (i % 50 === 49) this.send({ type: 'HEARTBEAT', n: i });
      await sleep(12);
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Leaves the database as it was: the fixture humans and every row they own (the recordings' children first), the gates and
 * the call policy restored to their snapshot (the events this proof appended removed). Under the replica role, like the
 * verifiers' own teardowns: the guards that keep these rows immutable for the product are not the proof's to satisfy.
 */
async function teardown(pool: PgPool, humans: string[], gates: Array<Record<string, unknown>>, policy: Record<string, unknown>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const recordings = 'SELECT id FROM voice_private.recordings WHERE user_id = ANY($1::uuid[])';
    await client.query(`DELETE FROM voice_private.recording_gaps WHERE recording_id IN (${recordings})`, [humans]);
    await client.query(`DELETE FROM voice_private.recording_objects WHERE recording_id IN (${recordings})`, [humans]);
    const owned = await client.query(`SELECT table_schema, table_name FROM information_schema.columns
      WHERE column_name = 'user_id' AND table_schema IN ('voice_private', 'public', 'private') AND table_name NOT IN ('users')
        AND table_name IN (SELECT table_name FROM information_schema.tables t WHERE t.table_schema = columns.table_schema AND t.table_type = 'BASE TABLE')`);
    // Children before parents: repeat until nothing more goes (no FK is checked under the replica role, so one pass suffices).
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
    await client.query(`UPDATE voice_private.live_call_policy SET realtime_session_capacity = $1, reconnect_grace_seconds = $2, connect_timeout_seconds = $3,
        seat_lease_seconds = $4, max_call_seconds = $5, policy_version = $6, decided_by = $7, policy_basis = $8, decided_at = $9`,
    [policy.realtime_session_capacity, policy.reconnect_grace_seconds, policy.connect_timeout_seconds, policy.seat_lease_seconds,
      policy.max_call_seconds, policy.policy_version, policy.decided_by, policy.policy_basis, policy.decided_at]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loopbackUrl(), max: 10 });
  const sql = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
  let restGateway: Server | null = null;
  let shim: SupabaseServiceRoleApiService;
  if (WIRE) {
    restGateway = await startRestGateway();
    process.env.SUPABASE_URL = `http://127.0.0.1:${(restGateway.address() as AddressInfo).port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleJwt();
    shim = new SupabaseServiceRoleApiService();
  } else {
    shim = new PgServiceRoleRpc(pool) as unknown as SupabaseServiceRoleApiService;
  }
  process.stdout.write(`S8B-05 CP1 synthetic live call (transport: ${WIRE ? `PostgREST ${process.env.POSTGREST_VERSION ?? ''}`.trim() : 'service_role connection'})\n`);
  const objects = new InMemoryPrivateAudioObjectStore();
  const store = new LiveCallRepository(shim);
  const mediaRepository = new VoiceMediaRepository(shim);
  const media = new VoiceMediaService(mediaRepository, objects);
  // Proof instruments only (P8): the next PUT can be held, as a slow upload is; the admissions' answers are counted.
  let holdNextPut: Promise<void> | null = null;
  const put = objects.putStream.bind(objects);
  objects.putStream = async (...args: Parameters<typeof put>) => {
    const hold = holdNextPut;
    holdNextPut = null;
    if (hold) await hold;
    return put(...args);
  };
  const admissions: string[] = [];
  const addSegment = mediaRepository.addSegment.bind(mediaRepository);
  mediaRepository.addSegment = async (...args: Parameters<typeof addSegment>) => {
    const row = await addSegment(...args);
    admissions.push(`${String(row?.outcome)}@${String(args[8] ?? 'none')}`);
    return row;
  };
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
      { provide: LIVE_CALL_STORE, useValue: store },
      { provide: VoiceMediaService, useValue: media },
      { provide: LIVE_CALL_SPEECH_SINK, useValue: NULL_LIVE_CALL_SPEECH_SINK },
      LiveCallService,
      LiveCallGateway,
    ],
  })
  class ProofModule {}

  const boot = async (): Promise<{ app: INestApplication; url: string }> => {
    const app = await NestFactory.create(ProofModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    return { app, url: `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}${LIVE_CALL_PATH}` };
  };

  // ---------------------------------------------------------------- fixtures, snapshotted first and restored at the end
  const SCOPES = ['PERSONAL_LIVE_CALL', 'PERSONAL_VOICE_NOTE'];
  const humans: string[] = [];
  const gatesBefore = await sql('SELECT * FROM voice_private.voice_launch_capability_states WHERE capability_scope = ANY($1::text[])', [SCOPES]);
  const policyBefore = (await sql('SELECT * FROM voice_private.live_call_policy'))[0]!;
  const gatesEnabledBefore = Number((await sql("SELECT count(*) AS n FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED'"))[0]!.n);
  for (const scope of SCOPES) {
    await sql("SELECT * FROM voice_private.set_voice_launch_capability_v1($1, 'ENABLED', 'SATISFIED', 's8b-05-proof', 'local synthetic proof')", [scope]);
  }
  const setCapacity = (n: number) => sql(`SELECT voice_private.set_live_call_policy_v1($1, p.reconnect_grace_seconds, p.connect_timeout_seconds,
      p.seat_lease_seconds, p.max_call_seconds, 's8b-05-proof', 'local synthetic proof') FROM voice_private.live_call_policy p`, [n]);
  const person = async () => {
    const user = randomUUID();
    const session = randomUUID();
    humans.push(user);
    await sql('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await sql("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    const token = `synthetic-${randomUUID()}`;
    TOKENS.set(token, user);
    await shim.rpc('server_grant_voice_recording_consent_v1', { p_user_id: user, p_command_id: randomUUID(), p_consent_version: VOICE_CONSENT_V3 });
    return { user, session, token, phone: randomUUID() };
  };
  const callRow = async (id: string) => (await sql('SELECT *, started_at::text AS started_text FROM voice_private.calls WHERE id = $1', [id]))[0]!;
  const recordingOf = async (id: string) => (await sql(`SELECT id, recording_state, retention_expires_at::text AS retention_text,
      (retention_expires_at = (SELECT started_at FROM voice_private.calls WHERE id = $1) + interval '30 days') AS retention_is_started_plus_30d
      FROM voice_private.recordings WHERE call_id = $1`, [id]))[0];
  const segmentsOf = async (recordingId: string) => sql(`SELECT track, segment_index, clock_start_ms::int AS s, clock_end_ms::int AS e, object_state AS segment_state, storage_key
      FROM voice_private.recording_objects WHERE recording_id = $1 ORDER BY track, segment_index`, [recordingId]);
  const gapsOf = async (recordingId: string) => sql(`SELECT track, clock_start_ms::int AS s, clock_end_ms::int AS e, gap_kind
      FROM voice_private.recording_gaps WHERE recording_id = $1 ORDER BY track, clock_start_ms`, [recordingId]);
  const seats = async () => Number((await sql('SELECT voice_private.realtime_seats_in_use_v1() AS n'))[0]!.n);
  const age = async (id: string, assignment: string) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(`UPDATE voice_private.calls SET ${assignment} WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  };
  const hello = (p: { session: string; phone: string }, call: string, resume = false) =>
    ({ type: 'HELLO', v: 1, callId: call, sessionId: p.session, clientInstanceId: p.phone, resume });

  /** Every stored USER segment: a valid Ogg Opus file whose packets decode to exactly its duration at 16 kHz. */
  const verifyTrack = async (recordingId: string) => {
    const decoder = new OpusPacketDecoder(16_000);
    let packets = 0;
    let samples = 0;
    try {
      for (const segment of (await segmentsOf(recordingId)).filter((s) => s.track === 'USER')) {
        const object = objects.objects.get(String(segment.storage_key));
        if (!object || object.contentType !== 'audio/ogg') throw new Error('SEGMENT_OBJECT_MISSING');
        const ogg = readOggOpus(object.bytes);
        if (ogg.packets.length * 20 !== Number(segment.e) - Number(segment.s)) throw new Error('SEGMENT_DURATION_MISMATCH');
        for (const packet of ogg.packets) samples += decoder.decode(packet).length / 2;
        packets += ogg.packets.length;
      }
    } finally {
      decoder.close();
    }
    return { packets, decodedSamples16k: samples };
  };

  const results: Results = {};
  const record = (name: string, pass: boolean, detail: Record<string, unknown>) => {
    results[name] = { pass, detail };
    process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${name}\n`);
  };
  const instance = await boot();
  const second = await boot();
  const service = instance.app.get(LiveCallService);

  try {
    // P1 — a whole call: CONNECTING, ACTIVE at the first audio (started_at + the recording together), real Opus, END.
    {
      const p = await person();
      const call = randomUUID();
      const phone = new SyntheticPhone(instance.url, p.token);
      await phone.opened();
      phone.send(hello(p, call));
      await phone.waitFor((m) => m.state === 'CONNECTING');
      const connecting = await callRow(call);
      const seatsConnecting = await seats();
      await phone.speak(1, 625, 0, 0);
      await phone.waitFor((m) => m.state === 'ACTIVE');
      phone.send({ type: 'END', msgId: 1 });
      const ended = await phone.waitFor((m) => m.state === 'ENDED');
      const code = await phone.closed;
      const row = await callRow(call);
      const rec = await recordingOf(call);
      const segs = await segmentsOf(String(rec?.id));
      const track = await verifyTrack(String(rec?.id));
      record('P1 whole call over the real gateway and the real authority', connecting.state === 'CONNECTING' && connecting.started_at === null
        && seatsConnecting === 1 && ended.endReason === 'USER_ENDED' && code === 1000 && row.state === 'ENDED' && row.end_reason === 'USER_ENDED'
        && rec?.recording_state === 'STORED' && rec?.retention_is_started_plus_30d === true
        && JSON.stringify(segs.map((s) => [s.track, s.segment_index, s.s, s.e, s.segment_state]))
          === JSON.stringify([['USER', 0, 0, 10000, 'STORED'], ['USER', 1, 10000, 12500, 'STORED']])
        && track.packets === 625 && track.decodedSamples16k === 625 * 320 && (await seats()) === 0,
      { endReason: ended.endReason, closeCode: code, recordingState: rec?.recording_state, retentionIsStartedPlus30d: rec?.retention_is_started_plus_30d,
        segments: segs.map((s) => [s.track, s.segment_index, s.s, s.e, s.segment_state]), track, seatsAfter: await seats() });
    }

    // P2 — the socket drops: RECONNECTING (seat kept), a resume continues the SAME call with a RECONNECTION gap.
    {
      const p = await person();
      const call = randomUUID();
      const a = new SyntheticPhone(instance.url, p.token);
      await a.opened();
      a.send(hello(p, call));
      await a.waitFor((m) => m.state === 'CONNECTING');
      await a.speak(1, 100, 0, 0);
      await a.waitFor((m) => m.state === 'ACTIVE');
      const startedBefore = (await callRow(call)).started_text;
      const retentionBefore = (await recordingOf(call))?.retention_text;
      a.drop();
      await a.closed;
      let suspended = await callRow(call);
      for (let i = 0; i < 100 && suspended.state !== 'RECONNECTING'; i += 1) {
        await sleep(20);
        suspended = await callRow(call);
      }
      const seatsInGrace = await seats();
      const truth = await service.truth(p.user);
      const b = new SyntheticPhone(instance.url, p.token);
      await b.opened();
      b.send(hello(p, call, true));
      const resumed = await b.waitFor((m) => m.type === 'STATE');
      await b.speak(2, 100, 0, 3000, 100);
      b.send({ type: 'END', msgId: 1 });
      await b.waitFor((m) => m.state === 'ENDED');
      const row = await callRow(call);
      const rec = await recordingOf(call);
      const gaps = await gapsOf(String(rec?.id));
      const segs = await segmentsOf(String(rec?.id));
      const callsOfPerson = Number((await sql('SELECT count(*) AS n FROM voice_private.calls WHERE user_id = $1', [p.user]))[0]!.n);
      record('P2 disconnect, RECONNECTING, resume before grace: the same call, a RECONNECTION gap', suspended.state === 'RECONNECTING'
        && seatsInGrace === 1 && truth.callTruth === 'ACTIVE' && resumed.state === 'ACTIVE' && resumed.epoch === 2 && resumed.resumeFromCaptureMs === 2000
        && JSON.stringify(gaps.map((g) => [g.track, g.s, g.e, g.gap_kind])) === JSON.stringify([['USER', 2000, 3000, 'RECONNECTION']])
        && JSON.stringify(segs.map((s) => [s.s, s.e])) === JSON.stringify([[0, 2000], [3000, 5000]])
        && row.started_text === startedBefore && rec?.retention_text === retentionBefore && callsOfPerson === 1 && Number(row.connection_epoch) === 2,
      { suspendedState: suspended.state, seatsInGrace, truth: truth.callTruth, resumed: { state: resumed.state, epoch: resumed.epoch, from: resumed.resumeFromCaptureMs },
        gaps: gaps.map((g) => [g.track, g.s, g.e, g.gap_kind]), segments: segs.map((s) => [s.s, s.e]), startedAtUnchanged: row.started_text === startedBefore,
        retentionUnchanged: rec?.retention_text === retentionBefore, callsOfPerson });
    }

    // P3 — the grace expires: the sweep ends PEER_LOST_AFTER_GRACE, seals, releases the seat; a late resume is told ENDED.
    {
      const p = await person();
      const call = randomUUID();
      const a = new SyntheticPhone(instance.url, p.token);
      await a.opened();
      a.send(hello(p, call));
      await a.waitFor((m) => m.state === 'CONNECTING');
      await a.speak(1, 50, 0, 0);
      await a.waitFor((m) => m.state === 'ACTIVE');
      a.drop();
      await a.closed;
      for (let i = 0; i < 100 && (await callRow(call)).state !== 'RECONNECTING'; i += 1) await sleep(20);
      const recBefore = await recordingOf(call);
      // The old instance's recovery never seals a call inside its grace.
      const recovered = (await shim.rpc<Array<{ recovered: number }>>('server_recover_stale_call_recordings_v1', { p_limit: 200, p_grace_seconds: 0 }));
      const recDuringGrace = await recordingOf(call);
      await age(call, "grace_until = clock_timestamp() - interval '1 second'");
      const ended = await service.sweepOnce();
      const row = await callRow(call);
      const rec = await recordingOf(call);
      const late = new SyntheticPhone(instance.url, p.token);
      await late.opened();
      late.send(hello(p, call, true));
      const told = await late.waitFor((m) => m.type === 'STATE');
      record('P3 grace expiry: PEER_LOST_AFTER_GRACE, sealed by the sweep, seat released, never a new call', recBefore?.recording_state === 'RECORDING'
        && recDuringGrace?.recording_state === 'RECORDING' && ended >= 1 && row.state === 'ENDED' && row.end_reason === 'PEER_LOST_AFTER_GRACE'
        && rec?.recording_state === 'STORED' && told.state === 'ENDED' && told.endReason === 'PEER_LOST_AFTER_GRACE' && (await seats()) === 0,
      { recoveredDuringGrace: recovered[0]?.recovered, recordingDuringGrace: recDuringGrace?.recording_state, sweptEnded: ended, endReason: row.end_reason,
        recordingState: rec?.recording_state, lateResume: { state: told.state, endReason: told.endReason } });
    }

    // P4 — shared capacity: calls and live voice notes take seats from one pool; CAPACITY_FULL is explicit.
    {
      await setCapacity(1);
      const a = await person();
      const b = await person();
      const callA = randomUUID();
      const phoneA = new SyntheticPhone(instance.url, a.token);
      await phoneA.opened();
      phoneA.send(hello(a, callA));
      await phoneA.waitFor((m) => m.state === 'CONNECTING');
      const phoneB = new SyntheticPhone(second.url, b.token);
      await phoneB.opened();
      phoneB.send(hello(b, randomUUID()));
      const refusedB = await phoneB.waitFor((m) => m.type === 'REFUSED');
      const noteOutcome = await new LiveVoiceNoteRepository(shim).open({ userId: b.user, sessionId: b.session, liveId: randomUUID(), callId: randomUUID() });
      phoneA.send({ type: 'END', msgId: 1 });
      await phoneA.waitFor((m) => m.state === 'ENDED');
      const phoneB2 = new SyntheticPhone(second.url, b.token);
      await phoneB2.opened();
      const callB = randomUUID();
      phoneB2.send(hello(b, callB));
      const begunB = await phoneB2.waitFor((m) => m.type === 'STATE' || m.type === 'REFUSED');
      phoneB2.send({ type: 'END', msgId: 1 });
      await phoneB2.waitFor((m) => m.state === 'ENDED');
      await setCapacity(2);
      record('P4 shared capacity across instances: CAPACITY_FULL for a call and for a live voice note, released at the end',
        refusedB.reason === 'CAPACITY_FULL' && noteOutcome === 'CAPACITY_FULL' && begunB.state === 'CONNECTING' && (await seats()) === 0,
        { secondCall: refusedB.reason, liveVoiceNote: noteOutcome, afterRelease: begunB.state ?? begunB.reason });
    }

    // P5 — cross-instance resume: the instance that lost the call is fenced at its next lease renewal and writes nothing more.
    {
      const p = await person();
      const call = randomUUID();
      const a = new SyntheticPhone(instance.url, p.token);
      await a.opened();
      a.send(hello(p, call));
      await a.waitFor((m) => m.state === 'CONNECTING');
      await a.speak(1, 60, 0, 0);
      await a.waitFor((m) => m.state === 'ACTIVE');
      const b = new SyntheticPhone(second.url, p.token);
      await b.opened();
      b.send(hello(p, call, true));
      const resumed = await b.waitFor((m) => m.type === 'STATE');
      const keepB = setInterval(() => b.send({ type: 'HEARTBEAT', n: 0 }), 500);
      const keepA = setInterval(() => a.send({ type: 'HEARTBEAT', n: 0 }), 500);
      const fencedCode = await Promise.race([a.closed, sleep(9000).then(() => -1)]);
      clearInterval(keepA);
      // The phone resends from where the server says the track stands: the SAME capture instants are the same audio.
      const from = Number(resumed.resumeFromCaptureMs);
      await b.speak(Number(resumed.epoch), 110 - from / 20, 0, from, from / 20);
      clearInterval(keepB);
      b.send({ type: 'END', msgId: 1 });
      await b.waitFor((m) => m.state === 'ENDED');
      const rec = await recordingOf(call);
      const segs = await segmentsOf(String(rec?.id));
      const track = await verifyTrack(String(rec?.id));
      record('P5 cross-instance resume: the old instance is fenced (4003), the track stays contiguous and honest',
        fencedCode === 4003 && resumed.epoch === 2 && rec?.recording_state === 'STORED' && track.packets === 110
        && segs.every((s, i) => i === 0 || Number(s.s) === Number(segs[i - 1]!.e)) && (await gapsOf(String(rec?.id))).length === 0,
        { fencedCloseCode: fencedCode, resumedEpoch: resumed.epoch, resumeFrom: resumed.resumeFromCaptureMs, segments: segs.map((s) => [s.s, s.e]), gaps: (await gapsOf(String(rec?.id))).length, track });
    }

    // P6 — a crashed instance (its lease lapses): the sweep ends SYSTEM_INTERRUPTED and seals; call-truth is never stale.
    {
      const p = await person();
      const call = randomUUID();
      await shim.rpc('server_begin_call_v1', { p_user_id: p.user, p_session_id: p.session, p_call_id: call, p_client_instance_id: p.phone });
      await shim.rpc('server_activate_call_v1', { p_user_id: p.user, p_call_id: call, p_connection_epoch: 1 });
      await age(call, "seat_lease_until = clock_timestamp() - interval '31 seconds'");
      const truthLapsed = await service.truth(p.user);
      const ended = await service.sweepOnce();
      const row = await callRow(call);
      const rec = await recordingOf(call);
      record('P6 lease expiry (a crashed instance): SYSTEM_INTERRUPTED, sealed, seat released, truth fails safe',
        truthLapsed.callTruth === 'NO_CALL_KNOWN' && ended >= 1 && row.end_reason === 'SYSTEM_INTERRUPTED' && rec?.recording_state === 'STORED' && (await seats()) === 0,
        { truthWhileLapsed: truthLapsed.callTruth, endReason: row.end_reason, recordingState: rec?.recording_state });
    }

    // P7 — the writer fence across instances (PR #374 review): instance A holds epoch 1 and has a segment admitted whose
    // upload is still in flight, plus audio not yet written; the phone resumes on instance B (epoch 2). The admitted segment
    // completes and counts in B's tracks; A's late write is FENCED by the database and writes nothing; the phone resends
    // from B's durable end; the ended call's USER track is one contiguous truth, every packet the phone's own, in order.
    {
      const p = await person();
      const call = randomUUID();
      admissions.length = 0;
      let releasePut!: () => void;
      holdNextPut = new Promise<void>((resolve) => {
        releasePut = resolve;
      });
      const a = new SyntheticPhone(instance.url, p.token);
      await a.opened();
      a.send(hello(p, call));
      await a.waitFor((m) => m.state === 'CONNECTING');
      // 10.4 s: segment 0 (0 - 10 000 ms) is cut and admitted under epoch 1, its PUT held; 400 ms stay in A's buffer.
      await a.speak(1, 520, 0, 0);
      const rec = await recordingOf(call);
      const until = Date.now() + 8000;
      while ((await segmentsOf(String(rec?.id))).length === 0 && Date.now() < until) await sleep(20);
      const pendingBefore = (await segmentsOf(String(rec?.id))).map((x) => `${x.segment_state} ${x.s}-${x.e}`);
      const keepA = setInterval(() => a.send({ type: 'HEARTBEAT', n: 0 }), 500);
      const b = new SyntheticPhone(second.url, p.token);
      await b.opened();
      b.send(hello(p, call, true));
      const resumed = await b.waitFor((m) => m.type === 'STATE');
      const keepB = setInterval(() => b.send({ type: 'HEARTBEAT', n: 0 }), 500);
      // A's upload finishes only now, after the authority moved: the segment it was admitted for is stored.
      releasePut();
      const fencedCode = await Promise.race([a.closed, sleep(9000).then(() => -1)]);
      clearInterval(keepA);
      const from = Number(resumed.resumeFromCaptureMs);
      await b.speak(Number(resumed.epoch), 600 - from / 20, 0, from, from / 20);
      clearInterval(keepB);
      b.send({ type: 'END', msgId: 1 });
      await b.waitFor((m) => m.state === 'ENDED');
      const segs = await segmentsOf(String(rec?.id));
      const gaps = await gapsOf(String(rec?.id));
      const row = await callRow(call);
      // Every stored packet is the phone's own packet for its capture instant: nothing mixed, nothing twice.
      let inOrder = true;
      let packets = 0;
      for (const segment of segs.filter((x) => x.track === 'USER')) {
        const ogg = readOggOpus(objects.objects.get(String(segment.storage_key))!.bytes);
        ogg.packets.forEach((packet, i) => {
          if (!packet.equals(PACKETS[((Number(segment.s) / 20) + i) % PACKETS.length]!)) inOrder = false;
        });
        packets += ogg.packets.length;
      }
      const track = await verifyTrack(String(rec?.id));
      const contiguous = segs.every((x, i) => i === 0 || Number(x.s) === Number(segs[i - 1]!.e));
      record('P7 writer fence across instances: the admitted segment completes, the old epoch\'s late write is FENCED, one truth',
        pendingBefore.join() === 'PENDING_UPLOAD 0-10000' && resumed.epoch === 2 && from === 10000 && fencedCode === 4003
        && admissions.includes('FENCED@1') && segs.every((x) => x.segment_state === 'STORED') && Number(segs[0]?.e) === 10000
        && contiguous && gaps.length === 0 && packets === 600 && inOrder && track.packets === 600
        && row.state === 'ENDED' && row.end_reason === 'USER_ENDED' && Number(row.connection_epoch) === 2 && rec?.id !== undefined,
        { pendingWhenResumed: pendingBefore, resumedEpoch: resumed.epoch, resumeFrom: from, fencedCloseCode: fencedCode, admissions,
          segments: segs.map((x) => `${x.segment_state} ${x.s}-${x.e}`), gaps: gaps.length, packets, packetsInOrder: inOrder,
          endReason: row.end_reason, finalEpoch: Number(row.connection_epoch) });
    }
  } finally {
    await instance.app.close();
    await second.app.close();
    await teardown(pool, humans, gatesBefore, policyBefore);
    await pool.end();
    if (restGateway) await new Promise((resolve) => restGateway!.close(resolve));
  }
  const left = await (async () => {
    const check = new Pool({ connectionString: loopbackUrl(), max: 1 });
    try {
      const [row] = (await check.query(`SELECT (SELECT count(*) FROM voice_private.calls WHERE user_id = ANY($1::uuid[]))::int AS calls,
          (SELECT count(*) FROM voice_private.recordings WHERE user_id = ANY($1::uuid[]))::int AS recordings,
          (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))::int AS users,
          ((SELECT count(*) FROM voice_private.voice_launch_capability_states WHERE feature_flag_state = 'ENABLED') - $2)::int AS gates_enabled_beyond_before`, [humans, gatesEnabledBefore])).rows;
      return row!;
    } finally {
      await check.end();
    }
  })();
  record('P8 teardown: no fixture row left, every voice gate as it was', Object.values(left).every((n) => n === 0), left);
  const passed = Object.values(results).every((r) => r.pass);
  process.stdout.write(`${JSON.stringify({ proof: 'S8B-05 CP1 synthetic live call', passed, results }, null, 1)}\n`);
  process.exitCode = passed ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`S8B05_PROOF_FAILED ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
