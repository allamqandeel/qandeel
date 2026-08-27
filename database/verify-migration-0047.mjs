import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const RES={key:'hgs.resilience',scale:'hgs.resilience.adaptive-recovery-5.v1',model:'hgs.resilience.direct-structured-current-adaptive-recovery',instrument:'hgs.resilience.direct-target-bound-adaptive-recovery-report',approval:'qandeel.him.resilience.foundation-approval',method:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT',inputContract:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1',provenance:'QANDEEL_HGS_RESILIENCE_MEASUREMENT_V1',specials:['NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE'],create:'create_hgs_resilience_measurement_v1',correct:'correct_hgs_resilience_measurement_v1',calculate:'calculate_hgs_resilience_measurement_v1',lock:'hgs.resilience.observation:',basis:['HGS_RESILIENCE_CURRENT_TARGET_BOUND_ADAPTIVE_RECOVERY_UNDER_EXPERIENCED_CHALLENGE','DIRECT_STRUCTURED_REPORT','GOAL_SITUATION_ONLY','ACTUAL_CHALLENGE_BASIS_CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_ADAPTIVE_RECOVERY_5','NO_ADVERSITY_TOO_EARLY_AND_CHALLENGE_DEPENDENCE_FAIL_TO_UNASSESSED','RESILIENCE_NOT_LOW_STRESS_MOTIVATION_CONFIDENCE_CONSISTENCY_GRIT_GOAL_SUCCESS_OR_REPAIR','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM']};
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
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics, the four calibrated HBS metrics, the four calibrated HRS metrics, calibrated hgs.self-awareness, and calibrated hgs.resilience (later HIM Expansion tasks may calibrate more)');
 const definition=state.rows.find(x=>x.metric_key===RES.key);
 if(definition.hif_owner!=='HGS'||definition.semantic_mapping_status!=='UNRESOLVED'||definition.semantic_type!==null||definition.scale_reference!==RES.scale||definition.required_input_contract!==RES.inputContract||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error('hgs.resilience definition identity failed');
 // The closest HGS sibling and the boundary HSE/HBS/HRS siblings stay
 // calibrated and semantically unchanged - 0047 never rewrites a sibling
 // definition.
 const selfAwarenessDefinition=state.rows.find(x=>x.metric_key==='hgs.self-awareness');
 if(selfAwarenessDefinition.calculation_status!=='CALIBRATED'||selfAwarenessDefinition.hif_owner!=='HGS'||selfAwarenessDefinition.semantic_mapping_status!=='UNRESOLVED'||selfAwarenessDefinition.semantic_type!==null||selfAwarenessDefinition.scale_reference!=='hgs.self-awareness.clarity-5.v1'||selfAwarenessDefinition.required_input_contract!=='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1'||selfAwarenessDefinition.dependency_ids.length!==0||selfAwarenessDefinition.consumers.length!==0)throw new Error('hgs.self-awareness stays calibrated and unchanged');
 for(const[key,scale]of[['hse.stress','hse.stress.ordinal-5.v1'],['hse.motivation','hse.motivation.ordinal-5.v1'],['hse.self-confidence','hse.self-confidence.ordinal-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HSE'||sibling.semantic_mapping_status!=='RESOLVED'||sibling.semantic_type!=='STATE'||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 for(const[key,owner,scale,inputContract]of[['hbs.consistency','HBS','hbs.consistency.frequency-5.v1','DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1'],['hrs.repair','HRS','hrs.repair.effectiveness-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!==owner||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} stays calibrated and unchanged`);
 }
 // --- Resilience governance: exact dedicated artifacts -----------------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[RES.scale]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('hgs.resilience ordinal scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[RES.model]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==RES.scale||model.rows[0].supported_context_kinds.join()!=='GOAL,SITUATION'||model.rows[0].target_metric_key!==RES.key||model.rows[0].method_type!==RES.method||model.rows[0].required_evidence_contract!=='FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1')throw new Error('hgs.resilience calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[RES.approval]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==RES.model||!Array.isArray(basis)||basis.length!==RES.basis.length||RES.basis.some(entry=>!basis.includes(entry)))throw new Error('hgs.resilience exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[RES.key]);
 if(bindings.rows.map(x=>x.context_kind).join()!=='GOAL,SITUATION'||bindings.rows.some(x=>x.model_id!==RES.model||x.instrument_id!==RES.instrument||x.scale_contract_reference!==RES.scale))throw new Error('Expected exactly the two hgs.resilience GOAL and SITUATION ACTIVE bindings');
 // --- Sibling isolation inside the owned functions ----------------------------
 // Historical scope: exactly the three functions INTRODUCED AND OWNED BY
 // 0047 are queried by exact name and inspected - a future legitimate
 // Resilience helper, v2 authority, or separately reviewed
 // runtime-consumption function is deliberately NOT forbidden here. Each
 // owned function must exist and must neither read nor score any sibling
 // metric, Memory, Evidence, or conversation text - the 0047 executable
 // path scores an ordinal self-report and nothing else, it never infers
 // that adversity occurred, and it makes zero provider calls.
 const ownedFunctions=['calculate_hgs_resilience_measurement_v1','correct_hgs_resilience_measurement_v1','create_hgs_resilience_measurement_v1'];
 const procs=await client.query('SELECT proname,prosrc FROM pg_proc WHERE proname=ANY($1::name[]) ORDER BY proname',[ownedFunctions]);
 if(procs.rows.map(x=>x.proname).join()!==ownedFunctions.join())throw new Error('Expected the three 0047-owned Resilience functions to exist');
 // The calculation result's own supporting/contradictory_evidence_refs
 // ledger columns are its provenance shape, not an Evidence read - the
 // forbidden surfaces are the actual sibling metrics, the conversation
 // session table, and the Memory/Hypothesis/canonical-Evidence stores.
 for(const proc of procs.rows)if(/hbs\.|hse\.|hrs\.|hgs\.self-awareness|hgs\.purpose-alignment|hgs\.habit-strength|conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items|adversity_detect|openai|anthropic|llm|provider|http/i.test(proc.prosrc))throw new Error(`${proc.proname} must not read any sibling metric, Memory, Evidence, conversation text, or provider`);
 // Deliberately NO live-database absence check for future sibling HGS
 // measurement authority (Purpose Alignment, Habit Strength, or later
 // Resilience versions/helpers): historical verifiers run against the
 // fully migrated latest schema, and later legitimate HGS calibrations
 // create those functions. That 0047 itself introduced no sibling HGS
 // authority is proven statically against the frozen 0047 migration text
 // in its contract test - never here.
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 // A Resilience binding can never carry a sibling metric's approval,
 // instrument, or scale (artifacts stay separate even though the numeric
 // shape is the same 1-5), and can never open an unapproved context.
 const bindingInsert=`INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hgs.resilience',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())`;
 await rejects(client,bindingInsert,['4d000000-0000-4000-8000-000000000001','GOAL',2,'PENDING',RES.model,RES.instrument,RES.scale,'qandeel.him.self-awareness.foundation-approval']);
 await rejects(client,bindingInsert,['4d000000-0000-4000-8000-000000000002','GOAL',3,'PENDING',RES.model,'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report',RES.scale,RES.approval]);
 await rejects(client,bindingInsert,['4d000000-0000-4000-8000-000000000003','SITUATION',4,'PENDING',RES.model,RES.instrument,'hse.stress.ordinal-5.v1',RES.approval]);
 for(const context of['RELATIONSHIP','CONVERSATION_SESSION','DECISION','GLOBAL'])await rejects(client,bindingInsert,[randomUUID(),context,5,'PENDING',RES.model,RES.instrument,RES.scale,RES.approval]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='47000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4d000000-0000-4000-8000-000000000007','forged.resilience.model',1,'hgs.resilience',1,'CALIBRATED','PRODUCTION','x','x','x','hgs.resilience.adaptive-recovery-5.v1','{}'::jsonb,'x',ARRAY['GOAL','SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- The owned GOAL/SITUATION target substrate is reused, not reinvented -----
 // The existing 0013/0014 target RPCs still create valid GOAL/SITUATION
 // targets, DECISION and RELATIONSHIP targets stay creatable through their
 // own historical RPCs, and Resilience accepts no DECISION, RELATIONSHIP,
 // or fabricated target - no HGS-specific target table or target-creation
 // RPC exists.
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const secondGoalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','run every morning')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','difficult team meeting')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','choose launch date')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with Ahmed')")).rows[0];
 if(goalTarget.context_kind!=='GOAL'||situationTarget.context_kind!=='SITUATION'||decisionTarget.context_kind!=='DECISION'||relationshipTarget.context_kind!=='RELATIONSHIP')throw new Error('Existing target creation must remain unchanged');
 // --- Resilience behavioral proof set -----------------------------------------
 // Create: owned GOAL or SITUATION target only.
 await rejects(client,`SELECT * FROM public.${RES.create}($1,'MODERATE',NULL)`,[fabricated]);
 await rejects(client,`SELECT * FROM public.${RES.create}($1,'MODERATE',NULL)`,[decisionTarget.id]);
 await rejects(client,`SELECT * FROM public.${RES.create}($1,'MODERATE',NULL)`,[relationshipTarget.id]);
 // The vocabulary is exact: sibling frequency/engagement codes and every
 // sibling special code - Self-Awareness's, Trust's, Communication's,
 // Repair's, and Emotional Safety's - are rejected, along with fabricated
 // codes.
 for(const invalid of['SOMEWHAT','A_GREAT_DEAL','NOT_AT_ALL','ALMOST_ALWAYS','NEVER','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','TOO_CONTEXT_DEPENDENT_TO_RATE','TOO_TOPIC_DEPENDENT_TO_RATE','TOO_EPISODE_DEPENDENT_TO_RATE','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_VULNERABILITY_DEPENDENT_TO_RATE','BOUNCED_BACK_COMPLETELY'])await rejects(client,`SELECT * FROM public.${RES.create}($1,$2,NULL)`,[goalTarget.id,invalid]);
 // Server authority: derived label/kind/id, NULL event window, untrusted
 // client timestamps.
 const probe=(await client.query(`SELECT * FROM public.${RES.create}($1,'MODERATE',$2)`,[goalTarget.id,past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Resilience client timestamp must stay untrusted diagnostic metadata');
 if(probe.metric_key!==RES.key||probe.context_kind!=='GOAL'||probe.context_id!==goalTarget.id||probe.instrument_id!==RES.instrument||probe.scale_contract_reference!==RES.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT'||probe.canonical_provenance!==RES.provenance)throw new Error('Resilience server-derived identity failed');
 if(probe.target_label!=='finish thesis draft'||probe.target_context_kind!=='GOAL'||probe.target_context_id!==goalTarget.id)throw new Error('Resilience server-derived GOAL target label/kind/id failed');
 const situationProbe=(await client.query(`SELECT * FROM public.${RES.create}($1,'HIGH',NULL)`,[situationTarget.id])).rows[0];
 if(situationProbe.context_kind!=='SITUATION'||situationProbe.context_id!==situationTarget.id||situationProbe.target_label!=='difficult team meeting'||situationProbe.target_context_kind!=='SITUATION')throw new Error('Resilience server-derived SITUATION target label/kind/id failed');
 const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
 if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error('Resilience event must carry a NULL temporal window');
 // Events are immutable: nobody can retrofit a recovery period onto the event.
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '30 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
 // Scored response semantics on isolated measurements in BOTH authorized
 // contexts.
 for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
  const o=(await client.query(`SELECT * FROM public.${RES.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[o.id])).rows[0];
  if(s.metric_key!==RES.key||s.context_kind!=='GOAL'||s.context_id!==goalTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`Resilience ${code} mapping failed`);
  if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`Resilience ${code} snapshot must stay UNRESOLVED/null`);
  if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Resilience ${code} snapshot must carry a NULL temporal window`);
 }
 // All four special codes are UNASSESSED/null: never zero, never a
 // midpoint - a target without meaningful adversity has no valid basis
 // (no adversity is not high resilience), the immediate post-setback
 // disruption is not low resilience by default, challenge-uneven
 // adaptation is never averaged into one scalar, and an unconfident
 // report never scores.
 for(const code of RES.specials){
  const o=(await client.query(`SELECT * FROM public.${RES.create}($1,$2,NULL)`,[situationTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Resilience ${code} must be UNASSESSED null, never zero, never high, never low, and never a midpoint`);
 }
 // Idempotency + correction: same event, same exact target.
 const idem=(await client.query(`SELECT * FROM public.${RES.create}($1,'LOW',NULL)`,[goalTarget.id])).rows[0];
 const firstCalc=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[idem.id])).rows[0];
 const retryCalc=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Resilience recalculation was not idempotent');
 const corrected=(await client.query(`SELECT * FROM public.${RES.correct}($1,'VERY_HIGH',NULL)`,[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!==RES.key)throw new Error('Resilience correction changed the measurement event or the target');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error('Resilience correction must preserve the NULL event window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Resilience remained current before recalculation');
 const correctedSnapshot=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Resilience current value failed');
 // The superseded observation can neither calculate nor be corrected again.
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[idem.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[idem.id]);
 // Direct assessed snapshot forgery remains blocked.
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:RES.key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'GOAL',contextId:goalTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // No remaining-HGS observation can be fabricated through the substrate
 // either: the Resilience authority is metric-exact and the observation
 // contract accepts neither of the two remaining HGS metric keys.
 await rejects(client,"INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance,created_at) VALUES($1,$2,$3,'hgs.purpose-alignment',1,$4,1,$5,1,'GOAL',$6,'MODERATE',now(),'ar-EG','DIRECT_STRUCTURED_USER_REPORT',$7,now())",[randomUUID(),one,probe.measurement_event_id,RES.instrument,RES.scale,goalTarget.id,RES.provenance]);
 await rejects(client,"INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance,created_at) VALUES($1,$2,$3,'hgs.habit-strength',1,$4,1,$5,1,'GOAL',$6,'MODERATE',now(),'ar-EG','DIRECT_STRUCTURED_USER_REPORT',$7,now())",[randomUUID(),one,probe.measurement_event_id,RES.instrument,RES.scale,goalTarget.id,RES.provenance]);
 // --- Independent constructs: the mandated coexistence proof set --------------
 // On the SAME user and the SAME owned SITUATION target, Stress VERY_HIGH
 // (5) coexists with Resilience VERY_HIGH (5): still distressed by the
 // difficult situation, yet maintaining/regaining workable functioning -
 // Resilience is not the absence of distress. On the same SITUATION,
 // Self-Awareness VERY_HIGH (5) coexists with Resilience VERY_LOW (1)
 // (clear inside, not yet adapted), and on a second GOAL target
 // Self-Awareness VERY_LOW (1) coexists with Resilience VERY_HIGH (5). On
 // one GOAL target Motivation VERY_HIGH (5) coexists with Resilience
 // VERY_LOW (1) (strongly wanting to continue while substantially
 // derailed), and on the second GOAL target Motivation VERY_LOW (1)
 // coexists with Resilience VERY_HIGH (5) - no DB invariant derives,
 // modifies, or correlates one metric from another, and Self-Confidence
 // VERY_HIGH (5) on the same SITUATION changes nothing either. No
 // inverse, composite, or forced correlation exists in any direction.
 const stressObs=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'VERY_HIGH',NULL)",[situationTarget.id])).rows[0];
 const resHighSituationObs=(await client.query(`SELECT * FROM public.${RES.create}($1,'VERY_HIGH',NULL)`,[situationTarget.id])).rows[0];
 const saHighObs=(await client.query("SELECT * FROM public.create_hgs_self_awareness_measurement_v1($1,'VERY_HIGH',NULL)",[situationTarget.id])).rows[0];
 const resLowSituationObs=(await client.query(`SELECT * FROM public.${RES.create}($1,'VERY_LOW',NULL)`,[situationTarget.id])).rows[0];
 const motivationHighObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const resLowGoalObs=(await client.query(`SELECT * FROM public.${RES.create}($1,'VERY_LOW',NULL)`,[goalTarget.id])).rows[0];
 const motivationLowObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_LOW',NULL)",[secondGoalTarget.id])).rows[0];
 const saLowObs=(await client.query("SELECT * FROM public.create_hgs_self_awareness_measurement_v1($1,'VERY_LOW',NULL)",[secondGoalTarget.id])).rows[0];
 const resHighGoalObs=(await client.query(`SELECT * FROM public.${RES.create}($1,'VERY_HIGH',NULL)`,[secondGoalTarget.id])).rows[0];
 const selfConfidenceObs=(await client.query("SELECT * FROM public.create_hse_self_confidence_measurement('SITUATION',$1,'VERY_HIGH',NULL)",[situationTarget.id])).rows[0];
 const consistencyObs=(await client.query("SELECT * FROM public.create_hbs_consistency_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[goalTarget.id])).rows[0];
 const repairObs=(await client.query("SELECT * FROM public.create_hrs_repair_measurement_v1($1,'VERY_HIGH',NULL)",[relationshipTarget.id])).rows[0];
 // Resilience can never calculate or correct a Stress, Self-Awareness,
 // Motivation, Self-Confidence, Consistency, or Repair observation...
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[stressObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[saHighObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[selfConfidenceObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[consistencyObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[repairObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[stressObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[saHighObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[selfConfidenceObs.id]);
 // ...Stress, Self-Awareness, Motivation, and Self-Confidence can never
 // calculate or correct the Resilience observation...
 await rejects(client,'SELECT * FROM public.calculate_hse_stress_measurement($1)',[resHighSituationObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[resHighSituationObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[resLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[resHighSituationObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hse_stress_measurement($1,'VERY_LOW',NULL)",[resHighSituationObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hgs_self_awareness_measurement_v1($1,'VERY_LOW',NULL)",[resHighSituationObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hse_motivation_measurement($1,'VERY_LOW',NULL)",[resLowGoalObs.id]);
 // ...and no representative HBS/HRS calculator can score the Resilience
 // observation either.
 await rejects(client,'SELECT * FROM public.calculate_hbs_consistency_measurement_v1($1)',[resLowGoalObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_repair_measurement_v1($1)',[resHighSituationObs.id]);
 const stressSnap=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[stressObs.id])).rows[0];
 const resHighSituationSnap=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[resHighSituationObs.id])).rows[0];
 const saHighSnap=(await client.query('SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[saHighObs.id])).rows[0];
 const resLowSituationSnap=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[resLowSituationObs.id])).rows[0];
 const motivationHighSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationHighObs.id])).rows[0];
 const resLowGoalSnap=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[resLowGoalObs.id])).rows[0];
 const motivationLowSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationLowObs.id])).rows[0];
 const saLowSnap=(await client.query('SELECT * FROM public.calculate_hgs_self_awareness_measurement_v1($1)',[saLowObs.id])).rows[0];
 const resHighGoalSnap=(await client.query(`SELECT * FROM public.${RES.calculate}($1)`,[resHighGoalObs.id])).rows[0];
 const selfConfidenceSnap=(await client.query('SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[selfConfidenceObs.id])).rows[0];
 if(stressSnap.numeric_value!==5||resHighSituationSnap.numeric_value!==5)throw new Error('High Stress (5) + high Resilience (5) on the same SITUATION failed - Resilience is not the absence of distress');
 if(saHighSnap.numeric_value!==5||resLowSituationSnap.numeric_value!==1)throw new Error('High Self-Awareness (5) + low Resilience (1) on the same SITUATION failed');
 if(saLowSnap.numeric_value!==1||resHighGoalSnap.numeric_value!==5)throw new Error('Low Self-Awareness (1) + high Resilience (5) on the same GOAL failed');
 if(motivationHighSnap.numeric_value!==5||resLowGoalSnap.numeric_value!==1)throw new Error('High Motivation (5) + low Resilience (1) on the same GOAL failed');
 if(motivationLowSnap.numeric_value!==1||resHighGoalSnap.numeric_value!==5)throw new Error('Low Motivation (1) + high Resilience (5) on the same GOAL failed');
 if(selfConfidenceSnap.numeric_value!==5||resLowSituationSnap.numeric_value!==1)throw new Error('High Self-Confidence (5) + low Resilience (1) on the same SITUATION failed');
 // The freely differing values changed nothing else: the sibling current
 // values are untouched (no inverse, composite, or derived mutation), and
 // no recovery-time/trait/growth-shaped artifact appeared anywhere in the
 // rows this path produced.
 const situationCurrent=(await client.query('SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key',[situationTarget.id,[stressObs.id,resHighSituationObs.id,saHighObs.id,selfConfidenceObs.id]])).rows;
 if(situationCurrent.map(x=>`${x.metric_key}=${x.numeric_value}`).join()!=='hgs.resilience=5,hgs.self-awareness=5,hse.self-confidence=5,hse.stress=5')throw new Error('The Stress/Resilience/Self-Awareness/Self-Confidence current values must coexist independently');
 for(const produced of[resHighSituationSnap,correctedSnapshot])if(Object.values(produced).some(value=>typeof value==='string'&&/\b(RECOVERY_TIME|BOUNCED_BACK|TOUGHNESS|TRAIT_RESILIENCE|GROWTH_ACHIEVED|HEALTHY|UNHEALTHY|DIAGNOSIS)\b/i.test(value)))throw new Error('The 0047 Resilience calculation path must emit no recovery-time/trait/growth/diagnosis classification value');
 // Each calculation result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[resHighSituationObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!==RES.key||provenance.rows[0].binding_metric!==RES.key||provenance.rows[0].model_id!==RES.model||provenance.rows[0].instrument_id!==RES.instrument)throw new Error('Resilience calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // Both frozen v1 read surfaces reject Resilience outright - even for the
 // owner of a real target with real calculated values - and the existing
 // GOAL/SITUATION slot sets stay exact with no Resilience leakage: no
 // improving/worsening resilience reading of any kind exists.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.resilience',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.resilience',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 const goalIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('GOAL',$1)",[goalTarget.id])).rows.map(x=>x.metric_key).sort();
 if(goalIntelligence.join()!=='hse.motivation')throw new Error('GOAL Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Resilience');
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key).sort();
 if(situationIntelligence.join()!=='hse.attention,hse.motivation,hse.self-confidence,hse.stress')throw new Error('SITUATION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Resilience');
 // --- Cross-user / anon authority ---------------------------------------------
 const resScored=(await client.query(`SELECT * FROM public.${RES.create}($1,'HIGH',NULL)`,[goalTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hgs.resilience'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hgs.resilience'")).rowCount!==0)throw new Error('Owner-only Resilience read isolation failed');
 await rejects(client,`SELECT * FROM public.${RES.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[resScored.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[resScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,`SELECT * FROM public.${RES.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${RES.correct}($1,'VERY_LOW',NULL)`,[resScored.id]);
 await rejects(client,`SELECT * FROM public.${RES.calculate}($1)`,[resScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 // Proven in the dedicated hgs.resilience advisory-lock namespace.
 await client.query('BEGIN');await identity(client,one);
 const racedTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','presenting to the board')")).rows[0];
 const raced=(await client.query(`SELECT * FROM public.${RES.create}($1,'LOW',NULL)`,[racedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('${RES.lock}'||$1::text,0))`,[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query(`SELECT * FROM public.${RES.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Resilience calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query(`SELECT * FROM public.${RES.correct}($1,'VERY_HIGH',NULL)`,[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Resilience was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Resilience result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HGS Resilience v1 - the second HGS metric: fifteen-calibrated phase state with the prior HSE/HBS/HRS metrics and Self-Awareness unchanged, HGS/UNRESOLVED/null identity with no forced CAPABILITY/TRAIT or invented RESILIENCE/GROWTH semantic type, exact dedicated governance artifacts with one exactly-ten-basis approval and no external/clinical/trauma-recovery validation claim, reuse of the owned GOAL/SITUATION target substrate with no HGS-specific target authority and DECISION/RELATIONSHIP/fabricated targets rejected, owner target-bound creation with NULL event temporal windows (no recovery period, no time-to-recovery) and untrusted client time, full scored and unassessed semantics (no meaningful adversity, too-early-to-judge adaptation, challenge dependence, and NOT_SURE all UNASSESSED/null - never zero, never high, never low) with sibling vocabularies rejected, structural cross-metric impossibility in every direction with the mandated coexistence proofs (Stress=5 with Resilience=5 on the same SITUATION proving Resilience is not the absence of distress, Self-Awareness=5 with Resilience=1 and Self-Awareness=1 with Resilience=5, Motivation=5 with Resilience=1 and Motivation=1 with Resilience=5, Self-Confidence=5 with Resilience=1), no remaining-HGS observation accepted by the substrate (sibling-HGS authority absence proven statically against the frozen 0047 migration text, never against the live function universe), correction/currentness preserving the exact target and NULL window, idempotent and race-safe calculation in the dedicated lock namespace, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
