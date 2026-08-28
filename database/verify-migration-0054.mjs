// Real-PostgreSQL verifier for migration 0054 - HIM Contextual Current
// Intelligence Batch Read v1 (QHIA-004). Proves, on actual returned rows and
// the INSTALLED function definition: the batch RPC is one fail-closed,
// authenticated, owner-exact, read-only STABLE SECURITY DEFINER transport
// surface with a fixed search_path, no dynamic SQL, and authenticated-only
// EXECUTE; it DELEGATES every per-slot current value to the canonical latest
// authority read_him_latest_measurement_v1 and every binding identity to the
// existing resolver him_active_structured_binding_id while its installed
// definition references no forbidden currentness substrate or algorithm; the
// input contract is bounded (1..17 aligned duplicate-free exact slots, exact
// persisted definitions, definition-approved context kinds only); one result
// row is returned per requested slot in exact input-ordinal order, including
// an absent-canonical envelope with definition metadata present and every
// source field null; a real canonical current row surfaces through the batch
// with the same identity/value facts as the direct canonical-latest
// authority; the ACTIVE binding id equals the existing resolver; reads write
// no state and grant no consumption semantics; and every fixture rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionTwo=randomUUID();
const RPC='public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])';
const BATCH_SQL='SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
const SESSION_SLOTS=['hse.stress','hse.energy','hse.attention','hbs.reflection'];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const rejectsWith=async(pattern,params)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(BATCH_SQL,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected batch rejection ${pattern} for [${params.slice(1,3).join(', ')} | ${JSON.stringify(params[3])}], got: ${message||'success'}`);};
const batch=async params=>(await client.query(BATCH_SQL,params)).rows;
const measurementCounts=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results')).rows[0];
const time=value=>value===null?null:value.getTime();
await client.connect();try{
 const initialSnapshots=Number((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n);
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$4,'ACTIVE','TEXT'),($2,$4,'ACTIVE','TEXT'),($3,$5,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionTwo,one,two]);
 await client.query('BEGIN');
 // --- 1..9: installed-function facts: exact signature, safe properties,
 //     narrow ACL, required delegation, forbidden substrate absence ---------
 if((await client.query('SELECT to_regprocedure($1) reg',[RPC])).rows[0].reg===null)throw new Error('The batch RPC must exist with the exact intended signature');
 const props=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[RPC])).rows[0];
 if(!props.prosecdef)throw new Error('The batch RPC must be SECURITY DEFINER');
 if(props.provolatile!=='s')throw new Error('The batch RPC must be STABLE');
 if(!(props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The batch RPC must pin a fixed safe search_path');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(props.definition))throw new Error('The batch RPC must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(props.definition))throw new Error('The batch RPC must not reconstruct a JWT');
 const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[RPC])).rows[0];
 if(acl.pub||acl.anon||acl.service_role||!acl.authenticated)throw new Error('Batch EXECUTE authority must be authenticated-only');
 if(!props.definition.includes('public.read_him_latest_measurement_v1('))throw new Error('The installed batch function must delegate current values to the canonical latest authority');
 if(!props.definition.includes('public.him_active_structured_binding_id('))throw new Error('The installed batch function must resolve binding identity through the existing resolver');
 if(!props.definition.includes('him_metric_definitions')||!props.definition.includes('valid_context_kinds'))throw new Error('The installed batch function must read exact persisted definition metadata');
 for(const forbidden of['him_measurement_events','him_measurement_observations','him_metric_snapshots','him_current_structured_measurements','him_energy_calculation_supersessions','him_canonical_model_bindings','snapshot_version','supersedes_observation_id'])if(props.definition.includes(forbidden))throw new Error(`The installed batch function must not own currentness semantics: found ${forbidden}`);
 // 25: transport only - no Runtime Consumption/interpretation semantics in
 // the installed definition.
 if(/trend|readiness|freshness|recommendation|hypothesis|question_|score|valence|diagnos/i.test(props.definition))throw new Error('The batch function must stay a transport surface with no consumption semantics');
 // --- Owned context fixtures on the canonical ownership substrates ----------
 await identity(one);
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier batch situation')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier batch goal')")).rows[0];
 // Canonical measured fixtures through the real first-class RPCs only.
 const obsEnergy=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[sessionMain])).rows[0];
 const snapEnergy=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obsEnergy.id])).rows[0];
 const obsStress=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'MODERATE',NULL)",[situationTarget.id])).rows[0];
 const snapStress=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[obsStress.id])).rows[0];
 if(!snapEnergy?.id||!snapStress?.id)throw new Error('Fixture invariant: energy and stress canonical rows must exist');
 // --- 13: bounded aligned arrays ---------------------------------------------
 await rejectsWith(/metric identity arrays are required/,[one,'CONVERSATION_SESSION',sessionMain,null,[1]]);
 await rejectsWith(/metric identity arrays are required/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],null]);
 await rejectsWith(/between 1 and 17 aligned exact metric slots/,[one,'CONVERSATION_SESSION',sessionMain,[],[]]);
 await rejectsWith(/between 1 and 17 aligned exact metric slots/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[1,1]]);
 await rejectsWith(/between 1 and 17 aligned exact metric slots/,[one,'CONVERSATION_SESSION',sessionMain,Array.from({length:18},()=>'hse.energy'),Array.from({length:18},()=>1)]);
 await rejectsWith(/Invalid exact HIM metric identity/,[one,'CONVERSATION_SESSION',sessionMain,[null],[1]]);
 await rejectsWith(/Invalid exact HIM metric identity/,[one,'CONVERSATION_SESSION',sessionMain,[''],[1]]);
 await rejectsWith(/Invalid exact HIM metric identity/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[0]]);
 await rejectsWith(/Invalid exact HIM metric identity/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[null]]);
 // --- 14: duplicate exact requested definition -------------------------------
 await rejectsWith(/Duplicate exact HIM metric definition/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy','hse.energy'],[1,1]]);
 // --- 15: missing exact definition (no implicit or inferred version) ---------
 await rejectsWith(/Unknown exact HIM metric definition/,[one,'CONVERSATION_SESSION',sessionMain,['not.a-canonical-metric'],[1]]);
 await rejectsWith(/Unknown exact HIM metric definition/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[9999]]);
 await rejectsWith(/Unknown exact HIM metric definition/,[one,'CONVERSATION_SESSION',sessionMain,["hse.energy';DROP TABLE x;--"],[1]]);
 // --- 16: definition-approved context eligibility and batch kind bounds ------
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'CONVERSATION_SESSION',sessionMain,['hbs.avoidance'],[1]]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'SITUATION',situationTarget.id,['hse.energy'],[1]]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'SITUATION',situationTarget.id,['hrs.relationship-trust'],[1]]);
 await rejectsWith(/Unsupported HIM batch context kind/,[one,'GLOBAL','GLOBAL',['hse.energy'],[1]]);
 await rejectsWith(/Unsupported HIM batch context kind/,[one,'TOTALLY_BOGUS_KIND',sessionMain,['hse.energy'],[1]]);
 await rejectsWith(/Invalid HIM context identity/,[one,'CONVERSATION_SESSION','',['hse.energy'],[1]]);
 await rejectsWith(/Invalid HIM context identity/,[one,'CONVERSATION_SESSION','x'.repeat(129),['hse.energy'],[1]]);
 // --- 11/12: owner-exact and delegated context ownership ---------------------
 await rejectsWith(/owner-exact/,[two,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[1]]);
 await rejectsWith(/Unknown or unowned HIM measurement context/,[one,'CONVERSATION_SESSION',sessionTwo,['hse.energy'],[1]]);
 await rejectsWith(/Unknown or unowned HIM measurement context/,[one,'CONVERSATION_SESSION',randomUUID(),['hse.energy'],[1]]);
 await rejectsWith(/Unknown or unowned HIM measurement context/,[one,'GOAL',situationTarget.id,['hse.motivation'],[1]]);
 // --- 17/18/19: one row per slot, exact input ordinal, absent envelope -------
 const sessionRows=await batch([one,'CONVERSATION_SESSION',sessionMain,SESSION_SLOTS,[1,1,1,1]]);
 if(sessionRows.length!==4)throw new Error('The batch must return exactly one row per requested slot');
 sessionRows.forEach((row,index)=>{
  if(row.slot_order!==index+1)throw new Error('slot_order must equal the 1-based input array ordinal');
  if(row.metric_key!==SESSION_SLOTS[index]||row.definition_version!==1)throw new Error('Each row must answer for its exact requested definition');
  if(row.context_kind!=='CONVERSATION_SESSION'||row.context_id!==sessionMain)throw new Error('Each row must carry the exact requested context identity');
  if(!row.hif_owner||!row.semantic_mapping_status||!row.calculation_status||!Array.isArray(row.valid_context_kinds)||!row.valid_context_kinds.includes('CONVERSATION_SESSION'))throw new Error('Definition metadata must be present on every requested slot row');
 });
 const energyRow=sessionRows[1];
 for(const row of[sessionRows[0],sessionRows[2],sessionRows[3]]){
  if(row.has_canonical_current_value!==false)throw new Error('An unmeasured slot must report has_canonical_current_value=false');
  for(const column of['source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id'])if(row[column]!==null)throw new Error(`Absent-canonical slot must carry null ${column}, got ${row[column]}`);
 }
 // --- 20: canonical parity with the direct canonical latest authority --------
 const directEnergy=(await client.query(LATEST_SQL,[one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain])).rows[0];
 if(!directEnergy||directEnergy.id!==snapEnergy.id)throw new Error('Fixture invariant: direct canonical latest must be the calculated energy row');
 if(energyRow.has_canonical_current_value!==true)throw new Error('A measured slot must report has_canonical_current_value=true');
 if(energyRow.source_metric_key!==directEnergy.metric_key||energyRow.source_definition_version!==directEnergy.definition_version||energyRow.source_context_kind!==directEnergy.context_kind||energyRow.source_context_id!==directEnergy.context_id)throw new Error('Batch source identity must equal the direct canonical latest identity');
 if(energyRow.source_semantic_mapping_status!==directEnergy.semantic_mapping_status||energyRow.source_semantic_type!==directEnergy.semantic_type)throw new Error('Batch source semantic mapping must equal the direct canonical latest mapping');
 if(energyRow.value_state!==directEnergy.value_state||Number(energyRow.numeric_value)!==Number(directEnergy.numeric_value)||energyRow.validity_status!==directEnergy.validity_status||energyRow.confidence_state!==directEnergy.confidence_state||energyRow.confidence_reference!==directEnergy.confidence_reference)throw new Error('Batch value facts must equal the direct canonical latest value facts');
 if(time(energyRow.observed_at)!==time(directEnergy.observed_at)||time(energyRow.temporal_window_start)!==time(directEnergy.temporal_window_start)||time(energyRow.temporal_window_end)!==time(directEnergy.temporal_window_end))throw new Error('Batch temporal facts must equal the direct canonical latest temporal facts');
 if(energyRow.canonical_binding_id!==directEnergy.canonical_binding_id)throw new Error('Batch source binding identity must equal the direct canonical latest binding identity');
 // Definition metadata parity against the persisted definition authority.
 await client.query('RESET ROLE');
 const energyDefinition=(await client.query("SELECT hif_owner,semantic_mapping_status,semantic_type,calculation_status,valid_context_kinds FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=1")).rows[0];
 await identity(one);
 if(energyRow.hif_owner!==energyDefinition.hif_owner||energyRow.semantic_mapping_status!==energyDefinition.semantic_mapping_status||energyRow.semantic_type!==energyDefinition.semantic_type||energyRow.calculation_status!==energyDefinition.calculation_status||JSON.stringify(energyRow.valid_context_kinds)!==JSON.stringify(energyDefinition.valid_context_kinds))throw new Error('Batch definition metadata must equal the persisted definition authority');
 // --- 21: ACTIVE binding identity equals the existing resolver ---------------
 const resolver=(await client.query("SELECT public.him_active_structured_binding_id('hse.energy',1,'CONVERSATION_SESSION') id")).rows[0].id;
 if(resolver===null||energyRow.active_binding_id!==resolver)throw new Error('Batch active_binding_id must equal the existing ACTIVE-binding resolver');
 const stressResolver=(await client.query("SELECT public.him_active_structured_binding_id('hse.stress',1,'SITUATION') id")).rows[0].id;
 // --- 22: representative multi-substrate multi-metric order preservation -----
 const reversedRequest=['hgs.habit-strength','hbs.avoidance','hse.stress'];
 const situationRows=await batch([one,'SITUATION',situationTarget.id,reversedRequest,[1,1,1]]);
 if(situationRows.length!==3)throw new Error('A subset batch must return exactly its requested cardinality');
 situationRows.forEach((row,index)=>{if(row.slot_order!==index+1||row.metric_key!==reversedRequest[index])throw new Error('The batch must preserve the exact requested order, never reorder it');});
 const stressRow=situationRows[2];
 if(stressRow.has_canonical_current_value!==true||stressRow.canonical_binding_id!==snapStress.canonical_binding_id||Number(stressRow.numeric_value)!==Number(snapStress.numeric_value))throw new Error('The target-substrate stress slot must carry its canonical current facts');
 if(stressRow.active_binding_id!==stressResolver)throw new Error('The stress slot active_binding_id must equal the existing resolver');
 if(situationRows[0].has_canonical_current_value!==false||situationRows[1].has_canonical_current_value!==false)throw new Error('Unmeasured SITUATION slots must report absent canonical values');
 // Deterministic repeat read.
 const repeat=await batch([one,'SITUATION',situationTarget.id,reversedRequest,[1,1,1]]);
 if(JSON.stringify(repeat.map(row=>[row.slot_order,row.metric_key,row.has_canonical_current_value,row.canonical_binding_id]))!==JSON.stringify(situationRows.map(row=>[row.slot_order,row.metric_key,row.has_canonical_current_value,row.canonical_binding_id])))throw new Error('Batch reads must be deterministic across repeated calls');
 // A valid owned GOAL context with no measurement: full envelope, zero leakage.
 const goalRows=await batch([one,'GOAL',goalTarget.id,['hse.motivation','hgs.purpose-alignment'],[1,1]]);
 if(goalRows.length!==2||goalRows.some(row=>row.has_canonical_current_value!==false))throw new Error('An owned unmeasured GOAL context must return absent-canonical envelopes');
 // --- 10: unauthenticated, anon, service_role --------------------------------
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(/Authentication required/,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[1]]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(BATCH_SQL,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[1]]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE service_role');
 await rejects(BATCH_SQL,[one,'CONVERSATION_SESSION',sessionMain,['hse.energy'],[1]]);
 await client.query('RESET ROLE');
 // --- 23: read-only - no history write or mutation of any kind ---------------
 const before=await measurementCounts();
 await identity(one);
 await batch([one,'CONVERSATION_SESSION',sessionMain,SESSION_SLOTS,[1,1,1,1]]);
 await batch([one,'SITUATION',situationTarget.id,['hse.stress'],[1]]);
 await batch([one,'CONVERSATION_SESSION',sessionEmpty,['hse.energy'],[1]]);
 await client.query('RESET ROLE');
 const after=await measurementCounts();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Batch reads must write no measurement state');
 // Owner isolation positive path: the other user reads only their own empty
 // session and sees an absent-canonical envelope, never another user's value.
 await identity(two);
 const isolated=await batch([two,'CONVERSATION_SESSION',sessionTwo,['hse.energy'],[1]]);
 if(isolated.length!==1||isolated[0].has_canonical_current_value!==false||isolated[0].canonical_binding_id!==null)throw new Error('The other user must see only an absent envelope for their own empty session');
 await client.query('ROLLBACK');
 // --- 24: complete fixture rollback ------------------------------------------
 if(Number((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n)!==initialSnapshots)throw new Error('The verifier changed the durable snapshot population');
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=$1)+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=$1)+(SELECT count(*) FROM public.him_measurement_observations WHERE user_id=$1) total',[one])).rows[0].total);
 if(residue!==0)throw new Error('Batch verifier fixtures must roll back completely');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Contextual Current Intelligence Batch Read v1 (QHIA-004): the batch RPC exists with the exact intended five-parameter signature as a read-only STABLE SECURITY DEFINER with a fixed safe search_path, no dynamic SQL, no JWT reconstruction, and authenticated-only EXECUTE (no PUBLIC, anon, or service_role authority); its INSTALLED definition delegates every per-slot current value to read_him_latest_measurement_v1 and every binding identity to him_active_structured_binding_id, reads exact persisted definition metadata, and references no forbidden currentness substrate, chronology, correction/snapshot selection, binding table, or consumption semantics; unauthenticated, anon, service_role, wrong-user, cross-user-context, and unknown-context calls all fail closed through the delegated ownership authority without leaking other users\' data; null, empty, mismatched, oversized, null-element, and zero-version slot arrays reject, duplicate exact requested definitions reject, missing exact definitions and SQL-ish metric text reject with no implicit version inference, and definition-unapproved context kinds and non-canonical batch kinds reject; a full CONVERSATION_SESSION request returns exactly one row per requested slot in exact 1-based input ordinal order with definition metadata present on every row, absent-canonical slots carry has_canonical_current_value=false with every source/current field null, and a measured slot carries identity, semantic-mapping, value, temporal, and binding facts equal to the direct canonical-latest authority and an active_binding_id equal to the existing resolver on both the session and target substrates; a reversed multi-metric request preserves exact requested order and cardinality deterministically across repeated reads; batch reads write no measurement state; and every fixture rolls back completely with the durable snapshot population unchanged.');
