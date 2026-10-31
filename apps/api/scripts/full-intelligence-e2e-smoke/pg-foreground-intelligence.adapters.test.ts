// MEM-AR-01C (RC-C1) — focused tests of the smoke-only foreground PostgREST substitute's table-read translation.
//
// The request shapes come from the REAL production repositories (MemoryRepository, MemoryControlRepository), captured
// through a recording transport, so the positive cases are exactly what production asks for; the negative cases prove
// the substitute still fails closed on every shape it was not built for. The second part runs only against a
// disposable PostgreSQL (DATABASE_URL, as in the API CI database leg): one rolled-back transaction proves the subject is
// read from the real attribution through (memory_id, user_id), under the authenticated role and its RLS.
//
//   node node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.scripts.json \
//     apps/api/scripts/full-intelligence-e2e-smoke/pg-foreground-intelligence.adapters.test.ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { MemoryControlRepository } from '../../src/memory/memory-control.repository';
import type { MemoryDataApiService } from '../../src/memory/memory-data-api.service';
import { MemoryRepository } from '../../src/memory/memory.repository';
import { SmokeDbSession } from '../a2-e2e-smoke/smoke-db';
import { PgAuthenticatedDataApiAdapter, refusedSmokeRequestShapes, translateTableRead } from './pg-foreground-intelligence.adapters';

const OWNER = '00000000-0000-4000-8000-0000000000a1';
const MEMORY = '00000000-0000-4000-8000-0000000000b1';
const PLAIN_COLUMNS =
  'id, user_id, scope, type, content, source, confidence, importance, status, version, created_at, updated_at, expires_at, supersedes_memory_id';
const EMBED_SQL =
  "(SELECT json_build_object('subject', attribution.subject) FROM public.memory_subject_attributions attribution"
  + ' WHERE attribution.memory_id = memories.id AND attribution.user_id = memories.user_id) AS memory_subject_attributions';
// S8B-03 CP1 (0186): MemoryRepository's reads also embed the typed confirmations (one-to-many: an array, empty without a row).
const CONFIRMATION_SQL =
  "COALESCE((SELECT json_agg(json_build_object('memory_id', confirmation.memory_id) ORDER BY confirmation.source_turn_id)"
  + ' FROM public.memory_typed_confirmations confirmation'
  + " WHERE confirmation.memory_id = memories.id AND confirmation.user_id = memories.user_id), '[]'::json) AS memory_typed_confirmations";

/** The exact `table?query` paths the production repositories send. */
async function productionPaths(): Promise<string[]> {
  const paths: string[] = [];
  const recorder = { request: async (_token: string, path: string) => { paths.push(path); return []; } } as unknown as MemoryDataApiService;
  const memory = new MemoryRepository(recorder);
  const control = new MemoryControlRepository(recorder);
  await memory.find('token', OWNER, MEMORY);
  await memory.listActiveForUser('token', OWNER, 16, new Date('2026-10-11T00:00:00.000Z'));
  await control.listControllable('token', OWNER);
  await control.findOwned('token', OWNER, [MEMORY]);
  return paths;
}

function translate(path: string): { text: string; values: unknown[] } {
  const index = path.indexOf('?');
  return translateTableRead(path.slice(0, index), path.slice(index + 1));
}

function refusal(table: string, select: string): string {
  try {
    translateTableRead(table, new URLSearchParams({ select, user_id: `eq.${OWNER}` }).toString());
  } catch (error) {
    return (error as Error).message;
  }
  return 'TRANSLATED';
}

