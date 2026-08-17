import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const migration = await readFile(new URL('./migrations/0006_confidence_runtime.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: databaseUrl });

async function setIdentity(id) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, role: 'authenticated' })]);
}

async function main() {
  await client.connect();
  try {
    const exists = (await client.query("SELECT to_regclass('public.confidence_evaluations') IS NOT NULL present")).rows[0].present;
    if (!exists) await client.query(migration);
    await client.query('BEGIN');
    try {
      const user = randomUUID(); const otherUser = randomUUID();
      const hypothesis = randomUUID(); const competitor = randomUUID();
      const supportingMemory = randomUUID(); const contradictingMemory = randomUUID(); const ineligibleMemory = randomUUID();
      await client.query('RESET ROLE');
      await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text),($2::uuid,$2::text)', [user, otherUser]);
      await client.query(`INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status,expires_at)
        VALUES($1,$4,'USER','PERSONAL_FACT','support','USER_STATED',0.9,0.5,'ACTIVE',NULL),
              ($2,$4,'USER','PERSONAL_FACT','contradict','USER_CONFIRMED',0.9,0.5,'ACTIVE',NULL),
              ($3,$4,'USER','PERSONAL_FACT','historical','USER_STATED',0.9,0.5,'SUPERSEDED',NULL)`,
        [supportingMemory, contradictingMemory, ineligibleMemory, user]);
      await client.query(`INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,assumptions)
        VALUES($1,$3,'target','CAUSAL','GENERAL','test','HUMAN_REVIEWED','ACTIVE',$4,$5,ARRAY[$2]::uuid[],ARRAY['canonical assumption']),
              ($2,$3,'alternative','CAUSAL','GENERAL','test','HUMAN_REVIEWED','ACTIVE','{}','{}',ARRAY[$1]::uuid[],'{}')`,
        [hypothesis, competitor, user, [`memory:${supportingMemory}`, `memory:${ineligibleMemory}`], [`memory:${contradictingMemory}`]]);
      await setIdentity(user);
      const forged = {
        id: randomUUID(), target_id: hypothesis, target_version: 1, user_id: otherUser,
        target_type: 'FORGED', version: 99, lifecycle_state: 'FORGED', calibration_state: 'FORGED', stability: 'FORGED',
        supporting_evidence_ids: [], contradicting_evidence_ids: [], assumptions: ['forged'], alternative_hypothesis_ids: [],
        missing_information_codes: ['NO_ELIGIBLE_EVIDENCE'], policy_version: 'forged', provenance: 'forged',
      };
      const row = (await client.query('SELECT * FROM public.create_confidence_evaluation($1::jsonb)', [forged])).rows[0];
      assert.equal(row.user_id, user); assert.equal(row.target_type, 'HYPOTHESIS'); assert.equal(row.version, 1);
      assert.equal(row.lifecycle_state, 'EVALUATED'); assert.equal(row.calibration_state, 'UNCALIBRATED'); assert.equal(row.stability, 'UNASSESSED');
      assert.deepEqual(row.supporting_evidence_ids, [`memory:${supportingMemory}`]);
      assert.deepEqual(row.contradicting_evidence_ids, [`memory:${contradictingMemory}`]);
      assert.deepEqual(row.assumptions, ['canonical assumption']); assert.deepEqual(row.alternative_hypothesis_ids, [competitor]);
      assert.deepEqual(row.missing_information_codes, ['COMPETING_HYPOTHESES_UNASSESSED','UNVERIFIED_ASSUMPTIONS','CONFIDENCE_MODEL_UNCALIBRATED']);
      assert.equal(row.policy_version, 'confidence-foundation-v1'); assert.equal(row.provenance, 'QANDEEL_CONFIDENCE_RUNTIME');
      const minimal = { id: randomUUID(), target_id: hypothesis, target_version: 1 };
      const omitted = (await client.query('SELECT * FROM public.create_confidence_evaluation($1::jsonb)', [minimal])).rows[0];
      assert.deepEqual(omitted.supporting_evidence_ids, row.supporting_evidence_ids);
      assert.deepEqual(omitted.contradicting_evidence_ids, row.contradicting_evidence_ids);
      assert.deepEqual(omitted.assumptions, row.assumptions); assert.deepEqual(omitted.alternative_hypothesis_ids, row.alternative_hypothesis_ids);
      assert.deepEqual(omitted.missing_information_codes, row.missing_information_codes);
    } finally { await client.query('ROLLBACK'); }
  } finally { await client.end(); }
}

main().then(() => console.log('Verified migration 0006 canonical confidence snapshots resist forged and omitted RPC fields.'))
  .catch((error) => { console.error(`Confidence database verification failed (${error?.code ?? 'verification'}, position ${error?.position ?? 'unknown'}, routine ${error?.routine ?? 'unknown'}). Connection details were suppressed.`); process.exitCode = 1; });
