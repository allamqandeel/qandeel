// PROD-OPS-01 - live wire proof of migration 0132's readiness RPC and aggregate summary THROUGH a real PostgREST
// server, driven by the API's OWN compiled code.
//
// verify-migration-0132.mjs proves what PostgreSQL does. The API never sees that: it sees the HTTP answer PostgREST
// makes of it, under the Supabase gateway's `/rest/v1` path. This proof puts a minimal path-prefix gateway in front of
// the real PostgREST engine Supabase runs, across the PostgREST lines CI starts it with (`POSTGREST_VERSION`), and
// runs the compiled API classes against it (apps/api/dist, built earlier in the same CI job):
//
//   * DatabaseHealthProbe answers `available` with the server credential: the exact RPC, the exact `true` answer;
//   * the same probe with an authenticated or an anonymous token is refused by the database and answers `unavailable`
//     (no client-reachable readiness surface exists), and a stopped gateway answers `unavailable` too;
//   * PrivacyMaintenanceRepository.readOperationsSummary decodes the live summary as fourteen non-negative whole
//     numbers (bigint ages arrive as JSON numbers), and a user token cannot read it.
//
// It needs POSTGREST_URL and POSTGREST_JWT_SECRET (a CI-only signing secret for the throwaway PostgREST container;
// never a deployment credential). It writes nothing: every refusal happens before any row is read.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import http from 'node:http';
import process from 'node:process';

const require = createRequire(import.meta.url);
const postgrestUrl = (process.env.POSTGREST_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const secret = process.env.POSTGREST_JWT_SECRET;
const version = process.env.POSTGREST_VERSION ?? 'unspecified';
if (!secret) throw new Error('POSTGREST_JWT_SECRET is required.');

let stage = 'load the compiled API';
const { DatabaseHealthProbe } = require('../apps/api/dist/health/database-health.probe.js');
const { PrivacyMaintenanceRepository } = require('../apps/api/dist/account/privacy-maintenance.repository.js');
const { SupabaseServiceRoleApiService } = require('../apps/api/dist/conversation/supabase-service-role-api.service.js');

const base64url = (value) => Buffer.from(value).toString('base64url');
function jwt(claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** The Supabase gateway's shape, minimally: `/rest/v1/<path>` → PostgREST `/<path>`; `apikey` is the gateway's own. */
function startGateway() {
  const server = http.createServer(async (request, response) => {
    try {
      if (!request.url?.startsWith('/rest/v1/')) { response.writeHead(404).end(); return; }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !['host', 'apikey', 'content-length', 'connection', 'transfer-encoding', 'keep-alive'].includes(name)));
      const upstream = await fetch(`${postgrestUrl}${request.url.slice('/rest/v1'.length)}`, {
        method: request.method, headers, body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const stop = (gateway) => new Promise((resolve) => { gateway.closeAllConnections(); gateway.close(() => resolve()); });

async function main() {
  const gateway = await startGateway();
  const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;
  try {
    const serverKey = jwt({ role: 'service_role' });
    const userKey = jwt({ sub: randomUUID(), role: 'authenticated' });
    const anonKey = jwt({ role: 'anon' });
    process.env.SUPABASE_URL = `${gatewayUrl}/`;
    process.env.HEALTH_DATABASE_TIMEOUT_MS = '5000';

    stage = 'the probe is available through the real wire with the server credential';
    process.env.SUPABASE_SERVICE_ROLE_KEY = serverKey;
    assert.equal(await new DatabaseHealthProbe().check(), 'available');

    stage = 'no client credential can pass readiness';
    for (const key of [userKey, anonKey]) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = key;
      assert.equal(await new DatabaseHealthProbe().check(), 'unavailable', 'a client token is refused by the database');
    }
    const direct = await fetch(`${postgrestUrl}/rpc/server_database_ready_v1`, { method: 'POST', headers: { Authorization: `Bearer ${userKey}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.ok([401, 403, 404].includes(direct.status), `a user token is refused on the wire (${direct.status})`);

    stage = 'the aggregate summary is decoded from the live wire by the real repository';
    process.env.SUPABASE_SERVICE_ROLE_KEY = serverKey;
    const summary = await new PrivacyMaintenanceRepository(new SupabaseServiceRoleApiService()).readOperationsSummary();
    assert.equal(Object.keys(summary).length, 14);
    for (const [key, value] of Object.entries(summary)) assert.ok(Number.isSafeInteger(value) && value >= 0, `${key} is a whole number`);
    process.env.SUPABASE_SERVICE_ROLE_KEY = userKey;
    await assert.rejects(new PrivacyMaintenanceRepository(new SupabaseServiceRoleApiService()).readOperationsSummary(), 'a user token cannot read the operational summary');

    stage = 'an unreachable gateway is unavailable, never available';
    process.env.SUPABASE_SERVICE_ROLE_KEY = serverKey;
    await stop(gateway);
    assert.equal(await new DatabaseHealthProbe().check(), 'unavailable');

    console.log(`Verified PROD-OPS-01 through live PostgREST ${version}: the compiled DatabaseHealthProbe is available only with the server credential through /rest/v1/rpc/server_database_ready_v1 and unavailable for user, anonymous and unreachable paths; the compiled repository decodes the live aggregate summary as fourteen whole numbers, which no user token can read.`);
  } finally {
    if (gateway.listening) await stop(gateway);
  }
}

main().catch((error) => {
  console.error(`PROD-OPS-01 PostgREST ${version} wire proof failed at ${stage}: ${error?.message ?? error}`);
  process.exitCode = 1;
});