test('every production Memory read is translated with the pinned subject embed and its own filters, order and limit', async () => {
  const [find, active, controllable, owned] = (await productionPaths()).map(translate);
  assert.deepEqual(find, {
    text: `SELECT ${PLAIN_COLUMNS}, ${EMBED_SQL}, ${CONFIRMATION_SQL} FROM public.memories WHERE id = $1 AND user_id = $2 LIMIT 1`,
    values: [MEMORY, OWNER],
  });
  assert.deepEqual(active, {
    text: `SELECT ${PLAIN_COLUMNS}, ${EMBED_SQL}, ${CONFIRMATION_SQL} FROM public.memories WHERE user_id = $1 AND status = $2`
      + ' AND (expires_at IS NULL OR expires_at > $3) ORDER BY updated_at DESC, id DESC LIMIT 16',
    values: [OWNER, 'ACTIVE', '2026-10-11T00:00:00.000Z'],
  });
  assert.deepEqual(controllable, {
    text: `SELECT ${PLAIN_COLUMNS}, ${EMBED_SQL} FROM public.memories WHERE user_id = $1 AND status IN ($2, $3)`
      + ' ORDER BY updated_at DESC, id DESC LIMIT 64',
    values: [OWNER, 'ACTIVE', 'DISABLED'],
  });
  assert.deepEqual(owned, {
    text: `SELECT ${PLAIN_COLUMNS}, ${EMBED_SQL} FROM public.memories WHERE user_id = $1 AND id IN ($2)`,
    values: [OWNER, MEMORY],
  });
});

test('a plain column list is translated exactly as before', () => {
  assert.deepEqual(translateTableRead('hypotheses', 'select=id,status&user_id=eq.u&order=id.asc&limit=2'), {
    text: 'SELECT id, status FROM public.hypotheses WHERE user_id = $1 ORDER BY id ASC LIMIT 2', values: ['u'],
  });
});

test('every other select shape still fails closed', () => {
  // Refused by the select-list rule, or by the identifier rule a malformed list reaches; never translated.
  const refused = /^FULL_INTELLIGENCE_E2E_UNSUPPORTED_DATA_API_REQUEST:(?:select|identifier)$/u;
  const before = refusedSmokeRequestShapes().length;
  // The pinned embed on any table other than memories.
  assert.match(refusal('hypotheses', 'id,memory_subject_attributions(subject)'), refused);
  assert.match(refusal('conversation_turns', 'id,memory_subject_attributions(subject)'), refused);
  assert.match(refusal('hypotheses', 'id,memory_subject_attributions(subject),memory_typed_confirmations(memory_id)'), refused);
  // Unknown relationships, other or extra embedded columns, wildcards, nesting, hints, aliases and spreads.
  for (const select of [
    'id,hypotheses(statement)',
    'id,memory_subject_attributions(subject,basis)',
    'id,memory_subject_attributions(*)',
    'id,memory_subject_attributions(subject,memories(content))',
    'id,memory_subject_attributions!inner(subject)',
    'id,memory_subject_attributions!memory_subject_attributions_memory_fk(subject)',
    'id,about:memory_subject_attributions(subject)',
    'id,...memory_subject_attributions(subject)',
    'id,memory_subject_attributions(subject),content',
    'memory_subject_attributions(subject),id',
    'memory_subject_attributions(subject)',
    ',memory_subject_attributions(subject)',
    'id,,memory_subject_attributions(subject)',
    'id,memory_subject_attributions(subject),memory_subject_attributions(subject)',
    'id,memory_subject_attributions(subject) ',
    'id,MEMORY_SUBJECT_ATTRIBUTIONS(subject)',
    '*',
    'id,content::text',
    // S8B-03: the confirmation embed only directly after the subject embed, exactly as pinned, and only once.
    'id,memory_typed_confirmations(memory_id)',
    'id,memory_typed_confirmations(memory_id),memory_subject_attributions(subject)',
    'id,memory_subject_attributions(subject),memory_typed_confirmations(*)',
    'id,memory_subject_attributions(subject),memory_typed_confirmations(memory_id,basis)',
    'id,memory_subject_attributions(subject),memory_typed_confirmations!inner(memory_id)',
    'id,memory_subject_attributions(subject),memory_typed_confirmations(memory_id),memory_typed_confirmations(memory_id)',
    'id,memory_subject_attributions(subject),memory_typed_confirmations(memory_id),content',
    'memory_subject_attributions(subject),memory_typed_confirmations(memory_id)',
  ]) {
    assert.match(refusal('memories', select), refused, select);
  }
  assert.ok(refusedSmokeRequestShapes().length > before, 'every refusal is recorded for the smoke failure report');
});

