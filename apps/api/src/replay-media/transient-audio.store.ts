import { Readable } from 'node:stream';
import {
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client,
} from '@aws-sdk/client-s3';
import {
  isMissingMediaObject, mediaStoreClient, mediaStoreConfigFrom, type MediaStoreConfig,
} from '../introductions-disclosure/introduction-media.store';
import { exactLength, VOICE_OBJECT_MAX_BYTES } from '../voice-media/private-audio-object.store';

/**
 * S8B-07 CP1-B (contract §3.3, §17.2, §18) — the Replay pool's own view of the private bucket.
 *
 * The bucket, its configuration and the pinned SDK are the ones the API uses, but the CLIENT is the Replay pool's own
 * (no shared client or limiter with the call writer, P-3), and the keys it may touch are split by purpose:
 *   - it READS source segments (`voice-call/`, `voice-note/`) and nothing else, one whole object per request;
 *   - it WRITES, HEADs and DELETEs processing files (`voice-transient/`) and nothing else.
 * The API's private audio store keeps its own key rule unchanged (`voice-note/` | `voice-call/`), so a Live Voice host
 * can never write or erase a processing file (V-33).
 *
 * Store operation caps: at most `REPLAY_STORE_MAX_CONCURRENT` operations in flight for the whole process (default 4),
 * every operation bounded by its own deadline. Each operation is counted for the job's content-free resource facts.
 */
const SOURCE_KEY = /^voice-(?:note|call)\/[0-9a-f-]{36}$/u;
const TRANSIENT_KEY = /^voice-transient\/[0-9a-f-]{36}$/u;
export const isTransientKey = (key: string): boolean => TRANSIENT_KEY.test(key);
export const isSourceKey = (key: string): boolean => SOURCE_KEY.test(key);

/** A store operation counter, per job (P-5: store operations and bytes read are recorded, never content). */
export interface StoreMeter {
  ops: number;
  bytesRead: number;
}
export const newStoreMeter = (): StoreMeter => ({ ops: 0, bytesRead: 0 });

export interface TransientAudioStore {
  isConfigured(): boolean;
  /** The whole source object, held in memory (a segment or a note is ≤ 25 MiB), or null when it does not exist. */
  readSource(key: string, maxBytes: number, meter: StoreMeter, signal: AbortSignal): Promise<Buffer | null>;
  /** One streamed PUT of exactly `byteSize` bytes of `audio/mp4` under a processing-file key. */
  putTransient(key: string, body: Readable, byteSize: number, meter: StoreMeter, signal: AbortSignal): Promise<void>;
  /** The stored size of a processing file, or null when none exists. */
  headTransient(key: string, meter: StoreMeter | null, signal: AbortSignal): Promise<number | null>;
  removeTransient(key: string, meter: StoreMeter | null, signal: AbortSignal): Promise<void>;
}

/** A source larger than the caller's bound. Names no key. */
export class SourceTooLargeError extends Error {
  constructor() {
    super('a source object exceeds its bound');
    this.name = 'SourceTooLargeError';
  }
}

/** A tiny counting semaphore: the pool-wide cap on concurrent store operations. */
export class OperationGate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

export function storeConcurrencyOf(env: NodeJS.ProcessEnv): number {
  const raw = env.REPLAY_STORE_MAX_CONCURRENT;
  const n = raw === undefined || raw === '' ? 4 : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 16) throw new Error('REPLAY_STORE_MAX_CONCURRENT must be an integer in [1, 16]');
  return n;
}

export class S3TransientAudioStore implements TransientAudioStore {
  private readonly config: MediaStoreConfig | null;
  private readonly client: S3Client | null;
  private readonly gate: OperationGate;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.config = mediaStoreConfigFrom(env);
    this.client = this.config === null ? null : mediaStoreClient(this.config);
    this.gate = new OperationGate(storeConcurrencyOf(env));
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private s3(): { client: S3Client; bucket: string } {
    if (this.client === null || this.config === null) throw new Error('the Replay store is not configured');
    return { client: this.client, bucket: this.config.bucket };
  }

  readSource(key: string, maxBytes: number, meter: StoreMeter, signal: AbortSignal): Promise<Buffer | null> {
    if (!SOURCE_KEY.test(key)) throw new Error('a source key out of shape');
    const { client, bucket } = this.s3();
    return this.gate.run(async () => {
      meter.ops += 1;
      let body: Readable;
      try {
        const answer = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
        if (!(answer.Body instanceof Readable)) return null;
        body = answer.Body;
      } catch (error) {
        if (isMissingMediaObject(error)) return null;
        throw error;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of body) {
        const buffer = chunk as Buffer;
        size += buffer.length;
        meter.bytesRead += buffer.length;
        if (size > maxBytes) {
          body.destroy();
          throw new SourceTooLargeError();
        }
        chunks.push(buffer);
      }
      return Buffer.concat(chunks, size);
    });
  }

  putTransient(key: string, body: Readable, byteSize: number, meter: StoreMeter, signal: AbortSignal): Promise<void> {
    if (!TRANSIENT_KEY.test(key)) throw new Error('a processing-file key out of shape');
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > VOICE_OBJECT_MAX_BYTES) throw new Error('a processing file out of bounds');
    const { client, bucket } = this.s3();
    return this.gate.run(async () => {
      meter.ops += 1;
      const counted = exactLength(byteSize);
      const streamFailure = new Promise<never>((_resolve, reject) => counted.once('error', reject));
      const onSourceError = (error: Error) => counted.destroy(error);
      const onAbort = () => counted.destroy(new Error('processing-file upload aborted'));
      body.once('error', onSourceError);
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        await Promise.race([
          client.send(new PutObjectCommand({
            Bucket: bucket, Key: key, Body: body.pipe(counted), ContentType: 'audio/mp4', ContentLength: byteSize,
          }), { abortSignal: signal }),
          streamFailure,
        ]);
      } finally {
        body.removeListener('error', onSourceError);
        signal.removeEventListener('abort', onAbort);
      }
    });
  }

  headTransient(key: string, meter: StoreMeter | null, signal: AbortSignal): Promise<number | null> {
    if (!TRANSIENT_KEY.test(key)) throw new Error('a processing-file key out of shape');
    const { client, bucket } = this.s3();
    return this.gate.run(async () => {
      if (meter) meter.ops += 1;
      try {
        const answer = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
        return Number(answer.ContentLength ?? 0);
      } catch (error) {
        if (isMissingMediaObject(error)) return null;
        throw error;
      }
    });
  }

  removeTransient(key: string, meter: StoreMeter | null, signal: AbortSignal): Promise<void> {
    if (!TRANSIENT_KEY.test(key)) throw new Error('a processing-file key out of shape');
    const { client, bucket } = this.s3();
    return this.gate.run(async () => {
      if (meter) meter.ops += 1;
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
      } catch (error) {
        if (!isMissingMediaObject(error)) throw error;
      }
    });
  }
}
