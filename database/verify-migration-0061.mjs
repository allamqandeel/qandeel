// Real-PostgreSQL verifier for migration 0061 - HIM Background Human
// Intelligence -> Brain Context Bridge v1 (QHIA-012). Proves, on actual returned
// rows and the INSTALLED function definitions:
//
//   * CANONICAL-CORE PARITY. The migration-0052 latest-across-events algorithm
//     was EXTRACTED, not rewritten: the authenticated wrapper keeps its exact
//     signature, safe properties, authenticated-only ACL and every observable
//     semantic - owner-exact denial, unknown exact definition, unsupported
//     context kind, unowned/cross-user context, newest-event chronology,
//     correction chronology inside the newest event, and ZERO older-event
//     fallback when the newest event has no usable current calculated snapshot.
//     The trusted internal core carries those rules and is reachable by NO
//     request role at all - not PUBLIC, anon, authenticated, or service_role -
//     and service_role still cannot call the authenticated wrapper either.
//
//   * BACKGROUND SOURCE. One execution-bound service-role RPC whose ONLY input
//     is the post-response execution ID answers all eight frozen Brain slots in
//     one request. It derives owner/session/source-turn authority from the
//     execution itself, requires canonical v2 + ALLOW + an owned COMPLETED USER
//     source turn, resolves ONLY exact ACTIVE QHIA-006 DECISION/SITUATION/GOAL
//     bindings, returns the frozen registry order, never touches RELATIONSHIP,
//     never falls back to an unbound target, and returns QHIA-004-compatible
//     rows whose facts equal the direct QHIA-004 batch authority fact for fact.
//
//   * MANAGED DURABLE EFFECT. The generic claim path and the generic
//     result-less completion path both reject the Brain effect; the typed
//     managed command creates exactly ONE COMPLETED effect with no CLAIMED row
//     at any instant; a CLAIMED Brain row is structurally unrepresentable; the
//     first durable result is immutable across replay; and a malformed payload,
//     a wrong sourceTurnId, a foreign or wrong-kind context, a ninth signal, a
//     duplicate slot, an out-of-order slot and an out-of-range value are all
//     rejected. NO_HIM_BRAIN_CONTEXT is valid with a null payload, and every
//     durable result survives a reread.
//
//   * FOREGROUND NEXT-TURN SELECTION. The authenticated read consumes ONLY the
//     IMMEDIATELY preceding canonical USER turn by (created_at, id): an
//     intervening FAILED or CANCELLED USER turn ends the read instead of being
//     skipped over, a previous COMPLETED turn with no materialization is absent,
//     a session with no previous USER turn is absent, and an assistant turn, a
//     cross-user turn, a wrong-session turn and a non-GENERATING current turn
//     all fail closed.
//
//   * RELEVANCE REVALIDATION WITHOUT A METRIC REREAD. A materialized signal
//     survives only while its context kind still has an ACTIVE binding pointing
//     at exactly that context: replacement drops it, clearing drops it, another
//     kind survives independently, and re-binding restores it. And the proof is
//     non-vacuous: after the underlying canonical current value is CORRECTED to
//     a different reading, the foreground still returns the ORIGINAL
//     materialized value - so it demonstrably consumed the durable result and
//     reread no metric.
//
//   * Repeated reads are deterministic and write nothing, and every fixture
//     rolls back.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID();
const sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionTwo=randomUUID();
const CORE_FN='public.read_him_latest_measurement_core_v1(uuid,text,integer,text,text)';
const LATEST_FN='public.read_him_latest_measurement_v1(uuid,text,integer,text,text)';
const SOURCE_FN='public.background_read_him_brain_context_source_v1(uuid)';
const COMPLETE_FN='public.complete_post_response_him_brain_context_materialization_v1(uuid,text,jsonb)';
const FOREGROUND_FN='public.read_him_brain_context_for_turn_v1(uuid,uuid,uuid)';
const CORE_SQL='SELECT * FROM public.read_him_latest_measurement_core_v1($1,$2,$3,$4,$5)';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
const SOURCE_SQL='SELECT * FROM public.background_read_him_brain_context_source_v1($1)';
const COMPLETE_SQL='SELECT public.complete_post_response_him_brain_context_materialization_v1($1,$2,$3::jsonb) status';
const FOREGROUND_SQL='SELECT * FROM public.read_him_brain_context_for_turn_v1($1,$2,$3)';
const BATCH_SQL='SELECT * FROM public.read_him_contextual_current_intelligence_batch_v1($1,$2,$3,$4::text[],$5::integer[])';
const SET_BINDING_SQL='SELECT * FROM public.set_him_session_context_binding_v1($1,$2,$3,$4)';
const CLEAR_BINDING_SQL='SELECT * FROM public.clear_him_session_context_binding_v1($1,$2,$3)';
const ACQUIRE_SQL='SELECT * FROM public.acquire_post_response_intelligence_execution_v1($1,$2,$3,$4,$5,$6,$7,$8)';
// The frozen eight-slot Brain Context registry, in exactly this order.
const REGISTRY=[
 [1,'DECISION_SELF_CONFIDENCE','DECISION','hse.self-confidence'],
 [2,'SITUATION_AVOIDANCE_FREQUENCY','SITUATION','hbs.avoidance'],
 [3,'SITUATION_SELF_AWARENESS','SITUATION','hgs.self-awareness'],
 [4,'SITUATION_RESILIENCE','SITUATION','hgs.resilience'],
 [5,'GOAL_CONSISTENCY','GOAL','hbs.consistency'],
 [6,'GOAL_INITIATIVE','GOAL','hbs.initiative'],
 [7,'GOAL_PURPOSE_ALIGNMENT','GOAL','hgs.purpose-alignment'],
 [8,'GOAL_HABIT_STRENGTH','GOAL','hgs.habit-strength']];
// The QHIA-004-compatible source row shape the projection consumes, plus the two
// Brain transport fields.
const SOURCE_COLUMNS=['brain_slot_order','brain_slot','slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id'];
const FOREGROUND_COLUMNS=['slot_order','slot','context_kind','context_id','numeric_value','semantic_mapping_status','semantic_type','freshness_state','confidence_state'];
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const asServiceRole=async()=>{await client.query('RESET ROLE');await client.query("SELECT set_config('request.jwt.claims','',true)");await client.query('SET LOCAL ROLE service_role');};
const rejects=async(sql,params=[],label='')=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${label||sql}`);};
const rejectsWith=async(sql,pattern,params,label)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(sql,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected ${label} rejection ${pattern}, got: ${message||'success'}`);};
const normalize=value=>{
 if(value===null||value===undefined)return'null';
 if(value instanceof Date)return`date:${value.getTime()}`;
 if(Array.isArray(value))return`array:${JSON.stringify(value)}`;
 if(typeof value==='number')return`number:${value}`;
 return`${typeof value}:${String(value)}`;};