test('tables and filters outside the dialect are still refused', () => {
  assert.throws(() => translateTableRead('memory_subject_attributions', 'select=subject'), /UNSUPPORTED_DATA_API_REQUEST:table:memory_subject_attributions/u);
  assert.throws(() => translateTableRead('memories', 'select=id&content=like.*x*'), /UNSUPPORTED_DATA_API_REQUEST:filter:like/u);
});

test('against real PostgreSQL: the subject comes from the attribution, under the authenticated role and its RLS', {
  skip: process.env.DATABASE_URL ? false : 'DATABASE_URL is not set (runs in the API CI database leg)',
}, async () => {
  const db = new SmokeDbSession(process.env.DATABASE_URL as string);
  await db.open();
  try {
    const owner = randomUUID();
    const stranger = randomUUID();
    for (const id of [owner, stranger]) await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [id]);
    const row = `INSERT INTO public.memories (id, user_id, scope, type, content, source, confidence, importance, status)
                 VALUES ($1, $2, 'USER', 'PERSONAL_FACT', $3, 'USER_STATED', 0.9, 0.5, 'ACTIVE')`;
    const attribute = `INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis)
                       VALUES ($1, $2, $3, 'EXPLICIT_STATEMENT')`;
    const self = randomUUID();
    const other = randomUUID();
    const unattributed = randomUUID();
    const strangers = randomUUID();
    await db.observer(row, [self, owner, 'بحب القهوة']);
    await db.observer(row, [other, owner, 'أختي بتحب القهوة']);
    await db.observer(row, [unattributed, owner, 'بحب الشاي']);
    await db.observer(row, [strangers, stranger, 'بحب القهوة']);
    await db.observer(attribute, [self, owner, 'SELF']);
    await db.observer(attribute, [other, owner, 'OTHER']);
    await db.observer(attribute, [strangers, stranger, 'SELF']);

    await db.setAuthenticatedClaims(owner);
    const api = new PgAuthenticatedDataApiAdapter(db) as unknown as MemoryDataApiService;
    const memory = new MemoryRepository(api);
    const control = new MemoryControlRepository(api);
    const subjects = (rows: ReadonlyArray<{ id: string; subject?: unknown }>) =>
      Object.fromEntries(rows.map(({ id, subject }) => [id, subject]));

    // Production's own parse of the embed: SELF, OTHER, and UNATTRIBUTED (no attribution row) as null.
    assert.deepEqual(subjects(await memory.listActiveForUser('token', owner, 16)), { [self]: 'SELF', [other]: 'OTHER', [unattributed]: null });
    assert.deepEqual(subjects(await control.listControllable('token', owner)), { [self]: 'SELF', [other]: 'OTHER', [unattributed]: null });
    assert.equal((await memory.find('token', owner, other))?.subject, 'OTHER');
    // Owner isolation: another user's Memory is neither found by id nor among the caller's candidates.
    assert.equal(await memory.find('token', owner, strangers), undefined);
    assert.deepEqual(subjects(await control.findOwned('token', owner, [self, strangers])), { [self]: 'SELF' });

    // The embed is shaped as PostgREST answers this one-to-one relationship: an object, or null without a row.
    const raw = await (api as unknown as PgAuthenticatedDataApiAdapter).request<Array<{ id: string; memory_subject_attributions: unknown }>>(
      'token', `memories?${new URLSearchParams({ select: 'id,memory_subject_attributions(subject)', user_id: `eq.${owner}`, order: 'id.asc' })}`);
    assert.deepEqual(
      Object.fromEntries(raw.map(({ id, memory_subject_attributions }) => [id, memory_subject_attributions])),
      { [self]: { subject: 'SELF' }, [other]: { subject: 'OTHER' }, [unattributed]: null });

    // RLS, not the query's own filter, is what hides the rest: the same embed without an owner filter, as the caller,
    // sees only the caller's rows; as the stranger, only the stranger's.
    const unfiltered = `memories?${new URLSearchParams({ select: 'id,memory_subject_attributions(subject)' })}`;
    assert.deepEqual((await (api as unknown as PgAuthenticatedDataApiAdapter).request<Array<{ id: string }>>('token', unfiltered)).map(({ id }) => id).sort(),
      [self, other, unattributed].sort());
    await db.setAuthenticatedClaims(stranger);
    assert.deepEqual(await (api as unknown as PgAuthenticatedDataApiAdapter).request('token', unfiltered),
      [{ id: strangers, memory_subject_attributions: { subject: 'SELF' } }]);
  } finally {
    await db.rollback();
    await db.close();
  }
});

