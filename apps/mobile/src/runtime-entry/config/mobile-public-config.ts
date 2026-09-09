/**
 * T-12P §2.3 — the one typed, validated mobile public-config authority.
 *
 * Three facts are public mobile configuration rather than secrets: the QANDEEL API base URL, the
 * Supabase project URL and the Supabase publishable key. They reach the bundle through
 * `app.config.js` -> Expo `extra` -> `expo-constants`, and they reach Product code only as the
 * validated `MobilePublicConfig` object built here.
 *
 * This module is the ONLY place in the mobile runtime that reads the ambient Expo config. Nothing
 * downstream reads `expo-constants`, and nothing anywhere in mobile production reads `process.env`
 * — that would scatter the trust boundary the contract exists to concentrate.
 *
 * Fail closed: a missing, blank, non-string or malformed value produces a typed failure naming the
 * exact keys at fault. It never produces a partial config, and it never substitutes a default
 * origin. A build that was never configured must not silently talk to the wrong backend.
 */
import Constants from 'expo-constants';

export interface MobilePublicConfig {
  /** Origin plus any base path, without a trailing slash — the shape both T-03 transports expect. */
  readonly apiBaseUrl: string;
  /** The Supabase project URL, without a trailing slash. */
  readonly supabaseUrl: string;
  /**
   * The Supabase PUBLISHABLE key. Supabase documents this key as safe to ship in a mobile bundle
   * because it resolves to the `anon` / `authenticated` Postgres roles and Row Level Security — not
   * the key — is the actual boundary. A secret key bypasses RLS and is rejected below.
   */
  readonly supabasePublishableKey: string;
}

/** The exact `extra` keys this authority reads, in the order they are reported. */
export const MOBILE_PUBLIC_CONFIG_KEYS = Object.freeze([
  'qandeelApiBaseUrl',
  'supabaseUrl',
  'supabasePublishableKey',
] as const);

export type MobilePublicConfigKey = (typeof MOBILE_PUBLIC_CONFIG_KEYS)[number];

export type MobilePublicConfigFailure =
  /** One or more keys are absent, blank or not a string. */
  | { readonly kind: 'MISSING'; readonly keys: readonly MobilePublicConfigKey[] }
  /** A key is present but cannot be used as given. */
  | { readonly kind: 'MALFORMED'; readonly key: MobilePublicConfigKey; readonly detail: string }
  /** A value that must never ship in a client bundle was found in public config. */
  | { readonly kind: 'FORBIDDEN_SECRET'; readonly key: MobilePublicConfigKey; readonly detail: string }
  /**
   * The value is not a documented publishable key shape. Refused rather than passed through: an
   * unrecognised key is not evidence of safety, and the SDK is not the right place to find out.
   */
  | { readonly kind: 'UNSUPPORTED_KEY_SHAPE'; readonly key: MobilePublicConfigKey; readonly detail: string };

export type MobilePublicConfigResult =
  | { readonly ok: true; readonly config: MobilePublicConfig }
  | { readonly ok: false; readonly failure: MobilePublicConfigFailure };

/**
 * The two documented Supabase key prefixes. `sb_publishable_` is the ONLY new-format key that may
 * ship; `sb_secret_` bypasses every Row Level Security policy, so finding one in public config is a
 * build accident that must fail the runtime rather than ship.
 */
const PUBLISHABLE_KEY_PREFIX = 'sb_publishable_';
const SECRET_KEY_PREFIX = 'sb_secret_';

/**
 * The documented body of a new-format key, everything after the prefix:
 *
 *     sb_publishable_<22-char-random>_<8-char-checksum>
 *
 * Supabase's self-hosting auth-keys guide states this structure and that self-hosted keys use the
 * same format as platform API keys. Both components have a fixed documented length, which makes
 * them non-empty by construction and fixes the separator at a known offset.
 */
const PUBLISHABLE_RANDOM_LENGTH = 22;
const PUBLISHABLE_CHECKSUM_LENGTH = 8;
const PUBLISHABLE_COMPONENT_SEPARATOR = '_';
const PUBLISHABLE_BODY_LENGTH =
  PUBLISHABLE_RANDOM_LENGTH + PUBLISHABLE_COMPONENT_SEPARATOR.length + PUBLISHABLE_CHECKSUM_LENGTH;

/**
 * The only role a key in this slot may carry.
 *
 * A LEGACY Supabase key is a JWT, and its privilege lives in the `role` claim inside the base64url
 * payload — NOT as plain text. A substring scan for `service_role` therefore misses the exact
 * mistake it is meant to catch, so the claim is decoded and checked. `anon` is the legacy
 * equivalent of a publishable key and is the only acceptable value: `service_role` bypasses RLS,
 * and `authenticated` would mean somebody pasted a USER's access token into build config.
 */
const ALLOWED_LEGACY_ROLE = 'anon';

