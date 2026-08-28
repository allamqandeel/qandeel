// Real-PostgreSQL verifier for migration 0058 - HIM Cross-Context Foreground
// Aggregation v1 (QHIA-009). Proves, on actual returned rows and the INSTALLED
// function definition: the aggregate RPC exists with the exact narrow
// two-parameter signature; it is a read-only STABLE function that holds NO
// privilege of its own (not SECURITY DEFINER), pins a fixed safe search_path,
// is postgres-owned, uses no dynamic SQL, reconstructs no JWT, and grants
// EXECUTE to authenticated only (no PUBLIC, anon, or service_role); its
// installed definition WRAPS exactly the two already-proven foreground
// authorities (read_him_session_situation_stress_v1 and
// read_him_session_decision_attention_v1) while calling NEITHER the QHIA-006
// relevance authority nor the QHIA-004 current-intelligence authority, reading
// no protected HIM substrate, naming no metric, no context kind, and no
// caller-selected selector, and containing no auth.uid() reconstruction and no
// write; unauthenticated, anon, service_role, wrong-user, cross-user-session,
// unknown-session and inactive-session calls all fail closed atomically
// through the wrapped authorities; every successful read returns EXACTLY TWO
// rows in the frozen transport order 1/SITUATION_STRESS then
// 2/DECISION_ATTENTION with no duplicate, missing, or extra slot; each
// aggregate payload equals the corresponding DIRECT authority payload fact for
// fact across both-unbound, Situation-bound-only, Decision-bound-only,
// both-bound, KNOWN, UNKNOWN, bound-but-unmeasured, replacement, cleared
// (retired) and incompatible-ACTIVE-measurement-binding states; the aggregate
// activates no third slot and no new metric; repeated aggregate reads write
// nothing; migrations 0056 and 0057 remain installed and independently
// callable with unchanged behaviour; and every fixture rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionInactive=randomUUID(),sessionTwo=randomUUID();
const FN='public.read_him_session_cross_context_foreground_v1(uuid,uuid)';
const SITUATION_FN='public.read_him_session_situation_stress_v1(uuid,uuid)';
const DECISION_FN='public.read_him_session_decision_attention_v1(uuid,uuid)';
const READ_SQL='SELECT * FROM public.read_him_session_cross_context_foreground_v1($1,$2)';
const SITUATION_SQL='SELECT * FROM public.read_him_session_situation_stress_v1($1,$2)';
const DECISION_SQL='SELECT * FROM public.read_him_session_decision_attention_v1($1,$2)';
const SET_BINDING_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_BINDING_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
// The nested authority row shape, verbatim. Every one of these columns must be
// carried through the aggregate unchanged; an unbound answer must carry null
// in every one of them except binding_state.
const NESTED_COLUMNS=['binding_state','binding_context_id','slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id'];
const METRIC_COLUMNS=NESTED_COLUMNS.filter(column=>column!=='binding_state');
// The frozen transport envelope. Transport order only - never a priority.
const SLOTS=[[1,'SITUATION_STRESS'],[2,'DECISION_ATTENTION']];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[],label='')=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${label||sql}`);};
const rejectsWith=async(pattern,params,label)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(READ_SQL,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected ${label} rejection ${pattern}, got: ${message||'success'}`);};
// Value-shape-preserving comparison: timestamps, arrays, and numerics are
// compared as values rather than as coerced strings, so a silently reshaped
// payload cannot pass as parity.
const normalize=value=>{
 if(value===null||value===undefined)return 'null';
 if(value instanceof Date)return `date:${value.getTime()}`;
 if(Array.isArray(value))return `array:${JSON.stringify(value)}`;
 if(typeof value==='number')return `number:${value}`;
 return `${typeof value}:${String(value)}`;
};
// Every successful aggregate read must be exactly the frozen two-row envelope,
// in exactly the frozen transport order, with no duplicate, missing, unknown,
// or extra slot - checked on every single read this verifier performs.
const readEnvelope=async(userId,sessionId)=>{
 const rows=(await client.query(READ_SQL,[userId,sessionId])).rows;
 if(rows.length!==SLOTS.length)throw new Error(`The aggregate must always return exactly two rows, got ${rows.length}`);
 rows.forEach((row,index)=>{
  const[order,slot]=SLOTS[index];
  if(Number(row.foreground_slot_order)!==order)throw new Error(`Aggregate row ${index+1} must carry transport order ${order}, got ${row.foreground_slot_order}`);
  if(row.foreground_slot!==slot)throw new Error(`Aggregate row ${index+1} must carry slot ${slot}, got ${row.foreground_slot}`);
  for(const column of NESTED_COLUMNS)if(!(column in row))throw new Error(`Aggregate row ${index+1} must preserve the nested authority column ${column}`);
  if(Object.keys(row).length!==NESTED_COLUMNS.length+2)throw new Error(`Aggregate row ${index+1} must add exactly the two outer transport fields, got ${Object.keys(row).length} columns`);
 });
 if(new Set(rows.map(row=>row.foreground_slot)).size!==SLOTS.length)throw new Error('The aggregate envelope must carry no duplicate slot');
 return rows;
};
// The core QHIA-009 claim: an aggregate payload IS the direct authority
// payload. Nothing is recomputed, defaulted, coalesced, or reinterpreted on
// the way through, so this runs on every state the verifier constructs.
const assertParity=async(userId,sessionId,label)=>{
 const envelope=await readEnvelope(userId,sessionId);
 const situation=(await client.query(SITUATION_SQL,[userId,sessionId])).rows;
 const decision=(await client.query(DECISION_SQL,[userId,sessionId])).rows;
 if(situation.length!==1||decision.length!==1)throw new Error(`Fixture invariant: each direct authority must answer with exactly one row (${label})`);
 for(const[index,direct]of[[0,situation[0]],[1,decision[0]]]){
  for(const column of NESTED_COLUMNS){
   if(normalize(envelope[index][column])!==normalize(direct[column]))throw new Error(`Aggregate slot ${SLOTS[index][1]} must equal the direct authority payload verbatim (${label}): ${column} was ${envelope[index][column]}, the direct authority says ${direct[column]}`);
  }
  if(Object.keys(direct).length!==NESTED_COLUMNS.length)throw new Error(`Fixture invariant: the direct authority row shape changed (${label})`);
 }
 return envelope;
};
const measurementState=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results,(SELECT count(*)::int FROM public.him_measurement_targets) targets,(SELECT count(*)::int FROM public.him_session_context_bindings) bindings,(SELECT count(*)::int FROM public.him_session_context_bindings WHERE status=\'ACTIVE\') active_bindings,(SELECT count(*)::int FROM public.him_canonical_model_bindings WHERE status=\'ACTIVE\') active_model_bindings')).rows[0];
await client.connect();try{
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$5,'ACTIVE','TEXT'),($2,$5,'ACTIVE','TEXT'),($3,$5,'CLOSED','TEXT'),($4,$6,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionInactive,sessionTwo,one,two]);
 await client.query('BEGIN');
 // --- 1..8: installed-function facts ----------------------------------------
 if((await client.query('SELECT to_regprocedure($1) reg',[FN])).rows[0].reg===null)throw new Error('The cross-context aggregate must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_cross_context_foreground_v1'")).rows[0].n)!==1)throw new Error('Exactly one cross-context aggregate may exist: no overload may accept a context kind, context id, target, metric, or slot list');
 const props=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[FN])).rows[0];
 if(props.prosecdef)throw new Error('The aggregate must hold no privilege of its own: every privileged read belongs to the wrapped authorities');
 if(props.provolatile!=='s')throw new Error('The aggregate must be STABLE');
 if(props.pronargs!==2)throw new Error('The callable surface must accept exactly the authenticated user and the exact owned session');
 if(props.owner!=='postgres')throw new Error('The aggregate must be owned by postgres');
 if(!(props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The aggregate must pin a fixed safe search_path');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(props.definition))throw new Error('The aggregate must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(props.definition))throw new Error('The aggregate must not reconstruct or write request identity state');
 if(!props.definition.includes('public.read_him_session_situation_stress_v1('))throw new Error('The installed aggregate must wrap the QHIA-007 Situation-stress foreground authority');
 if(!props.definition.includes('public.read_him_session_decision_attention_v1('))throw new Error('The installed aggregate must wrap the QHIA-008 Decision-attention foreground authority');
 if(!props.definition.includes("'SITUATION_STRESS'")||!props.definition.includes("'DECISION_ATTENTION'"))throw new Error('The installed aggregate must label exactly the two frozen transport slots');
 if((props.definition.match(/UNION ALL/g)??[]).length!==1)throw new Error('The installed aggregate envelope must contain exactly the two frozen slots');
 // The lower authorities stay exactly where they already are: QHIA-009 wraps
 // proven foreground authorities and never becomes a third implementation of
 // relevance, of current intelligence, or of anything beneath them.
 for(const forbidden of['public.read_him_session_context_bindings_v1','public.read_him_contextual_current_intelligence_batch_v1','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','auth.uid'])if(props.definition.includes(forbidden))throw new Error(`The installed aggregate must wrap the two proven foreground authorities, never reimplement or widen: found ${forbidden}`);
 for(const forbidden of["'SITUATION'","'DECISION'","'GOAL'","'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'hse.','hbs.','hrs.','hgs.'])if(props.definition.includes(forbidden))throw new Error(`QHIA-009 activates no metric and no context kind: found ${forbidden}`);
 for(const forbidden of['p_context_kind','p_context_id','p_target','p_metric_key','p_metric_keys','p_definition_version','p_slot','p_foreground_slot'])if(props.definition.includes(forbidden))throw new Error(`The aggregate accepts no caller-selected context, target, metric, or slot: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(props.definition))throw new Error('The installed aggregate must be read-only');
 const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[FN])).rows[0];
 if(acl.pub||acl.anon||acl.service_role||!acl.authenticated)throw new Error('Cross-context aggregate EXECUTE authority must be authenticated-only');
 // The two wrapped authorities are untouched by this task and must still be
 // installed with their own exact signatures and their own narrow ACLs.
 for(const wrapped of[SITUATION_FN,DECISION_FN]){
  if((await client.query('SELECT to_regprocedure($1) reg',[wrapped])).rows[0].reg===null)throw new Error(`${wrapped} must remain installed and independently callable after QHIA-009`);
  const wrappedAcl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[wrapped])).rows[0];
  if(wrappedAcl.pub||wrappedAcl.anon||wrappedAcl.service_role||!wrappedAcl.authenticated)throw new Error(`${wrapped} must keep its authenticated-only EXECUTE authority`);
 }
 // --- 9: unauthenticated, anon, service_role --------------------------------
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(/Authentication required/,[one,sessionMain],'unauthenticated');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(READ_SQL,[one,sessionMain],'anon EXECUTE');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE service_role');
 await rejects(READ_SQL,[one,sessionMain],'service_role EXECUTE');
 await client.query('RESET ROLE');
 // --- Owned fixtures on the canonical substrates only ------------------------
 await identity(one);
 const situationA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-009 situation A')")).rows[0];
 const situationB=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-009 situation B')")).rows[0];
 const decisionA=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-009 decision A')")).rows[0];
 const decisionB=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-009 decision B')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-009 goal')")).rows[0];
 // HIGH (ordinal 4) and LOW (ordinal 2) are deliberately the values QHIA-007
 // and QHIA-008 act on, so the delegated values proven here are the dangerous
 // ones, not neutral ones.
 const stressObservation=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'HIGH',NULL)",[situationA.id])).rows[0];
 const stressSnapshot=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[stressObservation.id])).rows[0];
 const attentionObservation=(await client.query("SELECT * FROM public.create_hse_attention_measurement('DECISION',$1,'LOW',NULL)",[decisionA.id])).rows[0];
 const attentionSnapshot=(await client.query('SELECT * FROM public.calculate_hse_attention_measurement($1)',[attentionObservation.id])).rows[0];
 if(Number(stressSnapshot?.numeric_value)!==4||Number(attentionSnapshot?.numeric_value)!==2)throw new Error('Fixture invariant: the canonical Situation stress and Decision attention rows must exist with their acted-on ordinals');
 // --- 10/11: exact authenticated user/session isolation, atomically ----------
 // A cross-user or non-owned call fails as the wrapped authority's own error;
 // the aggregate adds no fallback, no partial envelope, and no fake row.
 await rejectsWith(/owner-exact/,[two,sessionMain],'wrong p_user_id');
 await rejectsWith(/Unknown or cross-user conversation session/,[one,sessionTwo],'cross-user session');
 await rejectsWith(/Unknown or cross-user conversation session/,[one,randomUUID()],'unknown session');
 await rejectsWith(/Conversation session is not active/,[one,sessionInactive],'inactive session');
 // --- 12: both channels unbound => deterministic two-row no-effect envelope ---
 const unbound=await assertParity(one,sessionMain,'both unbound');
 if(unbound[0].binding_state!=='NO_ACTIVE_SITUATION'||unbound[1].binding_state!=='NO_ACTIVE_DECISION')throw new Error('A session with no ACTIVE relevance binding must report both deterministic unbound states');
 for(const[index,row]of unbound.entries())for(const column of METRIC_COLUMNS)if(row[column]!==null)throw new Error(`The unbound ${SLOTS[index][1]} slot must carry null ${column}, got ${row[column]}`);
 // A GOAL binding activates no third slot and changes neither channel.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTarget.id]);
 const withGoal=await assertParity(one,sessionMain,'GOAL bound only');
 if(withGoal[0].binding_state!=='NO_ACTIVE_SITUATION'||withGoal[1].binding_state!=='NO_ACTIVE_DECISION')throw new Error('A GOAL binding must not bind, widen, or activate either aggregate slot');
 // --- 13: Situation bound only ----------------------------------------------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationA.id]);
 const situationOnly=await assertParity(one,sessionMain,'Situation bound only');
 if(situationOnly[0].binding_state!=='ACTIVE_SITUATION_BOUND'||situationOnly[0].binding_context_id!==situationA.id)throw new Error('The Situation slot must answer for the exact authoritatively bound Situation');
 if(situationOnly[0].metric_key!=='hse.stress'||situationOnly[0].definition_version!==1||Number(situationOnly[0].numeric_value)!==4)throw new Error('The Situation slot must carry exactly the delegated hse.stress@1 KNOWN value');
 if(situationOnly[1].binding_state!=='NO_ACTIVE_DECISION')throw new Error('One bound channel must never bind the other: the Decision slot stays unbound');
 for(const column of METRIC_COLUMNS)if(situationOnly[1][column]!==null)throw new Error(`The still-unbound Decision slot must carry null ${column}`);
 // --- 14: Decision bound only -----------------------------------------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionA.id]);
 const decisionOnly=await assertParity(one,sessionMain,'Decision bound only');
 if(decisionOnly[0].binding_state!=='NO_ACTIVE_SITUATION')throw new Error('A cleared Situation binding must leave the Situation slot unbound');
 for(const column of METRIC_COLUMNS)if(decisionOnly[0][column]!==null)throw new Error(`The cleared Situation slot must carry null ${column}`);
 if(decisionOnly[1].binding_state!=='ACTIVE_DECISION_BOUND'||decisionOnly[1].binding_context_id!==decisionA.id)throw new Error('The Decision slot must answer for the exact authoritatively bound Decision');
 if(decisionOnly[1].metric_key!=='hse.attention'||decisionOnly[1].definition_version!==1||Number(decisionOnly[1].numeric_value)!==2)throw new Error('The Decision slot must carry exactly the delegated hse.attention@1 KNOWN value');
 // --- 15: both bound, both KNOWN, in ONE aggregate read ----------------------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationA.id]);
 const bothBound=await assertParity(one,sessionMain,'both bound and KNOWN');
 if(bothBound[0].binding_context_id!==situationA.id||bothBound[1].binding_context_id!==decisionA.id)throw new Error('Each aggregate slot must answer for its own exact bound context');
 if(Number(bothBound[0].numeric_value)!==4||Number(bothBound[1].numeric_value)!==2)throw new Error('Both channels must carry their own delegated KNOWN values, never a combined or shared one');
 if(bothBound[0].semantic_mapping_status!=='RESOLVED'||bothBound[0].semantic_type!=='STATE'||bothBound[0].hif_owner!=='HSE')throw new Error('The Situation slot must keep the delegated HSE / RESOLVED / STATE reading');
 if(bothBound[1].semantic_mapping_status!=='RESOLVED'||bothBound[1].semantic_type!=='STATE'||bothBound[1].hif_owner!=='HSE')throw new Error('The Decision slot must keep the delegated HSE / RESOLVED / STATE reading');
 if(bothBound[0].context_kind!=='SITUATION'||bothBound[1].context_kind!=='DECISION')throw new Error('Each aggregate slot must preserve its own delegated context kind');
 // The two channels are never merged, ranked, or reduced to a composite: the
 // envelope is exactly two independent payloads under a transport order.
 if(bothBound[0].metric_key===bothBound[1].metric_key)throw new Error('The aggregate must not collapse the two channels into one metric');
 if(Number(bothBound[0].numeric_value)===Number(bothBound[1].numeric_value))throw new Error('Fixture invariant: the two channels must carry DIFFERENT values so a leak between them would be detectable');
 // --- 16: bound-but-unmeasured => UNKNOWN, and replacement follows QHIA-006 ---
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationB.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionB.id]);
 const replaced=await assertParity(one,sessionMain,'both replaced and unmeasured');
 if(replaced[0].binding_context_id!==situationB.id||replaced[1].binding_context_id!==decisionB.id)throw new Error('Each aggregate slot must follow its own current ACTIVE binding after replacement');
 if(replaced[0].has_canonical_current_value!==false||replaced[1].has_canonical_current_value!==false)throw new Error('An unmeasured bound context must stay BOUND with has_canonical_current_value=false in both slots');
 for(const row of replaced)for(const column of['source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id'])if(row[column]!==null)throw new Error(`A bound-but-unmeasured context must carry null ${column}: bound and known are separate facts`);
 if(replaced[0].metric_key!=='hse.stress'||replaced[1].metric_key!=='hse.attention')throw new Error('The requested definition metadata must remain present on an unmeasured bound context');
 // --- 17: cleared (retired) bindings are never consumed ----------------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'DECISION']);
 const cleared=await assertParity(one,sessionMain,'both cleared');
 if(cleared[0].binding_state!=='NO_ACTIVE_SITUATION'||cleared[1].binding_state!=='NO_ACTIVE_DECISION')throw new Error('Cleared (retired) bindings must never be consumed by the aggregate');
 for(const[index,row]of cleared.entries())for(const column of METRIC_COLUMNS)if(row[column]!==null)throw new Error(`The cleared ${SLOTS[index][1]} slot must carry null ${column}`);
 // Re-binding the measured contexts restores the authoritative answer, so the
 // clear proved retirement rather than a broken aggregate.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationA.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionA.id]);
 const rebound=await assertParity(one,sessionMain,'both re-bound');
 if(Number(rebound[0].numeric_value)!==4||Number(rebound[1].numeric_value)!==2)throw new Error('Re-binding the measured contexts must restore both authoritative answers');
 // --- 18: incompatible ACTIVE measurement binding stays delegated ------------
 // A protected migration-0050 binding transition retires the ACTIVE
 // hse.stress@1/SITUATION canonical binding in favour of a compatible
 // successor. The already-calculated snapshot keeps its historical binding, so
 // the delegated row now reports canonical_binding_id <> active_binding_id -
 // the authoritative "incompatible ACTIVE binding" state. QHIA-009 must carry
 // that state through verbatim and must not repair, hide, or reinterpret it.
 await client.query('RESET ROLE');
 const stressModel='58000000-0000-4000-8000-000000000002',stressApproval='58000000-0000-4000-8000-000000000003',stressBindingV2='58000000-0000-4000-8000-000000000004';
 await client.query("INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES($1,'hse.stress.direct-structured-self-report',2,'hse.stress',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_SELF_REPORT','hse.stress.ordinal-5.v1','{\"required\":[\"measurementObservation\",\"authorizedContext\"]}'::jsonb,'FIRST_CLASS_AUTHORIZED_CONTEXT_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['SITUATION','CONVERSATION_SESSION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hse-stress-direct-structured-v1-qhia009',now(),now())",[stressModel]);
 await client.query("INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES($1,'verifier.qhia009.stress.transition.v2',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.stress.direct-structured-self-report',2,'[\"HSE_STRESS_STATE\",\"SUBJECTIVE_PSYCHOLOGICAL_PRESSURE\",\"DIRECT_REPORT\",\"RIGHT_NOW\",\"SITUATION_SESSION_ONLY\",\"FOUNDER_TESTED_AR_EG_ORDINAL_5\",\"DETERMINISTIC\",\"CORRECTION_IDEMPOTENCY_CONCURRENCY\",\"SECURITY_BINDING\",\"NO_CLINICAL_OR_EXTERNAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')",[stressApproval]);
 const nextStressBindingVersion=(await client.query("SELECT max(binding_version)::int+1 v FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND definition_version=1 AND context_kind='SITUATION'")).rows[0].v;
 await client.query("INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hse.stress',1,'SITUATION',$2,'PENDING','hse.stress.direct-structured-self-report',2,'hse.stress.direct-self-report',1,'hse.stress.ordinal-5.v1',1,'verifier.qhia009.stress.transition.v2',1,now())",[stressBindingV2,nextStressBindingVersion]);
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[stressBindingV2]);
 await identity(one);
 const transitioned=await assertParity(one,sessionMain,'incompatible ACTIVE measurement binding');
 if(transitioned[0].active_binding_id!==stressBindingV2)throw new Error('The Situation slot must follow the transitioned ACTIVE measurement binding');
 if(transitioned[0].canonical_binding_id===null||transitioned[0].canonical_binding_id===transitioned[0].active_binding_id)throw new Error('Fixture invariant: the Situation slot must now report an incompatible ACTIVE measurement binding');
 if(transitioned[0].has_canonical_current_value!==true||Number(transitioned[0].numeric_value)!==4)throw new Error('The incompatible-binding state must stay an authoritative source fact, never a repaired or hidden one');
 // The Decision channel is untouched by the Situation channel's transition:
 // one shared transport never means one shared measurement authority.
 if(transitioned[1].canonical_binding_id!==transitioned[1].active_binding_id||Number(transitioned[1].numeric_value)!==2)throw new Error('A transition on one channel must never disturb the other channel');
 // --- 19: another user's contexts can never leak in either direction ---------
 await client.query('RESET ROLE');await identity(two);
 const otherSituation=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-009 other-user situation')")).rows[0];
 const otherDecision=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-009 other-user decision')")).rows[0];
 const otherObservation=(await client.query("SELECT * FROM public.create_hse_attention_measurement('DECISION',$1,'VERY_HIGH',NULL)",[otherDecision.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_attention_measurement($1)',[otherObservation.id]);
 await client.query(SET_BINDING_SQL,[two,sessionTwo,'SITUATION',otherSituation.id]);
 await client.query(SET_BINDING_SQL,[two,sessionTwo,'DECISION',otherDecision.id]);
 const otherEnvelope=await assertParity(two,sessionTwo,'other user own session');
 if(otherEnvelope[0].binding_context_id!==otherSituation.id||otherEnvelope[1].binding_context_id!==otherDecision.id)throw new Error('The other user must see exactly their own bound contexts');
 await rejectsWith(/Unknown or cross-user conversation session/,[two,sessionMain],'other user reading the first user session');
 await rejectsWith(/owner-exact/,[one,sessionTwo],'other user impersonating the first user');
 await client.query('RESET ROLE');await identity(one);
 const stillOwn=await assertParity(one,sessionMain,'own session after cross-user probes');
 if(stillOwn[0].binding_context_id!==situationA.id||stillOwn[1].binding_context_id!==decisionA.id)throw new Error("One user's aggregate must never reflect another user's contexts");
 if(Number(stillOwn[1].numeric_value)!==2)throw new Error("One user's value must never reflect another user's measurement");
 await rejects(SET_BINDING_SQL,[one,sessionMain,'DECISION',otherDecision.id],"binding another user's Decision");
 // A session bound to neither kind still answers with the full two-row
 // envelope: absence is a complete answer, never a shorter one.
 const emptyEnvelope=await assertParity(one,sessionEmpty,'unbound session');
 if(emptyEnvelope[0].binding_state!=='NO_ACTIVE_SITUATION'||emptyEnvelope[1].binding_state!=='NO_ACTIVE_DECISION')throw new Error('An unbound session must still report both deterministic unbound states');
 // --- 20: the read is non-mutating and deterministic -------------------------
 await client.query('RESET ROLE');
 const before=await measurementState();
 await identity(one);
 await readEnvelope(one,sessionMain);
 await readEnvelope(one,sessionEmpty);
 await client.query('RESET ROLE');await identity(two);
 await readEnvelope(two,sessionTwo);
 await client.query('RESET ROLE');
 const after=await measurementState();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Cross-context aggregate reads must write no measurement, relevance, or model-binding state');
 await identity(one);
 const repeat=await readEnvelope(one,sessionMain);
 for(const[index,row]of repeat.entries())for(const column of['foreground_slot_order','foreground_slot',...NESTED_COLUMNS])if(normalize(row[column])!==normalize(stillOwn[index][column]))throw new Error(`Aggregate reads must be deterministic across repeated calls: ${SLOTS[index][1]}.${column}`);
 // --- 21: the wrapped authorities remain independently callable --------------
 // Called DIRECTLY, outside the aggregate, both migration-0056 and
 // migration-0057 authorities still answer exactly one row each with unchanged
 // behaviour: QHIA-009 added a transport, it retired no authority.
 const directSituation=(await client.query(SITUATION_SQL,[one,sessionMain])).rows;
 const directDecision=(await client.query(DECISION_SQL,[one,sessionMain])).rows;
 if(directSituation.length!==1||directDecision.length!==1)throw new Error('Both wrapped authorities must remain independently callable with their exact one-row contract');
 if(directSituation[0].binding_state!=='ACTIVE_SITUATION_BOUND'||directDecision[0].binding_state!=='ACTIVE_DECISION_BOUND')throw new Error('Both wrapped authorities must keep their exact unchanged behaviour');
 if('foreground_slot'in directSituation[0]||'foreground_slot'in directDecision[0])throw new Error('The aggregate transport discriminator must never leak into the direct authority contracts');
 await client.query('RESET ROLE');
 await client.query('ROLLBACK');
 // --- 22: complete fixture rollback ------------------------------------------
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_observations WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])) total',[[one,two]])).rows[0].total);
 if(residue!==0)throw new Error('Cross-context aggregate verifier fixtures must roll back completely');
 const modelResidue=Number((await client.query("SELECT (SELECT count(*) FROM public.him_calculation_models WHERE id::text LIKE '58000000-%')+(SELECT count(*) FROM public.him_governance_approvals WHERE id::text LIKE '58000000-%')+(SELECT count(*) FROM public.him_canonical_model_bindings WHERE id::text LIKE '58000000-%') total")).rows[0].total);
 if(modelResidue!==0)throw new Error('The binding-transition fixtures must roll back completely');
 if((await client.query("SELECT status FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND definition_version=1 AND context_kind='SITUATION' AND binding_version=1")).rows[0].status!=='ACTIVE')throw new Error('The canonical Situation stress binding must remain ACTIVE after fixture rollback');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Cross-Context Foreground Aggregation v1 (QHIA-009): the aggregate RPC exists with the exact intended two-parameter signature as a read-only STABLE function that holds no privilege of its own (not SECURITY DEFINER), is postgres-owned, pins a fixed safe search_path, contains no dynamic SQL, reconstructs no JWT, and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role); its INSTALLED definition wraps exactly the two already-proven foreground authorities read_him_session_situation_stress_v1 and read_him_session_decision_attention_v1 in exactly one composition, while calling neither the QHIA-006 relevance authority nor the QHIA-004 current-intelligence authority, reading no protected HIM substrate, naming no metric, no context kind, and no caller-selected context/target/metric/slot selector, containing no auth.uid() reconstruction, and writing nothing; unauthenticated, anon, service_role, wrong-user, cross-user, unknown-session and inactive-session calls fail closed atomically through the wrapped authorities with no partial envelope and no fabricated row; every successful read returns exactly two rows in the frozen transport order 1/SITUATION_STRESS then 2/DECISION_ATTENTION with no duplicate, missing, unknown, or extra slot and exactly the two outer transport fields added to the verbatim nested authority shape; each aggregate payload equals the corresponding DIRECT authority payload fact for fact - both unbound, GOAL-bound-only, Situation-bound-only, Decision-bound-only, both bound and KNOWN with independent per-channel values, bound-but-unmeasured after replacement, cleared/retired, re-bound, and under a protected migration-0050 ACTIVE measurement-binding transition where the incompatible-binding state is carried through verbatim on one channel without disturbing the other; another user\'s contexts, sessions, and measurements can never leak in either direction; repeated reads are deterministic and write no measurement, relevance, or model-binding state; migrations 0056 and 0057 remain installed, authenticated-only, and independently callable with unchanged behaviour and no transport discriminator leaked into them; and every fixture, including the binding transition, rolls back completely.');
