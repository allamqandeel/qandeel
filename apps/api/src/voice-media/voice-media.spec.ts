import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import {
  AI_GATEWAY_MEASURABLE_OPERATIONS, AI_LEDGER_USAGE_KINDS, AI_USAGE_SOURCES, AI_VOICE_COMPLETE_USAGE_KINDS,
} from '../ai-usage/ai-usage.types';
import { IntroductionMediaErasureWorker } from '../introductions-disclosure/introduction-media-erasure.worker';
import { FakeSpeechRecognitionAdapter } from '../voice/testing/fake-speech-recognition.adapter';
import { FakeSpeechSynthesisAdapter } from '../voice/testing/fake-speech-synthesis.adapter';
import { InMemoryPrivateAudioObjectStore, S3PrivateAudioObjectStore, VOICE_OBJECT_MAX_BYTES, exactLength } from './private-audio-object.store';
import { VoiceMediaRepository } from './voice-media.repository';
import { VOICE_EXPORT_FILE_NAME, VoiceMediaService, parseByteRange } from './voice-media.service';
import { VoiceRecordingRecoveryWorker } from './voice-recording-recovery.worker';
import { VoiceRetentionWorker } from './voice-retention.worker';

// S8B-02 (CP2) — the voice media runtime against the ONE shared fake store and a scripted database. The real database,
// PostgREST and S3 protocol are proven by database/prove-0183-voice-media-lifecycle.mjs; this spec pins the API's own
// decisions: what is refused before any byte moves, what is discarded, and that no answer ever carries a key.

const USER = randomUUID();
const SESSION = randomUUID();
const RECORDING = randomUUID();
const NOTE_KEY = `voice-note/${randomUUID()}`;
const audio = (n: number, fill = 7) => Readable.from([Buffer.alloc(n, fill)]);
const statusOf = async (p: Promise<unknown>) => p.then(() => 0, (e: unknown) => (e instanceof HttpException ? e.getStatus() : -1));

