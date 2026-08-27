// Real-PostgreSQL verifier for migration 0045 - HRS Emotional Safety
// Measurement & Calibration v1 (HIM Expansion metric 13/17, the fourth and
// final HRS metric on the reusable owned RELATIONSHIP substrate - HRS
// FAMILY COMPLETE for measurement; runtime consumption stays a later,
// separately reviewed contract). Behaviorally proves this phase's durable
// historical guarantees: the exact 17-definition catalog in which the five
// HSE metrics, the four HBS metrics, and all four HRS metrics are
// calibrated (later HIM Expansion phases may calibrate more - no global
// calibrated count, exact permanent uncalibrated list, or later-migration
// ceiling is frozen here; the one-time 13/4 transition invariant lives
// inside migration 0045 itself and ran at migration time); Emotional
// Safety keeps HRS ownership with an UNRESOLVED/NULL semantic mapping
// while the prior HSE/HBS metrics and Trust/Communication/Repair stay
// calibrated and unchanged; the 0043 RELATIONSHIP target substrate is
// reused unchanged (the historical Motivation/Attention target RPCs still
// reject RELATIONSHIP, GOAL/SITUATION/DECISION creation still works, no
// HSE/HBS route is widened to RELATIONSHIP, and no second target authority
// exists); exact Emotional Safety governance artifacts with one
// exactly-ten-basis approval, no external validation claim, no dependency
// edges, and only the one RELATIONSHIP ACTIVE binding; owner-only
// relationship-bound creation with server-derived target labels, NULL
// event temporal windows, and untrusted client timestamps; the full scored
// + unassessed semantics (TOO_VULNERABILITY_DEPENDENT_TO_RATE,
// INSUFFICIENT_BASIS_TO_JUDGE, and NOT_SURE are UNASSESSED/null - never
// zero, never a midpoint, never low safety, and never high safety) with
// sibling vocabularies rejected; construct independence (no cross-metric
// calculation or correction in any direction among Emotional Safety,
// Trust, Communication, Repair, HBS, and HSE, and the mandated freely
// differing Trust=5 / Communication=4 / Repair=3 / Emotional Safety=1
// values on the same relationship target with no DB-forced composite,
// inverse, or hidden relationship-health value); correction that preserves
// the same event, the same exact relationship, and the NULL window while
// replacing the one current value; idempotent and two-connection race-safe
// calculation; fail-closed cross-user/forgery/anon authority; no safety
// verdict and no Safety Runtime read or mutation in any dedicated function
// (subjective perceived openness safety is never converted into an
// objective safety, abuse, or danger classification); and explicit Trend
// v1 + Intelligence Snapshot v1 non-consumption with the exact SITUATION
// and CONVERSATION_SESSION slot sets unchanged. Zero provider/model calls.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionOne=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const ES={key:'hrs.emotional-safety',scale:'hrs.emotional-safety.openness-safety-5.v1',model:'hrs.emotional-safety.direct-structured-current-emotional-openness-safety',instrument:'hrs.emotional-safety.direct-relationship-bound-emotional-openness-safety-report',approval:'qandeel.him.emotional-safety.foundation-approval',method:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT',inputContract:'DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT_V1',provenance:'QANDEEL_HRS_EMOTIONAL_SAFETY_MEASUREMENT_V1',specials:['TOO_VULNERABILITY_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'],create:'create_hrs_emotional_safety_measurement_v1',correct:'correct_hrs_emotional_safety_measurement_v1',calculate:'calculate_hrs_emotional_safety_measurement_v1',lock:'hrs.emotional-safety.observation:',basis:['HRS_EMOTIONAL_SAFETY_CURRENT_PERCEIVED_SAFETY_FOR_EMOTIONAL_OPENNESS','DIRECT_STRUCTURED_REPORT','RELATIONSHIP_BOUND_ONLY','EXPERIENCE_GROUNDED_CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_OPENNESS_SAFETY_5','VULNERABILITY_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED','EMOTIONAL_SAFETY_NOT_TRUST_COMMUNICATION_REPAIR_OR_OBJECTIVE_ABUSE_SAFETY','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM']};
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
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics, the four calibrated HBS metrics, and all four calibrated HRS metrics (later HIM Expansion tasks may calibrate more)');
 const definition=state.rows.find(x=>x.metric_key===ES.key);
 if(definition.hif_owner!=='HRS'||definition.semantic_mapping_status!=='UNRESOLVED'||definition.semantic_type!==null||definition.scale_reference!==ES.scale||definition.required_input_contract!==ES.inputContract||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error('hrs.emotional-safety definition identity failed');
 // The three prior HRS metrics stay calibrated and semantically unchanged -
 // 0045 never rewrites a sibling definition.
 for(const[key,scale,inputContract]of[['hrs.relationship-trust','hrs.relationship-trust.reliance-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1'],['hrs.communication','hrs.communication.workability-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1'],['hrs.repair','hrs.repair.effectiveness-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HRS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 // The four HBS metrics stay calibrated and semantically unchanged.
 for(const[key,scale]of[['hbs.avoidance','hbs.avoidance.frequency-5.v1'],['hbs.consistency','hbs.consistency.frequency-5.v1'],['hbs.initiative','hbs.initiative.frequency-5.v1'],['hbs.reflection','hbs.reflection.engagement-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HBS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 // --- Emotional Safety governance: exact dedicated artifacts -----------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[ES.scale]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('hrs.emotional-safety ordinal scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[ES.model]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==ES.scale||model.rows[0].supported_context_kinds.join()!=='RELATIONSHIP'||model.rows[0].target_metric_key!==ES.key||model.rows[0].method_type!==ES.method)throw new Error('hrs.emotional-safety calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[ES.approval]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==ES.model||!Array.isArray(basis)||basis.length!==ES.basis.length||ES.basis.some(entry=>!basis.includes(entry)))throw new Error('hrs.emotional-safety exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[ES.key]);
 if(bindings.rows.map(x=>x.context_kind).join()!=='RELATIONSHIP'||bindings.rows.some(x=>x.model_id!==ES.model||x.instrument_id!==ES.instrument||x.scale_contract_reference!==ES.scale))throw new Error('Expected exactly the one hrs.emotional-safety RELATIONSHIP ACTIVE binding');
 // --- No safety verdict and no Safety Runtime surface in the 0045-owned path ---
 // The word "Safety" in the metric name grants no system Safety authority.
 // Historical scope: exactly the three functions INTRODUCED AND OWNED BY
 // 0045 are queried by exact name and inspected - a future legitimate
 // Emotional Safety helper, v2 authority, or separately reviewed
 // runtime-consumption function is deliberately NOT forbidden here (no
 // "%emotional_safety%" function-universe ceiling exists). Each owned
 // function must exist and must neither read nor mutate the Safety
 // Runtime's dispatch disposition, conversation state, or any
 // verdict-shaped artifact - the 0045 executable path scores an ordinal
 // self-report and nothing else.
 const ownedFunctions=['calculate_hrs_emotional_safety_measurement_v1','correct_hrs_emotional_safety_measurement_v1','create_hrs_emotional_safety_measurement_v1'];
 const procs=await client.query('SELECT proname,prosrc FROM pg_proc WHERE proname=ANY($1::name[]) ORDER BY proname',[ownedFunctions]);
 if(procs.rows.map(x=>x.proname).join()!==ownedFunctions.join())throw new Error('Expected the three 0045-owned Emotional Safety functions to exist');
 for(const proc of procs.rows)if(/safety_disposition|intelligence_dispatches|conversation_turns|response_gate|\bunsafe\b|abuse|coercion|gaslight|manipulat|harass|danger|imminent|stay_or_leave|verdict|risk_level/i.test(proc.prosrc))throw new Error(`${proc.proname} must not read or mutate Safety Runtime state or emit any safety/abuse/danger verdict`);
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel)VALUES($1,$2,'ACTIVE','TEXT')ON CONFLICT DO NOTHING",[sessionOne,one]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 // An Emotional Safety binding can never carry a sibling metric's approval,
 // instrument, or scale (artifacts stay separate even though all four HRS
 // scales share the 1-5 shape), and can never open an unapproved context.
 const bindingInsert=`INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hrs.emotional-safety',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())`;
 await rejects(client,bindingInsert,['4b000000-0000-4000-8000-000000000001','RELATIONSHIP',2,'PENDING',ES.model,ES.instrument,ES.scale,'qandeel.him.repair.foundation-approval']);
 await rejects(client,bindingInsert,['4b000000-0000-4000-8000-000000000002','RELATIONSHIP',3,'PENDING',ES.model,'hrs.communication.direct-relationship-bound-communication-workability-report',ES.scale,ES.approval]);
 await rejects(client,bindingInsert,['4b000000-0000-4000-8000-000000000003','RELATIONSHIP',4,'PENDING',ES.model,ES.instrument,'hrs.relationship-trust.reliance-5.v1',ES.approval]);
 for(const context of['GOAL','SITUATION','CONVERSATION_SESSION','DECISION','GLOBAL'])await rejects(client,bindingInsert,[randomUUID(),context,5,'PENDING',ES.model,ES.instrument,ES.scale,ES.approval]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='45000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4b000000-0000-4000-8000-000000000007','forged.emotional-safety.model',1,'hrs.emotional-safety',1,'CALIBRATED','PRODUCTION','x','x','x','hrs.emotional-safety.openness-safety-5.v1','{}'::jsonb,'x',ARRAY['RELATIONSHIP'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
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
 // --- Emotional Safety behavioral proof set -----------------------------------
 // Create: owned RELATIONSHIP target only.
 await rejects(client,`SELECT * FROM public.${ES.create}($1,'MODERATE',NULL)`,[fabricated]);
 await rejects(client,`SELECT * FROM public.${ES.create}($1,'MODERATE',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${ES.create}($1,'MODERATE',NULL)`,[situationTarget.id]);
 await rejects(client,`SELECT * FROM public.${ES.create}($1,'MODERATE',NULL)`,[decisionTarget.id]);
 // The vocabulary is exact: sibling frequency/engagement codes and every
 // sibling special code - Trust's, Communication's, and Repair's - are
 // rejected, along with fabricated codes.
 for(const invalid of['SOMEWHAT','ALMOST_ALWAYS','NEVER','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','TOO_CONTEXT_DEPENDENT_TO_RATE','TOO_TOPIC_DEPENDENT_TO_RATE','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','PERFECTLY_SAFE'])await rejects(client,`SELECT * FROM public.${ES.create}($1,$2,NULL)`,[relationshipTarget.id,invalid]);
 // Server authority: derived label/kind/id, NULL event window, untrusted
 // client timestamps.
 const probe=(await client.query(`SELECT * FROM public.${ES.create}($1,'MODERATE',$2)`,[relationshipTarget.id,past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Emotional Safety client timestamp must stay untrusted diagnostic metadata');
 if(probe.metric_key!==ES.key||probe.context_kind!=='RELATIONSHIP'||probe.context_id!==relationshipTarget.id||probe.instrument_id!==ES.instrument||probe.scale_contract_reference!==ES.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT'||probe.canonical_provenance!==ES.provenance)throw new Error('Emotional Safety server-derived identity failed');
 if(probe.target_label!=='my relationship with Ahmed'||probe.target_context_kind!=='RELATIONSHIP'||probe.target_context_id!==relationshipTarget.id)throw new Error('Emotional Safety server-derived RELATIONSHIP target label/kind/id failed');
 const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
 if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error('Emotional Safety event must carry a NULL temporal window');
 // Events are immutable: nobody can retrofit a window onto the event.
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '7 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
 // Scored response semantics on isolated measurements.
 for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
  const o=(await client.query(`SELECT * FROM public.${ES.create}($1,$2,NULL)`,[relationshipTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${ES.calculate}($1)`,[o.id])).rows[0];
  if(s.metric_key!==ES.key||s.context_kind!=='RELATIONSHIP'||s.context_id!==relationshipTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`Emotional Safety ${code} mapping failed`);
  if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`Emotional Safety ${code} snapshot must stay UNRESOLVED/null`);
  if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Emotional Safety ${code} snapshot must carry a NULL temporal window`);
 }
 // The special codes and NOT_SURE are UNASSESSED/null: never zero, never a
 // midpoint - vulnerability-dependent safety and missing basis are neither
 // low safety nor high safety, and a sparse relationship never scores.
 for(const code of ES.specials){
  const o=(await client.query(`SELECT * FROM public.${ES.create}($1,$2,NULL)`,[relationshipTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${ES.calculate}($1)`,[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Emotional Safety ${code} must be UNASSESSED null, never zero, never high, never low, and never a midpoint`);
 }
 // Idempotency + correction: same event, same exact relationship.
 const idem=(await client.query(`SELECT * FROM public.${ES.create}($1,'LOW',NULL)`,[relationshipTarget.id])).rows[0];
 const firstCalc=(await client.query(`SELECT * FROM public.${ES.calculate}($1)`,[idem.id])).rows[0];
 const retryCalc=(await client.query(`SELECT * FROM public.${ES.calculate}($1)`,[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Emotional Safety recalculation was not idempotent');
 const corrected=(await client.query(`SELECT * FROM public.${ES.correct}($1,'VERY_HIGH',NULL)`,[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!==ES.key)throw new Error('Emotional Safety correction changed the measurement event or the relationship');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error('Emotional Safety correction must preserve the NULL event window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Emotional Safety remained current before recalculation');
 const correctedSnapshot=(await client.query(`SELECT * FROM public.${ES.calculate}($1)`,[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Emotional Safety current value failed');
 // The superseded observation can neither calculate nor be corrected again.
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[idem.id]);
 await rejects(client,`SELECT * FROM public.${ES.correct}($1,'VERY_LOW',NULL)`,[idem.id]);
 // Direct assessed snapshot forgery remains blocked.
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:ES.key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'RELATIONSHIP',contextId:relationshipTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // --- Independent constructs: the mandated 5/4/3/1 coexistence ---------------
 // On the SAME user and the SAME owned RELATIONSHIP target, Relationship
 // Trust VERY_HIGH (5), Communication HIGH (4), Repair MODERATE (3), and
 // Emotional Safety VERY_LOW (1) are all accepted with no DB invariant
 // deriving, modifying, or correlating one from another - no inverse, no
 // composite, no hidden relationship-health value, and a low Emotional
 // Safety value triggers no verdict, mutation, or sibling change of any
 // kind: high Trust with low Emotional Safety stays fully expressible.
 const trustObs=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_HIGH',NULL)",[relationshipTarget.id])).rows[0];
 const commObs=(await client.query("SELECT * FROM public.create_hrs_communication_measurement_v1($1,'HIGH',NULL)",[relationshipTarget.id])).rows[0];
 const repairObs=(await client.query("SELECT * FROM public.create_hrs_repair_measurement_v1($1,'MODERATE',NULL)",[relationshipTarget.id])).rows[0];
 const esObs=(await client.query(`SELECT * FROM public.${ES.create}($1,'VERY_LOW',NULL)`,[relationshipTarget.id])).rows[0];
 const avoidanceObs=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[situationTarget.id])).rows[0];
 const motivationObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'HIGH',NULL)",[goalTarget.id])).rows[0];
 // Emotional Safety can never calculate or correct a Trust, Communication,
 // Repair, HBS, or HSE observation...
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[trustObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[commObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[repairObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[avoidanceObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[motivationObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.correct}($1,'VERY_LOW',NULL)`,[trustObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.correct}($1,'VERY_LOW',NULL)`,[commObs.id]);
 await rejects(client,`SELECT * FROM public.${ES.correct}($1,'VERY_LOW',NULL)`,[repairObs.id]);
 // ...Trust, Communication, and Repair can never calculate or correct the
 // Emotional Safety observation...
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[esObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[esObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[esObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_relationship_trust_measurement_v1($1,'VERY_LOW',NULL)",[esObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_communication_measurement_v1($1,'VERY_LOW',NULL)",[esObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hrs_repair_measurement_v1($1,'VERY_LOW',NULL)",[esObs.id]);
 // ...and no representative HBS/HSE calculator can score the Emotional
 // Safety observation either.
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[esObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[esObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[esObs.id]);
 const trustSnap=(await client.query('SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[trustObs.id])).rows[0];
 const commSnap=(await client.query('SELECT * FROM public.calculate_hrs_communication_measurement_v1($1)',[commObs.id])).rows[0];
 const repairSnap=(await client.query('SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[repairObs.id])).rows[0];
 const esSnap=(await client.query(`SELECT * FROM public.${ES.calculate}($1)`,[esObs.id])).rows[0];
 if(trustSnap.numeric_value!==5||commSnap.numeric_value!==4||repairSnap.numeric_value!==3||esSnap.numeric_value!==1)throw new Error('Freely differing Trust=5/Communication=4/Repair=3/EmotionalSafety=1 values on the same relationship failed');
 // Task-scoped verdict proof: the snapshot rows the 0045 path actually
 // produced - including this deliberately lowest possible Emotional Safety
 // value - carry an ordinal value and canonical provenance only, and no
 // text value anywhere in them is a safety/abuse/danger/stay-leave
 // classification. This proves what the 0045 calculation emits; it is
 // deliberately NOT an assertion about future him_metric_snapshots columns
 // (no permanent global schema ceiling exists here).
 for(const produced of[esSnap,correctedSnapshot])if(Object.values(produced).some(value=>typeof value==='string'&&/\b(UNSAFE|SAFE|ABUSE|ABUSIVE|DANGER|DANGEROUS|AT_RISK|STAY|LEAVE)\b/i.test(value)))throw new Error('The 0045 Emotional Safety calculation path must emit no safety/abuse/danger/stay-leave classification value');
 // The low Emotional Safety value changed nothing else: the sibling current
 // values are untouched (no inverse, composite, or derived mutation), and
 // no verdict-shaped artifact appeared anywhere.
 const currentFour=(await client.query("SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key",[relationshipTarget.id,[trustObs.id,commObs.id,repairObs.id,esObs.id]])).rows;
 if(currentFour.map(x=>`${x.metric_key}=${x.numeric_value}`).join()!=='hrs.communication=4,hrs.emotional-safety=1,hrs.relationship-trust=5,hrs.repair=3')throw new Error('The four HRS current values must coexist independently');
 // Each calculation result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[esObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!==ES.key||provenance.rows[0].binding_metric!==ES.key||provenance.rows[0].model_id!==ES.model||provenance.rows[0].instrument_id!==ES.instrument)throw new Error('Emotional Safety calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // Both frozen v1 read surfaces reject Emotional Safety and the
 // RELATIONSHIP context outright - even for the owner of a real target -
 // and the existing SITUATION/CONVERSATION_SESSION slot sets stay exact.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.emotional-safety',1,'RELATIONSHIP',$2,now()-interval '30 days',now())",[one,relationshipTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hrs.emotional-safety',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_intelligence_snapshot_v1('RELATIONSHIP',$1)",[relationshipTarget.id]);
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key).sort();
 if(situationIntelligence.join()!=='hse.attention,hse.motivation,hse.self-confidence,hse.stress')throw new Error('SITUATION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Emotional Safety');
 const sessionIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne])).rows.map(x=>x.metric_key).sort();
 if(sessionIntelligence.join()!=='hse.attention,hse.energy,hse.stress')throw new Error('CONVERSATION_SESSION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Emotional Safety');
 // --- Cross-user / anon authority ---------------------------------------------
 const esScored=(await client.query(`SELECT * FROM public.${ES.create}($1,'HIGH',NULL)`,[relationshipTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hrs.emotional-safety'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hrs.emotional-safety'")).rowCount!==0)throw new Error('Owner-only Emotional Safety read isolation failed');
 await rejects(client,`SELECT * FROM public.${ES.create}($1,'VERY_LOW',NULL)`,[relationshipTarget.id]);
 await rejects(client,`SELECT * FROM public.${ES.correct}($1,'VERY_LOW',NULL)`,[esScored.id]);
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[esScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,`SELECT * FROM public.${ES.create}($1,'VERY_LOW',NULL)`,[relationshipTarget.id]);
 await rejects(client,`SELECT * FROM public.${ES.correct}($1,'VERY_LOW',NULL)`,[esScored.id]);
 await rejects(client,`SELECT * FROM public.${ES.calculate}($1)`,[esScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 // Proven in the dedicated hrs.emotional-safety advisory-lock namespace.
 await client.query('BEGIN');await identity(client,one);
 const racedTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with my manager')")).rows[0];
 const raced=(await client.query(`SELECT * FROM public.${ES.create}($1,'LOW',NULL)`,[racedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('${ES.lock}'||$1::text,0))`,[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query(`SELECT * FROM public.${ES.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Emotional Safety calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query(`SELECT * FROM public.${ES.correct}($1,'VERY_HIGH',NULL)`,[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Emotional Safety was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Emotional Safety result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HRS Emotional Safety v1 - HRS FAMILY COMPLETE for measurement: thirteen-calibrated phase state with the prior HSE/HBS/Trust/Communication/Repair metrics unchanged, HRS/UNRESOLVED/null identity, exact dedicated governance artifacts with one exactly-ten-basis approval and no external validation claim, reuse of the 0043 owned RELATIONSHIP target substrate with the historical target RPCs still rejecting RELATIONSHIP and no widened HSE/HBS route, owner relationship-bound creation with NULL event temporal windows and untrusted client time, full scored and unassessed semantics (vulnerability dependence, insufficient basis, and NOT_SURE all UNASSESSED/null - never zero, never high, never low) with sibling vocabularies rejected, structural cross-metric impossibility in every direction with the mandated freely differing Trust=5/Communication=4/Repair=3/EmotionalSafety=1 values coexisting on the same relationship, no safety verdict and no Safety Runtime read or mutation in any dedicated function, correction/currentness preserving the exact relationship and NULL window, idempotent and race-safe calculation in the dedicated lock namespace, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
