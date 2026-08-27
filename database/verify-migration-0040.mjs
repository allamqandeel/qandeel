// Real-PostgreSQL verifier for migration 0040 - HBS Avoidance Measurement &
// Calibration v1 (HIM Expansion metric 6/17). Behaviorally proves: the exact
// 17-definition catalog with six calibrated / eleven uncalibrated and only
// hbs.avoidance moved out of the uncalibrated group while keeping HBS
// ownership and an UNRESOLVED/NULL semantic mapping; exact governance
// artifacts with no dependency edges; owner-only target-bound GOAL/SITUATION
// creation with the server-derived immutable seven-day window and untrusted
// client timestamps; the full scored + unassessed response semantics;
// correction that preserves the same event/target/window and replaces the one
// current value; idempotent and two-connection race-safe calculation;
// fail-closed cross-user/forgery/anon authority; supersession-aware current
// reads; and explicit Trend v1 + Intelligence Snapshot v1 non-consumption.
// Zero provider/model calls of any kind.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const UNCALIBRATED_11=['hbs.consistency','hbs.initiative','hbs.reflection','hgs.habit-strength','hgs.purpose-alignment','hgs.resilience','hgs.self-awareness','hrs.communication','hrs.emotional-safety','hrs.relationship-trust','hrs.repair'];
await client.connect();try{
 // --- Catalog / governance ---------------------------------------------------
 const state=await client.query('SELECT metric_key,calculation_status,hif_owner,semantic_mapping_status,semantic_type,scale_reference,required_input_contract,dependency_ids,consumers FROM public.him_metric_definitions');
 if(state.rows.length!==17)throw new Error('Expected exactly 17 metric definitions');
 const calibrated=state.rows.filter(x=>x.calculation_status==='CALIBRATED').map(x=>x.metric_key).sort();
 const uncalibrated=state.rows.filter(x=>x.calculation_status==='UNCALIBRATED').map(x=>x.metric_key).sort();
 if(calibrated.join()!==[...HSE,'hbs.avoidance'].sort().join())throw new Error('Expected exactly six calibrated metrics (five HSE plus hbs.avoidance)');
 if(uncalibrated.length!==11||uncalibrated.join()!==UNCALIBRATED_11.join())throw new Error('Expected exactly the eleven remaining uncalibrated metrics: only hbs.avoidance changed');
 const avoidance=state.rows.find(x=>x.metric_key==='hbs.avoidance');
 if(avoidance.hif_owner!=='HBS'||avoidance.semantic_mapping_status!=='UNRESOLVED'||avoidance.semantic_type!==null||avoidance.scale_reference!=='hbs.avoidance.frequency-5.v1'||avoidance.required_input_contract!=='DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'||avoidance.dependency_ids.length!==0||avoidance.consumers.length!==0)throw new Error('Avoidance definition identity failed');
 const scale=await client.query("SELECT * FROM public.him_scale_contracts WHERE scale_contract_id='hbs.avoidance.frequency-5.v1' AND scale_version=1");
 const expectedCategories={NEVER:1,RARELY:2,SOMETIMES:3,OFTEN:4,ALMOST_ALWAYS:5};
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('Avoidance ordinal scale contract failed');
 const model=await client.query("SELECT * FROM public.him_calculation_models WHERE model_id='hbs.avoidance.direct-structured-seven-day-self-report' AND model_version=1");
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!=='hbs.avoidance.frequency-5.v1'||model.rows[0].supported_context_kinds.join()!=='GOAL,SITUATION')throw new Error('Avoidance calibrated model failed');
 const approval=await client.query("SELECT * FROM public.him_governance_approvals WHERE approval_id='qandeel.him.avoidance.foundation-approval'");
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed)throw new Error('Avoidance approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hbs.avoidance' AND status='ACTIVE' ORDER BY context_kind");
 if(bindings.rows.map(x=>x.context_kind).join()!=='GOAL,SITUATION')throw new Error('Expected exact Avoidance GOAL/SITUATION bindings');
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 const bindingInsert="INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hbs.avoidance',1,$2,$3,$4,'hbs.avoidance.direct-structured-seven-day-self-report',1,$5,1,'hbs.avoidance.frequency-5.v1',1,$6,1,now())";
 await rejects(client,bindingInsert,['41000000-0000-4000-8000-000000000001','GOAL',2,'PENDING','hbs.avoidance.direct-target-bound-seven-day-report','qandeel.him.motivation.foundation-approval']);
 await rejects(client,bindingInsert,['41000000-0000-4000-8000-000000000002','GOAL',3,'PENDING','wrong.instrument','qandeel.him.avoidance.foundation-approval']);
 await rejects(client,bindingInsert,['41000000-0000-4000-8000-000000000003','CONVERSATION_SESSION',4,'PENDING','hbs.avoidance.direct-target-bound-seven-day-report','qandeel.him.avoidance.foundation-approval']);
 await rejects(client,bindingInsert,['41000000-0000-4000-8000-000000000004','GOAL',5,'ACTIVE','hbs.avoidance.direct-target-bound-seven-day-report','qandeel.him.avoidance.foundation-approval']);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='40000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('41000000-0000-4000-8000-000000000005','forged.avoidance.model',1,'hbs.avoidance',1,'CALIBRATED','PRODUCTION','x','x','x','hbs.avoidance.frequency-5.v1','{}'::jsonb,'x',ARRAY['GOAL'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- Create: owner target binding, server window, untrusted client time -----
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','weekly review session')")).rows[0];
 await rejects(client,'SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[fabricated,'RARELY']);
 await rejects(client,'SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[goalTarget.id,'ALWAYS']);
 await rejects(client,'SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[goalTarget.id,'VERY_LOW']);
 const probe=(await client.query('SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,$3)',[goalTarget.id,'SOMETIMES',past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Client timestamp must stay untrusted diagnostic metadata');
 if(probe.context_kind!=='GOAL'||probe.context_id!==goalTarget.id||probe.target_context_id!==goalTarget.id||probe.target_label!=='finish thesis draft'||probe.instrument_id!=='hbs.avoidance.direct-target-bound-seven-day-report'||probe.source!=='DIRECT_STRUCTURED_USER_REPORT')throw new Error('Server-derived Avoidance target/context identity failed');
 const probeEvent=(await client.query('SELECT extract(epoch FROM (e.observation_window_end-e.observation_window_start)) AS width_seconds,abs(extract(epoch FROM (e.observation_window_end-o.reported_at))) AS end_drift FROM public.him_measurement_events e JOIN public.him_measurement_observations o ON o.measurement_event_id=e.id WHERE e.id=$1',[probe.measurement_event_id])).rows[0];
 if(Number(probeEvent.width_seconds)!==604800||Number(probeEvent.end_drift)>5)throw new Error('Window must be exactly seven days ending at the server-authoritative report time');
 // The caller can never move the window (immutable events).
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '30 days' WHERE id=$1",[probe.measurement_event_id]);
 // --- Response semantics on isolated events ----------------------------------
 for(const[code,value]of[['NEVER',1],['RARELY',2],['SOMETIMES',3],['OFTEN',4],['ALMOST_ALWAYS',5]]){
  const o=(await client.query('SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[goalTarget.id,code])).rows[0];
  const s=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[o.id])).rows[0];
  if(s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`Avoidance ${code} mapping failed`);
  if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`Avoidance ${code} snapshot must stay UNRESOLVED/null`);
  if(new Date(s.temporal_window_end).getTime()-new Date(s.temporal_window_start).getTime()!==604800000)throw new Error(`Avoidance ${code} snapshot must carry the exact seven-day window`);
 }
 for(const code of['NO_CLEAR_OPPORTUNITY','NOT_SURE']){
  const o=(await client.query('SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[situationTarget.id,code])).rows[0];
  const s=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`Avoidance ${code} must be UNASSESSED null, never zero`);
 }
 const situationScored=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'OFTEN',NULL)",[situationTarget.id])).rows[0];
 if((await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[situationScored.id])).rows[0].numeric_value!==4)throw new Error('SITUATION target path failed');
 // --- Idempotency ------------------------------------------------------------
 const idem=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'RARELY',NULL)",[goalTarget.id])).rows[0];
 const firstCalc=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[idem.id])).rows[0];
 const retryCalc=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Avoidance recalculation was not idempotent');
 // --- Correction: same event, same target, same original window --------------
 const corrected=(await client.query("SELECT * FROM public.correct_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id)throw new Error('Correction changed the measurement event or target');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(new Date(correctedEvent.observation_window_end).getTime()-new Date(correctedEvent.observation_window_start).getTime()!==604800000)throw new Error('Correction moved the original seven-day window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Avoidance remained current before recalculation');
 const correctedSnapshot=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Avoidance current value failed');
 if(new Date(correctedSnapshot.temporal_window_end).getTime()!==new Date(correctedEvent.observation_window_end).getTime()||new Date(correctedSnapshot.temporal_window_start).getTime()!==new Date(correctedEvent.observation_window_start).getTime())throw new Error('Corrected snapshot must preserve the original window');
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[idem.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_avoidance_measurement_v1($1,'NEVER',NULL)",[idem.id]);
 // --- Direct assessed snapshot forgery remains blocked -----------------------
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:'94000000-0000-4000-8000-000000000001',metricKey:'hbs.avoidance',definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'GOAL',contextId:goalTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption ------------------
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hbs.avoidance',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 const intelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('GOAL',$1)",[goalTarget.id])).rows;
 if(intelligence.length!==1||intelligence[0].metric_key!=='hse.motivation')throw new Error('Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Avoidance');
 // --- Cross-user / anon authority --------------------------------------------
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hbs.avoidance'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hbs.avoidance'")).rowCount!==0)throw new Error('Avoidance owner-only read isolation failed');
 await rejects(client,'SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[goalTarget.id,'NEVER']);
 await rejects(client,"SELECT * FROM public.correct_hbs_avoidance_measurement_v1($1,'NEVER',NULL)",[situationScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[situationScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,'SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,$2,NULL)',[goalTarget.id,'NEVER']);
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[situationScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 await client.query('BEGIN');await identity(client,one);
 const committedTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','race target')")).rows[0];
 const raced=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'RARELY',NULL)",[committedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('hbs.avoidance.observation:'||$1::text,0))",[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Avoidance calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query("SELECT * FROM public.correct_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Avoidance was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Avoidance result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HBS Avoidance v1: six/eleven phase inventory with only Avoidance activated, HBS/UNRESOLVED/null identity, exact governance artifacts, owner target-bound GOAL/SITUATION creation with the immutable server-derived seven-day window and untrusted client time, full scored and unassessed response semantics, correction/currentness with the original window preserved, idempotent and race-safe calculation, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
