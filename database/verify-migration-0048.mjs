import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const PA={key:'hgs.purpose-alignment',scale:'hgs.purpose-alignment.congruence-5.v1',model:'hgs.purpose-alignment.direct-structured-current-purpose-congruence',instrument:'hgs.purpose-alignment.direct-goal-bound-purpose-congruence-report',approval:'qandeel.him.purpose-alignment.foundation-approval',method:'DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT',inputContract:'DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT_V1',provenance:'QANDEEL_HGS_PURPOSE_ALIGNMENT_MEASUREMENT_V1',specials:['TOO_VALUE_CONFLICTED_TO_RATE','INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE','NOT_SURE'],create:'create_hgs_purpose_alignment_measurement_v1',correct:'correct_hgs_purpose_alignment_measurement_v1',calculate:'calculate_hgs_purpose_alignment_measurement_v1',lock:'hgs.purpose-alignment.observation:',basis:['HGS_PURPOSE_ALIGNMENT_CURRENT_GOAL_BOUND_PERSONALLY_MEANINGFUL_DIRECTION_CONGRUENCE','DIRECT_STRUCTURED_REPORT','GOAL_ONLY','CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_PURPOSE_CONGRUENCE_5','VALUE_CONFLICT_AND_INSUFFICIENT_DIRECTION_BASIS_FAIL_TO_UNASSESSED','PURPOSE_ALIGNMENT_NOT_MOTIVATION_SELF_AWARENESS_RESILIENCE_CONSISTENCY_HABIT_STRENGTH_GOAL_SUCCESS_OR_MORAL_APPROVAL','NO_AUTONOMOUS_MOTIVATION_OR_VALUE_WEIGHTING_FORMULA','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_CLINICAL_OR_PSYCHOMETRIC_VALIDATION_CLAIM']};
await client.connect();try{
 // --- Phase inventory: this phase's durable historical guarantees ------------
 const state=await client.query('SELECT metric_key,calculation_status,hif_owner,semantic_mapping_status,semantic_type,scale_reference,required_input_contract,valid_context_kinds,dependency_ids,consumers FROM public.him_metric_definitions');
 if(state.rows.length!==17)throw new Error('Expected exactly 17 metric definitions');
 const calibrated=state.rows.filter(x=>x.calculation_status==='CALIBRATED').map(x=>x.metric_key);
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics, the four calibrated HBS metrics, the four calibrated HRS metrics, calibrated hgs.self-awareness, calibrated hgs.resilience, and calibrated hgs.purpose-alignment (a later HIM Expansion task may calibrate more)');
 const definition=state.rows.find(x=>x.metric_key===PA.key);
 // The frozen Foundation identity: HGS ownership with the ALREADY RESOLVED
 // ALIGNMENT semantic mapping preserved exactly - never downgraded to
 // UNRESOLVED/null and never remapped - and GOAL as the only valid context.
 if(definition.hif_owner!=='HGS'||definition.semantic_mapping_status!=='RESOLVED'||definition.semantic_type!=='ALIGNMENT'||definition.scale_reference!==PA.scale||definition.required_input_contract!==PA.inputContract||definition.valid_context_kinds.join()!=='GOAL'||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error('hgs.purpose-alignment definition identity failed');
 // The two HGS siblings and the boundary HSE/HBS/HRS siblings stay
 // calibrated and semantically unchanged - 0048 never rewrites a sibling
 // definition.
 for(const[key,scaleRef,inputContract]of[['hgs.self-awareness','hgs.self-awareness.clarity-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1'],['hgs.resilience','hgs.resilience.adaptive-recovery-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HGS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scaleRef||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 for(const[key,scale]of[['hse.stress','hse.stress.ordinal-5.v1'],['hse.motivation','hse.motivation.ordinal-5.v1'],['hse.self-confidence','hse.self-confidence.ordinal-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HSE'||sibling.semantic_mapping_status!=='RESOLVED'||sibling.semantic_type!=='STATE'||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 for(const[key,owner,scale,inputContract]of[['hbs.consistency','HBS','hbs.consistency.frequency-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'],['hrs.repair','HRS','hrs.repair.effectiveness-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!==owner||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 // --- Purpose Alignment governance: exact dedicated artifacts ----------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[PA.scale]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('hgs.purpose-alignment ordinal scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[PA.model]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==PA.scale||model.rows[0].supported_context_kinds.join()!=='GOAL'||model.rows[0].target_metric_key!==PA.key||model.rows[0].method_type!==PA.method||model.rows[0].required_evidence_contract!=='FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1')throw new Error('hgs.purpose-alignment calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[PA.approval]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==PA.model||!Array.isArray(basis)||basis.length!==PA.basis.length||PA.basis.some(entry=>!basis.includes(entry)))throw new Error('hgs.purpose-alignment exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[PA.key]);
 if(bindings.rows.map(x=>x.context_kind).join()!=='GOAL'||bindings.rows.some(x=>x.model_id!==PA.model||x.instrument_id!==PA.instrument||x.scale_contract_reference!==PA.scale))throw new Error('Expected exactly the one hgs.purpose-alignment GOAL ACTIVE binding');
 // --- Sibling isolation inside the owned functions ----------------------------
 // Historical scope: exactly the three functions INTRODUCED AND OWNED BY
 // 0048 are queried by exact name and inspected - a future legitimate
 // Purpose Alignment helper, v2 authority, Habit Strength authority, or
 // separately reviewed runtime-consumption function is deliberately NOT
 // forbidden here, and no function-universe scan exists. Each owned
 // function must exist and must neither read nor score any sibling
 // metric, Memory, Evidence, or conversation text - the 0048 executable
 // path scores an ordinal self-report and nothing else, it never infers
 // alignment from motive categories, and it makes zero provider calls.
 const ownedFunctions=['calculate_hgs_purpose_alignment_measurement_v1','correct_hgs_purpose_alignment_measurement_v1','create_hgs_purpose_alignment_measurement_v1'];
 const procs=await client.query('SELECT proname,prosrc FROM pg_proc WHERE proname=ANY($1::name[]) ORDER BY proname',[ownedFunctions]);
 if(procs.rows.map(x=>x.proname).join()!==ownedFunctions.join())throw new Error('Expected the three 0048-owned Purpose Alignment functions to exist');
 // The calculation result's own supporting/contradictory_evidence_refs
 // ledger columns are its provenance shape, not an Evidence read - the
 // forbidden surfaces are the actual sibling metrics, the conversation
 // session table, the Memory/Hypothesis/canonical-Evidence stores, and
 // any moral/safety/recommendation authority.
 for(const proc of procs.rows)if(/hbs\.|hse\.|hrs\.|hgs\.self-awareness|hgs\.resilience|conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items|alignment_detect|openai|anthropic|llm|provider|http|safety_runtime|recommendation/i.test(proc.prosrc))throw new Error(`${proc.proname} must not read any sibling metric, Memory, Evidence, conversation text, provider, or moral/safety/recommendation surface`);
 // Deliberately NO live-database absence check for future sibling HGS
 // measurement authority: historical verifiers run against the fully
 // migrated latest schema, and the later legitimate Habit Strength
 // calibration (and any later Purpose Alignment version/helper or HGS
 // Runtime Consumption contract) creates new functions there. That 0048
 // itself introduced no sibling HGS authority is proven statically against
 // the frozen 0048 migration text in its contract test - never here.
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 // A Purpose Alignment binding can never carry a sibling metric's
 // approval, instrument, or scale (artifacts stay separate even though the
 // numeric shape is the same 1-5), and can never open an unapproved
 // context - including SITUATION, which its HGS siblings support but
 // Purpose Alignment deliberately does not.
 const bindingInsert=`INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hgs.purpose-alignment',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())`;
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000001','GOAL',2,'PENDING',PA.model,PA.instrument,PA.scale,'qandeel.him.self-awareness.foundation-approval']);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000002','GOAL',3,'PENDING',PA.model,'hgs.resilience.direct-target-bound-adaptive-recovery-report',PA.scale,PA.approval]);
 await rejects(client,bindingInsert,['4e000000-0000-4000-8000-000000000003','GOAL',4,'PENDING',PA.model,PA.instrument,'hse.motivation.ordinal-5.v1',PA.approval]);
 for(const context of['SITUATION','RELATIONSHIP','CONVERSATION_SESSION','DECISION','GLOBAL'])await rejects(client,bindingInsert,[randomUUID(),context,5,'PENDING',PA.model,PA.instrument,PA.scale,PA.approval]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='48000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4e000000-0000-4000-8000-000000000007','forged.purpose-alignment.model',1,'hgs.purpose-alignment',1,'CALIBRATED','PRODUCTION','x','x','x','hgs.purpose-alignment.congruence-5.v1','{}'::jsonb,'x',ARRAY['GOAL'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- The owned GOAL target substrate is reused, not reinvented ---------------
 // The existing 0013/0014 target RPCs still create valid targets, and
 // Purpose Alignment accepts no SITUATION, DECISION, RELATIONSHIP, or
 // fabricated target - no HGS-specific target table or
 // Purpose-Alignment-specific target creator exists, and the opaque label
 // is never interpreted semantically.
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const secondGoalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','run every morning')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','difficult team meeting')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','choose launch date')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with Ahmed')")).rows[0];
 if(goalTarget.context_kind!=='GOAL'||situationTarget.context_kind!=='SITUATION'||decisionTarget.context_kind!=='DECISION'||relationshipTarget.context_kind!=='RELATIONSHIP')throw new Error('Existing target creation must remain unchanged');
 // --- Purpose Alignment behavioral proof set ----------------------------------
 // Create: owned GOAL target only - SITUATION is rejected even though the
 // owned target row exists and its HGS siblings support it.
 await rejects(client,`SELECT * FROM public.${PA.create}($1,'MODERATE',NULL)`,[fabricated]);
 await rejects(client,`SELECT * FROM public.${PA.create}($1,'MODERATE',NULL)`,[situationTarget.id]);
 await rejects(client,`SELECT * FROM public.${PA.create}($1,'MODERATE',NULL)`,[decisionTarget.id]);
 await rejects(client,`SELECT * FROM public.${PA.create}($1,'MODERATE',NULL)`,[relationshipTarget.id]);
 // The vocabulary is exact: sibling frequency/engagement codes and every
 // sibling special code - Self-Awareness's, Resilience's, Trust's,
 // Communication's, Repair's, and Emotional Safety's - are rejected, along
 // with fabricated codes.
 for(const invalid of['SOMEWHAT','A_GREAT_DEAL','NOT_AT_ALL','ALMOST_ALWAYS','NEVER','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','TOO_CONTEXT_DEPENDENT_TO_RATE','TOO_TOPIC_DEPENDENT_TO_RATE','TOO_EPISODE_DEPENDENT_TO_RATE','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_VULNERABILITY_DEPENDENT_TO_RATE','PERFECTLY_ALIGNED'])await rejects(client,`SELECT * FROM public.${PA.create}($1,$2,NULL)`,[goalTarget.id,invalid]);
 // Server authority: derived label/kind/id, NULL event window, untrusted
 // client timestamps.
 const probe=(await client.query(`SELECT * FROM public.${PA.create}($1,'MODERATE',$2)`,[goalTarget.id,past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Purpose Alignment client timestamp must stay untrusted diagnostic metadata');
 if(probe.metric_key!==PA.key||probe.context_kind!=='GOAL'||probe.context_id!==goalTarget.id||probe.instrument_id!==PA.instrument||probe.scale_contract_reference!==PA.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT'||probe.canonical_provenance!==PA.provenance)throw new Error('Purpose Alignment server-derived identity failed');
 if(probe.target_label!=='finish thesis draft'||probe.target_context_kind!=='GOAL'||probe.target_context_id!==goalTarget.id)throw new Error('Purpose Alignment server-derived GOAL target label/kind/id failed');
 const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
 if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error('Purpose Alignment event must carry a NULL temporal window');
 // Events are immutable: nobody can retrofit a retrospective period or a
 // before/after values window onto the event.
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '30 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
 // Scored response semantics on isolated measurements, with the frozen
 // RESOLVED/ALIGNMENT snapshot identity preserved on every path.
 for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
  const o=(await client.query(`SELECT * FROM public.${PA.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[o.id])).rows[0];
  if(s.metric_key!==PA.key||s.context_kind!=='GOAL'||s.context_id!==goalTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`Purpose Alignment ${code} mapping failed`);
  if(s.semantic_mapping_status!=='RESOLVED'||s.semantic_type!=='ALIGNMENT')throw new Error(`Purpose Alignment ${code} snapshot must preserve RESOLVED/ALIGNMENT`);
  if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Purpose Alignment ${code} snapshot must carry a NULL temporal window`);
 }
 // All three special codes are UNASSESSED/null: never zero, never a
 // midpoint - a goal serving one important value while materially
 // conflicting with another is never averaged into one scalar, a user
 // without enough personal-direction basis is missing data (not
 // automatically low alignment, and no Self-Awareness dependency is
 // created), and an unconfident report never scores.
 for(const code of PA.specials){
  const o=(await client.query(`SELECT * FROM public.${PA.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='RESOLVED'||s.semantic_type!=='ALIGNMENT'||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Purpose Alignment ${code} must be UNASSESSED null with RESOLVED/ALIGNMENT preserved - never zero, never high, never low, and never a midpoint`);
 }
 // Idempotency + correction: same event, same exact GOAL target.
 const idem=(await client.query(`SELECT * FROM public.${PA.create}($1,'LOW',NULL)`,[goalTarget.id])).rows[0];
 const firstCalc=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[idem.id])).rows[0];
 const retryCalc=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Purpose Alignment recalculation was not idempotent');
 const corrected=(await client.query(`SELECT * FROM public.${PA.correct}($1,'VERY_HIGH',NULL)`,[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!==PA.key)throw new Error('Purpose Alignment correction changed the measurement event or the GOAL target');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error('Purpose Alignment correction must preserve the NULL event window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Purpose Alignment remained current before recalculation');
 const correctedSnapshot=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Purpose Alignment current value failed');
 if(correctedSnapshot.semantic_mapping_status!=='RESOLVED'||correctedSnapshot.semantic_type!=='ALIGNMENT')throw new Error('Corrected Purpose Alignment snapshot must preserve RESOLVED/ALIGNMENT');
 // The superseded observation can neither calculate nor be corrected again.
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[idem.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[idem.id]);
 // Direct assessed snapshot forgery remains blocked.
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:PA.key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'GOAL',contextId:goalTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // The remaining HGS observation cannot be fabricated through the
 // substrate either: the Purpose Alignment authority is metric-exact and
 // the observation contract does not accept the remaining HGS metric key.
 await rejects(client,"INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance,created_at) VALUES($1,$2,$3,'hgs.habit-strength',1,$4,1,$5,1,'GOAL',$6,'MODERATE',now(),'ar-EG','DIRECT_STRUCTURED_USER_REPORT',$7,now())",[randomUUID(),one,probe.measurement_event_id,PA.instrument,PA.scale,goalTarget.id,PA.provenance]);
 // --- Independent constructs: the mandated coexistence proof set --------------
 // On the SAME user and the SAME owned GOAL target, Motivation VERY_HIGH
 // (5) coexists with Purpose Alignment VERY_LOW (1): strongly driven
 // toward a goal that no longer fits what matters - Purpose Alignment is
 // not Motivation. On the second GOAL target Motivation VERY_LOW (1)
 // coexists with Purpose Alignment VERY_HIGH (5): deeply "mine",
 // currently depleted. On the same GOAL, Self-Awareness VERY_HIGH (5)
 // coexists with Purpose Alignment VERY_LOW (1) (clear inside, goal no
 // longer fits), on the second GOAL Self-Awareness VERY_LOW (1) coexists
 // with Purpose Alignment VERY_HIGH (5), and on the same GOAL Resilience
 // VERY_HIGH (5) coexists with Purpose Alignment VERY_LOW (1) (adapting
 // well under challenge in a goal that stopped feeling meaningful) - no
 // DB invariant derives, modifies, or correlates one metric from another,
 // and an HBS Consistency ALMOST_ALWAYS (5) on the same GOAL changes
 // nothing either. No inverse, composite, autonomous-motivation formula,
 // or forced correlation exists in any direction.
 const motivationHighObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const saHighObs=(await client.query("SELECT * FROM public.create_hgs_self_awareness_measurement_v1($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const resHighObs=(await client.query("SELECT * FROM public.create_hgs_resilience_measurement_v1($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const consistencyObs=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[goalTarget.id])).rows[0];
 const paLowGoalObs=(await client.query(`SELECT * FROM public.${PA.create}($1,'VERY_LOW',NULL)`,[goalTarget.id])).rows[0];
 const motivationLowObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_LOW',NULL)",[secondGoalTarget.id])).rows[0];
 const saLowObs=(await client.query("SELECT * FROM public.create_hgs_self_awareness_measurement_v1($1,'VERY_LOW',NULL)",[secondGoalTarget.id])).rows[0];
 const paHighGoalObs=(await client.query(`SELECT * FROM public.${PA.create}($1,'VERY_HIGH',NULL)`,[secondGoalTarget.id])).rows[0];
 const repairObs=(await client.query("SELECT * FROM public.create_hrs_repair_measurement_v1($1,'VERY_HIGH',NULL)",[relationshipTarget.id])).rows[0];
 // Purpose Alignment can never calculate or correct a Motivation,
 // Self-Awareness, Resilience, Consistency, or Repair observation...
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[saHighObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[resHighObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[consistencyObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[repairObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[saHighObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[resHighObs.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[consistencyObs.id]);
 // ...Motivation, Self-Awareness, and Resilience can never calculate or
 // correct the Purpose Alignment observation...
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[paLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[paLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hgs_resilience_measurement_v1($1)',[paLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hse_motivation_measurement($1,'VERY_LOW',NULL)",[paLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hgs_self_awareness_measurement_v1($1,'VERY_LOW',NULL)",[paLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hgs_resilience_measurement_v1($1,'VERY_LOW',NULL)",[paLowGoalObs.id]);
 // ...and no representative HBS/HRS calculator can score the Purpose
 // Alignment observation either.
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[paLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[paLowGoalObs.id]);
 const motivationHighSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationHighObs.id])).rows[0];
 const saHighSnap=(await client.query('SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[saHighObs.id])).rows[0];
 const resHighSnap=(await client.query('SELECT * FROM public.calculate_hgs_resilience_measurement_v1($1)',[resHighObs.id])).rows[0];
 const consistencySnap=(await client.query('SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[consistencyObs.id])).rows[0];
 const paLowGoalSnap=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[paLowGoalObs.id])).rows[0];
 const motivationLowSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationLowObs.id])).rows[0];
 const saLowSnap=(await client.query('SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[saLowObs.id])).rows[0];
 const paHighGoalSnap=(await client.query(`SELECT * FROM public.${PA.calculate}($1)`,[paHighGoalObs.id])).rows[0];
 if(motivationHighSnap.numeric_value!==5||paLowGoalSnap.numeric_value!==1)throw new Error('High Motivation (5) + low Purpose Alignment (1) on the same GOAL failed - Purpose Alignment is not Motivation');
 if(motivationLowSnap.numeric_value!==1||paHighGoalSnap.numeric_value!==5)throw new Error('Low Motivation (1) + high Purpose Alignment (5) on the same GOAL failed');
 if(saHighSnap.numeric_value!==5||paLowGoalSnap.numeric_value!==1)throw new Error('High Self-Awareness (5) + low Purpose Alignment (1) on the same GOAL failed');
 if(saLowSnap.numeric_value!==1||paHighGoalSnap.numeric_value!==5)throw new Error('Low Self-Awareness (1) + high Purpose Alignment (5) on the same GOAL failed');
 if(resHighSnap.numeric_value!==5||paLowGoalSnap.numeric_value!==1)throw new Error('High Resilience (5) + low Purpose Alignment (1) on the same GOAL failed');
 if(consistencySnap.numeric_value!==5||paLowGoalSnap.numeric_value!==1)throw new Error('High Consistency (5) + low Purpose Alignment (1) on the same GOAL failed');
 // The freely differing values changed nothing else: the sibling current
 // values are untouched (no inverse, composite, or derived mutation), and
 // no moral/safety/recommendation-shaped artifact appeared anywhere in
 // the rows this path produced - the metric emits no goal-quality,
 // endorsement, or continue/abandon verdict of any kind.
 const goalCurrent=(await client.query('SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key',[goalTarget.id,[motivationHighObs.id,saHighObs.id,resHighObs.id,consistencyObs.id,paLowGoalObs.id]])).rows;
 if(goalCurrent.map(x=>`${x.metric_key}=${x.numeric_value}`).join()!=='hbs.consistency=5,hgs.purpose-alignment=1,hgs.resilience=5,hgs.self-awareness=5,hse.motivation=5')throw new Error('The Motivation/Self-Awareness/Resilience/Consistency/Purpose-Alignment current values must coexist independently');
 for(const produced of[paLowGoalSnap,paHighGoalSnap,correctedSnapshot])if(Object.values(produced).some(value=>typeof value==='string'&&/\b(GOOD_GOAL|BAD_GOAL|UNSAFE|ILLEGAL|IMMORAL|UNHEALTHY|RECOMMENDED|ENDORSED|ABANDON_GOAL|CONTINUE_GOAL|WISE|UNWISE)\b/i.test(value)))throw new Error('The 0048 Purpose Alignment calculation path must emit no moral/safety/legal/recommendation classification value');
 // Each calculation result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[paLowGoalObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!==PA.key||provenance.rows[0].binding_metric!==PA.key||provenance.rows[0].model_id!==PA.model||provenance.rows[0].instrument_id!==PA.instrument)throw new Error('Purpose Alignment calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // RESOLVED/ALIGNMENT does not create eligibility: both frozen v1 read
 // surfaces reject Purpose Alignment outright - even for the owner of a
 // real GOAL target with real calculated values - and the existing GOAL
 // slot set stays exact with no Purpose Alignment leakage: no
 // increasing/decreasing alignment, values-drift, or purpose-growth
 // reading of any kind exists.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.purpose-alignment',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 const goalIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('GOAL',$1)",[goalTarget.id])).rows.map(x=>x.metric_key).sort();
 if(goalIntelligence.join()!=='hse.motivation')throw new Error('GOAL Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Purpose Alignment');
 // --- Cross-user / anon authority ---------------------------------------------
 const paScored=(await client.query(`SELECT * FROM public.${PA.create}($1,'HIGH',NULL)`,[goalTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hgs.purpose-alignment'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hgs.purpose-alignment'")).rowCount!==0)throw new Error('Owner-only Purpose Alignment read isolation failed');
 await rejects(client,`SELECT * FROM public.${PA.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[paScored.id]);
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[paScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,`SELECT * FROM public.${PA.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${PA.correct}($1,'VERY_LOW',NULL)`,[paScored.id]);
 await rejects(client,`SELECT * FROM public.${PA.calculate}($1)`,[paScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 // Proven in the dedicated hgs.purpose-alignment advisory-lock namespace.
 await client.query('BEGIN');await identity(client,one);
 const racedTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','ship the mobile app rewrite')")).rows[0];
 const raced=(await client.query(`SELECT * FROM public.${PA.create}($1,'LOW',NULL)`,[racedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('${PA.lock}'||$1::text,0))`,[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query(`SELECT * FROM public.${PA.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Purpose Alignment calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query(`SELECT * FROM public.${PA.correct}($1,'VERY_HIGH',NULL)`,[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Purpose Alignment was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Purpose Alignment result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HGS Purpose Alignment v1 - the third HGS metric: sixteen-calibrated phase state with the prior HSE/HBS/HRS metrics, Self-Awareness, and Resilience unchanged, the frozen HGS/RESOLVED/ALIGNMENT Foundation identity preserved exactly (never downgraded to UNRESOLVED/null and never remapped) on the definition and on every produced snapshot, exact dedicated governance artifacts with one exactly-ten-basis approval and no external/clinical/psychometric validation claim, reuse of the owned GOAL target substrate with no HGS-specific target authority and SITUATION/DECISION/RELATIONSHIP/fabricated targets rejected, owner goal-bound creation with NULL event temporal windows (no retrospective period, no goal-progress delta, no values-drift window) and untrusted client time, full scored and unassessed semantics (value conflict, insufficient personal-direction basis, and NOT_SURE all UNASSESSED/null - never zero, never high, never low) with sibling vocabularies rejected, structural cross-metric impossibility in every direction with the mandated coexistence proofs (Motivation=5 with Purpose Alignment=1 and Motivation=1 with Purpose Alignment=5 proving Purpose Alignment is not Motivation, Self-Awareness=5 with Purpose Alignment=1 and Self-Awareness=1 with Purpose Alignment=5, Resilience=5 with Purpose Alignment=1, Consistency=5 with Purpose Alignment=1), no remaining-HGS observation accepted by the substrate (sibling-HGS authority absence proven statically against the frozen 0048 migration text, never against the live function universe), correction/currentness preserving the exact GOAL target and NULL window, idempotent and race-safe calculation in the dedicated lock namespace, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, no moral/safety/legal/recommendation classification of any kind, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption (RESOLVED/ALIGNMENT creates no eligibility) with zero provider calls.');
