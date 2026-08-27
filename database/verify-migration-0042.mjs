// Real-PostgreSQL verifier for migration 0042 - HBS Reflection Measurement &
// Calibration v1 (HIM Expansion metric 9/17). Behaviorally proves this
// phase's durable historical guarantees: the exact 17-definition catalog in
// which the five HSE metrics, hbs.avoidance, hbs.consistency,
// hbs.initiative, and hbs.reflection are all calibrated (later HIM Expansion
// phases may calibrate more - no global calibrated count, exact permanent
// uncalibrated list, or later-migration ceiling is frozen here; the one-time
// 9/8 transition invariant lives inside migration 0042 itself and ran at
// migration time), Reflection keeps HBS ownership with an UNRESOLVED/NULL
// semantic mapping, and the three seven-day HBS siblings stay calibrated and
// unchanged; exact Reflection governance artifacts with exactly ten approval
// basis entries, no external validation claim, no dependency edges, and only
// the SITUATION/CONVERSATION_SESSION ACTIVE bindings; owner-only
// context-bound creation - an owned existing SITUATION target with the
// server-derived label, or an owned real conversation session with all-NULL
// target fields - always with a NULL event temporal window and untrusted
// client timestamps; the full scored + unassessed engagement response
// semantics with sibling vocabularies rejected; construct independence (no
// cross-metric calculation in any direction and freely differing sibling
// values); correction that preserves the same event/context/NULL window and
// replaces the one current value on both context paths; idempotent and
// two-connection race-safe calculation; fail-closed
// cross-user/forgery/anon authority; supersession-aware current reads; and
// explicit Trend v1 + Intelligence Snapshot v1 non-consumption. Zero
// provider/model calls of any kind.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionOne=randomUUID(),sessionTwo=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const SCALE='hbs.reflection.engagement-5.v1',MODEL='hbs.reflection.direct-structured-context-bound-reflective-engagement',INSTRUMENT='hbs.reflection.direct-context-bound-reflective-engagement-report',APPROVAL='qandeel.him.reflection.foundation-approval';
const EXPECTED_BASIS=['HBS_REFLECTION_CONTEXT_BOUND_DELIBERATE_REFLECTIVE_ENGAGEMENT','DIRECT_STRUCTURED_REPORT','SITUATION_SESSION_ONLY','MEANINGFUL_REFLECTION_OPPORTUNITY_BOUNDARY','ORDINAL_ENGAGEMENT_5','REFLECTION_NOT_RUMINATION_OR_INSIGHT_OUTCOME','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING','NO_FOUNDER_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM'];
await client.connect();try{
 // --- Phase inventory: this phase's durable historical guarantees ------------
 const state=await client.query('SELECT metric_key,calculation_status,hif_owner,semantic_mapping_status,semantic_type,scale_reference,required_input_contract,dependency_ids,consumers FROM public.him_metric_definitions');
 if(state.rows.length!==17)throw new Error('Expected exactly 17 metric definitions');
 const calibrated=state.rows.filter(x=>x.calculation_status==='CALIBRATED').map(x=>x.metric_key);
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics plus hbs.avoidance, hbs.consistency, hbs.initiative, and hbs.reflection (later HIM Expansion tasks may calibrate more)');
 const reflection=state.rows.find(x=>x.metric_key==='hbs.reflection');
 if(reflection.hif_owner!=='HBS'||reflection.semantic_mapping_status!=='UNRESOLVED'||reflection.semantic_type!==null||reflection.scale_reference!==SCALE||reflection.required_input_contract!=='DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_REFLECTIVE_ENGAGEMENT_REPORT_V1'||reflection.dependency_ids.length!==0||reflection.consumers.length!==0)throw new Error('hbs.reflection definition identity failed');
 // The three seven-day HBS siblings stay calibrated and semantically unchanged.
 for(const[key,scale]of[['hbs.avoidance','hbs.avoidance.frequency-5.v1'],['hbs.consistency','hbs.consistency.frequency-5.v1'],['hbs.initiative','hbs.initiative.frequency-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HBS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 // --- Reflection governance ---------------------------------------------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[SCALE]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={NOT_AT_ALL:1,A_LITTLE:2,SOMEWHAT:3,QUITE_A_BIT:4,A_GREAT_DEAL:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('Reflection ordinal engagement scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[MODEL]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==SCALE||model.rows[0].supported_context_kinds.join()!=='SITUATION,CONVERSATION_SESSION'||model.rows[0].target_metric_key!=='hbs.reflection'||model.rows[0].method_type!=='DIRECT_STRUCTURED_CONTEXT_BOUND_REFLECTIVE_ENGAGEMENT_REPORT')throw new Error('Reflection calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[APPROVAL]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==MODEL||!Array.isArray(basis)||basis.length!==10||EXPECTED_BASIS.some(entry=>!basis.includes(entry)))throw new Error('Reflection exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key='hbs.reflection' AND status='ACTIVE' ORDER BY context_kind");
 if(bindings.rows.map(x=>x.context_kind).join()!=='CONVERSATION_SESSION,SITUATION'||bindings.rows.some(x=>x.model_id!==MODEL||x.instrument_id!==INSTRUMENT||x.scale_contract_reference!==SCALE))throw new Error('Expected exactly the Reflection SITUATION and CONVERSATION_SESSION ACTIVE bindings');
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel)VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT')ON CONFLICT DO NOTHING",[sessionOne,one,sessionTwo,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 const bindingInsert="INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hbs.reflection',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())";
 // A Reflection binding can never carry a sibling approval, instrument, or
 // scale, and can never open an unapproved context.
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000001','SITUATION',2,'PENDING',MODEL,INSTRUMENT,SCALE,'qandeel.him.consistency.foundation-approval']);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000002','SITUATION',3,'PENDING',MODEL,'hbs.initiative.direct-target-bound-seven-day-report',SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000003','SITUATION',4,'PENDING',MODEL,INSTRUMENT,'hbs.avoidance.frequency-5.v1',APPROVAL]);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000004','GOAL',2,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000005','DECISION',3,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000006','GLOBAL',4,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='42000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4e000000-0000-4000-8000-000000000007','forged.reflection.model',1,'hbs.reflection',1,'CALIBRATED','PRODUCTION','x','x','x','hbs.reflection.engagement-5.v1','{}'::jsonb,'x',ARRAY['SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- Create: owned SITUATION target or owned real session, NULL window ------
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','difficult team meeting')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'SOMEWHAT',NULL)",[fabricated]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'SOMEWHAT',NULL)",[goalTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('CONVERSATION_SESSION',$1,'SOMEWHAT',NULL)",[fabricated]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('CONVERSATION_SESSION',$1,'SOMEWHAT',NULL)",[sessionTwo]);
 for(const kind of['GLOBAL','GOAL','DECISION','RELATIONSHIP'])await rejects(client,`SELECT * FROM public.create_hbs_reflection_measurement_v1('${kind}',$1,'SOMEWHAT',NULL)`,[situationTarget.id]);
 // The Reflection engagement vocabulary is exact: HSE codes, sibling
 // frequency codes, and every sibling special code are rejected.
 for(const invalid of['MODERATE','ALMOST_ALWAYS','NEVER','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','NO_CLEAR_SELF_OWNED_OPPORTUNITY','A_LOT'])await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,$2,NULL)",[situationTarget.id,invalid]);
 // --- Both context paths: server authority, NULL window, untrusted time ------
 const paths=[
  {name:'SITUATION',contextId:situationTarget.id,expectLabel:'difficult team meeting'},
  {name:'CONVERSATION_SESSION',contextId:sessionOne,expectLabel:null},
 ];
 for(const path of paths){
  const probe=(await client.query(`SELECT * FROM public.create_hbs_reflection_measurement_v1('${path.name}',$1,'SOMEWHAT',$2)`,[path.contextId,past])).rows[0];
  if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error(`${path.name} client timestamp must stay untrusted diagnostic metadata`);
  if(probe.metric_key!=='hbs.reflection'||probe.context_kind!==path.name||probe.context_id!==path.contextId||probe.instrument_id!==INSTRUMENT||probe.scale_contract_reference!==SCALE||probe.source!=='DIRECT_STRUCTURED_USER_REPORT')throw new Error(`Server-derived ${path.name} Reflection identity failed`);
  if(path.name==='SITUATION'&&(probe.target_label!==path.expectLabel||probe.target_context_kind!=='SITUATION'||probe.target_context_id!==situationTarget.id))throw new Error('Server-derived SITUATION target label/kind/id failed');
  if(path.name==='CONVERSATION_SESSION'&&(probe.target_label!==null||probe.target_context_kind!==null||probe.target_context_id!==null))throw new Error('Session Reflection observation must keep NULL target fields');
  const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
  if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error(`${path.name} Reflection event must carry a NULL temporal window`);
  // Events are immutable: nobody can retrofit a window onto a Reflection event.
  await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '7 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
  // --- Response semantics on isolated events ---------------------------------
  for(const[code,value]of[['NOT_AT_ALL',1],['A_LITTLE',2],['SOMEWHAT',3],['QUITE_A_BIT',4],['A_GREAT_DEAL',5]]){
   const o=(await client.query(`SELECT * FROM public.create_hbs_reflection_measurement_v1('${path.name}',$1,$2,NULL)`,[path.contextId,code])).rows[0];
   const s=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[o.id])).rows[0];
   if(s.metric_key!=='hbs.reflection'||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`${path.name} ${code} mapping failed`);
   if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`${path.name} ${code} snapshot must stay UNRESOLVED/null`);
   if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`${path.name} ${code} snapshot must carry a NULL temporal window`);
  }
  for(const code of['NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE']){
   const o=(await client.query(`SELECT * FROM public.create_hbs_reflection_measurement_v1('${path.name}',$1,$2,NULL)`,[path.contextId,code])).rows[0];
   const s=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[o.id])).rows[0];
   if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`${path.name} ${code} must be UNASSESSED null, never zero`);
  }
  // --- Idempotency + correction: same event, same exact context, NULL window -
  const idem=(await client.query(`SELECT * FROM public.create_hbs_reflection_measurement_v1('${path.name}',$1,'A_LITTLE',NULL)`,[path.contextId])).rows[0];
  const firstCalc=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[idem.id])).rows[0];
  const retryCalc=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[idem.id])).rows[0];
  if(firstCalc.id!==retryCalc.id)throw new Error(`${path.name} Reflection recalculation was not idempotent`);
  const corrected=(await client.query("SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'A_GREAT_DEAL',NULL)",[idem.id])).rows[0];
  if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!=='hbs.reflection')throw new Error(`${path.name} Reflection correction changed the measurement event or context`);
  const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
  if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error(`${path.name} Reflection correction must preserve the NULL event window`);
  if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error(`Superseded ${path.name} Reflection remained current before recalculation`);
  const correctedSnapshot=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[corrected.id])).rows[0];
  const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
  if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error(`Corrected ${path.name} Reflection current value failed`);
  if(correctedSnapshot.temporal_window_start!==null||correctedSnapshot.temporal_window_end!==null)throw new Error(`Corrected ${path.name} Reflection snapshot must keep a NULL temporal window`);
  await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[idem.id]);
  await rejects(client,"SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'NOT_AT_ALL',NULL)",[idem.id]);
 }
 // --- Direct assessed snapshot forgery remains blocked ------------------------
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:'hbs.reflection',definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'SITUATION',contextId:situationTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // --- Independent constructs --------------------------------------------------
 const reflectionObs=(await client.query("SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'NOT_AT_ALL',NULL)",[situationTarget.id])).rows[0];
 const avoidanceObs=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[situationTarget.id])).rows[0];
 const consistencyObs=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'OFTEN',NULL)",[situationTarget.id])).rows[0];
 const initiativeObs=(await client.query("SELECT * FROM public.create_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[situationTarget.id])).rows[0];
 // Cross-metric calculation is structurally impossible in every direction.
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[reflectionObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[reflectionObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[reflectionObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[avoidanceObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[consistencyObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[initiativeObs.id]);
 // Cross-metric correction is equally fail-closed.
 await rejects(client,"SELECT * FROM public.correct_hbs_avoidance_measurement_v1($1,'NEVER',NULL)",[reflectionObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'NOT_AT_ALL',NULL)",[avoidanceObs.id]);
 // Values differ freely: low Reflection coexists with high Avoidance, high
 // Consistency, and low Initiative for the same SITUATION with no DB
 // invariant forcing inverse or correlated values, and no sibling score is
 // ever an input to the Reflection calculation.
 const reflectionSnap=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[reflectionObs.id])).rows[0];
 const avoidanceSnap=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[avoidanceObs.id])).rows[0];
 if(reflectionSnap.numeric_value!==1||avoidanceSnap.numeric_value!==5)throw new Error('Independent Reflection/Avoidance values failed');
 const currentPair=(await client.query('SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key',[situationTarget.id,[reflectionObs.id,avoidanceObs.id]])).rows;
 if(currentPair.length!==2||currentPair.map(x=>`${x.metric_key}:${x.numeric_value}`).join()!=='hbs.avoidance:5,hbs.reflection:1')throw new Error('Freely differing Reflection/Avoidance current values failed');
 // The Reflection result carries only its own model and binding provenance.
 // (Bindings are not directly readable by the authenticated role, so this
 // audit join runs as the superuser and the user identity is restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[reflectionObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!=='hbs.reflection'||provenance.rows[0].binding_metric!=='hbs.reflection'||provenance.rows[0].model_id!==MODEL||provenance.rows[0].instrument_id!==INSTRUMENT)throw new Error('Reflection calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hbs.reflection',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hbs.reflection',1,'CONVERSATION_SESSION',$2,now()-interval '30 days',now())",[one,sessionOne]);
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key).sort();
 if(situationIntelligence.join()!=='hse.attention,hse.motivation,hse.self-confidence,hse.stress')throw new Error('SITUATION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Reflection');
 const sessionIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne])).rows.map(x=>x.metric_key).sort();
 if(sessionIntelligence.join()!=='hse.attention,hse.energy,hse.stress')throw new Error('CONVERSATION_SESSION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Reflection');
 // --- Cross-user / anon authority ---------------------------------------------
 const situationScored=(await client.query("SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'QUITE_A_BIT',NULL)",[situationTarget.id])).rows[0];
 const sessionScored=(await client.query("SELECT * FROM public.create_hbs_reflection_measurement_v1('CONVERSATION_SESSION',$1,'QUITE_A_BIT',NULL)",[sessionOne])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hbs.reflection'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hbs.reflection'")).rowCount!==0)throw new Error('Owner-only Reflection read isolation failed');
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'NOT_AT_ALL',NULL)",[situationTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('CONVERSATION_SESSION',$1,'NOT_AT_ALL',NULL)",[sessionOne]);
 await rejects(client,"SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'NOT_AT_ALL',NULL)",[situationScored.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'NOT_AT_ALL',NULL)",[sessionScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[situationScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[sessionScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'NOT_AT_ALL',NULL)",[situationTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('CONVERSATION_SESSION',$1,'NOT_AT_ALL',NULL)",[sessionOne]);
 await rejects(client,"SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'NOT_AT_ALL',NULL)",[sessionScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[sessionScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 await client.query('BEGIN');await identity(client,one);
 const raced=(await client.query("SELECT * FROM public.create_hbs_reflection_measurement_v1('CONVERSATION_SESSION',$1,'A_LITTLE',NULL)",[sessionOne])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('hbs.reflection.observation:'||$1::text,0))",[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Reflection calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query("SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'A_GREAT_DEAL',NULL)",[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Reflection was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Reflection result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HBS Reflection v1: five-HSE-plus-four-HBS calibration with Reflection activated and the seven-day siblings unchanged, HBS/UNRESOLVED/null identity, exact governance artifacts with exactly ten approval basis entries and no external validation claim, owner context-bound SITUATION-target and conversation-session creation with the NULL event temporal window and untrusted client time, full scored and unassessed engagement response semantics with sibling vocabularies rejected, structural cross-metric impossibility with freely differing sibling values, correction/currentness preserving the exact context and NULL window on both paths, idempotent and race-safe calculation, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
