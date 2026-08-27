import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0040_hbs_avoidance_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');

test('0040 is the only new migration and orders after 0039',()=>{
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0040_hbs_avoidance_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0040')).length,1,'exactly one migration 0040');
 // The next-migration phase boundary is owned by the later phase's static
 // contract (hbs-consistency-initiative-measurement-models-v1.test.mjs).
 assert.ok(migrations.indexOf('0040_hbs_avoidance_measurement_model_v1.sql')>migrations.indexOf('0039_foreground_generating_turn_recovery_v1.sql'));
});
test('freezes the exact model, instrument, and scale identities',()=>{
 assert.match(sql,/hbs\.avoidance\.direct-structured-seven-day-self-report/);
 assert.match(sql,/hbs\.avoidance\.direct-target-bound-seven-day-report/);
 assert.match(sql,/'hbs\.avoidance\.frequency-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_REPORT/);
 assert.match(sql,/FIRST_CLASS_TARGET_BOUND_PERIOD_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.match(sql,/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/);
});
test('binds the exact scored and unassessed frequency vocabulary as an explicit per-family union',()=>{
 assert.match(sql,/"NEVER":1,"RARELY":2,"SOMETIMES":3,"OFTEN":4,"ALMOST_ALWAYS":5/);
 assert.match(sql,/ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]/);
 // The HSE vocabulary stays bound to the five HSE metrics — never widened.
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/WHEN 'NEVER' THEN 1 WHEN 'RARELY' THEN 2 WHEN 'SOMETIMES' THEN 3 WHEN 'OFTEN' THEN 4 WHEN 'ALMOST_ALWAYS' THEN 5 ELSE NULL END/);
 // Unassessed responses and missingness are null, never zero; no thresholds,
 // bands, averages, or clinical cutoffs exist. The only permitted "clinical"
 // token is the approval's explicit NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM.
 assert.match(sql,/NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/);
 assert.doesNotMatch(executable,/THEN 0|healthy|unhealthy|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]/i);
});
test('is GOAL/SITUATION target-bound only with fail-closed authority',()=>{
 assert.match(sql,/context_kind=ANY\(ARRAY\['GOAL','SITUATION'\]\)/);
 assert.match(sql,/'hbs\.avoidance',1,'GOAL',1,'ACTIVE'/);
 assert.match(sql,/'hbs\.avoidance',1,'SITUATION',1,'ACTIVE'/);
 assert.doesNotMatch(sql,/'hbs\.avoidance',1,'GLOBAL',1,'ACTIVE'|'hbs\.avoidance',1,'CONVERSATION_SESSION',1,'ACTIVE'|'hbs\.avoidance',1,'DECISION',1,'ACTIVE'/);
 assert.match(sql,/Unknown, cross-user, or unsupported Avoidance measurement target/);
 assert.match(sql,/him_measurement_targets/);
 assert.doesNotMatch(executable,/GLOBAL avoidance|cross-target/i);
});
test('keeps the semantic mapping unresolved with a NULL semantic type',()=>{
 assert.match(sql,/'UNRESOLVED',NULL/);
 assert.match(sql,/semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 assert.doesNotMatch(sql,/semantic_type='BEHAVIOR'|'RESOLVED','STATE'.*hbs/s);
});
test('is a direct structured report with a server-derived seven-day window only',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 assert.match(sql,/canonical_now-interval '7 days',canonical_now/);
 assert.match(sql,/observation_window_end-e\.observation_window_start<>interval '7 days'/);
 assert.match(sql,/observation_window_start IS NULL AND observation_window_end IS NULL/,'HSE right-now events stay null-window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 // The caller can never choose the window: no window parameter exists.
 assert.doesNotMatch(sql,/p_window|p_period|p_days|p_observation_window/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Avoidance.
 assert.doesNotMatch(trend,/hbs\.avoidance/);
 assert.doesNotMatch(snapshot,/hbs\.avoidance/);
});
test('activates the six/eleven phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hbs\.avoidance\.frequency-5\.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1' WHERE metric_key='hbs\.avoidance' AND definition_version=1/);
 assert.match(sql,/CALIBRATED'\)<>6/);
 assert.match(sql,/UNCALIBRATED'\)<>11/);
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update');
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
});
