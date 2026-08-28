// Real-PostgreSQL verifier for migration 0043 - HRS Relationship Trust
// Measurement & Calibration v1 (HIM Expansion metric 10/17, the first HRS
// metric and the first RELATIONSHIP-bound measurement substrate).
// Behaviorally proves this phase's durable historical guarantees: the exact
// 17-definition catalog in which the five HSE metrics, the four HBS metrics,
// and hrs.relationship-trust are all calibrated (later HIM Expansion phases
// may calibrate more - no global calibrated count, exact permanent
// uncalibrated list, or later-migration ceiling is frozen here; the one-time
// 10/7 transition invariant lives inside migration 0043 itself and ran at
// migration time), Relationship Trust keeps HRS ownership with an
// UNRESOLVED/NULL semantic mapping, and the prior HSE/HBS metrics stay
// calibrated and unchanged; the minimal owned RELATIONSHIP measurement
// target substrate (server-derived owner/kind/provenance, trimmed 1-256
// label, no forgery, anon denied, cross-user denied, GOAL/SITUATION target
// contracts unchanged, and the historical Motivation-named target RPC still
// rejecting RELATIONSHIP); exact Relationship Trust governance artifacts
// with the exactly-ten-basis approval, no external validation claim, no
// dependency edges, and only the one RELATIONSHIP ACTIVE binding; owner-only
// relationship-bound creation with the server-derived target label, a NULL
// event temporal window, and untrusted client timestamps; the full scored +
// unassessed reliance response semantics (TOO_CONTEXT_DEPENDENT_TO_RATE,
// INSUFFICIENT_BASIS_TO_JUDGE, and NOT_SURE are UNASSESSED/null - never
// zero, never low trust, never a midpoint) with sibling vocabularies
// rejected; construct independence (no cross-metric calculation in any
// direction and freely differing sibling values, with no fabricated
// Communication/Repair/Emotional-Safety observations - those metrics remain
// uncalibrated); correction that preserves the same event, the same exact
// relationship, and the NULL window while replacing the one current value;
// idempotent and two-connection race-safe calculation; fail-closed
// cross-user/forgery/anon authority; supersession-aware current reads; and
// explicit Trend v1 + Intelligence Snapshot v1 non-consumption (no safety
// or recommendation surface of any kind). Zero provider/model calls.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionOne=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const SCALE='hrs.relationship-trust.reliance-5.v1',MODEL='hrs.relationship-trust.direct-structured-current-reliance',INSTRUMENT='hrs.relationship-trust.direct-relationship-bound-reliance-report',APPROVAL='qandeel.him.relationship-trust.foundation-approval';
const EXPECTED_BASIS=['HRS_RELATIONSHIP_TRUST_CURRENT_RELIANCE_UNDER_VULNERABILITY','DIRECT_STRUCTURED_REPORT','RELATIONSHIP_BOUND_ONLY','EXPERIENCE_GROUNDED_CURRENT_APPRAISAL','ORDINAL_RELIANCE_5','DOMAIN_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED','TRUST_NOT_EMOTIONAL_SAFETY_COMMUNICATION_REPAIR_OR_OBJECTIVE_TRUSTWORTHINESS','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM'];
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
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics, the four calibrated HBS metrics, and hrs.relationship-trust (later HIM Expansion tasks may calibrate more)');
 const trust=state.rows.find(x=>x.metric_key==='hrs.relationship-trust');
 if(trust.hif_owner!=='HRS'||trust.semantic_mapping_status!=='UNRESOLVED'||trust.semantic_type!==null||trust.scale_reference!==SCALE||trust.required_input_contract!=='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1'||trust.dependency_ids.length!==0||trust.consumers.length!==0)throw new Error('hrs.relationship-trust definition identity failed');
 // The four HBS metrics stay calibrated and semantically unchanged.
 for(const[key,scale]of[['hbs.avoidance','hbs.avoidance.frequency-5.v1'],['hbs.consistency','hbs.consistency.frequency-5.v1'],['hbs.initiative','hbs.initiative.frequency-5.v1'],['hbs.reflection','hbs.reflection.engagement-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HBS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 // --- Relationship Trust governance -------------------------------------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[SCALE]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('Relationship Trust ordinal reliance scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[MODEL]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==SCALE||model.rows[0].supported_context_kinds.join()!=='RELATIONSHIP'||model.rows[0].target_metric_key!=='hrs.relationship-trust'||model.rows[0].method_type!=='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT')throw new Error('Relationship Trust calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[APPROVAL]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==MODEL||!Array.isArray(basis)||basis.length!==EXPECTED_BASIS.length||EXPECTED_BASIS.some(entry=>!basis.includes(entry)))throw new Error('Relationship Trust exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key='hrs.relationship-trust' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind");
 if(bindings.rows.map(x=>x.context_kind).join()!=='RELATIONSHIP'||bindings.rows.some(x=>x.model_id!==MODEL||x.instrument_id!==INSTRUMENT||x.scale_contract_reference!==SCALE))throw new Error('Expected exactly the one Relationship Trust RELATIONSHIP ACTIVE binding');
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel)VALUES($1,$2,'ACTIVE','TEXT')ON CONFLICT DO NOTHING",[sessionOne,one]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 const bindingInsert="INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hrs.relationship-trust',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())";
 // A Relationship Trust binding can never carry a foreign approval,
 // instrument, or scale, and can never open an unapproved context.
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000001','RELATIONSHIP',2,'PENDING',MODEL,INSTRUMENT,SCALE,'qandeel.him.reflection.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000002','RELATIONSHIP',3,'PENDING',MODEL,'hbs.reflection.direct-context-bound-reflective-engagement-report',SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000003','RELATIONSHIP',4,'PENDING',MODEL,INSTRUMENT,'hbs.avoidance.frequency-5.v1',APPROVAL]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000004','GOAL',2,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000005','SITUATION',3,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000006','CONVERSATION_SESSION',4,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000007','DECISION',5,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000008','GLOBAL',6,'PENDING',MODEL,INSTRUMENT,SCALE,APPROVAL]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='43000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4f000000-0000-4000-8000-000000000009','forged.relationship-trust.model',1,'hrs.relationship-trust',1,'CALIBRATED','PRODUCTION','x','x','x','hrs.relationship-trust.reliance-5.v1','{}'::jsonb,'x',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- RELATIONSHIP measurement-target substrate --------------------------------
 // The owner creates a private RELATIONSHIP target through the narrow RPC:
 // the server derives owner, RELATIONSHIP kind, UUID, and canonical
 // provenance from nothing but a bounded trimmed label.
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with Ahmed')")).rows[0];
 if(relationshipTarget.user_id!==one||relationshipTarget.context_kind!=='RELATIONSHIP'||relationshipTarget.display_text!=='my relationship with Ahmed'||relationshipTarget.canonical_provenance!=='QANDEEL_HIM_MEASUREMENT_TARGET_V1')throw new Error('Server-derived RELATIONSHIP target identity failed');
 // The trimmed 1-256 label contract is enforced.
 await rejects(client,"SELECT * FROM public.create_him_relationship_measurement_target_v1(' padded ')");
 await rejects(client,"SELECT * FROM public.create_him_relationship_measurement_target_v1('')");
 await rejects(client,'SELECT * FROM public.create_him_relationship_measurement_target_v1($1)',['x'.repeat(257)]);
 await rejects(client,'SELECT * FROM public.create_him_relationship_measurement_target_v1(NULL)');
 // A caller can never forge the owner, kind, or provenance: direct target
 // inserts and immutable-row mutations stay blocked for authenticated users.
 await rejects(client,"INSERT INTO public.him_measurement_targets(id,user_id,context_kind,display_text,canonical_provenance) VALUES($1,$2,'RELATIONSHIP','forged','QANDEEL_HIM_MEASUREMENT_TARGET_V1')",[randomUUID(),one]);
 await rejects(client,"UPDATE public.him_measurement_targets SET display_text='rewritten relationship' WHERE id=$1",[relationshipTarget.id]);
 await rejects(client,'DELETE FROM public.him_measurement_targets WHERE id=$1',[relationshipTarget.id]);
 // Existing GOAL/SITUATION target contracts still work unchanged, and the
 // historical Motivation-named target RPC still rejects RELATIONSHIP.
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','difficult team meeting')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','choose launch date')")).rows[0];
 if(goalTarget.context_kind!=='GOAL'||situationTarget.context_kind!=='SITUATION'||decisionTarget.context_kind!=='DECISION')throw new Error('Existing GOAL/SITUATION/DECISION target creation must remain unchanged');
 await rejects(client,"SELECT * FROM public.create_him_motivation_measurement_target('RELATIONSHIP','my marriage')");
 await rejects(client,"SELECT * FROM public.create_him_attention_measurement_context('RELATIONSHIP','my marriage')");
 // The pre-existing GOAL/SITUATION measurement authorities are not widened
 // to the new RELATIONSHIP kind in any direction.
 await rejects(client,"SELECT * FROM public.create_hse_motivation_measurement($1,'MODERATE',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'OFTEN',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'SOMEWHAT',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hbs_reflection_measurement_v1('RELATIONSHIP',$1,'SOMEWHAT',NULL)",[relationshipTarget.id]);
 // --- Create: owned RELATIONSHIP target only, NULL window ---------------------
 await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'MODERATE',NULL)",[fabricated]);
 await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'MODERATE',NULL)",[goalTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'MODERATE',NULL)",[situationTarget.id]);
 await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'MODERATE',NULL)",[decisionTarget.id]);
 // The Relationship Trust reliance vocabulary is exact: sibling frequency
 // and engagement codes and every sibling special code are rejected.
 for(const invalid of['SOMEWHAT','ALMOST_ALWAYS','NEVER','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','COMPLETE_TRUST'])await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,$2,NULL)",[relationshipTarget.id,invalid]);
 // Server authority: derived label/kind/id, NULL event window, untrusted
 // client timestamps.
 const probe=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'MODERATE',$2)",[relationshipTarget.id,past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Client timestamp must stay untrusted diagnostic metadata');
 if(probe.metric_key!=='hrs.relationship-trust'||probe.context_kind!=='RELATIONSHIP'||probe.context_id!==relationshipTarget.id||probe.instrument_id!==INSTRUMENT||probe.scale_contract_reference!==SCALE||probe.source!=='DIRECT_STRUCTURED_USER_REPORT')throw new Error('Server-derived Relationship Trust identity failed');
 if(probe.target_label!=='my relationship with Ahmed'||probe.target_context_kind!=='RELATIONSHIP'||probe.target_context_id!==relationshipTarget.id)throw new Error('Server-derived RELATIONSHIP target label/kind/id failed');
 const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
 if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error('Relationship Trust event must carry a NULL temporal window');
 // Events are immutable: nobody can retrofit a window onto a Trust event.
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '7 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
 // --- Response semantics on isolated measurements ------------------------------
 for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
  const o=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,$2,NULL)",[relationshipTarget.id,code])).rows[0];
  const s=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[o.id])).rows[0];
  if(s.metric_key!=='hrs.relationship-trust'||s.context_kind!=='RELATIONSHIP'||s.context_id!==relationshipTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`${code} reliance mapping failed`);
  if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`${code} snapshot must stay UNRESOLVED/null`);
  if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`${code} snapshot must carry a NULL temporal window`);
 }
 // Domain dependence, insufficient basis, and NOT_SURE are UNASSESSED/null:
 // never zero, never low trust, never a midpoint.
 for(const code of['TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE']){
  const o=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,$2,NULL)",[relationshipTarget.id,code])).rows[0];
  const s=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`${code} must be UNASSESSED null, never zero and never a midpoint`);
 }
 // --- Idempotency + correction: same event, same exact relationship ----------
 const idem=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'LOW',NULL)",[relationshipTarget.id])).rows[0];
 const firstCalc=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[idem.id])).rows[0];
 const retryCalc=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Relationship Trust recalculation was not idempotent');
 const corrected=(await client.query("SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_HIGH',NULL)",[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!=='hrs.relationship-trust')throw new Error('Relationship Trust correction changed the measurement event or the relationship');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error('Relationship Trust correction must preserve the NULL event window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Relationship Trust remained current before recalculation');
 const correctedSnapshot=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Relationship Trust current value failed');
 if(correctedSnapshot.temporal_window_start!==null||correctedSnapshot.temporal_window_end!==null)throw new Error('Corrected Relationship Trust snapshot must keep a NULL temporal window');
 // The superseded observation can neither calculate nor be corrected again.
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[idem.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[idem.id]);
 // --- Direct assessed snapshot forgery remains blocked ------------------------
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:'hrs.relationship-trust',definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'RELATIONSHIP',contextId:relationshipTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // --- Independent constructs ---------------------------------------------------
 // Communication, Repair, and Emotional Safety remain uncalibrated - no
 // observation is fabricated for them. Independence is proven against the
 // calibrated HBS/HSE substrate: cross-metric calculation and correction
 // are structurally impossible in every direction, and values differ freely
 // with no DB-forced composite.
 const trustObs=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id])).rows[0];
 const avoidanceObs=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[situationTarget.id])).rows[0];
 const reflectionObs=(await client.query("SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'A_GREAT_DEAL',NULL)",[situationTarget.id])).rows[0];
 const motivationObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'HIGH',NULL)",[goalTarget.id])).rows[0];
 // A Trust observation can never calculate as an HBS/HSE sibling...
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[trustObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[trustObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[trustObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[trustObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[trustObs.id]);
 // ...and no non-Trust observation can ever calculate as Trust.
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[avoidanceObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[reflectionObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[motivationObs.id]);
 // Cross-metric correction is equally fail-closed.
 await rejects(client,"SELECT * FROM public.correct_hbs_avoidance_measurement_v1($1,'NEVER',NULL)",[trustObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[avoidanceObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[reflectionObs.id]);
 // Values differ freely: very low Trust coexists with high Avoidance and
 // high Reflection for the same user with no DB invariant forcing inverse
 // or correlated values, and no sibling score is ever an input to the
 // Relationship Trust calculation.
 const trustSnap=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[trustObs.id])).rows[0];
 const avoidanceSnap=(await client.query('SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[avoidanceObs.id])).rows[0];
 if(trustSnap.numeric_value!==1||avoidanceSnap.numeric_value!==5)throw new Error('Independent Trust/Avoidance values failed');
 // The Relationship Trust result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[trustObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!=='hrs.relationship-trust'||provenance.rows[0].binding_metric!=='hrs.relationship-trust'||provenance.rows[0].model_id!==MODEL||provenance.rows[0].instrument_id!==INSTRUMENT)throw new Error('Relationship Trust calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // Both frozen v1 read surfaces reject Relationship Trust and the
 // RELATIONSHIP context outright - even for the owner of a real target.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.relationship-trust',1,'RELATIONSHIP',$2,now()-interval '30 days',now())",[one,relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.relationship-trust',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_intelligence_snapshot_v1('RELATIONSHIP',$1)",[relationshipTarget.id]);
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key).sort();
 if(situationIntelligence.join()!=='hse.attention,hse.motivation,hse.self-confidence,hse.stress')throw new Error('SITUATION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Relationship Trust');
 const sessionIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne])).rows.map(x=>x.metric_key).sort();
 if(sessionIntelligence.join()!=='hse.attention,hse.energy,hse.stress')throw new Error('CONVERSATION_SESSION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Relationship Trust');
 // --- Cross-user / anon authority ---------------------------------------------
 const scored=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'HIGH',NULL)",[relationshipTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hrs.relationship-trust'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hrs.relationship-trust'")).rowCount!==0)throw new Error('Owner-only Relationship Trust read isolation failed');
 await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[scored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[scored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,"SELECT * FROM public.create_him_relationship_measurement_target_v1('anon relationship')");
 await rejects(client,"SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[scored.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[scored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 await client.query('BEGIN');await identity(client,one);
 const racedTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with my manager')")).rows[0];
 const raced=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'LOW',NULL)",[racedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('hrs.relationship-trust.observation:'||$1::text,0))",[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Relationship Trust calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query("SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_HIGH',NULL)",[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Relationship Trust was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Relationship Trust result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HRS Relationship Trust v1: five-HSE-plus-four-HBS-plus-Trust calibration with the prior metrics unchanged, HRS/UNRESOLVED/null identity, exact governance artifacts with the exactly-ten-basis approval and no external validation claim, the minimal owned RELATIONSHIP target substrate with unchanged GOAL/SITUATION contracts and a Motivation target RPC that still rejects RELATIONSHIP, owner relationship-bound creation with the NULL event temporal window and untrusted client time, full scored and unassessed reliance response semantics with sibling vocabularies rejected, structural cross-metric impossibility with freely differing sibling values and no fabricated HRS siblings, correction/currentness preserving the exact relationship and NULL window, idempotent and race-safe calculation, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
