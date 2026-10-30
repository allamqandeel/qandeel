import { Injectable } from '@nestjs/common';
import { Readable, Transform, type TransformCallback } from 'node:stream';
import {
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client,
} from '@aws-sdk/client-s3';
import {
  isMissingMediaObject, mediaStoreClient, mediaStoreConfigFrom, type MediaStoreConfig,
} from '../introductions-disclosure/introduction-media.store';

/**
 * S8B-02 (CP2, contract §3.11) — the private audio object store: Voice Notes (`voice-note/<uuid>`, `audio/mp4`, D-C2) and
 * call segments (`voice-call/<uuid>`, `audio/ogg`, D-C1), in the SAME private bucket, with the same `QANDEEL_MEDIA_S3_*`
 * configuration and the same pinned SDK as the Introduction photos (S6-06). No new dependency.
 *
 * Bytes are STREAMED both ways and never held whole in the API's memory: `putStream` is one PUT whose body is the caller's
 * stream, counted against the byte size the database recorded (a body longer or shorter than declared fails the PUT);
 * `getRange` answers the store's own body stream for one byte range. There is no presign, no multipart, no ACL and no
 * public object: a client never receives a key, URL or credential, and nothing the provider computes about an object
 * (ETag, checksums) is kept. Every call takes an AbortSignal, so a client disconnect or a deadline cancels it.
 *
 * Every result here is witnessed in CI against `rclone serve s3` only (B13). Hosted Supabase Storage conformance - Range,
 * the bucket's object-size limit, DELETE / HEAD and listing for voice keys - is HOSTED-DEPLOY-01's (QAN-BL-PROD-08, D-8).
 */
export interface PrivateAudioObjectStore {
  /** False when the object store is not configured: every voice media route then answers UNAVAILABLE. */
  isConfigured(): boolean;
  /** One streamed PUT of exactly `byteSize` bytes; any other length fails it (the store keeps nothing partial). */
  putStream(key: string, contentType: VoiceAudioContentType, body: Readable, byteSize: number, signal: AbortSignal): Promise<void>;
  /** The bytes `[start, end]` (inclusive), or the whole object when `range` is null; null when no object exists. */
  getRange(key: string, range: VoiceByteRange | null, signal: AbortSignal): Promise<Readable | null>;
  exists(key: string, signal: AbortSignal): Promise<boolean>;
  remove(key: string, signal: AbortSignal): Promise<void>;
  /** One page of keys under one voice prefix, last written before `olderThan`, for the listing reconciliation. */
  listOlderThan(prefix: VoiceKeyPrefix, olderThan: Date, continuation: string | null, signal: AbortSignal): Promise<{ keys: string[]; next: string | null }>;
}

export const PRIVATE_AUDIO_OBJECT_STORE = Symbol('PRIVATE_AUDIO_OBJECT_STORE');
export const VOICE_KEY_PREFIXES = ['voice-note/', 'voice-call/'] as const;
export type VoiceKeyPrefix = (typeof VOICE_KEY_PREFIXES)[number];
export type VoiceAudioContentType = 'audio/mp4' | 'audio/ogg';
export interface VoiceByteRange { readonly start: number; readonly end: number }
/** The database's hard object ceiling (0183 `voice_private.object_byte_ceiling_v1()`: 25 MiB). */
export const VOICE_OBJECT_MAX_BYTES = 26_214_400;

const VOICE_KEY = /^voice-(?:note|call)\/[0-9a-f-]{36}$/u;
export const isVoiceKey = (key: string): boolean => VOICE_KEY.test(key);
const assertKey = (key: string): void => {
  if (!VOICE_KEY.test(key)) throw new Error('voice media key out of shape');
};

/** A body of a different length than the database recorded. Names no key and no byte. */
export class VoiceByteCountError extends Error {
  constructor() {
    super('the voice body length differs from its declared size');
    this.name = 'VoiceByteCountError';
  }
}

/** Passes the bytes through unchanged and fails the stream the moment it holds more, or ends with fewer, than declared. */
export function exactLength(byteSize: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
      seen += chunk.length;
      if (seen > byteSize) done(new VoiceByteCountError());
      else done(null, chunk);
    },
    flush(done: TransformCallback) {
      done(seen === byteSize ? null : new VoiceByteCountError());
    },
  });
}

@Injectable()
export class S3PrivateAudioObjectStore implements PrivateAudioObjectStore {
  private readonly config: MediaStoreConfig | null;
  private readonly client: S3Client | null;