/**
 * R2-02 — is this a usable opaque token: non-empty, printable non-space ASCII throughout?
 *
 * Applied to BOTH the key and the origins, because every one of them is interpolated into a request
 * URL or an HTTP header, where a stray space, newline or control character is a correctness and
 * injection concern rather than a cosmetic one. (An internationalised hostname must therefore be
 * supplied in punycode, which is what a URL carries on the wire anyway.)
 *
 * This is the CHARACTER rule only, and it runs before any shape is classified, so a value carrying
 * whitespace or a control character is refused whatever prefix it wears. The new-format key's
 * STRUCTURE — the documented component lengths and separator — is a separate check below.
 *
 * No character ALPHABET is imposed on top of this. Supabase documents the lengths and the separator
 * but names no character set for either component, so a guessed alphabet (base64url, base58) could
 * reject a valid production key and take the app down. This rule cannot: anything Supabase could
 * legally place in an HTTP header value passes it. The security question "is this a secret?" is
 * answered separately and exactly, by the `sb_secret_` prefix and the legacy role claim.
 */
function isOpaqueKeyToken(value: string): boolean {
  if (value.length === 0) return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    // 0x21 '!' .. 0x7E '~': excludes space, every control character and everything non-ASCII.
    if (code < 0x21 || code > 0x7e) return false;
  }
  return true;
}

/**
 * Does the new-format body match the documented structure?
 *
 * Checked POSITIONALLY rather than by splitting on `_`, deliberately: no alphabet is documented for
 * either component, so a component may itself contain an underscore, and a `split('_')` rule would
 * then reject a structurally valid key. The documented lengths fix the separator's offset exactly,
 * which is the one reading that cannot be wrong.
 *
 * What is NOT done here: the checksum is not verified. No algorithm is documented for it — the
 * self-hosting guide notes the API gateway itself does not validate it — and guessing one would be
 * inventing cryptography. This is local fail-closed config validation of STRUCTURE; whether the key
 * is genuine stays Supabase's answer to give.
 */
function hasDocumentedPublishableBody(value: string): boolean {
  const body = value.slice(PUBLISHABLE_KEY_PREFIX.length);
  return (
    body.length === PUBLISHABLE_BODY_LENGTH &&
    body.charAt(PUBLISHABLE_RANDOM_LENGTH) === PUBLISHABLE_COMPONENT_SEPARATOR
  );
}

/** Does this look like a JWT at all? Three dot-separated non-empty segments. */
function looksLikeJwt(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * The `role` claim of a legacy key, or `null` when the payload cannot be read as one.
 *
 * `null` is NOT "probably fine": R1-04 requires an undecodable or role-less JWT to be refused, so
 * the caller treats `null` as an unusable shape rather than as an absent objection. Nothing here
 * verifies the signature — classifying public build config does not make the app a JWT trust
 * authority, and a forged key simply fails against Supabase.
 */
function legacyRoleClaim(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    if (typeof atob !== 'function') return null;
    const claims: unknown = JSON.parse(atob(padded));
    const role = (claims as { role?: unknown } | null)?.role;
    return typeof role === 'string' && role !== '' ? role : null;
  } catch {
    return null;
  }
}

/** Loopback hosts, the ONLY place a cleartext origin may ever point (and only behind the seam). */
const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]', '::1'];

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return LOOPBACK_HOSTS.includes(host) || host.endsWith('.localhost');
}

function readExtra(): Record<string, unknown> {
  const extra: unknown = Constants.expoConfig?.extra;
  return extra !== null && typeof extra === 'object' && !Array.isArray(extra)
    ? (extra as Record<string, unknown>)
    : {};
}

/**
 * R1-04B — an origin must be HTTPS.
 *
 * Every request built on these origins carries a bearer token, and the sign-in that produces it
 * carries a password. A cleartext remote origin would put both on the wire. `http:` is therefore
 * refused outright unless the caller has explicitly opened the development seam AND the host is
 * loopback — an arbitrary remote `http://…` can never be valid config, with or without the seam.
 */
function absoluteUrlIssue(value: string, allowLoopbackHttp: boolean): string | null {
  // Refused rather than trimmed: this string is concatenated into every request URL, so a stray
  // space or newline is a broken request, not a formatting detail.
  if (!isOpaqueKeyToken(value)) {
    return 'must not contain whitespace, a control character or a non-ASCII character';
  }
  if (value.endsWith('/')) {
    return 'must not end with "/": the transports append their own path segments';
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'must be an absolute URL';
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return 'must not carry a query string or fragment';
  }
  if (parsed.protocol === 'https:') return null;
  if (parsed.protocol !== 'http:') {
    return `must use https, not "${parsed.protocol}"`;
  }
  if (!allowLoopbackHttp) {
    return 'must use https: a cleartext origin would put the access token and the password on the wire';
  }
  if (!isLoopback(parsed.hostname)) {
    return `must use https: the development http seam admits loopback hosts only, not "${parsed.hostname}"`;
  }
  return null;
}

