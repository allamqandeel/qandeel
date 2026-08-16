import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/0001_core_conversation_schema.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('defines only the V1 core conversation tables', () => {
  const tables = [...sql.matchAll(/CREATE TABLE\s+([a-z_]+)/gi)].map((match) => match[1]);

  assert.deepEqual(tables, ['users', 'conversation_sessions', 'conversation_turns']);
});

test('uses UUID keys and timezone-aware server timestamps', () => {
  assert.match(sql, /CREATE TABLE users[\s\S]*?id uuid PRIMARY KEY/i);
  assert.match(sql, /CREATE TABLE conversation_sessions[\s\S]*?id uuid PRIMARY KEY/i);
  assert.match(sql, /CREATE TABLE conversation_turns[\s\S]*?id uuid PRIMARY KEY/i);
  assert.equal((sql.match(/timestamptz/gi) ?? []).length, 9);
});

test('enforces user-scoped session and turn relationships', () => {
  assert.match(sql, /FOREIGN KEY \(user_id\) REFERENCES users \(id\) ON DELETE RESTRICT/gi);
  assert.match(
    sql,
    /FOREIGN KEY \(session_id, user_id\)\s*REFERENCES conversation_sessions \(id, user_id\) ON DELETE RESTRICT/i,
  );
  assert.match(sql, /UNIQUE \(session_id, user_id, idempotency_key\)/i);
});

test('constrains canonical session and turn lifecycle values', () => {
  for (const value of ['ACTIVE', 'IDLE', 'CLOSED', 'EXPIRED', 'TEXT', 'VOICE']) {
    assert.match(sql, new RegExp(`'${value}'`));
  }

  for (const value of [
    'USER', 'ASSISTANT', 'SYSTEM', 'RECEIVED', 'VALIDATED', 'CONTEXT_BUILDING',
    'PROCESSING', 'GENERATING', 'STREAMING', 'COMPLETED', 'CANCELLED', 'FAILED',
    'SUPERSEDED', 'FAST', 'DEEP',
  ]) {
    assert.match(sql, new RegExp(`'${value}'`));
  }
});

test('indexes user sessions and ordered session turns', () => {
  assert.match(sql, /ON conversation_sessions \(user_id, last_activity_at DESC\)/i);
  assert.match(sql, /ON conversation_turns \(session_id, created_at, id\)/i);
});
