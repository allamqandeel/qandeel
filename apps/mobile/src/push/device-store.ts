/**
 * A3-02 — what THIS installation remembers about notifications, on the device only.
 *
 * > **Device-local. Its own database. No account data, no token, no hardware identifier.**
 *
 *   - the installation id: a random UUID this app creates for itself on first use. It is what lets the server keep ONE
 *     registration per installation and move it when another account signs in here. It is not hardware identity and
 *     not user identity;
 *   - whether QANDEEL has ever shown the OS prompt on this installation. Android 13+ reports a never-asked notification
 *     permission exactly as a refused one (`denied`, may ask again), so this is how a first ask is told from a refusal;
 *   - the education decision: the reader said "Not now" to QANDEEL's permission education on this device. After that,
 *     QANDEEL does not ask again by itself (I-08N-01 D50, P3 §11); only the reader's own visit to Device Notification
 *     Settings offers it again. The OS permission itself is the platform's, read live, never cached here.
 *
 * The mechanism is the officially documented `expo-sqlite/kv-store` the auth, recovery and appearance stores already use,
 * in its OWN database file, so it can never read or clobber any of theirs. The push token is never stored here.
 */
import { SQLiteStorage } from 'expo-sqlite/kv-store';

export const PUSH_DATABASE_NAME = 'qandeel-push.db';
const INSTALLATION_KEY = 'qandeel.push.installation.v1';
const EDUCATION_KEY = 'qandeel.push.education.v1';
const PROMPT_KEY = 'qandeel.push.os-prompt.v1';

export interface PushDeviceStore {
  installationId(): string;
  educationDeclined(): boolean;
  declineEducation(): void;
  osPromptShown(): boolean;
  markOsPromptShown(): void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** Random bytes: the platform's cryptographic source where the runtime has one, else `Math.random` (an id, not a secret). */
function randomBytes(bytes: Uint8Array): Uint8Array {
  const source = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (typeof source?.getRandomValues === 'function') return source.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** A version-4 UUID. */
export function newInstallationId(random: (bytes: Uint8Array) => Uint8Array = randomBytes): string {
  const b = random(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createPushDeviceStore(databaseName: string = PUSH_DATABASE_NAME): PushDeviceStore {
  let storage: SQLiteStorage | null = null;
  const open = () => (storage ??= new SQLiteStorage(databaseName));
  return {
    installationId() {
      const existing = open().getItemSync(INSTALLATION_KEY);
      if (typeof existing === 'string' && UUID.test(existing)) return existing;
      const created = newInstallationId();
      open().setItemSync(INSTALLATION_KEY, created);
      return created;
    },
    educationDeclined: () => open().getItemSync(EDUCATION_KEY) === 'DECLINED',
    declineEducation: () => open().setItemSync(EDUCATION_KEY, 'DECLINED'),
    osPromptShown: () => open().getItemSync(PROMPT_KEY) === 'SHOWN',
    markOsPromptShown: () => open().setItemSync(PROMPT_KEY, 'SHOWN'),
  };
}

/** The same contract in memory, for the focused tests and the validation proof. */
export function createEphemeralPushDeviceStore(initial: { readonly installationId?: string; readonly declined?: boolean; readonly prompted?: boolean } = {}): PushDeviceStore {
  let id = initial.installationId ?? null;
  let declined = initial.declined ?? false;
  let prompted = initial.prompted ?? false;
  return {
    installationId: () => (id ??= newInstallationId()),
    educationDeclined: () => declined,
    declineEducation: () => { declined = true; },
    osPromptShown: () => prompted,
    markOsPromptShown: () => { prompted = true; },
  };
}
