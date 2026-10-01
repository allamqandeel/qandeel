// DISCOVERY PASS (temporary): reproduce hosted Supabase's public default privileges in a scratch database, replay every
// migration, and print the effective client privilege census against the plain CI database's explicit grants.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.DATABASE_URL;
const SIM = 'qandeel_prod_sec_01_acl_sim';
const simUrl = (() => { const u = new URL(databaseUrl); u.pathname = `/${SIM}`; return u.toString(); })();

const admin = new pg.Client({ connectionString: databaseUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${SIM}`);
await admin.query(`CREATE DATABASE ${SIM}`);

const work = mkdtempSync(join(tmpdir(), 'sec01-'));
const bootstrap = readFileSync(join(root, 'database/supabase-compatible-bootstrap.sql'), 'utf8').replace(/^CREATE ROLE .*$/gmu, '');
const supabaseDefaults = `
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;
writeFileSync(join(work, 'pre.sql'), bootstrap + supabaseDefaults);
const psql = (file) => execFileSync('psql', [simUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { stdio: ['ignore', 'pipe', 'pipe'] });
psql(join(work, 'pre.sql'));
const migrations = readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
const failures = [];
for (const file of migrations) {
  try { psql(join(root, 'database/migrations', file)); } catch (error) { failures.push({ file, stderr: String(error.stderr).slice(0, 2000) }); console.log(`MIGRATION FAILED IN SIM: ${file}\n${String(error.stderr).slice(0, 2000)}`); break; }
}

const FN = `SELECT n.nspname || '.' || p.oid::regprocedure::text AS sig, p.prosecdef AS definer, p.prorettype = 'trigger'::regtype AS trig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
  EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS pub
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE (n.nspname = 'public' OR has_schema_privilege('anon', n.oid, 'USAGE') OR has_schema_privilege('authenticated', n.oid, 'USAGE'))
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')`;
const REL = `SELECT n.nspname || '.' || c.relname AS rel, c.relkind AS kind, c.relrowsecurity AS rls, coalesce(c.reloptions::text, '') AS opts,
  ARRAY(SELECT r || ':' || x FROM unnest(ARRAY['anon','authenticated']) r, unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) x
        WHERE has_table_privilege(r, c.oid, x)) AS privs
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p','f','S')`;
const SCHEMAS = `SELECT nspname, has_schema_privilege('anon', oid, 'USAGE') anon, has_schema_privilege('authenticated', oid, 'USAGE') auth FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY 1`;

const sim = new pg.Client({ connectionString: simUrl });
await sim.connect();
const main = new pg.Client({ connectionString: databaseUrl });
await main.connect();
const index = (rows, key) => new Map(rows.map((r) => [r[key], r]));
const simFn = index((await sim.query(FN)).rows, 'sig');
const mainFn = index((await main.query(FN)).rows, 'sig');
console.log('SCHEMAS sim', JSON.stringify((await sim.query(SCHEMAS)).rows));
console.log('SCHEMAS main', JSON.stringify((await main.query(SCHEMAS)).rows));
console.log(`FUNCTIONS sim=${simFn.size} main=${mainFn.size}`);
for (const [sig, s] of [...simFn].sort()) {
  const m = mainFn.get(sig);
  const drift = [];
  if (s.anon && !m?.anon) drift.push('anon');
  if (s.auth && !m?.auth) drift.push('authenticated');
  console.log(`FN ${drift.length ? 'DRIFT[' + drift.join(',') + ']' : 'ok'} main{anon:${m?.anon},auth:${m?.auth},svc:${m?.svc},pub:${m?.pub}} sim{anon:${s.anon},auth:${s.auth},pub:${s.pub}} ${s.definer ? 'DEFINER' : 'INVOKER'}${s.trig ? ' TRIGGER' : ''} ${sig}`);
}
const simRel = index((await sim.query(REL)).rows, 'rel');
const mainRel = index((await main.query(REL)).rows, 'rel');
for (const [rel, s] of [...simRel].sort()) {
  const m = mainRel.get(rel);
  const extra = s.privs.filter((p) => !(m?.privs ?? []).includes(p));
  console.log(`REL ${extra.length ? 'DRIFT' : 'ok'} kind=${s.kind} rls=${s.rls} opts=${s.opts} main=[${(m?.privs ?? []).join(' ')}] extra=[${extra.join(' ')}] ${rel}`);
}
console.log('MIGRATION FAILURES', JSON.stringify(failures.map((f) => f.file)));
await sim.end(); await main.end();
await admin.query(`DROP DATABASE IF EXISTS ${SIM}`);
await admin.end();
