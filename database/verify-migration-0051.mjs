// Real-PostgreSQL verifier for migration 0051 - HIM Legacy Snapshot Authority
// & Energy Context Reconciliation v1 (QHIM-003). Proves: the Foundation-era
// generic direct snapshot writer is a fail-closed no-write tombstone with no
// application-role EXECUTE; every canonical v1 metric keeps a usable
// metric-owned structured measurement route, demonstrated end to end on the
// Energy path; Energy production context is CONVERSATION_SESSION-only across
// the persisted definition, the ACTIVE binding, the calibrated model row and
// the dedicated RPC, with no SITUATION Energy authority anywhere; and the
// migration preserves all existing measurement history.
import pg from'pg';import{randomUUID}from'node:crypto';import{readFileSync}from'node:fs';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const migration=readFileSync(new URL('./migrations/0051_him_legacy_snapshot_authority_energy_context_reconciliation_v1.sql',import.meta.url),'utf8');
const one=randomUUID(),two=randomUUID(),sessionOne=randomUUID(),sessionTwo=randomUUID();
const LEGACY='public.create_him_metric_snapshot(jsonb)';
const APPLICATION_ROLES=['public','anon','authenticated','service_role'];
const CANONICAL_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const snapshotCount=async()=>Number((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n);
await client.connect();try{
 // --- The migration itself is non-destructive --------------------------------
 // History preservation is a property of the migration text: 0051 deletes,
 // truncates, or backfills nothing, and it rewrites no historical snapshot,
 // calculation result, observation, or event.
 const executable=migration.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 // Statement-shaped, because the migration's own postcondition guard names
 // those keywords as data when it proves the tombstone contains no write.
 if(/INSERT\s+INTO|DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?\w|COPY\s+public\.|DROP\s+(?:TABLE|FUNCTION|VIEW)|ALTER\s+TABLE/i.test(executable))throw new Error('Migration 0051 must contain no destructive or history-writing statement');
 if((executable.match(/UPDATE public\.him_metric_definitions/g)??[]).length!==1||/UPDATE public\.him_metric_snapshots|UPDATE public\.him_calculation_results|UPDATE public\.him_measurement_observations/i.test(executable))throw new Error('Migration 0051 must update exactly the one Energy definition row and no history table');
 // --- Legacy generic writer: retired, no application-role EXECUTE ------------
 const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') public,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[LEGACY])).rows[0];
 for(const role of APPLICATION_ROLES)if(acl[role])throw new Error(`${role} retains EXECUTE on the retired generic snapshot writer`);
 // The identity survives for historical and schema compatibility, and its body
 // is a deterministic no-write tombstone with a fixed search_path.
 const legacy=(await client.query("SELECT p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition,pg_get_function_result(p.oid) result FROM pg_proc p WHERE p.oid=$1::regprocedure",[LEGACY])).rows[0];
 if(!legacy)throw new Error('The legacy generic snapshot writer identity was removed instead of retired');
 if(legacy.result!=='SETOF him_metric_snapshots')throw new Error('The retired writer changed its result identity');
 if(!(legacy.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The retired writer lost its fixed search_path');
 if(/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|EXECUTE\s+format/i.test(legacy.definition))throw new Error('The retired writer still contains a write or dynamic SQL path');
 if(!/retired/i.test(legacy.definition))throw new Error('The retired writer does not state its retirement');
 // Invoked from the privileged verifier connection - which bypasses the ACL -
 // it still fails closed and writes nothing. Zero-write is measured, not
 // inferred, against the global snapshot population.
 await client.query('BEGIN');
 const beforeLegacy=await snapshotCount();
 const beforeIds=(await client.query('SELECT id FROM public.him_metric_snapshots ORDER BY id')).rows.map(row=>row.id);
 const observation={id:randomUUID(),metricKey:'hse.stress',definitionVersion:1,valueState:'UNASSESSED',supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'SITUATION',contextId:'verifier-situation',scope:'exact situation',validityStatus:'VALID',descriptiveUpdateReason:'verifier',descriptiveUpdateReferenceIds:[]};
 let retirementError='';
 try{await client.query('SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[observation]);}catch(error){retirementError=error?.message??'';}
 if(!/retired/i.test(retirementError))throw new Error(`The retired writer did not fail closed with its retirement error: ${retirementError}`);
 await client.query('ROLLBACK');await client.query('BEGIN');
 if(await snapshotCount()!==beforeLegacy)throw new Error('The retired generic writer created a snapshot row');
 const afterIds=(await client.query('SELECT id FROM public.him_metric_snapshots ORDER BY id')).rows.map(row=>row.id);
 if(afterIds.join()!==beforeIds.join())throw new Error('The retired generic writer changed the snapshot population');
 // No replacement generic direct-snapshot writer was introduced by 0051.
 if(/CREATE (?:OR REPLACE )?FUNCTION public\.(?!create_him_metric_snapshot)/i.test(executable))throw new Error('Migration 0051 introduced another function');
 // --- Energy context exactness -----------------------------------------------
 // The persisted definition, the ACTIVE canonical binding, and the calibrated
 // production model all agree on CONVERSATION_SESSION only. Every catalog read
 // here is scoped to definition_version=1, so a later Energy version can never
 // change this historical phase.
 const energy=(await client.query("SELECT valid_context_kinds,calculation_status,semantic_mapping_status,semantic_type,scale_reference,required_input_contract,dependency_ids,consumers FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key='hse.energy'")).rows[0];
 if(energy.valid_context_kinds.join()!=='CONVERSATION_SESSION')throw new Error('hse.energy v1 is not CONVERSATION_SESSION-only');
 if(energy.calculation_status!=='CALIBRATED'||energy.semantic_mapping_status!=='RESOLVED'||energy.semantic_type!=='STATE'||energy.scale_reference!=='hse.energy.ordinal-5.v1'||energy.required_input_contract!=='DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1'||energy.dependency_ids.length!==0||energy.consumers.length!==0)throw new Error('The Energy reconciliation changed an attribute other than the context list');
 const bindings=(await client.query("SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind")).rows.map(row=>row.context_kind);
 if(bindings.join()!=='CONVERSATION_SESSION')throw new Error('Energy ACTIVE binding authority is not CONVERSATION_SESSION-only');
 const model=(await client.query("SELECT supported_context_kinds FROM public.him_calculation_models WHERE model_id='hse.energy.direct-structured-user-report' AND model_version=1")).rows[0];
 if(model.supported_context_kinds.join()!=='CONVERSATION_SESSION')throw new Error('The calibrated Energy model is not CONVERSATION_SESSION-only');
 // The sixteen sibling context lists are untouched by this reconciliation.
 const siblings=(await client.query("SELECT metric_key,valid_context_kinds FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key<>'hse.energy' ORDER BY metric_key")).rows;
 const expected={'hse.motivation':'SITUATION,GOAL','hse.attention':'SITUATION,CONVERSATION_SESSION,DECISION','hse.self-confidence':'SITUATION,DECISION','hse.stress':'SITUATION,CONVERSATION_SESSION','hbs.avoidance':'SITUATION,GOAL','hbs.consistency':'SITUATION,GOAL','hbs.initiative':'SITUATION,GOAL','hbs.reflection':'SITUATION,CONVERSATION_SESSION','hrs.relationship-trust':'RELATIONSHIP','hrs.communication':'RELATIONSHIP','hrs.repair':'RELATIONSHIP','hrs.emotional-safety':'RELATIONSHIP','hgs.self-awareness':'GOAL,SITUATION','hgs.resilience':'GOAL,SITUATION','hgs.purpose-alignment':'GOAL','hgs.habit-strength':'GOAL,SITUATION'};
 for(const[key,contexts]of Object.entries(expected)){const sibling=siblings.find(row=>row.metric_key===key);if(!sibling||sibling.valid_context_kinds.join()!==contexts)throw new Error(`Sibling ${key} context list changed`);}
 // --- Canonical structured routes remain available ---------------------------
 // Retirement orphaned nothing: every canonical v1 identity is still
 // CALIBRATED and still carries at least one ACTIVE canonical binding, which
 // is the entry point of its metric-owned structured route.
 const calibrated=(await client.query("SELECT metric_key FROM public.him_metric_definitions WHERE definition_version=1 AND calculation_status='CALIBRATED'")).rows.map(row=>row.metric_key);
 if(CANONICAL_V1.some(key=>!calibrated.includes(key)))throw new Error('A canonical v1 metric is no longer calibrated after the retirement');
 const routed=(await client.query("SELECT DISTINCT metric_key FROM public.him_canonical_model_bindings WHERE definition_version=1 AND status='ACTIVE'")).rows.map(row=>row.metric_key);
 if(CANONICAL_V1.some(key=>!routed.includes(key)))throw new Error('A canonical v1 metric lost its metric-owned structured measurement route');
 await client.query('ROLLBACK');
 // --- A real owned Energy measurement still works end to end -----------------
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionOne,one,sessionTwo,two]);
 await client.query('BEGIN');await identity(one);
 const created=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[sessionOne])).rows[0];
 if(created.metric_key!=='hse.energy'||created.context_kind!=='CONVERSATION_SESSION'||created.context_id!==sessionOne)throw new Error('The canonical Energy creation path failed after the retirement');
 const calculated=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[created.id])).rows[0];
 if(calculated.value_state!=='ASSESSED'||calculated.numeric_value!==4||!calculated.calculation_result_id||!calculated.measurement_event_id||!calculated.canonical_binding_id)throw new Error('The canonical Energy calculation chain is incomplete');
 const current=(await client.query('SELECT id,canonical_binding_id FROM public.him_current_structured_measurements WHERE measurement_observation_id=$1',[created.id])).rows;
 if(current.length!==1||current[0].id!==calculated.id||current[0].canonical_binding_id!==calculated.canonical_binding_id)throw new Error('QHIM-001 structured-current selection regressed for the canonical Energy chain');
 // Cross-user Energy session use still fails closed, and the retired generic
 // writer cannot be used to reach the same state.
 await rejects("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[sessionTwo]);
 await rejects('SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{...observation,id:randomUUID(),metricKey:'hse.energy',contextKind:'CONVERSATION_SESSION',contextId:sessionOne}]);
 // --- No SITUATION Energy production authority exists -------------------------
 // Probed only through the surfaces that already exist: the dedicated RPC
 // takes a conversation session and rejects a SITUATION target, the structured
 // observation contract refuses a SITUATION Energy row outright, and no
 // SITUATION Energy binding exists. No new SITUATION path is manufactured here
 // in order to be rejected.
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier situation')")).rows[0];
 await rejects("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[situationTarget.id]);
 await rejects("INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance,created_at) VALUES($1,$2,$3,'hse.energy',1,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'SITUATION',$4,'HIGH',now(),'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HSE_ENERGY_MEASUREMENT_V1',now())",[randomUUID(),one,created.measurement_event_id,situationTarget.id]);
 await client.query('RESET ROLE');
 const situationBinding=(await client.query("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='SITUATION'")).rows[0].n;
 if(situationBinding!==0)throw new Error('A SITUATION Energy binding exists');
 await client.query('ROLLBACK');
 // --- Existing history is unaffected ------------------------------------------
 if(await snapshotCount()!==beforeLegacy)throw new Error('The verifier changed the durable snapshot population');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Legacy Snapshot Authority & Energy Context Reconciliation v1 (QHIM-003): the Foundation-era generic direct snapshot writer keeps its identity, result type and fixed search_path but is a deterministic no-write tombstone that grants EXECUTE to no application role - PUBLIC, anon, authenticated and service_role are all denied - and fails closed with its retirement error while creating zero snapshot rows even from a privileged connection, with no replacement generic writer introduced; every canonical v1 metric remains CALIBRATED with an ACTIVE canonical binding so no metric was orphaned from its metric-owned structured route, proven end to end on the Energy path where creation, calculation, the full event/observation/binding/result/snapshot chain and QHIM-001 structured-current selection all still work and cross-user session use still fails closed; Energy production context is CONVERSATION_SESSION-only across the persisted v1 definition, the ACTIVE binding and the calibrated model with every other Energy attribute and all sixteen sibling context lists unchanged, and no SITUATION Energy authority exists through the dedicated RPC, the structured observation contract, or any binding; and migration 0051 contains no destructive or history-writing statement, leaving all existing measurement history intact.');