/**
 * Build the validated public config from the ambient Expo config.
 *
 * `source` exists so the rules can be proven against explicit inputs; production passes nothing and
 * reads the real `expoConfig.extra`.
 */
export interface MobilePublicConfigOptions {
  /**
   * Open the narrow development seam that admits a CLEARTEXT LOOPBACK origin.
   *
   * Off by default, so the production reader can never accept `http://`. Even when opened it admits
   * loopback hosts only — it is a local-development affordance, never a way to make a remote
   * cleartext origin valid.
   */
  readonly allowLoopbackHttp?: boolean;
}

export function readMobilePublicConfig(
  source?: Record<string, unknown>,
  options: MobilePublicConfigOptions = {},
): MobilePublicConfigResult {
  const extra = source ?? readExtra();
  const allowLoopbackHttp = options.allowLoopbackHttp === true;

  const missing: MobilePublicConfigKey[] = [];
  const values = {} as Record<MobilePublicConfigKey, string>;
  for (const key of MOBILE_PUBLIC_CONFIG_KEYS) {
    const raw: unknown = extra[key];
    if (typeof raw !== 'string' || raw.trim() === '') {
      missing.push(key);
      continue;
    }
    // Kept RAW, deliberately. Trimming would silently REPAIR a value that arrived with a stray
    // newline or tab from a build pipeline, and a config value that needed repairing is evidence
    // the pipeline is wrong. Every value here ends up in a URL or an HTTP header, where stray
    // whitespace is a correctness and injection concern rather than a cosmetic one, so it is
    // refused below instead.
    values[key] = raw;
  }
  if (missing.length > 0) return { ok: false, failure: { kind: 'MISSING', keys: missing } };

  for (const key of ['qandeelApiBaseUrl', 'supabaseUrl'] as const) {
    const issue = absoluteUrlIssue(values[key], allowLoopbackHttp);
    if (issue !== null) return { ok: false, failure: { kind: 'MALFORMED', key, detail: issue } };
  }

  // R1-04A — an ALLOWLIST, not a denylist. Only two shapes are documented as publishable, so
  // anything else fails closed rather than being handed to the SDK to find out. Neither branch ever
  // echoes the value.
  const publishable = values.supabasePublishableKey;
  const forbidden = (detail: string): MobilePublicConfigResult => ({
    ok: false,
    failure: { kind: 'FORBIDDEN_SECRET', key: 'supabasePublishableKey', detail },
  });
  const unsupported = (detail: string): MobilePublicConfigResult => ({
    ok: false,
    failure: { kind: 'UNSUPPORTED_KEY_SHAPE', key: 'supabasePublishableKey', detail },
  });

  // R2-02: every accepted shape is an opaque token that will be sent as an HTTP header value, so
  // whitespace, control characters and non-ASCII are refused before the shape is classified at all.
  if (!isOpaqueKeyToken(publishable)) {
    return unsupported('a key containing whitespace, a control character or a non-ASCII character');
  }
  if (publishable.startsWith(SECRET_KEY_PREFIX)) {
    return forbidden(`an elevated Supabase key was supplied as public config (prefix "${SECRET_KEY_PREFIX}")`);
  }
  if (publishable.startsWith(PUBLISHABLE_KEY_PREFIX)) {
    // The prefix is necessary, not sufficient. The bare prefix carries no key at all, and an
    // arbitrary suffix is not a key either — the documented structure is the fail-closed boundary.
    if (!hasDocumentedPublishableBody(publishable)) {
      return unsupported(
        `a new-format key whose body is not the documented ${PUBLISHABLE_RANDOM_LENGTH}-character random component, ` +
          `"${PUBLISHABLE_COMPONENT_SEPARATOR}", ${PUBLISHABLE_CHECKSUM_LENGTH}-character checksum`,
      );
    }
  } else {
    if (!looksLikeJwt(publishable)) {
      return unsupported(`not a "${PUBLISHABLE_KEY_PREFIX}…" key and not a legacy key`);
    }
    const role = legacyRoleClaim(publishable);
    if (role === null) {
      return unsupported('a legacy key whose role claim could not be read');
    }
    if (role !== ALLOWED_LEGACY_ROLE) {
      return forbidden(`a legacy Supabase key with the "${role}" role was supplied as public config`);
    }
  }

  return {
    ok: true,
    config: {
      apiBaseUrl: values.qandeelApiBaseUrl,
      supabaseUrl: values.supabaseUrl,
      supabasePublishableKey: publishable,
    },
  };
}

/** A reader-free description of a config failure. Never contains a configured value. */
export function describeConfigFailure(failure: MobilePublicConfigFailure): string {
  switch (failure.kind) {
    case 'MISSING':
      return `mobile public config is missing: ${failure.keys.join(', ')}`;
    case 'MALFORMED':
      return `mobile public config ${failure.key} ${failure.detail}`;
    case 'FORBIDDEN_SECRET':
    case 'UNSUPPORTED_KEY_SHAPE':
      return `mobile public config ${failure.key}: ${failure.detail}`;
  }
}
