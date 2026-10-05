import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * S4-01 — the owner-readable Shared ID, sealed by the server.
 *
 * The database stores the CURRENT Shared ID only as an AES-256-GCM ciphertext it cannot open (migration 0138). The key
 * material is server configuration — never the repository, never the database or its backups:
 *
 *   QANDEEL_SHARED_ID_SEALING_KEYS            `1:<base64 32 bytes>[,2:<base64 32 bytes>…]` — every version still able
 *                                              to open a stored value;
 *   QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION  the version new values are sealed under.
 *
 * Missing, malformed or partial configuration fails CLOSED: nothing is sealed, nothing is opened, and no clear value is
 * ever stored or returned instead. The additional authenticated data binds a ciphertext to the account, the credential
 * epoch and the key version, so a stored row cannot be replayed onto another account or epoch, and a decryption is
 * shown only after its value re-derives the exact lookup reference the database holds (0129's `sid1:` + SHA-256).
 */
export interface SealedSharedId {
  readonly keyVersion: number;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

export class SharedIdSealingUnavailable extends Error {
  constructor() {
    super('Shared ID sealing is not configured.');
  }
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CANONICAL = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/u;
const MAX_VERSION = 32767;

/** A fresh canonical Shared ID: 12 Crockford base-32 characters (60 bits) from the strong random source, 3 × 4. */
export function drawSharedId(): string {
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
    if (i === 3 || i === 7) out += '-';
  }
  return out;
}

/** 0129's lookup reference of a canonical Shared ID. */
export function sharedIdLookupRef(canonical: string): string {
  return `sid1:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

const aad = (userId: string, epoch: string, keyVersion: number) => Buffer.from(`qandeel.shared-id.v1|${userId}|${epoch}|${keyVersion}`, 'utf8');

interface SealingKeys {
  readonly active: number;
  readonly keys: ReadonlyMap<number, Buffer>;
}

/** Parses the configuration, or null when it is absent or wrong in any way. Never logs a key. */
export function parseSealingKeys(env: NodeJS.ProcessEnv): SealingKeys | null {
  const raw = env.QANDEEL_SHARED_ID_SEALING_KEYS;
  const activeRaw = env.QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION;
  if (typeof raw !== 'string' || typeof activeRaw !== 'string' || !/^[1-9][0-9]{0,4}$/u.test(activeRaw.trim())) return null;
  const keys = new Map<number, Buffer>();
  for (const entry of raw.split(',')) {
    const match = /^\s*([1-9][0-9]{0,4}):([A-Za-z0-9+/]{43}=)\s*$/u.exec(entry);
    if (!match) return null;
    const version = Number(match[1]);
    const key = Buffer.from(match[2], 'base64');
    if (version > MAX_VERSION || key.length !== 32 || keys.has(version)) return null;
    keys.set(version, key);
  }
  const active = Number(activeRaw.trim());
  return keys.has(active) ? { active, keys } : null;
}

@Injectable()
export class SharedIdSealing {
  private readonly config: SealingKeys | null;

  constructor() {
    this.config = parseSealingKeys(process.env);
  }

  get available(): boolean {
    return this.config !== null;
  }

  /** Seals a canonical Shared ID for exactly this account and the epoch the rotation will produce. */
  seal(userId: string, nextEpoch: string, canonical: string): SealedSharedId {
    const config = this.config;
    if (config === null) throw new SharedIdSealingUnavailable();
    if (!CANONICAL.test(canonical)) throw new Error('SHARED_ID_NOT_CANONICAL');
    const key = config.keys.get(config.active) as Buffer;
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad(userId, nextEpoch, config.active));
    const ciphertext = Buffer.concat([cipher.update(canonical, 'utf8'), cipher.final()]);
    return { keyVersion: config.active, nonce, ciphertext, tag: cipher.getAuthTag() };
  }

  /**
   * Opens a stored value, or null when it cannot be proved to be the current Shared ID: an unknown key version, a
   * failed authentication, a non-canonical plaintext, or a value whose reference is not the one the database holds.
   */
  open(userId: string, epoch: string, lookupRef: string, sealed: SealedSharedId): string | null {
    const config = this.config;
    if (config === null) throw new SharedIdSealingUnavailable();
    const key = config.keys.get(sealed.keyVersion);
    if (key === undefined || sealed.nonce.length !== 12 || sealed.tag.length !== 16) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, sealed.nonce);
      decipher.setAAD(aad(userId, epoch, sealed.keyVersion));
      decipher.setAuthTag(sealed.tag);
      const value = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString('utf8');
      return CANONICAL.test(value) && sharedIdLookupRef(value) === lookupRef ? value : null;
    } catch {
      return null;
    }
  }
}
