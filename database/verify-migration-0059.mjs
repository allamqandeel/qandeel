// Real-PostgreSQL verifier for migration 0059 - HIM Goal Motivation Foreground
// Consumption v1 (QHIA-010). Proves, on actual returned rows and the INSTALLED
// function definitions:
//
//   * the direct Goal-Motivation authority exists with the exact narrow
//     two-parameter signature; it is a read-only STABLE function that holds NO
//     privilege of its own (not SECURITY DEFINER), pins a fixed safe
//     search_path, is postgres-owned, uses no dynamic SQL, reconstructs no JWT,
//     and grants EXECUTE to authenticated only; its installed definition
//     DELEGATES relevance to the QHIA-006 authority and current intelligence to
//     the QHIA-004 authority while referencing no binding, ownership,
//     definition, or measurement substrate, no canonical-latest or
//     ACTIVE-binding resolver, no auth.uid(), no sibling foreground authority,
//     and no context kind or metric other than GOAL and hse.motivation - the
//     SITUATION context of that same metric explicitly included in the proven
//     absences, which is what keeps Situation-bound Motivation dormant;
//   * unauthenticated, anon, service_role, wrong-user, cross-user-session,
//     unknown-session, inactive-session and wrong-kind-target calls all fail
//     closed through the composed authorities;
//   * a session with no ACTIVE GOAL binding returns exactly one deterministic
//     NO_ACTIVE_GOAL row with every metric column null even while an owned,
//     measured, KNOWN Goal exists and even while a KNOWN Situation-bound
//     Motivation exists on the very same session;
//   * a bound Goal returns exactly one ACTIVE_GOAL_BOUND row whose identity,
//     value, temporal, canonical- and ACTIVE-binding facts equal BOTH the
//     direct QHIA-004 batch row and the direct canonical-latest authority;
//     replacement follows the current ACTIVE binding; a bound-but-unmeasured
//     Goal stays BOUND with has_canonical_current_value=false; a retired
//     binding is never consumed; another user's Goal can never leak;
//   * the migration-0058 aggregate v1 remains installed, authenticated-only,
//     independently callable, and unchanged - still exactly two rows in the
//     frozen 1/SITUATION_STRESS + 2/DECISION_ATTENTION contract;
//   * the aggregate v2 exists with the exact narrow two-parameter signature,
//     the same hardened posture, a single SQL statement, and a fixed three-row
//     envelope 1/SITUATION_STRESS 2/DECISION_ATTENTION 3/GOAL_MOTIVATION with
//     no fourth slot and no caller-selected selector;
//   * v2 WRAPS exactly the v1 aggregate and the direct Goal authority, calling
//     neither QHIA-006 nor QHIA-004 nor either per-channel 0056/0057 authority
//     directly and reading no protected HIM substrate;
//   * for the same session and snapshot, v2 row 1 and row 2 equal the
//     aggregate-v1 payloads fact for fact and v2 row 3 equals the direct
//     Goal-Motivation payload fact for fact - across all-unbound, Goal-only,
//     Goal+Situation, Goal+Decision, all-three-bound, KNOWN, UNKNOWN,
//     replacement, cleared and incompatible-ACTIVE-measurement-binding states;
//   * repeated reads are deterministic and write nothing; and every fixture
//     rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionInactive=randomUUID(),sessionTwo=randomUUID();
const GOAL_FN='public.read_him_session_goal_motivation_v1(uuid,uuid)';
const V1_FN='public.read_him_session_cross_context_foreground_v1(uuid,uuid)';
const V2_FN='public.read_him_session_cross_context_foreground_v2(uuid,uuid)';
const GOAL_SQL='SELECT * FROM public.read_him_session_goal_motivation_v1($1,$2)';
const V1_SQL='SELECT * FROM public.read_him_session_cross_context_foreground_v1($1,$2)';
const V2_SQL='SELECT * FROM public.read_him_session_cross_context_foreground_v2($1,$2)';
const SET_BINDING_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_BINDING_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
const BATCH_SQL='SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
// The nested authority row shape, verbatim. Every one of these columns must be
// carried through both the direct authority and the aggregate unchanged; an
// unbound answer must carry null in every one of them except binding_state.
const NESTED_COLUMNS=['binding_state','binding_context_id','slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id'];
const METRIC_COLUMNS=NESTED_COLUMNS.filter(column=>column!=='binding_state');
// The frozen v2 transport envelope. Transport order only - never a priority.
const SLOTS=[[1,'SITUATION_STRESS'],[2,'DECISION_ATTENTION'],[3,'GOAL_MOTIVATION']];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[],label='')=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${label||sql}`);};
const rejectsWith=async(sql,pattern,params,label)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(sql,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected ${label} rejection ${pattern}, got: ${message||'success'}`);};
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
const readGoalOne=async(userId,sessionId)=>{const rows=(await client.query(GOAL_SQL,[userId,sessionId])).rows;if(rows.length!==1)throw new Error(`The Goal-motivation authority must always return exactly one row, got ${rows.length}`);return rows[0];};
// Every successful aggregate-v1 read must still be exactly the frozen two-row
// envelope migration 0058 installed: QHIA-010 versions the transport, it does
// not mutate the proven one.
const readV1Envelope=async(userId,sessionId)=>{
 const rows=(await client.query(V1_SQL,[userId,sessionId])).rows;
 if(rows.length!==SLOTS.length-1)throw new Error(`The frozen aggregate v1 must still return exactly two rows, got ${rows.length}`);
 rows.forEach((row,index)=>{
  const[order,slot]=SLOTS[index];
  if(Number(row.foreground_slot_order)!==order||row.foreground_slot!==slot)throw new Error(`The frozen aggregate v1 row ${index+1} must still carry ${order}/${slot}`);
  if(Object.keys(row).length!==NESTED_COLUMNS.length+2)throw new Error(`The frozen aggregate v1 row ${index+1} shape changed`);
 });
 return rows;
};
// Every successful aggregate-v2 read must be exactly the frozen three-row
// envelope, in exactly the frozen transport order, with no duplicate, missing,
// unknown, or extra slot - checked on every single read this verifier performs.
const readV2Envelope=async(userId,sessionId)=>{
 const rows=(await client.query(V2_SQL,[userId,sessionId])).rows;
 if(rows.length!==SLOTS.length)throw new Error(`The aggregate v2 must always return exactly three rows, got ${rows.length}`);
 rows.forEach((row,index)=>{
  const[order,slot]=SLOTS[index];
  if(Number(row.foreground_slot_order)!==order)throw new Error(`Aggregate v2 row ${index+1} must carry transport order ${order}, got ${row.foreground_slot_order}`);
  if(row.foreground_slot!==slot)throw new Error(`Aggregate v2 row ${index+1} must carry slot ${slot}, got ${row.foreground_slot}`);
  for(const column of NESTED_COLUMNS)if(!(column in row))throw new Error(`Aggregate v2 row ${index+1} must preserve the nested authority column ${column}`);
  if(Object.keys(row).length!==NESTED_COLUMNS.length+2)throw new Error(`Aggregate v2 row ${index+1} must add exactly the two outer transport fields, got ${Object.keys(row).length} columns`);
 });
 if(new Set(rows.map(row=>row.foreground_slot)).size!==SLOTS.length)throw new Error('The aggregate v2 envelope must carry no duplicate slot');
 return rows;
};
// The core QHIA-010 layering claim: v2 rows 1 and 2 ARE the frozen aggregate-v1
// payloads and v2 row 3 IS the direct Goal-Motivation payload. Nothing is
// recomputed, defaulted, coalesced, or reinterpreted on the way through, so
// this runs on every state the verifier constructs.
const assertParity=async(userId,sessionId,label)=>{
 const envelope=await readV2Envelope(userId,sessionId);
 const aggregateV1=await readV1Envelope(userId,sessionId);
 const goal=(await client.query(GOAL_SQL,[userId,sessionId])).rows;
 if(goal.length!==1)throw new Error(`Fixture invariant: the direct Goal authority must answer with exactly one row (${label})`);
 for(const[index,direct]of[[0,aggregateV1[0]],[1,aggregateV1[1]]]){
  if(normalize(envelope[index].foreground_slot_order)!==normalize(direct.foreground_slot_order)||envelope[index].foreground_slot!==direct.foreground_slot)throw new Error(`Aggregate v2 slot ${SLOTS[index][1]} must carry the frozen v1 transport discriminator verbatim (${label})`);
  for(const column of NESTED_COLUMNS){
   if(normalize(envelope[index][column])!==normalize(direct[column]))throw new Error(`Aggregate v2 slot ${SLOTS[index][1]} must equal the aggregate-v1 payload verbatim (${label}): ${column} was ${envelope[index][column]}, aggregate v1 says ${direct[column]}`);
  }
 }
 for(const column of NESTED_COLUMNS){
  if(normalize(envelope[2][column])!==normalize(goal[0][column]))throw new Error(`Aggregate v2 slot GOAL_MOTIVATION must equal the direct Goal authority payload verbatim (${label}): ${column} was ${envelope[2][column]}, the direct authority says ${goal[0][column]}`);
 }
 if(Object.keys(goal[0]).length!==NESTED_COLUMNS.length)throw new Error(`Fixture invariant: the direct Goal authority row shape changed (${label})`);
 return envelope;
};
const measurementState=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results,(SELECT count(*)::int FROM public.him_measurement_targets) targets,(SELECT count(*)::int FROM public.him_session_context_bindings) bindings,(SELECT count(*)::int FROM public.him_session_context_bindings WHERE status=\'ACTIVE\') active_bindings,(SELECT count(*)::int FROM public.him_canonical_model_bindings WHERE status=\'ACTIVE\') active_model_bindings')).rows[0];
await client.connect();try{
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$5,'ACTIVE','TEXT'),($2,$5,'ACTIVE','TEXT'),($3,$5,'CLOSED','TEXT'),($4,$6,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionInactive,sessionTwo,one,two]);
 await client.query('BEGIN');
 // --- 1: the direct Goal-Motivation authority's installed facts -------------
 if((await client.query('SELECT to_regprocedure($1) reg',[GOAL_FN])).rows[0].reg===null)throw new Error('The Goal-motivation authority must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_goal_motivation_v1'")).rows[0].n)!==1)throw new Error('Exactly one Goal-motivation authority may exist: no overload may accept a context kind, context id, metric, or target');
 const goalProps=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[GOAL_FN])).rows[0];
 if(goalProps.prosecdef)throw new Error('The Goal-motivation authority must hold no privilege of its own: every privileged read belongs to the composed authorities');
 if(goalProps.provolatile!=='s')throw new Error('The Goal-motivation authority must be STABLE');
 if(goalProps.pronargs!==2)throw new Error('The Goal-motivation callable surface must accept exactly the authenticated user and the exact owned session');
 if(goalProps.owner!=='postgres')throw new Error('The Goal-motivation authority must be owned by postgres');
 if(!(goalProps.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The Goal-motivation authority must pin a fixed safe search_path');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(goalProps.definition))throw new Error('The Goal-motivation authority must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(goalProps.definition))throw new Error('The Goal-motivation authority must not reconstruct or write request identity state');
 if(!goalProps.definition.includes('public.read_him_session_context_bindings_v1('))throw new Error('The installed Goal-motivation authority must resolve relevance through the QHIA-006 authority');
 if(!goalProps.definition.includes('public.read_him_contextual_current_intelligence_batch_v1('))throw new Error('The installed Goal-motivation authority must resolve current intelligence through the QHIA-004 authority');
 if(!goalProps.definition.includes("'GOAL'")||!goalProps.definition.includes("'hse.motivation'"))throw new Error('The installed Goal-motivation authority must pin exactly GOAL and hse.motivation');
 for(const forbidden of['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_cross_context_foreground_v1','auth.uid'])if(goalProps.definition.includes(forbidden))throw new Error(`The installed Goal-motivation authority must compose, never reimplement or widen: found ${forbidden}`);
 // SITUATION is the OTHER valid measurement context of this very metric. Its
 // absence from the installed definition is what keeps Situation-bound
 // Motivation dormant under a GOAL-only activation.
 for(const forbidden of["'SITUATION'","'DECISION'","'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'hse.energy','hse.stress','hse.attention','hse.self-confidence','hbs.','hrs.','hgs.'])if(goalProps.definition.includes(forbidden))throw new Error(`QHIA-010 activates exactly GOAL + hse.motivation@1: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(goalProps.definition))throw new Error('The installed Goal-motivation authority must be read-only');
 const goalAcl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[GOAL_FN])).rows[0];
 if(goalAcl.pub||goalAcl.anon||goalAcl.service_role||!goalAcl.authenticated)throw new Error('Goal-motivation EXECUTE authority must be authenticated-only');
 // --- 2: the aggregate v2 installed facts ------------------------------------
 if((await client.query('SELECT to_regprocedure($1) reg',[V2_FN])).rows[0].reg===null)throw new Error('The cross-context aggregate v2 must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_cross_context_foreground_v2'")).rows[0].n)!==1)throw new Error('Exactly one cross-context aggregate v2 may exist: no overload may accept a context kind, context id, target, metric, or slot list');
 const v2Props=(await client.query("SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,p.prosrc,l.lanname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=$1::regprocedure",[V2_FN])).rows[0];
 if(v2Props.prosecdef)throw new Error('The aggregate v2 must hold no privilege of its own: every privileged read belongs to the wrapped authorities');
 if(v2Props.provolatile!=='s')throw new Error('The aggregate v2 must be STABLE');
 if(v2Props.pronargs!==2)throw new Error('The aggregate v2 callable surface must accept exactly the authenticated user and the exact owned session');
 if(v2Props.owner!=='postgres')throw new Error('The aggregate v2 must be owned by postgres');
 if(!(v2Props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The aggregate v2 must pin a fixed safe search_path');
 // ONE SQL statement, structurally: a plain SQL body with no statement
 // separator at all, so both wrapped authorities necessarily execute inside the
 // same statement and therefore the same snapshot.
 if(v2Props.lanname!=='sql')throw new Error('The aggregate v2 must be a plain SQL function so its wrapped authorities share one statement and one snapshot');
 if(v2Props.prosrc.includes(';'))throw new Error('The aggregate v2 body must be exactly one statement');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(v2Props.definition))throw new Error('The aggregate v2 must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(v2Props.definition))throw new Error('The aggregate v2 must not reconstruct or write request identity state');
 if(!v2Props.definition.includes('public.read_him_session_cross_context_foreground_v1('))throw new Error('The installed aggregate v2 must wrap the frozen QHIA-009 aggregate v1');
 if(!v2Props.definition.includes('public.read_him_session_goal_motivation_v1('))throw new Error('The installed aggregate v2 must wrap the QHIA-010 Goal-motivation authority');
 if(!v2Props.definition.includes("'GOAL_MOTIVATION'"))throw new Error('The installed aggregate v2 must label the one new frozen transport slot');
 if((v2Props.definition.match(/UNION ALL/g)??[]).length!==1)throw new Error('The installed aggregate v2 envelope must extend the frozen v1 aggregate with exactly one new slot');
 // v2 EXTENDS the proven aggregate; it never reopens it. The per-channel
 // 0056/0057 authorities and the lower QHIA-006/QHIA-004 authorities stay
 // exactly where they already are.
 for(const forbidden of['public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_context_bindings_v1','public.read_him_contextual_current_intelligence_batch_v1','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','auth.uid'])if(v2Props.definition.includes(forbidden))throw new Error(`The installed aggregate v2 must wrap the proven v1 aggregate and the Goal authority, never reimplement or widen: found ${forbidden}`);
 for(const forbidden of["'SITUATION'","'DECISION'","'GOAL'","'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'hse.','hbs.','hrs.','hgs.'])if(v2Props.definition.includes(forbidden))throw new Error(`The aggregate v2 activates no metric and no context kind: found ${forbidden}`);
 for(const forbidden of['p_context_kind','p_context_id','p_target','p_metric_key','p_metric_keys','p_definition_version','p_slot','p_foreground_slot'])if(v2Props.definition.includes(forbidden))throw new Error(`The aggregate v2 accepts no caller-selected context, target, metric, or slot: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(v2Props.definition))throw new Error('The installed aggregate v2 must be read-only');
 const v2Acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[V2_FN])).rows[0];
 if(v2Acl.pub||v2Acl.anon||v2Acl.service_role||!v2Acl.authenticated)throw new Error('Aggregate v2 EXECUTE authority must be authenticated-only');
 // --- 3: the frozen aggregate v1 is preserved, not mutated -------------------
 if((await client.query('SELECT to_regprocedure($1) reg',[V1_FN])).rows[0].reg===null)throw new Error('The QHIA-009 aggregate v1 must remain installed and independently callable after QHIA-010');
 const v1Props=(await client.query('SELECT p.pronargs,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[V1_FN])).rows[0];
 if(v1Props.pronargs!==2)throw new Error('The frozen aggregate v1 callable surface must be unchanged');
 if(!v1Props.definition.includes("'SITUATION_STRESS'")||!v1Props.definition.includes("'DECISION_ATTENTION'"))throw new Error('The frozen aggregate v1 must keep its exact two-slot contract');
 if(v1Props.definition.includes("'GOAL_MOTIVATION'")||v1Props.definition.includes('public.read_him_session_goal_motivation_v1'))throw new Error('The frozen aggregate v1 must remain a two-slot contract: the third slot belongs to v2 only');
 if((v1Props.definition.match(/UNION ALL/g)??[]).length!==1)throw new Error('The frozen aggregate v1 envelope must still contain exactly its two slots');
 const v1Acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[V1_FN])).rows[0];
 if(v1Acl.pub||v1Acl.anon||v1Acl.service_role||!v1Acl.authenticated)throw new Error('The frozen aggregate v1 must keep its unchanged authenticated-only EXECUTE authority');
 // The two per-channel authorities the v1 aggregate wraps are equally untouched.
 for(const wrapped of['public.read_him_session_situation_stress_v1(uuid,uuid)','public.read_him_session_decision_attention_v1(uuid,uuid)']){
  if((await client.query('SELECT to_regprocedure($1) reg',[wrapped])).rows[0].reg===null)throw new Error(`${wrapped} must remain installed and independently callable after QHIA-010`);
 }
 // --- 4: unauthenticated, anon, service_role ---------------------------------
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(GOAL_SQL,/Authentication required/,[one,sessionMain],'unauthenticated Goal read');
 await rejectsWith(V2_SQL,/Authentication required/,[one,sessionMain],'unauthenticated aggregate v2 read');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(GOAL_SQL,[one,sessionMain],'anon Goal EXECUTE');
 await rejects(V2_SQL,[one,sessionMain],'anon aggregate v2 EXECUTE');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE service_role');
 await rejects(GOAL_SQL,[one,sessionMain],'service_role Goal EXECUTE');
 await rejects(V2_SQL,[one,sessionMain],'service_role aggregate v2 EXECUTE');
 await client.query('RESET ROLE');
 // --- Owned fixtures on the canonical substrates only ------------------------
 await identity(one);
 const goalA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-010 goal A')")).rows[0];
 const goalB=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-010 goal B')")).rows[0];
 const goalUnbound=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-010 goal never bound')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier qhia-010 situation')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-010 decision')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-010 relationship')")).rows[0];
 // VERY_LOW (ordinal 1) is deliberately one of the two values QHIA-010 acts on,
 // so the delegated value proven here is the dangerous one, not a neutral one.
 const goalObservation=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_LOW',NULL)",[goalA.id])).rows[0];
 const goalSnapshot=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[goalObservation.id])).rows[0];
 if(!goalSnapshot?.id||Number(goalSnapshot.numeric_value)!==1)throw new Error('Fixture invariant: the canonical Goal motivation row must exist with the VERY_LOW ordinal');
 // An owned, measured Goal that is NEVER bound. Its value differs, so a
 // relevance leak would be detectable rather than invisible.
 const unboundObservation=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_HIGH',NULL)",[goalUnbound.id])).rows[0];
 const unboundSnapshot=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[unboundObservation.id])).rows[0];
 if(Number(unboundSnapshot?.numeric_value)!==5)throw new Error('Fixture invariant: the never-bound Goal must be measured with a DIFFERENT value');
 // The SAME metric measured in its OTHER valid context. Situation-bound
 // Motivation must never be consumed by this GOAL-only activation, and must
 // never substitute for a missing Goal Motivation.
 const situationMotivationObservation=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'HIGH',NULL)",[situationTarget.id])).rows[0];
 const situationMotivationSnapshot=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[situationMotivationObservation.id])).rows[0];
 if(Number(situationMotivationSnapshot?.numeric_value)!==4)throw new Error('Fixture invariant: the dormant Situation-bound Motivation must exist with its own DIFFERENT value');
 // The two other aggregate channels, so v2 parity is proven with real bound
 // Situation and Decision payloads rather than only with unbound ones.
 const stressObservation=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'HIGH',NULL)",[situationTarget.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[stressObservation.id]);
 const attentionObservation=(await client.query("SELECT * FROM public.create_hse_attention_measurement('DECISION',$1,'LOW',NULL)",[decisionTarget.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_attention_measurement($1)',[attentionObservation.id]);
 // --- 5: exact authenticated user/session isolation, atomically --------------
 // A cross-user or non-owned call fails as the nested authority's own error;
 // neither the direct authority nor the aggregate adds a fallback, a partial
 // envelope, or a fabricated row.
 for(const[sql,label]of[[GOAL_SQL,'Goal authority'],[V2_SQL,'aggregate v2']]){
  await rejectsWith(sql,/owner-exact/,[two,sessionMain],`${label} wrong p_user_id`);
  await rejectsWith(sql,/Unknown or cross-user conversation session/,[one,sessionTwo],`${label} cross-user session`);
  await rejectsWith(sql,/Unknown or cross-user conversation session/,[one,randomUUID()],`${label} unknown session`);
  await rejectsWith(sql,/Conversation session is not active/,[one,sessionInactive],`${label} inactive session`);
 }
 // --- 6: no ACTIVE Goal binding => deterministic no-effect result ------------
 const allUnbound=await assertParity(one,sessionMain,'all three unbound');
 if(allUnbound[0].binding_state!=='NO_ACTIVE_SITUATION'||allUnbound[1].binding_state!=='NO_ACTIVE_DECISION'||allUnbound[2].binding_state!=='NO_ACTIVE_GOAL')throw new Error('A session with no ACTIVE relevance binding must report all three deterministic unbound states');
 for(const[index,row]of allUnbound.entries())for(const column of METRIC_COLUMNS)if(row[column]!==null)throw new Error(`The unbound ${SLOTS[index][1]} slot must carry null ${column}, got ${row[column]}`);
 // The owned, measured, KNOWN Goal that was never bound stays INVISIBLE:
 // measurement existence and ownership do not imply conversation relevance.
 if(Number((await client.query(BATCH_SQL,[one,'GOAL',goalUnbound.id,['hse.motivation'],[1]])).rows[0].numeric_value)!==5)throw new Error('Fixture invariant: the never-bound Goal is measurable through the QHIA-004 authority');
 // --- 7: only the GOAL kind is consumed; other kinds never substitute --------
 // A bound SITUATION whose Motivation is KNOWN must NOT become the Goal answer.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationTarget.id]);
 const situationBoundOnly=await assertParity(one,sessionMain,'Situation bound, no Goal');
 if(situationBoundOnly[2].binding_state!=='NO_ACTIVE_GOAL')throw new Error('A bound Situation must never bind, widen, or substitute the Goal slot');
 for(const column of METRIC_COLUMNS)if(situationBoundOnly[2][column]!==null)throw new Error(`A measured Situation-bound Motivation must not populate the Goal slot: ${column}`);
 if(situationBoundOnly[0].binding_state!=='ACTIVE_SITUATION_BOUND'||situationBoundOnly[0].metric_key!=='hse.stress')throw new Error('The Situation slot must still answer with its own delegated hse.stress reading');
 // The dormant Situation-bound Motivation is independently readable and KNOWN,
 // so its absence from the Goal slot is a proven exclusion, not a missing row.
 const dormantSituationMotivation=(await client.query(BATCH_SQL,[one,'SITUATION',situationTarget.id,['hse.motivation'],[1]])).rows[0];
 if(dormantSituationMotivation.has_canonical_current_value!==true||Number(dormantSituationMotivation.numeric_value)!==4)throw new Error('Fixture invariant: the dormant Situation-bound Motivation must be independently readable and KNOWN');
 // A DECISION and a RELATIONSHIP binding equally change nothing about the Goal.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionTarget.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',relationshipTarget.id]);
 const otherKinds=await assertParity(one,sessionMain,'Situation + Decision + Relationship, no Goal');
 if(otherKinds[2].binding_state!=='NO_ACTIVE_GOAL')throw new Error('No other relevance kind may activate the Goal slot');
 if(otherKinds[1].binding_state!=='ACTIVE_DECISION_BOUND'||Number(otherKinds[1].numeric_value)!==2)throw new Error('The Decision slot must still answer with its own delegated hse.attention reading');
 // A wrong-kind target can never be bound as a Goal at the QHIA-006 authority.
 await rejects(SET_BINDING_SQL,[one,sessionMain,'GOAL',situationTarget.id],'binding a SITUATION target as the GOAL relevance');
 await rejects(SET_BINDING_SQL,[one,sessionMain,'GOAL',decisionTarget.id],'binding a DECISION target as the GOAL relevance');
 // --- 8: an ACTIVE GOAL binding is consumed, exactly and only ----------------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalA.id]);
 const allBound=await assertParity(one,sessionMain,'all three bound');
 const bound=allBound[2];
 if(bound.binding_state!=='ACTIVE_GOAL_BOUND')throw new Error('An ACTIVE Goal binding must report ACTIVE_GOAL_BOUND');
 if(bound.binding_context_id!==goalA.id)throw new Error('The Goal slot must answer for the exact authoritatively bound Goal');
 if(bound.slot_order!==1||bound.metric_key!=='hse.motivation'||bound.definition_version!==1)throw new Error('Exactly one slot answering for exactly hse.motivation@1 must be returned');
 if(bound.context_kind!=='GOAL'||bound.context_id!==goalA.id)throw new Error('The delegated read must have used exactly the bound Goal identity');
 if(bound.has_canonical_current_value!==true)throw new Error('The measured bound Goal must carry its canonical current value');
 if(Number(bound.numeric_value)!==1)throw new Error('The Goal slot must carry exactly the delegated hse.motivation@1 VERY_LOW value');
 if(bound.hif_owner!=='HSE'||bound.semantic_mapping_status!=='RESOLVED'||bound.semantic_type!=='STATE')throw new Error('The delegated definition must still be the HSE / RESOLVED / STATE reading QHIA-010 consumes');
 if(!(bound.valid_context_kinds??[]).includes('GOAL'))throw new Error('The delegated persisted definition must remain GOAL-eligible');
 // Three independent channels under one transport: never merged, ranked, or
 // reduced to a composite.
 if(allBound[0].metric_key===allBound[2].metric_key||allBound[1].metric_key===allBound[2].metric_key)throw new Error('The aggregate must not collapse the three channels into one metric');
 if(Number(allBound[0].numeric_value)===Number(allBound[2].numeric_value)||Number(allBound[1].numeric_value)===Number(allBound[2].numeric_value))throw new Error('Fixture invariant: the three channels must carry DIFFERENT values so a leak between them would be detectable');
 if(allBound[0].context_kind!=='SITUATION'||allBound[1].context_kind!=='DECISION'||allBound[2].context_kind!=='GOAL')throw new Error('Each aggregate slot must preserve its own delegated context kind');
 // --- 9: QHIA-004 delegation parity, fact for fact ---------------------------
 const batch=(await client.query(BATCH_SQL,[one,'GOAL',goalA.id,['hse.motivation'],[1]])).rows[0];
 for(const column of['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','validity_status','confidence_state','confidence_reference','canonical_binding_id','active_binding_id','numeric_value','valid_context_kinds','observed_at','temporal_window_start','temporal_window_end']){
  if(normalize(bound[column])!==normalize(batch[column]))throw new Error(`The Goal authority must return the QHIA-004 fact verbatim: ${column} was ${bound[column]}, the batch authority says ${batch[column]}`);
 }
 // --- 10: canonical-latest authority stays the value authority ---------------
 const latest=(await client.query(LATEST_SQL,[one,'hse.motivation',1,'GOAL',goalA.id])).rows[0];
 if(!latest||latest.id!==goalSnapshot.id)throw new Error('Fixture invariant: the direct canonical latest row must be the calculated Goal motivation row');
 if(bound.source_metric_key!==latest.metric_key||bound.source_definition_version!==latest.definition_version||bound.source_context_kind!==latest.context_kind||bound.source_context_id!==latest.context_id)throw new Error('Goal source identity must equal the direct canonical latest identity');
 if(bound.value_state!==latest.value_state||Number(bound.numeric_value)!==Number(latest.numeric_value)||bound.validity_status!==latest.validity_status)throw new Error('Goal value facts must equal the direct canonical latest value facts');
 if(bound.canonical_binding_id!==latest.canonical_binding_id)throw new Error('Goal source binding identity must equal the direct canonical latest binding identity');
 const resolver=(await client.query("SELECT public.him_active_structured_binding_id('hse.motivation',1,'GOAL') id")).rows[0].id;
 if(resolver===null||bound.active_binding_id!==resolver)throw new Error('The Goal ACTIVE binding identity must equal the existing migration-0050 resolver');
 // --- 11: Goal-only session, and Goal + one other channel --------------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'DECISION']);
 const goalOnly=await assertParity(one,sessionMain,'Goal bound only');
 if(goalOnly[0].binding_state!=='NO_ACTIVE_SITUATION'||goalOnly[1].binding_state!=='NO_ACTIVE_DECISION')throw new Error('Clearing the other kinds must leave their slots unbound');
 if(goalOnly[2].binding_state!=='ACTIVE_GOAL_BOUND'||Number(goalOnly[2].numeric_value)!==1)throw new Error('A Goal-only session must still carry the exact delegated Goal reading');
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationTarget.id]);
 const goalPlusSituation=await assertParity(one,sessionMain,'Goal + Situation');
 if(goalPlusSituation[0].binding_state!=='ACTIVE_SITUATION_BOUND'||goalPlusSituation[1].binding_state!=='NO_ACTIVE_DECISION'||goalPlusSituation[2].binding_state!=='ACTIVE_GOAL_BOUND')throw new Error('Goal + Situation must bind exactly those two slots');
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionTarget.id]);
 const goalPlusDecision=await assertParity(one,sessionMain,'Goal + Decision');
 if(goalPlusDecision[0].binding_state!=='NO_ACTIVE_SITUATION'||goalPlusDecision[1].binding_state!=='ACTIVE_DECISION_BOUND'||goalPlusDecision[2].binding_state!=='ACTIVE_GOAL_BOUND')throw new Error('Goal + Decision must bind exactly those two slots');
 // --- 12: replacement follows the CURRENT ACTIVE binding through QHIA-006 ----
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalB.id]);
 const replaced=await assertParity(one,sessionMain,'Goal replaced and unmeasured');
 if(replaced[2].binding_state!=='ACTIVE_GOAL_BOUND'||replaced[2].binding_context_id!==goalB.id)throw new Error('The Goal slot must follow the current ACTIVE Goal binding after replacement');
 if(replaced[2].context_id!==goalB.id)throw new Error('The delegated read must follow the replacement target');
 if(replaced[2].has_canonical_current_value!==false)throw new Error('An unmeasured bound Goal must report has_canonical_current_value=false');
 for(const column of['source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id'])if(replaced[2][column]!==null)throw new Error(`A bound-but-unmeasured Goal must carry null ${column}: bound and known are separate facts`);
 if(replaced[2].metric_key!=='hse.motivation'||replaced[2].definition_version!==1||replaced[2].hif_owner!=='HSE')throw new Error('The requested definition metadata must remain present on an unmeasured bound Goal');
 // The retired version-1 binding is history, never a second candidate. The
 // binding substrate carries zero direct privileges for every request role, so
 // this history-shape assertion is the one place that must step out of the
 // authenticated identity and read as the owner.
 await client.query('RESET ROLE');
 if(Number((await client.query("SELECT count(*)::int n FROM public.him_session_context_bindings WHERE conversation_session_id=$1 AND context_kind='GOAL' AND status='RETIRED'",[sessionMain])).rows[0].n)!==1)throw new Error('Fixture invariant: replacement must have retired exactly one prior Goal binding');
 await identity(one);
 // --- 13: a cleared (retired) Goal binding can never be consumed -------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'GOAL']);
 const cleared=await assertParity(one,sessionMain,'Goal cleared');
 if(cleared[2].binding_state!=='NO_ACTIVE_GOAL')throw new Error('A cleared (retired) Goal binding must never be consumed');
 for(const column of METRIC_COLUMNS)if(cleared[2][column]!==null)throw new Error(`The cleared Goal slot must carry null ${column}`);
 // Re-binding the measured Goal restores the authoritative answer, so the clear
 // proved retirement rather than a broken read.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalA.id]);
 const rebound=await assertParity(one,sessionMain,'Goal re-bound');
 if(rebound[2].binding_state!=='ACTIVE_GOAL_BOUND'||rebound[2].binding_context_id!==goalA.id||Number(rebound[2].numeric_value)!==1)throw new Error('Re-binding the measured Goal must restore the authoritative answer');
 // --- 14: incompatible ACTIVE measurement binding stays delegated ------------
 // A protected migration-0050 binding transition retires the ACTIVE
 // hse.motivation@1/GOAL canonical binding in favour of a compatible successor.
 // The already-calculated snapshot keeps its historical binding, so the
 // delegated row now reports canonical_binding_id <> active_binding_id - the
 // authoritative "incompatible ACTIVE binding" state. QHIA-010 must carry that
 // state through verbatim and must not repair, hide, or reinterpret it, and it
 // must never fall back to a stale value.
 await client.query('RESET ROLE');
 const model='59000000-0000-4000-8000-000000000002',approval='59000000-0000-4000-8000-000000000003',bindingV2='59000000-0000-4000-8000-000000000004';
 await client.query("INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES($1,'hse.motivation.direct-structured-self-report',2,'hse.motivation',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_SELF_REPORT','hse.motivation.ordinal-5.v1','{\"required\":[\"measurementObservation\",\"explicitTarget\"]}'::jsonb,'FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['GOAL','SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hse-motivation-direct-structured-v1-qhia010',now(),now())",[model]);
 await client.query("INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES($1,'verifier.qhia010.motivation.transition.v2',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.motivation.direct-structured-self-report',2,'[\"HSE_MOTIVATION_STATE\",\"DIRECT_TARGET_BOUND_REPORT\",\"RIGHT_NOW\",\"GOAL_OR_SITUATION\",\"ORDINAL_5\",\"FOUNDER_TESTED_AR_EG_EXAMPLE\",\"DETERMINISTIC\",\"CORRECTION_IDEMPOTENCY_CONCURRENCY\",\"SECURITY_BINDING\",\"NO_EXTERNAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')",[approval]);
 const nextBindingVersion=(await client.query("SELECT max(binding_version)::int+1 v FROM public.him_canonical_model_bindings WHERE metric_key='hse.motivation' AND definition_version=1 AND context_kind='GOAL'")).rows[0].v;
 await client.query("INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hse.motivation',1,'GOAL',$2,'PENDING','hse.motivation.direct-structured-self-report',2,'hse.motivation.direct-self-report',1,'hse.motivation.ordinal-5.v1',1,'verifier.qhia010.motivation.transition.v2',1,now())",[bindingV2,nextBindingVersion]);
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[bindingV2]);
 await identity(one);
 const transitioned=await assertParity(one,sessionMain,'incompatible ACTIVE measurement binding');
 if(transitioned[2].active_binding_id!==bindingV2)throw new Error('The Goal slot must follow the transitioned ACTIVE measurement binding');
 if(transitioned[2].canonical_binding_id===null||transitioned[2].canonical_binding_id===transitioned[2].active_binding_id)throw new Error('Fixture invariant: the Goal slot must now report an incompatible ACTIVE measurement binding');
 if(transitioned[2].has_canonical_current_value!==true||Number(transitioned[2].numeric_value)!==1)throw new Error('The incompatible-binding state must stay an authoritative source fact, never a repaired, hidden, or stale-fallback one');
 // The Situation-bound Motivation of the SAME metric keeps its own untouched
 // GOAL/SITUATION-separate ACTIVE binding: one metric never means one context.
 const situationMotivationAfter=(await client.query(BATCH_SQL,[one,'SITUATION',situationTarget.id,['hse.motivation'],[1]])).rows[0];
 if(situationMotivationAfter.canonical_binding_id!==situationMotivationAfter.active_binding_id||Number(situationMotivationAfter.numeric_value)!==4)throw new Error('A GOAL binding transition must never disturb the SITUATION context of the same metric');
 // The Decision channel is equally untouched: one shared transport never means
 // one shared measurement authority.
 if(transitioned[1].canonical_binding_id!==transitioned[1].active_binding_id||Number(transitioned[1].numeric_value)!==2)throw new Error('A transition on one channel must never disturb another channel');
 // --- 15: another user's Goal can never leak in either direction -------------
 await client.query('RESET ROLE');await identity(two);
 const otherGoal=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-010 other-user goal')")).rows[0];
 const otherObservation=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'MODERATE',NULL)",[otherGoal.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[otherObservation.id]);
 await client.query(SET_BINDING_SQL,[two,sessionTwo,'GOAL',otherGoal.id]);
 const otherEnvelope=await assertParity(two,sessionTwo,'other user own session');
 if(otherEnvelope[2].binding_context_id!==otherGoal.id||Number(otherEnvelope[2].numeric_value)!==3)throw new Error('The other user must see exactly their own bound Goal');
 await rejectsWith(V2_SQL,/Unknown or cross-user conversation session/,[two,sessionMain],'other user reading the first user session');
 await rejectsWith(V2_SQL,/owner-exact/,[one,sessionTwo],'other user impersonating the first user');
 await client.query('RESET ROLE');await identity(one);
 const stillOwn=await assertParity(one,sessionMain,'own session after cross-user probes');
 if(stillOwn[2].binding_context_id!==goalA.id||stillOwn[2].binding_context_id===otherGoal.id)throw new Error("One user's Goal answer must never reflect another user's Goal");
 if(Number(stillOwn[2].numeric_value)!==1)throw new Error("One user's value must never reflect another user's measurement");
 await rejects(SET_BINDING_SQL,[one,sessionMain,'GOAL',otherGoal.id],"binding another user's Goal");
 // A session bound to nothing still answers with the full three-row envelope:
 // absence is a complete answer, never a shorter one.
 const emptyEnvelope=await assertParity(one,sessionEmpty,'unbound session');
 if(emptyEnvelope[0].binding_state!=='NO_ACTIVE_SITUATION'||emptyEnvelope[1].binding_state!=='NO_ACTIVE_DECISION'||emptyEnvelope[2].binding_state!=='NO_ACTIVE_GOAL')throw new Error('An unbound session must still report all three deterministic unbound states');
 // --- 16: the reads are non-mutating and deterministic -----------------------
 await client.query('RESET ROLE');
 const before=await measurementState();
 await identity(one);
 await readV2Envelope(one,sessionMain);
 await readV2Envelope(one,sessionEmpty);
 await readGoalOne(one,sessionMain);
 await client.query('RESET ROLE');await identity(two);
 await readV2Envelope(two,sessionTwo);
 await client.query('RESET ROLE');
 const after=await measurementState();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Goal-motivation and aggregate-v2 reads must write no measurement, relevance, or model-binding state');
 await identity(one);
 const repeat=await readV2Envelope(one,sessionMain);
 for(const[index,row]of repeat.entries())for(const column of['foreground_slot_order','foreground_slot',...NESTED_COLUMNS])if(normalize(row[column])!==normalize(stillOwn[index][column]))throw new Error(`Aggregate v2 reads must be deterministic across repeated calls: ${SLOTS[index][1]}.${column}`);
 // --- 17: the frozen aggregate v1 still behaves exactly as 0058 shipped it ---
 // Called DIRECTLY, outside v2, the migration-0058 aggregate still answers with
 // exactly its own two rows and carries no third slot: QHIA-010 versioned the
 // transport, it did not reopen the proven one.
 const directV1=await readV1Envelope(one,sessionMain);
 if(directV1.some(row=>row.foreground_slot==='GOAL_MOTIVATION'))throw new Error('The frozen aggregate v1 must never gain the third slot');
 if(directV1[0].binding_state!=='NO_ACTIVE_SITUATION'||directV1[1].binding_state!=='ACTIVE_DECISION_BOUND')throw new Error('The frozen aggregate v1 must keep its exact unchanged behaviour');
 const directGoal=await readGoalOne(one,sessionMain);
 if('foreground_slot'in directGoal)throw new Error('The aggregate transport discriminator must never leak into the direct Goal authority contract');
 await client.query('RESET ROLE');
 await client.query('ROLLBACK');
 // --- 18: complete fixture rollback ------------------------------------------
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_observations WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])) total',[[one,two]])).rows[0].total);
 if(residue!==0)throw new Error('Goal-motivation verifier fixtures must roll back completely');
 const modelResidue=Number((await client.query("SELECT (SELECT count(*) FROM public.him_calculation_models WHERE id::text LIKE '59000000-%')+(SELECT count(*) FROM public.him_governance_approvals WHERE id::text LIKE '59000000-%')+(SELECT count(*) FROM public.him_canonical_model_bindings WHERE id::text LIKE '59000000-%') total")).rows[0].total);
 if(modelResidue!==0)throw new Error('The binding-transition fixtures must roll back completely');
 if((await client.query("SELECT status FROM public.him_canonical_model_bindings WHERE metric_key='hse.motivation' AND definition_version=1 AND context_kind='GOAL' AND binding_version=1")).rows[0].status!=='ACTIVE')throw new Error('The canonical Goal motivation binding must remain ACTIVE after fixture rollback');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Goal Motivation Foreground Consumption v1 (QHIA-010): the direct Goal-motivation authority exists with the exact intended two-parameter signature as a read-only STABLE function that holds no privilege of its own (not SECURITY DEFINER), is postgres-owned, pins a fixed safe search_path, contains no dynamic SQL, reconstructs no JWT, and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role); its INSTALLED definition delegates relevance to read_him_session_context_bindings_v1 and current intelligence to read_him_contextual_current_intelligence_batch_v1 while referencing no binding, ownership, definition, or measurement substrate, no canonical-latest or ACTIVE-binding resolver, no auth.uid(), no sibling foreground authority, and no context kind or metric other than GOAL and hse.motivation - the SITUATION context of that same metric included in the proven absences; unauthenticated, anon, service_role, wrong-user, cross-user, unknown-session, inactive-session and wrong-kind-target calls fail closed through the composed authorities; a session with no ACTIVE GOAL binding returns exactly one deterministic NO_ACTIVE_GOAL row with every metric column null even while an owned measured KNOWN Goal exists and even while a KNOWN Situation-bound Motivation is independently readable on the very same session, and no Situation, Decision, or Relationship binding ever substitutes for it; an ACTIVE binding returns exactly one ACTIVE_GOAL_BOUND row whose identity, definition metadata, HSE / RESOLVED / STATE semantics, value, temporal, canonical-binding and ACTIVE-binding facts equal both the direct QHIA-004 batch authority and the direct canonical-latest authority, with the ACTIVE binding identity equal to the existing migration-0050 resolver; replacement follows the current ACTIVE binding, a bound-but-unmeasured Goal stays BOUND with has_canonical_current_value=false and every source field null, a retired binding is never consumed, and re-binding restores the authoritative answer; the migration-0058 aggregate v1 remains installed, authenticated-only, independently callable and byte-unchanged in behaviour - still exactly two rows in the frozen 1/SITUATION_STRESS + 2/DECISION_ATTENTION contract, never gaining a third slot; the aggregate v2 exists with the same hardened posture, exactly one SQL statement, and a fixed three-row envelope 1/SITUATION_STRESS 2/DECISION_ATTENTION 3/GOAL_MOTIVATION with no duplicate, missing, unknown, or extra slot, wrapping exactly the frozen v1 aggregate and the direct Goal authority while calling neither per-channel authority, neither lower QHIA-006/QHIA-004 authority, and no protected HIM substrate; for every constructed state - all three unbound, Situation-only, Situation+Decision+Relationship without a Goal, Goal-only, Goal+Situation, Goal+Decision, all three bound and KNOWN with independent per-channel values, Goal replaced and unmeasured, Goal cleared and re-bound, and under a protected migration-0050 ACTIVE measurement-binding transition carried through verbatim without disturbing the SITUATION context of the same metric or the other channels - v2 rows 1 and 2 equal the aggregate-v1 payloads and v2 row 3 equals the direct Goal payload fact for fact; another user\'s Goal, session, and measurement can never leak in either direction; repeated reads are deterministic and write no measurement, relevance, or model-binding state; and every fixture, including the binding transition, rolls back completely.');
