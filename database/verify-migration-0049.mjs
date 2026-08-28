import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const CANONICAL=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
const HS={key:'hgs.habit-strength',scale:'hgs.habit-strength.automaticity-5.v1',model:'hgs.habit-strength.direct-structured-current-cue-linked-automaticity',instrument:'hgs.habit-strength.direct-target-bound-cue-linked-automaticity-report',approval:'qandeel.him.habit-strength.foundation-approval',method:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT',inputContract:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT_V1',provenance:'QANDEEL_HGS_HABIT_STRENGTH_MEASUREMENT_V1',specials:['INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE','NO_SINGLE_RECURRING_PATTERN_TO_RATE','TOO_CUE_DEPENDENT_TO_RATE','NOT_SURE'],create:'create_hgs_habit_strength_measurement_v1',correct:'correct_hgs_habit_strength_measurement_v1',calculate:'calculate_hgs_habit_strength_measurement_v1',lock:'hgs.habit-strength.observation:',basis:['HGS_HABIT_STRENGTH_CURRENT_TARGET_BOUND_CUE_LINKED_AUTOMATICITY','DIRECT_STRUCTURED_REPORT','GOAL_SITUATION_ONLY','SUFFICIENT_REPETITION_BASIS_CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_AUTOMATICITY_5','INSUFFICIENT_REPETITION_NO_SINGLE_PATTERN_AND_CUE_DEPENDENCE_FAIL_TO_UNASSESSED','HABIT_STRENGTH_NOT_CONSISTENCY_FREQUENCY_INITIATIVE_MOTIVATION_PURPOSE_ALIGNMENT_GRIT_OR_COMPULSION','NO_BEHAVIOR_INFERENCE_NO_STREAK_OR_TIME_TO_HABIT_FORMULA','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_CLINICAL_OR_PSYCHOMETRIC_VALIDATION_CLAIM']};
await client.connect();try{
 // --- Phase inventory: this phase's durable historical guarantees ------------
 // Durable scope only: every canonical v1 metric identity exists and holds
 // its approved calibration contract. No global calibrated/uncalibrated
 // count is frozen and no ceiling is placed on later migrations,
 // definition versions, or separately reviewed contracts.
 const state=await client.query('SELECT metric_key,calculation_status,hif_owner,semantic_mapping_status,semantic_type,scale_reference,required_input_contract,valid_context_kinds,dependency_ids,consumers FROM public.him_metric_definitions WHERE definition_version=1');
 const present=state.rows.map(x=>x.metric_key);
 if(CANONICAL.some(key=>!present.includes(key)))throw new Error('Expected every canonical v1 metric identity to exist');
 const calibrated=state.rows.filter(x=>x.calculation_status==='CALIBRATED').map(x=>x.metric_key);
 if(CANONICAL.some(key=>!calibrated.includes(key)))throw new Error('Expected all seventeen canonical v1 metrics calibrated - five HSE, four HBS, four HRS, and four HGS - completing the v1 measurement inventory');
 const definition=state.rows.find(x=>x.metric_key===HS.key);
 // The frozen Foundation identity: HGS ownership with the deliberately
 // unresolved NULL semantic mapping preserved exactly - no HABIT,
 // AUTOMATICITY, or ROUTINE semantic type invented - and GOAL/SITUATION
 // as the only valid contexts.
 if(definition.hif_owner!=='HGS'||definition.semantic_mapping_status!=='UNRESOLVED'||definition.semantic_type!==null||definition.scale_reference!==HS.scale||definition.required_input_contract!==HS.inputContract||definition.valid_context_kinds.join()!=='GOAL,SITUATION'||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error('hgs.habit-strength definition identity failed');
 // The three HGS siblings and the boundary HSE/HBS/HRS siblings stay
 // calibrated and semantically unchanged - 0049 never rewrites a sibling
 // definition. The Consistency boundary sibling keeps its exact seven-day
 // frequency contract, proving the two constructs stay separately
 // contracted.
 for(const[key,scaleRef,inputContract]of[['hgs.self-awareness','hgs.self-awareness.clarity-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1'],['hgs.resilience','hgs.resilience.adaptive-recovery-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HGS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scaleRef||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 const paDefinition=state.rows.find(x=>x.metric_key==='hgs.purpose-alignment');
 if(paDefinition.calculation_status!=='CALIBRATED'||paDefinition.hif_owner!=='HGS'||paDefinition.semantic_mapping_status!=='RESOLVED'||paDefinition.semantic_type!=='ALIGNMENT'||paDefinition.scale_reference!=='hgs.purpose-alignment.congruence-5.v1'||paDefinition.required_input_contract!=='DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT_V1'||paDefinition.valid_context_kinds.join()!=='GOAL'||paDefinition.dependency_ids.length!==0||paDefinition.consumers.length!==0)throw new Error('hgs.purpose-alignment stays calibrated with its RESOLVED/ALIGNMENT identity unchanged');
 for(const[key,scale]of[['hse.stress','hse.stress.ordinal-5.v1'],['hse.motivation','hse.motivation.ordinal-5.v1'],['hse.self-confidence','hse.self-confidence.ordinal-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HSE'||sibling.semantic_mapping_status!=='RESOLVED'||sibling.semantic_type!=='STATE'||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 for(const[key,owner,scale,inputContract]of[['hbs.consistency','HBS','hbs.consistency.frequency-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'],['hbs.initiative','HBS','hbs.initiative.frequency-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'],['hrs.repair','HRS','hrs.repair.effectiveness-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!==owner||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 // --- Habit Strength governance: exact dedicated artifacts -------------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[HS.scale]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('hgs.habit-strength ordinal scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[HS.model]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==HS.scale||model.rows[0].supported_context_kinds.join()!=='GOAL,SITUATION'||model.rows[0].target_metric_key!==HS.key||model.rows[0].method_type!==HS.method||model.rows[0].required_evidence_contract!=='FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1')throw new Error('hgs.habit-strength calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[HS.approval]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==HS.model||!Array.isArray(basis)||basis.length!==HS.basis.length||HS.basis.some(entry=>!basis.includes(entry)))throw new Error('hgs.habit-strength exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",[HS.key]);
 if(bindings.rows.map(x=>x.context_kind).join()!=='GOAL,SITUATION'||bindings.rows.some(x=>x.model_id!==HS.model||x.instrument_id!==HS.instrument||x.scale_contract_reference!==HS.scale))throw new Error('Expected exactly the two hgs.habit-strength GOAL/SITUATION ACTIVE bindings');
 // --- Sibling isolation inside the owned functions ----------------------------
 // Historical scope: exactly the three functions INTRODUCED AND OWNED BY
 // 0049 are queried by exact name and inspected - a later legitimately
 // reviewed Habit Strength version or helper, or a later separately
 // reviewed HGS/HIM Runtime Consumption contract, is deliberately NOT
 // forbidden here, and no function-universe scan exists. Each owned
 // function must exist and must neither read nor score any sibling
 // metric, Memory, Evidence, or conversation text - the 0049 executable
 // path scores an ordinal self-report and nothing else, it never reads a
 // Consistency observation, never converts a follow-through count into
 // automaticity, and it makes zero provider calls.
 const ownedFunctions=['calculate_hgs_habit_strength_measurement_v1','correct_hgs_habit_strength_measurement_v1','create_hgs_habit_strength_measurement_v1'];
 const procs=await client.query('SELECT proname,prosrc FROM pg_proc WHERE proname=ANY($1::name[]) ORDER BY proname',[ownedFunctions]);
 if(procs.rows.map(x=>x.proname).join()!==ownedFunctions.join())throw new Error('Expected the three 0049-owned Habit Strength functions to exist');
 // The calculation result's own supporting/contradictory_evidence_refs
 // ledger columns are its provenance shape, not an Evidence read - the
 // forbidden surfaces are the actual sibling metrics, the conversation
 // session table, the Memory/Hypothesis/canonical-Evidence stores, and
 // any compulsion/addiction/safety/recommendation authority.
 for(const proc of procs.rows)if(/hbs\.|hse\.|hrs\.|hgs\.self-awareness|hgs\.resilience|hgs\.purpose-alignment|conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items|behavior_detect|habit_detect|openai|anthropic|llm|provider|http|safety_runtime|recommendation|compulsion|addiction/i.test(proc.prosrc))throw new Error(`${proc.proname} must not read any sibling metric, Memory, Evidence, conversation text, provider, or compulsion/addiction/safety/recommendation surface`);
 // Deliberately NO live-database absence check for future authority:
 // historical verifiers run against the fully migrated latest schema, and
 // later legitimately reviewed contracts (a later Habit Strength version
 // or helper, or a separately reviewed HGS/HIM Runtime Consumption
 // contract) may create new functions there. That 0049 itself introduced
 // no sibling HGS authority is proven statically against the frozen 0049
 // migration text in its contract test - never here.
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 // A Habit Strength binding can never carry a sibling metric's approval,
 // instrument, or scale (artifacts stay separate even though the numeric
 // shape is the same 1-5 - in particular never the Consistency frequency
 // scale), and can never open an unapproved context.
 const bindingInsert=`INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hgs.habit-strength',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())`;
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000001','GOAL',2,'PENDING',HS.model,HS.instrument,HS.scale,'qandeel.him.self-awareness.foundation-approval']);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000002','GOAL',3,'PENDING',HS.model,'hgs.resilience.direct-target-bound-adaptive-recovery-report',HS.scale,HS.approval]);
 await rejects(client,bindingInsert,['4f000000-0000-4000-8000-000000000003','GOAL',4,'PENDING',HS.model,HS.instrument,'hbs.consistency.frequency-5.v1',HS.approval]);
 for(const context of['RELATIONSHIP','CONVERSATION_SESSION','DECISION','GLOBAL'])await rejects(client,bindingInsert,[randomUUID(),context,5,'PENDING',HS.model,HS.instrument,HS.scale,HS.approval]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='49000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4f000000-0000-4000-8000-000000000007','forged.habit-strength.model',1,'hgs.habit-strength',1,'CALIBRATED','PRODUCTION','x','x','x','hgs.habit-strength.automaticity-5.v1','{}'::jsonb,'x',ARRAY['GOAL','SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- The owned GOAL/SITUATION target substrate is reused, not reinvented -----
 // The existing 0013/0014 target RPCs still create valid targets, and
 // Habit Strength accepts no DECISION, RELATIONSHIP, or fabricated target
 // - no HGS-specific target table, no behavior entity, and no
 // Habit-Strength-specific target creator exists, and the opaque label is
 // never interpreted semantically: the recurring action being rated is
 // supplied by the user's structured response, never inferred from the
 // label.
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','run every morning')")).rows[0];
 const secondGoalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','write the daily journal')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','arriving at the office')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','choose launch date')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with Ahmed')")).rows[0];
 if(goalTarget.context_kind!=='GOAL'||situationTarget.context_kind!=='SITUATION'||decisionTarget.context_kind!=='DECISION'||relationshipTarget.context_kind!=='RELATIONSHIP')throw new Error('Existing target creation must remain unchanged');
 // --- Habit Strength behavioral proof set ------------------------------------
 // Create: owned GOAL or SITUATION target only - DECISION, RELATIONSHIP,
 // and fabricated targets are rejected.
 await rejects(client,`SELECT * FROM public.${HS.create}($1,'MODERATE',NULL)`,[fabricated]);
 await rejects(client,`SELECT * FROM public.${HS.create}($1,'MODERATE',NULL)`,[decisionTarget.id]);
 await rejects(client,`SELECT * FROM public.${HS.create}($1,'MODERATE',NULL)`,[relationshipTarget.id]);
 // The vocabulary is exact: sibling frequency/engagement codes - the
 // whole Consistency/Initiative/Avoidance seven-day frequency vocabulary
 // included - and every sibling special code are rejected, along with
 // fabricated codes. No frequency code can ever be reused as a Habit
 // Strength automaticity response.
 for(const invalid of['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NO_CLEAR_OPPORTUNITY','SOMEWHAT','A_GREAT_DEAL','NOT_AT_ALL','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','TOO_VALUE_CONFLICTED_TO_RATE','INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE','TOO_CONTEXT_DEPENDENT_TO_RATE','FULLY_AUTOMATIC'])await rejects(client,`SELECT * FROM public.${HS.create}($1,$2,NULL)`,[goalTarget.id,invalid]);
 // Server authority: derived label/kind/id, NULL event window, untrusted
 // client timestamps - on both approved context kinds.
 const probe=(await client.query(`SELECT * FROM public.${HS.create}($1,'MODERATE',$2)`,[goalTarget.id,past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Habit Strength client timestamp must stay untrusted diagnostic metadata');
 if(probe.metric_key!==HS.key||probe.context_kind!=='GOAL'||probe.context_id!==goalTarget.id||probe.instrument_id!==HS.instrument||probe.scale_contract_reference!==HS.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT'||probe.canonical_provenance!==HS.provenance)throw new Error('Habit Strength server-derived identity failed');
 if(probe.target_label!=='run every morning'||probe.target_context_kind!=='GOAL'||probe.target_context_id!==goalTarget.id)throw new Error('Habit Strength server-derived GOAL target label/kind/id failed');
 const situationProbe=(await client.query(`SELECT * FROM public.${HS.create}($1,'HIGH',NULL)`,[situationTarget.id])).rows[0];
 if(situationProbe.context_kind!=='SITUATION'||situationProbe.context_id!==situationTarget.id||situationProbe.target_label!=='arriving at the office'||situationProbe.target_context_kind!=='SITUATION')throw new Error('Habit Strength server-derived SITUATION target label/kind/id failed');
 const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
 if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error('Habit Strength event must carry a NULL temporal window');
 // Events are immutable: nobody can retrofit a seven-day frequency period
 // or any repetition window onto the event - repeated history is a basis
 // requirement, never a scored temporal window.
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '7 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
 // Scored response semantics on isolated measurements, with the frozen
 // UNRESOLVED/null snapshot identity preserved on every path.
 for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
  const o=(await client.query(`SELECT * FROM public.${HS.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[o.id])).rows[0];
  if(s.metric_key!==HS.key||s.context_kind!=='GOAL'||s.context_id!==goalTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`Habit Strength ${code} mapping failed`);
  if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`Habit Strength ${code} snapshot must preserve UNRESOLVED/null`);
  if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Habit Strength ${code} snapshot must carry a NULL temporal window`);
 }
 const situationSnapshot=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[situationProbe.id])).rows[0];
 if(situationSnapshot.context_kind!=='SITUATION'||situationSnapshot.numeric_value!==4||situationSnapshot.semantic_mapping_status!=='UNRESOLVED'||situationSnapshot.semantic_type!==null||situationSnapshot.temporal_window_start!==null||situationSnapshot.temporal_window_end!==null)throw new Error('Habit Strength SITUATION calculation failed');
 // All four special codes are UNASSESSED/null: never zero, never a
 // midpoint - an action too new or too rarely repeated to judge has no
 // valid automaticity basis (insufficient basis is not low Habit
 // Strength), a target without one sufficiently clear recurring
 // action/routine is never averaged into a single scalar (and the
 // behavior is never inferred or chosen from the target label),
 // cue-uneven automaticity is never averaged across cue conditions, and
 // an unconfident report never scores.
 for(const code of HS.specials){
  const o=(await client.query(`SELECT * FROM public.${HS.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Habit Strength ${code} must be UNASSESSED null with UNRESOLVED/null preserved - never zero, never high, never low, and never a midpoint`);
 }
 // Idempotency + correction: same event, same exact target.
 const idem=(await client.query(`SELECT * FROM public.${HS.create}($1,'LOW',NULL)`,[goalTarget.id])).rows[0];
 const firstCalc=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[idem.id])).rows[0];
 const retryCalc=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Habit Strength recalculation was not idempotent');
 const corrected=(await client.query(`SELECT * FROM public.${HS.correct}($1,'VERY_HIGH',NULL)`,[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!==HS.key)throw new Error('Habit Strength correction changed the measurement event or the target');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error('Habit Strength correction must preserve the NULL event window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Habit Strength remained current before recalculation');
 const correctedSnapshot=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Habit Strength current value failed');
 if(correctedSnapshot.semantic_mapping_status!=='UNRESOLVED'||correctedSnapshot.semantic_type!==null)throw new Error('Corrected Habit Strength snapshot must preserve UNRESOLVED/null');
 // The superseded observation can neither calculate nor be corrected again.
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[idem.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[idem.id]);
 // Direct assessed snapshot forgery remains blocked.
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:HS.key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'GOAL',contextId:goalTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // A Habit Strength observation with a Consistency frequency code cannot
 // be fabricated through the substrate either: the vocabulary contract is
 // metric-exact, so no frequency response ever enters this metric.
 await rejects(client,"INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance,created_at,target_label,target_context_kind,target_context_id) VALUES($1,$2,$3,'hgs.habit-strength',1,$4,1,$5,1,'GOAL',$6,'ALMOST_ALWAYS',now(),'ar-EG','DIRECT_STRUCTURED_USER_REPORT',$7,now(),'run every morning','GOAL',$6)",[randomUUID(),one,probe.measurement_event_id,HS.instrument,HS.scale,goalTarget.id,HS.provenance]);
 // --- Independent constructs: the mandated coexistence proof set --------------
 // The Consistency boundary in both directions on real owned targets: on
 // the SAME user and the SAME owned GOAL target, Consistency
 // ALMOST_ALWAYS (5) coexists with Habit Strength VERY_LOW (1) - the
 // user reliably follows through, but only through deliberate
 // effort/decision each time. On the second GOAL target Consistency
 // NEVER (1) coexists with Habit Strength VERY_HIGH (5) - a
 // well-established automatic response can currently show no seven-day
 // follow-through because the cue/opportunity did not occur normally or
 // the environment was disrupted. Motivation proves the same in both
 // directions (VERY_HIGH with Habit Strength 1: strongly wanting the
 // behavior while still deliberately initiating it each time; VERY_LOW
 // with Habit Strength 5: the behavior runs automatically despite weak
 // current motivation), Initiative ALMOST_ALWAYS (5) coexists with Habit
 // Strength VERY_LOW (1) (repeated deliberate self-starts without
 // automaticity), and Self-Awareness, Resilience, and Purpose Alignment
 // each coexist at 5 with Habit Strength 1 - no DB invariant derives,
 // modifies, or correlates one metric from another, no Consistency
 // threshold gates Habit Strength, and no frequency ever converts into
 // automaticity in any direction.
 const consistencyHighObs=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[goalTarget.id])).rows[0];
 const initiativeHighObs=(await client.query("SELECT * FROM public.create_hbs_initiative_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[goalTarget.id])).rows[0];
 const motivationHighObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const saHighObs=(await client.query("SELECT * FROM public.create_hgs_self_awareness_measurement_v1($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const resHighObs=(await client.query("SELECT * FROM public.create_hgs_resilience_measurement_v1($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const paHighObs=(await client.query("SELECT * FROM public.create_hgs_purpose_alignment_measurement_v1($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const hsLowGoalObs=(await client.query(`SELECT * FROM public.${HS.create}($1,'VERY_LOW',NULL)`,[goalTarget.id])).rows[0];
 const consistencyLowObs=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'NEVER',NULL)",[secondGoalTarget.id])).rows[0];
 const motivationLowObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_LOW',NULL)",[secondGoalTarget.id])).rows[0];
 const hsHighGoalObs=(await client.query(`SELECT * FROM public.${HS.create}($1,'VERY_HIGH',NULL)`,[secondGoalTarget.id])).rows[0];
 // Habit Strength can never calculate or correct a Consistency,
 // Initiative, Motivation, Self-Awareness, Resilience, or Purpose
 // Alignment observation...
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[consistencyHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[initiativeHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[saHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[resHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[paHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[consistencyHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[initiativeHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[saHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[resHighObs.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[paHighObs.id]);
 // ...Consistency, Initiative, Motivation, Self-Awareness, Resilience,
 // and Purpose Alignment can never calculate or correct the Habit
 // Strength observation either - the boundary fails closed in both
 // directions.
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[hsLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[hsLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[hsLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[hsLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hgs_resilience_measurement_v1($1)',[hsLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hgs_purpose_alignment_measurement_v1($1)',[hsLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_consistency_measurement_v1($1,'NEVER',NULL)",[hsLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_initiative_measurement_v1($1,'NEVER',NULL)",[hsLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hse_motivation_measurement($1,'VERY_LOW',NULL)",[hsLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hgs_self_awareness_measurement_v1($1,'VERY_LOW',NULL)",[hsLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hgs_resilience_measurement_v1($1,'VERY_LOW',NULL)",[hsLowGoalObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hgs_purpose_alignment_measurement_v1($1,'VERY_LOW',NULL)",[hsLowGoalObs.id]);
 const consistencyHighSnap=(await client.query('SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[consistencyHighObs.id])).rows[0];
 const initiativeHighSnap=(await client.query('SELECT * FROM public.calculate_hbs_initiative_measurement_v1($1)',[initiativeHighObs.id])).rows[0];
 const motivationHighSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationHighObs.id])).rows[0];
 const saHighSnap=(await client.query('SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[saHighObs.id])).rows[0];
 const resHighSnap=(await client.query('SELECT * FROM public.calculate_hgs_resilience_measurement_v1($1)',[resHighObs.id])).rows[0];
 const paHighSnap=(await client.query('SELECT * FROM public.calculate_hgs_purpose_alignment_measurement_v1($1)',[paHighObs.id])).rows[0];
 const hsLowGoalSnap=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[hsLowGoalObs.id])).rows[0];
 const consistencyLowSnap=(await client.query('SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[consistencyLowObs.id])).rows[0];
 const motivationLowSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationLowObs.id])).rows[0];
 const hsHighGoalSnap=(await client.query(`SELECT * FROM public.${HS.calculate}($1)`,[hsHighGoalObs.id])).rows[0];
 if(consistencyHighSnap.numeric_value!==5||hsLowGoalSnap.numeric_value!==1)throw new Error('High Consistency (5) + low Habit Strength (1) on the same GOAL failed - Habit Strength is not Consistency');
 if(consistencyLowSnap.numeric_value!==1||hsHighGoalSnap.numeric_value!==5)throw new Error('Low Consistency (1) + high Habit Strength (5) on the same GOAL failed - a disrupted week never lowers an established cue-response association');
 if(motivationHighSnap.numeric_value!==5||hsLowGoalSnap.numeric_value!==1)throw new Error('High Motivation (5) + low Habit Strength (1) on the same GOAL failed - Habit Strength is not Motivation');
 if(motivationLowSnap.numeric_value!==1||hsHighGoalSnap.numeric_value!==5)throw new Error('Low Motivation (1) + high Habit Strength (5) on the same GOAL failed');
 if(initiativeHighSnap.numeric_value!==5||hsLowGoalSnap.numeric_value!==1)throw new Error('High Initiative (5) + low Habit Strength (1) on the same GOAL failed - Habit Strength is not Initiative');
 if(saHighSnap.numeric_value!==5||hsLowGoalSnap.numeric_value!==1)throw new Error('High Self-Awareness (5) + low Habit Strength (1) on the same GOAL failed');
 if(resHighSnap.numeric_value!==5||hsLowGoalSnap.numeric_value!==1)throw new Error('High Resilience (5) + low Habit Strength (1) on the same GOAL failed');
 if(paHighSnap.numeric_value!==5||hsLowGoalSnap.numeric_value!==1)throw new Error('High Purpose Alignment (5) + low Habit Strength (1) on the same GOAL failed');
 // The freely differing values changed nothing else: the sibling current
 // values are untouched (no inverse, composite, or derived mutation), and
 // no compulsion/addiction/safety/recommendation-shaped artifact appeared
 // anywhere in the rows this path produced - high automaticity is
 // descriptive only, and the metric emits no loss-of-control,
 // healthy/unhealthy-habit, or continue/stop verdict of any kind.
 const goalCurrent=(await client.query('SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key',[goalTarget.id,[consistencyHighObs.id,initiativeHighObs.id,motivationHighObs.id,saHighObs.id,resHighObs.id,paHighObs.id,hsLowGoalObs.id]])).rows;
 if(goalCurrent.map(x=>`${x.metric_key}=${x.numeric_value}`).join()!=='hbs.consistency=5,hbs.initiative=5,hgs.habit-strength=1,hgs.purpose-alignment=5,hgs.resilience=5,hgs.self-awareness=5,hse.motivation=5')throw new Error('The Consistency/Initiative/Motivation/Self-Awareness/Resilience/Purpose-Alignment/Habit-Strength current values must coexist independently');
 const secondGoalCurrent=(await client.query('SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key',[secondGoalTarget.id,[consistencyLowObs.id,motivationLowObs.id,hsHighGoalObs.id]])).rows;
 if(secondGoalCurrent.map(x=>`${x.metric_key}=${x.numeric_value}`).join()!=='hbs.consistency=1,hgs.habit-strength=5,hse.motivation=1')throw new Error('The low-Consistency/low-Motivation/high-Habit-Strength current values must coexist independently');
 for(const produced of[hsLowGoalSnap,hsHighGoalSnap,correctedSnapshot,situationSnapshot])if(Object.values(produced).some(value=>typeof value==='string'&&/\b(ADDICTION|COMPULSION|CRAVING|DEPENDENCE|DISORDER|LOSS_OF_CONTROL|UNHEALTHY|HEALTHY_HABIT|UNSAFE|RECOMMENDED|CONTINUE_BEHAVIOR|STOP_BEHAVIOR|GOOD_HABIT|BAD_HABIT)\b/i.test(value)))throw new Error('The 0049 Habit Strength calculation path must emit no compulsion/addiction/safety/recommendation classification value');
 // Each calculation result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[hsLowGoalObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!==HS.key||provenance.rows[0].binding_metric!==HS.key||provenance.rows[0].model_id!==HS.model||provenance.rows[0].instrument_id!==HS.instrument)throw new Error('Habit Strength calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // Completing the 17-metric measurement inventory creates no consumption
 // eligibility: both frozen v1 read surfaces reject Habit Strength
 // outright - even for the owner of a real target with real calculated
 // values - and the existing GOAL slot set stays exact with no Habit
 // Strength leakage: no habit strengthening/weakening trend, formation
 // curve, days-to-habit, or improving/worsening-automaticity reading of
 // any kind exists.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.habit-strength',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.habit-strength',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 const goalIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('GOAL',$1)",[goalTarget.id])).rows.map(x=>x.metric_key).sort();
 if(goalIntelligence.join()!=='hse.motivation')throw new Error('GOAL Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Habit Strength');
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key);
 if(situationIntelligence.some(key=>key.startsWith('hgs.')))throw new Error('SITUATION Intelligence Snapshot v1 must expose no HGS metric');
 // --- Cross-user / anon authority ---------------------------------------------
 const hsScored=(await client.query(`SELECT * FROM public.${HS.create}($1,'HIGH',NULL)`,[goalTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hgs.habit-strength'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hgs.habit-strength'")).rowCount!==0)throw new Error('Owner-only Habit Strength read isolation failed');
 await rejects(client,`SELECT * FROM public.${HS.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[hsScored.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[hsScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,`SELECT * FROM public.${HS.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${HS.correct}($1,'VERY_LOW',NULL)`,[hsScored.id]);
 await rejects(client,`SELECT * FROM public.${HS.calculate}($1)`,[hsScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 // Proven in the dedicated hgs.habit-strength advisory-lock namespace.
 await client.query('BEGIN');await identity(client,one);
 const racedTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','stretch after waking up')")).rows[0];
 const raced=(await client.query(`SELECT * FROM public.${HS.create}($1,'LOW',NULL)`,[racedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('${HS.lock}'||$1::text,0))`,[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query(`SELECT * FROM public.${HS.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Habit Strength calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query(`SELECT * FROM public.${HS.correct}($1,'VERY_HIGH',NULL)`,[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Habit Strength was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Habit Strength result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HGS Habit Strength v1 - the fourth HGS metric, completing the canonical 17-metric v1 measurement inventory: every canonical v1 identity calibrated with the prior HSE/HBS/HRS metrics, Self-Awareness, Resilience, and Purpose Alignment unchanged (Purpose Alignment keeping RESOLVED/ALIGNMENT, Habit Strength staying HGS/UNRESOLVED/null on the definition and on every produced snapshot), exact dedicated governance artifacts with one exactly-ten-basis approval and no external/clinical/psychometric validation claim, reuse of the owned GOAL/SITUATION target substrate with no HGS-specific target authority and DECISION/RELATIONSHIP/fabricated targets rejected, owner target-bound creation on both approved context kinds with NULL event temporal windows (sufficient repeated experience is a basis requirement, never a scored window - no seven-day period, streak, repetition count, or days-to-habit reading) and untrusted client time, full scored and unassessed semantics (insufficient repetition history, no single recurring pattern, cue dependence, and NOT_SURE all UNASSESSED/null - never zero, never high, never low) with every sibling frequency and special vocabulary rejected, the mandatory Consistency boundary proven in both directions on real owned targets (Consistency=5 with Habit Strength=1 and Consistency=1 with Habit Strength=5) alongside Motivation opposite-value coexistence, Initiative/Self-Awareness/Resilience/Purpose-Alignment separation, and cross-calculation/correction rejection in both directions for every key sibling, no behavior inference from the opaque target label, no compulsion/addiction/safety/recommendation classification of any kind, correction/currentness preserving the exact target and NULL window, idempotent and race-safe calculation in the dedicated lock namespace, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption (inventory completion creates no runtime-consumption eligibility) with zero provider calls.');