const properties=async fn=>(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,p.pronargs,p.proowner::regrole::text owner,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[fn])).rows[0];
const acl=async fn=>(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') pub,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[fn])).rows[0];
const measurementState=async()=>(await client.query("SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results,(SELECT count(*)::int FROM public.him_measurement_targets) targets,(SELECT count(*)::int FROM public.him_session_context_bindings) bindings,(SELECT count(*)::int FROM public.post_response_intelligence_effects) effects")).rows[0];
// The canonical durable payload the managed command accepts.
const payload=(sourceTurnId,signals)=>JSON.stringify({contractVersion:1,source:'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1',sourceTurnId,signals});
const signal=(slotOrder,contextId,overrides={})=>{
 const[,slot,contextKind]=REGISTRY[slotOrder-1];
 const resolved=slotOrder===7;
 return{slotOrder,slot,contextKind,contextId,numericValue:2,semanticMappingStatus:resolved?'RESOLVED':'UNRESOLVED',semanticType:resolved?'ALIGNMENT':null,freshnessState:'UNASSESSED',confidenceState:'UNASSESSED',...overrides};};
const turnAt=async(id,session,user,role,status,seconds)=>{
 await client.query("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'verifier turn',TIMESTAMPTZ '2026-08-29T00:00:00Z'+($6::text||' seconds')::interval,TIMESTAMPTZ '2026-08-29T00:00:00Z'+($6::text||' seconds')::interval)",[id,session,user,role,status,seconds]);
 return id;};

await client.connect();try{
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$4,'ACTIVE','TEXT'),($2,$4,'ACTIVE','TEXT'),($3,$5,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionTwo,one,two]);
 await client.query('BEGIN');

 // --- 1: installed facts, safe properties and exact narrow ACLs --------------
 for(const[fn,label]of[[CORE_FN,'trusted canonical latest core'],[LATEST_FN,'authenticated canonical latest wrapper'],[SOURCE_FN,'background Brain Context source'],[COMPLETE_FN,'managed Brain Context completion'],[FOREGROUND_FN,'foreground Brain Context read']]){
  if((await client.query('SELECT to_regprocedure($1) reg',[fn])).rows[0].reg===null)throw new Error(`The ${label} must exist with its exact intended signature`);
  const p=await properties(fn);
  if(!p.prosecdef)throw new Error(`The ${label} must be SECURITY DEFINER`);
  if(p.owner!=='postgres')throw new Error(`The ${label} must be owned by postgres`);
  if(!(p.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error(`The ${label} must pin a fixed safe search_path`);
  if(/EXECUTE\s+format|EXECUTE\s+'/i.test(p.definition))throw new Error(`The ${label} must contain no dynamic SQL`);
  if(/set_config|request\.jwt/.test(p.definition))throw new Error(`The ${label} must not reconstruct or write request identity state`);
 }
 // The trusted core is reachable by NO request role. That is what makes trusting
 // its caller-supplied identity safe.
 const coreAcl=await acl(CORE_FN);
 if(coreAcl.pub||coreAcl.anon||coreAcl.authenticated||coreAcl.service_role)throw new Error('The trusted canonical latest core must be reachable by no request role');
 // The authenticated wrapper keeps its exact unchanged authenticated-only ACL.
 const latestAcl=await acl(LATEST_FN);
 if(latestAcl.pub||latestAcl.anon||latestAcl.service_role||!latestAcl.authenticated)throw new Error('The authenticated canonical latest wrapper ACL changed');
 for(const[fn,label]of[[SOURCE_FN,'background Brain Context source'],[COMPLETE_FN,'managed Brain Context completion']]){
  const a=await acl(fn);
  if(a.pub||a.anon||a.authenticated||!a.service_role)throw new Error(`The ${label} EXECUTE authority must be service_role-only`);
 }
 const foregroundAcl=await acl(FOREGROUND_FN);
 if(foregroundAcl.pub||foregroundAcl.anon||foregroundAcl.service_role||!foregroundAcl.authenticated)throw new Error('The foreground Brain Context read EXECUTE authority must be authenticated-only');
 // The extraction really is an extraction: the core owns the chronology, the
 // wrapper owns authentication and owner-exactness and delegates everything else.
 const coreDefinition=(await properties(CORE_FN)).definition;
 for(const required of['ORDER BY me.created_at DESC,me.id DESC','ORDER BY mo.created_at DESC,mo.id DESC','him_current_structured_measurements','supersedes_observation_id','valid_context_kinds'])if(!coreDefinition.includes(required))throw new Error(`The trusted core lost the canonical rule ${required}`);
 if(coreDefinition.includes('snapshot_version'))throw new Error('The trusted core must never order across events by snapshot_version');
 if(coreDefinition.includes('auth.uid'))throw new Error('The trusted core must not read request identity: its caller identity is already trusted');
 const wrapperDefinition=(await properties(LATEST_FN)).definition;
 if(!wrapperDefinition.includes('auth.uid()'))throw new Error('The authenticated wrapper must still read auth.uid()');
 if(!wrapperDefinition.includes('public.read_him_latest_measurement_core_v1('))throw new Error('The authenticated wrapper must delegate to the trusted core');
 for(const forbidden of['him_measurement_events','him_measurement_observations','him_current_structured_measurements','him_metric_definitions','snapshot_version'])if(wrapperDefinition.includes(forbidden))throw new Error(`The authenticated wrapper must delegate currentness, never reimplement it: found ${forbidden}`);

 // --- 2: the background source and foreground read installed shapes ----------
 const sourceDefinition=(await properties(SOURCE_FN)).definition;
 if(!sourceDefinition.includes('public.read_him_latest_measurement_core_v1('))throw new Error('The background source must delegate every current value to the trusted core');
 if(!sourceDefinition.includes('public.him_active_structured_binding_id('))throw new Error('The background source must resolve binding identity through the existing ACTIVE-binding resolver');
 for(const[,slot,,metric]of REGISTRY){
  if(!sourceDefinition.includes(`'${slot}'`)||!sourceDefinition.includes(`'${metric}'`))throw new Error(`The background source must pin the exact frozen registry entry ${slot}`);
 }
 for(const forbidden of['hse.stress','hse.attention','hse.motivation','hse.energy','hbs.reflection','hrs.',"'RELATIONSHIP'","'CONVERSATION_SESSION'","'GLOBAL'",'him_measurement_events','him_measurement_observations','him_metric_snapshots','him_current_structured_measurements','snapshot_version','public.read_him_latest_measurement_v1','public.read_him_contextual_current_intelligence_batch_v1','auth.uid'])if(sourceDefinition.includes(forbidden))throw new Error(`The background source must stay a fixed eight-slot delegation: found ${forbidden}`);
 const foregroundDefinition=(await properties(FOREGROUND_FN)).definition;
 if(!foregroundDefinition.includes('(t.created_at,t.id)<(current_turn.created_at,current_turn.id)'))throw new Error('The foreground read must select the predecessor by the deterministic (created_at, id) ordering');
 if(!foregroundDefinition.includes('ORDER BY t.created_at DESC,t.id DESC LIMIT 1'))throw new Error('The foreground read must take exactly the greatest strictly-earlier USER turn');
 if(foregroundDefinition.indexOf("previous_turn.status<>'COMPLETED'")<foregroundDefinition.indexOf('(t.created_at,t.id)<(current_turn.created_at,current_turn.id)'))throw new Error('The foreground read must decide usability AFTER selecting the immediate predecessor');
 if(!foregroundDefinition.includes('public.read_him_session_context_bindings_v1('))throw new Error('The foreground read must revalidate relevance through the QHIA-006 authority');
 for(const forbidden of['him_metric_snapshots','him_measurement_events','him_measurement_observations','him_current_structured_measurements','him_metric_definitions','public.him_measurement_targets','public.him_session_context_bindings','public.read_him_latest_measurement_v1','public.read_him_latest_measurement_core_v1','public.read_him_contextual_current_intelligence_batch_v1','public.him_active_structured_binding_id','OFFSET'])if(foregroundDefinition.includes(forbidden))throw new Error(`The foreground read must consume only the durable materialization and the QHIA-006 authority: found ${forbidden}`);

 // --- 3: role isolation on the new and preserved surfaces --------------------
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(LATEST_SQL,/Authentication required/,[one,'hse.self-confidence',1,'DECISION',randomUUID()],'unauthenticated canonical latest');
 await rejectsWith(FOREGROUND_SQL,/Authentication required/,[one,sessionMain,randomUUID()],'unauthenticated Brain Context read');
 for(const role of['anon','authenticated','service_role']){
  await client.query('RESET ROLE');await client.query(`SET LOCAL ROLE ${role}`);
  await rejects(CORE_SQL,[one,'hse.self-confidence',1,'DECISION',randomUUID()],`${role} reaching the trusted canonical core`);
 }
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE service_role');
 await rejects(LATEST_SQL,[one,'hse.self-confidence',1,'DECISION',randomUUID()],'service_role reaching the authenticated canonical latest wrapper');
 await rejects(FOREGROUND_SQL,[one,sessionMain,randomUUID()],'service_role reaching the authenticated foreground Brain Context read');
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(FOREGROUND_SQL,[one,sessionMain,randomUUID()],'anon reaching the foreground Brain Context read');
 await rejects(SOURCE_SQL,[randomUUID()],'anon reaching the background Brain Context source');
 await client.query('RESET ROLE');await identity(one);
 await rejects(SOURCE_SQL,[randomUUID()],'authenticated reaching the background Brain Context source');
 await rejects(COMPLETE_SQL,[randomUUID(),'NO_HIM_BRAIN_CONTEXT',null],'authenticated reaching the managed Brain Context completion');

 // --- 4: owned canonical fixtures through the existing authorities only ------
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_self_confidence_measurement_context('DECISION','verifier qhia-012 decision')")).rows[0];
 // A SECOND owned DECISION target used only by the canonical-core parity
 // section. It is never bound to the session, so it also proves that an owned
 // but unbound context of a bound KIND never reaches the Brain Context source.
 const parityTarget=(await client.query("SELECT * FROM public.create_him_self_confidence_measurement_context('DECISION','verifier qhia-012 parity')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_stress_measurement_context('verifier qhia-012 situation')")).rows[0];
 const goalTargetA=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-012 goal A')")).rows[0];
 const goalTargetB=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier qhia-012 goal B')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier qhia-012 relationship')")).rows[0];
 const measure=async(create,calculate,params)=>{
  const observation=(await client.query(create,params)).rows[0];
  const snapshot=(await client.query(calculate,[observation.id])).rows[0];
  return{observation,snapshot};};
 const selfConfidence=await measure("SELECT * FROM public.create_hse_self_confidence_measurement('DECISION',$1,'HIGH',NULL)",'SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[decisionTarget.id]);
 const avoidance=await measure("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'OFTEN',NULL)",'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[situationTarget.id]);
 const selfAwareness=await measure("SELECT * FROM public.create_hgs_self_awareness_measurement_v1($1,'LOW',NULL)",'SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[situationTarget.id]);
 const consistency=await measure("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'RARELY',NULL)",'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[goalTargetA.id]);
 const purposeAlignment=await measure("SELECT * FROM public.create_hgs_purpose_alignment_measurement_v1($1,'VERY_HIGH',NULL)",'SELECT * FROM public.calculate_hgs_purpose_alignment_measurement_v1($1)',[goalTargetA.id]);
 // Goal B carries a DIFFERENT Consistency reading, so a relevance leak after a
 // binding replacement would be detectable rather than invisible.
 const consistencyB=await measure("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'ALMOST_ALWAYS',NULL)",'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[goalTargetB.id]);
 if(Number(selfConfidence.snapshot.numeric_value)!==4||Number(avoidance.snapshot.numeric_value)!==4||Number(selfAwareness.snapshot.numeric_value)!==2||Number(consistency.snapshot.numeric_value)!==2||Number(purposeAlignment.snapshot.numeric_value)!==5||Number(consistencyB.snapshot.numeric_value)!==5)throw new Error('Fixture invariant: the canonical structured readings must carry their exact frozen ordinals');

 // --- 5: canonical-core parity through the preserved authenticated wrapper ---
 // Every observable semantic of migration 0052 is unchanged.
 const parity=await measure("SELECT * FROM public.create_hse_self_confidence_measurement('DECISION',$1,'HIGH',NULL)",'SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[parityTarget.id]);
 await rejectsWith(LATEST_SQL,/owner-exact/,[two,'hse.self-confidence',1,'DECISION',parityTarget.id],'wrong p_user_id');
 await rejectsWith(LATEST_SQL,/Unknown exact HIM metric definition/,[one,'hse.self-confidence',9999,'DECISION',parityTarget.id],'unknown exact definition version');
 await rejectsWith(LATEST_SQL,/Unknown exact HIM metric definition/,[one,'not.a-canonical-metric',1,'DECISION',parityTarget.id],'unknown metric key');
 await rejectsWith(LATEST_SQL,/Unsupported context kind for the exact HIM metric definition/,[one,'hse.self-confidence',1,'GOAL',goalTargetA.id],'definition-unapproved context kind');
 await rejectsWith(LATEST_SQL,/Unsupported HIM context ownership authority/,[one,'hse.self-confidence',1,'GLOBAL','GLOBAL'],'unsupported ownership authority');
 await rejectsWith(LATEST_SQL,/Unknown or unowned HIM measurement context/,[one,'hse.self-confidence',1,'DECISION',randomUUID()],'unknown context');
 const canonicalLatest=(await client.query(LATEST_SQL,[one,'hse.self-confidence',1,'DECISION',parityTarget.id])).rows;
 if(canonicalLatest.length!==1||canonicalLatest[0].id!==parity.snapshot.id)throw new Error('The preserved authenticated wrapper must still return the exact canonical latest row');
 // Correction chronology INSIDE the newest event: the correction replaces the
 // value within its original event and never creates a newer event.
 const corrected=await measure("SELECT * FROM public.correct_hse_self_confidence_measurement($1,'VERY_LOW',NULL)",'SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[parity.observation.id]);
 const afterCorrection=(await client.query(LATEST_SQL,[one,'hse.self-confidence',1,'DECISION',parityTarget.id])).rows;
 if(afterCorrection.length!==1||Number(afterCorrection[0].numeric_value)!==1||afterCorrection[0].id!==corrected.snapshot.id)throw new Error('The preserved authenticated wrapper must still select the newest unsuperseded correction inside the newest event');
 // Newest-event chronology plus the ZERO older-event fallback: a NEWER event
 // whose observation has no current calculated snapshot yields no row at all -
 // the older, still-calculated event is never resurrected.
 const uncalculated=(await client.query("SELECT * FROM public.create_hse_self_confidence_measurement('DECISION',$1,'VERY_HIGH',NULL)",[parityTarget.id])).rows[0];
 if((await client.query(LATEST_SQL,[one,'hse.self-confidence',1,'DECISION',parityTarget.id])).rows.length!==0)throw new Error('A newest event with no usable current calculated snapshot must NOT fall back to an older event');
 // Restoring the newest event's calculated value restores the canonical answer.
 const recalculated=(await client.query('SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[uncalculated.id])).rows[0];
 const restored=(await client.query(LATEST_SQL,[one,'hse.self-confidence',1,'DECISION',parityTarget.id])).rows;
 if(restored.length!==1||restored[0].id!==recalculated.id||Number(restored[0].numeric_value)!==5)throw new Error('The newest event must become canonical again once it carries a current calculated value');
 // The separately measured, never-corrected bound Decision is untouched by the
 // parity chain: it still carries exactly its own canonical reading.
 const boundDecisionLatest=(await client.query(LATEST_SQL,[one,'hse.self-confidence',1,'DECISION',decisionTarget.id])).rows;
 if(boundDecisionLatest.length!==1||boundDecisionLatest[0].id!==selfConfidence.snapshot.id||Number(boundDecisionLatest[0].numeric_value)!==4)throw new Error('Fixture invariant: the bound Decision keeps its own untouched canonical reading');

 // --- 6: exact ACTIVE relevance for the session ------------------------------
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionTarget.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'SITUATION',situationTarget.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTargetA.id]);
 // RELATIONSHIP is deliberately bound too, so "no Relationship slot exists" is
 // proven against a genuinely ACTIVE Relationship binding rather than an absent
 // one.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'RELATIONSHIP',relationshipTarget.id]);

 // --- 7: canonical conversation turns ----------------------------------------
 await client.query('RESET ROLE');
 const firstUserTurn=await turnAt(randomUUID(),sessionMain,one,'USER','COMPLETED',10);
 const assistantTurn=await turnAt(randomUUID(),sessionMain,one,'ASSISTANT','COMPLETED',20);
 const currentUserTurn=await turnAt(randomUUID(),sessionMain,one,'USER','GENERATING',30);
 const lonelyTurn=await turnAt(randomUUID(),sessionEmpty,one,'USER','GENERATING',10);
 const otherUserTurn=await turnAt(randomUUID(),sessionTwo,two,'USER','GENERATING',10);

 // --- 8: the background source RPC -------------------------------------------
 await asServiceRole();
 const executionId=randomUUID();
 const execution=(await client.query(ACQUIRE_SQL,[executionId,randomUUID(),one,sessionMain,firstUserTurn,'2.0','FAST','ALLOW'])).rows[0];
 if(execution.state!=='RUNNING')throw new Error('Fixture invariant: the post-response execution must be RUNNING');
 const sourceRows=(await client.query(SOURCE_SQL,[executionId])).rows;
 if(sourceRows.length!==REGISTRY.length)throw new Error(`The background source must answer all eight frozen slots in one request, got ${sourceRows.length}`);
 sourceRows.forEach((row,index)=>{
  const[order,slot,kind,metric]=REGISTRY[index];
  if(Number(row.brain_slot_order)!==order||row.brain_slot!==slot)throw new Error(`The background source must return the frozen registry order: row ${index+1}`);
  if(Number(row.slot_order)!==order||row.metric_key!==metric||Number(row.definition_version)!==1)throw new Error(`The background source row ${index+1} must carry its exact frozen metric identity`);
  if(row.context_kind!==kind)throw new Error(`The background source row ${index+1} must carry its one frozen context kind`);
  if(row.calculation_status!=='CALIBRATED')throw new Error(`The background source row ${index+1} must carry the exact persisted CALIBRATED definition`);
  if(!(row.valid_context_kinds??[]).includes(kind))throw new Error(`The background source row ${index+1} must carry the exact persisted context eligibility`);
  for(const column of SOURCE_COLUMNS)if(!(column in row))throw new Error(`The background source row must carry the QHIA-004-compatible column ${column}`);
  if(Object.keys(row).length!==SOURCE_COLUMNS.length)throw new Error('The background source row shape changed');
 });
 // Exactly the bound contexts, never a newest/first/only substitute.
 if(sourceRows[0].context_id!==decisionTarget.id)throw new Error('The DECISION slots must answer for exactly the ACTIVE bound Decision');
 for(const index of[1,2,3])if(sourceRows[index].context_id!==situationTarget.id)throw new Error('The SITUATION slots must answer for exactly the ACTIVE bound Situation');
 for(const index of[4,5,6,7])if(sourceRows[index].context_id!==goalTargetA.id)throw new Error('The GOAL slots must answer for exactly the ACTIVE bound Goal');
 if(sourceRows.some(row=>row.context_id===relationshipTarget.id||row.context_kind==='RELATIONSHIP'))throw new Error('An ACTIVE RELATIONSHIP binding must never produce a Brain Context slot');
 if(sourceRows.some(row=>row.context_id===goalTargetB.id))throw new Error('An owned but unbound Goal must never reach the Brain Context source');
 // KNOWN and UNKNOWN slots are both authoritative facts, and an unmeasured slot
 // carries no fragment of a value.
 const measured={1:4,2:4,3:2,5:2,7:5};
 sourceRows.forEach((row,index)=>{
  const order=index+1;
  if(order in measured){
   if(row.has_canonical_current_value!==true||Number(row.numeric_value)!==measured[order])throw new Error(`The measured Brain slot ${order} must carry its exact canonical current value`);
  }else if(row.has_canonical_current_value!==false||row.numeric_value!==null||row.source_metric_key!==null||row.canonical_binding_id!==null){
   throw new Error(`The unmeasured Brain slot ${order} must report no canonical current value and carry no source fragment`);
  }
 });
 // The RESOLVED / ALIGNMENT identity of hgs.purpose-alignment@1 is preserved
 // exactly, and the other frozen slots keep their UNRESOLVED / NULL identity.
 if(sourceRows[6].semantic_mapping_status!=='RESOLVED'||sourceRows[6].semantic_type!=='ALIGNMENT')throw new Error('The persisted RESOLVED / ALIGNMENT identity must be preserved exactly');
 for(const index of[1,2,4,5,7])if(sourceRows[index].semantic_mapping_status!=='UNRESOLVED'||sourceRows[index].semantic_type!==null)throw new Error('The persisted UNRESOLVED / NULL identity must be preserved exactly');
 // Delegation parity, fact for fact, against the direct QHIA-004 batch
 // authority the foreground uses.
 await client.query('RESET ROLE');await identity(one);
 for(const[order,,kind,metric]of REGISTRY){
  const contextId=kind==='DECISION'?decisionTarget.id:kind==='SITUATION'?situationTarget.id:goalTargetA.id;
  const batch=(await client.query(BATCH_SQL,[one,kind,contextId,[metric],[1]])).rows[0];
  for(const column of['metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id']){
   if(normalize(sourceRows[order-1][column])!==normalize(batch[column]))throw new Error(`The background source must equal the QHIA-004 authority fact for fact on slot ${order}: ${column}`);
  }
 }
 // Fail-closed execution authority: only the exact RUNNING canonical v2 ALLOW
 // execution whose source turn is the owned COMPLETED USER turn is answerable.
 await asServiceRole();
 await rejectsWith(SOURCE_SQL,/Unknown or non-running post-response intelligence execution/,[randomUUID()],'unknown execution');
 const guidedExecution=randomUUID();
 const guidedTurn=await (async()=>{await client.query('RESET ROLE');const id=await turnAt(randomUUID(),sessionMain,one,'USER','COMPLETED',5);await asServiceRole();return id;})();
 await client.query(ACQUIRE_SQL,[guidedExecution,randomUUID(),one,sessionMain,guidedTurn,'2.0','FAST','GUIDED']);
 await rejectsWith(SOURCE_SQL,/canonical v2 ALLOW execution/,[guidedExecution],'GUIDED safety disposition');
 const legacyExecution=randomUUID();
 const legacyTurn=await (async()=>{await client.query('RESET ROLE');const id=await turnAt(randomUUID(),sessionMain,one,'USER','COMPLETED',6);await asServiceRole();return id;})();
 await client.query(ACQUIRE_SQL,[legacyExecution,randomUUID(),one,sessionMain,legacyTurn,'1.0',null,null]);
 await rejectsWith(SOURCE_SQL,/canonical v2 ALLOW execution/,[legacyExecution],'legacy v1 event version');
 const noTurnExecution=randomUUID();
 await client.query(ACQUIRE_SQL,[noTurnExecution,randomUUID(),one,sessionMain,randomUUID(),'2.0','FAST','ALLOW']);
 await rejectsWith(SOURCE_SQL,/Unknown or non-canonical Brain Context source turn/,[noTurnExecution],'missing canonical source turn');
 const assistantExecution=randomUUID();
 await client.query(ACQUIRE_SQL,[assistantExecution,randomUUID(),one,sessionMain,assistantTurn,'2.0','FAST','ALLOW']);
 await rejectsWith(SOURCE_SQL,/Unknown or non-canonical Brain Context source turn/,[assistantExecution],'assistant source turn');

 // --- 9: the managed durable effect ------------------------------------------
 // Both generic paths reject the Brain effect by name.
 await rejectsWith("SELECT public.claim_post_response_intelligence_effect_v1($1,'HIM_BRAIN_CONTEXT_MATERIALIZATION')",/HIM_BRAIN_CONTEXT_MATERIALIZATION_MANAGED/,[executionId],'generic claim');
 await rejectsWith("SELECT public.complete_post_response_intelligence_effect_v1($1,'HIM_BRAIN_CONTEXT_MATERIALIZATION')",/HIM_BRAIN_CONTEXT_MATERIALIZATION_COMMAND_REQUIRED/,[executionId],'generic result-less completion');
 // Every existing managed and typed rejection is preserved verbatim.
 await rejectsWith("SELECT public.claim_post_response_intelligence_effect_v1($1,'CONFIDENCE_BATCH')",/CONFIDENCE_BATCH_MANAGED/,[executionId],'existing Confidence claim rejection');
 await rejectsWith("SELECT public.complete_post_response_intelligence_effect_v1($1,'MEMORY_WRITE')",/MEMORY_RESULT_REQUIRED/,[executionId],'existing Memory completion rejection');
 // A CLAIMED Brain row is structurally unrepresentable. This is attempted as the
 // TABLE OWNER, so no privilege or policy can be mistaken for the proof: the
 // migration-0061 result domain itself is the only thing that can reject it.
 await client.query('RESET ROLE');
 await rejectsWith("INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state) VALUES($1,'HIM_BRAIN_CONTEXT_MATERIALIZATION','CLAIMED')",/him_brain_context_result_check/,[executionId],'a direct CLAIMED Brain Context row');
 await rejectsWith("INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state,completed_at,result_code,result_payload) VALUES($1,'HIM_BRAIN_CONTEXT_MATERIALIZATION','COMPLETED',CURRENT_TIMESTAMP,'HIM_BRAIN_CONTEXT_MATERIALIZED','{}'::jsonb)",/him_brain_context_result_check/,[executionId],'a direct malformed COMPLETED Brain Context row');
 await asServiceRole();
 // The typed result domain rejects every malformed materialization.
 const materialized=[signal(1,decisionTarget.id,{numericValue:4,slotOrder:1}),signal(5,goalTargetA.id),signal(7,goalTargetA.id,{numericValue:5})];
 const rejectedPayloads=[
  ['a wrong source turn',payload(currentUserTurn,materialized),/INVALID_HIM_BRAIN_CONTEXT_SOURCE_TURN/],
  ['a foreign context',payload(firstUserTurn,[signal(5,randomUUID())]),/INVALID_HIM_BRAIN_CONTEXT_CONTEXT/],
  ['a wrong-kind context',payload(firstUserTurn,[signal(5,situationTarget.id)]),/INVALID_HIM_BRAIN_CONTEXT_CONTEXT/],
  ['a relationship context',payload(firstUserTurn,[signal(5,relationshipTarget.id)]),/INVALID_HIM_BRAIN_CONTEXT_CONTEXT/],
  ['zero signals',payload(firstUserTurn,[]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['nine signals',payload(firstUserTurn,[...REGISTRY.map(([order])=>signal(order,order===1?decisionTarget.id:order<=4?situationTarget.id:goalTargetA.id)),signal(8,goalTargetA.id)]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a duplicated slot',payload(firstUserTurn,[signal(5,goalTargetA.id),signal(5,goalTargetA.id)]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a registry order inversion',payload(firstUserTurn,[signal(7,goalTargetA.id),signal(5,goalTargetA.id)]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a slot label that does not match its ordinal',payload(firstUserTurn,[signal(5,goalTargetA.id,{slot:'GOAL_INITIATIVE'})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a context kind that does not match its slot',payload(firstUserTurn,[signal(5,goalTargetA.id,{contextKind:'SITUATION'})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a value below the v1 structured scale',payload(firstUserTurn,[signal(5,goalTargetA.id,{numericValue:0})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a value above the v1 structured scale',payload(firstUserTurn,[signal(5,goalTargetA.id,{numericValue:6})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['an assessed freshness state',payload(firstUserTurn,[signal(5,goalTargetA.id,{freshnessState:'FRESH'})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['an assessed confidence state',payload(firstUserTurn,[signal(5,goalTargetA.id,{confidenceState:'HIGH'})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['an UNRESOLVED mapping carrying a semantic type',payload(firstUserTurn,[signal(5,goalTargetA.id,{semanticType:'STATE'})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a RESOLVED mapping with a null semantic type',payload(firstUserTurn,[signal(7,goalTargetA.id,{semanticType:null})]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a metric key in the durable payload',payload(firstUserTurn,[{...signal(5,goalTargetA.id),metricKey:'hbs.consistency'}]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a timestamp in the durable payload',payload(firstUserTurn,[{...signal(5,goalTargetA.id),observedAt:'2026-08-29T00:00:00Z'}]),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a wrong contract version',JSON.stringify({contractVersion:2,source:'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1',sourceTurnId:firstUserTurn,signals:materialized}),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
  ['a wrong provenance',JSON.stringify({contractVersion:1,source:'QANDEEL_HIM_BRAIN_CONTEXT_V1',sourceTurnId:firstUserTurn,signals:materialized}),/INVALID_HIM_BRAIN_CONTEXT_RESULT/],
 ];
 for(const[label,body,pattern]of rejectedPayloads)await rejectsWith(COMPLETE_SQL,pattern,[executionId,'HIM_BRAIN_CONTEXT_MATERIALIZED',body],label);
 await rejectsWith(COMPLETE_SQL,/INVALID_HIM_BRAIN_CONTEXT_RESULT/,[executionId,'HIM_BRAIN_CONTEXT_PARTIAL',payload(firstUserTurn,materialized)],'an unknown result code');
 await rejectsWith(COMPLETE_SQL,/INVALID_HIM_BRAIN_CONTEXT_RESULT/,[executionId,'NO_HIM_BRAIN_CONTEXT',payload(firstUserTurn,materialized)],'a payload-bearing NO_HIM_BRAIN_CONTEXT');
 await rejectsWith(COMPLETE_SQL,/INVALID_HIM_BRAIN_CONTEXT_RESULT/,[executionId,'HIM_BRAIN_CONTEXT_MATERIALIZED',null],'a payload-free materialization');
 if((await client.query('SELECT effect_key FROM public.post_response_intelligence_effects WHERE execution_id=$1',[executionId])).rowCount!==0)throw new Error('A rejected materialization must write no durable row of any kind');
 // The payload-free authoritative result is valid on its own.
 const noBrainExecution=randomUUID();
 const noBrainTurn=await (async()=>{await client.query('RESET ROLE');const id=await turnAt(randomUUID(),sessionMain,one,'USER','COMPLETED',7);await asServiceRole();return id;})();
 await client.query(ACQUIRE_SQL,[noBrainExecution,randomUUID(),one,sessionMain,noBrainTurn,'2.0','FAST','ALLOW']);
 if((await client.query(COMPLETE_SQL,[noBrainExecution,'NO_HIM_BRAIN_CONTEXT',null])).rows[0].status!=='COMPLETED')throw new Error('NO_HIM_BRAIN_CONTEXT must be a valid first durable result');
 // The one typed managed completion: exactly one COMPLETED effect, no CLAIMED
 // row at any instant, and a first durable result that is immutable.
 if((await client.query(COMPLETE_SQL,[executionId,'HIM_BRAIN_CONTEXT_MATERIALIZED',payload(firstUserTurn,materialized)])).rows[0].status!=='COMPLETED')throw new Error('The managed command must durably write the typed materialization');
 const brainEffects=(await client.query("SELECT * FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION'",[executionId])).rows;
 if(brainEffects.length!==1||brainEffects[0].state!=='COMPLETED'||brainEffects[0].result_code!=='HIM_BRAIN_CONTEXT_MATERIALIZED'||brainEffects[0].result_reference!==null)throw new Error('Exactly one COMPLETED typed Brain Context effect must exist');
 if(normalize(brainEffects[0].claimed_at)!==normalize(brainEffects[0].completed_at))throw new Error('The Brain Context effect must be inserted directly as COMPLETED: no CLAIMED-then-COMPLETED window exists');
 if((await client.query("SELECT effect_key FROM public.post_response_intelligence_effects WHERE effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION' AND state='CLAIMED'")).rowCount!==0)throw new Error('No CLAIMED Brain Context row may exist anywhere');
 // Replay never overwrites the first durable result.
 if((await client.query(COMPLETE_SQL,[executionId,'NO_HIM_BRAIN_CONTEXT',null])).rows[0].status!=='ALREADY_COMPLETED')throw new Error('A replayed completion must report ALREADY_COMPLETED');
 if((await client.query(COMPLETE_SQL,[executionId,'HIM_BRAIN_CONTEXT_MATERIALIZED',payload(firstUserTurn,[signal(5,goalTargetB.id,{numericValue:5})])])).rows[0].status!=='ALREADY_COMPLETED')throw new Error('A replayed completion must never overwrite the first durable result');
 const durable=(await client.query("SELECT result_code,result_payload FROM public.post_response_intelligence_effects WHERE execution_id=$1 AND effect_key='HIM_BRAIN_CONTEXT_MATERIALIZATION'",[executionId])).rows[0];
 if(durable.result_code!=='HIM_BRAIN_CONTEXT_MATERIALIZED'||JSON.stringify(durable.result_payload.signals)!==JSON.stringify(materialized))throw new Error('The first durable Brain Context result must survive replay byte for byte');
 // A terminal execution is a NO_OP, never a silent overwrite.
 await client.query("SELECT public.finish_post_response_intelligence_execution_v1($1,'COMPLETED','COMPLETED','DONE')",[noBrainExecution]);
 if((await client.query(COMPLETE_SQL,[noBrainExecution,'NO_HIM_BRAIN_CONTEXT',null])).rows[0].status!=='NO_OP')throw new Error('A terminal execution must answer NO_OP so the caller rereads durable state');

 // --- 10: the foreground next-turn selection ---------------------------------
 await client.query('RESET ROLE');await identity(one);
 const readForeground=async(user,session,turn)=>(await client.query(FOREGROUND_SQL,[user,session,turn])).rows;
 const consumed=await readForeground(one,sessionMain,currentUserTurn);
 if(consumed.length!==3)throw new Error(`The current turn must consume exactly the surviving materialized signals, got ${consumed.length}`);
 consumed.forEach(row=>{
  for(const column of FOREGROUND_COLUMNS)if(!(column in row))throw new Error(`The foreground row must carry ${column}`);
  if(Object.keys(row).length!==FOREGROUND_COLUMNS.length)throw new Error('The foreground row shape changed');
  if(row.freshness_state!=='UNASSESSED'||row.confidence_state!=='UNASSESSED')throw new Error('Freshness and confidence must stay UNASSESSED');
 });
 if(JSON.stringify(consumed.map(row=>[Number(row.slot_order),row.slot,row.context_kind,row.context_id,Number(row.numeric_value)]))!==JSON.stringify([[1,'DECISION_SELF_CONFIDENCE','DECISION',decisionTarget.id,4],[5,'GOAL_CONSISTENCY','GOAL',goalTargetA.id,2],[7,'GOAL_PURPOSE_ALIGNMENT','GOAL',goalTargetA.id,5]]))throw new Error('The foreground read must return exactly the materialized signals, in frozen registry order');
 if(consumed[2].semantic_mapping_status!=='RESOLVED'||consumed[2].semantic_type!=='ALIGNMENT')throw new Error('The exact persisted RESOLVED / ALIGNMENT identity must reach the application');
 if(consumed[0].semantic_mapping_status!=='UNRESOLVED'||consumed[0].semantic_type!==null)throw new Error('The exact persisted UNRESOLVED / NULL identity must reach the application');
 // Fail-closed current-turn authority.
 await rejectsWith(FOREGROUND_SQL,/owner-exact/,[two,sessionMain,currentUserTurn],'wrong p_user_id');
 await rejectsWith(FOREGROUND_SQL,/Unknown or cross-user current conversation turn/,[one,sessionEmpty,currentUserTurn],'wrong session for the exact turn');
 await rejectsWith(FOREGROUND_SQL,/Unknown or cross-user current conversation turn/,[one,sessionMain,assistantTurn],'an assistant turn as the current user turn');
 await rejectsWith(FOREGROUND_SQL,/Unknown or cross-user current conversation turn/,[one,sessionMain,randomUUID()],'an unknown current turn');
 await rejectsWith(FOREGROUND_SQL,/not in the foreground generating state/,[one,sessionMain,firstUserTurn],'a COMPLETED current turn');
 await client.query('RESET ROLE');await identity(two);
 await rejectsWith(FOREGROUND_SQL,/Unknown or cross-user current conversation turn/,[two,sessionTwo,currentUserTurn],'another user reaching this turn');
 if((await readForeground(two,sessionTwo,otherUserTurn)).length!==0)throw new Error('Another user must see no Brain Context of their own');
 await client.query('RESET ROLE');await identity(one);
 // A session whose current turn has NO previous USER turn is authoritatively
 // empty - never an older or cross-session materialization.
 if((await readForeground(one,sessionEmpty,lonelyTurn)).length!==0)throw new Error('A first turn with no preceding USER turn must return no Brain Context');

 // --- 11: the immediate-previous-turn rule and the absence of older fallback --
 await client.query('RESET ROLE');
 // An intervening USER turn between the materialized one and the current one.
 const interveningTurn=await turnAt(randomUUID(),sessionMain,one,'USER','FAILED',25);
 await identity(one);
 if((await readForeground(one,sessionMain,currentUserTurn)).length!==0)throw new Error('An intervening FAILED USER turn must end the read: the older completed turn is NEVER reached');
 for(const status of['CANCELLED','SUPERSEDED','GENERATING','RECEIVED']){
  await client.query('RESET ROLE');
  await client.query('UPDATE public.conversation_turns SET status=$2 WHERE id=$1',[interveningTurn,status]);
  await identity(one);
  if((await readForeground(one,sessionMain,currentUserTurn)).length!==0)throw new Error(`An intervening ${status} USER turn must end the read: the older completed turn is NEVER reached`);
 }
 // The SAME intervening turn, now COMPLETED but with no materialization of its
 // own, is still the authoritative predecessor - and still yields nothing.
 await client.query('RESET ROLE');
 await client.query("UPDATE public.conversation_turns SET status='COMPLETED' WHERE id=$1",[interveningTurn]);
 await identity(one);
 if((await readForeground(one,sessionMain,currentUserTurn)).length!==0)throw new Error('A COMPLETED predecessor with no durable materialization must return no Brain Context');
 // Removing the intervening turn restores the immediate predecessor, and with
 // it exactly the same materialization: nothing was cached or lost.
 await client.query('RESET ROLE');
 await client.query('DELETE FROM public.conversation_turns WHERE id=$1',[interveningTurn]);
 await identity(one);
 const restoredConsumption=await readForeground(one,sessionMain,currentUserTurn);
 if(JSON.stringify(restoredConsumption.map(row=>row.slot))!==JSON.stringify(['DECISION_SELF_CONFIDENCE','GOAL_CONSISTENCY','GOAL_PURPOSE_ALIGNMENT']))throw new Error('Restoring the immediate predecessor must restore exactly its own materialization');

 // --- 12: CURRENT-binding revalidation, with no metric reread ----------------
 // Replacement: the GOAL binding moves A -> B, so both materialized GOAL signals
 // disappear while the untouched DECISION signal survives independently.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTargetB.id]);
 const afterReplacement=await readForeground(one,sessionMain,currentUserTurn);
 if(JSON.stringify(afterReplacement.map(row=>row.slot))!==JSON.stringify(['DECISION_SELF_CONFIDENCE']))throw new Error('A replaced binding must drop every signal materialized against the old context, and only those');
 if(afterReplacement.some(row=>row.context_id===goalTargetB.id))throw new Error('A replaced binding must never re-point an old signal at the new context');
 // Clearing: the DECISION binding is cleared, so nothing survives at all.
 await client.query(CLEAR_BINDING_SQL,[one,sessionMain,'DECISION']);
 if((await readForeground(one,sessionMain,currentUserTurn)).length!==0)throw new Error('A cleared binding must drop its materialized signal');
 // Restoring both exact bindings restores exactly the original three signals.
 await client.query(SET_BINDING_SQL,[one,sessionMain,'DECISION',decisionTarget.id]);
 await client.query(SET_BINDING_SQL,[one,sessionMain,'GOAL',goalTargetA.id]);
 const afterRestore=await readForeground(one,sessionMain,currentUserTurn);
 if(JSON.stringify(afterRestore.map(row=>row.slot))!==JSON.stringify(['DECISION_SELF_CONFIDENCE','GOAL_CONSISTENCY','GOAL_PURPOSE_ALIGNMENT']))throw new Error('Restoring the exact bindings must restore exactly the original materialized signals');
 // NON-VACUOUS "no metric reread": the underlying canonical current value is
 // CORRECTED to a different reading through the canonical authority. The QHIA-004
 // authority now reports the new value while the foreground Brain read still
 // reports the ORIGINAL materialized one - so the foreground demonstrably
 // consumed the durable result and read no metric.
 const correctedConsistency=await measure("SELECT * FROM public.correct_hbs_consistency_measurement_v1($1,'ALMOST_ALWAYS',NULL)",'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[consistency.observation.id]);
 if(Number(correctedConsistency.snapshot.numeric_value)!==5)throw new Error('Fixture invariant: the correction must produce a different canonical current value');
 if(Number((await client.query(BATCH_SQL,[one,'GOAL',goalTargetA.id,['hbs.consistency'],[1]])).rows[0].numeric_value)!==5)throw new Error('Fixture invariant: the QHIA-004 authority must now report the corrected value');
 const afterCorrectionForeground=await readForeground(one,sessionMain,currentUserTurn);
 if(Number(afterCorrectionForeground.find(row=>row.slot==='GOAL_CONSISTENCY').numeric_value)!==2)throw new Error('The foreground Brain read must return the durable materialized value, never a freshly reread metric');

 // --- 13: determinism and zero write ------------------------------------------
 await client.query('RESET ROLE');
 const before=await measurementState();
 await identity(one);
 const repeat=await readForeground(one,sessionMain,currentUserTurn);
 await readForeground(one,sessionEmpty,lonelyTurn);
 await client.query('RESET ROLE');
 const after=await measurementState();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Foreground Brain Context reads must write no measurement, relevance, or durable-effect state');
 await identity(one);
 const repeatAgain=await readForeground(one,sessionMain,currentUserTurn);
 if(JSON.stringify(repeat.map(row=>FOREGROUND_COLUMNS.map(column=>normalize(row[column]))))!==JSON.stringify(repeatAgain.map(row=>FOREGROUND_COLUMNS.map(column=>normalize(row[column])))))throw new Error('Foreground Brain Context reads must be deterministic across repeated calls');

 // --- 14: the preserved surrounding authorities --------------------------------
 for(const fn of['public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])','public.read_him_session_context_bindings_v1(uuid,uuid)','public.read_him_session_cross_context_foreground_v3(uuid,uuid)']){
  const a=await acl(fn);
  if(a.pub||a.anon||a.service_role||!a.authenticated)throw new Error(`The existing authority ${fn} must keep its unchanged authenticated-only EXECUTE authority`);
 }
 await client.query('RESET ROLE');
 await client.query('ROLLBACK');

 // --- 15: complete fixture rollback --------------------------------------------
 const residue=Number((await client.query('SELECT (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.him_session_context_bindings WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.post_response_intelligence_executions WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM public.conversation_turns WHERE user_id=ANY($1::uuid[])) total',[[one,two]])).rows[0].total);
 if(residue!==0)throw new Error('Brain Context verifier fixtures must roll back completely');
 for(const[metric,mapping,type]of[['hse.self-confidence','RESOLVED','STATE'],['hbs.avoidance','UNRESOLVED',null],['hgs.self-awareness','UNRESOLVED',null],['hgs.resilience','UNRESOLVED',null],['hbs.consistency','UNRESOLVED',null],['hbs.initiative','UNRESOLVED',null],['hgs.purpose-alignment','RESOLVED','ALIGNMENT'],['hgs.habit-strength','UNRESOLVED',null]]){
  const definition=(await client.query('SELECT semantic_mapping_status,semantic_type,calculation_status FROM public.him_metric_definitions WHERE metric_key=$1 AND definition_version=1',[metric])).rows[0];
  if(definition.semantic_mapping_status!==mapping||definition.semantic_type!==type||definition.calculation_status!=='CALIBRATED')throw new Error(`QHIA-012 must leave the canonical ${metric}@1 identity exactly as it found it`);
 }
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Background Human Intelligence -> Brain Context Bridge v1 (QHIA-012): the migration-0052 canonical latest algorithm was EXTRACTED into a trusted internal core that no request role can reach - not PUBLIC, anon, authenticated, or service_role - while the authenticated wrapper keeps its exact signature, safe properties, authenticated-only ACL and every observable semantic (owner-exact denial, unknown exact definition, unsupported context kind, unsupported ownership authority, unknown/unowned context, newest-event chronology, correction chronology inside the newest event, and zero older-event fallback when the newest event has no usable current calculated snapshot, restored the moment it gains one); service_role still cannot call the authenticated wrapper and anon/authenticated cannot call the background source or the managed completion; ONE execution-bound service-role source RPC whose only input is the post-response execution ID answers all eight frozen Brain slots in one request, in the frozen registry order, for exactly the ACTIVE QHIA-006 DECISION/SITUATION/GOAL bindings - never a RELATIONSHIP binding, never an owned-but-unbound target - preserving the exact persisted RESOLVED/ALIGNMENT and UNRESOLVED/NULL identities and equalling the direct QHIA-004 batch authority fact for fact, while failing closed on an unknown execution, a GUIDED disposition, a legacy v1 event, a missing canonical source turn and an assistant source turn; the managed Brain Context effect is rejected by the generic claim path and by the generic result-less completion path, a CLAIMED Brain row cannot be written even directly, the typed managed command creates exactly one COMPLETED effect whose claim and completion instants are identical, and it rejects a wrong source turn, a foreign context, a wrong-kind context, a relationship context, zero and nine signals, a duplicated slot, a registry order inversion, a mismatched slot label or context kind, an out-of-range value, an assessed freshness or confidence state, a coerced semantic mapping, a metric key, a timestamp, a wrong contract version, a wrong provenance, an unknown result code, a payload-bearing NO_HIM_BRAIN_CONTEXT and a payload-free materialization - writing no durable row for any of them - while NO_HIM_BRAIN_CONTEXT is a valid payload-free first result, a replay reports ALREADY_COMPLETED and never overwrites the immutable first durable result, and a terminal execution answers NO_OP; the authenticated foreground read consumes ONLY the immediately preceding canonical USER turn by (created_at, id), so an intervening FAILED, CANCELLED, SUPERSEDED, GENERATING or RECEIVED USER turn ends the read instead of being skipped over, a COMPLETED predecessor with no materialization is authoritatively empty, a session with no preceding USER turn is empty, and a wrong owner, a wrong session, an assistant turn, an unknown turn, a non-GENERATING current turn and another user\'s turn all fail closed; every materialized signal is revalidated against the CURRENT ACTIVE binding, so a replaced binding drops exactly the signals materialized against the old context while another kind survives independently, a cleared binding drops its signal, and restoring the exact bindings restores exactly the original signals; and - proven non-vacuously by CORRECTING the underlying canonical current value so the QHIA-004 authority reports a different reading - the foreground still returns the original durable materialization, so it rereads no metric; repeated reads are deterministic and write no measurement, relevance, or durable-effect state; every fixture rolls back completely; and all eight canonical frozen metric definitions are left exactly as they were found.');
