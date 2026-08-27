import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0042_hbs_reflection_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');

test('0042 exists exactly once and orders after 0041',()=>{
 // Historical phase guarantee only: this contract owns migration 0042's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add 0043 and beyond, and nothing here (or
 // in any Reflection verifier) asserts that 0043 can never exist.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0042_hbs_reflection_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0042')).length,1,'exactly one migration 0042');
 assert.ok(migrations.indexOf('0042_hbs_reflection_measurement_model_v1.sql')>migrations.indexOf('0041_hbs_consistency_initiative_measurement_models_v1.sql'));
});
test('freezes the exact model, instrument, and scale identities',()=>{
 assert.match(sql,/hbs\.reflection\.direct-structured-context-bound-reflective-engagement/);
 assert.match(sql,/hbs\.reflection\.direct-context-bound-reflective-engagement-report/);
 assert.match(sql,/'hbs\.reflection\.engagement-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_CONTEXT_BOUND_REFLECTIVE_ENGAGEMENT_REPORT/);
 assert.match(sql,/FIRST_CLASS_AUTHORIZED_CONTEXT_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.match(sql,/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/);
 assert.match(sql,/qandeel\.him\.reflection\.foundation-approval/);
});
test('binds the exact engagement vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/"NOT_AT_ALL":1,"A_LITTLE":2,"SOMEWHAT":3,"QUITE_A_BIT":4,"A_GREAT_DEAL":5/);
 assert.match(sql,/ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]/);
 // The HSE and seven-day HBS vocabularies stay bound to their exact metric
 // families - never widened, never merged into a shared code list.
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.reflection' AND response_code=ANY\(ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]\)/);
 assert.equal((sql.match(/WHEN 'NOT_AT_ALL' THEN 1 WHEN 'A_LITTLE' THEN 2 WHEN 'SOMEWHAT' THEN 3 WHEN 'QUITE_A_BIT' THEN 4 WHEN 'A_GREAT_DEAL' THEN 5 ELSE NULL END/g)??[]).length,1,'both special codes and NOT_SURE map to NULL, never zero');
 // No thresholds, bands, averages, or clinical cutoffs exist; the only
 // permitted "clinical" token is the approval's explicit
 // NO_FOUNDER_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM basis entry.
 assert.match(sql,/NO_FOUNDER_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/);
 assert.doesNotMatch(executable,/THEN 0|healthy|unhealthy|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]/i);
});
test('is SITUATION/CONVERSATION_SESSION context-bound only with fail-closed authority for both branches',()=>{
 assert.match(sql,/'hbs\.reflection',1,'SITUATION',1,'ACTIVE'/);
 assert.match(sql,/'hbs\.reflection',1,'CONVERSATION_SESSION',1,'ACTIVE'/);
 for(const context of['GLOBAL','GOAL','DECISION','RELATIONSHIP'])assert.doesNotMatch(sql,new RegExp(`'hbs\\.reflection',1,'${context}',1,'ACTIVE'`),`hbs.reflection/${context} must remain unsupported`);
 // SITUATION binds to exactly one owned existing measurement target with a
 // server-derived label; CONVERSATION_SESSION binds directly to an owned
 // real conversation session with mandatory NULL target fields - no fake
 // measurement target is ever created for a session.
 assert.match(sql,/Unknown, cross-user, or unsupported Reflection SITUATION target/);
 assert.match(sql,/Unknown or cross-user Reflection conversation session/);
 assert.match(sql,/Unsupported Reflection context/);
 assert.match(sql,/him_measurement_targets/);
 assert.match(sql,/conversation_sessions/);
 assert.match(sql,/context_kind='CONVERSATION_SESSION' AND instrument_id='hbs\.reflection\.direct-context-bound-reflective-engagement-report'[^)]*target_label IS NULL AND target_context_kind IS NULL AND target_context_id IS NULL/);
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0042 never fabricates a measurement target');
});
test('keeps the semantic mapping unresolved with a NULL semantic type',()=>{
 assert.match(sql,/'UNRESOLVED',NULL/);
 assert.match(sql,/metric_key='hbs\.reflection' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HBS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 assert.doesNotMatch(sql,/semantic_type='BEHAVIOR'|'BEHAVIOR'|'RESOLVED','STATE'.*hbs/s);
});
test('is a direct structured at-report assessment with a NULL temporal window - not the seven-day period model',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The Reflection create path inserts a bare event (the durable 0040 window
 // pair stays NULL), the calculation refuses any non-NULL window, and the
 // snapshot insert names no temporal_window columns at all.
 assert.match(sql,/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/);
 assert.match(sql,/e\.observation_window_start IS NOT NULL OR e\.observation_window_end IS NOT NULL/);
 assert.match(sql,/Reflection observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the Reflection snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('keeps Reflection fully independent of every sibling and of Self-awareness',()=>{
 // The dedicated functions never read a sibling's rows: every observation
 // lookup inside a Reflection function filters hbs.reflection, and no
 // inverse, composite, rumination, or Self-awareness surface exists. The
 // approval's REFLECTION_NOT_RUMINATION_OR_INSIGHT_OUTCOME basis token is
 // the only permitted mention of either concept in executable SQL.
 assert.match(sql,/REFLECTION_NOT_RUMINATION_OR_INSIGHT_OUTCOME/);
 const reflectionBody=sql.split('create_hbs_reflection_measurement_v1')[1]??'';
 assert.doesNotMatch(reflectionBody,/metric_key='hbs\.consistency'|metric_key='hbs\.initiative'|metric_key='hbs\.avoidance'|metric_key='hgs\./);
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|behavior_score|behaviour_score/i);
 assert.doesNotMatch(executable,/rumination(?!_OR_INSIGHT)/i);
 assert.doesNotMatch(executable,/insight(?!_OUTCOME)/i);
 assert.doesNotMatch(executable,/self.awareness|hgs\./i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hbs\.(?:avoidance|consistency|initiative)/s,'0042 never rewrites a sibling definition');
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Reflection.
 assert.doesNotMatch(trend,/hbs\.reflection/);
 assert.doesNotMatch(snapshot,/hbs\.reflection/);
});
test('activates the one-time nine/eight phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hbs\.reflection\.engagement-5\.v1',required_input_contract='DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_REFLECTIVE_ENGAGEMENT_REPORT_V1' WHERE metric_key='hbs\.reflection' AND definition_version=1/);
 // The 9/8 counts are a migration-time transition invariant inside 0042
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later HIM Expansion phases can calibrate further metrics.
 assert.match(sql,/CALIBRATED'\)<>9/);
 assert.match(sql,/UNCALIBRATED'\)<>8/);
 const verifier=readFileSync(new URL('../verify-migration-0042.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/<>9|!==9|<>8|!==8(?!\d)/,'the historical 0042 verifier freezes no global calibrated/uncalibrated count');
 assert.doesNotMatch(verifier,/0043/,'the historical 0042 verifier asserts no migration-0043 ceiling');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update');
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
});
