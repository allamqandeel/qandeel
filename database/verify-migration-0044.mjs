// Real-PostgreSQL verifier for migration 0044 - HRS Communication + Repair
// Measurement & Calibration v1 (HIM Expansion metrics 11-12/17, the second
// and third HRS metrics on the reusable owned RELATIONSHIP substrate).
// Behaviorally proves this phase's durable historical guarantees: the exact
// 17-definition catalog in which the five HSE metrics, the four HBS metrics,
// hrs.relationship-trust, hrs.communication, and hrs.repair are all
// calibrated (later HIM Expansion phases may calibrate more - no global
// calibrated count, exact permanent uncalibrated list, or later-migration
// ceiling is frozen here; the one-time 12/5 transition invariant lives
// inside migration 0044 itself and ran at migration time); Communication and
// Repair each keep HRS ownership with an UNRESOLVED/NULL semantic mapping
// while the prior HSE/HBS metrics and Relationship Trust stay calibrated and
// unchanged; the 0043 RELATIONSHIP target substrate is reused unchanged
// (the historical Motivation/Attention target RPCs still reject
// RELATIONSHIP, GOAL/SITUATION/DECISION creation still works, no HSE/HBS
// route is widened to RELATIONSHIP, and no second target authority exists);
// exact separate Communication and Repair governance artifacts, each with
// its own exactly-ten-basis approval, no external validation claim, no
// dependency edges, and only its one RELATIONSHIP ACTIVE binding; owner-only
// relationship-bound creation with server-derived target labels, NULL event
// temporal windows, and untrusted client timestamps; the full scored +
// unassessed semantics for BOTH vocabularies (TOO_TOPIC_DEPENDENT_TO_RATE,
// INSUFFICIENT_BASIS_TO_JUDGE, NO_MEANINGFUL_REPAIR_OPPORTUNITY,
// TOO_EPISODE_DEPENDENT_TO_RATE, and NOT_SURE are UNASSESSED/null - never
// zero, never a midpoint, and a missing repair opportunity never becomes a
// high or low score) with sibling vocabularies rejected; construct
// independence (no cross-metric calculation or correction in any direction
// among Trust, Communication, Repair, HBS, and HSE, freely differing values
// on the same relationship target with no DB-forced composite or inverse,
// and no fabricated hrs.emotional-safety observation, result, or snapshot -
// that metric stays unobserved); correction that preserves the same event,
// the same exact relationship, and the NULL window while replacing the one
// current value; idempotent and two-connection race-safe calculation for
// each metric; fail-closed cross-user/forgery/anon authority; and explicit
// Trend v1 + Intelligence Snapshot v1 non-consumption with the exact
// SITUATION and CONVERSATION_SESSION slot sets unchanged. Zero
// provider/model calls.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionOne=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const COMM={key:'hrs.communication',scale:'hrs.communication.workability-5.v1',model:'hrs.communication.direct-structured-current-communication-workability',instrument:'hrs.communication.direct-relationship-bound-communication-workability-report',approval:'qandeel.him.communication.foundation-approval',method:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT',inputContract:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1',provenance:'QANDEEL_HRS_COMMUNICATION_MEASUREMENT_V1',specials:['TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'],create:'create_hrs_communication_measurement_v1',correct:'correct_hrs_communication_measurement_v1',calculate:'calculate_hrs_communication_measurement_v1',lock:'hrs.communication.observation:',basis:['HRS_COMMUNICATION_CURRENT_WORKABILITY_OF_IMPORTANT_EXCHANGE','DIRECT_STRUCTURED_REPORT','RELATIONSHIP_BOUND_ONLY','EXPERIENCE_GROUNDED_CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_WORKABILITY_5','TOPIC_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED','COMMUNICATION_NOT_TRUST_REPAIR_EMOTIONAL_SAFETY_AGREEMENT_OR_SATISFACTION','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM']};
const REPAIR={key:'hrs.repair',scale:'hrs.repair.effectiveness-5.v1',model:'hrs.repair.direct-structured-current-repair-effectiveness',instrument:'hrs.repair.direct-relationship-bound-repair-effectiveness-report',approval:'qandeel.him.repair.foundation-approval',method:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT',inputContract:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1',provenance:'QANDEEL_HRS_REPAIR_MEASUREMENT_V1',specials:['NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'],create:'create_hrs_repair_measurement_v1',correct:'correct_hrs_repair_measurement_v1',calculate:'calculate_hrs_repair_measurement_v1',lock:'hrs.repair.observation:',basis:['HRS_REPAIR_CURRENT_EFFECTIVENESS_AFTER_MEANINGFUL_RUPTURE','DIRECT_STRUCTURED_REPORT','RELATIONSHIP_BOUND_ONLY','EXPERIENCE_GROUNDED_CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_EFFECTIVENESS_5','NO_REPAIR_OPPORTUNITY_AND_EPISODE_DEPENDENCE_FAIL_TO_UNASSESSED','REPAIR_NOT_TRUST_COMMUNICATION_EMOTIONAL_SAFETY_FORGIVENESS_OR_CONFLICT_ABSENCE','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM']};
await client.connect();try{
 // --- Phase inventory: this phase's durable historical guarantees ------------
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
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics, the four calibrated HBS metrics, hrs.relationship-trust, hrs.communication, and hrs.repair (later HIM Expansion tasks may calibrate more)');
 for(const m of[COMM,REPAIR]){
  const definition=state.rows.find(x=>x.metric_key===m.key);
  if(definition.hif_owner!=='HRS'||definition.semantic_mapping_status!=='UNRESOLVED'||definition.semantic_type!==null||definition.scale_reference!==m.scale||definition.required_input_contract!==m.inputContract||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error(`${m.key} definition identity failed`);
 }
 // Relationship Trust stays calibrated and semantically unchanged - 0044
 // never rewrites the first HRS metric.
 const trust=state.rows.find(x=>x.metric_key==='hrs.relationship-trust');
 if(trust.calculation_status!=='CALIBRATED'||trust.hif_owner!=='HRS'||trust.semantic_mapping_status!=='UNRESOLVED'||trust.semantic_type!==null||trust.scale_reference!=='hrs.relationship-trust.reliance-5.v1'||trust.required_input_contract!=='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1'||trust.dependency_ids.length!==0||trust.consumers.length!==0)throw new Error('hrs.relationship-trust must remain calibrated and unchanged');
 // The four HBS metrics stay calibrated and semantically unchanged.
 for(const[key,scale]of[['hbs.avoidance','hbs.avoidance.frequency-5.v1'],['hbs.consistency','hbs.consistency.frequency-5.v1'],['hbs.initiative','hbs.initiative.frequency-5.v1'],['hbs.reflection','hbs.reflection.engagement-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HBS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 // --- Communication and Repair governance: separate artifacts per metric ------
 for(const m of[COMM,REPAIR]){
  const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[m.scale]);
  // jsonb reorders object keys, so the category mapping is compared structurally.
  const categories=scale.rowCount===1?scale.rows[0].categories:{};
  const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
  if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error(`${m.key} ordinal scale contract failed`);
  const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[m.model]);
  if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==m.scale||model.rows[0].supported_context_kinds.join()!=='RELATIONSHIP'||model.rows[0].target_metric_key!==m.key||model.rows[0].method_type!==m.method)throw new Error(`${m.key} calibrated model failed`);
  const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[m.approval]);
  const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
  if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==m.model||!Array.isArray(basis)||basis.length!==m.basis.length||m.basis.some(entry=>!basis.includes(entry)))throw new Error(`${m.key} exactly-ten-basis approval failed or claimed external validation`);
  const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[m.key]);
  if(bindings.rows.map(x=>x.context_kind).join()!=='RELATIONSHIP'||bindings.rows.some(x=>x.model_id!==m.model||x.instrument_id!==m.instrument||x.scale_contract_reference!==m.scale))throw new Error(`Expected exactly the one ${m.key} RELATIONSHIP ACTIVE binding`);
 }
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel)VALUES($1,$2,'ACTIVE','TEXT')ON CONFLICT DO NOTHING",[sessionOne,one]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 // A Communication or Repair binding can never carry the sibling metric's
 // approval, instrument, or scale (artifacts stay separate even though both
 // scales share the 1-5 shape), and can never open an unapproved context.
 const bindingInsert=metric=>`INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'${metric}',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())`;
 await rejects(client,bindingInsert(COMM.key),['4a000000-0000-4000-8000-000000000001','RELATIONSHIP',2,'PENDING',COMM.model,COMM.instrument,COMM.scale,REPAIR.approval]);
 await rejects(client,bindingInsert(COMM.key),['4a000000-0000-4000-8000-000000000002','RELATIONSHIP',3,'PENDING',COMM.model,REPAIR.instrument,COMM.scale,COMM.approval]);
 await rejects(client,bindingInsert(COMM.key),['4a000000-0000-4000-8000-000000000003','RELATIONSHIP',4,'PENDING',COMM.model,COMM.instrument,REPAIR.scale,COMM.approval]);
 await rejects(client,bindingInsert(REPAIR.key),['4a000000-0000-4000-8000-000000000004','RELATIONSHIP',2,'PENDING',REPAIR.model,REPAIR.instrument,REPAIR.scale,COMM.approval]);
 await rejects(client,bindingInsert(REPAIR.key),['4a000000-0000-4000-8000-000000000005','RELATIONSHIP',3,'PENDING',REPAIR.model,COMM.instrument,REPAIR.scale,REPAIR.approval]);
 await rejects(client,bindingInsert(REPAIR.key),['4a000000-0000-4000-8000-000000000006','RELATIONSHIP',4,'PENDING',REPAIR.model,REPAIR.instrument,'hrs.relationship-trust.reliance-5.v1',REPAIR.approval]);
 for(const context of['GOAL','SITUATION','CONVERSATION_SESSION','DECISION','GLOBAL']){
  await rejects(client,bindingInsert(COMM.key),[randomUUID(),context,5,'PENDING',COMM.model,COMM.instrument,COMM.scale,COMM.approval]);
  await rejects(client,bindingInsert(REPAIR.key),[randomUUID(),context,5,'PENDING',REPAIR.model,REPAIR.instrument,REPAIR.scale,REPAIR.approval]);
 }
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='44000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4a000000-0000-4000-8000-000000000007','forged.communication.model',1,'hrs.communication',1,'CALIBRATED','PRODUCTION','x','x','x','hrs.communication.workability-5.v1','{}'::jsonb,'x',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- 0043 RELATIONSHIP target substrate is reused, not reinvented ------------
 // The existing 0043 RPC still creates valid RELATIONSHIP targets, the
 // historical Motivation/Attention target RPCs still reject RELATIONSHIP,
 // GOAL/SITUATION/DECISION creation still works unchanged, and no
 // pre-existing HSE/HBS measurement route is widened to RELATIONSHIP.
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with Ahmed')")).rows[0];
 if(relationshipTarget.user_id!==one||relationshipTarget.context_kind!=='RELATIONSHIP'||relationshipTarget.display_text!=='my relationship with Ahmed'||relationshipTarget.canonical_provenance!=='QANDEEL_HIM_MEASUREMENT_TARGET_V1')throw new Error('The 0043 server-derived RELATIONSHIP target substrate must remain intact');
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','difficult team meeting')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','choose launch date')")).rows[0];
 if(goalTarget.context_kind!=='GOAL'||situationTarget.context_kind!=='SITUATION'||decisionTarget.context_kind!=='DECISION')throw new Error('Existing GOAL/SITUATION/DECISION target creation must remain unchanged');
 await rejects(client,"SELECT * FROM public.create_him_motivation_measurement_target('RELATIONSHIP','my marriage')");
 await rejects(client,"SELECT * FROM public.create_him_attention_measurement_context('RELATIONSHIP','my marriage')");
 await rejects(client,"SELECT * FROM public.create_hse_motivation_measurement($1,'MODERATE',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'OFTEN',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('RELATIONSHIP',$1,'SOMEWHAT',NULL)",[relationshipTarget.id]);
 // --- Per-metric behavioral proof set, fully independently --------------------
 for(const m of[COMM,REPAIR]){
  // Create: owned RELATIONSHIP target only.
  await rejects(client,`SELECT * FROM public.${m.create}($1,'MODERATE',NULL)`,[fabricated]);
  await rejects(client,`SELECT * FROM public.${m.create}($1,'MODERATE',NULL)`,[goalTarget.id]);
  await rejects(client,`SELECT * FROM public.${m.create}($1,'MODERATE',NULL)`,[situationTarget.id]);
  await rejects(client,`SELECT * FROM public.${m.create}($1,'MODERATE',NULL)`,[decisionTarget.id]);
  // The vocabulary is exact: sibling frequency/engagement codes and every
  // sibling special code are rejected - including the other new metric's
  // and Relationship Trust's special codes.
  const foreign=['SOMEWHAT','ALMOST_ALWAYS','NEVER','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','TOO_CONTEXT_DEPENDENT_TO_RATE','PERFECT_COMMUNICATION',...(m===COMM?['NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE']:['TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE'])];
  for(const invalid of foreign)await rejects(client,`SELECT * FROM public.${m.create}($1,$2,NULL)`,[relationshipTarget.id,invalid]);
  // Server authority: derived label/kind/id, NULL event window, untrusted
  // client timestamps.
  const probe=(await client.query(`SELECT * FROM public.${m.create}($1,'MODERATE',$2)`,[relationshipTarget.id,past])).rows[0];
  if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error(`${m.key} client timestamp must stay untrusted diagnostic metadata`);
  if(probe.metric_key!==m.key||probe.context_kind!=='RELATIONSHIP'||probe.context_id!==relationshipTarget.id||probe.instrument_id!==m.instrument||probe.scale_contract_reference!==m.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT'||probe.canonical_provenance!==m.provenance)throw new Error(`${m.key} server-derived identity failed`);
  if(probe.target_label!=='my relationship with Ahmed'||probe.target_context_kind!=='RELATIONSHIP'||probe.target_context_id!==relationshipTarget.id)throw new Error(`${m.key} server-derived RELATIONSHIP target label/kind/id failed`);
  const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
  if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error(`${m.key} event must carry a NULL temporal window`);
  // Events are immutable: nobody can retrofit a window onto the event.
  await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '7 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
  // Scored response semantics on isolated measurements.
  for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
   const o=(await client.query(`SELECT * FROM public.${m.create}($1,$2,NULL)`,[relationshipTarget.id,code])).rows[0];
   const s=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[o.id])).rows[0];
   if(s.metric_key!==m.key||s.context_kind!=='RELATIONSHIP'||s.context_id!==relationshipTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`${m.key} ${code} mapping failed`);
   if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`${m.key} ${code} snapshot must stay UNRESOLVED/null`);
   if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`${m.key} ${code} snapshot must carry a NULL temporal window`);
  }
  // The special codes and NOT_SURE are UNASSESSED/null: never zero, never a
  // midpoint - and for Repair, the missing repair opportunity never becomes
  // a high score because the relationship did not recently fight, and never
  // a low score.
  for(const code of m.specials){
   const o=(await client.query(`SELECT * FROM public.${m.create}($1,$2,NULL)`,[relationshipTarget.id,code])).rows[0];
   const s=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[o.id])).rows[0];
   if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`${m.key} ${code} must be UNASSESSED null, never zero, never high, never low, and never a midpoint`);
  }
  // Idempotency + correction: same event, same exact relationship.
  const idem=(await client.query(`SELECT * FROM public.${m.create}($1,'LOW',NULL)`,[relationshipTarget.id])).rows[0];
  const firstCalc=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[idem.id])).rows[0];
  const retryCalc=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[idem.id])).rows[0];
  if(firstCalc.id!==retryCalc.id)throw new Error(`${m.key} recalculation was not idempotent`);
  const corrected=(await client.query(`SELECT * FROM public.${m.correct}($1,'VERY_HIGH',NULL)`,[idem.id])).rows[0];
  if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!==m.key)throw new Error(`${m.key} correction changed the measurement event or the relationship`);
  const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
  if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error(`${m.key} correction must preserve the NULL event window`);
  if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error(`Superseded ${m.key} remained current before recalculation`);
  const correctedSnapshot=(await client.query(`SELECT * FROM public.${m.calculate}($1)`,[corrected.id])).rows[0];
  const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
  if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error(`Corrected ${m.key} current value failed`);
  // The superseded observation can neither calculate nor be corrected again.
  await rejects(client,`SELECT * FROM public.${m.calculate}($1)`,[idem.id]);
  await rejects(client,`SELECT * FROM public.${m.correct}($1,'VERY_LOW',NULL)`,[idem.id]);
  // Direct assessed snapshot forgery remains blocked.
  await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:m.key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'RELATIONSHIP',contextId:relationshipTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 }
 // --- Independent constructs: Trust, Communication, and Repair ---------------
 // The mandated coexistence example: on the SAME user and the SAME owned
 // RELATIONSHIP target, Relationship Trust VERY_LOW (1), Communication
 // VERY_HIGH (5), and Repair LOW (2) are all accepted with no DB invariant
 // deriving, modifying, or correlating one from another - no inverse, no
 // composite, and no hidden relationship-health score.
 const trustObs=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id])).rows[0];
 const commObs=(await client.query("SELECT * FROM public.create_hrs_communication_measurement_v1($1,'VERY_HIGH',NULL)",[relationshipTarget.id])).rows[0];
 const repairObs=(await client.query("SELECT * FROM public.create_hrs_repair_measurement_v1($1,'LOW',NULL)",[relationshipTarget.id])).rows[0];
 const avoidanceObs=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[situationTarget.id])).rows[0];
 const motivationObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'HIGH',NULL)",[goalTarget.id])).rows[0];
 // Communication can never calculate or correct a Repair, Trust, HBS, or
 // HSE observation...
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[repairObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[trustObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[avoidanceObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[motivationObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[repairObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[trustObs.id]);
 // ...Repair can never calculate or correct a Communication, Trust, HBS, or
 // HSE observation...
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[commObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[trustObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[avoidanceObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[motivationObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[commObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[trustObs.id]);
 // ...Relationship Trust can never calculate or correct the new
 // observations...
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[commObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[repairObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[commObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[repairObs.id]);
 // ...and no representative HBS/HSE calculator can score the new
 // observations either.
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[commObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[commObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[commObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[repairObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[repairObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[repairObs.id]);
 const trustSnap=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[trustObs.id])).rows[0];
 const commSnap=(await client.query('SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[commObs.id])).rows[0];
 const repairSnap=(await client.query('SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[repairObs.id])).rows[0];
 if(trustSnap.numeric_value!==1||commSnap.numeric_value!==5||repairSnap.numeric_value!==2)throw new Error('Freely differing Trust/Communication/Repair values on the same relationship failed');
 // No hrs.emotional-safety observation, result, or snapshot was fabricated
 // by any of the above: that metric remains entirely unobserved.
 if((await client.query("SELECT count(*)::int n FROM public.him_measurement_observations WHERE metric_key='hrs.emotional-safety'")).rows[0].n!==0)throw new Error('hrs.emotional-safety must remain unobserved');
 if((await client.query("SELECT count(*)::int n FROM public.him_metric_snapshots WHERE metric_key='hrs.emotional-safety'")).rows[0].n!==0)throw new Error('hrs.emotional-safety must have no snapshot');
 // Each calculation result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 for(const[m,obs]of[[COMM,commObs],[REPAIR,repairObs]]){
  const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[obs.id]);
  if(provenance.rows.length!==1||provenance.rows[0].metric_key!==m.key||provenance.rows[0].binding_metric!==m.key||provenance.rows[0].model_id!==m.model||provenance.rows[0].instrument_id!==m.instrument)throw new Error(`${m.key} calculation provenance failed`);
 }
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // Both frozen v1 read surfaces reject Communication, Repair, and the
 // RELATIONSHIP context outright - even for the owner of a real target -
 // and the existing SITUATION/CONVERSATION_SESSION slot sets stay exact.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.communication',1,'RELATIONSHIP',$2,now()-interval '30 days',now())",[one,relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.repair',1,'RELATIONSHIP',$2,now()-interval '30 days',now())",[one,relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.communication',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.repair',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_intelligence_snapshot_v1('RELATIONSHIP',$1)",[relationshipTarget.id]);
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key).sort();
 if(situationIntelligence.join()!=='hse.attention,hse.motivation,hse.self-confidence,hse.stress')throw new Error('SITUATION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Communication or Repair');
 const sessionIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne])).rows.map(x=>x.metric_key).sort();
 if(sessionIntelligence.join()!=='hse.attention,hse.energy,hse.stress')throw new Error('CONVERSATION_SESSION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Communication or Repair');
 // --- Cross-user / anon authority ---------------------------------------------
 const commScored=(await client.query("SELECT * FROM public.create_hrs_communication_measurement_v1($1,'HIGH',NULL)",[relationshipTarget.id])).rows[0];
 const repairScored=(await client.query("SELECT * FROM public.create_hrs_repair_measurement_v1($1,'HIGH',NULL)",[relationshipTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key=ANY(ARRAY['hrs.communication','hrs.repair'])")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key=ANY(ARRAY['hrs.communication','hrs.repair'])")).rowCount!==0)throw new Error('Owner-only Communication/Repair read isolation failed');
 await rejects(client,"SELECT * FROM public.create_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[commScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[commScored.id]);
 await rejects(client,"SELECT * FROM public.create_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[repairScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[repairScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,"SELECT * FROM public.create_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[commScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[commScored.id]);
 await rejects(client,"SELECT * FROM public.create_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[repairScored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[repairScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 // Proven independently for each metric in its own advisory-lock namespace.
 for(const m of[COMM,REPAIR]){
  await client.query('BEGIN');await identity(client,one);
  const racedTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with my manager')")).rows[0];
  const raced=(await client.query(`SELECT * FROM public.${m.create}($1,'LOW',NULL)`,[racedTarget.id])).rows[0];
  await client.query('COMMIT');
  const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
  try{
   await client.query('BEGIN');await identity(client,one);
   await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('${m.lock}'||$1::text,0))`,[raced.id]);
   await client.query('RESET ROLE');
   await racer.query('BEGIN');await identity(racer,one);
   const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
   const waiting=racer.query(`SELECT * FROM public.${m.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
   let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
   if(!blocked)throw new Error(`${m.key} calculation did not wait on the correction lock`);
   await identity(client,one);
   await client.query(`SELECT * FROM public.${m.correct}($1,'VERY_HIGH',NULL)`,[raced.id]);
   await client.query('COMMIT');
   if(!(await waiting))throw new Error(`Superseded ${m.key} was calculated after the correction won the race`);
   await racer.query('ROLLBACK');
   const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
   if(artifacts.rows[0].n!==0)throw new Error(`Race created a stale ${m.key} result`);
  }finally{await racer.end();}
 }
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HRS Communication + Repair v1: twelve-calibrated phase state with the prior HSE/HBS/Trust metrics unchanged, HRS/UNRESOLVED/null identities for both metrics, exact separate governance artifacts with two exactly-ten-basis approvals and no external validation claim, reuse of the 0043 owned RELATIONSHIP target substrate with the historical target RPCs still rejecting RELATIONSHIP and no widened HSE/HBS route, owner relationship-bound creation with NULL event temporal windows and untrusted client time, full scored and unassessed semantics for both vocabularies (topic dependence, insufficient basis, missing repair opportunity, and episode dependence all UNASSESSED/null - never zero, never high, never low) with sibling vocabularies rejected, structural cross-metric impossibility in every direction with freely differing Trust=1/Communication=5/Repair=2 values on the same relationship and no fabricated Emotional Safety artifacts, correction/currentness preserving the exact relationship and NULL window per metric, idempotent and race-safe calculation in each dedicated lock namespace, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