test('against real PostgreSQL (S8B-03, 0186): the typed confirmations are an array under the caller\'s RLS, read by production', {
  skip: process.env.DATABASE_URL ? false : 'DATABASE_URL is not set (runs in the API CI database leg)',
}, async () => {
  const db = new SmokeDbSession(process.env.DATABASE_URL as string);
  await db.open();
  try {
    const owner = randomUUID();
    const stranger = randomUUID();
    for (const id of [owner, stranger]) await db.observer('INSERT INTO auth.users (id) VALUES ($1)', [id]);
    const row = `INSERT INTO public.memories (id, user_id, scope, type, content, source, confidence, importance, status)
                 VALUES ($1, $2, 'USER', 'PERSONAL_FACT', $3, $4, $5, 0.5, 'ACTIVE')`;
    const confirm = `INSERT INTO public.memory_typed_confirmations (memory_id, user_id, source_turn_id, basis, command_id)
                     VALUES ($1, $2, $3, 'EXPLICIT_MEMORY_COMMAND', $4)`;
    const twice = randomUUID();
    const never = randomUUID();
    const typed = randomUUID();
    const strangers = randomUUID();
    await db.observer(row, [twice, owner, 'بحب القهوة', 'MACHINE_ASR', 0.9]);
    await db.observer(row, [never, owner, 'بحب الشاي', 'MACHINE_ASR', 0.75]);
    await db.observer(row, [typed, owner, 'بحب الكتب', 'USER_STATED', 0.95]);
    await db.observer(row, [strangers, stranger, 'بحب القهوة', 'MACHINE_ASR', 0.9]);
    const turns = [randomUUID(), randomUUID()].sort();
    for (const turn of turns) await db.observer(confirm, [twice, owner, turn, randomUUID()]);
    await db.observer(confirm, [strangers, stranger, randomUUID(), randomUUID()]);

    await db.setAuthenticatedClaims(owner);
    const api = new PgAuthenticatedDataApiAdapter(db) as unknown as MemoryDataApiService;
    const memory = new MemoryRepository(api);
    // Production's own parse: a MACHINE_ASR Memory reports whether it was confirmed; a typed one carries no such field.
    const listed = Object.fromEntries((await memory.listActiveForUser('token', owner, 16)).map((m) => [m.id, m.confirmed_by_typing]));
    assert.deepEqual(listed, { [twice]: true, [never]: false, [typed]: undefined });
    assert.equal((await memory.find('token', owner, twice))?.confirmed_by_typing, true);
    assert.equal(await memory.find('token', owner, strangers), undefined);

    // Shaped as PostgREST answers this one-to-many relationship: one element per row, in a stable order; [] without one.
    const select = 'id,memory_subject_attributions(subject),memory_typed_confirmations(memory_id)';
    const read = (query: Record<string, string>) => (api as unknown as PgAuthenticatedDataApiAdapter)
      .request<Array<{ id: string; memory_typed_confirmations: unknown }>>('token', `memories?${new URLSearchParams({ select, ...query })}`);
    assert.deepEqual(
      Object.fromEntries((await read({ user_id: `eq.${owner}` })).map(({ id, memory_typed_confirmations }) => [id, memory_typed_confirmations])),
      { [twice]: [{ memory_id: twice }, { memory_id: twice }], [never]: [], [typed]: [] });
    // RLS, not the query's filter: unfiltered, each caller sees only its own Memories and its own confirmations.
    assert.deepEqual((await read({})).map(({ id }) => id).sort(), [twice, never, typed].sort());
    await db.setAuthenticatedClaims(stranger);
    assert.deepEqual((await read({})).map(({ id, memory_typed_confirmations }) => [id, memory_typed_confirmations]),
      [[strangers, [{ memory_id: strangers }]]]);
  } finally {
    await db.rollback();
    await db.close();
  }
});
