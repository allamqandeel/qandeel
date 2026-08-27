import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0047_hgs_resilience_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');
const selfAwareness=readFileSync(new URL('../migrations/0046_hgs_self_awareness_measurement_model_v1.sql',import.meta.url),'utf8');

test('0047 exists exactly once and orders after 0046',()=>{
 // Historical phase guarantee only: this contract owns migration 0047's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add migration 0048 and beyond, and nothing
 // here (or in any Resilience verifier) asserts that a later migration can
 // never exist, that 0047 is the last migration, or that the global
 // calibrated/uncalibrated count or the exact remaining-HGS uncalibrated
 // list stays frozen forever.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0047_hgs_resilience_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0047')).length,1,'exactly one migration 0047');
 assert.ok(migrations.indexOf('0047_hgs_resilience_measurement_model_v1.sql')>migrations.indexOf('0046_hgs_self_awareness_measurement_model_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0047.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0048/,'the historical 0047 verifier asserts no migration-0048 ceiling');
 assert.doesNotMatch(verifier,/<>15(?!\d)|!==15(?!\d)|<>2(?!\d)/,'the historical 0047 verifier freezes no global calibrated/uncalibrated count');
 // The remaining two HGS metrics are uncalibrated AT THIS HISTORICAL PHASE
 // only: the verifier must never permanently require Purpose Alignment or
 // Habit Strength to remain uncalibrated (later HIM Expansion tasks
 // calibrate them), and it never asserts a "%resilience%"
 // function-universe ceiling.
 assert.doesNotMatch(verifier,/must (?:remain|stay) uncalibrated|UNCALIBRATED'\)\.rows\[0\]/i,'the historical 0047 verifier freezes no permanent uncalibrated requirement on the remaining HGS metrics');
 assert.doesNotMatch(verifier,/I?LIKE\s+'%[^']*resilience[^']*%'/i,'the historical 0047 verifier asserts no Resilience function-universe ceiling');
 // Frozen historical-verifier policy (the mandatory future-sibling
 // regression guard): verifier 0047 proves only its own durable Resilience
 // guarantees against the fully migrated latest schema. It must never
 // assert that future sibling HGS measurement authority functions are
 // ABSENT from the live database - the next legitimate HGS calibration
 // creates them - so to_regprocedure (or any other) absence checks against
 // Purpose Alignment, Habit Strength, later Resilience v2/helper, or later
 // HGS Runtime Consumption authority can never be reintroduced. Whether
 // 0047 itself introduced sibling authority is proven statically below
 // against the frozen migration text only.
 assert.doesNotMatch(verifier,/to_regprocedure/i,'the historical 0047 verifier proves no live-schema function absence of any kind');
 assert.doesNotMatch(verifier,/(?:create|correct|calculate)_hgs_(?:purpose_alignment|habit_strength)_measurement/i,'the historical 0047 verifier never names a future sibling HGS authority function');
 assert.doesNotMatch(verifier,/hgs_resilience_measurement_v2|resilience_helper/i,'the historical 0047 verifier never names a future Resilience v2 or helper function as required-to-be-absent');
 for(const fn of['create_hgs_resilience_measurement_v1','correct_hgs_resilience_measurement_v1','calculate_hgs_resilience_measurement_v1'])assert.match(verifier,new RegExp(`'?${fn}'?`),`the verifier names ${fn} exactly`);
});
test('freezes the exact metric, model, instrument, and scale identities',()=>{
 assert.match(sql,/hgs\.resilience\.direct-structured-current-adaptive-recovery/);
 assert.match(sql,/hgs\.resilience\.direct-target-bound-adaptive-recovery-report/);
 assert.match(sql,/'hgs\.resilience\.adaptive-recovery-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT/);
 assert.match(sql,/qandeel\.him\.resilience\.foundation-approval/);
 // The activated canonical target-bound evidence contract is reused
 // exactly - never renamed and never replaced by a parallel substrate.
 assert.match(sql,/FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.equal((sql.match(/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/g)??[]).length,1,'exactly one calibrated production model - never shared with a sibling');
 // The two ACTIVE bindings wire exclusively the Resilience model,
 // instrument, scale, and approval: no artifact is shared with
 // Self-Awareness, Stress, Motivation, Self-Confidence, Consistency, or
 // Repair even though the numeric shape is 1-5.
 assert.match(sql,/'hgs\.resilience',1,'GOAL',1,'ACTIVE','hgs\.resilience\.direct-structured-current-adaptive-recovery',1,'hgs\.resilience\.direct-target-bound-adaptive-recovery-report',1,'hgs\.resilience\.adaptive-recovery-5\.v1',1,'qandeel\.him\.resilience\.foundation-approval'/);
 assert.match(sql,/'hgs\.resilience',1,'SITUATION',1,'ACTIVE','hgs\.resilience\.direct-structured-current-adaptive-recovery',1,'hgs\.resilience\.direct-target-bound-adaptive-recovery-report',1,'hgs\.resilience\.adaptive-recovery-5\.v1',1,'qandeel\.him\.resilience\.foundation-approval'/);
 assert.equal((sql.match(/external_validation_claimed/g)??[]).length,1);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HGS_RESILIENCE_CANONICAL_APPROVAL'/);
});
test('binds the exact response vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/metric_key='hgs\.resilience' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, Reflection, Trust, Communication, Repair,
 // Emotional Safety, and Self-Awareness vocabularies stay bound to their
 // exact metric families - never widened, never merged into a shared list,
 // and the union is rebuilt from the canonical 0046 definition (the 0014
 // DECISION kind and every prior branch survive).
 assert.match(sql,/metric_key=ANY\(ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress'\]\) AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.avoidance' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.consistency' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','INSUFFICIENT_REPEATED_OPPORTUNITIES','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.initiative' AND response_code=ANY\(ARRAY\['NEVER','RARELY','SOMETIMES','OFTEN','ALMOST_ALWAYS','NO_CLEAR_SELF_OWNED_OPPORTUNITY','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hbs\.reflection' AND response_code=ANY\(ARRAY\['NOT_AT_ALL','A_LITTLE','SOMEWHAT','QUITE_A_BIT','A_GREAT_DEAL','NO_MEANINGFUL_OPPORTUNITY_TO_REFLECT','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.relationship-trust' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_CONTEXT_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.communication' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_TOPIC_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.repair' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_REPAIR_OPPORTUNITY','TOO_EPISODE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hrs\.emotional-safety' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VULNERABILITY_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hgs\.self-awareness' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_FACET_DEPENDENT_TO_RATE','INSUFFICIENT_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/ARRAY\['SITUATION','DECISION'\]/,'the 0014 DECISION observation branches survive the rebuilt union');
 assert.match(sql,/'SITUATION','CONVERSATION_SESSION','DECISION'/,'the Attention DECISION binding branch survives the rebuilt union');
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,1,'the special codes and NOT_SURE map to NULL - never zero, never a midpoint, never a substituted value');
 // No zero substitution, challenge-type averaging or resilience
 // subdomains, recovery-time scores, thresholds, health bands, clinical or
 // trauma cutoffs, trait labels, rankings, or automatic growth percentages
 // exist; the only permitted "clinical" token is the approval's explicit
 // SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM basis entry,
 // and the only permitted "grit"/"goal success"/"repair" mention in a
 // basis token is the approval's explicit independence entry.
 assert.equal((sql.match(/SECURITY_BINDING_NO_EXTERNAL_OR_CLINICAL_VALIDATION_CLAIM/g)??[]).length,1);
 assert.equal((sql.match(/RESILIENCE_NOT_LOW_STRESS_MOTIVATION_CONFIDENCE_CONSISTENCY_GRIT_GOAL_SUCCESS_OR_REPAIR/g)??[]).length,1);
 assert.doesNotMatch(executable,/THEN 0|subscale|subdomain|recovery_time|time_to_recovery|bounce|trauma|CLINICAL(?!_VALIDATION_CLAIM)|diagnos|threshold|health_band|average|percentage|normali[sz]|ranking|growth_percent|(?<!CONSISTENCY_)GRIT|trait_score|resilience_trait/i);
});
test('is GOAL/SITUATION-bound only and reuses the exact owned target substrate',()=>{
 for(const context of['GLOBAL','CONVERSATION_SESSION','DECISION','RELATIONSHIP'])assert.doesNotMatch(sql,new RegExp(`'hgs\\.resilience',1,'${context}',1,'ACTIVE'`),`hgs.resilience/${context} must remain unsupported`);
 // The metric reuses the existing owned GOAL/SITUATION target substrate:
 // the dedicated functions look up an existing owned target, and 0047
 // never creates a table, a target-creation RPC, a target row, or any
 // HGS-specific target model, and never touches the target/event
 // context-kind unions (GOAL and SITUATION are already valid there).
 assert.match(sql,/Unknown, cross-user, or unsupported Resilience GOAL\/SITUATION target/);
 assert.match(executable,/context_kind=ANY\(ARRAY\['GOAL','SITUATION'\]\)/);
 assert.doesNotMatch(executable,/CREATE TABLE/i,'0047 creates no table of any kind');
 assert.doesNotMatch(executable,/create_him_relationship_measurement_target_v1|create_him_motivation_measurement_target|create_him_attention_measurement_context|create_him_self_confidence_measurement_context/,'no target-creation RPC is added, rewritten, or broadened');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0047 never fabricates a measurement target');
 assert.doesNotMatch(executable,/him_measurement_targets_context_kind_check|him_measurement_event_context_kind_check/,'the target and event context-kind unions are untouched');
});
test('keeps the semantic mapping unresolved with a NULL semantic type and no invented HGS semantic type',()=>{
 assert.equal((sql.match(/'UNRESOLVED',NULL/g)??[]).length,1,'the snapshot preserves UNRESOLVED with a NULL semantic type');
 assert.match(sql,/metric_key='hgs\.resilience' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 // Neither RESILIENCE nor GROWTH becomes a semantic type, and no forced
 // CAPABILITY/TRAIT/STATE/PROGRESS/READINESS (or LOAD) mapping is made
 // merely because the construct sounds like toughness or an ability.
 assert.doesNotMatch(executable,/semantic_type='RESILIENCE'|semantic_type='GROWTH'|semantic_type='CAPABILITY'|semantic_type='TRAIT'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'|'RESOLVED','LOAD'|'RESOLVED','PROGRESS'/);
});
test('is a direct structured at-report appraisal grounded in actual challenge with a NULL temporal window - not a recovery period and not a growth trajectory',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The create path inserts a bare event (the durable 0040 window pair stays
 // NULL), the calculation refuses any non-NULL window, and the snapshot
 // insert names no temporal_window columns at all - the current appraisal
 // may refer to challenge experienced in the target, but the metric never
 // encodes a retrospective period, a 30-day recovery window, or a
 // time-to-recovery measure.
 assert.equal((sql.match(/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/g)??[]).length,1);
 assert.match(sql,/Resilience observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'hgs\.resilience\.observation:'/);
 assert.match(sql,/him_energy_calculation_supersessions/);
 // The structured appraisal is supplied by the user: no LLM, Memory,
 // Evidence, or conversation analysis ever infers that adversity
 // occurred, and no adversity-detection artifact exists.
 assert.doesNotMatch(executable,/adversity_detect|challenge_detect|infer/i);
});
test('keeps Resilience fully independent of Stress and every sibling with no composite, derivation, or trait claim',()=>{
 // The dedicated authority functions never read a sibling's rows: every
 // observation lookup filters hgs.resilience, and no inverse, composite,
 // or sibling-derived value exists. The approval's independence basis
 // token is the only permitted mention of the sibling concepts in
 // executable SQL.
 assert.match(sql,/RESILIENCE_NOT_LOW_STRESS_MOTIVATION_CONFIDENCE_CONSISTENCY_GRIT_GOAL_SUCCESS_OR_REPAIR/);
 assert.match(sql,/NO_ADVERSITY_TOO_EARLY_AND_CHALLENGE_DEPENDENCE_FAIL_TO_UNASSESSED/);
 assert.match(sql,/ACTUAL_CHALLENGE_BASIS_CURRENT_APPRAISAL_NULL_WINDOW/);
 // 0047 itself introduces no sibling HGS authority: proven statically
 // against the frozen migration text only - never against the live
 // function universe, which later HGS calibrations legitimately extend.
 assert.doesNotMatch(executable,/(?:create|correct|calculate)_hgs_(?!resilience_measurement_v1)/,'0047 introduces only the three Resilience authority functions');
 const authority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hgs_resilience_measurement_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(authority.includes('calculate_hgs_resilience_measurement_v1'),'the Resilience authority slice covers its three dedicated functions');
 assert.doesNotMatch(authority,/hgs\.self-awareness|hgs\.purpose-alignment|hgs\.habit-strength|hbs\.|hrs\.|hse\./,'no sibling HGS, HBS, HRS, or HSE metric is ever scored or read by the Resilience authority');
 // The static evidence-refs ledger columns are the calculation result's
 // own provenance shape; what is forbidden is reading a conversation
 // surface, Memory, Hypothesis, or canonical Evidence store.
 assert.doesNotMatch(authority,/conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items/i,'the Resilience authority reads no conversation surface, Memory, or Evidence store');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|resilience_score|stress_score|inverse_stress|grit_score|persistence_score|repair_score/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hgs\.(?:self-awareness|purpose-alignment|habit-strength)|UPDATE public\.him_metric_definitions[^;]*hbs\.|UPDATE public\.him_metric_definitions[^;]*hrs\.|UPDATE public\.him_metric_definitions[^;]*hse\./s,'0047 never rewrites a sibling HGS, HBS, HRS, or HSE definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update - the activated metric only');
 // The boundary survives in the other direction too: the historical 0046
 // Self-Awareness authority functions remain untouched and never read
 // Resilience.
 const siblingExecutable=selfAwareness.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 const siblingAuthority=siblingExecutable.slice(siblingExecutable.indexOf('CREATE FUNCTION public.create_hgs_self_awareness_measurement_v1'),siblingExecutable.indexOf('CREATE OR REPLACE VIEW'));
 assert.doesNotMatch(siblingAuthority,/hgs\.resilience/,'the frozen 0046 Self-Awareness authority never reads Resilience');
});
test('adds no Trend v1, Intelligence Snapshot v1, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry|sentiment/i);
 // The frozen Trend v1 and Snapshot v1 migrations stay five-HSE only and
 // never mention Resilience or any HGS metric.
 assert.doesNotMatch(trend,/hgs\./);
 assert.doesNotMatch(snapshot,/hgs\./);
});
test('activates the one-time fifteen/two phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hgs\.resilience\.adaptive-recovery-5\.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1' WHERE metric_key='hgs\.resilience' AND definition_version=1/);
 // The 15/2 counts are a migration-time transition invariant inside 0047
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later HIM Expansion phases can calibrate Purpose Alignment
 // and Habit Strength.
 assert.match(sql,/CALIBRATED'\)<>15/);
 assert.match(sql,/UNCALIBRATED'\)<>2/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 // The current structured view carries exactly the fifteen calibrated
 // routes - every HSE/HBS/HRS route and the Self-Awareness route survive,
 // and no other HGS metric is routed.
 assert.match(sql,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair','hrs\.emotional-safety','hgs\.self-awareness','hgs\.resilience'\]\)/);
 const view=executable.slice(executable.indexOf('CREATE OR REPLACE VIEW'),executable.indexOf('REVOKE ALL ON FUNCTION'));
 assert.doesNotMatch(view,/hgs\.purpose-alignment|hgs\.habit-strength/,'no other HGS metric enters the current structured view');
});
