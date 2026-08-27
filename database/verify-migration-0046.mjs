import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),fabricated=randomUUID(),past='2001-01-01T00:00:00Z';
const identity=async(c,id)=>{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(c,sql,params=[])=>{await c.query('SAVEPOINT expected_rejection');let failed=false;try{await c.query(sql,params);}catch{failed=true;await c.query('ROLLBACK TO SAVEPOINT expected_rejection');}await c.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const HSE=['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress'];
const SA={key:'hgs.self-awareness',scale:'hgs.self-awareness.clarity-5.v1',model:'hgs.self-awareness.direct-structured-current-self-understanding-clarity',instrument:'hgs.self-awareness.direct-target-bound-self-understanding-clarity-report',approval:'qandeel.him.self-awareness.foundation-approval',method:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT',inputContract:'DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1',provenance:'QANDEEL_HGS_SELF_AWARENESS_MEASUREMENT_V1',specials:['TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'],create:'create_hgs_self_awareness_measurement_v1',correct:'correct_hgs_self_awareness_measurement_v1',calculate:'calculate_hgs_self_awareness_measurement_v1',lock:'hgs.self-awareness.observation:',basis:['HGS_SELF_AWARENESS_CURRENT_TARGET_BOUND_SELF_UNDERSTANDING_CLARITY','DIRECT_STRUCTURED_REPORT','GOAL_SITUATION_ONLY','CURRENT_APPRAISAL_NULL_WINDOW','ORDINAL_CLARITY_5','FACET_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED','SELF_AWARENESS_NOT_REFLECTION_RUMINATION_SELF_CONFIDENCE_OR_OBJECTIVE_INSIGHT_ACCURACY','DETERMINISTIC_CALCULATION','CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY','SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM']};
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
 if([...HSE,'hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness'].some(key=>!calibrated.includes(key)))throw new Error('Expected the five calibrated HSE metrics, the four calibrated HBS metrics, the four calibrated HRS metrics, and calibrated hgs.self-awareness (later HIM Expansion tasks may calibrate more)');
 const definition=state.rows.find(x=>x.metric_key===SA.key);
 if(definition.hif_owner!=='HGS'||definition.semantic_mapping_status!=='UNRESOLVED'||definition.semantic_type!==null||definition.scale_reference!==SA.scale||definition.required_input_contract!==SA.inputContract||definition.dependency_ids.length!==0||definition.consumers.length!==0)throw new Error('hgs.self-awareness definition identity failed');
 // The Reflection boundary sibling and the closest HSE siblings stay
 // calibrated and semantically unchanged - 0046 never rewrites a sibling
 // definition.
 const reflectionDefinition=state.rows.find(x=>x.metric_key==='hbs.reflection');
 if(reflectionDefinition.calculation_status!=='CALIBRATED'||reflectionDefinition.hif_owner!=='HBS'||reflectionDefinition.semantic_mapping_status!=='UNRESOLVED'||reflectionDefinition.semantic_type!==null||reflectionDefinition.scale_reference!=='hbs.reflection.engagement-5.v1'||reflectionDefinition.required_input_contract!=='DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_REFLECTIVE_ENGAGEMENT_REPORT_V1'||reflectionDefinition.dependency_ids.length!==0||reflectionDefinition.consumers.length!==0)throw new Error('hbs.reflection must remain calibrated and unchanged');
 for(const[key,scale]of[['hse.motivation','hse.motivation.ordinal-5.v1'],['hse.self-confidence','hse.self-confidence.ordinal-5.v1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HSE'||sibling.semantic_mapping_status!=='RESOLVED'||sibling.semantic_type!=='STATE'||sibling.scale_reference!==scale||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 for(const[key,scale,inputContract]of[['hrs.relationship-trust','hrs.relationship-trust.reliance-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1'],['hrs.communication','hrs.communication.workability-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1'],['hrs.repair','hrs.repair.effectiveness-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1'],['hrs.emotional-safety','hrs.emotional-safety.openness-safety-5.v1','DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT_V1']]){
  const sibling=state.rows.find(x=>x.metric_key===key);
  if(sibling.calculation_status!=='CALIBRATED'||sibling.hif_owner!=='HRS'||sibling.semantic_mapping_status!=='UNRESOLVED'||sibling.semantic_type!==null||sibling.scale_reference!==scale||sibling.required_input_contract!==inputContract||sibling.dependency_ids.length!==0||sibling.consumers.length!==0)throw new Error(`${key} must remain calibrated and unchanged`);
 }
 // --- Self-Awareness governance: exact dedicated artifacts -------------------
 const scale=await client.query('SELECT * FROM public.him_scale_contracts WHERE scale_contract_id=$1 AND scale_version=1',[SA.scale]);
 // jsonb reorders object keys, so the category mapping is compared structurally.
 const categories=scale.rowCount===1?scale.rows[0].categories:{};
 const expectedCategories={VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5};
 if(scale.rowCount!==1||scale.rows[0].scale_kind!=='ORDINAL'||scale.rows[0].interval_operations||scale.rows[0].ratio_operations||Object.keys(categories).length!==5||Object.entries(expectedCategories).some(([code,value])=>categories[code]!==value))throw new Error('hgs.self-awareness ordinal scale contract failed');
 const model=await client.query('SELECT * FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[SA.model]);
 if(model.rowCount!==1||model.rows[0].lifecycle!=='CALIBRATED'||model.rows[0].environment!=='PRODUCTION'||model.rows[0].scale_contract_reference!==SA.scale||model.rows[0].supported_context_kinds.join()!=='GOAL,SITUATION'||model.rows[0].target_metric_key!==SA.key||model.rows[0].method_type!==SA.method||model.rows[0].required_evidence_contract!=='FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1')throw new Error('hgs.self-awareness calibrated model failed');
 const approval=await client.query('SELECT * FROM public.him_governance_approvals WHERE approval_id=$1',[SA.approval]);
 const basis=approval.rowCount===1?approval.rows[0].approval_basis:[];
 if(approval.rowCount!==1||approval.rows[0].external_validation_claimed||approval.rows[0].model_id!==SA.model||!Array.isArray(basis)||basis.length!==SA.basis.length||SA.basis.some(entry=>!basis.includes(entry)))throw new Error('hgs.self-awareness exactly-ten-basis approval failed or claimed external validation');
 const bindings=await client.query("SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[SA.key]);
 if(bindings.rows.map(x=>x.context_kind).join()!=='GOAL,SITUATION'||bindings.rows.some(x=>x.model_id!==SA.model||x.instrument_id!==SA.instrument||x.scale_contract_reference!==SA.scale))throw new Error('Expected exactly the two hgs.self-awareness GOAL and SITUATION ACTIVE bindings');
 // --- Reflection boundary and sibling isolation inside the owned functions ----
 // Historical scope: exactly the three functions INTRODUCED AND OWNED BY
 // 0046 are queried by exact name and inspected - a future legitimate
 // Self-Awareness helper, v2 authority, or separately reviewed
 // runtime-consumption function is deliberately NOT forbidden here. Each
 // owned function must exist and must neither read nor score any sibling
 // metric, Reflection session surface, Memory, Evidence, or conversation
 // text - the 0046 executable path scores an ordinal self-report and
 // nothing else, and it makes zero provider calls.
 const ownedFunctions=['calculate_hgs_self_awareness_measurement_v1','correct_hgs_self_awareness_measurement_v1','create_hgs_self_awareness_measurement_v1'];
 const procs=await client.query('SELECT proname,prosrc FROM pg_proc WHERE proname=ANY($1::name[]) ORDER BY proname',[ownedFunctions]);
 if(procs.rows.map(x=>x.proname).join()!==ownedFunctions.join())throw new Error('Expected the three 0046-owned Self-Awareness functions to exist');
 // The calculation result's own supporting/contradictory_evidence_refs
 // ledger columns are its provenance shape, not an Evidence read - the
 // forbidden surfaces are the actual sibling metrics, the Reflection
 // session table, and the Memory/Hypothesis/canonical-Evidence stores.
 for(const proc of procs.rows)if(/hbs\.|hse\.|hrs\.|hgs\.resilience|hgs\.purpose-alignment|hgs\.habit-strength|conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items|reflection|insight|rumination|openai|anthropic|llm|provider|http/i.test(proc.prosrc))throw new Error(`${proc.proname} must not read any sibling metric, Reflection surface, Memory, Evidence, conversation text, or provider`);
 // Deliberately NO live-database absence check for future sibling HGS
 // measurement authority (Resilience, Purpose Alignment, Habit Strength):
 // historical verifiers run against the fully migrated latest schema, and
 // later legitimate HGS calibrations create those functions. That 0046
 // itself introduced no sibling HGS authority is proven statically against
 // the frozen 0046 migration text in its contract test - never here.
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query('BEGIN');
 // --- Governance forgery stays fail closed -----------------------------------
 // A Self-Awareness binding can never carry a sibling metric's approval,
 // instrument, or scale (artifacts stay separate even though the numeric
 // shape is the same 1-5), and can never open an unapproved context.
 const bindingInsert=`INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hgs.self-awareness',1,$2,$3,$4,$5,1,$6,1,$7,1,$8,1,now())`;
 await rejects(client,bindingInsert,['4c000000-0000-4000-8000-000000000001','GOAL',2,'PENDING',SA.model,SA.instrument,SA.scale,'qandeel.him.reflection.foundation-approval']);
 await rejects(client,bindingInsert,['4c000000-0000-4000-8000-000000000002','GOAL',3,'PENDING',SA.model,'hbs.reflection.direct-context-bound-reflective-engagement-report',SA.scale,SA.approval]);
 await rejects(client,bindingInsert,['4c000000-0000-4000-8000-000000000003','SITUATION',4,'PENDING',SA.model,SA.instrument,'hse.self-confidence.ordinal-5.v1',SA.approval]);
 for(const context of['RELATIONSHIP','CONVERSATION_SESSION','DECISION','GLOBAL'])await rejects(client,bindingInsert,[randomUUID(),context,5,'PENDING',SA.model,SA.instrument,SA.scale,SA.approval]);
 await identity(client,one);
 await rejects(client,"UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=now() WHERE id='46000000-0000-4000-8000-000000000004'");
 await rejects(client,"INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('4c000000-0000-4000-8000-000000000007','forged.self-awareness.model',1,'hgs.self-awareness',1,'CALIBRATED','PRODUCTION','x','x','x','hgs.self-awareness.clarity-5.v1','{}'::jsonb,'x',ARRAY['GOAL','SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','x',now(),now())");
 // --- The owned GOAL/SITUATION target substrate is reused, not reinvented -----
 // The existing 0013/0014 target RPCs still create valid GOAL/SITUATION
 // targets, DECISION and RELATIONSHIP targets stay creatable through their
 // own historical RPCs, and Self-Awareness accepts no DECISION,
 // RELATIONSHIP, or fabricated target - no HGS-specific target table or
 // target-creation RPC exists.
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','finish thesis draft')")).rows[0];
 const secondGoalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','run every morning')")).rows[0];
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','difficult team meeting')")).rows[0];
 const decisionTarget=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','choose launch date')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('my relationship with Ahmed')")).rows[0];
 if(goalTarget.context_kind!=='GOAL'||situationTarget.context_kind!=='SITUATION'||decisionTarget.context_kind!=='DECISION'||relationshipTarget.context_kind!=='RELATIONSHIP')throw new Error('Existing target creation must remain unchanged');
 // --- Self-Awareness behavioral proof set -------------------------------------
 // Create: owned GOAL or SITUATION target only.
 await rejects(client,`SELECT * FROM public.${SA.create}($1,'MODERATE',NULL)`,[fabricated]);
 await rejects(client,`SELECT * FROM public.${SA.create}($1,'MODERATE',NULL)`,[decisionTarget.id]);
 await rejects(client,`SELECT * FROM public.${SA.create}($1,'MODERATE',NULL)`,[relationshipTarget.id]);
 // The vocabulary is exact: sibling engagement/frequency codes and every
 // sibling special code - Reflection's, Trust's, Communication's,
 // Repair's, and Emotional Safety's - are rejected, along with fabricated
 // codes.
 for(const invalid of['SOMEWHAT','A_GREAT_DEAL','NOT_AT_ALL','ALMOST_ALWAYS','NEVER','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NO_CLEAR_OPPORTUNITY','INSUFFICIENT_REPEATED_OPPORTUNITIES','TOO_CONTEXT_DEPENDENT_TO_RATE','TOO_TOPIC_DEPENDENT_TO_RATE','TOO_EPISODE_DEPENDENT_TO_RATE','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_VULNERABILITY_DEPENDENT_TO_RATE','PERFECTLY_CLEAR'])await rejects(client,`SELECT * FROM public.${SA.create}($1,$2,NULL)`,[goalTarget.id,invalid]);
 // Server authority: derived label/kind/id, NULL event window, untrusted
 // client timestamps.
 const probe=(await client.query(`SELECT * FROM public.${SA.create}($1,'MODERATE',$2)`,[goalTarget.id,past])).rows[0];
 if(new Date(probe.reported_at).getUTCFullYear()===2001||new Date(probe.client_reported_at_untrusted).getUTCFullYear()!==2001)throw new Error('Self-Awareness client timestamp must stay untrusted diagnostic metadata');
 if(probe.metric_key!==SA.key||probe.context_kind!=='GOAL'||probe.context_id!==goalTarget.id||probe.instrument_id!==SA.instrument||probe.scale_contract_reference!==SA.scale||probe.source!=='DIRECT_STRUCTURED_USER_REPORT'||probe.canonical_provenance!==SA.provenance)throw new Error('Self-Awareness server-derived identity failed');
 if(probe.target_label!=='finish thesis draft'||probe.target_context_kind!=='GOAL'||probe.target_context_id!==goalTarget.id)throw new Error('Self-Awareness server-derived GOAL target label/kind/id failed');
 const situationProbe=(await client.query(`SELECT * FROM public.${SA.create}($1,'HIGH',NULL)`,[situationTarget.id])).rows[0];
 if(situationProbe.context_kind!=='SITUATION'||situationProbe.context_id!==situationTarget.id||situationProbe.target_label!=='difficult team meeting'||situationProbe.target_context_kind!=='SITUATION')throw new Error('Self-Awareness server-derived SITUATION target label/kind/id failed');
 const event=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[probe.measurement_event_id])).rows[0];
 if(event.observation_window_start!==null||event.observation_window_end!==null)throw new Error('Self-Awareness event must carry a NULL temporal window');
 // Events are immutable: nobody can retrofit a window onto the event.
 await rejects(client,"UPDATE public.him_measurement_events SET observation_window_start=now()-interval '7 days',observation_window_end=now() WHERE id=$1",[probe.measurement_event_id]);
 // Scored response semantics on isolated measurements in BOTH authorized
 // contexts.
 for(const[code,value]of[['VERY_LOW',1],['LOW',2],['MODERATE',3],['HIGH',4],['VERY_HIGH',5]]){
  const o=(await client.query(`SELECT * FROM public.${SA.create}($1,$2,NULL)`,[goalTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[o.id])).rows[0];
  if(s.metric_key!==SA.key||s.context_kind!=='GOAL'||s.context_id!==goalTarget.id||s.value_state!=='ASSESSED'||s.numeric_value!==value||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null)throw new Error(`Self-Awareness ${code} mapping failed`);
  if(s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null)throw new Error(`Self-Awareness ${code} snapshot must stay UNRESOLVED/null`);
  if(s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Self-Awareness ${code} snapshot must carry a NULL temporal window`);
 }
 // The special codes and NOT_SURE are UNASSESSED/null: never zero, never a
 // midpoint - facet-uneven self-understanding and missing basis are
 // neither low nor high self-awareness, and a too-new context never
 // scores.
 for(const code of SA.specials){
  const o=(await client.query(`SELECT * FROM public.${SA.create}($1,$2,NULL)`,[situationTarget.id,code])).rows[0];
  const s=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[o.id])).rows[0];
  if(s.value_state!=='UNASSESSED'||s.numeric_value!==null||s.semantic_mapping_status!=='UNRESOLVED'||s.semantic_type!==null||s.confidence_state!=='UNASSESSED'||s.confidence_reference!==null||s.temporal_window_start!==null||s.temporal_window_end!==null)throw new Error(`Self-Awareness ${code} must be UNASSESSED null, never zero, never high, never low, and never a midpoint`);
 }
 // Idempotency + correction: same event, same exact target.
 const idem=(await client.query(`SELECT * FROM public.${SA.create}($1,'LOW',NULL)`,[goalTarget.id])).rows[0];
 const firstCalc=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[idem.id])).rows[0];
 const retryCalc=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[idem.id])).rows[0];
 if(firstCalc.id!==retryCalc.id)throw new Error('Self-Awareness recalculation was not idempotent');
 const corrected=(await client.query(`SELECT * FROM public.${SA.correct}($1,'VERY_HIGH',NULL)`,[idem.id])).rows[0];
 if(corrected.measurement_event_id!==idem.measurement_event_id||corrected.context_kind!==idem.context_kind||corrected.context_id!==idem.context_id||corrected.target_context_id!==idem.target_context_id||corrected.target_label!==idem.target_label||corrected.metric_key!==SA.key)throw new Error('Self-Awareness correction changed the measurement event or the target');
 const correctedEvent=(await client.query('SELECT observation_window_start,observation_window_end FROM public.him_measurement_events WHERE id=$1',[idem.measurement_event_id])).rows[0];
 if(correctedEvent.observation_window_start!==null||correctedEvent.observation_window_end!==null)throw new Error('Self-Awareness correction must preserve the NULL event window');
 if((await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rowCount!==0)throw new Error('Superseded Self-Awareness remained current before recalculation');
 const correctedSnapshot=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[corrected.id])).rows[0];
 const current=(await client.query('SELECT * FROM public.him_current_structured_measurements WHERE measurement_event_id=$1',[idem.measurement_event_id])).rows;
 if(current.length!==1||current[0].numeric_value!==5||correctedSnapshot.numeric_value!==5)throw new Error('Corrected Self-Awareness current value failed');
 // The superseded observation can neither calculate nor be corrected again.
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[idem.id]);
 await rejects(client,`SELECT * FROM public.${SA.correct}($1,'VERY_LOW',NULL)`,[idem.id]);
 // Direct assessed snapshot forgery remains blocked.
 await rejects(client,'SELECT * FROM public.create_him_metric_snapshot($1::jsonb)',[{id:randomUUID(),metricKey:SA.key,definitionVersion:1,valueState:'ASSESSED',numericValue:5,supportingEvidenceIds:[],contradictingEvidenceIds:[],contextKind:'GOAL',contextId:goalTarget.id,scope:'forged',validityStatus:'VALID',descriptiveUpdateReason:'forged',descriptiveUpdateReferenceIds:[]}]);
 // No other HGS observation can be fabricated through the substrate either.
 await rejects(client,"INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,locale,source,canonical_provenance,created_at) VALUES($1,$2,$3,'hgs.resilience',1,$4,1,$5,1,'GOAL',$6,'MODERATE',now(),'ar-EG','DIRECT_STRUCTURED_USER_REPORT',$7,now())",[randomUUID(),one,probe.measurement_event_id,SA.instrument,SA.scale,goalTarget.id,SA.provenance]);
 // --- Independent constructs: the mandated Reflection/Motivation coexistence --
 // On the SAME user and the SAME owned SITUATION target, Reflection
 // A_GREAT_DEAL (5) coexists with Self-Awareness VERY_LOW (1): much
 // deliberate reflective process, still-murky perceived clarity. On one
 // GOAL target Motivation VERY_HIGH (5) coexists with Self-Awareness
 // VERY_LOW (1), and on a second GOAL target Motivation VERY_LOW (1)
 // coexists with Self-Awareness VERY_HIGH (5) - no DB invariant derives,
 // modifies, or correlates one metric from another, and Self-Confidence
 // VERY_HIGH (5) on the same SITUATION changes nothing either. No inverse,
 // composite, or forced correlation exists in any direction.
 const reflectionObs=(await client.query("SELECT * FROM public.create_hbs_reflection_measurement_v1('SITUATION',$1,'A_GREAT_DEAL',NULL)",[situationTarget.id])).rows[0];
 const saLowObs=(await client.query(`SELECT * FROM public.${SA.create}($1,'VERY_LOW',NULL)`,[situationTarget.id])).rows[0];
 const motivationHighObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_HIGH',NULL)",[goalTarget.id])).rows[0];
 const saGoalLowObs=(await client.query(`SELECT * FROM public.${SA.create}($1,'VERY_LOW',NULL)`,[goalTarget.id])).rows[0];
 const motivationLowObs=(await client.query("SELECT * FROM public.create_hse_motivation_measurement($1,'VERY_LOW',NULL)",[secondGoalTarget.id])).rows[0];
 const saSecondGoalHighObs=(await client.query(`SELECT * FROM public.${SA.create}($1,'VERY_HIGH',NULL)`,[secondGoalTarget.id])).rows[0];
 const selfConfidenceObs=(await client.query("SELECT * FROM public.create_hse_self_confidence_measurement('SITUATION',$1,'VERY_HIGH',NULL)",[situationTarget.id])).rows[0];
 const avoidanceObs=(await client.query("SELECT * FROM public.create_hbs_avoidance_measurement_v1($1,'ALMOST_ALWAYS',NULL)",[situationTarget.id])).rows[0];
 const trustObs=(await client.query("SELECT * FROM public.create_hrs_relationship_trust_measurement_v1($1,'VERY_HIGH',NULL)",[relationshipTarget.id])).rows[0];
 // Self-Awareness can never calculate or correct a Reflection, Motivation,
 // Self-Confidence, Avoidance, or Trust observation...
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[reflectionObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[selfConfidenceObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[avoidanceObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[trustObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.correct}($1,'VERY_LOW',NULL)`,[reflectionObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.correct}($1,'VERY_LOW',NULL)`,[motivationHighObs.id]);
 await rejects(client,`SELECT * FROM public.${SA.correct}($1,'VERY_LOW',NULL)`,[selfConfidenceObs.id]);
 // ...Reflection, Motivation, and Self-Confidence can never calculate or
 // correct the Self-Awareness observation...
 await rejects(client,'SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[saLowObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_motivation_measurement($1)',[saGoalLowObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[saLowObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hbs_reflection_measurement_v1($1,'NOT_AT_ALL',NULL)",[saLowObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hse_motivation_measurement($1,'VERY_LOW',NULL)",[saGoalLowObs.id]);
 await rejects(client,"SELECT * FROM public.correct_hse_self_confidence_measurement($1,'VERY_LOW',NULL)",[saLowObs.id]);
 // ...and no representative HBS/HRS calculator can score the
 // Self-Awareness observation either.
 await rejects(client,'SELECT * FROM public.calculate_hbs_avoidance_measurement_v1($1)',[saLowObs.id]);
 await rejects(client,'SELECT * FROM public.calculate_hrs_relationship_trust_measurement_v1($1)',[saLowObs.id]);
 const reflectionSnap=(await client.query('SELECT * FROM public.calculate_hbs_reflection_measurement_v1($1)',[reflectionObs.id])).rows[0];
 const saLowSnap=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[saLowObs.id])).rows[0];
 const motivationHighSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationHighObs.id])).rows[0];
 const saGoalLowSnap=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[saGoalLowObs.id])).rows[0];
 const motivationLowSnap=(await client.query('SELECT * FROM public.calculate_hse_motivation_measurement($1)',[motivationLowObs.id])).rows[0];
 const saSecondGoalHighSnap=(await client.query(`SELECT * FROM public.${SA.calculate}($1)`,[saSecondGoalHighObs.id])).rows[0];
 const selfConfidenceSnap=(await client.query('SELECT * FROM public.calculate_hse_self_confidence_measurement($1)',[selfConfidenceObs.id])).rows[0];
 if(reflectionSnap.numeric_value!==5||saLowSnap.numeric_value!==1)throw new Error('High Reflection (5) + low Self-Awareness (1) on the same SITUATION failed');
 if(motivationHighSnap.numeric_value!==5||saGoalLowSnap.numeric_value!==1)throw new Error('High Motivation (5) + low Self-Awareness (1) on the same GOAL failed');
 if(motivationLowSnap.numeric_value!==1||saSecondGoalHighSnap.numeric_value!==5)throw new Error('Low Motivation (1) + high Self-Awareness (5) on the same GOAL failed');
 if(selfConfidenceSnap.numeric_value!==5||saLowSnap.numeric_value!==1)throw new Error('High Self-Confidence (5) + low Self-Awareness (1) on the same SITUATION failed');
 // The freely differing values changed nothing else: the sibling current
 // values are untouched (no inverse, composite, or derived mutation), and
 // no accuracy/growth-shaped artifact appeared anywhere in the rows this
 // path produced.
 const situationCurrent=(await client.query('SELECT metric_key,numeric_value FROM public.him_current_structured_measurements WHERE context_id=$1 AND measurement_observation_id=ANY($2::uuid[]) ORDER BY metric_key',[situationTarget.id,[reflectionObs.id,saLowObs.id,selfConfidenceObs.id]])).rows;
 if(situationCurrent.map(x=>`${x.metric_key}=${x.numeric_value}`).join()!=='hbs.reflection=5,hgs.self-awareness=1,hse.self-confidence=5')throw new Error('The Reflection/Self-Awareness/Self-Confidence current values must coexist independently');
 for(const produced of[saLowSnap,correctedSnapshot])if(Object.values(produced).some(value=>typeof value==='string'&&/\b(ACCURATE|INACCURATE|INSIGHTFUL|GROWTH_ACHIEVED|WISER|DIAGNOSIS)\b/i.test(value)))throw new Error('The 0046 Self-Awareness calculation path must emit no accuracy/growth/diagnosis classification value');
 // Each calculation result carries only its own model and binding
 // provenance. (Bindings are not directly readable by the authenticated
 // role, so this audit join runs as the superuser and the user identity is
 // restored after.)
 await client.query('RESET ROLE');
 const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric,b.instrument_id FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[saLowObs.id]);
 if(provenance.rows.length!==1||provenance.rows[0].metric_key!==SA.key||provenance.rows[0].binding_metric!==SA.key||provenance.rows[0].model_id!==SA.model||provenance.rows[0].instrument_id!==SA.instrument)throw new Error('Self-Awareness calculation provenance failed');
 await identity(client,one);
 // --- Trend v1 and Intelligence Snapshot v1 non-consumption -------------------
 // Both frozen v1 read surfaces reject Self-Awareness outright - even for
 // the owner of a real target with real calculated values - and the
 // existing GOAL/SITUATION slot sets stay exact with no Self-Awareness
 // leakage.
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.self-awareness',1,'GOAL',$2,now()-interval '30 days',now())",[one,goalTarget.id]);
 await rejects(client,"SELECT * FROM public.read_him_trend_source_v1($1,'hgs.self-awareness',1,'SITUATION',$2,now()-interval '30 days',now())",[one,situationTarget.id]);
 const goalIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('GOAL',$1)",[goalTarget.id])).rows.map(x=>x.metric_key).sort();
 if(goalIntelligence.join()!=='hse.motivation')throw new Error('GOAL Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Self-Awareness');
 const situationIntelligence=(await client.query("SELECT metric_key FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situationTarget.id])).rows.map(x=>x.metric_key).sort();
 if(situationIntelligence.join()!=='hse.attention,hse.motivation,hse.self-confidence,hse.stress')throw new Error('SITUATION Intelligence Snapshot v1 must stay the exact five-HSE STATE contract without Self-Awareness');
 // --- Cross-user / anon authority ---------------------------------------------
 const saScored=(await client.query(`SELECT * FROM public.${SA.create}($1,'HIGH',NULL)`,[goalTarget.id])).rows[0];
 await client.query('RESET ROLE');await identity(client,two);
 if((await client.query("SELECT * FROM public.him_measurement_observations WHERE metric_key='hgs.self-awareness'")).rowCount!==0||(await client.query('SELECT * FROM public.him_measurement_targets')).rowCount!==0||(await client.query("SELECT * FROM public.him_current_structured_measurements WHERE metric_key='hgs.self-awareness'")).rowCount!==0)throw new Error('Owner-only Self-Awareness read isolation failed');
 await rejects(client,`SELECT * FROM public.${SA.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${SA.correct}($1,'VERY_LOW',NULL)`,[saScored.id]);
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[saScored.id]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(client,`SELECT * FROM public.${SA.create}($1,'VERY_LOW',NULL)`,[goalTarget.id]);
 await rejects(client,`SELECT * FROM public.${SA.correct}($1,'VERY_LOW',NULL)`,[saScored.id]);
 await rejects(client,`SELECT * FROM public.${SA.calculate}($1)`,[saScored.id]);
 await client.query('ROLLBACK');

 // --- Real two-connection correction/calculation serialization ---------------
 // Proven in the dedicated hgs.self-awareness advisory-lock namespace.
 await client.query('BEGIN');await identity(client,one);
 const racedTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','presenting to the board')")).rows[0];
 const raced=(await client.query(`SELECT * FROM public.${SA.create}($1,'LOW',NULL)`,[racedTarget.id])).rows[0];
 await client.query('COMMIT');
 const racer=new Client({connectionString:process.env.DATABASE_URL});await racer.connect();
 try{
  await client.query('BEGIN');await identity(client,one);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('${SA.lock}'||$1::text,0))`,[raced.id]);
  await client.query('RESET ROLE');
  await racer.query('BEGIN');await identity(racer,one);
  const pid=(await racer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const waiting=racer.query(`SELECT * FROM public.${SA.calculate}($1)`,[raced.id]).then(()=>false,()=>true);
  let blocked=false;for(let n=0;n<50&&!blocked;n++){await new Promise(r=>setTimeout(r,20));blocked=(await client.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock';}
  if(!blocked)throw new Error('Self-Awareness calculation did not wait on the correction lock');
  await identity(client,one);
  await client.query(`SELECT * FROM public.${SA.correct}($1,'VERY_HIGH',NULL)`,[raced.id]);
  await client.query('COMMIT');
  if(!(await waiting))throw new Error('Superseded Self-Awareness was calculated after the correction won the race');
  await racer.query('ROLLBACK');
  const artifacts=await client.query('SELECT count(*)::int n FROM public.him_calculation_results WHERE measurement_observation_id=$1',[raced.id]);
  if(artifacts.rows[0].n!==0)throw new Error('Race created a stale Self-Awareness result');
 }finally{await racer.end();}
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HGS Self-Awareness v1 - the first HGS metric: fourteen-calibrated phase state with the prior HSE/HBS/HRS metrics unchanged, HGS/UNRESOLVED/null identity with no forced CAPABILITY or invented SELF_AWARENESS/GROWTH semantic type, exact dedicated governance artifacts with one exactly-ten-basis approval and no external validation claim, reuse of the owned GOAL/SITUATION target substrate with no HGS-specific target authority and DECISION/RELATIONSHIP/fabricated targets rejected, owner target-bound creation with NULL event temporal windows and untrusted client time, full scored and unassessed semantics (facet dependence, insufficient basis, and NOT_SURE all UNASSESSED/null - never zero, never high, never low) with sibling vocabularies rejected, structural cross-metric impossibility in every direction with the mandated coexistence proofs (Reflection=5 with Self-Awareness=1 on the same SITUATION, Motivation=5 with Self-Awareness=1 and Motivation=1 with Self-Awareness=5 on the same GOALs, Self-Confidence=5 with Self-Awareness=1 on the same SITUATION), no other HGS observation accepted by the substrate (sibling-HGS authority absence proven statically against the frozen 0046 migration text, never against the live function universe), correction/currentness preserving the exact target and NULL window, idempotent and race-safe calculation in the dedicated lock namespace, fail-closed cross-user/anon/forgery authority, supersession-aware current reads, and explicit Trend v1 + Intelligence Snapshot v1 non-consumption with zero provider calls.');
