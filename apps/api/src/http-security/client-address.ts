import { isIP } from 'node:net';

/**
 * PROD-SEC-01 (SEC-B) — the ONE authority for "which address is this client?".
 *
 * The answer is security authority, not metadata: it keys QANDEEL's own rate limits and it is forwarded to Supabase
 * Auth as `Sb-Forwarded-For`, where it keys the provider's per-IP limits. So it is never read from a forwarding header
 * by hand, never accepted from a body, query or route parameter, and never decided per request.
 *
 * Express resolves it, once, from a topology fixed at startup:
 *
 *   direct         the API is reached by the client itself. `trust proxy` is false: the socket peer is the client, and
 *                  every `X-Forwarded-For` is ignored, forged or not.
 *   trusted_proxy  the API sits behind reverse proxies whose addresses are listed EXPLICITLY (IP or CIDR). Express
 *                  trusts only those peers, walks `X-Forwarded-For` from the socket outward, and stops at the first
 *                  address it does not trust; that address is the client. A forwarding header arriving from any other
 *                  peer is ignored, so an untrusted peer can never name a client.
 *
 * `trust proxy = true` (trust the left-most, client-writable entry) and a numeric hop count (correct only while every
 * path to the origin has the same length) are never produced here. A provider-specific header such as
 * `CF-Connecting-IP` is not an authority either: the edge contract (LAUNCH-EDGE-SECURITY-GATE) chooses the topology,
 * and this file only consumes it as an address list.
 */
export type ProxyMode = 'direct' | 'trusted_proxy';

export interface ProxyConfiguration {
  readonly mode: ProxyMode;
  /** Literal IP addresses / CIDR ranges, validated. Empty exactly when `mode` is `direct`. */
  readonly trustedProxies: readonly string[];
}

export const PROXY_MODE_VARIABLE = 'QANDEEL_API_PROXY_MODE';
export const TRUSTED_PROXIES_VARIABLE = 'QANDEEL_API_TRUSTED_PROXIES';

export class ProxyConfigurationError extends Error {
  constructor(reason: string) {
    // The reason names a variable and a rule, never a configured value.
    super(`PROXY_CONFIGURATION_INVALID: ${reason}`);
    this.name = 'ProxyConfigurationError';
  }
}

/**
 * Only an explicit local run relaxes a security requirement. ANY other NODE_ENV - `production`, a typo, or none at all -
 * is held to production's rules, so a deployment that forgets NODE_ENV fails closed instead of starting unconfigured.
 */
export function isLocalEnvironment(environment: Readonly<Record<string, string | undefined>>): boolean {
  return environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test';
}

/**
 * Parse the topology once, at startup. Outside an explicit local run the mode must be stated; in a local run an absent
 * mode is `direct`, which trusts nothing. A stated value is validated everywhere: a typo never degrades silently.
 */
export function parseProxyConfiguration(environment: Readonly<Record<string, string | undefined>>): ProxyConfiguration {
  const production = !isLocalEnvironment(environment);
  const rawMode = environment[PROXY_MODE_VARIABLE]?.trim() ?? '';
  const rawList = environment[TRUSTED_PROXIES_VARIABLE]?.trim() ?? '';

  if (rawMode === '') {
    if (production) throw new ProxyConfigurationError(`${PROXY_MODE_VARIABLE} must be set explicitly outside a local run (direct | trusted_proxy)`);
    if (rawList !== '') throw new ProxyConfigurationError(`${TRUSTED_PROXIES_VARIABLE} is set but ${PROXY_MODE_VARIABLE} is not trusted_proxy`);
    return { mode: 'direct', trustedProxies: [] };
  }
  if (rawMode === 'direct') {
    if (rawList !== '') throw new ProxyConfigurationError(`${TRUSTED_PROXIES_VARIABLE} must be empty in direct mode`);
    return { mode: 'direct', trustedProxies: [] };
  }
  if (rawMode !== 'trusted_proxy') throw new ProxyConfigurationError(`${PROXY_MODE_VARIABLE} must be direct or trusted_proxy`);

  const entries = rawList.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '');
  if (entries.length === 0) throw new ProxyConfigurationError(`${TRUSTED_PROXIES_VARIABLE} must list at least one proxy IP or CIDR in trusted_proxy mode`);
  for (const entry of entries) {
    if (!isTrustableProxyEntry(entry)) {
      throw new ProxyConfigurationError(`${TRUSTED_PROXIES_VARIABLE} accepts literal IP addresses or CIDR ranges only, with a non-zero prefix`);
    }
  }
  return { mode: 'trusted_proxy', trustedProxies: [...new Set(entries)] };
}

/**
 * A literal address or a CIDR range. A zero-length prefix (`0.0.0.0/0`, `::/0`) trusts every peer and is exactly
 * `trust proxy = true` under another name, so it is refused, as are Express's named ranges: the list names hosts. An
 * IPv4-mapped IPv6 entry (`::ffff:0.0.0.0/96`) is refused too - it can cover every IPv4 peer; write the IPv4 form.
 */
export function isTrustableProxyEntry(entry: string): boolean {
  const slash = entry.indexOf('/');
  const address = slash === -1 ? entry : entry.slice(0, slash);
  const version = isIP(address);
  if (version === 0) return false;
  if (version === 6 && isIpv4MappedIpv6(address)) return false;
  if (slash === -1) return true;
  const prefixText = entry.slice(slash + 1);
  if (!/^[0-9]{1,3}$/u.test(prefixText)) return false;
  const prefix = Number(prefixText);
  return prefix >= 1 && prefix <= (version === 4 ? 32 : 128);
}

/** `::ffff:a.b.c.d` in any spelling: the first five hextets zero and the sixth `ffff`. */
function isIpv4MappedIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  const tail = lower.slice(lower.lastIndexOf(':') + 1);
  const head = tail.includes('.') ? `${lower.slice(0, lower.lastIndexOf(':') + 1)}0:0` : lower;
  const [left, right] = head.includes('::') ? head.split('::') : [head, null];
  const leftParts = left === '' ? [] : left.split(':');
  const rightParts = right === null || right === '' ? [] : right.split(':');
  const hextets = right === null ? leftParts : [...leftParts, ...Array(8 - leftParts.length - rightParts.length).fill('0'), ...rightParts];
  return hextets.length === 8 && hextets.slice(0, 5).every((part) => parseInt(part, 16) === 0) && parseInt(hextets[5], 16) === 0xffff;
}

/** The value given to Express. `false` or an explicit list — never `true`, never a number. */
export function expressTrustProxySetting(configuration: ProxyConfiguration): false | string[] {
  return configuration.mode === 'direct' ? false : [...configuration.trustedProxies];
}

/**
 * The client address of a request, as Express resolved it under the startup topology, normalized: an IPv4-mapped IPv6
 * address becomes its IPv4 form and an IPv6 zone is dropped, so the same client is one address for QANDEEL's limits
 * and for the provider's. `undefined` when there is no valid address — callers fail closed on that.
 */
export function clientAddressOf(request: { readonly ip?: unknown }): string | undefined {
  const raw = request.ip;
  if (typeof raw !== 'string' || raw === '') return undefined;
  const zone = raw.indexOf('%');
  const bare = (zone === -1 ? raw : raw.slice(0, zone)).toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(bare);
  const address = mapped ? mapped[1] : bare;
  return isIP(address) === 0 ? undefined : address;
}
