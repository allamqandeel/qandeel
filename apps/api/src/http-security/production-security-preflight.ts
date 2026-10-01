import { isLocalEnvironment, parseProxyConfiguration, ProxyConfigurationError, type ProxyConfiguration } from './client-address';

/**
 * PROD-SEC-01 (SEC-D) — the production security configuration preflight, run by `main.ts` before the application is
 * created. A production process that cannot keep its own security contracts refuses to start, instead of starting and
 * failing each affected request closed one at a time.
 *
 * Production must state, explicitly:
 *   SUPABASE_URL              an https URL;
 *   SUPABASE_PUBLISHABLE_KEY  the client-safe key the API's own Data API calls present;
 *   SUPABASE_SERVICE_ROLE_KEY the server-only authority key;
 *   SUPABASE_SECRET_KEY       the ONLY key that carries `Sb-Forwarded-For` (Supabase Auth honours the forwarded reader
 *                             address only with a secret key; publishable and legacy anon / service_role keys are not
 *                             honoured). It may not be the publishable key, any publishable key, or a legacy anon /
 *                             service_role JWT - there is no fallback credential. (One new-format secret key may serve
 *                             as both this and SUPABASE_SERVICE_ROLE_KEY: that is a secret key, which is what is needed.)
 *   QANDEEL_API_PROXY_MODE    the proxy topology (SEC-B), with its trusted list when `trusted_proxy`.
 *
 * The secret key's own format is NOT pinned: Supabase may evolve it. The refusals are semantic — equality with another
 * key, a declared publishable prefix, a legacy JWT whose role claim is anon or service_role.
 *
 * What the repository cannot observe — that the hosted project has Authentication → Rate Limits → IP address forwarding
 * enabled — is a launch proof owned by `LAUNCH-EDGE-SECURITY-GATE`.
 *
 * Errors name variables and rules only. No value, prefix or length of any secret is ever printed.
 *
 * "Production" is every environment that is not an explicit local run (NODE_ENV development or test): a deployment that
 * forgets NODE_ENV is held to these rules rather than starting unconfigured. A local run keeps the partial configuration it relies on, and
 * the routes that need a missing key keep failing closed per request exactly as before.
 */
export class ProductionSecurityConfigurationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`PRODUCTION_SECURITY_CONFIGURATION_INVALID: ${problems.join('; ')}`);
    this.name = 'ProductionSecurityConfigurationError';
  }
}

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'] as const;

export interface ProductionSecurityConfiguration {
  readonly proxy: ProxyConfiguration;
}

export function runSecurityPreflight(environment: Readonly<Record<string, string | undefined>>): ProductionSecurityConfiguration {
  const problems: string[] = [];
  let proxy: ProxyConfiguration | undefined;
  try {
    proxy = parseProxyConfiguration(environment);
  } catch (error) {
    if (!(error instanceof ProxyConfigurationError)) throw error;
    problems.push(error.message);
  }

  if (!isLocalEnvironment(environment)) {
    const value = (name: string) => environment[name]?.trim() ?? '';
    for (const name of REQUIRED) if (value(name) === '') problems.push(`${name} is required in production`);

    const url = value('SUPABASE_URL');
    if (url !== '' && !isHttpsUrl(url)) problems.push('SUPABASE_URL must be an https URL in production');

    const secret = value('SUPABASE_SECRET_KEY');
    if (secret !== '') {
      if (secret === value('SUPABASE_PUBLISHABLE_KEY')) problems.push('SUPABASE_SECRET_KEY must not be the publishable key');
      if (secret.startsWith('sb_publishable_')) problems.push('SUPABASE_SECRET_KEY must not be a publishable key');
      const legacyRole = legacyJwtRoleOf(secret);
      if (legacyRole === 'anon' || legacyRole === 'service_role') problems.push('SUPABASE_SECRET_KEY must not be a legacy anon or service_role key');
    }
  }

  if (problems.length > 0 || proxy === undefined) throw new ProductionSecurityConfigurationError(problems);
  return { proxy };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The `role` claim of a legacy Supabase JWT API key, read without verifying anything; `null` for anything else. */
function legacyJwtRoleOf(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
    const role = payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>).role : undefined;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}
