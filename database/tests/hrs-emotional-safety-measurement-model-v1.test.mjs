import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0045_hrs_emotional_safety_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');

test('0045 exists exactly once and orders after 0044',()=>{
 // Historical phase guarantee only: this contract owns migration 0045's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add migration 0046 and beyond, and nothing
 // here (or in any Emotional Safety verifier) asserts that a later migration
 // can never exist, that 0045 is the last migration, or that the global
 // calibrated/uncalibrated count or the exact HGS uncalibrated list stays
 // frozen forever.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0045_hrs_emotional_safety_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0045')).length,1,'exactly one migration 0045');
 assert.ok(migrations.indexOf('0045_hrs_emotional_safety_measurement_model_v1.sql')>migrations.indexOf('0044_hrs_communication_repair_measurement_models_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0045.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0046/,'the historical 0045 verifier asserts no migration-0046 ceiling');
 assert.doesNotMatch(verifier,/<>13(?!\d)|!==13(?!\d)|<>4(?!\d)/,'the historical 0045 verifier freezes no global calibrated/uncalibrated count');
});
test('freezes the exact metric, model, instrument, and scale identities',()=>{
 assert.match(sql,/hrs\.emotional-safety\.direct-structured-current-emotional-openness-safety/);
 assert.match(sql,/hrs\.emotional-safety\.direct-relationship-bound-emotional-openness-safety-report/);
 assert.match(sql,/'hrs\.emotional-safety\.openness-safety-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT/);
 assert.match(sql,/qandeel\.him\.emotional-safety\.foundation-approval/);
 assert.match(sql,/FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.equal((sql.match(/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/g)??[]).length,1,'exactly one calibrated production model - never shared with a sibling');
 // The one ACTIVE binding wires exclusively the Emotional Safety model,
 // instrument, scale, and approval: no artifact is shared with Trust,
 // Communication, or Repair even though all four use the 1-5 numeric shape.
 assert.match(sql,/'hrs\.emotional-safety',1,'RELATIONSHIP',1,'ACTIVE','hrs\.emotional-safety\.direct-structured-current-emotional-openness-safety',1,'hrs\.emotional-safety\.direct-relationship-bound-emotional-openness-safety-report',1,'hrs\.emotional-safety\.openness-safety-5\.v1',1,'qandeel\.him\.emotional-safety\.foundation-approval'/);
 assert.equal((sql.match(/external_validation_claimed/g)??[]).length,1);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_EMOTIONAL_SAFETY_CANONICAL_APPROVAL'/);
});
test('binds the exact response vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/metric_key='hrs\.emotional-safety' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VULNERABILITY_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, Reflection, Trust, Communication, and Repair
 // vocabularies stay bound to their exact metric families - never widened,
 // never merged into a shared list, and the union is rebuilt from the
 // canonical 0044 definition (the 0014 DECISION kind and every prior branch
 // survive).
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.reflection' AND response_code=ANY\(ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.relationship-trust' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.communication' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.repair' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 assert.match(sql,/ARRAY\['SITUATION','DECISION'\]/,'the 0014 DECISION observation branches survive the rebuilt union');
 assert.match(sql,/'SITUATION','CONVERSATION_SESSION','DECISION'/,'the Attention DECISION binding branch survives the rebuilt union');
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,1,'the special codes and NOT_SURE map to NULL - never zero, never a midpoint, never a substituted value');
 // No zero substitution, thresholds, safe/unsafe bands, abuse or clinical
 // cutoffs, normalization, or cross-relationship/user ranking exists; the
 // only permitted "clinical" token is the approval's explicit
 // SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM basis entry.
 assert.equal((sql.match(/SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/g)??[]).length,1);
 assert.doesNotMatch(executable,/THEN 0|healthy|unhealthy|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]|ranking/i);
});
test('is RELATIONSHIP-bound only and reuses the exact 0043 owned target substrate',()=>{
 for(const context of['GLOBAL','GOAL','SITUATION','CONVERSATION_SESSION','DECISION'])assert.doesNotMatch(sql,new RegExp(`'hrs\\.emotional-safety',1,'${context}',1,'ACTIVE'`),`hrs.emotional-safety/${context} must remain unsupported`);
 // The metric reuses the 0043 RELATIONSHIP target substrate: the dedicated
 // functions look up an existing owned RELATIONSHIP target, and 0045 never
 // creates a table, a second target-creation RPC, a target row, or any
 // relationship/social-graph/contact/person model, and never touches the
 // 0043 target/event context-kind unions.
 assert.match(sql,/Unknown, cross-user, or unsupported Emotional Safety RELATIONSHIP target/);
 assert.match(executable,/context_kind='RELATIONSHIP'/);
 assert.doesNotMatch(executable,/CREATE TABLE/i,'0045 creates no table of any kind');
 assert.doesNotMatch(executable,/create_him_relationship_measurement_target_v1|create_him_motivation_measurement_target|create_him_attention_measurement_context/,'no target-creation RPC is added, rewritten, or broadened');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0045 never fabricates a measurement target');
 assert.doesNotMatch(executable,/him_measurement_targets_context_kind_check|him_measurement_event_context_kind_check/,'the 0043 target and event context-kind unions are untouched');
 assert.doesNotMatch(executable,/contact|address_book|person_record|linked_user|partner_account|other_user|counterpart|couple/i,'no contact/person/social-graph/couple model exists');
});
test('keeps the semantic mapping unresolved with a NULL semantic type and no safety semantic type',()=>{
 assert.equal((sql.match(/'UNRESOLVED',NULL/g)??[]).length,1,'the snapshot preserves UNRESOLVED with a NULL semantic type');
 assert.match(sql,/metric_key='hrs\.emotional-safety' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 // Neither the RELATIONSHIP context kind nor the word "Safety" becomes a
 // semantic type, and no SAFETY/EMOTIONAL_SAFETY/STATE/TRAIT/READINESS/
 // CAPABILITY/LOAD/PROGRESS mapping is made.
 assert.doesNotMatch(executable,/semantic_type='RELATIONSHIP'|semantic_type='SAFETY'|semantic_type='EMOTIONAL_SAFETY'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'|'RESOLVED','LOAD'|'RESOLVED','PROGRESS'/);
});
test('is a direct structured at-report appraisal with a NULL temporal window - not the seven-day period model',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The create path inserts a bare event (the durable 0040 window pair stays
 // NULL), the calculation refuses any non-NULL window, and the snapshot
 // insert names no temporal_window columns at all.
 assert.equal((sql.match(/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/g)??[]).length,1);
 assert.match(sql,/Emotional Safety observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'hrs\.emotional-safety\.observation:'/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('keeps Emotional Safety fully independent of every sibling with no composite, derivation, or safety verdict',()=>{
 // The dedicated authority functions never read a sibling's rows: every
 // observation lookup filters hrs.emotional-safety, and no inverse,
 // composite, or sibling-derived value exists. The approval's independence
 // basis token is the only permitted mention of the sibling concepts in
 // executable SQL.
 assert.match(sql,/EMOTIONAL_SAFETY_NOT_TRUST_COMMUNICATION_REPAIR_OR_OBJECTIVE_ABUSE_SAFETY/);
 assert.match(sql,/VULNERABILITY_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED/);
 const authority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hrs_emotional_safety_measurement_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(authority.includes('calculate_hrs_emotional_safety_measurement_v1'),'the Emotional Safety authority slice covers its three dedicated functions');
 assert.doesNotMatch(authority,/hrs\.relationship-trust|hrs\.communication|hrs\.repair|hbs\.|hgs\.|hse\./,'no sibling HRS, HBS, HGS, or HSE metric is ever scored or read by the Emotional Safety authority');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|relationship_score|relationship_health|emotional_safety_score|safety_score|trust_score|hrs_score/i);
 // No executable measurement path converts the numeric value into any
 // safety, abuse, danger, or stay/leave verdict, and no Safety Runtime
 // table, function, or gate is read, called, suppressed, or modified.
 assert.doesNotMatch(executable,/\bunsafe\b|abus(?!e_safety)|coerc|gaslight|manipulat|harass|danger|imminent|\bshould_stay\b|\bshould_leave\b|stay_or_leave|verdict|safety_gate|safety_runtime|safety_response|risk_level/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hrs\.(?:relationship-trust|communication|repair)|UPDATE public\.him_metric_definitions[^;]*hgs\./s,'0045 never rewrites a sibling or HGS definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update - the activated metric only');
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry|sentiment/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Emotional Safety or any HRS metric.
 assert.doesNotMatch(trend,/hrs\./);
 assert.doesNotMatch(snapshot,/hrs\./);
});
test('activates the one-time thirteen/four phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hrs\.emotional-safety\.openness-safety-5\.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT_V1' WHERE metric_key='hrs\.emotional-safety' AND definition_version=1/);
 // The 13/4 counts are a migration-time transition invariant inside 0045
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later HIM Expansion phases can calibrate further metrics.
 assert.match(sql,/CALIBRATED'\)<>13/);
 assert.match(sql,/UNCALIBRATED'\)<>4/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 // The current structured view carries exactly the thirteen calibrated
 // routes - every HSE/HBS route and all four HRS routes survive, and no
 // HGS metric is routed.
 assert.match(sql,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair','hrs\.emotional-safety'\]/);
});
