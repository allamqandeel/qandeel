import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0043_hrs_relationship_trust_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');

test('0043 exists exactly once and orders after 0042',()=>{
 // Historical phase guarantee only: this contract owns migration 0043's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add migration 0044 and beyond, and nothing
 // here (or in any Relationship Trust verifier) asserts that a later
 // migration can never exist.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0043_hrs_relationship_trust_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0043')).length,1,'exactly one migration 0043');
 assert.ok(migrations.indexOf('0043_hrs_relationship_trust_measurement_model_v1.sql')>migrations.indexOf('0042_hbs_reflection_measurement_model_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0043.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0044/,'the historical 0043 verifier asserts no migration-0044 ceiling');
 assert.doesNotMatch(verifier,/<>10|!==10(?!\d)|<>7(?!\d)|!==7(?!\d)/,'the historical 0043 verifier freezes no global calibrated/uncalibrated count');
});
test('freezes the exact metric, model, instrument, and scale identities',()=>{
 assert.match(sql,/hrs\.relationship-trust\.direct-structured-current-reliance/);
 assert.match(sql,/hrs\.relationship-trust\.direct-relationship-bound-reliance-report/);
 assert.match(sql,/'hrs\.relationship-trust\.reliance-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT/);
 assert.match(sql,/FIRST_CLASS_RELATIONSHIP_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.match(sql,/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/);
 assert.match(sql,/qandeel\.him\.relationship-trust\.foundation-approval/);
});
test('binds the exact reliance vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/"VERY_LOW":1,"LOW":2,"MODERATE":3,"HIGH":4,"VERY_HIGH":5/);
 assert.match(sql,/metric_key='hrs\.relationship-trust' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, and Reflection vocabularies stay bound to their
 // exact metric families - never widened, never merged into a shared list.
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.reflection' AND response_code=ANY\(ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]\)/);
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,1,'all three special codes and NOT_SURE map to NULL, never zero and never a midpoint');
 // No thresholds, bands, averages, or clinical cutoffs exist; the only
 // permitted "clinical" token is the approval's explicit
 // SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM basis entry.
 assert.match(sql,/SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/);
 assert.match(sql,/external_validation_claimed/);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HRS_RELATIONSHIP_TRUST_CANONICAL_APPROVAL'/);
 assert.doesNotMatch(executable,/THEN 0|healthy|unhealthy|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]/i);
});
test('is RELATIONSHIP-bound only with a minimal owned target substrate and fail-closed authority',()=>{
 assert.match(sql,/'hrs\.relationship-trust',1,'RELATIONSHIP',1,'ACTIVE'/);
 for(const context of['GLOBAL','GOAL','SITUATION','CONVERSATION_SESSION','DECISION'])assert.doesNotMatch(sql,new RegExp(`'hrs\\.relationship-trust',1,'${context}',1,'ACTIVE'`),`hrs.relationship-trust/${context} must remain unsupported`);
 // The relationship target is a private owned HIM measurement artifact: the
 // narrow create RPC accepts only a bounded trimmed label and the server
 // derives owner, RELATIONSHIP kind, and canonical provenance. No social
 // graph, contact, person, or account-linking surface exists.
 assert.match(sql,/create_him_relationship_measurement_target_v1/);
 assert.match(sql,/'RELATIONSHIP',p_display_text,'QANDEEL_HIM_MEASUREMENT_TARGET_V1'/);
 assert.match(sql,/Invalid RELATIONSHIP measurement target/);
 assert.match(sql,/Unknown, cross-user, or unsupported Relationship Trust RELATIONSHIP target/);
 assert.match(sql,/context_kind=ANY\(ARRAY\['GOAL','SITUATION','RELATIONSHIP'\]\)/);
 assert.doesNotMatch(executable,/contact|address_book|person_record|linked_user|partner_account|other_user|counterpart/i,'no contact/person/social-graph model exists');
 // Existing GOAL/SITUATION target behavior stays unchanged: 0043 never
 // rewrites the historical Motivation-named target RPC and never fabricates
 // a measurement target of any kind.
 assert.doesNotMatch(executable,/create_him_motivation_measurement_target/,'the historical Motivation target RPC is not broadened or rewritten');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets\(id,user_id,context_kind,display_text,canonical_provenance\) VALUES\(gen_random_uuid\(\),u,'(?:GOAL|SITUATION)'/,'0043 never creates GOAL/SITUATION targets');
});
test('keeps the semantic mapping unresolved with a NULL semantic type',()=>{
 assert.match(sql,/'UNRESOLVED',NULL/);
 assert.match(sql,/metric_key='hrs\.relationship-trust' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HRS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 // The RELATIONSHIP context kind never becomes a semantic type, and no
 // TRUST/STATE/TRAIT/READINESS/CAPABILITY mapping is made.
 assert.doesNotMatch(executable,/semantic_type='RELATIONSHIP'|semantic_type='TRUST'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'/);
});
test('is a direct structured at-report appraisal with a NULL temporal window - not the seven-day period model',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The Relationship Trust create path inserts a bare event (the durable
 // 0040 window pair stays NULL), the calculation refuses any non-NULL
 // window, and the snapshot insert names no temporal_window columns at all.
 assert.match(sql,/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/);
 assert.match(sql,/e\.observation_window_start IS NOT NULL OR e\.observation_window_end IS NOT NULL/);
 assert.match(sql,/Relationship Trust observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the Relationship Trust snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('keeps Relationship Trust fully independent of every HRS sibling with no safety or recommendation verdict',()=>{
 // The dedicated functions never read a sibling's rows: every observation
 // lookup inside a Relationship Trust function filters
 // hrs.relationship-trust, and no inverse, composite, or sibling-derived
 // value exists. The approval's
 // TRUST_NOT_EMOTIONAL_SAFETY_COMMUNICATION_REPAIR_OR_OBJECTIVE_TRUSTWORTHINESS
 // basis token is the only permitted mention of the sibling concepts in
 // executable SQL, and no executable path scores Communication, Repair, or
 // Emotional Safety.
 assert.match(sql,/TRUST_NOT_EMOTIONAL_SAFETY_COMMUNICATION_REPAIR_OR_OBJECTIVE_TRUSTWORTHINESS/);
 // The union'd shared contracts legitimately restate the historical HSE/HBS
 // branches; the four dedicated Relationship Trust authority functions
 // themselves never name a sibling metric in any direction.
 const authority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_him_relationship_measurement_target_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(authority.includes('calculate_hrs_relationship_trust_measurement_v1'),'the authority slice covers all four dedicated functions');
 assert.doesNotMatch(authority,/hrs\.communication|hrs\.repair|hrs\.emotional-safety|hbs\.|hgs\.|hse\./,'no sibling HRS, HBS, HGS, or HSE metric is ever scored or read by the Relationship Trust authority');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|relationship_score|trust_score|hrs_score/i);
 assert.equal((executable.match(/EMOTIONAL_SAFETY|COMMUNICATION_REPAIR/g)??[]).length,2,'sibling concepts appear only inside the single approval basis token');
 // This metric never by itself produces or implies a safety verdict, an
 // abuse assessment, a stay/leave recommendation, or a lie/betrayal
 // prediction - no such vocabulary exists in executable SQL.
 assert.doesNotMatch(executable,/\bunsafe\b|\babus\w*|\bbetray\w*|\blying\b|\bshould_stay\b|\bshould_leave\b|recommend/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hrs\.(?:communication|repair|emotional-safety)/s,'0043 never rewrites a sibling definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update');
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry|sentiment/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Relationship Trust or any HRS metric.
 assert.doesNotMatch(trend,/hrs\./);
 assert.doesNotMatch(snapshot,/hrs\./);
});
test('activates the one-time ten/seven phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hrs\.relationship-trust\.reliance-5\.v1',required_input_contract='DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1' WHERE metric_key='hrs\.relationship-trust' AND definition_version=1/);
 // The 10/7 counts are a migration-time transition invariant inside 0043
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later HIM Expansion phases can calibrate further metrics.
 assert.match(sql,/CALIBRATED'\)<>10/);
 assert.match(sql,/UNCALIBRATED'\)<>7/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 assert.match(sql,/'hrs\.communication','hrs\.repair','hrs\.emotional-safety','hgs\.self-awareness','hgs\.resilience','hgs\.purpose-alignment','hgs\.habit-strength'/);
});
