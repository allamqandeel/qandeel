import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';

/**
 * S6-06 (D-01) — the one object-store port for Introduction photos, over the S3 protocol: Supabase Storage's S3 endpoint
 * when hosted, `rclone serve s3` in CI. The same code runs against both, so what CI proves is this adapter, not a mock.
 *
 * The credentials live in the API's environment only. They are never logged, never returned and never reach the
 * database or a client: a client never receives a storage URL, a signed link or a key (§5). The bucket is private.
 * Nothing the provider computes about an object (its ETag, size or checksums) is read back or kept (0122).
 */
export interface IntroductionMediaObjectStore {
  /** False when the object store is not configured: every photo route then answers UNAVAILABLE. */
  isConfigured(): boolean;
  put(key: string, bytes: Buffer, signal: AbortSignal): Promise<void>;
  /** The bytes, or null when no object exists under the key. */
  get(key: string, signal: AbortSignal): Promise<Buffer | null>;
  exists(key: string, signal: AbortSignal): Promise<boolean>;
  remove(key: string, signal: AbortSignal): Promise<void>;
  /** One page of keys under the photo prefix, older than `olderThan`, for the listing reconciliation. */
  listOlderThan(olderThan: Date, continuation: string | null, signal: AbortSignal): Promise<{ keys: string[]; next: string | null }>;
}

export const INTRODUCTION_MEDIA_PREFIX = 'intro-media/';
const KEY = /^intro-media\/[0-9a-f-]{36}$/u;

interface StoreConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

function configFrom(env: NodeJS.ProcessEnv): StoreConfig | null {
  const endpoint = env.QANDEEL_MEDIA_S3_ENDPOINT;
  const region = env.QANDEEL_MEDIA_S3_REGION;
  const bucket = env.QANDEEL_MEDIA_S3_BUCKET;
  const accessKeyId = env.QANDEEL_MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.QANDEEL_MEDIA_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  // A production endpoint is TLS-only; a plain-http endpoint is accepted only on the loopback interface (CI).
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.host.replace(/:\d+$/u, '')))) {
    return null;
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

const isMissing = (error: unknown): boolean => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
};

const assertKey = (key: string): void => {
  if (!KEY.test(key)) throw new Error('introduction media key out of shape');
};

@Injectable()
export class S3IntroductionMediaStore implements IntroductionMediaObjectStore {
  private readonly config: StoreConfig | null;
  private readonly client: S3Client | null;

  constructor() {
    this.config = configFrom(process.env);
    this.client = this.config === null ? null : new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey },
      // Only the checksums the protocol requires: S3-compatible servers differ on the optional ones.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 1,
    });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private s3(): { client: S3Client; bucket: string } {
    if (this.client === null || this.config === null) throw new Error('introduction media store is not configured');
    return { client: this.client, bucket: this.config.bucket };
  }

  async put(key: string, bytes: Buffer, signal: AbortSignal): Promise<void> {
    assertKey(key);
    const { client, bucket } = this.s3();
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: bytes, ContentType: 'image/jpeg', ContentLength: bytes.length,
    }), { abortSignal: signal });
  }

  async get(key: string, signal: AbortSignal): Promise<Buffer | null> {
    assertKey(key);
    const { client, bucket } = this.s3();
    try {
      const answer = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
      if (!answer.Body) return null;
      return Buffer.from(await answer.Body.transformToByteArray());
    } catch (error) {
      if (isMissing(error)) return null;
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
      if (isMissing(error)) return false;
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
      if (!isMissing(error)) throw error;
    }
  }

  async listOlderThan(olderThan: Date, continuation: string | null, signal: AbortSignal): Promise<{ keys: string[]; next: string | null }> {
    const { client, bucket } = this.s3();
    const answer = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: INTRODUCTION_MEDIA_PREFIX, MaxKeys: 500, ...(continuation ? { ContinuationToken: continuation } : {}),
    }), { abortSignal: signal });
    const keys = (answer.Contents ?? [])
      .filter((o) => typeof o.Key === 'string' && KEY.test(o.Key) && o.LastModified instanceof Date && o.LastModified < olderThan)
      .map((o) => o.Key as string);
    return { keys, next: answer.IsTruncated && answer.NextContinuationToken ? answer.NextContinuationToken : null };
  }
}
