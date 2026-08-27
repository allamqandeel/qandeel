// Real-PostgreSQL forward-extension proof for the QHIM-002 historical
// verifier sweep. Inside one rollback-safe transaction it creates synthetic
// FUTURE extension fixtures that would have broken the pre-remediation
// historical verifiers - a legitimate future definition version (hse.energy@2)
// and two synthetic functions whose names deliberately enter the formerly
// frozen background_%_v1 and background_read_him% namespaces - and proves the
// remediated historical contracts still identify their exact owned canonical
// v1 definitions and their exact owned background functions without treating
// the extra objects as failure.
//
// Method (as required when direct child execution is unsafe): the historical
// verifier scripts are NOT spawned as child processes, because their fixtures
// live inside this transaction and would be invisible to another connection,
// while committing them would pollute the shared CI database for every later
// verifier step. Instead this proof combines (1) exact static proof of every
// affected verifier query, extracted verbatim from the verifier sources, and
// (2) real-PostgreSQL execution of those exact extracted query strings against
// the fixture-extended database, comparing each result before and after the
// synthetic future objects exist.
import pg from'pg';import{readdirSync,readFileSync}from'node:fs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const dir=new URL('./',import.meta.url);
const HARNESS='verify-him-historical-verifier-forward-compatibility-v1.mjs';
const CANONICAL_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
const HSE_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress'];
const OWNED_BACKGROUND=['background_create_system_hypothesis_v1(uuid,uuid,text,text,text,text,text[],text[])','background_attach_hypothesis_evidence_v1(uuid,uuid,text,text)','background_link_competing_hypotheses_v1(uuid,uuid,uuid)','background_create_confidence_evaluation_v1(uuid,uuid,uuid,integer)','background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text)','background_read_him_conversation_snapshot_v1(uuid,uuid)'];
const FUTURE_PROBES=['background_future_extension_probe_v1','background_read_him_future_probe_v1'];
const executable=text=>text.split('\n').map(line=>{const at=line.indexOf('//');return at===-1?line:(/^\s*\/\//.test(line)?'':line.slice(0,at));}).join('\n');
const files=readdirSync(dir).filter(name=>name.startsWith('verify-')&&name.endsWith('.mjs')&&name!==HARNESS).sort();
const catalogQueries=[];
for(const name of files){
 const code=executable(readFileSync(new URL(name,dir),'utf8'));
 for(const match of code.matchAll(/(['"`])((?:(?!\1)[\s\S])*?)\1/g)){
  const sql=match[2];
  if(!/FROM public\.him_metric_definitions/.test(sql))continue;
  // Static proof: every affected historical query is version scoped.
  if(!/definition_version=1/.test(sql))throw new Error(`${name} still reads him_metric_definitions without definition_version=1 scoping: ${sql.slice(0,120)}`);
  if(sql.includes('${'))throw new Error(`${name} builds an interpolated catalog query that cannot be proven verbatim`);
  catalogQueries.push({name,sql});
 }
}
if(catalogQueries.length<15)throw new Error('Expected the affected historical catalog queries to be discovered from the verifier sources');
// Static proof: no historical verifier takes a census of the live function
// namespace any more, so a synthetic future function in either namespace can
// never be read as a historical regression.
for(const name of files){
 const code=executable(readFileSync(new URL(name,dir),'utf8'));
 if(/LIKE\s+'background_/i.test(code)||/proname\s+(?:I?LIKE|~)/i.test(code))throw new Error(`${name} still takes a live function namespace census`);
}
// Key-scoped historical queries are all executed with the canonical v1 key set
// (a superset of any narrower historical scope such as the five HSE keys), so
// every extracted query is compared before and after under identical inputs.
const run=async({sql})=>(await client.query(sql,sql.includes('$1::text[]')?[CANONICAL_V1]:[])).rows;
const snapshotCatalog=async()=>{const out=[];for(const query of catalogQueries)out.push({name:query.name,sql:query.sql,rows:await run(query)});return out;};
const ownedBackgroundState=async()=>{const out=[];for(const signature of OWNED_BACKGROUND){const{rows:[row]}=await client.query("SELECT pg_get_functiondef($1::regprocedure) definition,has_function_privilege('service_role',$1,'EXECUTE') service,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('public',$1,'EXECUTE') public",[`public.${signature}`]);out.push({signature,...row});}return out;};
const census=async pattern=>Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND p.proname LIKE $1",[pattern])).rows[0].n);
const unscopedDefinitionCount=async()=>Number((await client.query('SELECT count(*)::int n FROM public.him_metric_definitions')).rows[0].n);
await client.connect();try{
 await client.query('BEGIN');
 // --- Baseline: the canonical inventory and the owned function authority ------
 const beforeCatalog=await snapshotCatalog();
 const beforeOwned=await ownedBackgroundState();
 const beforeUnscoped=await unscopedDefinitionCount();
 const beforeBackgroundCensus=await census('background\\_%\\_v1');
 const beforeHimReaderCensus=await census('background\\_read\\_him%');
 for(const entry of beforeCatalog){
  const keys=entry.rows.filter(row=>'metric_key'in row).map(row=>row.metric_key);
  if(keys.length&&CANONICAL_V1.some(key=>!keys.includes(key))&&/metric_key=ANY/.test(entry.sql))throw new Error(`${entry.name} does not resolve the canonical v1 inventory before the future fixtures exist`);
 }
 if(beforeOwned.some(row=>!row.definition||!row.service||row.authenticated||row.anon||row.public))throw new Error('Baseline owned background authority failed');
 // --- Synthetic future definition version: hse.energy@2 -----------------------
 // A legitimate later definition version of an existing canonical metric,
 // copied from the durable v1 identity shape with only the version distinct.
 // No production model, approval, or binding is created for it: it exists
 // solely to prove the historical v1 checks are version scoped.
 await client.query(`INSERT INTO public.him_metric_definitions SELECT (jsonb_populate_record(NULL::public.him_metric_definitions,to_jsonb(d)||'{"definition_version":2}'::jsonb)).* FROM public.him_metric_definitions d WHERE d.metric_key='hse.energy' AND d.definition_version=1`);
 const future=await client.query("SELECT calculation_status,scale_reference FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=2");
 if(future.rowCount!==1)throw new Error('The synthetic hse.energy@2 future definition version was not created');
 if(await unscopedDefinitionCount()!==beforeUnscoped+1)throw new Error('The synthetic future definition version did not enter the live definitions table');
 // --- Synthetic future functions in the formerly frozen namespaces ------------
 await client.query("CREATE FUNCTION public.background_future_extension_probe_v1() RETURNS integer LANGUAGE sql IMMUTABLE AS $probe$SELECT 1$probe$");
 await client.query("CREATE FUNCTION public.background_read_him_future_probe_v1() RETURNS integer LANGUAGE sql IMMUTABLE AS $probe$SELECT 1$probe$");
 const afterBackgroundCensus=await census('background\\_%\\_v1'),afterHimReaderCensus=await census('background\\_read\\_him%');
 if(afterBackgroundCensus!==beforeBackgroundCensus+2||afterHimReaderCensus!==beforeHimReaderCensus+1)throw new Error('The synthetic future functions did not enter the formerly frozen namespaces');
 // The fixtures are meaningful: each one changes exactly the global universe
 // that the pre-remediation verifiers froze, so every proof below would have
 // failed before this remediation.
 // --- Proof 1: every extracted historical catalog query is version scoped ----
 const afterCatalog=await snapshotCatalog();
 if(afterCatalog.length!==beforeCatalog.length)throw new Error('The discovered historical catalog query set changed');
 for(let index=0;index<afterCatalog.length;index++){
  const before=beforeCatalog[index],after=afterCatalog[index];
  if(after.sql!==before.sql)throw new Error('Catalog query drift between snapshots');
  if(JSON.stringify(after.rows)!==JSON.stringify(before.rows))throw new Error(`${after.name} changed its result once a legitimate hse.energy@2 existed: the historical query is not version scoped`);
  const energy=after.rows.filter(row=>row.metric_key==='hse.energy');
  if('metric_key'in(after.rows[0]??{})&&energy.length>1)throw new Error(`${after.name} resolved more than one Energy identity`);
 }
 // --- Proof 2: the owned background authority is unchanged by the probes -----
 const afterOwned=await ownedBackgroundState();
 if(JSON.stringify(afterOwned)!==JSON.stringify(beforeOwned))throw new Error('The exact owned background function authority changed once synthetic future functions existed');
 for(const row of afterOwned){
  if(/auth\.uid\s*\(/i.test(row.definition))throw new Error(`${row.signature} derives auth.uid()`);
  if(!row.service||row.authenticated||row.anon||row.public)throw new Error(`${row.signature} ACL mismatch`);
 }
 // --- Proof 3: the canonical v1 inventory still resolves exactly -------------
 const inventory=(await client.query('SELECT metric_key,calculation_status FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[]) ORDER BY metric_key',[CANONICAL_V1])).rows;
 if(inventory.length!==CANONICAL_V1.length||CANONICAL_V1.some(key=>!inventory.some(row=>row.metric_key===key&&row.calculation_status==='CALIBRATED')))throw new Error('The canonical v1 inventory no longer resolves exactly with a future version present');
 const hseScoped=(await client.query('SELECT metric_key,scale_reference FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[])',[HSE_V1])).rows;
 if(hseScoped.length!==HSE_V1.length)throw new Error('The five canonical HSE v1 calibration identities no longer resolve exactly');
 // --- Proof 4: QHIM-001 structured currentness is untouched -------------------
 const view=(await client.query("SELECT pg_get_viewdef('public.him_current_structured_measurements'::regclass) def")).rows[0].def;
 if(!view.includes('DISTINCT ON')||!view.includes('him_active_structured_binding_id'))throw new Error('QHIM-001 structured-current selection regressed');
 if(CANONICAL_V1.some(key=>!view.includes(key)))throw new Error('QHIM-001 seventeen-route structured-current view regressed');
 await client.query('ROLLBACK');
 // --- Zero residue -----------------------------------------------------------
 const residue=(await client.query("SELECT (SELECT count(*) FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version<>1)+(SELECT count(*) FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND p.proname=ANY($1::name[])) total",[FUTURE_PROBES])).rows[0].total;
 if(Number(residue)!==0)throw new Error('Synthetic future fixtures did not roll back completely');
 if(await unscopedDefinitionCount()!==beforeUnscoped)throw new Error('The live definitions table did not return to its pre-fixture state');
 if(await census('background\\_%\\_v1')!==beforeBackgroundCensus||await census('background\\_read\\_him%')!==beforeHimReaderCensus)throw new Error('The live function namespaces did not return to their pre-fixture state');
}finally{try{await client.query('ROLLBACK');}catch{}await client.end();}
console.log('Verified HIM historical verifier forward compatibility (QHIM-002): every historical catalog query discovered in the verifier sources is version scoped and returns a byte-identical result with a legitimate synthetic hse.energy@2 present, no historical verifier takes a live function-namespace census, the exact owned background command signatures keep their definitions and service-role-only ACLs with no auth.uid() while synthetic functions occupy the formerly frozen background_%_v1 and background_read_him% namespaces, the canonical seventeen v1 identities and the five HSE v1 calibration identities still resolve exactly, QHIM-001 structured-current selection is untouched, and every synthetic future definition version and probe function rolled back with zero residue.');
