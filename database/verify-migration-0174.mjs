// S8A-04 CP1 - verifies migration 0174 (the AI-COST-01 feature family SHARED_SEMANTIC_READING) against real PostgreSQL.
//
// On a database migrated through 0174 it proves: the ai_provider_calls feature-family CHECK is the 0171 list plus exactly
// SHARED_SEMANTIC_READING; begin_ai_provider_call_v1 admits a DeepSeek call under the new family and records it there, and
// still refuses a family that does not exist; every earlier family is still admitted. Every fixture is written inside one
// transaction that is rolled back.
//
// S8A-04 CP2 (2026-10-24, re-anchored): migration 0175 adds exactly SHARED_KNOWLEDGE_RECALL and SHARED_SPATIAL_PLACEMENT to the
// same CHECK. On a database migrated through 0175 the CHECK must be this list plus exactly those two; nothing else may differ.
//
// S8A-04 CP3 (2026-10-25, re-anchored): migration 0176 adds exactly SHARED_DISCLOSURE_JUDGE (the Shared disclosure judge, paid
// by the author of the causing message). On a database migrated through 0176 the CHECK is the 0175 list plus exactly that one.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';
const q = (text, values = []) => client.query(text, values);
const one = async (text, values = []) => (await q(text, values)).rows[0];

const FAMILIES = ['CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION', 'PERSONAL_UNDERSTANDING_CAPTURE',
  'SHARED_SEMANTIC_READING'];
const BEGIN = 'SELECT * FROM public.begin_ai_provider_call_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text,$9::text)';

async function begin(user, family) {
  const call = randomUUID();
  await q('RESET ROLE');
  await q('SET LOCAL ROLE service_role');
  const row = await one(BEGIN, [call, user, null, null, 'DEEPSEEK', 'deepseek-flash', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', family, 'FAST']);
  await q('RESET ROLE');
  return { call, row };
}

async function verify() {
  stage = 'catalog: the feature-family CHECK is the 0171 list plus exactly SHARED_SEMANTIC_READING';
  const { def } = await one(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_calls'::regclass AND c.conname = 'ai_provider_calls_feature_family_check'`);
  const { later } = await one("SELECT to_regprocedure('public.begin_ai_provider_call_v2(uuid, uuid, uuid, uuid, text, text, text, text, text)') IS NOT NULL AS later");
  const { judged } = await one(`SELECT to_regprocedure('public.complete_shared_world_qandeel_reply_v2(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[], uuid[], boolean[])') IS NOT NULL AS judged`);
  // RE-ANCHORED by S8A-05 CP3 (2026-10-27, Controlled Amendment A-4): migration 0181 adds exactly PUBLIC_SEMANTIC_INTERPRETATION,
  // detected by its closed-profile record command (0181's own verifier pins the full list).
  const { publicReading } = await one("SELECT to_regprocedure('public.record_public_semantic_work_outcome_v2(uuid, text, text[], integer[], text, text[], text[], text)') IS NOT NULL AS \"publicReading\"");
  // RE-ANCHORED by S8A-05 CP4 (2026-10-27, Controlled Amendment A-5): migration 0182 adds exactly PUBLIC_QANDEEL_REPLY,
  // detected by its branch-scoped context read (0182's own verifier pins the full list).
  const { publicReply } = await one("SELECT to_regprocedure('public.read_public_qandeel_context_v2(uuid, uuid)') IS NOT NULL AS \"publicReply\"");
  const expected = [...FAMILIES, ...(later ? ['SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT'] : []), ...(judged ? ['SHARED_DISCLOSURE_JUDGE'] : []),
    ...(publicReading ? ['PUBLIC_SEMANTIC_INTERPRETATION'] : []), ...(publicReply ? ['PUBLIC_QANDEEL_REPLY'] : [])];
  assert.deepEqual([...def.matchAll(/'([A-Z_]+)'::text/gu)].map((match) => match[1]).sort(), [...expected].sort());

  await q('BEGIN');
  try {
    const user = randomUUID();
    await q('INSERT INTO auth.users (id) VALUES ($1)', [user]);

    stage = 'begin: a DeepSeek call is admitted and recorded under SHARED_SEMANTIC_READING';
    const reading = await begin(user, 'SHARED_SEMANTIC_READING');
    assert.equal(reading.row.begin_outcome, 'BEGUN');
    const row = await one('SELECT provider, operation, feature_family, call_state FROM public.ai_provider_calls WHERE id = $1', [reading.call]);
    assert.deepEqual([row.provider, row.operation, row.feature_family], ['DEEPSEEK', 'DEEPSEEK_CHAT_COMPLETIONS_CREATE', 'SHARED_SEMANTIC_READING']);

    stage = 'begin: every earlier family is still admitted; an unknown family is still refused';
    for (const family of FAMILIES.filter((name) => name !== 'SHARED_SEMANTIC_READING')) {
      assert.equal((await begin(user, family)).row.begin_outcome, 'BEGUN', family);
    }
    await q('SAVEPOINT unknown_family');
    let refusal;
    try { await begin(user, 'SHARED_SOCIAL_MEMORY'); } catch (error) { refusal = error; } finally { await q('ROLLBACK TO SAVEPOINT unknown_family'); }
    assert.ok(refusal, 'an unknown feature family must be refused');
  } finally {
    await q('ROLLBACK');
  }
}

async function main() {
  try {
    await client.connect();
    await verify();
    console.log('Verified migration 0174 Shared semantic reading cost family: the feature-family CHECK is the 0171 list plus exactly SHARED_SEMANTIC_READING, a DeepSeek call is admitted and recorded under it, every earlier family is still admitted, and an unknown family is still refused.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Migration 0174 verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
