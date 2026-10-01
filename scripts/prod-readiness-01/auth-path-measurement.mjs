#!/usr/bin/env node
// PROD-READINESS-01 — auth request-path measurement harness. REVIEW EVIDENCE ONLY; not production code.
//
// Measures, against the repository's existing CI test project and its existing T-12 test account:
//   1. the project's JWT signing mode (public JWKS: key count, kty, alg — never key material);
//   2. the remote verification hop the API guard makes today (GET /auth/v1/user), cold and warm;
//   3. the invalid-token rejection path of the same hop;
//   4. a Data API round trip baseline (HEAD /rest/v1/, the readiness probe's own request);
//   5. local signature verification cost, when the JWKS makes it possible;
//   6. the revocation question: after this harness signs out ITS OWN session (scope=local), does the
//      remote hop refuse the token, and would a local signature/expiry check still accept it?
//
// Bounded: one sign-in, at most SAMPLES requests per measured hop, one sign-out of the session it created.
// Prints only timings, counts, booleans and claim NAMES. Never a token, a key, an email, a claim value.

const SAMPLES = 20;
const LOCAL_VERIFY_ITERATIONS = 500;

const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.T12_TEST_EMAIL_A;
const password = process.env.T12_TEST_PASSWORD_A;
if (!baseUrl || !publishableKey || !email || !password) {
  console.log(JSON.stringify({ outcome: 'NOT_CONFIGURED' }));
  process.exit(2);
}

const result = { outcome: 'MEASURED', samplesPerHop: SAMPLES, runner: `${process.platform}/${process.version}` };

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { n: sorted.length, min: round(sorted[0]), p50: round(at(0.5)), p95: round(at(0.95)), max: round(sorted[sorted.length - 1]) };
}
const round = (v) => Math.round(v * 10) / 10;

async function timed(fn) {
  const start = performance.now();
  const response = await fn();
  await response.arrayBuffer().catch(() => undefined);
  return { ms: performance.now() - start, status: response.status };
}

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

// 1. Signing mode.
const jwksResponse = await fetch(`${baseUrl}/auth/v1/.well-known/jwks.json`);
const jwks = jwksResponse.ok ? await jwksResponse.json().catch(() => null) : null;
const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
result.jwks = { status: jwksResponse.status, keyCount: keys.length, keys: keys.map((k) => ({ kty: k.kty, alg: k.alg ?? null, crv: k.crv ?? null, hasKid: typeof k.kid === 'string' })) };

// One sign-in of the existing test account (the same grant T-12 Phase M already performs).
const grant = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = grant.ok ? await grant.json().catch(() => null) : null;
const accessToken = typeof session?.access_token === 'string' ? session.access_token : null;
if (!accessToken) {
  result.outcome = 'SIGN_IN_FAILED';
  result.signInStatus = grant.status;
  console.log(JSON.stringify(result, null, 2));
  process.exit(3);
}
const [headerPart, payloadPart, signaturePart] = accessToken.split('.');
const header = b64urlJson(headerPart);
const claims = b64urlJson(payloadPart);
result.token = {
  alg: header.alg,
  hasKid: typeof header.kid === 'string',
  kidInJwks: keys.some((k) => k.kid === header.kid),
  claimNames: Object.keys(claims).sort(),
  lifetimeSeconds: typeof claims.exp === 'number' && typeof claims.iat === 'number' ? claims.exp - claims.iat : null,
};

const userHop = (token) => () => fetch(`${baseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` } });

// 2. The guard's remote hop, exactly as SupabaseAuthService makes it. Sample 0 is the cold (first) request.
const valid = [];
for (let i = 0; i < SAMPLES; i += 1) valid.push(await timed(userHop(accessToken)));
result.remoteVerify = { cold: round(valid[0].ms), warm: stats(valid.slice(1).map((s) => s.ms)), statuses: [...new Set(valid.map((s) => s.status))] };

// 3. Invalid-token path (a well-formed but unsigned token).
const forged = `${headerPart}.${payloadPart}.${Buffer.from('not-a-signature').toString('base64url')}`;
const invalid = [];
for (let i = 0; i < SAMPLES; i += 1) invalid.push(await timed(userHop(forged)));
result.remoteReject = { warm: stats(invalid.slice(1).map((s) => s.ms)), statuses: [...new Set(invalid.map((s) => s.status))] };

// 4. Data API round-trip baseline (the readiness probe's request).
const data = [];
for (let i = 0; i < SAMPLES; i += 1) data.push(await timed(() => fetch(`${baseUrl}/rest/v1/`, { method: 'HEAD', headers: { apikey: publishableKey } })));
result.dataApiBaseline = { cold: round(data[0].ms), warm: stats(data.slice(1).map((s) => s.ms)), statuses: [...new Set(data.map((s) => s.status))] };

// 5. Local verification cost — only possible with an asymmetric key published in the JWKS.
const jwk = keys.find((k) => k.kid === header.kid);
const algorithms = { ES256: { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }, RS256: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } };
let localVerify = null;
if (jwk && algorithms[header.alg]) {
  const algorithm = algorithms[header.alg];
  const importStart = performance.now();
  const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
  const importMs = performance.now() - importStart;
  const signed = Buffer.from(`${headerPart}.${payloadPart}`);
  const signature = Buffer.from(signaturePart, 'base64url');
  const verifyParams = algorithm.name === 'ECDSA' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: algorithm.name };
  const verifyOnce = () => crypto.subtle.verify(verifyParams, key, signature, signed);
  const ok = await verifyOnce();
  const start = performance.now();
  for (let i = 0; i < LOCAL_VERIFY_ITERATIONS; i += 1) await verifyOnce();
  const perVerifyMs = (performance.now() - start) / LOCAL_VERIFY_ITERATIONS;
  localVerify = { possible: true, signatureValid: ok, keyImportMs: round(importMs), perVerifyMs: Math.round(perVerifyMs * 1000) / 1000, iterations: LOCAL_VERIFY_ITERATIONS };
  localVerify.verifyOnce = verifyOnce;
} else {
  result.localVerify = { possible: false, reason: header.alg === 'HS256' ? 'HS256_SHARED_SECRET_NOT_PUBLISHED' : 'NO_MATCHING_ASYMMETRIC_JWK' };
}

// 6. Revocation: sign out THIS harness session only, then ask both verifiers again.
const logout = await fetch(`${baseUrl}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` } });
const afterRemote = await timed(userHop(accessToken));
const nowSeconds = Math.floor(Date.now() / 1000);
result.revocation = {
  logoutStatus: logout.status,
  remoteVerifyAfterSignOut: afterRemote.status,
  remoteRefusesRevokedSession: afterRemote.status === 401 || afterRemote.status === 403,
  tokenStillUnexpired: typeof claims.exp === 'number' && claims.exp > nowSeconds,
};
if (localVerify) {
  result.revocation.localSignatureStillValid = await localVerify.verifyOnce();
  result.revocation.localCheckWouldAccept = result.revocation.localSignatureStillValid && result.revocation.tokenStillUnexpired;
  delete localVerify.verifyOnce;
  result.localVerify = localVerify;
}

console.log(JSON.stringify(result, null, 2));
