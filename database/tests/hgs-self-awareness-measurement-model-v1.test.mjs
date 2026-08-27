import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0046_hgs_self_awareness_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');
const reflection=readFileSync(new URL('../migrations/0042_hbs_reflection_measurement_model_v1.sql',import.meta.url),'utf8');

test('0046 exists exactly once and orders after 0045',()=>{
 // Historical phase guarantee only: this contract owns migration 0046's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add migration 0047 and beyond, and nothing
 // here (or in any Self-Awareness verifier) asserts that a later migration
 // can never exist, that 0046 is the last migration, or that the global
 // calibrated/uncalibrated count or the exact remaining-HGS uncalibrated
 // list stays frozen forever.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0046_hgs_self_awareness_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0046')).length,1,'exactly one migration 0046');
 assert.ok(migrations.indexOf('0046_hgs_self_awareness_measurement_model_v1.sql')>migrations.indexOf('0045_hrs_emotional_safety_measurement_model_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0046.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0047/,'the historical 0046 verifier asserts no migration-0047 ceiling');
 assert.doesNotMatch(verifier,/<>14(?!\d)|!==14(?!\d)|<>3(?!\d)/,'the historical 0046 verifier freezes no global calibrated/uncalibrated count');
 // The remaining three HGS metrics are uncalibrated AT THIS HISTORICAL
 // PHASE only: the verifier must never permanently require Resilience,
 // Purpose Alignment, or Habit Strength to remain uncalibrated (later HIM
 // Expansion tasks calibrate them), and it never asserts an
 // "%self_awareness%" function-universe ceiling.
 assert.doesNotMatch(verifier,/must (?:remain|stay) uncalibrated|UNCALIBRATED'\)\.rows\[0\]/i,'the historical 0046 verifier freezes no permanent uncalibrated requirement on the remaining HGS metrics');
 assert.doesNotMatch(verifier,/I?LIKE\s+'%[^']*self_awareness[^']*%'/i,'the historical 0046 verifier asserts no Self-Awareness function-universe ceiling');
 for(const fn of['create_hgs_self_awareness_measurement_v1','correct_hgs_self_awareness_measurement_v1','calculate_hgs_self_awareness_measurement_v1'])assert.match(verifier,new RegExp(`'?${fn}'?`),`the verifier names ${fn} exactly`);
});
test('freezes the exact metric, model, instrument, and scale identities',()=>{
 assert.match(sql,/hgs\.self-awareness\.direct-structured-current-self-understanding-clarity/);
 assert.match(sql,/hgs\.self-awareness\.direct-target-bound-self-understanding-clarity-report/);
 assert.match(sql,/'hgs\.self-awareness\.clarity-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT/);
 assert.match(sql,/qandeel\.him\.self-awareness\.foundation-approval/);
 // The activated canonical target-bound evidence contract is reused
 // exactly - never renamed and never replaced by a parallel substrate.
 assert.match(sql,/FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.equal((sql.match(/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/g)??[]).length,1,'exactly one calibrated production model - never shared with a sibling');
 // The two ACTIVE bindings wire exclusively the Self-Awareness model,
 // instrument, scale, and approval: no artifact is shared with Reflection,
 // Motivation, or Self-Confidence even though the numeric shape is 1-5.
 assert.match(sql,/'hgs\.self-awareness',1,'GOAL',1,'ACTIVE','hgs\.self-awareness\.direct-structured-current-self-understanding-clarity',1,'hgs\.self-awareness\.direct-target-bound-self-understanding-clarity-report',1,'hgs\.self-awareness\.clarity-5\.v1',1,'qandeel\.him\.self-awareness\.foundation-approval'/);
 assert.match(sql,/'hgs\.self-awareness',1,'SITUATION',1,'ACTIVE','hgs\.self-awareness\.direct-structured-current-self-understanding-clarity',1,'hgs\.self-awareness\.direct-target-bound-self-understanding-clarity-report',1,'hgs\.self-awareness\.clarity-5\.v1',1,'qandeel\.him\.self-awareness\.foundation-approval'/);
 assert.equal((sql.match(/external_validation_claimed/g)??[]).length,1);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HGS_SELF_AWARENESS_CANONICAL_APPROVAL'/);
});
test('binds the exact response vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/metric_key='hgs\.self-awareness' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, Reflection, Trust, Communication, Repair, and
 // Emotional Safety vocabularies stay bound to their exact metric families
 // - never widened, never merged into a shared list, and the union is
 // rebuilt from the canonical 0045 definition (the 0014 DECISION kind and
 // every prior branch survive).
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.reflection' AND response_code=ANY\(ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.relationship-trust' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.communication' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.repair' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.emotional-safety' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VULNERABILITY_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/ARRAY\['SITUATION','DECISION'\]/,'the 0014 DECISION observation branches survive the rebuilt union');
 assert.match(sql,/'SITUATION','CONVERSATION_SESSION','DECISION'/,'the Attention DECISION binding branch survives the rebuilt union');
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,1,'the special codes and NOT_SURE map to NULL - never zero, never a midpoint, never a substituted value');
 // No zero substitution, facet averaging or subscales, thresholds, health
 // bands, accuracy percentages, clinical cutoffs, rankings, or automatic
 // growth percentages exist; the only permitted "clinical" token is the
 // approval's explicit
 // SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM basis entry,
 // and the only permitted "accuracy" token is the approval's explicit
 // OBJECTIVE_INSIGHT_ACCURACY independence basis entry.
 assert.equal((sql.match(/SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/g)??[]).length,1);
 assert.equal((sql.match(/OBJECTIVE_INSIGHT_ACCURACY/g)??[]).length,1);
 assert.doesNotMatch(executable,/THEN 0|subscale|facet_score|clinical(?!_VALIDATION_CLAIM)|diagnos|threshold|band|average|percentage|normali[sz]|ranking|growth_percent|(?<!INSIGHT_)accuracy/i);
});
test('is GOAL/SITUATION-bound only and reuses the exact owned target substrate',()=>{
 for(const context of['GLOBAL','CONVERSATION_SESSION','DECISION','RELATIONSHIP'])assert.doesNotMatch(sql,new RegExp(`'hgs\\.self-awareness',1,'${context}',1,'ACTIVE'`),`hgs.self-awareness/${context} must remain unsupported`);
 // The metric reuses the existing owned GOAL/SITUATION target substrate:
 // the dedicated functions look up an existing owned target, and 0046
 // never creates a table, a target-creation RPC, a target row, or any
 // HGS-specific target model, and never touches the target/event
 // context-kind unions (GOAL and SITUATION are already valid there).
 assert.match(sql,/Unknown, cross-user, or unsupported Self-Awareness GOAL\/SITUATION target/);
 assert.match(executable,/context_kind=ANY\(ARRAY\['GOAL','SITUATION'\]\)/);
 assert.doesNotMatch(executable,/CREATE TABLE/i,'0046 creates no table of any kind');
 assert.doesNotMatch(executable,/create_him_relationship_measurement_target_v1|create_him_motivation_measurement_target|create_him_attention_measurement_context|create_him_self_confidence_measurement_context/,'no target-creation RPC is added, rewritten, or broadened');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0046 never fabricates a measurement target');
 assert.doesNotMatch(executable,/him_measurement_targets_context_kind_check|him_measurement_event_context_kind_check/,'the target and event context-kind unions are untouched');
});
test('keeps the semantic mapping unresolved with a NULL semantic type and no invented HGS semantic type',()=>{
 assert.equal((sql.match(/'UNRESOLVED',NULL/g)??[]).length,1,'the snapshot preserves UNRESOLVED with a NULL semantic type');
 assert.match(sql,/metric_key='hgs\.self-awareness' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 // Neither SELF_AWARENESS nor GROWTH becomes a semantic type, and no
 // forced CAPABILITY (or STATE/TRAIT/READINESS/LOAD/PROGRESS) mapping is
 // made merely because the construct sounds like an ability.
 assert.doesNotMatch(executable,/semantic_type='SELF_AWARENESS'|semantic_type='GROWTH'|semantic_type='CAPABILITY'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'|'RESOLVED','LOAD'|'RESOLVED','PROGRESS'/);
});
test('is a direct structured at-report appraisal with a NULL temporal window - not the seven-day period model and not a growth trajectory',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The create path inserts a bare event (the durable 0040 window pair stays
 // NULL), the calculation refuses any non-NULL window, and the snapshot
 // insert names no temporal_window columns at all.
 assert.equal((sql.match(/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/g)??[]).length,1);
 assert.match(sql,/Self-Awareness observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'hgs\.self-awareness\.observation:'/);
 assert.match(sql,/him_energy_calculation_supersessions/);
});
test('keeps Self-Awareness fully independent of Reflection and every sibling with no composite, derivation, or accuracy claim',()=>{
 // The dedicated authority functions never read a sibling's rows: every
 // observation lookup filters hgs.self-awareness, and no inverse,
 // composite, or sibling-derived value exists. The approval's independence
 // basis token is the only permitted mention of the sibling concepts in
 // executable SQL.
 assert.match(sql,/SELF_AWARENESS_NOT_REFLECTION_RUMINATION_SELF_CONFIDENCE_OR_OBJECTIVE_INSIGHT_ACCURACY/);
 assert.match(sql,/FACET_DEPENDENCE_AND_INSUFFICIENT_BASIS_FAIL_TO_UNASSESSED/);
 const authority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hgs_self_awareness_measurement_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(authority.includes('calculate_hgs_self_awareness_measurement_v1'),'the Self-Awareness authority slice covers its three dedicated functions');
 assert.doesNotMatch(authority,/hbs\.reflection|hbs\.avoidance|hbs\.consistency|hbs\.initiative|hgs\.resilience|hgs\.purpose-alignment|hgs\.habit-strength|hrs\.|hse\./,'no sibling HBS, HGS, HRS, or HSE metric is ever scored or read by the Self-Awareness authority');
 // The static evidence-refs ledger columns are the calculation result's
 // own provenance shape; what is forbidden is reading a Reflection
 // session surface, Memory, Hypothesis, or canonical Evidence store.
 assert.doesNotMatch(authority,/conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items/i,'the Self-Awareness authority reads no Reflection session surface, Memory, Evidence, or conversation text');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|self_awareness_score|growth_score|reflection_score|insight_accuracy_score/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hgs\.(?:resilience|purpose-alignment|habit-strength)|UPDATE public\.him_metric_definitions[^;]*hbs\.|UPDATE public\.him_metric_definitions[^;]*hrs\.|UPDATE public\.him_metric_definitions[^;]*hse\./s,'0046 never rewrites a sibling, HBS, HRS, or HSE definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update - the activated metric only');
 // The Reflection boundary survives in the other direction too: the
 // historical 0042 Reflection authority remains untouched and never reads
 // Self-Awareness.
 assert.doesNotMatch(reflection.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n'),/self.awareness|hgs\./i);
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry|sentiment/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Self-Awareness or any HGS metric.
 assert.doesNotMatch(trend,/hgs\./);
 assert.doesNotMatch(snapshot,/hgs\./);
});
test('activates the one-time fourteen/three phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hgs\.self-awareness\.clarity-5\.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1' WHERE metric_key='hgs\.self-awareness' AND definition_version=1/);
 // The 14/3 counts are a migration-time transition invariant inside 0046
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later HIM Expansion phases can calibrate Resilience,
 // Purpose Alignment, and Habit Strength.
 assert.match(sql,/CALIBRATED'\)<>14/);
 assert.match(sql,/UNCALIBRATED'\)<>3/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 // The current structured view carries exactly the fourteen calibrated
 // routes - every HSE/HBS/HRS route survives, and no other HGS metric is
 // routed.
 assert.match(sql,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair','hrs\.emotional-safety','hgs\.self-awareness'\]\)/);
 const view=executable.slice(executable.indexOf('CREATE OR REPLACE VIEW'),executable.indexOf('REVOKE ALL ON FUNCTION'));
 assert.doesNotMatch(view,/hgs\.resilience|hgs\.purpose-alignment|hgs\.habit-strength/,'no other HGS metric enters the current structured view');
});
