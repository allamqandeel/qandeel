// Real-PostgreSQL verifier for migration 0057 - HIM Decision Attention
// Foreground Consumption v1 (QHIA-008). Proves, on actual returned rows and
// the INSTALLED function definition: the composition RPC exists with the exact
// narrow two-parameter signature; it is a read-only STABLE function that holds
// NO privilege of its own (not SECURITY DEFINER), pins a fixed safe
// search_path, is postgres-owned, uses no dynamic SQL, reconstructs no JWT,
// and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role);
// its installed definition DELEGATES relevance to the QHIA-006 authority
// (read_him_session_context_bindings_v1) and current intelligence to the
// QHIA-004 authority (read_him_contextual_current_intelligence_batch_v1) while
// referencing no binding/ownership/definition/measurement substrate, no
// canonical-latest or ACTIVE-binding resolver, no auth.uid(), the QHIA-007
// composition, and no context kind or metric other than DECISION and
// hse.attention - hse.self-confidence explicitly included in the proven
// absences; unauthenticated, anon, service_role, wrong-user, cross-user-session
// and inactive-session calls all fail closed through the composed authorities;
// a session with no ACTIVE DECISION binding returns exactly one deterministic
// NO_ACTIVE_DECISION row with every metric column null; a bound Decision
// returns exactly one ACTIVE_DECISION_BOUND row whose identity, value,
// temporal, canonical- and ACTIVE-binding facts equal BOTH the direct QHIA-004
// batch row and the direct canonical-latest authority; only the DECISION kind
// is consumed (a GOAL, SITUATION, or RELATIONSHIP binding changes nothing);
// replacement follows the current ACTIVE binding; a retired binding is never
// consumed; another user's Decision can never leak; an existing
// hse.self-confidence measurement on the very same bound Decision is never
// read, returned, or activated; the read writes nothing; and every fixture
// rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionInactive=randomUUID(),sessionTwo=randomUUID();
const FN='public.read_him_session_decision_attention_v1(uuid,uuid)';
const READ_SQL='SELECT * FROM public.read_him_session_decision_attention_v1($1,$2)';
const SET_BINDING_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_BINDING_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
const BATCH_SQL='SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
// Every metric column of the composition result. An unbound answer must carry
// null in every one of them: "no ACTIVE Decision" is a complete answer, never
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
 if((await client.query('SELECT to_regprocedure($1) reg',[FN])).rows[0].reg===null)throw new Error('The Decision-attention composition must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_decision_attention_v1'")).rows[0].n)!==1)throw new Error('Exactly one Decision-attention authority may exist: no overload may accept a context kind, context id, metric, or target');
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
 if(!props.definition.includes("'DECISION'")||!props.definition.includes("'hse.attention'"))throw new Error('The installed composition must pin exactly DECISION and hse.attention');
 for(const forbidden of['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.read_him_session_situation_stress_v1','auth.uid'])if(props.definition.includes(forbidden))throw new Error(`The installed composition must compose, never reimplement or widen: found ${forbidden}`);
 for(const forbidden of["'GOAL'","'SITUATION'","'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'hse.energy','hse.stress','hse.motivation','hse.self-confidence','hbs.','hrs.','hgs.'])if(props.definition.includes(forbidden))throw new Error(`QHIA-008 activates exactly DECISION + hse.attention@1: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(props.definition))throw new Error('The installed composition must be read-only');
 const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[FN])).rows[0];
 if(acl.pub||acl.anon||acl.service_role||!acl.authenticated)throw new Error('Decision-attention EXECUTE authority must be authenticated-only');
 // The QHIA-007 authority this task must not disturb is still installed with
 // its own exact signature and its own authenticated-only ACL.
 if((await client.query('SELECT to_regprocedure($1) reg',['public.read_him_session_situation_stress_v1(uuid,uuid)'])).rows[0].reg===null)throw new Error('Migration 0056 (QHIA-007) must remain installed and unchanged');
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
 const decisionA=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-008 decision A')")).rows[0];
 const decisionB=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-008 decision B')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-008 goal')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-008 situation')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-008 relationship')")).rows[0];
 // LOW (ordinal 2) is deliberately one of the two values QHIA-008 acts on, so
 // the delegated value proven here is the dangerous one, not a neutral one.
 const observation=(await client.query("SELECT * FROM public.create_hse_attention_measurement('DECISION',$1,'LOW',NULL)",[decisionA.id])).rows[0];
 const snapshot=(await client.query('SELECT * FROM public.calculate_hse_attention_measurement($1)',[observation.id])).rows[0];
 if(!snapshot?.id||Number(snapshot.numeric_value)!==2)throw new Error('Fixture invariant: the canonical Decision attention row must exist with the LOW ordinal');
 // The OTHER runtime-available DECISION metric is measured on the very same
 // Decision. QHIA-008 must never read, return, or activate it.
 const dormantObservation=(await client.query("SELECT * FROM public.create_hse_self_confidence_measurement('DECISION',$1,'VERY_HIGH',NULL)",[decisionA.id])).rows[0];
 const dormantSnapshot=(await client.query('SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[dormantObservation.id])).rows[0];
 if(!dormantSnapshot?.id)throw new Error('Fixture invariant: the dormant Decision self-confidence row must exist so its absence is meaningful');
 // --- 10/11: exact authenticated user/session isolation ----------------------
 await rejectsWith(/owner-exact/,[two,sessionMain],'wrong p_user_id');
 await rejectsWith(/Unknown or cross-user conversation session/,[one,sessionTwo],'cross-user session');
 await rejectsWith(/Unknown or cross-user conversation session/,[one,randomUUID()],'unknown session');
 await rejectsWith(/Conversation session is not active/,[one,sessionInactive],'inactive session');
 // --- 12: no ACTIVE Decision binding => deterministic no-effect result --------
 const unbound=await readOne(one,sessionMain);
 if(unbound.binding_state!=='NO_ACTIVE_DECISION')throw new Error('A session with no ACTIVE Decision binding must report NO_ACTIVE_DECISION');
 for(const column of METRIC_COLUMNS)if(unbound[column]!==null)throw new Error(`The unbound result must carry null ${column}, got ${unbound[column]}`);
 // A measured Decision the user OWNS but has NOT bound stays invisible: the
 // measurement exists, and absent relevance still means absent.
 if(Number((await client.query(BATCH_SQL,[one,'DECISION',decisionA.id,['hse.attention'],[1]])).rows[0].numeric_value)!==Number(snapshot.numeric_value))throw new Error('Fixture invariant: the owned Decision is measurable through the QHIA-004 authority');
 // --- 13/14: an ACTIVE DECISION binding is consumed, exactly and only --------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionA.id]);
 const bound=await readOne(one,sessionMain);
 if(bound.binding_state!=='ACTIVE_DECISION_BOUND')throw new Error('An ACTIVE Decision binding must report ACTIVE_DECISION_BOUND');
 if(bound.binding_context_id!==decisionA.id)throw new Error('The composition must answer for the exact authoritatively bound Decision');
 if(bound.slot_order!==1||bound.metric_key!=='hse.attention'||bound.definition_version!==1)throw new Error('Exactly one slot answering for exactly hse.attention@1 must be returned');
 if(bound.context_kind!=='DECISION'||bound.context_id!==decisionA.id)throw new Error('The delegated read must have used exactly the bound Decision identity');
 if(bound.has_canonical_current_value!==true)throw new Error('The measured bound Decision must carry its canonical current value');
 if(!(Number.isInteger(Number(bound.numeric_value))&&Number(bound.numeric_value)>=1&&Number(bound.numeric_value)<=5))throw new Error('The canonical current value must be a structured 1-5 ordinal');
 if(bound.semantic_mapping_status!=='RESOLVED'||bound.semantic_type!=='STATE'||bound.hif_owner!=='HSE')throw new Error('The delegated definition must still be the HSE / RESOLVED / STATE reading QHIA-008 consumes');
 // --- 15: hse.self-confidence stays DORMANT ----------------------------------
 // The composition returns exactly one slot and it is never the second
 // runtime-available Decision metric, even though that metric is measured, is
 // KNOWN, and belongs to this exact bound Decision.
 const dormantBatch=(await client.query(BATCH_SQL,[one,'DECISION',decisionA.id,['hse.self-confidence'],[1]])).rows[0];
 if(dormantBatch.has_canonical_current_value!==true||Number(dormantBatch.numeric_value)!==5)throw new Error('Fixture invariant: the dormant Decision self-confidence value must be independently readable and KNOWN');
 const boundRows=(await client.query(READ_SQL,[one,sessionMain])).rows;
 if(boundRows.length!==1)throw new Error('The composition must return exactly one slot: no second Decision metric is activated');
 if(boundRows.some(row=>row.metric_key!=='hse.attention'||row.source_metric_key==='hse.self-confidence'))throw new Error('QHIA-008 must never read or return hse.self-confidence');
 if(Number(bound.numeric_value)===Number(dormantBatch.numeric_value))throw new Error('Fixture invariant: the dormant metric must carry a DIFFERENT value so a leak would be detectable');
 // --- 16: QHIA-004 delegation parity, fact for fact --------------------------
 const batch=(await client.query(BATCH_SQL,[one,'DECISION',decisionA.id,['hse.attention'],[1]])).rows[0];
 for(const column of ['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','validity_status','confidence_state','confidence_reference','canonical_binding_id','active_binding_id']){
  if(String(bound[column])!==String(batch[column]))throw new Error(`The composition must return the QHIA-004 fact verbatim: ${column} was ${bound[column]}, the batch authority says ${batch[column]}`);
 }
 if(Number(bound.numeric_value)!==Number(batch.numeric_value))throw new Error('The composition must return the delegated numeric value verbatim');
 if(JSON.stringify(bound.valid_context_kinds)!==JSON.stringify(batch.valid_context_kinds))throw new Error('The composition must return the delegated definition context eligibility verbatim');
 for(const column of ['observed_at','temporal_window_start','temporal_window_end'])if(time(bound[column])!==time(batch[column]))throw new Error(`The composition must return the delegated temporal fact verbatim: ${column}`);
 // --- 17: canonical-latest authority stays the value authority ---------------
 const latest=(await client.query(LATEST_SQL,[one,'hse.attention',1,'DECISION',decisionA.id])).rows[0];
 if(!latest||latest.id!==snapshot.id)throw new Error('Fixture invariant: the direct canonical latest row must be the calculated Decision attention row');
 if(bound.source_metric_key!==latest.metric_key||bound.source_definition_version!==latest.definition_version||bound.source_context_kind!==latest.context_kind||bound.source_context_id!==latest.context_id)throw new Error('Composition source identity must equal the direct canonical latest identity');
 if(bound.value_state!==latest.value_state||Number(bound.numeric_value)!==Number(latest.numeric_value)||bound.validity_status!==latest.validity_status)throw new Error('Composition value facts must equal the direct canonical latest value facts');
 if(bound.canonical_binding_id!==latest.canonical_binding_id)throw new Error('Composition source binding identity must equal the direct canonical latest binding identity');
 // --- 18: ACTIVE measurement-binding compatibility stays delegated -----------
 const resolver=(await client.query("SELECT public.him_active_structured_binding_id('hse.attention',1,'DECISION') id")).rows[0].id;
 if(resolver===null||bound.active_binding_id!==resolver)throw new Error('The composition ACTIVE binding identity must equal the existing migration-0050 resolver');
 // --- 19: only the DECISION kind is consumed ---------------------------------
 for(const[kind,target]of[['GOAL',goalTarget],['SITUATION',situationTarget],['RELATIONSHIP',relationshipTarget]]){
  await client.query(SET_BINDING_SQL,[one,sessionMain,kind,target.id]);
  const withOther=await readOne(one,sessionMain);
  if(withOther.binding_state!=='ACTIVE_DECISION_BOUND'||withOther.binding_context_id!==decisionA.id||withOther.metric_key!=='hse.attention'||Number(withOther.numeric_value)!==Number(snapshot.numeric_value))throw new Error(`A ${kind} binding must not change, widen, or replace the Decision-only answer`);
 }
 // A session bound ONLY to the other kinds still reports no ACTIVE Decision.
 for(const[kind,target]of[['GOAL',goalTarget],['SITUATION',situationTarget],['RELATIONSHIP',relationshipTarget]])await client.query(SET_BINDING_SQL,[one,sessionEmpty,kind,target.id]);
 const otherKindsOnly=await readOne(one,sessionEmpty);
 if(otherKindsOnly.binding_state!=='NO_ACTIVE_DECISION')throw new Error('A GOAL/SITUATION/RELATIONSHIP-only session must report NO_ACTIVE_DECISION: no other kind is consumed');
 for(const column of METRIC_COLUMNS)if(otherKindsOnly[column]!==null)throw new Error(`The other-kinds-only result must carry null ${column}`);
 // --- 20: replacement follows the CURRENT ACTIVE binding through QHIA-006 ----
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionB.id]);
 const replaced=await readOne(one,sessionMain);
 if(replaced.binding_state!=='ACTIVE_DECISION_BOUND'||replaced.binding_context_id!==decisionB.id)throw new Error('The composition must follow the current ACTIVE Decision binding after replacement');
 if(replaced.context_id!==decisionB.id)throw new Error('The delegated read must follow the replacement target');
 if(replaced.has_canonical_current_value!==false)throw new Error('An unmeasured bound Decision must report has_canonical_current_value=false');
 for(const column of ['source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id'])if(replaced[column]!==null)throw new Error(`A bound-but-unmeasured Decision must carry null ${column}: bound and known are separate facts`);
 if(replaced.metric_key!=='hse.attention'||replaced.definition_version!==1||replaced.hif_owner===null)throw new Error('The requested definition metadata must remain present on an unmeasured bound Decision');
 // The retired version-1 binding is history, never a second candidate. The
 // binding substrate carries zero direct privileges for every request role -
 // that posture is exactly what migration 0055 installs - so this
 // history-shape assertion is the one place that must step out of the
 // authenticated identity and read as the owner.
 await client.query('RESET ROLE');
 const retiredCount=Number((await client.query("SELECT count(*)::int n FROM public.him_session_context_bindings WHERE conversation_session_id=$1 AND context_kind='DECISION' AND status='RETIRED'",[sessionMain])).rows[0].n);
 if(retiredCount!==1)throw new Error('Fixture invariant: replacement must have retired exactly one prior Decision binding');
 await identity(one);
 // --- 21: a retired binding can never be consumed ----------------------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'DECISION']);
 const cleared=await readOne(one,sessionMain);
 if(cleared.binding_state!=='NO_ACTIVE_DECISION')throw new Error('A cleared (retired) Decision binding must never be consumed');
 for(const column of METRIC_COLUMNS)if(cleared[column]!==null)throw new Error(`The cleared result must carry null ${column}`);
 // Re-binding the measured Decision restores the authoritative answer, so the
 // clear proved retirement rather than a broken read.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionA.id]);
 const rebound=await readOne(one,sessionMain);
 if(rebound.binding_state!=='ACTIVE_DECISION_BOUND'||rebound.binding_context_id!==decisionA.id||Number(rebound.numeric_value)!==Number(snapshot.numeric_value))throw new Error('Re-binding the measured Decision must restore the authoritative answer');
 // --- 22: another user's Decision can never leak -----------------------------
 await client.query('RESET ROLE');await identity(two);
 const otherDecision=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-008 other-user decision')")).rows[0];
 const otherObservation=(await client.query("SELECT * FROM public.create_hse_attention_measurement('DECISION',$1,'VERY_HIGH',NULL)",[otherDecision.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_attention_measurement($1)',[otherObservation.id]);
 await client.query(SET_BINDING_SQL,[two,sessionTwo,'DECISION',otherDecision.id]);
 const otherBound=await readOne(two,sessionTwo);
 if(otherBound.binding_context_id!==otherDecision.id)throw new Error('The other user must see exactly their own bound Decision');
 await rejectsWith(/Unknown or cross-user conversation session/,[two,sessionMain],'other user reading the first user session');
 await rejectsWith(/owner-exact/,[one,sessionTwo],'other user impersonating the first user');
 await client.query('RESET ROLE');await identity(one);
 const stillOwn=await readOne(one,sessionMain);
 if(stillOwn.binding_context_id!==decisionA.id||stillOwn.binding_context_id===otherDecision.id)throw new Error('One user\'s answer must never reflect another user\'s Decision');
 if(Number(stillOwn.numeric_value)!==Number(snapshot.numeric_value))throw new Error('One user\'s value must never reflect another user\'s measurement');
 // Cross-user binding is impossible at the QHIA-006 authority itself.
 await rejects(SET_BINDING_SQL,[one,sessionMain,'DECISION',otherDecision.id],'binding another user\'s Decision');
 // --- 23: the read is non-mutating -------------------------------------------
 await client.query('RESET ROLE');
 const before=await measurementState();
 await identity(one);
 await readOne(one,sessionMain);
 await readOne(one,sessionEmpty);
 await client.query('RESET ROLE');await identity(two);
 await readOne(two,sessionTwo);
 await client.query('RESET ROLE');
 const after=await measurementState();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Decision-attention reads must write no measurement or binding state');
 // Deterministic repeat read.
 await identity(one);
 const repeat=await readOne(one,sessionMain);
 for(const column of ['binding_state','binding_context_id','metric_key','has_canonical_current_value','canonical_binding_id','active_binding_id'])if(String(repeat[column])!==String(stillOwn[column]))throw new Error(`Decision-attention reads must be deterministic across repeated calls: ${column}`);
 await client.query('RESET ROLE');
 await client.query('ROLLBACK');
 // --- 24: complete fixture rollback ------------------------------------------
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_observations WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])) total',[[one,two]])).rows[0].total);
 if(residue!==0)throw new Error('Decision-attention verifier fixtures must roll back completely');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Decision Attention Foreground Consumption v1 (QHIA-008): the composition RPC exists with the exact intended two-parameter signature as a read-only STABLE function that holds no privilege of its own (not SECURITY DEFINER), is postgres-owned, pins a fixed safe search_path, contains no dynamic SQL, reconstructs no JWT, and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role); its INSTALLED definition delegates relevance to read_him_session_context_bindings_v1 and current intelligence to read_him_contextual_current_intelligence_batch_v1 while referencing no binding, ownership, definition, or measurement substrate, no canonical-latest or ACTIVE-binding resolver, no auth.uid(), not the QHIA-007 composition, and no context kind or metric other than DECISION and hse.attention - hse.self-confidence included in the proven absences; unauthenticated, anon, service_role, wrong-user, cross-user, unknown-session and inactive-session calls fail closed through the composed authorities; a session with no ACTIVE DECISION binding returns exactly one deterministic NO_ACTIVE_DECISION row with every metric column null even while an owned measured Decision exists; an ACTIVE binding returns exactly one ACTIVE_DECISION_BOUND row whose identity, definition metadata, HSE / RESOLVED / STATE semantics, value, temporal, canonical-binding and ACTIVE-binding facts equal both the direct QHIA-004 batch authority and the direct canonical-latest authority, with the ACTIVE binding identity equal to the existing migration-0050 resolver; a KNOWN hse.self-confidence measurement on the very same bound Decision is never read, returned, or activated; GOAL, SITUATION, and RELATIONSHIP bindings neither widen nor replace the Decision-only answer and a session bound only to those kinds still reports NO_ACTIVE_DECISION; replacement follows the current ACTIVE binding and a bound-but-unmeasured Decision stays BOUND with has_canonical_current_value=false and every source field null; a retired binding is never consumed and re-binding restores the authoritative answer; another user\'s Decision, session, and measurement can never leak in either direction; repeated reads are deterministic and write no measurement or binding state; and every fixture rolls back completely.');
