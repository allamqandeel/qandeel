// Real-PostgreSQL verifier for migration 0056 - HIM Situation Stress
// Foreground Consumption v1 (QHIA-007). Proves, on actual returned rows and
// the INSTALLED function definition: the composition RPC exists with the exact
// narrow two-parameter signature; it is a read-only STABLE function that holds
// NO privilege of its own (not SECURITY DEFINER), pins a fixed safe
// search_path, is postgres-owned, uses no dynamic SQL, reconstructs no JWT,
// and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role);
// its installed definition DELEGATES relevance to the QHIA-006 authority
// (read_him_session_context_bindings_v1) and current intelligence to the
// QHIA-004 authority (read_him_contextual_current_intelligence_batch_v1) while
// referencing no binding/ownership/definition/measurement substrate, no
// canonical-latest or ACTIVE-binding resolver, no auth.uid(), and no context
// kind or metric other than SITUATION and hse.stress; unauthenticated, anon,
// service_role, wrong-user, cross-user-session, and inactive-session calls all
// fail closed through the composed authorities; a session with no ACTIVE
// SITUATION binding returns exactly one deterministic NO_ACTIVE_SITUATION row
// with every metric column null; a bound Situation returns exactly one
// ACTIVE_SITUATION_BOUND row whose identity, value, temporal, canonical- and
// ACTIVE-binding facts equal BOTH the direct QHIA-004 batch row and the direct
// canonical-latest authority; only the SITUATION kind is consumed (a GOAL,
// DECISION, or RELATIONSHIP binding changes nothing); replacement follows the
// current ACTIVE binding; a retired binding is never consumed; another user's
// Situation can never leak; the read writes nothing; and every fixture rolls
// back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionInactive=randomUUID(),sessionTwo=randomUUID();
const FN='public.read_him_session_situation_stress_v1(uuid,uuid)';
const READ_SQL='SELECT * FROM public.read_him_session_situation_stress_v1($1,$2)';
const SET_BINDING_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_BINDING_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
const BATCH_SQL='SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
// Every metric column of the composition result. An unbound answer must carry
// null in every one of them: "no ACTIVE Situation" is a complete answer, never
// a partially populated one.
const METRIC_COLUMNS=['binding_context_id','slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id'];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[],label='')=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${label||sql}`);};
const rejectsWith=async(pattern,params,label)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(READ_SQL,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected ${label} rejection ${pattern}, got: ${message||'success'}`);};
const readOne=async(userId,sessionId)=>{const rows=(await client.query(READ_SQL,[userId,sessionId])).rows;if(rows.length!==1)throw new Error(`The composition must always return exactly one row, got ${rows.length}`);return rows[0];};
const time=value=>value===null||value===undefined?null:value.getTime();
const measurementState=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results,(SELECT count(*)::int FROM public.him_measurement_targets) targets,(SELECT count(*)::int FROM public.him_session_context_bindings) bindings,(SELECT count(*)::int FROM public.him_session_context_bindings WHERE status=\'ACTIVE\') active_bindings')).rows[0];
await client.connect();try{
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$5,'ACTIVE','TEXT'),($2,$5,'ACTIVE','TEXT'),($3,$5,'CLOSED','TEXT'),($4,$6,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionInactive,sessionTwo,one,two]);
 await client.query('BEGIN');
 // --- 1..8: installed-function facts ----------------------------------------
 if((await client.query('SELECT to_regprocedure($1) reg',[FN])).rows[0].reg===null)throw new Error('The Situation-stress composition must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_situation_stress_v1'")).rows[0].n)!==1)throw new Error('Exactly one Situation-stress authority may exist: no overload may accept a context kind, context id, metric, or target');
 const props=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[FN])).rows[0];
 if(props.prosecdef)throw new Error('The composition must hold no privilege of its own: every privileged read belongs to the composed authorities');
 if(props.provolatile!=='s')throw new Error('The composition must be STABLE');
 if(props.pronargs!==2)throw new Error('The callable surface must accept exactly the authenticated user and the exact owned session');
 if(props.owner!=='postgres')throw new Error('The composition must be owned by postgres');
 if(!(props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The composition must pin a fixed safe search_path');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(props.definition))throw new Error('The composition must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(props.definition))throw new Error('The composition must not reconstruct or write request identity state');
 if(!props.definition.includes('public.read_him_session_context_bindings_v1('))throw new Error('The installed composition must resolve relevance through the QHIA-006 authority');
 if(!props.definition.includes('public.read_him_contextual_current_intelligence_batch_v1('))throw new Error('The installed composition must resolve current intelligence through the QHIA-004 authority');
 if(!props.definition.includes("'SITUATION'")||!props.definition.includes("'hse.stress'"))throw new Error('The installed composition must pin exactly SITUATION and hse.stress');
 for(const forbidden of['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','auth.uid'])if(props.definition.includes(forbidden))throw new Error(`The installed composition must compose, never reimplement or widen: found ${forbidden}`);
 for(const forbidden of["'GOAL'","'DECISION'","'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'hse.energy','hse.attention','hse.motivation','hse.self-confidence','hbs.','hrs.','hgs.'])if(props.definition.includes(forbidden))throw new Error(`QHIA-007 activates exactly SITUATION + hse.stress@1: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(props.definition))throw new Error('The installed composition must be read-only');
 const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[FN])).rows[0];
 if(acl.pub||acl.anon||acl.service_role||!acl.authenticated)throw new Error('Situation-stress EXECUTE authority must be authenticated-only');
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
 const situationA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-007 situation A')")).rows[0];
 const situationB=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-007 situation B')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-007 goal')")).rows[0];
 const observation=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'HIGH',NULL)",[situationA.id])).rows[0];
 const snapshot=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[observation.id])).rows[0];
 if(!snapshot?.id)throw new Error('Fixture invariant: the canonical Situation stress row must exist');
 // --- 10/11: exact authenticated user/session isolation ----------------------
 await rejectsWith(/owner-exact/,[two,sessionMain],'wrong p_user_id');
 await rejectsWith(/Unknown or cross-user conversation session/,[one,sessionTwo],'cross-user session');
 await rejectsWith(/Unknown or cross-user conversation session/,[one,randomUUID()],'unknown session');
 await rejectsWith(/Conversation session is not active/,[one,sessionInactive],'inactive session');
 // --- 12: no ACTIVE Situation binding => deterministic no-effect result -------
 const unbound=await readOne(one,sessionMain);
 if(unbound.binding_state!=='NO_ACTIVE_SITUATION')throw new Error('A session with no ACTIVE Situation binding must report NO_ACTIVE_SITUATION');
 for(const column of METRIC_COLUMNS)if(unbound[column]!==null)throw new Error(`The unbound result must carry null ${column}, got ${unbound[column]}`);
 // A measured Situation the user OWNS but has NOT bound stays invisible: the
 // measurement exists, and absent relevance still means absent.
 if(Number((await client.query(BATCH_SQL,[one,'SITUATION',situationA.id,['hse.stress'],[1]])).rows[0].numeric_value)!==Number(snapshot.numeric_value))throw new Error('Fixture invariant: the owned Situation is measurable through the QHIA-004 authority');
 // --- 13/14: an ACTIVE SITUATION binding is consumed, exactly and only -------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationA.id]);
 const bound=await readOne(one,sessionMain);
 if(bound.binding_state!=='ACTIVE_SITUATION_BOUND')throw new Error('An ACTIVE Situation binding must report ACTIVE_SITUATION_BOUND');
 if(bound.binding_context_id!==situationA.id)throw new Error('The composition must answer for the exact authoritatively bound Situation');
 if(bound.slot_order!==1||bound.metric_key!=='hse.stress'||bound.definition_version!==1)throw new Error('Exactly one slot answering for exactly hse.stress@1 must be returned');
 if(bound.context_kind!=='SITUATION'||bound.context_id!==situationA.id)throw new Error('The delegated read must have used exactly the bound Situation identity');
 if(bound.has_canonical_current_value!==true)throw new Error('The measured bound Situation must carry its canonical current value');
 if(!(Number.isInteger(Number(bound.numeric_value))&&Number(bound.numeric_value)>=1&&Number(bound.numeric_value)<=5))throw new Error('The canonical current value must be a structured 1-5 ordinal');
 // --- 15: QHIA-004 delegation parity, fact for fact --------------------------
 const batch=(await client.query(BATCH_SQL,[one,'SITUATION',situationA.id,['hse.stress'],[1]])).rows[0];
 for(const column of ['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','validity_status','confidence_state','confidence_reference','canonical_binding_id','active_binding_id']){
  if(String(bound[column])!==String(batch[column]))throw new Error(`The composition must return the QHIA-004 fact verbatim: ${column} was ${bound[column]}, the batch authority says ${batch[column]}`);
 }
 if(Number(bound.numeric_value)!==Number(batch.numeric_value))throw new Error('The composition must return the delegated numeric value verbatim');
 if(JSON.stringify(bound.valid_context_kinds)!==JSON.stringify(batch.valid_context_kinds))throw new Error('The composition must return the delegated definition context eligibility verbatim');
 for(const column of ['observed_at','temporal_window_start','temporal_window_end'])if(time(bound[column])!==time(batch[column]))throw new Error(`The composition must return the delegated temporal fact verbatim: ${column}`);
 // --- 16: canonical-latest authority stays the value authority ---------------
 const latest=(await client.query(LATEST_SQL,[one,'hse.stress',1,'SITUATION',situationA.id])).rows[0];
 if(!latest||latest.id!==snapshot.id)throw new Error('Fixture invariant: the direct canonical latest row must be the calculated Situation stress row');
 if(bound.source_metric_key!==latest.metric_key||bound.source_definition_version!==latest.definition_version||bound.source_context_kind!==latest.context_kind||bound.source_context_id!==latest.context_id)throw new Error('Composition source identity must equal the direct canonical latest identity');
 if(bound.value_state!==latest.value_state||Number(bound.numeric_value)!==Number(latest.numeric_value)||bound.validity_status!==latest.validity_status)throw new Error('Composition value facts must equal the direct canonical latest value facts');
 if(bound.canonical_binding_id!==latest.canonical_binding_id)throw new Error('Composition source binding identity must equal the direct canonical latest binding identity');
 // --- 17: ACTIVE measurement-binding compatibility stays delegated -----------
 const resolver=(await client.query("SELECT public.him_active_structured_binding_id('hse.stress',1,'SITUATION') id")).rows[0].id;
 if(resolver===null||bound.active_binding_id!==resolver)throw new Error('The composition ACTIVE binding identity must equal the existing migration-0050 resolver');
 // --- 18: only the SITUATION kind is consumed --------------------------------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTarget.id]);
 const withGoal=await readOne(one,sessionMain);
 if(withGoal.binding_state!=='ACTIVE_SITUATION_BOUND'||withGoal.binding_context_id!==situationA.id||withGoal.metric_key!=='hse.stress')throw new Error('A GOAL binding must not change, widen, or replace the Situation-only answer');
 // A session bound ONLY to a GOAL still reports no ACTIVE Situation.
 await client.query(SET_BINDING_SQL,[one,sessionEmpty,'GOAL',goalTarget.id]);
 const goalOnly=await readOne(one,sessionEmpty);
 if(goalOnly.binding_state!=='NO_ACTIVE_SITUATION')throw new Error('A GOAL-only session must report NO_ACTIVE_SITUATION: no other kind is consumed');
 for(const column of METRIC_COLUMNS)if(goalOnly[column]!==null)throw new Error(`The GOAL-only result must carry null ${column}`);
 // --- 19: replacement follows the CURRENT ACTIVE binding through QHIA-006 ----
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationB.id]);
 const replaced=await readOne(one,sessionMain);
 if(replaced.binding_state!=='ACTIVE_SITUATION_BOUND'||replaced.binding_context_id!==situationB.id)throw new Error('The composition must follow the current ACTIVE Situation binding after replacement');
 if(replaced.context_id!==situationB.id)throw new Error('The delegated read must follow the replacement target');
 if(replaced.has_canonical_current_value!==false)throw new Error('An unmeasured bound Situation must report has_canonical_current_value=false');
 for(const column of ['source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id'])if(replaced[column]!==null)throw new Error(`A bound-but-unmeasured Situation must carry null ${column}: bound and known are separate facts`);
 if(replaced.metric_key!=='hse.stress'||replaced.definition_version!==1||replaced.hif_owner===null)throw new Error('The requested definition metadata must remain present on an unmeasured bound Situation');
 // The retired version-1 binding is history, never a second candidate.
 const retiredCount=Number((await client.query("SELECT count(*)::int n FROM public.him_session_context_bindings WHERE conversation_session_id=$1 AND context_kind='SITUATION' AND status='RETIRED'",[sessionMain])).rows[0].n);
 if(retiredCount!==1)throw new Error('Fixture invariant: replacement must have retired exactly one prior Situation binding');
 // --- 20: a retired binding can never be consumed ----------------------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 const cleared=await readOne(one,sessionMain);
 if(cleared.binding_state!=='NO_ACTIVE_SITUATION')throw new Error('A cleared (retired) Situation binding must never be consumed');
 for(const column of METRIC_COLUMNS)if(cleared[column]!==null)throw new Error(`The cleared result must carry null ${column}`);
 // Re-binding the measured Situation restores the authoritative answer, so the
 // clear proved retirement rather than a broken read.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationA.id]);
 const rebound=await readOne(one,sessionMain);
 if(rebound.binding_state!=='ACTIVE_SITUATION_BOUND'||rebound.binding_context_id!==situationA.id||Number(rebound.numeric_value)!==Number(snapshot.numeric_value))throw new Error('Re-binding the measured Situation must restore the authoritative answer');
 // --- 21: another user's Situation can never leak ----------------------------
 await client.query('RESET ROLE');await identity(two);
 const otherSituation=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-007 other-user situation')")).rows[0];
 const otherObservation=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'VERY_HIGH',NULL)",[otherSituation.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[otherObservation.id]);
 await client.query(SET_BINDING_SQL,[two,sessionTwo,'SITUATION',otherSituation.id]);
 const otherBound=await readOne(two,sessionTwo);
 if(otherBound.binding_context_id!==otherSituation.id)throw new Error('The other user must see exactly their own bound Situation');
 await rejectsWith(/Unknown or cross-user conversation session/,[two,sessionMain],'other user reading the first user session');
 await rejectsWith(/owner-exact/,[one,sessionTwo],'other user impersonating the first user');
 await client.query('RESET ROLE');await identity(one);
 const stillOwn=await readOne(one,sessionMain);
 if(stillOwn.binding_context_id!==situationA.id||stillOwn.binding_context_id===otherSituation.id)throw new Error('One user\'s answer must never reflect another user\'s Situation');
 if(Number(stillOwn.numeric_value)!==Number(snapshot.numeric_value))throw new Error('One user\'s value must never reflect another user\'s measurement');
 // Cross-user binding is impossible at the QHIA-006 authority itself.
 await rejects(SET_BINDING_SQL,[one,sessionMain,'SITUATION',otherSituation.id],'binding another user\'s Situation');
 // --- 22: the read is non-mutating -------------------------------------------
 await client.query('RESET ROLE');
 const before=await measurementState();
 await identity(one);
 await readOne(one,sessionMain);
 await readOne(one,sessionEmpty);
 await client.query('RESET ROLE');await identity(two);
 await readOne(two,sessionTwo);
 await client.query('RESET ROLE');
 const after=await measurementState();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Situation-stress reads must write no measurement or binding state');
 // Deterministic repeat read.
 await identity(one);
 const repeat=await readOne(one,sessionMain);
 for(const column of ['binding_state','binding_context_id','metric_key','has_canonical_current_value','canonical_binding_id','active_binding_id'])if(String(repeat[column])!==String(stillOwn[column]))throw new Error(`Situation-stress reads must be deterministic across repeated calls: ${column}`);
 await client.query('RESET ROLE');
 await client.query('ROLLBACK');
 // --- 23: complete fixture rollback ------------------------------------------
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_observations WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])) total',[[one,two]])).rows[0].total);
 if(residue!==0)throw new Error('Situation-stress verifier fixtures must roll back completely');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Situation Stress Foreground Consumption v1 (QHIA-007): the composition RPC exists with the exact intended two-parameter signature as a read-only STABLE function that holds no privilege of its own (not SECURITY DEFINER), is postgres-owned, pins a fixed safe search_path, contains no dynamic SQL, reconstructs no JWT, and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role); its INSTALLED definition delegates relevance to read_him_session_context_bindings_v1 and current intelligence to read_him_contextual_current_intelligence_batch_v1 while referencing no binding, ownership, definition, or measurement substrate, no canonical-latest or ACTIVE-binding resolver, no auth.uid(), and no context kind or metric other than SITUATION and hse.stress; unauthenticated, anon, service_role, wrong-user, cross-user, unknown-session and inactive-session calls fail closed through the composed authorities; a session with no ACTIVE SITUATION binding returns exactly one deterministic NO_ACTIVE_SITUATION row with every metric column null even while an owned measured Situation exists; an ACTIVE binding returns exactly one ACTIVE_SITUATION_BOUND row whose identity, definition metadata, value, temporal, canonical-binding and ACTIVE-binding facts equal both the direct QHIA-004 batch authority and the direct canonical-latest authority, with the ACTIVE binding identity equal to the existing migration-0050 resolver; a GOAL binding neither widens nor replaces the Situation-only answer and a GOAL-only session still reports NO_ACTIVE_SITUATION; replacement follows the current ACTIVE binding and a bound-but-unmeasured Situation stays BOUND with has_canonical_current_value=false and every source field null; a retired binding is never consumed and re-binding restores the authoritative answer; another user\'s Situation, session, and measurement can never leak in either direction; repeated reads are deterministic and write no measurement or binding state; and every fixture rolls back completely.');
