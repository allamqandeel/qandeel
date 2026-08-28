// Real-PostgreSQL verifier for migration 0055 - HIM Session Context Binding
// Relevance v1 (QHIA-006). Proves, on actual rows and installed definitions:
// the session-to-cross-context binding substrate has the exact frozen shape
// (four cross-context kinds only, frozen source/provenance constants,
// ACTIVE/RETIRED lifecycle coherence, per-session/kind version uniqueness,
// max-one-ACTIVE partial uniqueness, composite RESTRICT FKs to the exact
// session and target ownership identities); the table is RLS-enabled with
// zero direct privileges for every request role and an append-only protected
// lifecycle (DELETE always rejected, arbitrary UPDATE rejected, RETIRED can
// never become ACTIVE again); the three RPCs are hardened SECURITY DEFINER
// postgres-owned authenticated-only commands with fixed search_path and no
// dynamic SQL; set/clear/read are owner-exact and fail closed identically for
// unknown and cross-user resources; binding requires no measurement and
// writes no measurement state; the same exact target is idempotent, a
// different same-kind target retires-and-versions, four kinds coexist with
// canonical fixed read order; clear is idempotent and kind-exact; real
// independent connections prove race safety; and every fixture rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionInactive=randomUUID(),sessionStale=randomUUID(),sessionTwo=randomUUID(),sessionRace=randomUUID();
const KINDS=['GOAL','SITUATION','DECISION','RELATIONSHIP'];
const SET_FN='public.set_him_session_context_binding_v1(uuid,uuid,text,uuid)';
const CLEAR_FN='public.clear_him_session_context_binding_v1(uuid,uuid,text)';
const READ_FN='public.read_him_session_context_bindings_v1(uuid,uuid)';
const SET_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
const READ_SQL='SELECT * FROM public.read_him_session_context_bindings_v1($1,$2)';
const BINDING_COLUMNS=['id','user_id','conversation_session_id','context_kind','context_id','binding_version','status','binding_source','created_at','retired_at','canonical_provenance'];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const superuser=async()=>{await client.query('RESET ROLE');};
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const rejectsWith=async(pattern,sql,params)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(sql,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected rejection ${pattern}, got: ${message||'success'}`);return message;};
const bindingRows=async(sessionId,kind)=>(await client.query('SELECT * FROM public.him_session_context_bindings WHERE conversation_session_id=$1 AND context_kind=$2 ORDER BY binding_version',[sessionId,kind])).rows;
const measurementState=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results,(SELECT count(*)::int FROM public.him_measurement_targets) targets')).rows[0];
const foundationDigest=async()=>(await client.query("SELECT (SELECT count(*)::int FROM public.him_metric_definitions) defs,(SELECT coalesce(sum(hashtext(d::text)),0)::text FROM public.him_metric_definitions d) defs_digest,(SELECT count(*)::int FROM public.him_calculation_models) models,(SELECT coalesce(sum(hashtext(m::text)),0)::text FROM public.him_calculation_models m) models_digest,(SELECT count(*)::int FROM public.him_canonical_model_bindings) bindings,(SELECT coalesce(sum(hashtext(b::text)),0)::text FROM public.him_canonical_model_bindings b) bindings_digest")).rows[0];
await client.connect();try{
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$7,'ACTIVE','TEXT'),($2,$7,'ACTIVE','TEXT'),($3,$7,'CLOSED','TEXT'),($4,$7,'ACTIVE','TEXT'),($5,$8,'ACTIVE','TEXT'),($6,$7,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionInactive,sessionStale,sessionTwo,sessionRace,one,two]);
 await client.query('BEGIN');
 // --- 1..10: exact schema shape ---------------------------------------------
 if((await client.query("SELECT to_regclass('public.him_session_context_bindings') r")).rows[0].r===null)throw new Error('The session context binding substrate must exist');
 const columns=(await client.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='him_session_context_bindings' ORDER BY ordinal_position")).rows;
 if(JSON.stringify(columns.map(c=>c.column_name))!==JSON.stringify(BINDING_COLUMNS))throw new Error(`Exact column set mismatch: ${columns.map(c=>c.column_name).join(',')}`);
 const types=Object.fromEntries(columns.map(c=>[c.column_name,`${c.data_type}|${c.is_nullable}`]));
 for(const[column,expected]of Object.entries({id:'uuid|NO',user_id:'uuid|NO',conversation_session_id:'uuid|NO',context_kind:'text|NO',context_id:'uuid|NO',binding_version:'integer|NO',status:'text|NO',binding_source:'text|NO',created_at:'timestamp with time zone|NO',retired_at:'timestamp with time zone|YES',canonical_provenance:'text|NO'}))if(types[column]!==expected)throw new Error(`Column ${column} must be ${expected}, got ${types[column]}`);
 const constraints=(await client.query("SELECT conname,contype,pg_get_constraintdef(oid) def,confdeltype FROM pg_constraint WHERE conrelid='public.him_session_context_bindings'::regclass")).rows;
 const constraint=name=>{const found=constraints.find(c=>c.conname===name);if(!found)throw new Error(`Missing constraint ${name}`);return found;};
 const kindCheck=constraint('him_session_context_binding_kind_check').def;
 for(const kind of KINDS)if(!kindCheck.includes(`'${kind}'`))throw new Error(`context_kind bound must allow ${kind}`);
 if(kindCheck.includes('CONVERSATION_SESSION')||kindCheck.includes('GLOBAL'))throw new Error('context_kind bound must exclude CONVERSATION_SESSION and GLOBAL');
 if(!/binding_version\s*>\s*0/.test(constraint('him_session_context_binding_version_check').def))throw new Error('binding_version must be bound positive');
 const statusCheck=constraint('him_session_context_binding_status_check').def;
 if(!statusCheck.includes("'ACTIVE'")||!statusCheck.includes("'RETIRED'"))throw new Error('status bound must be exactly ACTIVE/RETIRED');
 if(!constraint('him_session_context_binding_source_check').def.includes("'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING'"))throw new Error('binding_source must be pinned to the frozen constant');
 if(!constraint('him_session_context_binding_provenance_check').def.includes("'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1'"))throw new Error('canonical_provenance must be pinned to the frozen constant');
 if(!/status\s*=\s*'RETIRED'[^;]*retired_at IS NOT NULL/.test(constraint('him_session_context_binding_retirement_check').def))throw new Error('ACTIVE/RETIRED timestamp coherence must be bound');
 if(!constraint('him_session_context_binding_history_unique').def.includes('(user_id, conversation_session_id, context_kind, binding_version)'))throw new Error('Per-session/kind version uniqueness must be bound');
 const sessionFk=constraint('him_session_context_binding_owned_session_fk');
 if(!sessionFk.def.includes('(conversation_session_id, user_id)')||!sessionFk.def.includes('conversation_sessions(id, user_id)')||sessionFk.confdeltype!=='r')throw new Error('The composite RESTRICT FK to conversation session ownership is wrong');
 const targetFk=constraint('him_session_context_binding_owned_target_fk');
 if(!targetFk.def.includes('(context_id, user_id, context_kind)')||!targetFk.def.includes('him_measurement_targets(id, user_id, context_kind)')||targetFk.confdeltype!=='r')throw new Error('The composite RESTRICT FK to the exact target owner+kind identity is wrong');
 const activeIndex=(await client.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='him_session_context_bindings' AND indexname='him_one_active_session_context_binding'")).rows[0];
 if(!activeIndex||!/UNIQUE/.test(activeIndex.indexdef)||!activeIndex.indexdef.includes('(user_id, conversation_session_id, context_kind)')||!/WHERE.*ACTIVE/.test(activeIndex.indexdef))throw new Error('The max-one-ACTIVE partial unique index is wrong');
 // --- 11..14: table authority posture ---------------------------------------
 if(!(await client.query("SELECT relrowsecurity r FROM pg_class WHERE oid='public.him_session_context_bindings'::regclass")).rows[0].r)throw new Error('RLS must be enabled');
 for(const role of['anon','authenticated','service_role'])for(const privilege of['SELECT','INSERT','UPDATE','DELETE'])if((await client.query('SELECT has_table_privilege($1,$2,$3) p',[role,'public.him_session_context_bindings',privilege])).rows[0].p)throw new Error(`${role} must have no direct ${privilege}`);
 if((await client.query("SELECT has_table_privilege('public','public.him_session_context_bindings','SELECT') p")).rows[0].p)throw new Error('PUBLIC must have no direct access');
 // --- 19..26: RPC shape and security ----------------------------------------
 for(const[fn,volatility]of[[SET_FN,'v'],[CLEAR_FN,'v'],[READ_FN,'s']]){
  const reg=(await client.query('SELECT to_regprocedure($1) r',[fn])).rows[0].r;
  if(reg===null)throw new Error(`${fn} must exist with the exact intended signature`);
  const props=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,p.proowner::regrole::text owner,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[fn])).rows[0];
  if(!props.prosecdef)throw new Error(`${fn} must be SECURITY DEFINER`);
  if(props.owner!=='postgres')throw new Error(`${fn} must be owned by postgres`);
  if(props.provolatile!==volatility)throw new Error(`${fn} must have volatility ${volatility}`);
  if(!(props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error(`${fn} must pin a fixed safe search_path`);
  if(/EXECUTE\s+format|EXECUTE\s+'/i.test(props.definition))throw new Error(`${fn} must contain no dynamic SQL`);
  if(/request\.jwt/.test(props.definition))throw new Error(`${fn} must not reconstruct a JWT`);
  if(/display_text/.test(props.definition))throw new Error(`${fn} must never read target display text`);
  if(/score|confidence|relevance_weight|embedding|similarity/i.test(props.definition))throw new Error(`${fn} must carry no relevance scoring semantics`);
  const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[fn])).rows[0];
  if(acl.pub||acl.anon||acl.service_role||!acl.authenticated)throw new Error(`${fn} EXECUTE authority must be authenticated-only`);
 }
 if(/set_config/.test((await client.query('SELECT pg_get_functiondef($1::regprocedure) d',[READ_FN])).rows[0].d))throw new Error('The binding read must write no configuration state');
 const guard=(await client.query("SELECT pg_get_functiondef('public.guard_him_session_context_binding_mutation()'::regprocedure) d")).rows[0].d;
 if(!guard.includes('qandeel.session_context_binding_transition'))throw new Error('The lifecycle guard must require internal transition authorization');
 // --- Owned fixtures on the canonical ownership substrates --------------------
 await identity(one);
 const goalTargetA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier binding goal A')")).rows[0];
 const goalTargetB=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier binding goal B')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier binding situation')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier binding relationship')")).rows[0];
 await superuser();
 const decisionTarget=(await client.query("INSERT INTO public.him_measurement_targets(id,user_id,context_kind,display_text,canonical_provenance) VALUES(gen_random_uuid(),$1,'DECISION','verifier binding decision','QANDEEL_HIM_MEASUREMENT_TARGET_V1') RETURNING *",[one])).rows[0];
 await identity(two);
 const foreignGoalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier foreign goal')")).rows[0];
 await superuser();
 // Baselines: the Measurement Foundation digest and the pre-binding
 // measurement-state counts, captured before any binding command runs.
 const foundationBefore=await foundationDigest();
 const targetsBefore=(await client.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) j FROM public.him_measurement_targets t WHERE t.user_id=ANY($1::uuid[])',[[one,two]])).rows[0].j;
 const measurementBefore=await measurementState();
 if((await client.query('SELECT count(*)::int n FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[])',[[one,two]])).rows[0].n!==0)throw new Error('Fixture invariant: the bound targets must carry no measurement event, so binding demonstrably requires none');
 // --- 27..35: set authority fail-closed matrix --------------------------------
 await identity(one);
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(/Authentication required/,SET_SQL,[one,sessionMain,'GOAL',goalTargetA.id]);
 await identity(one);
 await rejectsWith(/owner-exact/,SET_SQL,[two,sessionMain,'GOAL',goalTargetA.id]);
 await rejectsWith(/owner-exact/,SET_SQL,[null,sessionMain,'GOAL',goalTargetA.id]);
 const unknownSessionMessage=await rejectsWith(/Unknown or cross-user conversation session/,SET_SQL,[one,randomUUID(),'GOAL',goalTargetA.id]);
 const crossSessionMessage=await rejectsWith(/Unknown or cross-user conversation session/,SET_SQL,[one,sessionTwo,'GOAL',goalTargetA.id]);
 if(unknownSessionMessage!==crossSessionMessage)throw new Error('Unknown and cross-user sessions must be indistinguishable');
 await rejectsWith(/Unknown or cross-user conversation session/,SET_SQL,[one,null,'GOAL',goalTargetA.id]);
 await rejectsWith(/Conversation session is not active/,SET_SQL,[one,sessionInactive,'GOAL',goalTargetA.id]);
 await superuser();
 if((await bindingRows(sessionInactive,'GOAL')).length!==0)throw new Error('A rejected inactive-session set must have no side effect');
 await identity(one);
 for(const invalidKind of['TOTALLY_BOGUS_KIND','CONVERSATION_SESSION','GLOBAL','goal',''])await rejectsWith(/Unsupported session cross-context binding kind/,SET_SQL,[one,sessionMain,invalidKind,goalTargetA.id]);
 await rejectsWith(/Unsupported session cross-context binding kind/,SET_SQL,[one,sessionMain,null,goalTargetA.id]);
 const unknownTargetMessage=await rejectsWith(/Unknown, cross-user, or wrong-kind measurement target/,SET_SQL,[one,sessionMain,'GOAL',randomUUID()]);
 const crossTargetMessage=await rejectsWith(/Unknown, cross-user, or wrong-kind measurement target/,SET_SQL,[one,sessionMain,'GOAL',foreignGoalTarget.id]);
 const wrongKindMessage=await rejectsWith(/Unknown, cross-user, or wrong-kind measurement target/,SET_SQL,[one,sessionMain,'GOAL',situationTarget.id]);
 if(unknownTargetMessage!==crossTargetMessage||crossTargetMessage!==wrongKindMessage)throw new Error('Unknown, cross-user, and wrong-kind targets must be indistinguishable');
 await rejectsWith(/Unknown, cross-user, or wrong-kind measurement target/,SET_SQL,[one,sessionMain,'GOAL',null]);
 // --- 36..38: exact owned set with no measurement precondition ---------------
 const setGoal=(await client.query(SET_SQL,[one,sessionMain,'GOAL',goalTargetA.id])).rows;
 if(setGoal.length!==1)throw new Error('A successful set must return exactly the one ACTIVE binding');
 const goalBinding=setGoal[0];
 if(goalBinding.user_id!==one||goalBinding.conversation_session_id!==sessionMain||goalBinding.context_kind!=='GOAL'||goalBinding.context_id!==goalTargetA.id)throw new Error('The returned binding must carry the exact requested identity');
 if(goalBinding.status!=='ACTIVE'||goalBinding.binding_version!==1||goalBinding.retired_at!==null)throw new Error('The first binding must be ACTIVE version 1 with null retirement');
 if(goalBinding.binding_source!=='EXPLICIT_AUTHENTICATED_CONTEXT_BINDING'||goalBinding.canonical_provenance!=='QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1')throw new Error('The binding must carry the frozen source and provenance constants');
 await superuser();
 const measurementAfterSet=await measurementState();
 if(JSON.stringify(measurementBefore)!==JSON.stringify(measurementAfterSet))throw new Error('Binding must require and write no measurement event, observation, snapshot, or calculation state');
 // --- 39: idempotent same exact target ---------------------------------------
 await identity(one);
 const repeated=(await client.query(SET_SQL,[one,sessionMain,'GOAL',goalTargetA.id])).rows[0];
 if(repeated.id!==goalBinding.id||repeated.binding_version!==1||repeated.status!=='ACTIVE'||repeated.created_at.getTime()!==goalBinding.created_at.getTime())throw new Error('Repeating the same exact binding must return the same ACTIVE row untouched');
 await superuser();
 if((await bindingRows(sessionMain,'GOAL')).length!==1)throw new Error('Idempotent repetition must add no history row');
 // --- 40..43: replacement retires, versions monotonically, preserves history --
 await identity(one);
 const replaced=(await client.query(SET_SQL,[one,sessionMain,'GOAL',goalTargetB.id])).rows[0];
 if(replaced.status!=='ACTIVE'||replaced.binding_version!==2||replaced.context_id!==goalTargetB.id)throw new Error('Replacement must create the next monotonic ACTIVE version for the new exact target');
 await superuser();
 const goalHistory=await bindingRows(sessionMain,'GOAL');
 if(goalHistory.length!==2)throw new Error('Replacement must preserve history');
 const retiredOld=goalHistory[0];
 if(retiredOld.id!==goalBinding.id||retiredOld.status!=='RETIRED'||retiredOld.retired_at===null)throw new Error('Replacement must retire the old ACTIVE row through the protected lifecycle');
 for(const column of['user_id','conversation_session_id','context_kind','context_id','binding_version','binding_source','canonical_provenance'])if(String(retiredOld[column])!==String(goalBinding[column]))throw new Error(`Retirement must not change ${column}`);
 if(retiredOld.created_at.getTime()!==goalBinding.created_at.getTime())throw new Error('Retirement must not change created_at');
 // --- 15..18: direct mutation and lifecycle bypass all fail ------------------
 await identity(one);
 await rejects('SELECT * FROM public.him_session_context_bindings');
 await rejects('INSERT INTO public.him_session_context_bindings(id,user_id,conversation_session_id,context_kind,context_id,binding_version,status,binding_source,created_at,retired_at,canonical_provenance) VALUES($1,$2,$3,$4,$5,99,$6,$7,CURRENT_TIMESTAMP,NULL,$8)',[randomUUID(),one,sessionMain,'GOAL',goalTargetA.id,'ACTIVE','EXPLICIT_AUTHENTICATED_CONTEXT_BINDING','QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1']);
 await rejects('UPDATE public.him_session_context_bindings SET context_id=$1 WHERE id=$2',[goalTargetA.id,replaced.id]);
 await rejects('DELETE FROM public.him_session_context_bindings WHERE id=$1',[replaced.id]);
 await superuser();await client.query('SET LOCAL ROLE anon');
 await rejects(SET_SQL,[one,sessionMain,'GOAL',goalTargetA.id]);
 await rejects('SELECT * FROM public.him_session_context_bindings');
 await superuser();await client.query('SET LOCAL ROLE service_role');
 await rejects(SET_SQL,[one,sessionMain,'GOAL',goalTargetA.id]);
 await rejects(CLEAR_SQL,[one,sessionMain,'GOAL']);
 await rejects(READ_SQL,[one,sessionMain]);
 await rejects('UPDATE public.him_session_context_bindings SET status=$1 WHERE id=$2',['RETIRED',replaced.id]);
 await rejects('DELETE FROM public.him_session_context_bindings WHERE id=$1',[replaced.id]);
 await superuser();
 // Even a privileged connection cannot bypass the protected lifecycle.
 await rejects('UPDATE public.him_session_context_bindings SET context_id=$1 WHERE id=$2',[goalTargetA.id,replaced.id]);
 await rejects('UPDATE public.him_session_context_bindings SET binding_version=binding_version+10 WHERE id=$1',[replaced.id]);
 await rejects('DELETE FROM public.him_session_context_bindings WHERE id=$1',[replaced.id]);
 await rejects('UPDATE public.him_session_context_bindings SET status=$1,retired_at=clock_timestamp() WHERE id=$2',['RETIRED',replaced.id]);
 await client.query("SELECT set_config('qandeel.session_context_binding_transition','authorized',true)");
 await rejects('UPDATE public.him_session_context_bindings SET status=$1,retired_at=NULL WHERE id=$2',['ACTIVE',retiredOld.id]);
 await rejects('UPDATE public.him_session_context_bindings SET status=$1,retired_at=NULL WHERE id=$2',['RETIRED',replaced.id]);
 await rejects('UPDATE public.him_session_context_bindings SET status=$1,retired_at=clock_timestamp(),context_id=$2 WHERE id=$3',['RETIRED',goalTargetA.id,replaced.id]);
 await rejects('DELETE FROM public.him_session_context_bindings WHERE id=$1',[retiredOld.id]);
 const authorizedRetire=(await client.query('UPDATE public.him_session_context_bindings SET status=$1,retired_at=clock_timestamp() WHERE id=$2 RETURNING status,retired_at',['RETIRED',replaced.id])).rows[0];
 if(authorizedRetire.status!=='RETIRED'||authorizedRetire.retired_at===null)throw new Error('The authorized ACTIVE to RETIRED transition must be the one permitted mutation');
 await client.query("SELECT set_config('qandeel.session_context_binding_transition','',true)");
 // --- 44..46: four-kind coexistence and canonical fixed read order -----------
 await identity(one);
 const goalAgain=(await client.query(SET_SQL,[one,sessionMain,'GOAL',goalTargetB.id])).rows[0];
 if(goalAgain.binding_version!==3)throw new Error('Re-binding after retirement must continue the monotonic version sequence');
 const situationBinding=(await client.query(SET_SQL,[one,sessionMain,'SITUATION',situationTarget.id])).rows[0];
 const decisionBinding=(await client.query(SET_SQL,[one,sessionMain,'DECISION',decisionTarget.id])).rows[0];
 const relationshipBinding=(await client.query(SET_SQL,[one,sessionMain,'RELATIONSHIP',relationshipTarget.id])).rows[0];
 if(situationBinding.status!=='ACTIVE'||decisionBinding.status!=='ACTIVE'||relationshipBinding.status!=='ACTIVE')throw new Error('One ACTIVE binding of each cross-context kind must be able to coexist');
 const fullRead=(await client.query(READ_SQL,[one,sessionMain])).rows;
 if(fullRead.length!==4)throw new Error('The read must return all four ACTIVE bindings in one request');
 if(JSON.stringify(fullRead.map(row=>row.context_kind))!==JSON.stringify(KINDS))throw new Error('The read must return the canonical fixed kind order GOAL, SITUATION, DECISION, RELATIONSHIP');
 const expectedByKind={GOAL:goalTargetB.id,SITUATION:situationTarget.id,DECISION:decisionTarget.id,RELATIONSHIP:relationshipTarget.id};
 for(const row of fullRead){
  if(row.status!=='ACTIVE'||row.retired_at!==null)throw new Error('The active read must return only ACTIVE bindings');
  if(row.context_id!==expectedByKind[row.context_kind])throw new Error('Each read row must carry its exact bound target identity');
  if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify([...BINDING_COLUMNS].sort()))throw new Error('The read projection must carry exactly the binding columns - no target text, score, or confidence');
 }
 await superuser();
 const perSessionKind=(await client.query("SELECT max(n)::int m FROM (SELECT count(*) n FROM public.him_session_context_bindings WHERE status='ACTIVE' AND user_id=ANY($1::uuid[]) GROUP BY user_id,conversation_session_id,context_kind) s",[[one,two]])).rows[0].m;
 if(perSessionKind!==1)throw new Error('There must never be more than one ACTIVE binding per session/kind');
 // --- 47..50: clear semantics ------------------------------------------------
 await identity(one);
 const cleared=(await client.query(CLEAR_SQL,[one,sessionMain,'DECISION'])).rows;
 if(cleared.length!==1||cleared[0].id!==decisionBinding.id||cleared[0].status!=='RETIRED'||cleared[0].retired_at===null)throw new Error('Clear must retire and return the exact ACTIVE binding of the named kind');
 const afterClear=(await client.query(READ_SQL,[one,sessionMain])).rows;
 if(JSON.stringify(afterClear.map(row=>row.context_kind))!==JSON.stringify(['GOAL','SITUATION','RELATIONSHIP']))throw new Error('Clear must not affect other kinds');
 const clearRepeat=(await client.query(CLEAR_SQL,[one,sessionMain,'DECISION'])).rows;
 if(clearRepeat.length!==0)throw new Error('Repeated clear must return zero rows');
 await superuser();
 if((await bindingRows(sessionMain,'DECISION')).length!==1)throw new Error('Repeated clear must write nothing');
 await identity(one);
 await rejectsWith(/owner-exact/,CLEAR_SQL,[two,sessionMain,'GOAL']);
 await rejectsWith(/Unknown or cross-user conversation session/,CLEAR_SQL,[one,sessionTwo,'GOAL']);
 await rejectsWith(/Unsupported session cross-context binding kind/,CLEAR_SQL,[one,sessionMain,'CONVERSATION_SESSION']);
 await identity(two);
 await rejectsWith(/Unknown or cross-user conversation session/,CLEAR_SQL,[two,sessionMain,'GOAL']);
 // Clear works on an owned session that is no longer active, so stale
 // relevance can be retired without reactivating the session.
 await identity(one);
 const staleBinding=(await client.query(SET_SQL,[one,sessionStale,'GOAL',goalTargetA.id])).rows[0];
 await superuser();
 await client.query("UPDATE public.conversation_sessions SET status='CLOSED' WHERE id=$1",[sessionStale]);
 await identity(one);
 await rejectsWith(/Conversation session is not active/,SET_SQL,[one,sessionStale,'GOAL',goalTargetB.id]);
 await rejectsWith(/Conversation session is not active/,READ_SQL,[one,sessionStale]);
 const staleCleared=(await client.query(CLEAR_SQL,[one,sessionStale,'GOAL'])).rows;
 if(staleCleared.length!==1||staleCleared[0].id!==staleBinding.id||staleCleared[0].status!=='RETIRED')throw new Error('An owned inactive session must still allow its stale binding to be cleared');
 // --- 54..58: read authority -------------------------------------------------
 const unknownReadMessage=await rejectsWith(/Unknown or cross-user conversation session/,READ_SQL,[one,randomUUID()]);
 const crossReadMessage=await rejectsWith(/Unknown or cross-user conversation session/,READ_SQL,[one,sessionTwo]);
 if(unknownReadMessage!==crossReadMessage)throw new Error('Unknown and cross-user sessions must be indistinguishable on the read path');
 await rejectsWith(/owner-exact/,READ_SQL,[two,sessionMain]);
 const emptyRead=(await client.query(READ_SQL,[one,sessionEmpty])).rows;
 if(emptyRead.length!==0)throw new Error('Zero bindings must return zero rows - no fallback of any kind');
 await superuser();
 const stateBeforeRead=(await client.query('SELECT count(*)::int n,coalesce(sum(hashtext(b::text)),0)::text digest FROM public.him_session_context_bindings b')).rows[0];
 await identity(one);
 await client.query(READ_SQL,[one,sessionMain]);
 await client.query(READ_SQL,[one,sessionEmpty]);
 await superuser();
 const stateAfterRead=(await client.query('SELECT count(*)::int n,coalesce(sum(hashtext(b::text)),0)::text digest FROM public.him_session_context_bindings b')).rows[0];
 if(JSON.stringify(stateBeforeRead)!==JSON.stringify(stateAfterRead))throw new Error('Reads must write no binding state');
 // --- 61..64: Measurement Foundation isolation -------------------------------
 const targetsAfter=(await client.query('SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) j FROM public.him_measurement_targets t WHERE t.user_id=ANY($1::uuid[])',[[one,two]])).rows[0].j;
 if(JSON.stringify(targetsBefore)!==JSON.stringify(targetsAfter))throw new Error('Existing measurement target rows must remain byte-identical');
 const foundationAfter=await foundationDigest();
 if(JSON.stringify(foundationBefore)!==JSON.stringify(foundationAfter))throw new Error('No metric definition, calculation model, or canonical model binding may change');
 // Canonical latest and QHIA-004 batch semantics are binding-independent: the
 // same reads return the same facts before a binding change and after it.
 await identity(one);
 const obsMotivation=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'HIGH',NULL)",[goalTargetB.id])).rows[0];
 const snapMotivation=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[obsMotivation.id])).rows[0];
 const latestBefore=(await client.query('SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)',[one,'hse.motivation',1,'GOAL',goalTargetB.id])).rows;
 const batchBefore=(await client.query('SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])',[one,'GOAL',goalTargetB.id,['hse.motivation'],[1]])).rows;
 if(latestBefore.length!==1||latestBefore[0].id!==snapMotivation.id)throw new Error('Fixture invariant: the canonical latest motivation row must exist');
 await client.query(CLEAR_SQL,[one,sessionMain,'GOAL']);
 await client.query(SET_SQL,[one,sessionMain,'GOAL',goalTargetA.id]);
 const latestAfter=(await client.query('SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)',[one,'hse.motivation',1,'GOAL',goalTargetB.id])).rows;
 const batchAfter=(await client.query('SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])',[one,'GOAL',goalTargetB.id,['hse.motivation'],[1]])).rows;
 if(JSON.stringify(latestBefore)!==JSON.stringify(latestAfter))throw new Error('Canonical latest-measurement semantics must be unchanged by binding commands');
 if(JSON.stringify(batchBefore)!==JSON.stringify(batchAfter))throw new Error('The QHIA-004 batch read must be unchanged by binding commands');
 await client.query('ROLLBACK');
 // --- 51..53: race safety on real independent connections --------------------
 // Committed fixtures only for this phase - independent connections cannot see
 // uncommitted rows. Everything committed here is removed in the cleanup
 // phase below.
 await client.query('BEGIN');await identity(one);
 const committedGoalA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier race goal A')")).rows[0];
 const committedSituationA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier race situation A')")).rows[0];
 const committedSituationB=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier race situation B')")).rows[0];
 const committedRelationship=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier race relationship')")).rows[0];
 await client.query('COMMIT');
 const raceClient=async work=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:one,role:'authenticated'})]);const result=await work(c);await c.query('COMMIT');return result;}catch(error){try{await c.query('ROLLBACK');}catch{}return{error:String(error?.message??error)};}finally{await c.end();}};
 // 51: two concurrent identical set commands converge to one ACTIVE binding.
 const identicalResults=await Promise.all([
  raceClient(async c=>(await c.query(SET_SQL,[one,sessionRace,'GOAL',committedGoalA.id])).rows[0]),
  raceClient(async c=>(await c.query(SET_SQL,[one,sessionRace,'GOAL',committedGoalA.id])).rows[0]),
 ]);
 for(const result of identicalResults)if(result?.error)throw new Error(`Concurrent identical set must not fail: ${result.error}`);
 if(identicalResults[0].id!==identicalResults[1].id||identicalResults[0].binding_version!==1||identicalResults[1].binding_version!==1)throw new Error('Concurrent identical sets must converge to one ACTIVE version-1 binding');
 const identicalHistory=await bindingRows(sessionRace,'GOAL');
 if(identicalHistory.length!==1||identicalHistory[0].status!=='ACTIVE')throw new Error('Concurrent identical sets must produce exactly one history insertion');
 // 52: two concurrent different-target sets preserve one-ACTIVE and coherent
 // monotonic history.
 const differentResults=await Promise.all([
  raceClient(async c=>(await c.query(SET_SQL,[one,sessionRace,'SITUATION',committedSituationA.id])).rows[0]),
  raceClient(async c=>(await c.query(SET_SQL,[one,sessionRace,'SITUATION',committedSituationB.id])).rows[0]),
 ]);
 for(const result of differentResults)if(result?.error)throw new Error(`Concurrent different-target set must not fail: ${result.error}`);
 const situationHistory=await bindingRows(sessionRace,'SITUATION');
 if(situationHistory.length!==2)throw new Error('Concurrent different-target sets must serialize into exactly two history rows');
 if(JSON.stringify(situationHistory.map(row=>row.binding_version))!==JSON.stringify([1,2]))throw new Error('Concurrent replacement must keep the version sequence monotonic');
 if(situationHistory[0].status!=='RETIRED'||situationHistory[0].retired_at===null||situationHistory[1].status!=='ACTIVE'||situationHistory[1].retired_at!==null)throw new Error('Concurrent replacement must leave exactly one ACTIVE row and one coherently RETIRED row');
 if(![committedSituationA.id,committedSituationB.id].includes(situationHistory[1].context_id)||situationHistory[0].context_id===situationHistory[1].context_id)throw new Error('Concurrent replacement must preserve both exact target identities across history');
 // 53: concurrent set and clear cannot create two ACTIVE rows or corrupt the
 // lifecycle.
 const seed=await raceClient(async c=>(await c.query(SET_SQL,[one,sessionRace,'RELATIONSHIP',committedRelationship.id])).rows[0]);
 if(seed?.error||seed.status!=='ACTIVE'||seed.binding_version!==1)throw new Error(`The set/clear race seed must be an ACTIVE version-1 binding: ${seed?.error??seed?.status}`);
 const setClearResults=await Promise.all([
  raceClient(async c=>(await c.query(SET_SQL,[one,sessionRace,'RELATIONSHIP',committedRelationship.id])).rows[0]),
  raceClient(async c=>(await c.query(CLEAR_SQL,[one,sessionRace,'RELATIONSHIP'])).rows),
 ]);
 for(const result of setClearResults)if(result?.error)throw new Error(`Set/clear concurrency must not fail: ${result.error}`);
 const relationshipHistory=await bindingRows(sessionRace,'RELATIONSHIP');
 if(relationshipHistory.filter(row=>row.status==='ACTIVE').length>1)throw new Error('Set/clear concurrency must never create two ACTIVE rows');
 for(const row of relationshipHistory)if((row.status==='RETIRED')!==(row.retired_at!==null))throw new Error('Set/clear concurrency must never corrupt lifecycle coherence');
 if(JSON.stringify(relationshipHistory.map(row=>row.binding_version))!==JSON.stringify(relationshipHistory.map((_,index)=>index+1)))throw new Error('Set/clear concurrency must keep the version sequence coherent and monotonic');
 // --- 65: complete cleanup ---------------------------------------------------
 await client.query('BEGIN');
 await client.query("SET LOCAL session_replication_role='replica'");
 await client.query('DELETE FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])',[[one,two]]);
 await client.query('COMMIT');
 if(Number((await client.query('SELECT count(*)::int n FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])',[[one,two]])).rows[0].n)!==0)throw new Error('Binding fixture cleanup must be complete');
}finally{try{await client.query('ROLLBACK');}catch{}try{await client.query("RESET ROLE");await client.query('BEGIN');await client.query("SET LOCAL session_replication_role='replica'");await client.query('DELETE FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])',[[one,two]]);await client.query('COMMIT');}catch{try{await client.query('ROLLBACK');}catch{}}await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Session Context Binding Relevance v1 (QHIA-006): the session-to-cross-context binding substrate exists with the exact frozen column set and types, the four cross-context kinds only (CONVERSATION_SESSION and GLOBAL excluded), pinned source and provenance constants, positive versioning, ACTIVE/RETIRED timestamp coherence, per-session/kind version uniqueness, the max-one-ACTIVE partial unique index, and composite RESTRICT FKs to the exact conversation-session and measurement-target ownership identities; the table is RLS-enabled with zero direct SELECT/INSERT/UPDATE/DELETE for PUBLIC, anon, authenticated, and service_role, DELETE always fails, arbitrary and privileged UPDATE fails, RETIRED can never become ACTIVE again, and only the internally authorized ACTIVE-to-RETIRED transition with database-owned retirement time succeeds; the three RPCs exist with the exact intended signatures as postgres-owned SECURITY DEFINER commands with fixed safe search_path, no dynamic SQL, no JWT reconstruction, no target display-text read, no scoring semantics, STABLE read and VOLATILE mutations, and authenticated-only EXECUTE; unauthenticated, mismatched-owner, unknown-session, cross-user-session, inactive-session, invalid-kind, CONVERSATION_SESSION, GLOBAL, unknown-target, cross-user-target, and wrong-kind-target set commands all fail closed with indistinguishable sanitized errors and no side effects; binding an exact owned unmeasured target succeeds with no measurement event, observation, snapshot, or calculation state required or written; repeating the same exact target returns the identical ACTIVE row with no new history, replacing with a different same-kind target retires the old row immutably and increments the version by exactly one, and history is preserved; one GOAL, one SITUATION, one DECISION, and one RELATIONSHIP binding coexist and are returned by one read request in the canonical fixed kind order with exactly the binding columns and never more than one ACTIVE row per kind; clear retires exactly the named kind, leaves other kinds untouched, is idempotent, owner-exact, and works on an owned inactive session while set and read reject it; reads are owner-exact with unknown and cross-user sessions indistinguishable, return zero rows for zero bindings, and write no state; existing measurement target rows stay byte-identical, no metric definition, calculation model, or canonical model binding changes, and canonical latest-measurement and QHIA-004 batch semantics are unchanged by binding commands; real independent PostgreSQL connections prove concurrent identical sets converge to one ACTIVE version-1 binding with one history insertion, concurrent different-target sets serialize into a coherent monotonic two-version history with exactly one ACTIVE row, and set/clear concurrency never creates two ACTIVE rows or corrupts the lifecycle; and every fixture is removed completely.');
