import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');
}

const coreTables = ['conversation_sessions', 'conversation_turns', 'users'];
const migrationUrl = new URL('./migrations/0001_core_conversation_schema.sql', import.meta.url);
const migrationSql = await readFile(migrationUrl, 'utf8');
const client = new Client({ connectionString: databaseUrl });

async function queryRows(text, values = []) {
  return (await client.query(text, values)).rows;
}

async function existingCoreTables() {
  const rows = await queryRows(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY ($1::text[])
      ORDER BY table_name`,
    [coreTables],
  );
  return rows.map(({ table_name }) => table_name);
}

async function verifyTables() {
  assert.deepEqual(await existingCoreTables(), coreTables);
}

async function verifyConstraints() {
  const rows = await queryRows(
    `SELECT c.conname AS name,
            c.contype AS type,
            pg_get_constraintdef(c.oid, true) AS definition
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
        AND c.conrelid IN (
          'public.users'::regclass,
          'public.conversation_sessions'::regclass,
          'public.conversation_turns'::regclass
        )`,
  );
  const constraints = new Map(rows.map((row) => [row.name, row]));
  const expected = {
    users_auth_subject_key: ['u', 'UNIQUE (auth_subject)'],
    conversation_sessions_user_fk: ['f', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT'],
    conversation_sessions_status_check: ['c', "CHECK (status = ANY (ARRAY['ACTIVE'::text, 'IDLE'::text, 'CLOSED'::text, 'EXPIRED'::text]))"],
    conversation_sessions_channel_check: ['c', "CHECK (channel = ANY (ARRAY['TEXT'::text, 'VOICE'::text]))"],
    conversation_sessions_id_user_unique: ['u', 'UNIQUE (id, user_id)'],
    conversation_turns_user_fk: ['f', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT'],
    conversation_turns_session_user_fk: ['f', 'FOREIGN KEY (session_id, user_id) REFERENCES conversation_sessions(id, user_id) ON DELETE RESTRICT'],
    conversation_turns_role_check: ['c', "CHECK (role = ANY (ARRAY['USER'::text, 'ASSISTANT'::text, 'SYSTEM'::text]))"],
    conversation_turns_status_check: ['c', "CHECK (status = ANY (ARRAY['RECEIVED'::text, 'VALIDATED'::text, 'CONTEXT_BUILDING'::text, 'PROCESSING'::text, 'GENERATING'::text, 'STREAMING'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'FAILED'::text, 'SUPERSEDED'::text]))"],
    conversation_turns_processing_path_check: ['c', "CHECK (processing_path IS NULL OR (processing_path = ANY (ARRAY['FAST'::text, 'DEEP'::text])))"],
    conversation_turns_idempotency_unique: ['u', 'UNIQUE (session_id, user_id, idempotency_key)'],
  };

  for (const [name, [type, definition]] of Object.entries(expected)) {
    const actual = constraints.get(name);
    assert.ok(actual, `Missing constraint ${name}`);
    assert.equal(actual.type, type, `Unexpected type for constraint ${name}`);
    assert.equal(actual.definition, definition, `Unexpected definition for constraint ${name}`);
  }
}

async function verifyIndexes() {
  const rows = await queryRows(
    `SELECT indexname AS name, indexdef AS definition
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY ($1::text[])`,
    [[
      'conversation_sessions_user_activity_idx',
      'conversation_turns_session_order_idx',
    ]],
  );
  const indexes = new Map(rows.map((row) => [row.name, row.definition]));

  assert.equal(
    indexes.get('conversation_sessions_user_activity_idx'),
    'CREATE INDEX conversation_sessions_user_activity_idx ON public.conversation_sessions USING btree (user_id, last_activity_at DESC)',
  );
  assert.equal(
    indexes.get('conversation_turns_session_order_idx'),
    'CREATE INDEX conversation_turns_session_order_idx ON public.conversation_turns USING btree (session_id, created_at, id)',
  );
}

async function verifyCrossUserIsolation() {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const sessionId = randomUUID();

  await client.query('BEGIN');
  try {
    await client.query(
      'INSERT INTO users (id, auth_subject) VALUES ($1, $2), ($3, $4)',
      [ownerId, `verify-owner-${ownerId}`, otherUserId, `verify-other-${otherUserId}`],
    );
    await client.query(
      `INSERT INTO conversation_sessions (id, user_id, status, channel)
       VALUES ($1, $2, 'ACTIVE', 'TEXT')`,
      [sessionId, ownerId],
    );

    let rejection;
    try {
      await client.query(
        `INSERT INTO conversation_turns (id, session_id, user_id, role, status, content)
         VALUES ($1, $2, $3, 'USER', 'RECEIVED', 'integration verification')`,
        [randomUUID(), sessionId, otherUserId],
      );
    } catch (error) {
      rejection = error;
    }

    assert.ok(rejection, 'Cross-user turn unexpectedly succeeded');
    assert.equal(rejection.code, '23503');
    assert.equal(rejection.constraint, 'conversation_turns_session_user_fk');
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  try {
    await client.connect();
    const existing = await existingCoreTables();

    if (existing.length === 0) {
      await client.query(migrationSql);
      console.log('Applied migration 0001 from a clean core schema.');
    } else if (existing.length !== coreTables.length) {
      throw new Error(`Refusing partial core schema: found ${existing.join(', ')}.`);
    } else {
      console.log('Migration 0001 tables already exist; verifying without reapplying.');
    }

    await verifyTables();
    await verifyConstraints();
    await verifyIndexes();
    await verifyCrossUserIsolation();
    console.log('Verified migration 0001 tables, constraints, indexes, and cross-user isolation.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Database verification failed (${code}). Connection details were suppressed.`);
  process.exitCode = 1;
});
