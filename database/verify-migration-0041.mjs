// Real-PostgreSQL verifier for migration 0041 - HBS Consistency + Initiative
// Measurement & Calibration v1 (HIM Expansion metrics 7-8/17, first combined
// task). Behaviorally proves this phase's durable historical guarantees: the
// exact 17-definition catalog in which the five HSE metrics, hbs.avoidance,
// hbs.consistency, and hbs.initiative are all calibrated (later HIM Expansion
// phases may calibrate more - no future global calibrated count is frozen
// here), the two new metrics keep HBS ownership with an UNRESOLVED/NULL
// semantic mapping, and hbs.avoidance stays
// calibrated and unchanged; exact per-metric governance artifacts with no
// dependency edges and no shared sibling artifacts; owner-only target-bound
// GOAL/SITUATION creation with the server-derived immutable seven-day window
// and untrusted client timestamps; the full scored + unassessed response
// semantics per metric with sibling vocabularies rejected; construct
// independence (no cross-metric calculation, no Avoidance reuse, and freely
// differing values with no inverse-forcing invariant); correction that
// preserves the same event/target/window and replaces the one current value;
// idempotent and two-connection race-safe calculation for each metric;
// fail-closed cross-user/forgery/anon authority; supersession-aware current
// reads; and explicit Trend v1 + Intelligence Snapshot v1 non-consumption.
// Zero provider/model calls of any kind.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const METRICS={
 'hbs.consistency':{scale:'hbs.consistency.frequency-5.v1',model:'hbs.consistency.direct-structured-seven-day-self-report',instrument:'hbs.consistency.direct-target-bound-seven-day-report',approval:'qandeel.him.consistency.foundation-approval',special:'INSUFFICIENT_REPEATED_OPPORTUNITIES',create:'create_hbs_consistency_measurement_v1',correct:'correct_hbs_consistency_measurement_v1',calculate:'calculate_hbs_consistency_measurement_v1',lockNs:'hbs.consistency.observation:'},
 'hbs.initiative':{scale:'hbs.initiative.frequency-5.v1',model:'hbs.initiative.direct-structured-seven-day-self-report',instrument:'hbs.initiative.direct-target-bound-seven-day-report',approval:'qandeel.him.initiative.foundation-approval',special:'NO_CLEAR_SELF_OWNED_OPPORTUNITY',create:'create_hbs_initiative_measurement_v1',correct:'correct_hbs_initiative_measurement_v1',calculate:'calculate_hbs_initiative_measurement_v1',lockNs:'hbs.initiative.observation:'},
};
await client.connect();try{
 // --- Phase inventory: this phase's durable historical guarantees ------------
 // The one-time 8/9 activation invariant lives inside migration 0041 itself
 // and ran at migration time. This verifier asserts only what must stay true
 // forever after this phase: 17 definitions, the five HSE metrics plus
 // hbs.avoidance, hbs.consistency, and hbs.initiative calibrated with their
 // exact identities. Later HIM Expansion tasks may calibrate more metrics, so
 // no global calibrated count or exact uncalibrated list is frozen here.
 const state=await client.query('SELECT metric_key,calculation_status,hif_owner,semantic_mapping_status,semantic_type,scale_reference,required_input_contract,dependency_ids,consumers FROM public.him_metric_definitions WHERE definition_version=1');
 // Forward-safe canonical scope: the durable historical guarantee is that
 // every canonical v1 metric identity exists and holds its approved contract,
 // never that the live definitions table may not grow. The query above is
 // scoped to definition_version=1, so a later definition version or a later
 // metric is deliberately tolerated here and proven by its own phase.
 const CANONICAL_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
 const present=state.rows.map(x=>x.metric_key);
 if(CANONICAL_V1.some(key=>!present.includes(key)))throw new Error('Expected every canonical v1 metric identity to exist');
 const calibrated=state.rows.filter(x=>x.calculation_status==='CALIBRATED').map(x=>x.metric_key);
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics plus hbs.avoidance, hbs.consistency, and hbs.initiative (later HIM Expansion tasks may calibrate more)');
 for(const key of Object.keys(METRICS)){
  const definition=state.rows.find(x=>x.metric_key===key);
  if(definition.hif_owner!=='HBS'||definition.semantic_mapping_status!=='UNRESOLVED'||definition.semantic_type!==null||definition.scale_reference!==METRICS[key].scale||definition.required_input_contract!=='DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error(`${key} definition identity failed`);
 }
 // Avoidance stays calibrated and semantically unchanged.
 const avoidance=state.rows.find(x=>x.metric_key==='hbs.avoidance');
 if(avoidance.calculation_status!=='CALIBRATED'||avoidance.hif_owner!=='HBS'||avoidance.semantic_mapping_status!=='UNRESOLVED'||avoidance.semantic_type!==null||avoidance.scale_reference!=='hbs.avoidance.frequency-5.v1'||avoidance.dependency_ids.length!==0||avoidance.consumers.length!==0)throw new Error('Avoidance must remain calibrated and unchanged');
 // --- Per-metric governance ---------------------------------------------------
 const expectedCategories={NEVER:1,RARELY:2,SOMETIMES:3,OFTEN:4,ALMOST_ALWAYS:5};
 for(const[key,m]of Object.entries(METRICS)){
  const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[m.scale]);
  // jsonb reorders object keys, so the category mapping is compared structurally.
  const categories=scale.rowCount===1?scale.rows[0].categories:{};
  if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error(`${key} ordinal scale contract failed`);
  const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[m.model]);
  if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==m.scale||model.rows[0].supported_context_kinds.join()!=='GOAL,SITUATION'||model.rows[0].target_metric_key!==key)throw new Error(`${key} calibrated model failed`);
  const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[m.approval]);
  if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==m.model)throw new Error(`${key} approval failed or claimed external validation`);
  const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[key]);
  if(bindings.rows.map(x=>x.context_kind).join()!=='GOAL,SITUATION'||bindings.rows.some(x=>x.model_id!==m.model||x.instrument_id!==m.instrument||x.scale_contract_reference!==m.scale))throw new Error(`Expected exact ${key} GOAL/SITUATION bindings`);
 }
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 const bindingInsert="INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,$2,1,$3,$4,$5,$6,1,$7,1,$8,1,$9,1,now())";
 // A Consistency binding can never carry the sibling Initiative approval,
 // model, instrument, or scale - and vice versa.
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000001','hbs.consistency','GOAL',2,'PENDING','hbs.consistency.direct-structured-seven-day-self-report','hbs.consistency.direct-target-bound-seven-day-report','hbs.consistency.frequency-5.v1','qandeel.him.initiative.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000002','hbs.initiative','GOAL',2,'PENDING','hbs.initiative.direct-structured-seven-day-self-report','hbs.initiative.direct-target-bound-seven-day-report','hbs.initiative.frequency-5.v1','qandeel.him.consistency.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000003','hbs.consistency','GOAL',3,'PENDING','hbs.consistency.direct-structured-seven-day-self-report','hbs.initiative.direct-target-bound-seven-day-report','hbs.consistency.frequency-5.v1','qandeel.him.consistency.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000004','hbs.initiative','GOAL',3,'PENDING','hbs.initiative.direct-structured-seven-day-self-report','hbs.initiative.direct-target-bound-seven-day-report','hbs.avoidance.frequency-5.v1','qandeel.him.initiative.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000005','hbs.consistency','CONVERSATION_SESSION',4,'PENDING','hbs.consistency.direct-structured-seven-day-self-report','hbs.consistency.direct-target-bound-seven-day-report','hbs.consistency.frequency-5.v1','qandeel.him.consistency.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000006','hbs.initiative','DECISION',4,'PENDING','hbs.initiative.direct-structured-seven-day-self-report','hbs.initiative.direct-target-bound-seven-day-report','hbs.initiative.frequency-5.v1','qandeel.him.initiative.foundation-approval']);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='41000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4f000000-0000-4000-8000-000000000007','forged.consistency.model',1,'hbs.consistency',1,'CALIBRATED','PRODUCTION','x','x','x','hbs.consistency.frequency-5.v1','{}'::jsonb,'x',ARRAY['GOAL'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- Create: owner target binding, server window, untrusted client time -----
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','weekly review session')")).rows[0];
 for(const[key,m]of Object.entries(METRICS)){
  const sibling=key==='hbs.consistency'?METRICS['hbs.initiative']:METRICS['hbs.consistency'];
  await rejects(client,`SELECT * FROM public.${m.create}($1,$2,NULL)`,[fabricated,'RARELY']);
  await rejects(client,`SELECT * FROM public.${m.create}($1,$2,NULL)`,[goalTarget.id,'ALWAYS']);
  await rejects(client,`SELECT * FROM public.${m.create}($1,$2,NULL)`,[goalTarget.id,'VERY_LOW']);
  // Sibling and Avoidance special codes belong to their own vocabularies only.
  await rejects(client,`SELECT * FROM public.${m.create}($1,$2,NULL)`,[goalTarget.id,sibling.special]);
  await rejects(client,`SELECT * FROM public.${m.create}($1,$2,NULL)`,[goalTarget.id,'NO_CLEAR_OPPORTUNITY']);
  const probe=(await client.query(`SELECT * FROM public.${m.create}($1,$2,$3)`,[goalTarget.id,'SOMETIMES',past])).rows[0];
  if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error(`${key} client timestamp must stay untrusted diagnostic metadata`);
  if(probe.metric_key!==key||probe.context_kind!=='GOAL'||probe.context_id!==goalTarget.id||probe.target_context_id!==goalTarget.id||probe.target_label!=='finish thesis draft'||probe.instrument_id!==m.instrument||probe.scale_contract_reference!==m.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT')throw new Error(`Server-derived ${key} target/context identity failed`);
  const probeEvent=(await client.query('SELECT extract(epoch FROM (e.observation_window_end-e.observation_window_start)) AS width_seconds,abs(extract(epoch FROM (e.observation_window_end-o.reported_at))) AS end_drift FROM public.him_measurement_events e JOIN public.him_measurement_observations o ON o.measurement_event_id=e.id WHERE e.id=$1',[probe.measurement_event_id])).rows[0];
  if(Number(probeEvent.width_seconds)!==604800||Number(probeEvent.end_drift)>5)throw new Error(`${key} window must be exactly seven days ending at the server-authoritative report time`);
  // The caller can never move the window (immutable events).
  await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '30 days' WHERE id=$1",[probe.measurement_event_id]);
  // --- Response semantics on isolated events ---------------------------------
  for(const[code,value]of[['NEVER',1],['RARELY',2],['SOMETIMES',3],['OFTEN',4],['ALMOST_ALWAYS',5]]){
   const o=(await client.query(`SELECT * FROM public.${m.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
   const s=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[o.id])).rows[0];
   if(s.metric_key!==key||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`${key} ${code} mapping failed`);
   if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`${key} ${code} snapshot must stay UNRESOLVED/null`);
   if(new Date(s.temporal_window_end).getTime()-new Date(s.temporal_window_start).getTime()!==604800000)throw new Error(`${key} ${code} snapshot must carry the exact seven-day window`);
  }
  for(const code of[m.special,'NOT_SURE']){
   const o=(await client.query(`SELECT * FROM public.${m.create}($1,$2,NULL)`,[situationTarget.id,code])).rows[0];
   const s=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[o.id])).rows[0];
   if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`${key} ${code} must be UNASSESSED null, never zero`);
  }
  const situationScored=(await client.query(`SELECT * FROM public.${m.create}($1,'OFTEN',NULL)`,[situationTarget.id])).rows[0];
  if((await client.query(`SELECT * FROM public.${m.calculate}($1)`,[situationScored.id])).rows[0].numeric_value!==4)throw new Error(`${key} SITUATION target path failed`);
  // --- Idempotency + correction: same event, target, original window --------
  const idem=(await client.query(`SELECT * FROM public.${m.create}($1,'RARELY',NULL)`,[goalTarget.id])).rows[0];
  const firstCalc=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[idem.id])).rows[0];
  const retryCalc=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[idem.id])).rows[0];
  if(firstCalc.id!==retryCalc.id)throw new Error(`${key} recalculation was not idempotent`);
  const corrected=(await client.query(`SELECT * FROM public.${m.correct}($1,'ALMOST_ALWAYS',NULL)`,[idem.id])).rows[0];
  if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.metric_key!==key)throw new Error(`${key} correction changed the measurement event or target`);
  const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
  if(new Date(correctedEvent.observation_window_end).getTime()-new Date(correctedEvent.observation_window_start).getTime()!==604800000)throw new Error(`${key} correction moved the original seven-day window`);
  if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error(`Superseded ${key} remained current before recalculation`);
  const correctedSnapshot=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[corrected.id])).rows[0];
  const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
  if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error(`Corrected ${key} current value failed`);
  if(new Date(correctedSnapshot.temporal_window_end).getTime()!==new Date(correctedEvent.observation_window_end).getTime()||new Date(correctedSnapshot.temporal_window_start).getTime()!==new Date(correctedEvent.observation_window_start).getTime())throw new Error(`Corrected ${key} snapshot must preserve the original window`);
  await rejects(client,`SELECT * FROM public.${m.calculate}($1)`,[idem.id]);
  await rejects(client,`SELECT * FROM public.${m.correct}($1,'NEVER',NULL)`,[idem.id]);
  // --- Direct assessed snapshot forgery remains blocked ----------------------
  await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'GOAL',contextId:goalTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 }
 // --- Independent constructs -------------------------------------------------
 const consistencyObs=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[goalTarget.id])).rows[0];
 const initiativeObs=(await client.query("SELECT * FROM public.create_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[goalTarget.id])).rows[0];
 const avoidanceObs=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[goalTarget.id])).rows[0];
 // Cross-metric calculation is structurally impossible in every direction.
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[consistencyObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[initiativeObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[avoidanceObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[avoidanceObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[consistencyObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[initiativeObs.id]);
 // Cross-metric correction is equally fail-closed.
 await rejects(client,"SELECT * FROM public.correct_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[consistencyObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_consistency_measurement_v1($1,'NEVER',NULL)",[initiativeObs.id]);
 // Values differ freely: high consistency + low initiative + high avoidance
 // coexist as current values for the same target with no DB invariant
 // forcing inverse or correlated values.
 const consistencySnap=(await client.query('SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[consistencyObs.id])).rows[0];
 const initiativeSnap=(await client.query('SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[initiativeObs.id])).rows[0];
 const avoidanceSnap=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[avoidanceObs.id])).rows[0];
 if(consistencySnap.numeric_value!==5||initiativeSnap.numeric_value!==1||avoidanceSnap.numeric_value!==5)throw new Error('Independent sibling values failed');
 const currentTriple=(await client.query("SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key",[goalTarget.id,[consistencyObs.id,initiativeObs.id,avoidanceObs.id]])).rows;
 if(currentTriple.length!==3||currentTriple.map(x=>`${x.metric_key}:${x.numeric_value}`).join()!=='hbs.avoidance:5,hbs.consistency:5,hbs.initiative:1')throw new Error('Freely differing sibling current values failed');
 // Each result/snapshot carries only its own model and binding provenance.
 // (Bindings are not directly readable by the authenticated role, so this
 // audit join runs as the superuser and the user identity is restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=ANY($1::uuid[])',[[consistencyObs.id,initiativeObs.id,avoidanceObs.id]]);
 if(provenance.rows.length!==3||provenance.rows.some(x=>x.metric_key!==x.binding_metric||!x.model_id.startsWith(x.metric_key)))throw new Error('Per-metric calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption ------------------
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hbs.consistency',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hbs.initiative',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 const intelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('GOAL',$1)",[goalTarget.id])).rows;
 if(intelligence.length!==1||intelligence[0].metric_key!=='hse.motivation')throw new Error('Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Consistency or Initiative');
 // --- Cross-user / anon authority --------------------------------------------
 const situationScoredConsistency=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'OFTEN',NULL)",[situationTarget.id])).rows[0];
 const situationScoredInitiative=(await client.query("SELECT * FROM public.create_hbs_initiative_measurement_v1($1,'OFTEN',NULL)",[situationTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key=ANY(ARRAY['hbs.consistency','hbs.initiative'])")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key=ANY(ARRAY['hbs.consistency','hbs.initiative'])")).rowCount!==0)throw new Error('Owner-only read isolation failed');
 await rejects(client,"SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'NEVER',NULL)",[goalTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[goalTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_consistency_measurement_v1($1,'NEVER',NULL)",[situationScoredConsistency.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[situationScoredInitiative.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[situationScoredConsistency.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[situationScoredInitiative.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,"SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'NEVER',NULL)",[goalTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[goalTarget.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[situationScoredConsistency.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[situationScoredInitiative.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization per metric ----
 for(const[key,m]of Object.entries(METRICS)){
  await client.query('BEGIN');await identity(client,one);
  const committedTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','race target')")).rows[0];
  const raced=(await client.query(`SELECT * FROM public.${m.create}($1,'RARELY',NULL)`,[committedTarget.id])).rows[0];
  await client.query('COMMIT');
  const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
  try{
   await client.query('BEGIN');await identity(client,one);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1||$2::text,0))',[m.lockNs,raced.id]);
   await client.query('RESET ROLE');
   await racer.query('BEGIN');await identity(racer,one);
   const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
   const waiting=racer.query(`SELECT * FROM public.${m.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
   let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
   if(!blocked)throw new Error(`${key} calculation did not wait on the correction lock`);
   await identity(client,one);
   await client.query(`SELECT * FROM public.${m.correct}($1,'ALMOST_ALWAYS',NULL)`,[raced.id]);
   await client.query('COMMIT');
   if(!(await waiting))throw new Error(`Superseded ${key} was calculated after the correction won the race`);
   await racer.query('ROLLBACK');
   const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
   if(artifacts.rows[0].n!==0)throw new Error(`Race created a stale ${key} result`);
  }finally{await racer.end();}
 }
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HBS Consistency + Initiative v1: five-HSE-plus-three-HBS calibration with the two new metrics activated and Avoidance unchanged, HBS/UNRESOLVED/null identities, exact independent per-metric governance artifacts, owner target-bound GOAL/SITUATION creation with the immutable server-derived seven-day window and untrusted client time, full scored and unassessed response semantics with sibling vocabularies rejected, structural cross-metric and Avoidance-reuse impossibility with freely differing sibling values, correction/currentness with the original window preserved, idempotent and race-safe calculation per metric, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
