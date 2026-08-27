import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0041_hbs_consistency_initiative_measurement_models_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');
const avoidance=readFileSync(new URL('../migrations/0040_hbs_avoidance_measurement_model_v1.sql',import.meta.url),'utf8');

test('0041 is the only new migration, orders after 0040, and no migration 0042 exists',()=>{
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0041_hbs_consistency_initiative_measurement_models_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0041')).length,1,'exactly one migration 0041');
 assert.equal(migrations.some(name=>name.startsWith('0042')),false,'no migration 0042');
 assert.ok(migrations.indexOf('0041_hbs_consistency_initiative_measurement_models_v1.sql')>migrations.indexOf('0040_hbs_avoidance_measurement_model_v1.sql'));
});
test('freezes both exact model, instrument, and scale identities',()=>{
 assert.match(sql,/hbs\.consistency\.direct-structured-seven-day-self-report/);
 assert.match(sql,/hbs\.consistency\.direct-target-bound-seven-day-report/);
 assert.match(sql,/'hbs\.consistency\.frequency-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/hbs\.initiative\.direct-structured-seven-day-self-report/);
 assert.match(sql,/hbs\.initiative\.direct-target-bound-seven-day-report/);
 assert.match(sql,/'hbs\.initiative\.frequency-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_REPORT/);
 assert.match(sql,/FIRST_CLASS_TARGET_BOUND_PERIOD_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.match(sql,/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/);
});
test('binds both exact scored and unassessed frequency vocabularies as explicit per-family unions',()=>{
 assert.match(sql,/"NEVER":1,"RARELY":2,"SOMETIMES":3,"OFTEN":4,"ALMOST_ALWAYS":5/);
 assert.match(sql,/ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]/);
 assert.match(sql,/ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]/);
 // The HSE and Avoidance vocabularies stay bound to their exact metric
 // families - never widened, never merged into a shared code list.
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.equal((sql.match(/WHEN 'NEVER' THEN 1 WHEN 'RARELY' THEN 2 WHEN 'SOMETIMES' THEN 3 WHEN 'OFTEN' THEN 4 WHEN 'ALMOST_ALWAYS' THEN 5 ELSE NULL END/g)??[]).length,2,'both special codes and NOT_SURE map to NULL, never zero');
 // Unassessed responses and missingness are null, never zero; no thresholds,
 // bands, averages, or clinical cutoffs exist. The only permitted "clinical"
 // token is the approvals' explicit NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM.
 assert.match(sql,/NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/);
 assert.doesNotMatch(executable,/THEN 0|healthy|unhealthy|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]/i);
});
test('is GOAL/SITUATION target-bound only with fail-closed authority for both metrics',()=>{
 assert.match(sql,/context_kind=ANY\(ARRAY\['GOAL','SITUATION'\]\)/);
 assert.match(sql,/'hbs\.consistency',1,'GOAL',1,'ACTIVE'/);
 assert.match(sql,/'hbs\.consistency',1,'SITUATION',1,'ACTIVE'/);
 assert.match(sql,/'hbs\.initiative',1,'GOAL',1,'ACTIVE'/);
 assert.match(sql,/'hbs\.initiative',1,'SITUATION',1,'ACTIVE'/);
 for(const key of['hbs\\.consistency','hbs\\.initiative'])for(const context of['GLOBAL','CONVERSATION_SESSION','DECISION','RELATIONSHIP'])assert.doesNotMatch(sql,new RegExp(`'${key}',1,'${context}',1,'ACTIVE'`),`${key}/${context} must remain unsupported`);
 assert.match(sql,/Unknown, cross-user, or unsupported Consistency measurement target/);
 assert.match(sql,/Unknown, cross-user, or unsupported Initiative measurement target/);
 assert.match(sql,/him_measurement_targets/);
 assert.doesNotMatch(executable,/GLOBAL consistency|GLOBAL initiative|cross-target/i);
});
test('keeps both semantic mappings unresolved with a NULL semantic type',()=>{
 assert.match(sql,/'UNRESOLVED',NULL/);
 assert.match(sql,/metric_key='hbs\.consistency' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 assert.match(sql,/metric_key='hbs\.initiative' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 assert.doesNotMatch(sql,/semantic_type='BEHAVIOR'|'RESOLVED','STATE'.*hbs/s);
});
test('is a direct structured report with a server-derived seven-day window only',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 assert.equal((sql.match(/canonical_now-interval '7 days',canonical_now/g)??[]).length,2,'both create functions derive the exact server-owned window');
 assert.match(sql,/observation_window_end-e\.observation_window_start<>interval '7 days'/);
 assert.match(sql,/Consistency seven-day observation window mismatch/);
 assert.match(sql,/Initiative seven-day observation window mismatch/);
 assert.match(sql,/p_client_reported_at_untrusted/);
 // The caller can never choose the window: no window parameter exists, and
 // no 14- or 30-day variant is introduced.
 assert.doesNotMatch(sql,/p_window|p_period|p_days|p_observation_window|interval '14 days'|interval '30 days'/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('keeps the two constructs and Avoidance fully independent',()=>{
 // Each calculation reads only its own metric's observation and binding;
 // no inverse (6 - score), composite, or sibling-derived value exists.
 assert.match(sql,/metric_key='hbs\.consistency'/);
 assert.match(sql,/metric_key='hbs\.initiative'/);
 assert.doesNotMatch(executable,/6\s*-\s*score|6-avoidance|composite|behavior_score|behaviour_score/i);
 // The dedicated functions never read a sibling's rows: every observation
 // lookup inside a Consistency function filters hbs.consistency and every
 // one inside an Initiative function filters hbs.initiative.
 const consistencyBody=sql.split('create_hbs_consistency_measurement_v1')[1]?.split('create_hbs_initiative_measurement_v1')[0]??'';
 assert.doesNotMatch(consistencyBody,/metric_key='hbs\.initiative'|metric_key='hbs\.avoidance'/);
 const initiativeBody=sql.split('create_hbs_initiative_measurement_v1').slice(1).join('').split('CREATE OR REPLACE VIEW')[0]??'';
 assert.doesNotMatch(initiativeBody,/metric_key='hbs\.consistency'|metric_key='hbs\.avoidance'/);
 // Migration 0040 stays byte-owned by the Avoidance phase: 0041 never
 // rewrites Avoidance semantics, and Avoidance keeps its exact scale.
 assert.match(sql,/scale_reference='hbs\.avoidance\.frequency-5\.v1'/);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hbs\.avoidance/s);
 assert.match(avoidance,/hbs\.avoidance\.frequency-5\.v1/);
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention either new metric.
 assert.doesNotMatch(trend,/hbs\.consistency|hbs\.initiative/);
 assert.doesNotMatch(snapshot,/hbs\.consistency|hbs\.initiative/);
});
test('activates the eight/nine phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hbs\.consistency\.frequency-5\.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1' WHERE metric_key='hbs\.consistency' AND definition_version=1/);
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hbs\.initiative\.frequency-5\.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1' WHERE metric_key='hbs\.initiative' AND definition_version=1/);
 assert.match(sql,/CALIBRATED'\)<>8/);
 assert.match(sql,/UNCALIBRATED'\)<>9/);
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,2,'exactly two definition updates');
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
});
