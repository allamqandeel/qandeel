import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0049_hgs_habit_strength_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');
const purposeAlignment=readFileSync(new URL('../migrations/0048_hgs_purpose_alignment_measurement_model_v1.sql',import.meta.url),'utf8');
const consistency=readFileSync(new URL('../migrations/0041_hbs_consistency_initiative_measurement_models_v1.sql',import.meta.url),'utf8');

test('0049 exists exactly once and orders after 0048',()=>{
 // Historical phase guarantee only: this contract owns migration 0049's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future tasks may add further migrations, and nothing here (or in any
 // Habit Strength verifier) asserts that a later migration can never
 // exist, that 0049 is the last migration, or that the global
 // calibrated/uncalibrated count stays frozen forever.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0049_hgs_habit_strength_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0049')).length,1,'exactly one migration 0049');
 assert.ok(migrations.indexOf('0049_hgs_habit_strength_measurement_model_v1.sql')>migrations.indexOf('0048_hgs_purpose_alignment_measurement_model_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0049.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0050/,'the historical 0049 verifier asserts no next-migration-number ceiling');
 // The 17/0 counts are a one-time migration-phase transition inside 0049
 // only: the historical verifier freezes neither the global calibrated
 // count at seventeen nor the global uncalibrated count at zero - later
 // definition versions and later migrations may legitimately change both.
 assert.doesNotMatch(verifier,/<>17(?!\d)|!==17(?!\d)|<>0(?!\d)/,'the historical 0049 verifier freezes no global calibrated/uncalibrated count');
 assert.doesNotMatch(verifier,/forever|can never exist|cannot exist/i,'the historical 0049 verifier states no permanent existence ceiling');
 assert.doesNotMatch(verifier,/I?LIKE\s+'%[^']*habit[^']*%'|I?LIKE\s+'%[^']*automaticity[^']*%'/i,'the historical 0049 verifier asserts no Habit Strength function-universe ceiling');
 // Frozen historical-verifier policy (the mandatory future-authority
 // regression guard): verifier 0049 proves only its own durable Habit
 // Strength guarantees against the fully migrated latest schema. It must
 // never assert that future authority functions are ABSENT from the live
 // database - a later legitimately reviewed Habit Strength version or
 // helper, or a later separately reviewed HGS/HIM Runtime Consumption
 // contract, creates new functions there - so to_regprocedure (or any
 // other) live-schema absence checks against future authority can never
 // be reintroduced. Whether 0049 itself introduced sibling authority is
 // proven statically below against the frozen migration text only.
 assert.doesNotMatch(verifier,/to_regprocedure/i,'the historical 0049 verifier proves no live-schema function absence of any kind');
 assert.doesNotMatch(verifier,/hgs_habit_strength_measurement_v2|habit_strength_helper|hgs_runtime_consumption|him_runtime_consumption_v2/i,'the historical 0049 verifier never names a future Habit Strength version/helper or HGS Runtime Consumption function as required-to-be-absent');
 for(const fn of['create_hgs_habit_strength_measurement_v1','correct_hgs_habit_strength_measurement_v1','calculate_hgs_habit_strength_measurement_v1'])assert.match(verifier,new RegExp(`'?${fn}'?`),`the verifier names ${fn} exactly`);
});
test('freezes the exact metric, model, instrument, and scale identities',()=>{
 assert.match(sql,/hgs\.habit-strength\.direct-structured-current-cue-linked-automaticity/);
 assert.match(sql,/hgs\.habit-strength\.direct-target-bound-cue-linked-automaticity-report/);
 assert.match(sql,/'hgs\.habit-strength\.automaticity-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT/);
 assert.match(sql,/qandeel\.him\.habit-strength\.foundation-approval/);
 // The activated canonical target-bound evidence contract is reused
 // exactly - never renamed and never replaced by a parallel substrate.
 assert.match(sql,/FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.equal((sql.match(/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/g)??[]).length,1,'exactly one calibrated production model - never shared with a sibling');
 // The two ACTIVE bindings wire exclusively the Habit Strength model,
 // instrument, scale, and approval: no artifact is shared with
 // Consistency, Initiative, Motivation, Self-Awareness, Resilience, or
 // Purpose Alignment even though the numeric shape is the same 1-5.
 assert.match(sql,/'hgs\.habit-strength',1,'GOAL',1,'ACTIVE','hgs\.habit-strength\.direct-structured-current-cue-linked-automaticity',1,'hgs\.habit-strength\.direct-target-bound-cue-linked-automaticity-report',1,'hgs\.habit-strength\.automaticity-5\.v1',1,'qandeel\.him\.habit-strength\.foundation-approval'/);
 assert.match(sql,/'hgs\.habit-strength',1,'SITUATION',1,'ACTIVE','hgs\.habit-strength\.direct-structured-current-cue-linked-automaticity',1,'hgs\.habit-strength\.direct-target-bound-cue-linked-automaticity-report',1,'hgs\.habit-strength\.automaticity-5\.v1',1,'qandeel\.him\.habit-strength\.foundation-approval'/);
 assert.equal((sql.match(/external_validation_claimed/g)??[]).length,1);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HGS_HABIT_STRENGTH_CANONICAL_APPROVAL'/);
});
test('binds the exact response vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/metric_key='hgs\.habit-strength' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','INSUFFICIENT_REPETITION_HISTORY_TO_JUDGE','NO_SINGLE_RECURRING_PATTERN_TO_RATE','TOO_CUE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, Reflection, Trust, Communication, Repair,
 // Emotional Safety, Self-Awareness, Resilience, and Purpose Alignment
 // vocabularies stay bound to their exact metric families - never
 // widened, never merged into a shared list, and the union is rebuilt
 // from the canonical 0048 definition (the 0014 DECISION kind and every
 // prior branch survive). In particular no Consistency frequency code is
 // ever reused as a Habit Strength response.
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
 assert.match(sql,/metric_key='hgs\.resilience' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','NO_MEANINGFUL_ADVERSITY_OR_CHALLENGE','TOO_EARLY_TO_JUDGE_ADAPTATION','TOO_CHALLENGE_DEPENDENT_TO_RATE','NOT_SURE'\]\)/);
 assert.match(sql,/metric_key='hgs\.purpose-alignment' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VALUE_CONFLICTED_TO_RATE','INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 assert.match(sql,/ARRAY\['SITUATION','DECISION'\]/,'the 0014 DECISION observation branches survive the rebuilt union');
 assert.match(sql,/'SITUATION','CONVERSATION_SESSION','DECISION'/,'the Attention DECISION binding branch survives the rebuilt union');
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,1,'the special codes and NOT_SURE map to NULL - never zero, never a midpoint, never a substituted value');
 // No zero substitution, streak/repetition-count/time-to-habit scoring,
 // frequency-to-automaticity conversion, habit/automaticity percentages,
 // habit-formation curves, compulsion/addiction/craving/dependence
 // classification, discipline/willpower scores, healthy/unhealthy habit
 // bands, rankings, or growth percentages exist; the only permitted
 // "grit"/"compulsion" tokens are the approval's explicit independence
 // basis entry, the only permitted "streak"/"time to habit" tokens are
 // the approval's explicit no-formula basis entry, the only permitted
 // "behavior inference" token is that same basis entry, the only
 // permitted "cue dependence" token is the approval's explicit
 // fail-to-UNASSESSED basis entry, and the only permitted
 // "clinical"/"psychometric" tokens are the approval's explicit
 // no-external-validation basis entry.
 assert.equal((sql.match(/SECURITY_BINDING_NO_EXTERNAL_CLINICAL_OR_PSYCHOMETRIC_VALIDATION_CLAIM/g)??[]).length,1);
 assert.equal((sql.match(/HABIT_STRENGTH_NOT_CONSISTENCY_FREQUENCY_INITIATIVE_MOTIVATION_PURPOSE_ALIGNMENT_GRIT_OR_COMPULSION/g)??[]).length,1);
 assert.equal((sql.match(/NO_BEHAVIOR_INFERENCE_NO_STREAK_OR_TIME_TO_HABIT_FORMULA/g)??[]).length,1);
 assert.equal((sql.match(/SUFFICIENT_REPETITION_BASIS_CURRENT_APPRAISAL_NULL_WINDOW/g)??[]).length,1);
 assert.equal((sql.match(/INSUFFICIENT_REPETITION_NO_SINGLE_PATTERN_AND_CUE_DEPENDENCE_FAIL_TO_UNASSESSED/g)??[]).length,1);
 assert.doesNotMatch(executable,/THEN 0|(?<!NO_)STREAK|(?<!OR_)TIME_TO_HABIT|days_to_habit|time_to_automaticity|repetition_count|repetition_telemetry|habit_percent|automaticity_percent|percentage|formation_curve|habit_formation|habit_score|GRIT(?!_OR_COMPULSION)|(?<!GRIT_OR_)COMPULSION|compulsiv|addiction|craving|(?<!CUE_)DEPENDENCE|disorder|pathology|loss_of_control|discipline|willpower|(?<!NO_)BEHAVIOR_INFERENCE|behavior_classif|behavior_ontology|behavior_entity|habit_graph|keyword|healthy|unhealthy|recommend|endors|threshold|average|normali[sz]|ranking|growth_percent|CLINICAL(?!_OR_PSYCHOMETRIC)|PSYCHOMETRIC(?!_VALIDATION_CLAIM)|diagnos/i);
});
test('is GOAL/SITUATION-bound only and reuses the exact owned target substrate',()=>{
 for(const context of['GLOBAL','CONVERSATION_SESSION','DECISION','RELATIONSHIP'])assert.doesNotMatch(sql,new RegExp(`'hgs\\.habit-strength',1,'${context}',1,'ACTIVE'`),`hgs.habit-strength/${context} must remain unsupported`);
 // The metric reuses the existing owned GOAL/SITUATION target substrate:
 // the dedicated functions look up an existing owned target, and 0049
 // never creates a table, a target-creation RPC, a target row, a behavior
 // entity, or any HGS-specific or Habit-Strength-specific target model,
 // and never touches the target/event context-kind unions (GOAL and
 // SITUATION are already valid there).
 assert.match(sql,/Unknown, cross-user, or unsupported Habit Strength GOAL\/SITUATION target/);
 assert.match(executable,/context_kind=ANY\(ARRAY\['GOAL','SITUATION'\]\)/);
 assert.doesNotMatch(executable,/CREATE TABLE/i,'0049 creates no table of any kind');
 assert.doesNotMatch(executable,/create_him_relationship_measurement_target_v1|create_him_motivation_measurement_target|create_him_attention_measurement_context|create_him_self_confidence_measurement_context|create_hgs_habit_strength_target/,'no target-creation RPC is added, rewritten, or broadened');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0049 never fabricates a measurement target');
 assert.doesNotMatch(executable,/him_measurement_targets_context_kind_check|him_measurement_event_context_kind_check/,'the target and event context-kind unions are untouched');
});
test('preserves the Foundation identity HGS / UNRESOLVED / null and invents no semantic type',()=>{
 assert.equal((sql.match(/'UNRESOLVED',NULL/g)??[]).length,1,'the snapshot preserves UNRESOLVED with a NULL semantic type');
 assert.match(sql,/metric_key='hgs\.habit-strength' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='UNRESOLVED' AND semantic_type IS NULL/);
 // The frozen Foundation identity is never forced to a resolved mapping,
 // no HABIT, AUTOMATICITY, or ROUTINE semantic type is invented, and no
 // forced STATE/TRAIT/CAPABILITY/READINESS/PROGRESS (or LOAD) remapping
 // is made.
 assert.doesNotMatch(executable,/semantic_type='HABIT'|semantic_type='AUTOMATICITY'|semantic_type='ROUTINE'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'|'RESOLVED','LOAD'|'RESOLVED','PROGRESS'|'RESOLVED','ALIGNMENT'/);
 // The definition activation names no semantic column: the deliberately
 // unresolved mapping survives the UPDATE untouched, and the ALREADY
 // RESOLVED Purpose Alignment identity is asserted (not written) only in
 // the migration-time phase inventory.
 assert.doesNotMatch(executable,/UPDATE public\.him_metric_definitions[^;]*semantic/s,'the activation UPDATE never touches the semantic mapping');
});
test('is a direct structured target-bound at-report automaticity appraisal with a NULL temporal window - not a frequency period, streak, or habit-formation curve',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The create path inserts a bare event (the durable 0040 window pair stays
 // NULL), the calculation refuses any non-NULL window, and the snapshot
 // insert names no temporal_window columns at all - repeated history is a
 // basis requirement, never a scored temporal window, and the metric
 // never encodes a seven-day period, a 30-day habit score, or a
 // caller-selected window.
 assert.equal((sql.match(/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/g)??[]).length,1);
 assert.match(sql,/Habit Strength observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window|p_repetition/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'hgs\.habit-strength\.observation:'/);
 assert.match(sql,/him_energy_calculation_supersessions/);
 // The structured appraisal is supplied by the user: no LLM, Memory,
 // Evidence, or conversation analysis ever infers automaticity or
 // repetition history, and no behavior-detection artifact exists - the
 // only permitted "inference" token is the approval's explicit
 // no-behavior-inference basis entry.
 assert.doesNotMatch(executable,/automaticity_detect|behavior_detect|habit_detect|(?<!NO_BEHAVIOR_)infer/i);
});
test('keeps Habit Strength fully independent of Consistency and every sibling with no composite, derivation, or frequency conversion',()=>{
 // The dedicated authority functions never read a sibling's rows: every
 // observation lookup filters hgs.habit-strength, and no inverse,
 // composite, frequency-to-automaticity conversion, or sibling-derived
 // value exists. The approval's independence basis token is the only
 // permitted mention of the sibling concepts in executable SQL.
 assert.match(sql,/HGS_HABIT_STRENGTH_CURRENT_TARGET_BOUND_CUE_LINKED_AUTOMATICITY/);
 assert.match(sql,/GOAL_SITUATION_ONLY/);
 assert.match(sql,/ORDINAL_AUTOMATICITY_5/);
 assert.match(sql,/CORRECTION_CURRENTNESS_IDEMPOTENCY_CONCURRENCY/);
 // 0049 itself introduces no sibling HGS authority: proven statically
 // against the frozen migration text only - never against the live
 // function universe, which later legitimately reviewed contracts may
 // extend.
 assert.doesNotMatch(executable,/(?:create|correct|calculate)_hgs_(?!habit_strength_measurement_v1)/,'0049 introduces only the three Habit Strength authority functions');
 const authority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hgs_habit_strength_measurement_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(authority.includes('calculate_hgs_habit_strength_measurement_v1'),'the Habit Strength authority slice covers its three dedicated functions');
 assert.doesNotMatch(authority,/hgs\.self-awareness|hgs\.resilience|hgs\.purpose-alignment|hbs\.|hrs\.|hse\./,'no sibling HGS, HBS, HRS, or HSE metric is ever scored or read by the Habit Strength authority');
 // The mandatory Consistency boundary holds structurally inside the owned
 // authority: no Consistency observation, frequency vocabulary, or
 // follow-through concept appears anywhere in the three functions - the
 // rebuilt shared unions legitimately carry every sibling branch, so
 // these negatives are scoped to the authority slice.
 assert.doesNotMatch(authority,/consistency|frequency|follow.?through|seven.?day/i,'the Habit Strength authority never reads Consistency or any frequency surface');
 // The static evidence-refs ledger columns are the calculation result's
 // own provenance shape; what is forbidden is reading a conversation
 // surface, Memory, Hypothesis, or canonical Evidence store.
 assert.doesNotMatch(authority,/conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items/i,'the Habit Strength authority reads no conversation surface, Memory, or Evidence store');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|automaticity_score|consistency_score|frequency_score|initiative_score|motivation_score|alignment_score|self_awareness_score|resilience_score|inverse_consistency|score_from_frequency/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hgs\.(?:self-awareness|resilience|purpose-alignment)|UPDATE public\.him_metric_definitions[^;]*hbs\.|UPDATE public\.him_metric_definitions[^;]*hrs\.|UPDATE public\.him_metric_definitions[^;]*hse\./s,'0049 never rewrites a sibling HGS, HBS, HRS, or HSE definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update - the activated metric only');
 // The boundary survives in the other direction too: the historical 0048
 // Purpose Alignment and 0041 Consistency/Initiative authority functions
 // remain untouched and never read Habit Strength.
 const paExecutable=purposeAlignment.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 const paAuthority=paExecutable.slice(paExecutable.indexOf('CREATE FUNCTION public.create_hgs_purpose_alignment_measurement_v1'),paExecutable.indexOf('CREATE OR REPLACE VIEW'));
 assert.doesNotMatch(paAuthority,/hgs\.habit-strength/,'the frozen 0048 Purpose Alignment authority never reads Habit Strength');
 const consistencyExecutable=consistency.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(consistencyExecutable,/hgs\.habit-strength|automaticity/i,'the frozen 0041 Consistency/Initiative authority never reads or scores Habit Strength');
});
test('adds no Trend v1, Intelligence Snapshot v1, compulsion/addiction/safety/recommendation output, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|classifier|telemetry|sentiment/i);
 // Completing the 17-metric measurement inventory creates no consumption
 // eligibility: Trend v1 and Snapshot v1 stay five-HSE only and never
 // mention Habit Strength or any HGS metric - and no Safety Runtime or
 // Recommendation surface is ever invoked, no habit
 // strengthening/weakening trend, formation curve, or
 // improving/worsening-automaticity reading exists, and high automaticity
 // is descriptive only.
 assert.doesNotMatch(trend,/hgs\./);
 assert.doesNotMatch(snapshot,/hgs\./);
 assert.doesNotMatch(executable,/safety_runtime|recommendation/i);
});
test('activates the one-time seventeen/zero phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hgs\.habit-strength\.automaticity-5\.v1',required_input_contract='DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT_V1' WHERE metric_key='hgs\.habit-strength' AND definition_version=1/);
 // The 17/0 counts are a migration-time transition invariant inside 0049
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so later migrations, definition versions, and separately
 // reviewed contracts stay possible.
 assert.match(sql,/CALIBRATED'\)<>17/);
 assert.match(sql,/UNCALIBRATED'\)<>0/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 assert.match(sql,/valid_context_kinds=ARRAY\['GOAL','SITUATION'\]/);
 // The migration-time inventory also proves the full four-family split:
 // all five HSE, all four HBS, all four HRS, and all four HGS metrics are
 // calibrated, Self-Awareness and Resilience stay HGS/UNRESOLVED/null,
 // and Purpose Alignment stays HGS/RESOLVED/ALIGNMENT.
 assert.match(sql,/metric_key='hgs\.purpose-alignment' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='RESOLVED' AND semantic_type='ALIGNMENT'/);
 // The current structured view carries exactly the seventeen calibrated
 // routes - every HSE/HBS/HRS route, the Self-Awareness route, the
 // Resilience route, and the Purpose Alignment route survive, and the
 // Habit Strength route completes the inventory without broadening any
 // previous route.
 assert.match(sql,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair','hrs\.emotional-safety','hgs\.self-awareness','hgs\.resilience','hgs\.purpose-alignment','hgs\.habit-strength'\]\)/);
});