function harness(overrides: Partial<Record<keyof VoiceMediaRepository, jest.Mock>> = {}) {
  const repository = {
    beginNote: jest.fn().mockResolvedValue({ outcome: 'BEGUN', recording_id: RECORDING, storage_key: NOTE_KEY, upload_deadline: new Date(Date.now() + 600_000).toISOString() }),
    acceptNote: jest.fn().mockResolvedValue({ outcome: 'ACCEPTED', accepted_at: '2026-10-30T10:00:00.123456+00:00', retention_expires_at: '2026-11-29T10:00:00.123456+00:00' }),
    deleteRecording: jest.fn().mockResolvedValue({ outcome: 'DELETED' }),
    readObjects: jest.fn().mockResolvedValue([]),
    listRecordings: jest.fn().mockResolvedValue([]),
    addSegment: jest.fn(), storeSegment: jest.fn(), sweep: jest.fn(), recoverStale: jest.fn(), enqueueUnknown: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<VoiceMediaRepository>;
  const store = new InMemoryPrivateAudioObjectStore();
  const telemetry = { recordOperationalOutcome: jest.fn() };
  const service = new VoiceMediaService(repository, store, telemetry as never);
  return { repository, store, service, telemetry };
}
const upload = (service: VoiceMediaService, bytes = 2048, type = 'audio/mp4', signal = new AbortController().signal) =>
  service.uploadNote(USER, SESSION, randomUUID(), type, String(bytes), audio(bytes), signal);

describe('S8B-02 CP2 — the private audio store contract (the shared fake)', () => {
  it('stores exactly the declared bytes and refuses a longer or shorter body, keeping nothing', async () => {
    const store = new InMemoryPrivateAudioObjectStore();
    const signal = new AbortController().signal;
    await store.putStream(NOTE_KEY, 'audio/mp4', audio(100), 100, signal);
    expect(store.objects.get(NOTE_KEY)?.bytes.length).toBe(100);
    const other = `voice-call/${randomUUID()}`;
    await expect(store.putStream(other, 'audio/ogg', audio(101), 100, signal)).rejects.toThrow(/declared size/u);
    await expect(store.putStream(other, 'audio/ogg', audio(99), 100, signal)).rejects.toThrow(/declared size/u);
    expect(store.objects.has(other)).toBe(false);
    await expect(store.putStream('intro-media/x', 'audio/ogg', audio(1), 1, signal)).rejects.toThrow(/out of shape/u);
  });

  it('answers inclusive ranges and the whole object, HEAD and DELETE, and lists one prefix', async () => {
    const store = new InMemoryPrivateAudioObjectStore();
    const signal = new AbortController().signal;
    await store.putStream(NOTE_KEY, 'audio/mp4', Readable.from([Buffer.from('0123456789')]), 10, signal);
    const read = async (s: Readable | null) => Buffer.concat(await (s as Readable).toArray()).toString();
    expect(await read(await store.getRange(NOTE_KEY, { start: 2, end: 5 }, signal))).toBe('2345');
    expect(await read(await store.getRange(NOTE_KEY, null, signal))).toBe('0123456789');
    expect((await store.listOlderThan('voice-note/', new Date(Date.now() + 1000), null, signal)).keys).toEqual([NOTE_KEY]);
    expect((await store.listOlderThan('voice-call/', new Date(Date.now() + 1000), null, signal)).keys).toEqual([]);
    await store.remove(NOTE_KEY, signal);
    expect(await store.exists(NOTE_KEY, signal)).toBe(false);
    expect(await store.getRange(NOTE_KEY, null, signal)).toBeNull();
  });

  it('counts a stream as it passes, chunk by chunk (the exact-length transform holds nothing)', async () => {
    const counted = exactLength(7);
    const seen: number[] = [];
    counted.on('data', (c: Buffer) => seen.push(c.length));
    await new Promise((resolve, reject) => Readable.from([Buffer.alloc(3), Buffer.alloc(4)]).pipe(counted).on('end', resolve).on('error', reject));
    expect(seen).toEqual([3, 4]);
  });

  it('an aborted S3 PUT or failed upload source rejects without an unhandled stream error', async () => {
    // The first live PostgREST/rclone proof exposed a crash when abort destroyed the counted Transform with an
    // unhandled error event. Fake only the S3 transport; exercise the production S3 adapter and its stream wiring.
    const store = new S3PrivateAudioObjectStore();
    const transport = store as unknown as { config: { bucket: string }; client: { send: jest.Mock } };
    transport.config = { bucket: 'synthetic' };
    transport.client = {
      send: jest.fn((_command: unknown, options: { abortSignal: AbortSignal }) =>
        new Promise<void>((_resolve, reject) => {
          options.abortSignal.addEventListener('abort', () => reject(new Error('SDK_ABORTED')), { once: true });
        })),
    };

    const body = new PassThrough();
    const abort = new AbortController();
    const uploading = store.putStream(NOTE_KEY, 'audio/mp4', body, 1024, abort.signal);
    abort.abort();
    await expect(uploading).rejects.toThrow(/voice upload aborted|SDK_ABORTED/u);
    body.destroy();

    const failedBody = new PassThrough();
    const uploadingFailedBody = store.putStream(NOTE_KEY, 'audio/mp4', failedBody, 1024, new AbortController().signal);
    failedBody.destroy(new Error('upload source disconnected'));
    await expect(uploadingFailedBody).rejects.toThrow(/upload source disconnected/u);
  });
});

describe('S8B-02 CP2 — byte ranges (RFC 9110)', () => {
  it.each([
    [undefined, 10, null], ['bytes=0-3', 10, { start: 0, end: 3 }], ['bytes=4-', 10, { start: 4, end: 9 }], ['bytes=-3', 10, { start: 7, end: 9 }],
    ['bytes=5-99', 10, { start: 5, end: 9 }], ['bytes=10-12', 10, 'UNSATISFIABLE'], ['bytes=-0', 10, 'UNSATISFIABLE'], ['bytes=4-2', 10, 'UNSATISFIABLE'],
    ['bytes=0-1,4-5', 10, null], ['items=0-1', 10, null], ['bytes=-', 10, null],
  ])('%s of %d bytes', (header, size, expected) => {
    expect(parseByteRange(header, size)).toEqual(expected);
  });
});

describe('S8B-02 CP2 — the Voice Note upload', () => {
  it('streams, accepts and answers without a key; the expiry is the database\'s', async () => {
    const { service, store, repository } = harness();
    const answer = await upload(service);
    expect(answer).toEqual({ outcome: 'ACCEPTED', recordingId: RECORDING, acceptedAt: '2026-10-30T10:00:00.123Z', availableUntil: '2026-11-29T10:00:00.123Z' });
    expect(JSON.stringify(answer)).not.toMatch(/voice-note|voice-call/u);
    expect(store.objects.get(NOTE_KEY)?.contentType).toBe('audio/mp4');
    expect(repository.acceptNote).toHaveBeenCalledWith(USER, RECORDING, 2048);
  });

  it('refuses before any byte moves: unsupported type, too large, closed gate, no consent', async () => {
    const tooLarge = harness();
    expect(await upload(tooLarge.service, 2048, 'audio/ogg')).toEqual({ outcome: 'UNSUPPORTED' });
    expect(await tooLarge.service.uploadNote(USER, SESSION, randomUUID(), 'audio/mp4', String(VOICE_OBJECT_MAX_BYTES + 1), audio(1), new AbortController().signal))
      .toEqual({ outcome: 'TOO_LARGE' });
    expect(tooLarge.repository.beginNote).not.toHaveBeenCalled();
    for (const outcome of ['NOT_AVAILABLE_NOW', 'CONSENT_REQUIRED']) {
      const h = harness({ beginNote: jest.fn().mockResolvedValue({ outcome, recording_id: null, storage_key: null, upload_deadline: null }) });
      expect(await upload(h.service)).toEqual({ outcome });
      expect(h.store.objects.size).toBe(0);
    }
    const notOwn = harness({ beginNote: jest.fn().mockResolvedValue({ outcome: 'UNAVAILABLE' }) });
    expect(await statusOf(upload(notOwn.service))).toBe(404);
    expect(await statusOf(harness().service.uploadNote(USER, 'not-a-uuid', randomUUID(), 'audio/mp4', '10', audio(10), new AbortController().signal))).toBe(400);
  });

  it('PRIV-W: a withdrawal during the upload refuses the accept and discards the pending note at once', async () => {
    const h = harness({ acceptNote: jest.fn().mockResolvedValue({ outcome: 'CONSENT_REQUIRED', accepted_at: null, retention_expires_at: null }) });
    expect(await upload(h.service)).toEqual({ outcome: 'CONSENT_REQUIRED' });
    expect(h.repository.deleteRecording).toHaveBeenCalledWith(USER, RECORDING);
  });

  it('a failed or aborted PUT discards the note and answers 503; no accept is attempted', async () => {
    const failing = harness();
    failing.store.failing.add('put');
    expect(await statusOf(upload(failing.service))).toBe(503);
    expect(failing.repository.acceptNote).not.toHaveBeenCalled();
    expect(failing.repository.deleteRecording).toHaveBeenCalledWith(USER, RECORDING);
    const aborted = harness();
    const controller = new AbortController();
    controller.abort();
    expect(await statusOf(upload(aborted.service, 2048, 'audio/mp4', controller.signal))).toBe(503);
    expect(aborted.store.objects.size).toBe(0);
    expect(aborted.repository.deleteRecording).toHaveBeenCalled();
  });

  it('an accept with no answer neither discards nor claims the note', async () => {
    const h = harness({ acceptNote: jest.fn().mockRejectedValue(new Error('transport')) });
    expect(await statusOf(upload(h.service))).toBe(503);
    expect(h.repository.deleteRecording).not.toHaveBeenCalled();
  });
});

describe('S8B-03 CP1 — a replayed upload of an accepted note (§5.2, A1)', () => {
  const replayed = () => jest.fn().mockResolvedValue({ outcome: 'ALREADY_ACCEPTED', recording_id: RECORDING, storage_key: null, upload_deadline: null });

  it('ALREADY_ACCEPTED: the body is drained, no PUT, no discard, one accept, and the answer equals the first one', async () => {
    const first = await upload(harness().service);
    const h = harness({ beginNote: replayed() });
    const putStream = jest.spyOn(h.store, 'putStream');
    const body = audio(2048);
    const answer = await h.service.uploadNote(USER, SESSION, randomUUID(), 'audio/mp4', '2048', body, new AbortController().signal);
    expect(answer).toEqual(first);
    expect(putStream).not.toHaveBeenCalled();
    expect(h.repository.deleteRecording).not.toHaveBeenCalled();
    expect(h.repository.acceptNote).toHaveBeenCalledTimes(1);
    expect(h.repository.acceptNote).toHaveBeenCalledWith(USER, RECORDING, 2048);
    expect(h.store.objects.size).toBe(0);
    expect(body.readableEnded).toBe(true);
    expect(JSON.stringify(answer)).not.toMatch(/voice-note|voice-call/u);
  });

  it('a delete or expiry racing between begin and accept answers 404 and discards nothing', async () => {
    for (const accepted of [
      { outcome: 'UNAVAILABLE', accepted_at: null, retention_expires_at: null },
      { outcome: 'ACCEPTED', accepted_at: '2026-09-01T10:00:00Z', retention_expires_at: '2026-10-01T10:00:00Z' },
    ]) {
      const h = harness({ beginNote: replayed(), acceptNote: jest.fn().mockResolvedValue(accepted) });
      const putStream = jest.spyOn(h.store, 'putStream');
      expect(await statusOf(upload(h.service))).toBe(404);
      expect(putStream).not.toHaveBeenCalled();
      expect(h.repository.deleteRecording).not.toHaveBeenCalled();
    }
  });

  it('another human, another session or another size is COMMAND_CONFLICT → 404, before any byte is stored', async () => {
    const h = harness({ beginNote: jest.fn().mockResolvedValue({ outcome: 'COMMAND_CONFLICT', recording_id: null, storage_key: null, upload_deadline: null }) });
    expect(await statusOf(upload(h.service))).toBe(404);
    expect(h.repository.acceptNote).not.toHaveBeenCalled();
    expect(h.repository.deleteRecording).not.toHaveBeenCalled();
    expect(h.store.objects.size).toBe(0);
  });
});

describe('S8B-03 CP1 — the transcription worker\'s reads of a note go through the service', () => {
  const noteRow = { track: 'NOTE', segment_index: 0, storage_key: NOTE_KEY, content_type: 'audio/mp4', byte_size: 10, clock_start_ms: null, clock_end_ms: null };

  it('a readable note streams exactly its bytes, and one bounded range; an unreadable one is null with no store read', async () => {
    const h = harness({ readObjects: jest.fn().mockResolvedValue([noteRow]) });
    await h.store.putStream(NOTE_KEY, 'audio/mp4', Readable.from([Buffer.from('0123456789')]), 10, new AbortController().signal);
    const opened = await h.service.openNoteForTranscription(USER, RECORDING, new AbortController().signal);
    const chunks: Buffer[] = [];
    for await (const chunk of opened!.audio) chunks.push(chunk);
    expect([opened!.byteSize, Buffer.concat(chunks).toString()]).toEqual([10, '0123456789']);
    expect((await h.service.readNoteRange(USER, RECORDING, 2, 4, new AbortController().signal))!.toString()).toBe('2345');
    expect((await h.service.readNoteRange(USER, RECORDING, 8, 16, new AbortController().signal))!.toString()).toBe('89');
    const gone = harness();
    const getRange = jest.spyOn(gone.store, 'getRange');
    expect(await gone.service.openNoteForTranscription(USER, RECORDING, new AbortController().signal)).toBeNull();
    expect(await gone.service.readNoteRange(USER, RECORDING, 0, 16, new AbortController().signal)).toBeNull();
    expect(getRange).not.toHaveBeenCalled();
  });
});

describe('S8B-02 CP2 — reads, deletion and export', () => {
  const object ={ track: 'NOTE', segment_index: 0, storage_key: NOTE_KEY, content_type: 'audio/mp4', byte_size: '10', clock_start_ms: null, clock_end_ms: null };

  it('a recording that is not readable now (another human\'s, expired, deleted) is 404, with no store read', async () => {
    const h = harness();
    const get = jest.spyOn(h.store, 'getRange');
    expect(await statusOf(h.service.readRecording(USER, RECORDING))).toBe(404);
    expect(await statusOf(h.service.openObject(USER, RECORDING, 'NOTE', '0', undefined, new AbortController().signal))).toBe(404);
    expect(await statusOf(h.service.openObject(USER, 'x', 'NOTE', '0', undefined, new AbortController().signal))).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it('answers 206 for a range, 200 whole, 416 out of bounds, 503 for a live key with no object - never a key', async () => {
    const h = harness({ readObjects: jest.fn().mockResolvedValue([object]) });
    await h.store.putStream(NOTE_KEY, 'audio/mp4', Readable.from([Buffer.from('0123456789')]), 10, new AbortController().signal);
    const signal = new AbortController().signal;
    const partial = await h.service.openObject(USER, RECORDING, 'NOTE', '0', 'bytes=2-4', signal);
    expect([partial.status, partial.contentLength, partial.contentRange]).toEqual([206, 3, 'bytes 2-4/10']);
    expect(Buffer.concat(await partial.body.toArray()).toString()).toBe('234');
    expect((await h.service.openObject(USER, RECORDING, 'NOTE', '0', undefined, signal)).status).toBe(200);
    expect(await statusOf(h.service.openObject(USER, RECORDING, 'NOTE', '0', 'bytes=20-30', signal))).toBe(416);
    const manifest = await h.service.readRecording(USER, RECORDING);
    expect(JSON.stringify(manifest)).not.toMatch(/voice-note|storage/u);
    h.store.objects.clear();
    expect(await statusOf(h.service.openObject(USER, RECORDING, 'NOTE', '0', undefined, signal))).toBe(503);
  });

  it('the owner\'s deletion: DELETED, then ALREADY_GONE; another human\'s is 404', async () => {
    expect(await harness().service.deleteRecording(USER, RECORDING)).toEqual({ outcome: 'DELETED' });
    expect(await harness({ deleteRecording: jest.fn().mockResolvedValue({ outcome: 'ALREADY_GONE' }) }).service.deleteRecording(USER, RECORDING)).toEqual({ outcome: 'ALREADY_GONE' });
    expect(await statusOf(harness({ deleteRecording: jest.fn().mockResolvedValue({ outcome: 'UNAVAILABLE' }) }).service.deleteRecording(USER, RECORDING))).toBe(404);
  });

  it('the export manifest names files only; a file no longer listed is NO_LONGER_AVAILABLE', async () => {
    const fileName = 'qandeel-voice-note-20261030T100000123456Z.m4a';
    const listed = { recording_id: RECORDING, recording_kind: 'VOICE_NOTE', recorded_at: '2026-10-30T10:00:00.123456+00:00', retention_expires_at: '2026-11-29T10:00:00.123456+00:00',
      track: 'NOTE', segment_index: 0, content_type: 'audio/mp4', byte_size: '10', clock_start_ms: null, clock_end_ms: null, file_name: fileName };
    const h = harness({ listRecordings: jest.fn().mockResolvedValue([listed]), readObjects: jest.fn().mockResolvedValue([object]) });
    const manifest = await h.service.exportManifest(USER);
    expect(manifest.format).toBe('qandeel.personal-data-export.voice.v1');
    expect(manifest.files).toEqual([expect.objectContaining({ fileName, mimeType: 'audio/mp4', recordingKind: 'VOICE_NOTE', bytes: 10, originalAudio: true })]);
    expect(JSON.stringify(manifest)).not.toMatch(new RegExp(`voice-note/|${RECORDING}`, 'u'));
    expect(VOICE_EXPORT_FILE_NAME.test(fileName)).toBe(true);
    expect(VOICE_EXPORT_FILE_NAME.test('qandeel-voice-call-20261030T100000123456Z-2-qandeel-000012.ogg')).toBe(true);
    expect(VOICE_EXPORT_FILE_NAME.test('../voice-note.m4a')).toBe(false);
    await h.store.putStream(NOTE_KEY, 'audio/mp4', Readable.from([Buffer.from('0123456789')]), 10, new AbortController().signal);
    expect((await h.service.openExportFile(USER, fileName, new AbortController().signal)).status).toBe(200);
    h.repository.listRecordings.mockResolvedValue([]);
    const gone = await h.service.openExportFile(USER, fileName, new AbortController().signal).catch((e: HttpException) => [e.getStatus(), e.getResponse()]);
    expect(gone).toEqual([404, { outcome: 'NO_LONGER_AVAILABLE' }]);
  });
});

describe('S8B-02 CP2 — the workers', () => {
  const withEnv = async (fn: () => Promise<void>) => {
    const saved = { ...process.env };
    try { await fn(); } finally { process.env = saved; }
  };

  it('the retention and recovery workers are off under tests and when unconfigured', async () => {
    await withEnv(async () => {
      Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'x', QANDEEL_MEDIA_S3_ENDPOINT: 'http://127.0.0.1:2', QANDEEL_MEDIA_S3_BUCKET: 'b' });
      const repository = {} as VoiceMediaRepository;
      expect(new VoiceRetentionWorker(repository).enabled).toBe(false);
      expect(new VoiceRecordingRecoveryWorker(repository).enabled).toBe(false);
    });
  });

  it('the retention worker sweeps until a round is not full, and a failed sweep is reported and retried later', async () => {
    const sweep = jest.fn().mockResolvedValueOnce({ expired: 60, discarded: 40 }).mockResolvedValueOnce({ expired: 1, discarded: 0 });
    expect(await new VoiceRetentionWorker({ sweep } as never).runOnce()).toEqual({ expired: 61, discarded: 40 });
    expect(sweep).toHaveBeenCalledTimes(2);
    const telemetry = { recordOperationalOutcome: jest.fn() };
    expect(await new VoiceRetentionWorker({ sweep: jest.fn().mockRejectedValue(new Error('x')) } as never, telemetry as never).runOnce()).toEqual({ expired: 0, discarded: 0 });
    expect(telemetry.recordOperationalOutcome).toHaveBeenCalledWith('VOICE_RETENTION', 'sweep', 'transport_failure');
  });

  it('the recovery worker seals through the database with its grace', async () => {
    const recoverStale = jest.fn().mockResolvedValue({ recovered: 2 });
    expect(await new VoiceRecordingRecoveryWorker({ recoverStale } as never).runOnce()).toEqual({ recovered: 2 });
    expect(recoverStale).toHaveBeenCalledWith(50, 60);
  });

  it('the ONE erasure worker erases a voice key in the audio store, proven by HEAD; without it the key is deferred', async () => {
    const audioStore = new InMemoryPrivateAudioObjectStore();
    await audioStore.putStream(NOTE_KEY, 'audio/mp4', audio(4), 4, new AbortController().signal);
    const photos = { isConfigured: () => true, remove: jest.fn(), exists: jest.fn() };
    const worker = new IntroductionMediaErasureWorker({} as never, photos as never, undefined, audioStore, {} as never);
    expect(await worker.erase(NOTE_KEY)).toBe(true);
    expect(audioStore.objects.has(NOTE_KEY)).toBe(false);
    expect(photos.remove).not.toHaveBeenCalled();
    audioStore.failing.add('exists');
    expect(await worker.erase(NOTE_KEY)).toBe(false);
    expect(await new IntroductionMediaErasureWorker({} as never, photos as never).erase(NOTE_KEY)).toBe(false);
  });

  it('the voice reconciliation lists both prefixes and hands every key to the database', async () => {
    const audioStore = new InMemoryPrivateAudioObjectStore();
    const call = `voice-call/${randomUUID()}`;
    await audioStore.putStream(NOTE_KEY, 'audio/mp4', audio(4), 4, new AbortController().signal);
    await audioStore.putStream(call, 'audio/ogg', audio(4), 4, new AbortController().signal);
    const enqueueUnknown = jest.fn().mockResolvedValue({ enqueued: 1 });
    const worker = new IntroductionMediaErasureWorker({} as never, {} as never, undefined, audioStore, { enqueueUnknown } as never);
    expect(await worker.reconcileVoice(new Date(Date.now() + 11 * 60_000))).toBe(2);
    expect(enqueueUnknown.mock.calls).toEqual([[[NOTE_KEY]], [[call]]]);
    expect(await worker.reconcileVoice(new Date())).toBe(2 - 2);
  });
});

describe('S8B-02 CP2 — the ASR / TTS ports: deterministic fakes in the ledger\'s own vocabulary', () => {
  it('ASR: the same audio gives the same segments and AUDIO_INPUT_MS, with its D-2 source; a crash is ABSENT, never zero', async () => {
    const script = [{ text: 'أهلا', band: 'HIGH' as const }, { text: 'كيف الحال', band: 'MEDIUM' as const }];
    const run = () => new FakeSpeechRecognitionAdapter(script).transcribe({ audio: audio(1600), contentType: 'audio/mp4', language: 'ar_en', signal: new AbortController().signal });
    const first = await run();
    expect(await run()).toEqual(first);
    expect(first.segments).toEqual([{ text: 'أهلا', band: 'HIGH', startMs: 0, endMs: 50 }, { text: 'كيف الحال', band: 'MEDIUM', startMs: 50, endMs: 100 }]);
    expect(first.usage).toEqual({ completeness: 'COMPLETE', audioInputMs: 100, source: 'GATEWAY_MEASURED' });
    expect(AI_VOICE_COMPLETE_USAGE_KINDS[first.operation]).toEqual(['AUDIO_INPUT_MS']);
    expect(AI_GATEWAY_MEASURABLE_OPERATIONS).toContain(first.operation);
    const session = await new FakeSpeechRecognitionAdapter(script, { crash: true }).openStream({ language: 'ar_en', signal: new AbortController().signal });
    await session.send(Buffer.alloc(800));
    expect(await session.end()).toEqual({ operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION', usage: { completeness: 'ABSENT' } });
    const kinds: string[] = [];
    for await (const event of session.events) kinds.push(event.kind);
    expect(kinds).toEqual(['INTERIM', 'FINAL', 'FINAL']);
  });

  it('TTS: ordered chunks, the voice used, hints honoured only when supported, INPUT_TOKEN + AUDIO_OUTPUT_TOKEN as reported', async () => {
    const adapter = new FakeSpeechSynthesisAdapter();
    const session = adapter.synthesize({ text: 'أهلا. كيف حالك؟ تمام', voiceId: 'Achird', hint: 'warm', signal: new AbortController().signal });
    const chunks: number[] = [];
    for await (const chunk of session.chunks) chunks.push(chunk.sequence);
    const result = await session.result;
    expect(chunks).toEqual([0, 1, 2]);
    expect(result).toEqual({ operation: 'GEMINI_SPEECH_GENERATION', voiceId: 'Achird', hintApplied: false,
      usage: { completeness: 'COMPLETE', source: 'PROVIDER_REPORTED', inputTokens: Math.ceil(Buffer.byteLength('أهلا. كيف حالك؟ تمام') / 4), audioOutputTokens: 75 } });
    expect([...AI_VOICE_COMPLETE_USAGE_KINDS[result.operation]].sort()).toEqual(['AUDIO_OUTPUT_TOKEN', 'INPUT_TOKEN']);
    for (const kind of AI_VOICE_COMPLETE_USAGE_KINDS[result.operation]) expect(AI_LEDGER_USAGE_KINDS).toContain(kind);
    expect(AI_USAGE_SOURCES).toContain(result.usage.completeness === 'COMPLETE' ? result.usage.source : 'PROVIDER_REPORTED');
    const controller = new AbortController();
    const stopped = adapter.synthesize({ text: 'واحد. اثنان.', voiceId: 'Achird', hint: null, signal: controller.signal });
    for await (const _chunk of stopped.chunks) controller.abort();
    expect((await stopped.result).usage).toEqual({ completeness: 'ABSENT' });
  });
});
