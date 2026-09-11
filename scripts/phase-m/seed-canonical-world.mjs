/**
 * T-12 Phase M — the provider-neutral canonical-world seeder. VALIDATION TOOLING ONLY.
 *
 * Nothing in `apps/mobile/src` or `apps/api/src` imports this. It is a script, run by hand, against a
 * dedicated validation identity.
 *
 * ## What it does, and the one line that matters
 *
 * **Every row it creates is written by a canonical database authority.** There is not one `INSERT`,
 * `UPDATE` or `DELETE` against a semantic table in this file — the only SQL it issues is `SELECT …
 * FROM <authority>(…)`, plus the transaction and role statements that let those authorities run as
 * the caller they require. If an authority refuses a payload, the exchange rolls back whole and the
 * seeder stops. Nothing is patched afterwards, and no constraint is relaxed to make a fixture pass.
 *
 * The authorities, in the order one exchange uses them:
 *
 * | as | authority |
 * | --- | --- |
 * | the real HTTP API, identity A | `POST /conversation/sessions` |
 * | `authenticated` | `create_user_conversation_turn` |
 * | `service_role` | `claim_conversation_turn` |
 * | `service_role` | `finalize_conversation_turn_v2` |
 * | `service_role` | `commit_finalized_exchange_with_full_semantic_chain_v1` |
 *
 * That last one is the FINAL semantic authority. `verify-migration-0071.mjs` proves it is the only
 * committing function `service_role` may execute after the T-03D cutover, so there is no second path
 * and no fallback — which is exactly why this seeder can claim the world it builds is canonical.
 *
 * ## Atomicity
 *
 * Each exchange runs inside ONE explicit transaction: the two conversation turns and the semantic
 * commit either all land or none do. A half-committed exchange would leave a Session whose turns
 * exist without their Moments, which is precisely the corruption §2 forbids a failed run from
 * causing. Roles are set with `SET LOCAL`, so they unwind with the transaction too.
 *
 * ## Freshness
 *
 * It always mints a NEW Session. It never seeds the legacy pre-0072 Session, never reuses a previous
 * seeded Session, and never mutates an existing world — a re-run produces a new Session with new
 * derived identifiers, so a prior successful seed cannot be corrupted by a later failed one.
 *
 * Usage:
 *   node scripts/phase-m/seed-canonical-world.mjs --confirm [--api https://origin]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  buildCanonicalWorld, EXPECTED_WORLD, PROVENANCE, FOCUS_PROVENANCE, THREAD_PROVENANCE,
  CONTINUITY_PROVENANCE, LF_REDUCER_VERSION, ROUTE, uuidV5,
} from './canonical-world-fixture.mjs';

const REPO = 'E:/QANDEEL/CW/T-12';
const ENV_FILE = process.env.QANDEEL_ENV_FILE ?? 'E:/QANDEEL/QANDEEL PROJECT/.env';
const pg = createRequire(`${REPO}/package.json`)('pg');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

if (!flag('--confirm')) {
  process.stderr.write('refused: pass --confirm. This writes canonical semantic state to a live project.\n');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z_]+\s*=/.test(l)).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const apiBase = (option('--api', 'http://127.0.0.1:3000')).replace(/\/$/u, '');
const supabase = env.SUPABASE_URL.replace(/\/$/u, '');

const log = [];
const say = (text) => { log.push(text); console.log(text); };

// ---------------------------------------------------------------------------------------------
// 1. A fresh Session, minted through the REAL authenticated Product path.
// ---------------------------------------------------------------------------------------------

say('T-12 PHASE M — PROVIDER-NEUTRAL CANONICAL WORLD SEEDER');
say(`recorded ${new Date().toISOString()}`);
say('');
say('This seed validates runtime consumption and visual/navigation behaviour only.');
say('It is NOT evidence of AI semantic quality or provider integration.');
say('');

const auth = await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.SUPABASE_TEST_EMAIL, password: env.SUPABASE_TEST_PASSWORD }),
});
if (!auth.ok) throw new Error(`identity A sign-in refused: HTTP ${auth.status}`);
const { access_token: accessToken, user } = await auth.json();
say(`identity A authenticated: userId=${user.id}`);

const minted = await fetch(`${apiBase}/conversation/sessions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  body: '{}',
});
if (!minted.ok) throw new Error(`POST /conversation/sessions refused: HTTP ${minted.status}`);
const session = await minted.json();
say(`fresh validation Session minted through ${apiBase}: ${session.id} (${session.status}/${session.channel})`);
say('');

// ---------------------------------------------------------------------------------------------
// 2. The deterministic fixture.
// ---------------------------------------------------------------------------------------------

const world = buildCanonicalWorld({ sessionId: session.id, userId: user.id });
say(`fixture: ${world.exchanges.length} exchange(s), ${EXPECTED_WORLD.committedUnits} committed CU(s), ${EXPECTED_WORLD.threads} destination(s)`);
say(`provenance: provider=${PROVENANCE[2]} model=${PROVENANCE[3]} — deliberately not any real provider`);
say('');

const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 120_000 });
await client.connect();
const rows = async (text, values = []) => (await client.query(text, values)).rows;

/** Adopts a database role for the remainder of the CURRENT transaction only. */
async function as(role, uid = null) {
  await client.query('RESET ROLE');
  if (role !== 'postgres') await client.query(`SET LOCAL ROLE ${role}`);
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

/**
 * The optimistic-concurrency token the coordinator compares before it writes anything: the Session
 * clock's position and same-SP sequence, and the user's world thread-identity version.
 *
 * Read through the canonical runtime-context AUTHORITY rather than off the clock tables. Two reasons,
 * and the first is the one that matters: it is the same read the real application path performs to
 * obtain this token, so the seeder asserts a position exactly the way production does. The second is
 * practical — `service_role` holds no direct SELECT on `session_semantic_clocks`, which is the
 * authority boundary working as designed.
 *
 * Read fresh before every exchange rather than carried forward, so the seeder never claims a
 * position it has not just observed.
 */
async function tokenFor(sessionId, userId) {
  const [context] = await rows('SELECT * FROM public.get_conversation_full_semantic_runtime_context_v1($1,$2)', [sessionId, userId]);
  if (!context) throw new Error('the canonical runtime context returned nothing for this Session');
  return {
    sp: context.base_current_sp,
    seq: Number(context.base_same_sp_event_sequence),
    version: String(context.world_thread_identity_version),
  };
}

const COORDINATOR = `SELECT * FROM public.commit_finalized_exchange_with_full_semantic_chain_v1(
  $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
  $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`;

const applied = [];
for (const exchange of world.exchanges) {
  await client.query('BEGIN');
  try {
    // The two REAL conversation turns this exchange's Moments are committed from. The semantic
    // authority validates its source turn, so a fabricated turn id would simply be refused.
    await as('authenticated', user.id);
    await rows('SELECT * FROM public.create_user_conversation_turn($1,$2,$3,$4)', [exchange.userTurnId, session.id, exchange.userText, null]);
    await as('service_role');
    await rows('SELECT * FROM public.claim_conversation_turn($1,$2,$3,$4,$5)', [session.id, user.id, exchange.userTurnId, ...ROUTE]);
    const finalized = await rows('SELECT * FROM public.finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
      session.id, user.id, exchange.userTurnId, exchange.assistantTurnId, exchange.assistantText, 'ALLOW',
      uuidV5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', `${session.id}:${exchange.label}:finalize-event`), null, null, null,
    ]);
    if (finalized.length !== 1) throw new Error(`${exchange.label}: the exchange did not finalize`);

    const token = await tokenFor(session.id, user.id);
    const [result] = await rows(COORDINATOR, [
      session.id, user.id, exchange.userTurnId, exchange.userBatchId,
      JSON.stringify(exchange.userUnits), JSON.stringify(exchange.userBundles), JSON.stringify(exchange.userThreads),
      JSON.stringify(exchange.userLifecycle), JSON.stringify(exchange.userLiveFocus),
      exchange.assistantTurnId, exchange.assistantBatchId,
      JSON.stringify(exchange.assistantUnits), JSON.stringify(exchange.assistantBundles), JSON.stringify(exchange.assistantThreads),
      JSON.stringify(exchange.assistantLifecycle), JSON.stringify(exchange.assistantLiveFocus),
      ...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION,
      token.sp, token.seq, token.version,
    ]);
    if (!result) throw new Error(`${exchange.label}: the canonical authority returned no result`);
    await client.query('RESET ROLE');
    await client.query('COMMIT');

    applied.push({ label: exchange.label, liveHead: result.live_head, liveFocusKind: result.live_focus_kind, liveFocusRef: result.live_focus_ref, liveFocusSp: result.live_focus_sp, transitions: result.live_focus_transitions });
    say(`ok    ${exchange.label.padEnd(12)} liveHead=${String(result.live_head).padStart(2)}  LF=${result.live_focus_kind}@SP${result.live_focus_sp}  transitions=${result.live_focus_transitions.length}`);
  } catch (error) {
    // Fail closed. The whole exchange unwinds; nothing is repaired by hand and nothing continues.
    await client.query('ROLLBACK').catch(() => {});
    say(`STOP  ${exchange.label}`);
    say(`      ${error.code ?? ''} ${error.message}`);
    if (error.detail) say(`      detail: ${error.detail}`);
    say('');
    say(`${applied.length} exchange(s) committed before the failure; this one rolled back whole.`);
    say(`The validation Session ${session.id} is left as it stands and is NOT reused by a later run.`);
    await client.end();
    writeFileSync(option('--out', 'E:/QANDEEL/phase-m-seed.txt'), `${log.join('\n')}\n`);
    process.exit(1);
  }
}

await client.end();
say('');
say(`all ${applied.length} exchange(s) committed.`);
say(`VALIDATION SESSION: ${session.id}`);
say(`OWNER: ${user.id}`);
writeFileSync(option('--out', 'E:/QANDEEL/phase-m-seed.txt'), `${log.join('\n')}\n`);
console.log(`\nseed log written to ${option('--out', 'E:/QANDEEL/phase-m-seed.txt')}`);
