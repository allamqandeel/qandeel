import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0044_hrs_communication_repair_measurement_models_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');

test('0044 exists exactly once and orders after 0043',()=>{
 // Historical phase guarantee only: this contract owns migration 0044's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add migration 0045 and beyond, and nothing
 // here (or in any Communication/Repair verifier) asserts that a later
 // migration can never exist or freezes a global calibrated/uncalibrated
 // count.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0044_hrs_communication_repair_measurement_models_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0044')).length,1,'exactly one migration 0044');
 assert.ok(migrations.indexOf('0044_hrs_communication_repair_measurement_models_v1.sql')>migrations.indexOf('0043_hrs_relationship_trust_measurement_model_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0044.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0045/,'the historical 0044 verifier asserts no migration-0045 ceiling');
 assert.doesNotMatch(verifier,/<>12(?!\d)|!==12(?!\d)|<>5(?!\d)/,'the historical 0044 verifier freezes no global calibrated/uncalibrated count');
});
test('freezes both exact metric, model, instrument, and scale identities as separate artifacts',()=>{
 assert.match(sql,/hrs\.communication\.direct-structured-current-communication-workability/);
 assert.match(sql,/hrs\.communication\.direct-relationship-bound-communication-workability-report/);
 assert.match(sql,/'hrs\.communication\.workability-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT/);
 assert.match(sql,/qandeel\.him\.communication\.foundation-approval/);
 assert.match(sql,/hrs\.repair\.direct-structured-current-repair-effectiveness/);
 assert.match(sql,/hrs\.repair\.direct-relationship-bound-repair-effectiveness-report/);
 assert.match(sql,/'hrs\.repair\.effectiveness-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT/);
 assert.match(sql,/qandeel\.him\.repair\.foundation-approval/);
 assert.match(sql,/FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.equal((sql.match(/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/g)??[]).length,2,'one calibrated production model per metric - never shared');
 // Each ACTIVE binding wires exclusively its own metric's model, instrument,
 // scale, and approval: no artifact is shared between the two metrics even
 // though both use the same 1-5 numeric shape.
 assert.match(sql,/'hrs\.communication',1,'RELATIONSHIP',1,'ACTIVE','hrs\.communication\.direct-structured-current-communication-workability',1,'hrs\.communication\.direct-relationship-bound-communication-workability-report',1,'hrs\.communication\.workability-5\.v1',1,'qandeel\.him\.communication\.foundation-approval'/);
 assert.match(sql,/'hrs\.repair',1,'RELATIONSHIP',1,'ACTIVE','hrs\.repair\.direct-structured-current-repair-effectiveness',1,'hrs\.repair\.direct-relationship-bound-repair-effectiveness-report',1,'hrs\.repair\.effectiveness-5\.v1',1,'qandeel\.him\.repair\.foundation-approval'/);
 assert.equal((sql.match(/external_validation_claimed/g)??[]).length,2);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_COMMUNICATION_CANONICAL_APPROVAL'/);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_REPAIR_CANONICAL_APPROVAL'/);
});
test('binds both exact response vocabularies with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/metric_key='hrs\.communication' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.repair' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, Reflection, and Relationship Trust vocabularies
 // stay bound to their exact metric families - never widened, never merged
 // into a shared list, and the union is rebuilt from the canonical 0043
 // definition (the 0014 DECISION kind and every prior branch survive).
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.reflection' AND response_code=ANY\(ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.relationship-trust' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/ARRAY\['SITUATION','DECISION'\]/,'the 0014 DECISION observation branches survive the rebuilt union');
 assert.match(sql,/'SITUATION','CONVERSATION_SESSION','DECISION'/,'the Attention DECISION binding branch survives the rebuilt union');
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,2,'each metric maps its special codes and NOT_SURE to NULL, never zero and never a midpoint');
 // No thresholds, bands, averages, or clinical cutoffs exist; the only
 // permitted "clinical" token is each approval's explicit
 // SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM basis entry.
 assert.equal((sql.match(/SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/g)??[]).length,2);
 assert.doesNotMatch(executable,/THEN 0|healthy|unhealthy|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]/i);
});
test('is RELATIONSHIP-bound only and reuses the exact 0043 owned target substrate',()=>{
 for(const context of['GLOBAL','GOAL','SITUATION','CONVERSATION_SESSION','DECISION'])for(const key of['hrs\\.communication','hrs\\.repair'])assert.doesNotMatch(sql,new RegExp(`'${key}',1,'${context}',1,'ACTIVE'`),`${key}/${context} must remain unsupported`);
 // Both metrics reuse the 0043 RELATIONSHIP target substrate: the dedicated
 // functions look up an existing owned RELATIONSHIP target, and 0044 never
 // creates a table, a second target-creation RPC, a target row, or any
 // relationship/social-graph/contact/person model, and never touches the
 // 0043 target/event context-kind unions.
 assert.match(sql,/Unknown, cross-user, or unsupported Communication RELATIONSHIP target/);
 assert.match(sql,/Unknown, cross-user, or unsupported Repair RELATIONSHIP target/);
 assert.match(executable,/context_kind='RELATIONSHIP'/);
 assert.doesNotMatch(executable,/CREATE TABLE/i,'0044 creates no table of any kind');
 assert.doesNotMatch(executable,/create_him_relationship_measurement_target_v1|create_him_motivation_measurement_target|create_him_attention_measurement_context/,'no target-creation RPC is added, rewritten, or broadened');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0044 never fabricates a measurement target');
 assert.doesNotMatch(executable,/him_measurement_targets_context_kind_check|him_measurement_event_context_kind_check/,'the 0043 target and event context-kind unions are untouched');
 assert.doesNotMatch(executable,/contact|address_book|person_record|linked_user|partner_account|other_user|counterpart/i,'no contact/person/social-graph model exists');
});
test('keeps both semantic mappings unresolved with NULL semantic types',()=>{
 assert.equal((sql.match(/'UNRESOLVED',NULL/g)??[]).length,2,'each snapshot preserves UNRESOLVED with a NULL semantic type');
 assert.match(sql,/metric_key='hrs\.communication' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 assert.match(sql,/metric_key='hrs\.repair' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 // The RELATIONSHIP context kind never becomes a semantic type, and no
 // COMMUNICATION/REPAIR/STATE/TRAIT/READINESS/CAPABILITY mapping is made.
 assert.doesNotMatch(executable,/semantic_type='RELATIONSHIP'|semantic_type='COMMUNICATION'|semantic_type='REPAIR'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'/);
});
test('is a pair of direct structured at-report appraisals with NULL temporal windows - not the seven-day period model',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // Both create paths insert a bare event (the durable 0040 window pair
 // stays NULL), both calculations refuse any non-NULL window, and the
 // snapshot inserts name no temporal_window columns at all.
 assert.equal((sql.match(/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/g)??[]).length,2);
 assert.match(sql,/Communication observation window must remain NULL/);
 assert.match(sql,/Repair observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'neither snapshot carries a temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'hrs\.communication\.observation:'/);
 assert.match(sql,/'hrs\.repair\.observation:'/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('keeps Communication and Repair fully independent of each other and every sibling with no composite or safety verdict',()=>{
 // The dedicated authority functions never read a sibling's rows: every
 // observation lookup inside a Communication function filters
 // hrs.communication and every Repair lookup filters hrs.repair, and no
 // inverse, composite, or sibling-derived value exists. Each approval's
 // independence basis token is the only permitted mention of the sibling
 // concepts in executable SQL, and no executable path scores Emotional
 // Safety.
 assert.match(sql,/COMMUNICATION_NOT_TRUST_REPAIR_EMOTIONAL_SAFETY_AGREEMENT_OR_SATISFACTION/);
 assert.match(sql,/REPAIR_NOT_TRUST_COMMUNICATION_EMOTIONAL_SAFETY_FORGIVENESS_OR_CONFLICT_ABSENCE/);
 const communicationAuthority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hrs_communication_measurement_v1'),executable.indexOf('CREATE FUNCTION public.create_hrs_repair_measurement_v1'));
 assert.ok(communicationAuthority.includes('calculate_hrs_communication_measurement_v1'),'the Communication authority slice covers its three dedicated functions');
 assert.doesNotMatch(communicationAuthority,/hrs\.repair|hrs\.relationship-trust|hrs\.emotional-safety|hbs\.|hgs\.|hse\./,'no sibling HRS, HBS, HGS, or HSE metric is ever scored or read by the Communication authority');
 const repairAuthority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hrs_repair_measurement_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(repairAuthority.includes('calculate_hrs_repair_measurement_v1'),'the Repair authority slice covers its three dedicated functions');
 assert.doesNotMatch(repairAuthority,/hrs\.communication|hrs\.relationship-trust|hrs\.emotional-safety|hbs\.|hgs\.|hse\./,'no sibling HRS, HBS, HGS, or HSE metric is ever scored or read by the Repair authority');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|relationship_score|relationship_health|communication_score|repair_score|trust_score|hrs_score/i);
 // hrs.emotional-safety appears in executable SQL exactly once: inside the
 // one-time inventory invariant that proves it remains UNCALIBRATED - no
 // Emotional Safety observation, scale, model, approval, binding, or
 // calculator exists anywhere in this migration.
 assert.equal((executable.match(/hrs\.emotional-safety/g)??[]).length,1);
 assert.match(executable,/'hrs\.emotional-safety','hgs\.self-awareness','hgs\.resilience','hgs\.purpose-alignment','hgs\.habit-strength'\]\) AND calculation_status<>'UNCALIBRATED'/);
 // Neither metric by itself produces or implies a safety verdict, an abuse
 // assessment, a stay/leave recommendation, or a reconciliation directive -
 // no such vocabulary exists in executable SQL.
 assert.doesNotMatch(executable,/\bunsafe\b|\babus\w*|\bbetray\w*|\bshould_stay\b|\bshould_leave\b|\breconcil\w*|\bforgiv\w*|recommend/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hrs\.(?:relationship-trust|emotional-safety)/s,'0044 never rewrites a sibling definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,2,'exactly two definition updates - one per activated metric');
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry|sentiment/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Communication, Repair, or any HRS metric.
 assert.doesNotMatch(trend,/hrs\./);
 assert.doesNotMatch(snapshot,/hrs\./);
});
test('activates the one-time twelve/five phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hrs\.communication\.workability-5\.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1' WHERE metric_key='hrs\.communication' AND definition_version=1/);
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hrs\.repair\.effectiveness-5\.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1' WHERE metric_key='hrs\.repair' AND definition_version=1/);
 // The 12/5 counts are a migration-time transition invariant inside 0044
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later HIM Expansion phases can calibrate further metrics.
 assert.match(sql,/CALIBRATED'\)<>12/);
 assert.match(sql,/UNCALIBRATED'\)<>5/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 // The current structured view carries exactly the twelve calibrated routes
 // - Relationship Trust and every HSE/HBS route survive, and
 // hrs.emotional-safety is not routed.
 assert.match(sql,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair'\]/);
});
