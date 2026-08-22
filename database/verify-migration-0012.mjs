import pg from 'pg';
const {Client}=pg;
const client=new Client({connectionString:process.env.DATABASE_URL});
const one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002',session='10000000-0000-4000-8000-000000000001';
const past='2001-01-01T00:00:00Z',future='2099-01-01T00:00:00Z';
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const between=(value,start,end)=>new Date(value)>=new Date(start)&&new Date(value)<=new Date(end);
await client.connect();
try{
 const state=await client.query("SELECT metric_key,calculation_status FROM public.him_metric_definitions");
 if(state.rows.filter(x=>x.calculation_status==='CALIBRATED').map(x=>x.metric_key).sort().join()!=='hse.attention,hse.energy,hse.motivation'||state.rows.filter(x=>x.calculation_status==='UNCALIBRATED').length!==14)throw new Error('Expected Energy/Motivation/Attention calibration state');
 const binding=await client.query("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE status='ACTIVE' AND metric_key='hse.energy' AND context_kind='CONVERSATION_SESSION'");
 if(binding.rows[0].n!==1)throw new Error('Expected one active Energy binding');
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[session,one]);
 await client.query('BEGIN');

 // Binding cross-artifact validation and protected lifecycle transition.
 const modelBase="INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES($1,'hse.energy.direct-structured-user-report',$2,'hse.energy',1,$3,'PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_USER_REPORT','hse.energy.ordinal-5.v1','{\"required\":[\"measurementObservation\"]}'::jsonb,'FIRST_CLASS_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['CONVERSATION_SESSION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE',$4,now(),now())";
 await client.query(modelBase,['22000000-0000-4000-8000-000000000002',2,'CALIBRATED','verifier-v2']);
 await client.query(modelBase,['22000000-0000-4000-8000-000000000003',3,'DRAFT','verifier-v3']);
 const approvalBase="INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES($1,$2,1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.energy.direct-structured-user-report',$3,'[\"HSE_CONSTRUCT\",\"DIRECT_REPORT\",\"RIGHT_NOW\",\"CONVERSATION_SESSION\",\"ORDINAL_5\",\"FOUNDER_DESIGN_F1_F2\",\"DETERMINISTIC\",\"EVENT_CORRECTION_MISSINGNESS\",\"SECURITY_BINDING\",\"NO_EXTERNAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')";
 await client.query(approvalBase,['22000000-0000-4000-8000-000000000012','verifier.energy.v2',2]);
 await client.query(approvalBase,['22000000-0000-4000-8000-000000000013','verifier.energy.v3',3]);
 const bindingInsert="INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hse.energy',1,'CONVERSATION_SESSION',$2,$3,'hse.energy.direct-structured-user-report',$4,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,$5,1,now())";
 await rejects(bindingInsert,['22000000-0000-4000-8000-000000000021',2,'PENDING',2,'qandeel.him.energy.foundation-approval']);
 await rejects(bindingInsert,['22000000-0000-4000-8000-000000000022',3,'PENDING',3,'verifier.energy.v3']);
 await rejects(bindingInsert,['22000000-0000-4000-8000-000000000023',4,'ACTIVE',1,'qandeel.him.energy.foundation-approval']);
 await client.query(bindingInsert,['22000000-0000-4000-8000-000000000024',5,'PENDING',2,'verifier.energy.v2']);
 await rejects("UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='12000000-0000-4000-8000-000000000004'");
 await identity(one);
 await rejects("SELECT public.activate_him_canonical_model_binding('22000000-0000-4000-8000-000000000024')");
 await client.query('RESET ROLE');
 await client.query("SELECT public.activate_him_canonical_model_binding('22000000-0000-4000-8000-000000000024')");
 const transitioned=await client.query("SELECT count(*) FILTER(WHERE status='ACTIVE' AND id='22000000-0000-4000-8000-000000000024')::int active,count(*) FILTER(WHERE status='RETIRED' AND id='12000000-0000-4000-8000-000000000004')::int retired FROM public.him_canonical_model_bindings");
 if(transitioned.rows[0].active!==1||transitioned.rows[0].retired!==1)throw new Error('Protected binding transition failed');
 await client.query('ROLLBACK');await client.query('BEGIN');await identity(one);

 // Server-authoritative RIGHT_NOW and idempotent calculation.
 const started=(await client.query('SELECT clock_timestamp() now')).rows[0].now;
 const low=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'LOW',$2)",[session,past])).rows[0];
 const ended=(await client.query('SELECT clock_timestamp() now')).rows[0].now;
 if(!between(low.reported_at,started,ended)||new Date(low.client_reported_at_untrusted).toISOString()!==new Date(past).toISOString())throw new Error('Caller forged canonical RIGHT_NOW timestamp');
 const lowSnap=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[low.id])).rows[0];
 const retry=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[low.id])).rows[0];
 if(lowSnap.value_state!=='ASSESSED'||lowSnap.numeric_value!==2||lowSnap.id!==retry.id||lowSnap.calculation_result_id!==retry.calculation_result_id||new Date(lowSnap.observed_at).getTime()!==new Date(low.reported_at).getTime())throw new Error('Trusted idempotent LOW path failed');
 const duplicates=await client.query('SELECT (SELECT count(*)::int FROM public.him_calculation_results WHERE measurement_observation_id=$1) results,(SELECT count(*)::int FROM public.him_metric_snapshots WHERE measurement_observation_id=$1) snapshots',[low.id]);
 if(duplicates.rows[0].results!==1||duplicates.rows[0].snapshots!==1)throw new Error('Calculation retry created duplicates');

 // Correction retains the event/audit history and exclusively replaces canonical current value.
 const correctionStarted=(await client.query('SELECT clock_timestamp() now')).rows[0].now;
 const corrected=(await client.query("SELECT * FROM public.correct_hse_energy_measurement($1,'VERY_HIGH',$2)",[low.id,future])).rows[0];
 const correctionEnded=(await client.query('SELECT clock_timestamp() now')).rows[0].now;
 if(corrected.measurement_event_id!==low.measurement_event_id||corrected.supersedes_observation_id!==low.id||!between(corrected.reported_at,correctionStarted,correctionEnded)||new Date(corrected.client_reported_at_untrusted).toISOString()!==new Date(future).toISOString())throw new Error('Correction identity or server time failed');
 const currentGap=await client.query('SELECT * FROM public.him_current_energy_measurements WHERE measurement_event_id=$1',[low.measurement_event_id]);
 if(currentGap.rowCount!==0)throw new Error('Superseded LOW remained current before correction calculation');
 await rejects('SELECT * FROM public.calculate_hse_energy_measurement($1)',[low.id]);
 const correctedSnap=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[corrected.id])).rows[0];
 const current=await client.query('SELECT * FROM public.him_current_energy_measurements WHERE measurement_event_id=$1',[low.measurement_event_id]);
 if(correctedSnap.numeric_value!==5||current.rowCount!==1||current.rows[0].numeric_value!==5||current.rows[0].measurement_observation_id!==corrected.id)throw new Error('Canonical correction semantics failed');
 const audit=await client.query('SELECT o.response_code,x.reason FROM public.him_measurement_observations o LEFT JOIN public.him_energy_calculation_supersessions x ON x.superseded_observation_id=o.id WHERE o.measurement_event_id=$1 ORDER BY o.created_at',[low.measurement_event_id]);
 if(audit.rowCount!==2||audit.rows[0].response_code!=='LOW'||audit.rows[0].reason!=='EXPLICIT_MEASUREMENT_CORRECTION'||audit.rows[1].response_code!=='VERY_HIGH')throw new Error('Correction audit history failed');

 const high=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',$2)",[session,future])).rows[0];
 if(new Date(high.reported_at).getUTCFullYear()===2099)throw new Error('Future caller timestamp became canonical');
 const unsure=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'NOT_SURE',NULL)",[session])).rows[0];
 const unsureSnap=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[unsure.id])).rows[0];
 if(unsureSnap.value_state!=='UNASSESSED'||unsureSnap.numeric_value!==null)throw new Error('NOT_SURE must be unassessed');
 await rejects("SELECT * FROM public.create_hse_energy_measurement($1,'3.5',now())",[session]);
 await rejects("SELECT * FROM public.create_him_metric_snapshot($1::jsonb)",[{id:'90000000-0000-4000-8000-000000000001',metricKey:'hse.energy',definitionVersion:1,valueState:'ASSESSED',numericValue:3,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'CONVERSATION_SESSION',contextId:session,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 await client.query('RESET ROLE');await identity(two);
 await rejects('SELECT * FROM public.correct_hse_energy_measurement($1,$2,now())',[high.id,'LOW']);
 if((await client.query('SELECT * FROM public.him_measurement_observations')).rowCount!==0)throw new Error('Cross-user observation RLS failed');
 await client.query('ROLLBACK');

 // Two transactions prove correction wins the shared observation lock and a waiting calculation revalidates currentness.
 await client.query('BEGIN');await identity(one);
 const raced=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'LOW',NULL)",[session])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(one);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('hse.energy.observation:'||$1::text,0))",[raced.id]);
  await client.query('RESET ROLE');
 await racer.query('BEGIN');await racer.query('SET LOCAL ROLE authenticated');await racer.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:one,role:'authenticated'})]);
  const racerPid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waitingCalculation=racer.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let attempt=0;attempt<50&&!blocked;attempt++){await new Promise(resolve=>setTimeout(resolve,20));const activity=await client.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[racerPid]);blocked=activity.rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Concurrent calculation did not wait on the observation lock');
  await identity(one);
  await client.query("SELECT * FROM public.correct_hse_energy_measurement($1,'VERY_HIGH',NULL)",[raced.id]);await client.query('COMMIT');
  if(!(await waitingCalculation))throw new Error('Waiting calculation accepted a superseded observation');
  await racer.query('ROLLBACK');
  const racedArtifacts=await client.query('SELECT (SELECT count(*)::int FROM public.him_calculation_results WHERE measurement_observation_id=$1) results,(SELECT count(*)::int FROM public.him_metric_snapshots WHERE measurement_observation_id=$1) snapshots',[raced.id]);
  if(racedArtifacts.rows[0].results!==0||racedArtifacts.rows[0].snapshots!==0)throw new Error('Superseded observation was newly calculated after correction');
 }finally{await racer.end();}
}finally{await client.end();}
console.log('Verified server-authoritative Energy time, correction supersession, calculation idempotency, binding integrity/lifecycle, trusted snapshots, RLS and Energy regression after Motivation activation.');

