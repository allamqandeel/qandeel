import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import { readFile } from 'node:fs/promises'; import process from 'node:process'; import pg from 'pg';
const {Client}=pg; if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const migration=await readFile(new URL('./migrations/0008_hypothesis_update_loop.sql',import.meta.url),'utf8'); const client=new Client({connectionString:process.env.DATABASE_URL});
async function identity(id){ await client.query('SET LOCAL ROLE authenticated'); await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]); }
async function rejects(text,values){ await client.query('SAVEPOINT expected_failure'); try{ await assert.rejects(client.query(text,values)); }finally{ await client.query('ROLLBACK TO SAVEPOINT expected_failure'); await client.query('RELEASE SAVEPOINT expected_failure'); } }
async function main(){ await client.connect(); try{
  if(!(await client.query("SELECT to_regclass('public.hypothesis_updates') IS NOT NULL present")).rows[0].present) await client.query(migration);
  else {
    const definition=migration.match(/CREATE FUNCTION public\.apply_hypothesis_evidence_update[\s\S]*?END; \$\$;/u)?.[0]; assert.ok(definition);
    await client.query('DROP FUNCTION public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text)');
    await client.query(definition);
    await client.query('REVOKE ALL ON FUNCTION public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text) FROM PUBLIC, anon');
    await client.query('GRANT EXECUTE ON FUNCTION public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text) TO authenticated');
  }
  await client.query('BEGIN'); try{
    const user=randomUUID(),other=randomUUID(),hypothesis=randomUUID(),otherHypothesis=randomUUID(),support=randomUUID(),contradict=randomUUID(),otherMemory=randomUUID(),ineligible=randomUUID(),duplicateWinner=randomUUID(),duplicateLoser=randomUUID(); await client.query('RESET ROLE');
    await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text),($2::uuid,$2::text)',[user,other]);
    await client.query(`INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status) VALUES
      ($1,$5,'USER','PERSONAL_FACT','support','USER_STATED',.9,.5,'ACTIVE'),($2,$5,'USER','PERSONAL_FACT','contradict','USER_CONFIRMED',.9,.5,'ACTIVE'),
      ($3,$6,'USER','PERSONAL_FACT','other','USER_STATED',.9,.5,'ACTIVE'),($4,$5,'USER','PERSONAL_FACT','inactive','USER_STATED',.9,.5,'SUPERSEDED'),
      ($7,$5,'USER','GOAL','  Canonical   duplicate  ','USER_STATED',.9,.5,'ACTIVE'),($8,$5,'USER','GOAL','Canonical duplicate','USER_STATED',.9,.5,'ACTIVE')`,[support,contradict,otherMemory,ineligible,user,other,duplicateWinner,duplicateLoser]);
    await client.query("UPDATE public.memories SET updated_at=CASE id WHEN $1 THEN '2098-01-02T00:00:00Z'::timestamptz WHEN $2 THEN '2098-01-01T00:00:00Z'::timestamptz ELSE updated_at END WHERE id IN ($1,$2)",[duplicateWinner,duplicateLoser]);
    await client.query("INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,assumptions) VALUES($1,$3,'owned','CAUSAL','GENERAL','fixed scope','HUMAN_REVIEWED','ACTIVE',ARRAY['fixed assumption']),($2,$4,'other','CAUSAL','GENERAL','fixed scope','HUMAN_REVIEWED','ACTIVE','{}')",[hypothesis,otherHypothesis,user,other]);
    await identity(user); const call='SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)';
    await rejects(call,[randomUUID(),hypothesis,1,`memory:${duplicateLoser}`,'SUPPORTING']);
    const first=(await client.query(call,[randomUUID(),hypothesis,1,`memory:${support}`,'SUPPORTING'])).rows[0]; assert.equal(first.update.user_id,user); assert.equal(first.update.before_version,1); assert.equal(first.update.after_version,2); assert.equal(first.update.source,'QANDEEL_HYPOTHESIS_UPDATE_LOOP'); assert.deepEqual(first.hypothesis.supporting_evidence_ids,[`memory:${support}`]); assert.equal(first.hypothesis.status,'ACTIVE'); assert.deepEqual(first.hypothesis.assumptions,['fixed assumption']); assert.equal(first.hypothesis.scope,'fixed scope'); assert.deepEqual(first.hypothesis.competing_hypothesis_ids,[]);
    await rejects(call,[randomUUID(),hypothesis,1,`memory:${contradict}`,'CONTRADICTING']); await rejects(call,[randomUUID(),hypothesis,2,`memory:${support}`,'SUPPORTING']); await rejects(call,[randomUUID(),hypothesis,2,`memory:${support}`,'CONTRADICTING']); await rejects(call,[randomUUID(),hypothesis,2,`memory:${otherMemory}`,'SUPPORTING']); await rejects(call,[randomUUID(),hypothesis,2,`memory:${ineligible}`,'SUPPORTING']);
    assert.equal((await client.query(call,[randomUUID(),otherHypothesis,1,`memory:${contradict}`,'CONTRADICTING'])).rowCount,0);
    const second=(await client.query(call,[randomUUID(),hypothesis,2,`memory:${contradict}`,'CONTRADICTING'])).rows[0]; assert.equal(second.update.before_version,2); assert.equal(second.update.after_version,3); assert.deepEqual(second.hypothesis.contradicting_evidence_ids,[`memory:${contradict}`]);
    const boundedIds=Array.from({length:65},()=>randomUUID());
    for(let index=0;index<boundedIds.length;index+=1) await client.query(`INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status,created_at,updated_at)
      VALUES($1,$2,'USER','PERSONAL_FACT',$3,'USER_STATED',.9,.5,'ACTIVE',$4,$4)`,[boundedIds[index],user,`bounded-${index}`,new Date(Date.UTC(2099,0,1,0,0,index)).toISOString()]);
    await identity(user); await rejects(call,[randomUUID(),hypothesis,3,`memory:${boundedIds[0]}`,'SUPPORTING']);
    await rejects("INSERT INTO public.hypothesis_updates(id,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source) VALUES($1,$2,$3,9,99,$4,'SUPPORTING','forged')",[randomUUID(),user,hypothesis,`memory:${support}`]);
    await identity(other); assert.equal((await client.query('SELECT * FROM public.hypothesis_updates WHERE hypothesis_id=$1',[hypothesis])).rowCount,0);
  } finally{ await client.query('ROLLBACK'); }
} finally{ await client.end(); }}
main().then(()=>console.log('Verified migration 0008 exact-version mutation, ownership/RLS, evidence eligibility and role integrity, canonical immutable audit, and lifecycle non-mutation.')).catch(error=>{console.error(`Hypothesis update database verification failed (${error?.code??'verification'}): ${error?.message??'unknown assertion'}. Connection details were suppressed.`);process.exitCode=1;});
