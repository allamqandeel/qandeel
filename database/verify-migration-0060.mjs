// Real-PostgreSQL verifier for migration 0060 - HIM Relationship Communication
// Foreground Consumption v1 (QHIA-011). Proves, on actual returned rows and the
// INSTALLED function definitions:
//
//   * the direct Relationship-Communication authority exists with the exact
//     narrow two-parameter signature; it is a read-only STABLE function that
//     holds NO privilege of its own (not SECURITY DEFINER), pins a fixed safe
//     search_path, is postgres-owned, uses no dynamic SQL, reconstructs no JWT,
//     and grants EXECUTE to authenticated only; its installed definition
//     DELEGATES relevance to the QHIA-006 authority and current intelligence to
//     the QHIA-004 authority while referencing no binding, ownership,
//     definition, or measurement substrate, no canonical-latest or
//     ACTIVE-binding resolver, no auth.uid(), no sibling foreground authority,
//     no aggregate, and no context kind or metric other than RELATIONSHIP and
//     hrs.communication - the three sibling HRS metrics of that same context
//     explicitly included in the proven absences, which is what keeps
//     Relationship Trust, Repair and Emotional Safety dormant;
//   * unauthenticated, anon, service_role, wrong-user, cross-user-session,
//     unknown-session, inactive-session and wrong-kind-target calls all fail
//     closed through the composed authorities;
//   * a session with no ACTIVE RELATIONSHIP binding returns exactly one
//     deterministic NO_ACTIVE_RELATIONSHIP row with every metric column null
//     even while an owned, measured, KNOWN Relationship exists;
//   * a bound Relationship returns exactly one ACTIVE_RELATIONSHIP_BOUND row
//     whose identity, value, temporal, canonical- and ACTIVE-binding facts
//     equal BOTH the direct QHIA-004 batch row and the direct canonical-latest
//     authority, and whose persisted semantic identity is still exactly
//     HRS / UNRESOLVED / NULL - the expected canonical mapping this task
//     consumes and never resolves;
//   * sibling isolation: Relationship Trust, Repair and Emotional Safety may be
//     KNOWN on the very relationship whose Communication is unmeasured, and
//     none of them ever substitutes for, populates, or averages into the
//     Communication answer;
//   * cross-relationship isolation: a KNOWN Communication on Relationship A
//     never reaches a session bound to Relationship B;
//   * replacement follows the current ACTIVE binding; a bound-but-unmeasured
//     Relationship stays BOUND with has_canonical_current_value=false; a
//     retired binding is never consumed; another user's Relationship can never
//     leak;
//   * the migration-0058 aggregate v1 and the migration-0059 aggregate v2
//     remain installed, authenticated-only, independently callable, and
//     unchanged - still exactly the frozen two-slot and three-slot contracts;
//   * the aggregate v3 exists with the exact narrow two-parameter signature,
//     the same hardened posture, a single SQL statement, and a fixed four-row
//     envelope 1/SITUATION_STRESS 2/DECISION_ATTENTION 3/GOAL_MOTIVATION
//     4/RELATIONSHIP_COMMUNICATION with no fifth slot and no caller-selected
//     selector;
//   * v3 WRAPS exactly the v2 aggregate and the direct Relationship authority,
//     calling neither QHIA-006 nor QHIA-004 nor any per-channel 0056/0057/0059
//     authority nor the v1 aggregate directly, and reading no protected HIM
//     substrate;
//   * for the same session and snapshot, v3 rows 1-3 equal the aggregate-v2
//     payloads fact for fact and v3 row 4 equals the direct
//     Relationship-Communication payload fact for fact - across all-unbound,
//     Relationship-only, Relationship+Situation, Relationship+Decision,
//     Relationship+Goal, all-four-bound, KNOWN, UNKNOWN, replacement, cleared
//     and incompatible-ACTIVE-measurement-binding states;
//   * repeated reads are deterministic and write nothing; and every fixture
//     rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionInactive=randomUUID(),sessionTwo=randomUUID();
const RELATIONSHIP_FN='public.read_him_session_relationship_communication_v1(uuid,uuid)';
const V1_FN='public.read_him_session_cross_context_foreground_v1(uuid,uuid)';
const V2_FN='public.read_him_session_cross_context_foreground_v2(uuid,uuid)';
const V3_FN='public.read_him_session_cross_context_foreground_v3(uuid,uuid)';
const RELATIONSHIP_SQL='SELECT * FROM public.read_him_session_relationship_communication_v1($1,$2)';
const V1_SQL='SELECT * FROM public.read_him_session_cross_context_foreground_v1($1,$2)';
const V2_SQL='SELECT * FROM public.read_him_session_cross_context_foreground_v2($1,$2)';
const V3_SQL='SELECT * FROM public.read_him_session_cross_context_foreground_v3($1,$2)';
const SET_BINDING_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_BINDING_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
const BATCH_SQL='SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
// The nested authority row shape, verbatim. Every one of these columns must be
// carried through both the direct authority and the aggregate unchanged; an
// unbound answer must carry null in every one of them except binding_state.
const NESTED_COLUMNS=['binding_state','binding_context_id','slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id'];
const METRIC_COLUMNS=NESTED_COLUMNS.filter(column=>column!=='binding_state');
// The frozen v3 transport envelope. Transport order only - never a priority.
const SLOTS=[[1,'SITUATION_STRESS'],[2,'DECISION_ATTENTION'],[3,'GOAL_MOTIVATION'],[4,'RELATIONSHIP_COMMUNICATION']];
const V2_SLOT_COUNT=SLOTS.length-1;
const V1_SLOT_COUNT=SLOTS.length-2;
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
const readRelationshipOne=async(userId,sessionId)=>{const rows=(await client.query(RELATIONSHIP_SQL,[userId,sessionId])).rows;if(rows.length!==1)throw new Error(`The Relationship-communication authority must always return exactly one row, got ${rows.length}`);return rows[0];};
// Every successful aggregate-v1 read must still be exactly the frozen two-row
// envelope migration 0058 installed, and every successful aggregate-v2 read
// exactly the frozen three-row envelope migration 0059 installed: QHIA-011
// versions the transport, it does not mutate the proven ones.
const readFrozenEnvelope=async(sql,userId,sessionId,slotCount,label)=>{
 const rows=(await client.query(sql,[userId,sessionId])).rows;
 if(rows.length!==slotCount)throw new Error(`The frozen aggregate ${label} must still return exactly ${slotCount} rows, got ${rows.length}`);
 rows.forEach((row,index)=>{
  const[order,slot]=SLOTS[index];
  if(Number(row.foreground_slot_order)!==order||row.foreground_slot!==slot)throw new Error(`The frozen aggregate ${label} row ${index+1} must still carry ${order}/${slot}`);
  if(Object.keys(row).length!==NESTED_COLUMNS.length+2)throw new Error(`The frozen aggregate ${label} row ${index+1} shape changed`);
 });
 return rows;
};
// Every successful aggregate-v3 read must be exactly the frozen four-row
// envelope, in exactly the frozen transport order, with no duplicate, missing,
// unknown, or extra slot - checked on every single read this verifier performs.
const readV3Envelope=async(userId,sessionId)=>{
 const rows=(await client.query(V3_SQL,[userId,sessionId])).rows;
 if(rows.length!==SLOTS.length)throw new Error(`The aggregate v3 must always return exactly four rows, got ${rows.length}`);
 rows.forEach((row,index)=>{
  const[order,slot]=SLOTS[index];
  if(Number(row.foreground_slot_order)!==order)throw new Error(`Aggregate v3 row ${index+1} must carry transport order ${order}, got ${row.foreground_slot_order}`);
  if(row.foreground_slot!==slot)throw new Error(`Aggregate v3 row ${index+1} must carry slot ${slot}, got ${row.foreground_slot}`);
  for(const column of NESTED_COLUMNS)if(!(column in row))throw new Error(`Aggregate v3 row ${index+1} must preserve the nested authority column ${column}`);
  if(Object.keys(row).length!==NESTED_COLUMNS.length+2)throw new Error(`Aggregate v3 row ${index+1} must add exactly the two outer transport fields, got ${Object.keys(row).length} columns`);
 });
 if(new Set(rows.map(row=>row.foreground_slot)).size!==SLOTS.length)throw new Error('The aggregate v3 envelope must carry no duplicate slot');
 return rows;
};
// The core QHIA-011 layering claim: v3 rows 1-3 ARE the frozen aggregate-v2
// payloads and v3 row 4 IS the direct Relationship-Communication payload.
// Nothing is recomputed, defaulted, coalesced, or reinterpreted on the way
// through, so this runs on every state the verifier constructs.
const assertParity=async(userId,sessionId,label)=>{
 const envelope=await readV3Envelope(userId,sessionId);
 const aggregateV2=await readFrozenEnvelope(V2_SQL,userId,sessionId,V2_SLOT_COUNT,'v2');
 const aggregateV1=await readFrozenEnvelope(V1_SQL,userId,sessionId,V1_SLOT_COUNT,'v1');
 const relationship=(await client.query(RELATIONSHIP_SQL,[userId,sessionId])).rows;
 if(relationship.length!==1)throw new Error(`Fixture invariant: the direct Relationship authority must answer with exactly one row (${label})`);
 for(const[index,direct]of aggregateV2.entries()){
  if(normalize(envelope[index].foreground_slot_order)!==normalize(direct.foreground_slot_order)||envelope[index].foreground_slot!==direct.foreground_slot)throw new Error(`Aggregate v3 slot ${SLOTS[index][1]} must carry the frozen v2 transport discriminator verbatim (${label})`);
  for(const column of NESTED_COLUMNS){
   if(normalize(envelope[index][column])!==normalize(direct[column]))throw new Error(`Aggregate v3 slot ${SLOTS[index][1]} must equal the aggregate-v2 payload verbatim (${label}): ${column} was ${envelope[index][column]}, aggregate v2 says ${direct[column]}`);
  }
 }
 // The proven v2 aggregate still equals the proven v1 aggregate on its own two
 // frozen slots, so the layering claim reaches all the way down.
 for(const[index,direct]of aggregateV1.entries()){
  for(const column of NESTED_COLUMNS){
   if(normalize(aggregateV2[index][column])!==normalize(direct[column]))throw new Error(`Aggregate v2 slot ${SLOTS[index][1]} must still equal the aggregate-v1 payload verbatim (${label}): ${column}`);
  }
 }
 for(const column of NESTED_COLUMNS){
  if(normalize(envelope[3][column])!==normalize(relationship[0][column]))throw new Error(`Aggregate v3 slot RELATIONSHIP_COMMUNICATION must equal the direct Relationship authority payload verbatim (${label}): ${column} was ${envelope[3][column]}, the direct authority says ${relationship[0][column]}`);
 }
 if(Object.keys(relationship[0]).length!==NESTED_COLUMNS.length)throw new Error(`Fixture invariant: the direct Relationship authority row shape changed (${label})`);
 return envelope;
};
const measurementState=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results,(SELECT count(*)::int FROM public.him_measurement_targets) targets,(SELECT count(*)::int FROM public.him_session_context_bindings) bindings,(SELECT count(*)::int FROM public.him_session_context_bindings WHERE status=\'ACTIVE\') active_bindings,(SELECT count(*)::int FROM public.him_canonical_model_bindings WHERE status=\'ACTIVE\') active_model_bindings')).rows[0];
await client.connect();try{
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$5,'ACTIVE','TEXT'),($2,$5,'ACTIVE','TEXT'),($3,$5,'CLOSED','TEXT'),($4,$6,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionInactive,sessionTwo,one,two]);
 await client.query('BEGIN');
 // --- 1: the direct Relationship-Communication authority's installed facts ---
 if((await client.query('SELECT to_regprocedure($1) reg',[RELATIONSHIP_FN])).rows[0].reg===null)throw new Error('The Relationship-communication authority must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_relationship_communication_v1'")).rows[0].n)!==1)throw new Error('Exactly one Relationship-communication authority may exist: no overload may accept a context kind, context id, metric, relationship label, or target');
 const relationshipProps=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[RELATIONSHIP_FN])).rows[0];
 if(relationshipProps.prosecdef)throw new Error('The Relationship-communication authority must hold no privilege of its own: every privileged read belongs to the composed authorities');
 if(relationshipProps.provolatile!=='s')throw new Error('The Relationship-communication authority must be STABLE');
 if(relationshipProps.pronargs!==2)throw new Error('The Relationship-communication callable surface must accept exactly the authenticated user and the exact owned session');
 if(relationshipProps.owner!=='postgres')throw new Error('The Relationship-communication authority must be owned by postgres');
 if(!(relationshipProps.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The Relationship-communication authority must pin a fixed safe search_path');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(relationshipProps.definition))throw new Error('The Relationship-communication authority must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(relationshipProps.definition))throw new Error('The Relationship-communication authority must not reconstruct or write request identity state');
 if(!relationshipProps.definition.includes('public.read_him_session_context_bindings_v1('))throw new Error('The installed Relationship-communication authority must resolve relevance through the QHIA-006 authority');
 if(!relationshipProps.definition.includes('public.read_him_contextual_current_intelligence_batch_v1('))throw new Error('The installed Relationship-communication authority must resolve current intelligence through the QHIA-004 authority');
 if(!relationshipProps.definition.includes("'RELATIONSHIP'")||!relationshipProps.definition.includes("'hrs.communication'"))throw new Error('The installed Relationship-communication authority must pin exactly RELATIONSHIP and hrs.communication');
 for(const forbidden of['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_goal_motivation_v1','public.read_him_session_cross_context_foreground_v1','public.read_him_session_cross_context_foreground_v2','auth.uid'])if(relationshipProps.definition.includes(forbidden))throw new Error(`The installed Relationship-communication authority must compose, never reimplement or widen: found ${forbidden}`);
 // The three sibling HRS metrics share this very context kind. Their absence
 // from the installed definition is what keeps Relationship Trust, Repair and
 // Emotional Safety dormant under a Communication-only activation.
 for(const forbidden of["'SITUATION'","'DECISION'","'GOAL'","'CONVERSATION_SESSION'","'GLOBAL'",'hrs.relationship-trust','hrs.repair','hrs.emotional-safety','hse.','hbs.','hgs.'])if(relationshipProps.definition.includes(forbidden))throw new Error(`QHIA-011 activates exactly RELATIONSHIP + hrs.communication@1: found ${forbidden}`);
 // No Foundation semantic mapping is invented or resolved by this task.
 for(const forbidden of["'COMMUNICATION'","'STATE'","'TRAIT'","'CAPABILITY'","'READINESS'","'LOAD'","'PROGRESS'","'ALIGNMENT'","'UNCERTAINTY'","'SAFETY'","'RESOLVED'"])if(relationshipProps.definition.includes(forbidden))throw new Error(`QHIA-011 invents no Foundation semantic mapping: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(relationshipProps.definition))throw new Error('The installed Relationship-communication authority must be read-only');
 const relationshipAcl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[RELATIONSHIP_FN])).rows[0];
 if(relationshipAcl.pub||relationshipAcl.anon||relationshipAcl.service_role||!relationshipAcl.authenticated)throw new Error('Relationship-communication EXECUTE authority must be authenticated-only');
 // --- 2: the aggregate v3 installed facts ------------------------------------
 if((await client.query('SELECT to_regprocedure($1) reg',[V3_FN])).rows[0].reg===null)throw new Error('The cross-context aggregate v3 must exist with the exact intended two-parameter signature');
 if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='read_him_session_cross_context_foreground_v3'")).rows[0].n)!==1)throw new Error('Exactly one cross-context aggregate v3 may exist: no overload may accept a context kind, context id, target, metric, or slot list');
 const v3Props=(await client.query("SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,p.prosrc,l.lanname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=$1::regprocedure",[V3_FN])).rows[0];
 if(v3Props.prosecdef)throw new Error('The aggregate v3 must hold no privilege of its own: every privileged read belongs to the wrapped authorities');
 if(v3Props.provolatile!=='s')throw new Error('The aggregate v3 must be STABLE');
 if(v3Props.pronargs!==2)throw new Error('The aggregate v3 callable surface must accept exactly the authenticated user and the exact owned session');
 if(v3Props.owner!=='postgres')throw new Error('The aggregate v3 must be owned by postgres');
 if(!(v3Props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('The aggregate v3 must pin a fixed safe search_path');
 // ONE SQL statement, structurally: a plain SQL body with no statement
 // separator at all, so both wrapped authorities necessarily execute inside the
 // same statement and therefore the same snapshot.
 if(v3Props.lanname!=='sql')throw new Error('The aggregate v3 must be a plain SQL function so its wrapped authorities share one statement and one snapshot');
 if(v3Props.prosrc.includes(';'))throw new Error('The aggregate v3 body must be exactly one statement');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(v3Props.definition))throw new Error('The aggregate v3 must contain no dynamic SQL');
 if(/set_config|request\.jwt/.test(v3Props.definition))throw new Error('The aggregate v3 must not reconstruct or write request identity state');
 if(!v3Props.definition.includes('public.read_him_session_cross_context_foreground_v2('))throw new Error('The installed aggregate v3 must wrap the frozen QHIA-010 aggregate v2');
 if(!v3Props.definition.includes('public.read_him_session_relationship_communication_v1('))throw new Error('The installed aggregate v3 must wrap the QHIA-011 Relationship-communication authority');
 if(!v3Props.definition.includes("'RELATIONSHIP_COMMUNICATION'"))throw new Error('The installed aggregate v3 must label the one new frozen transport slot');
 if((v3Props.definition.match(/UNION ALL/g)??[]).length!==1)throw new Error('The installed aggregate v3 envelope must extend the frozen v2 aggregate with exactly one new slot');
 // v3 EXTENDS the proven aggregate; it never reopens it. The per-channel
 // 0056/0057/0059 authorities, the frozen v1 aggregate, and the lower
 // QHIA-006/QHIA-004 authorities stay exactly where they already are.
 for(const forbidden of['public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_goal_motivation_v1','public.read_him_session_cross_context_foreground_v1','public.read_him_session_context_bindings_v1','public.read_him_contextual_current_intelligence_batch_v1','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','auth.uid'])if(v3Props.definition.includes(forbidden))throw new Error(`The installed aggregate v3 must wrap the proven v2 aggregate and the Relationship authority, never reimplement or widen: found ${forbidden}`);
 for(const forbidden of["'SITUATION'","'DECISION'","'GOAL'","'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'hse.','hbs.','hrs.','hgs.'])if(v3Props.definition.includes(forbidden))throw new Error(`The aggregate v3 activates no metric and no context kind: found ${forbidden}`);
 for(const forbidden of['p_context_kind','p_context_id','p_target','p_metric_key','p_metric_keys','p_definition_version','p_slot','p_foreground_slot'])if(v3Props.definition.includes(forbidden))throw new Error(`The aggregate v3 accepts no caller-selected context, target, metric, or slot: found ${forbidden}`);
 if(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+/i.test(v3Props.definition))throw new Error('The installed aggregate v3 must be read-only');
 const v3Acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[V3_FN])).rows[0];
 if(v3Acl.pub||v3Acl.anon||v3Acl.service_role||!v3Acl.authenticated)throw new Error('Aggregate v3 EXECUTE authority must be authenticated-only');
 // --- 3: the frozen aggregates v1 and v2 are preserved, not mutated ----------
 if((await client.query('SELECT to_regprocedure($1) reg',[V1_FN])).rows[0].reg===null)throw new Error('The QHIA-009 aggregate v1 must remain installed and independently callable after QHIA-011');
 if((await client.query('SELECT to_regprocedure($1) reg',[V2_FN])).rows[0].reg===null)throw new Error('The QHIA-010 aggregate v2 must remain installed and independently callable after QHIA-011');
 const v1Props=(await client.query('SELECT p.pronargs,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[V1_FN])).rows[0];
 if(v1Props.pronargs!==2)throw new Error('The frozen aggregate v1 callable surface must be unchanged');
 if(!v1Props.definition.includes("'SITUATION_STRESS'")||!v1Props.definition.includes("'DECISION_ATTENTION'"))throw new Error('The frozen aggregate v1 must keep its exact two-slot contract');
 if(v1Props.definition.includes("'GOAL_MOTIVATION'")||v1Props.definition.includes("'RELATIONSHIP_COMMUNICATION'")||v1Props.definition.includes('public.read_him_session_relationship_communication_v1'))throw new Error('The frozen aggregate v1 must remain a two-slot contract: the later slots belong to v2 and v3 only');
 const v2Props=(await client.query('SELECT p.pronargs,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[V2_FN])).rows[0];
 if(v2Props.pronargs!==2)throw new Error('The frozen aggregate v2 callable surface must be unchanged');
 if(!v2Props.definition.includes("'GOAL_MOTIVATION'")||!v2Props.definition.includes('public.read_him_session_cross_context_foreground_v1('))throw new Error('The frozen aggregate v2 must keep its exact three-slot contract');
 if(v2Props.definition.includes("'RELATIONSHIP_COMMUNICATION'")||v2Props.definition.includes('public.read_him_session_relationship_communication_v1'))throw new Error('The frozen aggregate v2 must remain a three-slot contract: the fourth slot belongs to v3 only');
 if((v2Props.definition.match(/UNION ALL/g)??[]).length!==1)throw new Error('The frozen aggregate v2 envelope must still contain exactly its three slots');
 for(const[fn,label]of[[V1_FN,'v1'],[V2_FN,'v2']]){
  const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[fn])).rows[0];
  if(acl.pub||acl.anon||acl.service_role||!acl.authenticated)throw new Error(`The frozen aggregate ${label} must keep its unchanged authenticated-only EXECUTE authority`);
 }
 // The three per-channel authorities the wrapped aggregates own are untouched.
 for(const wrapped of['public.read_him_session_situation_stress_v1(uuid,uuid)','public.read_him_session_decision_attention_v1(uuid,uuid)','public.read_him_session_goal_motivation_v1(uuid,uuid)']){
  if((await client.query('SELECT to_regprocedure($1) reg',[wrapped])).rows[0].reg===null)throw new Error(`${wrapped} must remain installed and independently callable after QHIA-011`);
 }
 // --- 4: unauthenticated, anon, service_role ---------------------------------
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(RELATIONSHIP_SQL,/Authentication required/,[one,sessionMain],'unauthenticated Relationship read');
 await rejectsWith(V3_SQL,/Authentication required/,[one,sessionMain],'unauthenticated aggregate v3 read');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(RELATIONSHIP_SQL,[one,sessionMain],'anon Relationship EXECUTE');
 await rejects(V3_SQL,[one,sessionMain],'anon aggregate v3 EXECUTE');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE service_role');
 await rejects(RELATIONSHIP_SQL,[one,sessionMain],'service_role Relationship EXECUTE');
 await rejects(V3_SQL,[one,sessionMain],'service_role aggregate v3 EXECUTE');
 await client.query('RESET ROLE');
 // --- Owned fixtures on the canonical substrates only ------------------------
 await identity(one);
 const relationshipA=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-011 relationship A')")).rows[0];
 const relationshipB=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-011 relationship B')")).rows[0];
 const relationshipUnbound=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-011 relationship never bound')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_stress_measurement_context('verifier qhia-011 situation')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','verifier qhia-011 decision')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-011 goal')")).rows[0];
 // VERY_LOW (ordinal 1) is deliberately one of the two values QHIA-011 acts on,
 // so the delegated value proven here is the dangerous one, not a neutral one.
 const communicationObservation=(await client.query("SELECT * FROM public.create_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[relationshipA.id])).rows[0];
 const communicationSnapshot=(await client.query('SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[communicationObservation.id])).rows[0];
 if(!communicationSnapshot?.id||Number(communicationSnapshot.numeric_value)!==1)throw new Error('Fixture invariant: the canonical Relationship communication row must exist with the VERY_LOW ordinal');
 // An owned, measured Relationship that is NEVER bound. Its value differs, so a
 // relevance leak would be detectable rather than invisible.
 const unboundObservation=(await client.query("SELECT * FROM public.create_hrs_communication_measurement_v1($1,'VERY_HIGH',NULL)",[relationshipUnbound.id])).rows[0];
 const unboundSnapshot=(await client.query('SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[unboundObservation.id])).rows[0];
 if(Number(unboundSnapshot?.numeric_value)!==5)throw new Error('Fixture invariant: the never-bound Relationship must be measured with a DIFFERENT value');
 // The three SIBLING HRS metrics, measured on Relationship B, whose
 // Communication is deliberately never measured. Each sibling carries its own
 // distinct value so a substitution would be detectable rather than invisible.
 const trustObservation=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[relationshipB.id])).rows[0];
 const trustSnapshot=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[trustObservation.id])).rows[0];
 const repairObservation=(await client.query("SELECT * FROM public.create_hrs_repair_measurement_v1($1,'LOW',NULL)",[relationshipB.id])).rows[0];
 const repairSnapshot=(await client.query('SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[repairObservation.id])).rows[0];
 const emotionalSafetyObservation=(await client.query("SELECT * FROM public.create_hrs_emotional_safety_measurement_v1($1,'MODERATE',NULL)",[relationshipB.id])).rows[0];
 const emotionalSafetySnapshot=(await client.query('SELECT * FROM public.calculate_hrs_emotional_safety_measurement_v1($1)',[emotionalSafetyObservation.id])).rows[0];
 if(Number(trustSnapshot?.numeric_value)!==1||Number(repairSnapshot?.numeric_value)!==2||Number(emotionalSafetySnapshot?.numeric_value)!==3)throw new Error('Fixture invariant: the three dormant sibling HRS metrics must exist on Relationship B with their own DIFFERENT values');
 // The three other aggregate channels, so v3 parity is proven with real bound
 // Situation, Decision and Goal payloads rather than only with unbound ones.
 const stressObservation=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'HIGH',NULL)",[situationTarget.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[stressObservation.id]);
 const attentionObservation=(await client.query("SELECT * FROM public.create_hse_attention_measurement('DECISION',$1,'LOW',NULL)",[decisionTarget.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_attention_measurement($1)',[attentionObservation.id]);
 const motivationObservation=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationObservation.id]);
 // --- 5: exact authenticated user/session isolation, atomically --------------
 // A cross-user or non-owned call fails as the nested authority's own error;
 // neither the direct authority nor the aggregate adds a fallback, a partial
 // envelope, or a fabricated row.
 for(const[sql,label]of[[RELATIONSHIP_SQL,'Relationship authority'],[V3_SQL,'aggregate v3']]){
  await rejectsWith(sql,/owner-exact/,[two,sessionMain],`${label} wrong p_user_id`);
  await rejectsWith(sql,/Unknown or cross-user conversation session/,[one,sessionTwo],`${label} cross-user session`);
  await rejectsWith(sql,/Unknown or cross-user conversation session/,[one,randomUUID()],`${label} unknown session`);
  await rejectsWith(sql,/Conversation session is not active/,[one,sessionInactive],`${label} inactive session`);
 }
 // --- 6: no ACTIVE Relationship binding => deterministic no-effect result -----
 const allUnbound=await assertParity(one,sessionMain,'all four unbound');
 if(allUnbound[0].binding_state!=='NO_ACTIVE_SITUATION'||allUnbound[1].binding_state!=='NO_ACTIVE_DECISION'||allUnbound[2].binding_state!=='NO_ACTIVE_GOAL'||allUnbound[3].binding_state!=='NO_ACTIVE_RELATIONSHIP')throw new Error('A session with no ACTIVE relevance binding must report all four deterministic unbound states');
 for(const[index,row]of allUnbound.entries())for(const column of METRIC_COLUMNS)if(row[column]!==null)throw new Error(`The unbound ${SLOTS[index][1]} slot must carry null ${column}, got ${row[column]}`);
 // The owned, measured, KNOWN Relationship that was never bound stays INVISIBLE:
 // measurement existence and ownership do not imply conversation relevance.
 if(Number((await client.query(BATCH_SQL,[one,'RELATIONSHIP',relationshipUnbound.id,['hrs.communication'],[1]])).rows[0].numeric_value)!==5)throw new Error('Fixture invariant: the never-bound Relationship is measurable through the QHIA-004 authority');
 // --- 7: only the RELATIONSHIP kind is consumed; other kinds never substitute -
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationTarget.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionTarget.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTarget.id]);
 const otherKinds=await assertParity(one,sessionMain,'Situation + Decision + Goal, no Relationship');
 if(otherKinds[3].binding_state!=='NO_ACTIVE_RELATIONSHIP')throw new Error('No other relevance kind may activate the Relationship slot');
 for(const column of METRIC_COLUMNS)if(otherKinds[3][column]!==null)throw new Error(`A bound Situation, Decision, or Goal must not populate the Relationship slot: ${column}`);
 if(otherKinds[0].binding_state!=='ACTIVE_SITUATION_BOUND'||otherKinds[0].metric_key!=='hse.stress')throw new Error('The Situation slot must still answer with its own delegated hse.stress reading');
 if(otherKinds[1].binding_state!=='ACTIVE_DECISION_BOUND'||Number(otherKinds[1].numeric_value)!==2)throw new Error('The Decision slot must still answer with its own delegated hse.attention reading');
 if(otherKinds[2].binding_state!=='ACTIVE_GOAL_BOUND'||Number(otherKinds[2].numeric_value)!==5)throw new Error('The Goal slot must still answer with its own delegated hse.motivation reading');
 // A wrong-kind target can never be bound as a Relationship at the QHIA-006
 // authority.
 await rejects(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',situationTarget.id],'binding a SITUATION target as the RELATIONSHIP relevance');
 await rejects(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',decisionTarget.id],'binding a DECISION target as the RELATIONSHIP relevance');
 await rejects(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',goalTarget.id],'binding a GOAL target as the RELATIONSHIP relevance');
 // --- 8: an ACTIVE RELATIONSHIP binding is consumed, exactly and only --------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',relationshipA.id]);
 const allBound=await assertParity(one,sessionMain,'all four bound');
 const bound=allBound[3];
 if(bound.binding_state!=='ACTIVE_RELATIONSHIP_BOUND')throw new Error('An ACTIVE Relationship binding must report ACTIVE_RELATIONSHIP_BOUND');
 if(bound.binding_context_id!==relationshipA.id)throw new Error('The Relationship slot must answer for the exact authoritatively bound Relationship');
 if(bound.slot_order!==1||bound.metric_key!=='hrs.communication'||bound.definition_version!==1)throw new Error('Exactly one slot answering for exactly hrs.communication@1 must be returned');
 if(bound.context_kind!=='RELATIONSHIP'||bound.context_id!==relationshipA.id)throw new Error('The delegated read must have used exactly the bound Relationship identity');
 if(bound.has_canonical_current_value!==true)throw new Error('The measured bound Relationship must carry its canonical current value');
 if(Number(bound.numeric_value)!==1)throw new Error('The Relationship slot must carry exactly the delegated hrs.communication@1 VERY_LOW value');
 // The EXPECTED canonical identity of this metric: HRS-owned, semantically
 // UNRESOLVED, with a NULL semantic type. QHIA-011 consumes that identity and
 // never resolves, upgrades, or invents it.
 if(bound.hif_owner!=='HRS')throw new Error('The delegated definition must still be HRS-owned');
 if(bound.semantic_mapping_status!=='UNRESOLVED')throw new Error('The delegated Foundation semantic mapping of hrs.communication@1 must still be UNRESOLVED');
 if(bound.semantic_type!==null)throw new Error('The delegated Foundation semantic type of hrs.communication@1 must still be NULL: no semantic type is invented');
 if(bound.source_semantic_mapping_status!=='UNRESOLVED'||bound.source_semantic_type!==null)throw new Error('The delegated canonical source row must carry the same UNRESOLVED / NULL semantic identity');
 if(bound.calculation_status!=='CALIBRATED')throw new Error('The delegated persisted definition must remain CALIBRATED');
 if(!(bound.valid_context_kinds??[]).includes('RELATIONSHIP'))throw new Error('The delegated persisted definition must remain RELATIONSHIP-eligible');
 // Four independent channels under one transport: never merged, ranked, or
 // reduced to a composite, and an HRS reading is never correlated with an HSE
 // reading.
 for(const index of[0,1,2])if(allBound[index].metric_key===allBound[3].metric_key)throw new Error('The aggregate must not collapse the four channels into one metric');
 if(allBound[0].context_kind!=='SITUATION'||allBound[1].context_kind!=='DECISION'||allBound[2].context_kind!=='GOAL'||allBound[3].context_kind!=='RELATIONSHIP')throw new Error('Each aggregate slot must preserve its own delegated context kind');
 if(allBound[3].hif_owner==='HSE')throw new Error('Fixture invariant: the Relationship channel must be the HRS-owned one');
 for(const index of[0,1,2])if(allBound[index].hif_owner!=='HSE')throw new Error('Fixture invariant: the first three channels must stay HSE-owned so a cross-family leak would be detectable');
 // --- 9: QHIA-004 delegation parity, fact for fact ---------------------------
 const batch=(await client.query(BATCH_SQL,[one,'RELATIONSHIP',relationshipA.id,['hrs.communication'],[1]])).rows[0];
 for(const column of['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','validity_status','confidence_state','confidence_reference','canonical_binding_id','active_binding_id','numeric_value','valid_context_kinds','observed_at','temporal_window_start','temporal_window_end']){
  if(normalize(bound[column])!==normalize(batch[column]))throw new Error(`The Relationship authority must return the QHIA-004 fact verbatim: ${column} was ${bound[column]}, the batch authority says ${batch[column]}`);
 }
 // --- 10: canonical-latest authority stays the value authority ---------------
 const latest=(await client.query(LATEST_SQL,[one,'hrs.communication',1,'RELATIONSHIP',relationshipA.id])).rows[0];
 if(!latest||latest.id!==communicationSnapshot.id)throw new Error('Fixture invariant: the direct canonical latest row must be the calculated Communication row');
 if(bound.source_metric_key!==latest.metric_key||bound.source_definition_version!==latest.definition_version||bound.source_context_kind!==latest.context_kind||bound.source_context_id!==latest.context_id)throw new Error('Relationship source identity must equal the direct canonical latest identity');
 if(bound.value_state!==latest.value_state||Number(bound.numeric_value)!==Number(latest.numeric_value)||bound.validity_status!==latest.validity_status)throw new Error('Relationship value facts must equal the direct canonical latest value facts');
 if(bound.canonical_binding_id!==latest.canonical_binding_id)throw new Error('Relationship source binding identity must equal the direct canonical latest binding identity');
 const resolver=(await client.query("SELECT public.him_active_structured_binding_id('hrs.communication',1,'RELATIONSHIP') id")).rows[0].id;
 if(resolver===null||bound.active_binding_id!==resolver)throw new Error('The Relationship ACTIVE binding identity must equal the existing migration-0050 resolver');
 // --- 11: sibling HRS isolation on the SAME relationship ---------------------
 // Relationship B carries KNOWN Trust, KNOWN Repair and KNOWN Emotional Safety
 // and NO Communication measurement at all. Binding it must leave the
 // Communication answer authoritatively unknown: a sibling never substitutes.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',relationshipB.id]);
 const siblingOnly=await assertParity(one,sessionMain,'Relationship with KNOWN siblings and no Communication');
 if(siblingOnly[3].binding_state!=='ACTIVE_RELATIONSHIP_BOUND'||siblingOnly[3].binding_context_id!==relationshipB.id)throw new Error('The Relationship slot must follow the current ACTIVE Relationship binding');
 if(siblingOnly[3].has_canonical_current_value!==false)throw new Error('A bound Relationship with no Communication measurement must report has_canonical_current_value=false even while its siblings are KNOWN');
 for(const column of['source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id'])if(siblingOnly[3][column]!==null)throw new Error(`A bound-but-unmeasured Relationship must carry null ${column}: bound and known are separate facts`);
 if(siblingOnly[3].metric_key!=='hrs.communication'||siblingOnly[3].definition_version!==1||siblingOnly[3].hif_owner!=='HRS'||siblingOnly[3].semantic_mapping_status!=='UNRESOLVED'||siblingOnly[3].semantic_type!==null)throw new Error('The requested definition metadata must remain present and semantically unresolved on an unmeasured bound Relationship');
 // The dormancy proof is non-vacuous: each sibling really is independently
 // readable and KNOWN on this very relationship, with its own distinct value.
 for(const[metric,expected]of[['hrs.relationship-trust',1],['hrs.repair',2],['hrs.emotional-safety',3]]){
  const sibling=(await client.query(BATCH_SQL,[one,'RELATIONSHIP',relationshipB.id,[metric],[1]])).rows[0];
  if(sibling.has_canonical_current_value!==true||Number(sibling.numeric_value)!==expected)throw new Error(`Fixture invariant: the dormant ${metric} must be independently readable and KNOWN on the bound Relationship`);
  if(Number(siblingOnly[3].numeric_value??-1)===expected)throw new Error(`A sibling HRS metric must never substitute for Communication: ${metric}`);
 }
 // --- 12: cross-relationship isolation ---------------------------------------
 // Communication is KNOWN on Relationship A and unmeasured on Relationship B.
 // The session bound to B must never see A's reading.
 const aStillKnown=(await client.query(BATCH_SQL,[one,'RELATIONSHIP',relationshipA.id,['hrs.communication'],[1]])).rows[0];
 if(aStillKnown.has_canonical_current_value!==true||Number(aStillKnown.numeric_value)!==1)throw new Error('Fixture invariant: Relationship A must still carry its KNOWN Communication reading');
 if(siblingOnly[3].numeric_value!==null||siblingOnly[3].context_id!==relationshipB.id)throw new Error('A KNOWN Communication on another Relationship must never reach a session bound to this one');
 // Re-binding the measured Relationship restores the authoritative answer, so
 // the isolation proved separation rather than a broken read.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',relationshipA.id]);
 const rebound=await assertParity(one,sessionMain,'Relationship re-bound to the measured one');
 if(rebound[3].binding_context_id!==relationshipA.id||Number(rebound[3].numeric_value)!==1)throw new Error('Re-binding the measured Relationship must restore the authoritative answer');
 // The retired binding version is history, never a second candidate. The
 // binding substrate carries zero direct privileges for every request role, so
 // this history-shape assertion is the one place that must step out of the
 // authenticated identity and read as the owner.
 await client.query('RESET ROLE');
 if(Number((await client.query("SELECT count(*)::int n FROM public.him_session_context_bindings WHERE conversation_session_id=$1 AND context_kind='RELATIONSHIP' AND status='RETIRED'",[sessionMain])).rows[0].n)!==2)throw new Error('Fixture invariant: replacement must have retired exactly the two prior Relationship bindings');
 await identity(one);
 // --- 13: Relationship-only, and Relationship + one other channel ------------
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'DECISION']);
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'GOAL']);
 const relationshipOnly=await assertParity(one,sessionMain,'Relationship bound only');
 if(relationshipOnly[0].binding_state!=='NO_ACTIVE_SITUATION'||relationshipOnly[1].binding_state!=='NO_ACTIVE_DECISION'||relationshipOnly[2].binding_state!=='NO_ACTIVE_GOAL')throw new Error('Clearing the other kinds must leave their slots unbound');
 if(relationshipOnly[3].binding_state!=='ACTIVE_RELATIONSHIP_BOUND'||Number(relationshipOnly[3].numeric_value)!==1)throw new Error('A Relationship-only session must still carry the exact delegated Communication reading');
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationTarget.id]);
 const withSituation=await assertParity(one,sessionMain,'Relationship + Situation');
 if(withSituation[0].binding_state!=='ACTIVE_SITUATION_BOUND'||withSituation[1].binding_state!=='NO_ACTIVE_DECISION'||withSituation[2].binding_state!=='NO_ACTIVE_GOAL'||withSituation[3].binding_state!=='ACTIVE_RELATIONSHIP_BOUND')throw new Error('Relationship + Situation must bind exactly those two slots');
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'SITUATION']);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionTarget.id]);
 const withDecision=await assertParity(one,sessionMain,'Relationship + Decision');
 if(withDecision[0].binding_state!=='NO_ACTIVE_SITUATION'||withDecision[1].binding_state!=='ACTIVE_DECISION_BOUND'||withDecision[2].binding_state!=='NO_ACTIVE_GOAL'||withDecision[3].binding_state!=='ACTIVE_RELATIONSHIP_BOUND')throw new Error('Relationship + Decision must bind exactly those two slots');
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'DECISION']);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTarget.id]);
 const withGoal=await assertParity(one,sessionMain,'Relationship + Goal');
 if(withGoal[0].binding_state!=='NO_ACTIVE_SITUATION'||withGoal[1].binding_state!=='NO_ACTIVE_DECISION'||withGoal[2].binding_state!=='ACTIVE_GOAL_BOUND'||withGoal[3].binding_state!=='ACTIVE_RELATIONSHIP_BOUND')throw new Error('Relationship + Goal must bind exactly those two slots');
 // --- 14: a cleared (retired) Relationship binding can never be consumed -----
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'RELATIONSHIP']);
 const cleared=await assertParity(one,sessionMain,'Relationship cleared');
 if(cleared[3].binding_state!=='NO_ACTIVE_RELATIONSHIP')throw new Error('A cleared (retired) Relationship binding must never be consumed');
 for(const column of METRIC_COLUMNS)if(cleared[3][column]!==null)throw new Error(`The cleared Relationship slot must carry null ${column}`);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',relationshipA.id]);
 // --- 15: incompatible ACTIVE measurement binding stays delegated ------------
 // A protected migration-0050 binding transition retires the ACTIVE
 // hrs.communication@1/RELATIONSHIP canonical binding in favour of a compatible
 // successor. The already-calculated snapshot keeps its historical binding, so
 // the delegated row now reports canonical_binding_id <> active_binding_id -
 // the authoritative "incompatible ACTIVE binding" state. QHIA-011 must carry
 // that state through verbatim and must not repair, hide, or reinterpret it,
 // and it must never fall back to a stale value.
 await client.query('RESET ROLE');
 const model='60000000-0000-4000-8000-000000000002',approval='60000000-0000-4000-8000-000000000003',bindingV2='60000000-0000-4000-8000-000000000004';
 await client.query("INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES($1,'hrs.communication.direct-structured-current-communication-workability',2,'hrs.communication',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT','hrs.communication.workability-5.v1','{\"required\":[\"measurementObservation\",\"relationshipTarget\"]}'::jsonb,'FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','hrs-communication-direct-structured-relationship-bound-v1-qhia011',now(),now())",[model]);
 await client.query("INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES($1,'verifier.qhia011.communication.transition.v2',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hrs.communication.direct-structured-current-communication-workability',2,'[\"HRS_COMMUNICATION_CURRENT_WORKABILITY_OF_IMPORTANT_EXCHANGE\",\"DIRECT_STRUCTURED_REPORT\",\"RELATIONSHIP_BOUND_ONLY\",\"EXPERIENCE_GROUNDED_CURRENT_APPRAISAL_NULL_WINDOW\",\"ORDINAL_WORKABILITY_5\",\"TOPIC_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED\",\"COMMUNICATION_NOT_TRUST_REPAIR_EMOTIONAL_SAFETY_AGREEMENT_OR_SATISFACTION\",\"DETERMINISTIC_CALCULATION\",\"CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY\",\"SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')",[approval]);
 const nextBindingVersion=(await client.query("SELECT max(binding_version)::int+1 v FROM public.him_canonical_model_bindings WHERE metric_key='hrs.communication' AND definition_version=1 AND context_kind='RELATIONSHIP'")).rows[0].v;
 await client.query("INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hrs.communication',1,'RELATIONSHIP',$2,'PENDING','hrs.communication.direct-structured-current-communication-workability',2,'hrs.communication.direct-relationship-bound-communication-workability-report',1,'hrs.communication.workability-5.v1',1,'verifier.qhia011.communication.transition.v2',1,now())",[bindingV2,nextBindingVersion]);
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[bindingV2]);
 await identity(one);
 const transitioned=await assertParity(one,sessionMain,'incompatible ACTIVE measurement binding');
 if(transitioned[3].active_binding_id!==bindingV2)throw new Error('The Relationship slot must follow the transitioned ACTIVE measurement binding');
 if(transitioned[3].canonical_binding_id===null||transitioned[3].canonical_binding_id===transitioned[3].active_binding_id)throw new Error('Fixture invariant: the Relationship slot must now report an incompatible ACTIVE measurement binding');
 if(transitioned[3].has_canonical_current_value!==true||Number(transitioned[3].numeric_value)!==1)throw new Error('The incompatible-binding state must stay an authoritative source fact, never a repaired, hidden, or stale-fallback one');
 // The sibling HRS metrics of the SAME context kind keep their own untouched
 // ACTIVE bindings: one family never means one binding.
 for(const metric of['hrs.relationship-trust','hrs.repair','hrs.emotional-safety']){
  const sibling=(await client.query(BATCH_SQL,[one,'RELATIONSHIP',relationshipB.id,[metric],[1]])).rows[0];
  if(sibling.canonical_binding_id!==sibling.active_binding_id)throw new Error(`A Communication binding transition must never disturb the sibling ${metric}`);
 }
 // The Goal channel is equally untouched: one shared transport never means one
 // shared measurement authority.
 if(transitioned[2].canonical_binding_id!==transitioned[2].active_binding_id||Number(transitioned[2].numeric_value)!==5)throw new Error('A transition on one channel must never disturb another channel');
 // --- 16: another user's Relationship can never leak in either direction -----
 await client.query('RESET ROLE');await identity(two);
 const otherRelationship=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-011 other-user relationship')")).rows[0];
 const otherObservation=(await client.query("SELECT * FROM public.create_hrs_communication_measurement_v1($1,'MODERATE',NULL)",[otherRelationship.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[otherObservation.id]);
 await client.query(SET_BINDING_SQL,[two,sessionTwo,'RELATIONSHIP',otherRelationship.id]);
 const otherEnvelope=await assertParity(two,sessionTwo,'other user own session');
 if(otherEnvelope[3].binding_context_id!==otherRelationship.id||Number(otherEnvelope[3].numeric_value)!==3)throw new Error('The other user must see exactly their own bound Relationship');
 await rejectsWith(V3_SQL,/Unknown or cross-user conversation session/,[two,sessionMain],'other user reading the first user session');
 await rejectsWith(V3_SQL,/owner-exact/,[one,sessionTwo],'other user impersonating the first user');
 await client.query('RESET ROLE');await identity(one);
 const stillOwn=await assertParity(one,sessionMain,'own session after cross-user probes');
 if(stillOwn[3].binding_context_id!==relationshipA.id||stillOwn[3].binding_context_id===otherRelationship.id)throw new Error("One user's Relationship answer must never reflect another user's Relationship");
 if(Number(stillOwn[3].numeric_value)!==1)throw new Error("One user's value must never reflect another user's measurement");
 await rejects(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',otherRelationship.id],"binding another user's Relationship");
 // A session bound to nothing still answers with the full four-row envelope:
 // absence is a complete answer, never a shorter one.
 const emptyEnvelope=await assertParity(one,sessionEmpty,'unbound session');
 if(emptyEnvelope[0].binding_state!=='NO_ACTIVE_SITUATION'||emptyEnvelope[1].binding_state!=='NO_ACTIVE_DECISION'||emptyEnvelope[2].binding_state!=='NO_ACTIVE_GOAL'||emptyEnvelope[3].binding_state!=='NO_ACTIVE_RELATIONSHIP')throw new Error('An unbound session must still report all four deterministic unbound states');
 // --- 17: the reads are non-mutating and deterministic -----------------------
 await client.query('RESET ROLE');
 const before=await measurementState();
 await identity(one);
 await readV3Envelope(one,sessionMain);
 await readV3Envelope(one,sessionEmpty);
 await readRelationshipOne(one,sessionMain);
 await client.query('RESET ROLE');await identity(two);
 await readV3Envelope(two,sessionTwo);
 await client.query('RESET ROLE');
 const after=await measurementState();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Relationship-communication and aggregate-v3 reads must write no measurement, relevance, or model-binding state');
 await identity(one);
 const repeat=await readV3Envelope(one,sessionMain);
 for(const[index,row]of repeat.entries())for(const column of['foreground_slot_order','foreground_slot',...NESTED_COLUMNS])if(normalize(row[column])!==normalize(stillOwn[index][column]))throw new Error(`Aggregate v3 reads must be deterministic across repeated calls: ${SLOTS[index][1]}.${column}`);
 // --- 18: the frozen aggregates still behave exactly as 0058/0059 shipped ----
 // Called DIRECTLY, outside v3, the migration-0058 and migration-0059
 // aggregates still answer with exactly their own rows and carry no later slot:
 // QHIA-011 versioned the transport, it did not reopen the proven ones.
 const directV1=await readFrozenEnvelope(V1_SQL,one,sessionMain,V1_SLOT_COUNT,'v1');
 const directV2=await readFrozenEnvelope(V2_SQL,one,sessionMain,V2_SLOT_COUNT,'v2');
 if(directV1.some(row=>row.foreground_slot==='GOAL_MOTIVATION'||row.foreground_slot==='RELATIONSHIP_COMMUNICATION'))throw new Error('The frozen aggregate v1 must never gain a later slot');
 if(directV2.some(row=>row.foreground_slot==='RELATIONSHIP_COMMUNICATION'))throw new Error('The frozen aggregate v2 must never gain the fourth slot');
 if(directV2[2].binding_state!=='ACTIVE_GOAL_BOUND')throw new Error('The frozen aggregate v2 must keep its exact unchanged behaviour');
 const directRelationship=await readRelationshipOne(one,sessionMain);
 if('foreground_slot'in directRelationship)throw new Error('The aggregate transport discriminator must never leak into the direct Relationship authority contract');
 await client.query('RESET ROLE');
 await client.query('ROLLBACK');
 // --- 19: complete fixture rollback ------------------------------------------
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_observations WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[])) total',[[one,two]])).rows[0].total);
 if(residue!==0)throw new Error('Relationship-communication verifier fixtures must roll back completely');
 const modelResidue=Number((await client.query("SELECT (SELECT count(*) FROM public.him_calculation_models WHERE id::text LIKE '60000000-%')+(SELECT count(*) FROM public.him_governance_approvals WHERE id::text LIKE '60000000-%')+(SELECT count(*) FROM public.him_canonical_model_bindings WHERE id::text LIKE '60000000-%') total")).rows[0].total);
 if(modelResidue!==0)throw new Error('The binding-transition fixtures must roll back completely');
 if((await client.query("SELECT status FROM public.him_canonical_model_bindings WHERE metric_key='hrs.communication' AND definition_version=1 AND context_kind='RELATIONSHIP' AND binding_version=1")).rows[0].status!=='ACTIVE')throw new Error('The canonical Communication binding must remain ACTIVE after fixture rollback');
 const canonicalIdentity=(await client.query("SELECT hif_owner,semantic_mapping_status,semantic_type,calculation_status FROM public.him_metric_definitions WHERE metric_key='hrs.communication' AND definition_version=1")).rows[0];
 if(canonicalIdentity.hif_owner!=='HRS'||canonicalIdentity.semantic_mapping_status!=='UNRESOLVED'||canonicalIdentity.semantic_type!==null||canonicalIdentity.calculation_status!=='CALIBRATED')throw new Error('QHIA-011 must leave the canonical hrs.communication@1 identity exactly HRS / UNRESOLVED / NULL / CALIBRATED');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Relationship Communication Foreground Consumption v1 (QHIA-011): the direct Relationship-communication authority exists with the exact intended two-parameter signature as a read-only STABLE function that holds no privilege of its own (not SECURITY DEFINER), is postgres-owned, pins a fixed safe search_path, contains no dynamic SQL, reconstructs no JWT, and grants EXECUTE to authenticated only (no PUBLIC, anon, or service_role); its INSTALLED definition delegates relevance to read_him_session_context_bindings_v1 and current intelligence to read_him_contextual_current_intelligence_batch_v1 while referencing no binding, ownership, definition, or measurement substrate, no canonical-latest or ACTIVE-binding resolver, no auth.uid(), no sibling foreground authority, no aggregate, no Foundation semantic type, and no context kind or metric other than RELATIONSHIP and hrs.communication - the three sibling HRS metrics of that same context included in the proven absences; unauthenticated, anon, service_role, wrong-user, cross-user, unknown-session, inactive-session and wrong-kind-target calls fail closed through the composed authorities; a session with no ACTIVE RELATIONSHIP binding returns exactly one deterministic NO_ACTIVE_RELATIONSHIP row with every metric column null even while an owned measured KNOWN Relationship exists, and no Situation, Decision, or Goal binding ever substitutes for it; an ACTIVE binding returns exactly one ACTIVE_RELATIONSHIP_BOUND row whose identity, definition metadata, canonical HRS / UNRESOLVED / NULL semantics, value, temporal, canonical-binding and ACTIVE-binding facts equal both the direct QHIA-004 batch authority and the direct canonical-latest authority, with the ACTIVE binding identity equal to the existing migration-0050 resolver; KNOWN Relationship Trust, Repair and Emotional Safety on the very same bound relationship never substitute for, populate, or average into an unmeasured Communication answer, and a KNOWN Communication on another relationship never reaches it either; replacement follows the current ACTIVE binding, a bound-but-unmeasured Relationship stays BOUND with has_canonical_current_value=false and every source field null, a retired binding is never consumed, and re-binding restores the authoritative answer; the migration-0058 aggregate v1 and the migration-0059 aggregate v2 remain installed, authenticated-only, independently callable and unchanged in behaviour - still exactly the frozen two-slot and three-slot contracts, never gaining a later slot; the aggregate v3 exists with the same hardened posture, exactly one SQL statement, and a fixed four-row envelope 1/SITUATION_STRESS 2/DECISION_ATTENTION 3/GOAL_MOTIVATION 4/RELATIONSHIP_COMMUNICATION with no duplicate, missing, unknown, or extra slot, wrapping exactly the frozen v2 aggregate and the direct Relationship authority while calling no per-channel authority, neither lower QHIA-006/QHIA-004 authority, and no protected HIM substrate; for every constructed state - all four unbound, Situation+Decision+Goal without a Relationship, all four bound and KNOWN with independent per-channel values, a bound relationship whose siblings are KNOWN and whose Communication is unmeasured, Relationship-only, Relationship+Situation, Relationship+Decision, Relationship+Goal, Relationship cleared and re-bound, and under a protected migration-0050 ACTIVE measurement-binding transition carried through verbatim without disturbing the sibling HRS metrics or the other channels - v3 rows 1-3 equal the aggregate-v2 payloads, the aggregate-v2 rows 1-2 still equal the aggregate-v1 payloads, and v3 row 4 equals the direct Relationship payload fact for fact; another user\'s Relationship, session, and measurement can never leak in either direction; repeated reads are deterministic and write no measurement, relevance, or model-binding state; every fixture, including the binding transition, rolls back completely; and the canonical hrs.communication@1 definition is left exactly HRS / UNRESOLVED / NULL / CALIBRATED.');
