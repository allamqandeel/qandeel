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
  | { readonly kind: 'FORBIDDEN_SECRET'; readonly key: MobilePublicConfigKey; readonly detail: string };

export type MobilePublicConfigResult =
  | { readonly ok: true; readonly config: MobilePublicConfig }
  | { readonly ok: false; readonly failure: MobilePublicConfigFailure };

/**
 * The prefix Supabase gives a new-format elevated key. Such a key bypasses every Row Level Security
 * policy, so finding one in public config is a build accident that must fail the runtime rather
 * than ship.
 */
const FORBIDDEN_KEY_PREFIXES: readonly string[] = ['sb_secret_'];

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

function legacyRoleClaim(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    if (typeof atob !== 'function') return null;
    const claims: unknown = JSON.parse(atob(padded));
    const role = (claims as { role?: unknown } | null)?.role;
    return typeof role === 'string' ? role : null;
  } catch {
    // An undecodable payload is not evidence of an elevated key; the prefix check still applies.
    return null;
  }
}

function readExtra(): Record<string, unknown> {
  const extra: unknown = Constants.expoConfig?.extra;
  return extra !== null && typeof extra === 'object' && !Array.isArray(extra)
    ? (extra as Record<string, unknown>)
    : {};
}

function absoluteUrlIssue(value: string): string | null {
  if (value.endsWith('/')) {
    return 'must not end with "/": the transports append their own path segments';
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'must be an absolute URL';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return `must use http or https, not "${parsed.protocol}"`;
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return 'must not carry a query string or fragment';
  }
  return null;
}

/**
 * Build the validated public config from the ambient Expo config.
 *
 * `source` exists so the rules can be proven against explicit inputs; production passes nothing and
 * reads the real `expoConfig.extra`.
 */
export function readMobilePublicConfig(source?: Record<string, unknown>): MobilePublicConfigResult {
  const extra = source ?? readExtra();

  const missing: MobilePublicConfigKey[] = [];
  const values = {} as Record<MobilePublicConfigKey, string>;
  for (const key of MOBILE_PUBLIC_CONFIG_KEYS) {
    const raw: unknown = extra[key];
    if (typeof raw !== 'string' || raw.trim() === '') {
      missing.push(key);
      continue;
    }
    values[key] = raw.trim();
  }
  if (missing.length > 0) return { ok: false, failure: { kind: 'MISSING', keys: missing } };

  for (const key of ['qandeelApiBaseUrl', 'supabaseUrl'] as const) {
    const issue = absoluteUrlIssue(values[key]);
    if (issue !== null) return { ok: false, failure: { kind: 'MALFORMED', key, detail: issue } };
  }

  // Refusing an elevated key here is the cheapest possible place to catch the one build mistake
  // that would be catastrophic rather than merely broken. Neither branch ever echoes the value.
  const publishable = values.supabasePublishableKey;
  for (const prefix of FORBIDDEN_KEY_PREFIXES) {
    if (publishable.startsWith(prefix)) {
      return {
        ok: false,
        failure: {
          kind: 'FORBIDDEN_SECRET',
          key: 'supabasePublishableKey',
          detail: `an elevated Supabase key was supplied as public config (prefix "${prefix}")`,
        },
      };
    }
  }
  const role = legacyRoleClaim(publishable);
  if (role !== null && role !== ALLOWED_LEGACY_ROLE) {
    return {
      ok: false,
      failure: {
        kind: 'FORBIDDEN_SECRET',
        key: 'supabasePublishableKey',
        detail: `a legacy Supabase key with the "${role}" role was supplied as public config`,
      },
    };
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
      return `mobile public config ${failure.key}: ${failure.detail}`;
  }
}
