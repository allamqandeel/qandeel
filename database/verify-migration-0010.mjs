import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{readFile}from'node:fs/promises';import process from'node:process';import pg from'pg';
const{Client}=pg;if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required in the ignored local .env file.');
const migration=await readFile(new URL('./migrations/0010_initial_him_metrics_v1.sql',import.meta.url),'utf8');const client=new Client({connectionString:process.env.DATABASE_URL});
async function identity(id){await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);}
async function rejects(text,values=[]){await client.query('SAVEPOINT expected_failure');try{await assert.rejects(client.query(text,values));}finally{await client.query('ROLLBACK TO SAVEPOINT expected_failure');await client.query('RELEASE SAVEPOINT expected_failure');}}
await client.connect();try{if(!(await client.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='him_metric_definitions' AND column_name='calculation_status') present")).rows[0].present)await client.query(migration);await client.query('BEGIN');try{
 // The durable 0010 guarantee is the canonical v1 Foundation inventory: these
 // exact seventeen v1 identities exist and carry their approved v1 metadata.
 // Every assertion below is scoped to those exact identities at
 // definition_version=1, so a later definition version (hse.energy@2), a later
 // metric key, or any other legitimately reviewed future row may coexist in
 // the live table without failing this historical phase. The migration-time
 // exact-inventory assertions inside 0010 itself remain untouched historical
 // facts.
 const CANONICAL_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
 const rows=(await client.query('SELECT * FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[]) ORDER BY metric_key',[CANONICAL_V1])).rows;assert.equal(rows.length,CANONICAL_V1.length,'every canonical v1 Foundation identity exists exactly once');for(const[key,scale]of[['hse.energy','hse.energy.ordinal-5.v1'],['hse.motivation','hse.motivation.ordinal-5.v1'],['hse.attention','hse.attention.ordinal-5.v1'],['hse.self-confidence','hse.self-confidence.ordinal-5.v1'],['hse.stress','hse.stress.ordinal-5.v1']]){const metric=rows.find(r=>r.metric_key===key);assert.equal(metric.calculation_status,'CALIBRATED');assert.equal(metric.scale_reference,scale);}assert.ok(rows.filter(r=>r.calculation_status==='UNCALIBRATED').every(r=>r.scale_reference==='UNCALIBRATED_NO_PRODUCTION_SCALE'),'uncalibrated definitions keep the no-production-scale shape (later HIM Expansion tasks may calibrate more)');assert.ok(rows.every(r=>r.confidence_requirement_reference==='UNRESOLVED_METRIC_CONFIDENCE_MODEL'&&r.dependency_ids.length===0),'the canonical v1 identities keep the unresolved confidence reference and the zero-dependency v1 shape');assert.equal(rows.filter(r=>r.semantic_mapping_status==='RESOLVED').length,6,'the v1 resolved semantic mapping distribution within the canonical v1 identities');assert.equal(rows.filter(r=>r.semantic_mapping_status==='UNRESOLVED'&&r.semantic_type===null).length,11,'the v1 unresolved semantic mapping distribution within the canonical v1 identities');
 const trust=rows.find(r=>r.metric_key==='hrs.relationship-trust');assert.deepEqual(trust.valid_context_kinds,['RELATIONSHIP']);const confidence=rows.find(r=>r.metric_key==='hse.self-confidence');assert.equal(confidence.canonical_name,'Confidence');assert.ok(!confidence.valid_context_kinds.includes('GLOBAL'));
 // The 0010-era generic direct snapshot writer was retired by migration 0051:
 // canonical measurement state may now be created only through a metric-owned
 // structured measurement path, so this historical verifier no longer requires
 // a successful authenticated generic write on the fully migrated latest
 // schema. The durable 0010 guarantee that survives is that the legacy
 // identity still exists, grants no application role EXECUTE, and can create
 // no snapshot. Migration 0051's detailed retirement behavior belongs to
 // verify-migration-0051.mjs, not here.
 const user=randomUUID();await client.query('RESET ROLE');await client.query('INSERT INTO public.users(id,auth_subject) VALUES($1::uuid,$1::text)',[user]);
 const legacy=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') public,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role,pg_get_function_result($1::regprocedure) result",['public.create_him_metric_snapshot(jsonb)'])).rows[0];
 assert.equal(legacy.result,'SETOF him_metric_snapshots','the legacy generic snapshot identity is retired, not removed');
 assert.deepEqual({public:legacy.public,anon:legacy.anon,authenticated:legacy.authenticated,service_role:legacy.service_role},{public:false,anon:false,authenticated:false,service_role:false},'no application role may execute the retired generic snapshot writer');
 await identity(user);const observation={id:randomUUID(),metricKey:'hse.stress',definitionVersion:1,valueState:'UNASSESSED',supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'SITUATION',contextId:'verifier-situation',scope:'exact situation',validityStatus:'VALID',descriptiveUpdateReason:'verifier',descriptiveUpdateReferenceIds:[]};
 const before=(await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n;
 await rejects('SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[observation]);await rejects('SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{...observation,id:randomUUID(),metricKey:'hbs.avoidance'}]);await rejects('SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{...observation,id:randomUUID(),valueState:'ASSESSED',numericValue:0}]);
 assert.equal((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n,before,'the retired generic writer creates no snapshot');
 await rejects("UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED' WHERE metric_key='hse.stress'");
}finally{await client.query('ROLLBACK');}}finally{await client.end();}
console.log('Verified Initial HIM Metrics v1 catalog, scope, immutability, missingness, and uncalibrated direct-RPC fail-closed behavior.');