  constructor() {
    this.config = mediaStoreConfigFrom(process.env);
    this.client = this.config === null ? null : mediaStoreClient(this.config);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private s3(): { client: S3Client; bucket: string } {
    if (this.client === null || this.config === null) throw new Error('voice media store is not configured');
    return { client: this.client, bucket: this.config.bucket };
  }

  async putStream(key: string, contentType: VoiceAudioContentType, body: Readable, byteSize: number, signal: AbortSignal): Promise<void> {
    assertKey(key);
    if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > VOICE_OBJECT_MAX_BYTES) throw new VoiceByteCountError();
    const { client, bucket } = this.s3();
    const counted = exactLength(byteSize);
    // A source failure (the client went away) fails the counted stream, and with it the PUT; never a partial object.
    body.once('error', (error) => counted.destroy(error));
    signal.addEventListener('abort', () => counted.destroy(new Error('voice upload aborted')), { once: true });
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body.pipe(counted), ContentType: contentType, ContentLength: byteSize,
    }), { abortSignal: signal });
  }

  async getRange(key: string, range: VoiceByteRange | null, signal: AbortSignal): Promise<Readable | null> {
    assertKey(key);
    const { client, bucket } = this.s3();
    try {
      const answer = await client.send(new GetObjectCommand({
        Bucket: bucket, Key: key, ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      }), { abortSignal: signal });
      if (!(answer.Body instanceof Readable)) return null;
      return answer.Body;
    } catch (error) {
      if (isMissingMediaObject(error)) return null;
      throw error;
    }
  }

  async exists(key: string, signal: AbortSignal): Promise<boolean> {
    assertKey(key);
    const { client, bucket } = this.s3();
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
      return true;
    } catch (error) {
      if (isMissingMediaObject(error)) return false;
      throw error;
    }
  }

  async remove(key: string, signal: AbortSignal): Promise<void> {
    assertKey(key);
    const { client, bucket } = this.s3();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
    } catch (error) {
      // Deleting what is already gone is success: the erasure is proven by the HEAD that follows, never by this answer.
      if (!isMissingMediaObject(error)) throw error;
    }
  }

  async listOlderThan(prefix: VoiceKeyPrefix, olderThan: Date, continuation: string | null, signal: AbortSignal): Promise<{ keys: string[]; next: string | null }> {
    if (!(VOICE_KEY_PREFIXES as readonly string[]).includes(prefix)) throw new Error('voice media prefix out of shape');
    const { client, bucket } = this.s3();
    const answer = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, MaxKeys: 500, ...(continuation ? { ContinuationToken: continuation } : {}),
    }), { abortSignal: signal });
    const keys = (answer.Contents ?? [])
      .filter((o) => typeof o.Key === 'string' && o.Key.startsWith(prefix) && VOICE_KEY.test(o.Key)
        && o.LastModified instanceof Date && o.LastModified < olderThan)
      .map((o) => o.Key as string);
    return { keys, next: answer.IsTruncated && answer.NextContinuationToken ? answer.NextContinuationToken : null };
  }
}

/**
 * The ONE shared fake (tests only; never composed by a module): an in-memory store with the adapter's exact contract -
 * exact-length streamed PUT, inclusive ranges, HEAD / DELETE / listing - and a failure switch per operation, so B7's
 * PUT / GET / DELETE / HEAD failures can be injected without a network.
 */
export class InMemoryPrivateAudioObjectStore implements PrivateAudioObjectStore {
  readonly objects = new Map<string, { bytes: Buffer; contentType: VoiceAudioContentType; writtenAt: Date }>();
  readonly failing = new Set<'put' | 'get' | 'remove' | 'exists' | 'list'>();
  configured = true;

  isConfigured(): boolean {
    return this.configured;
  }

  private fail(operation: 'put' | 'get' | 'remove' | 'exists' | 'list', signal: AbortSignal): void {
    if (signal.aborted) throw new Error('aborted');
    if (this.failing.has(operation)) throw Object.assign(new Error('injected store failure'), { $metadata: { httpStatusCode: 503 } });
  }

  async putStream(key: string, contentType: VoiceAudioContentType, body: Readable, byteSize: number, signal: AbortSignal): Promise<void> {
    assertKey(key);
    this.fail('put', signal);
    const chunks: Buffer[] = [];
    const counted = body.pipe(exactLength(byteSize));
    body.once('error', (error) => counted.destroy(error));
    for await (const chunk of counted as AsyncIterable<Buffer>) {
      if (signal.aborted) throw new Error('aborted');
      chunks.push(chunk);
    }
    this.objects.set(key, { bytes: Buffer.concat(chunks), contentType, writtenAt: new Date() });
  }

  async getRange(key: string, range: VoiceByteRange | null, signal: AbortSignal): Promise<Readable | null> {
    assertKey(key);
    this.fail('get', signal);
    const object = this.objects.get(key);
    if (!object) return null;
    return Readable.from([range ? object.bytes.subarray(range.start, range.end + 1) : object.bytes]);
  }

  async exists(key: string, signal: AbortSignal): Promise<boolean> {
    assertKey(key);
    this.fail('exists', signal);
    return this.objects.has(key);
  }

  async remove(key: string, signal: AbortSignal): Promise<void> {
    assertKey(key);
    this.fail('remove', signal);
    this.objects.delete(key);
  }

  async listOlderThan(prefix: VoiceKeyPrefix, olderThan: Date, _continuation: string | null, signal: AbortSignal): Promise<{ keys: string[]; next: string | null }> {
    this.fail('list', signal);
    const keys = [...this.objects.entries()].filter(([k, o]) => k.startsWith(prefix) && o.writtenAt < olderThan).map(([k]) => k);
    return { keys, next: null };
  }
}
