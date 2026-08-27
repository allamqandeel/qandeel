import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0048_hgs_purpose_alignment_measurement_model_v1.sql',import.meta.url),'utf8');
// Negative vocabulary assertions run against the executable SQL only: prose
// comments legitimately name the forbidden concepts while documenting WHY
// they are excluded.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const trend=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
const snapshot=readFileSync(new URL('../migrations/0018_him_intelligence_snapshot_foundation_v1.sql',import.meta.url),'utf8');
const resilience=readFileSync(new URL('../migrations/0047_hgs_resilience_measurement_model_v1.sql',import.meta.url),'utf8');

test('0048 exists exactly once and orders after 0047',()=>{
 // Historical phase guarantee only: this contract owns migration 0048's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future HIM Expansion tasks may add migration 0049 and beyond, and nothing
 // here (or in any Purpose Alignment verifier) asserts that a later
 // migration can never exist, that 0048 is the last migration, or that the
 // global calibrated/uncalibrated count or the exact remaining-HGS
 // uncalibrated list stays frozen forever.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0048_hgs_purpose_alignment_measurement_model_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0048')).length,1,'exactly one migration 0048');
 assert.ok(migrations.indexOf('0048_hgs_purpose_alignment_measurement_model_v1.sql')>migrations.indexOf('0047_hgs_resilience_measurement_model_v1.sql'));
 const verifier=readFileSync(new URL('../verify-migration-0048.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(verifier,/0049/,'the historical 0048 verifier asserts no migration-0049 ceiling');
 assert.doesNotMatch(verifier,/<>16(?!\d)|!==16(?!\d)|<>1(?!\d)/,'the historical 0048 verifier freezes no global calibrated/uncalibrated count');
 // The remaining HGS metric is uncalibrated AT THIS HISTORICAL PHASE only:
 // the verifier must never permanently require Habit Strength to remain
 // uncalibrated (a later HIM Expansion task calibrates it), and it never
 // asserts a "%purpose%"/"%habit%" function-universe ceiling.
 assert.doesNotMatch(verifier,/must (?:remain|stay) uncalibrated|UNCALIBRATED'\)\.rows\[0\]/i,'the historical 0048 verifier freezes no permanent uncalibrated requirement on the remaining HGS metric');
 assert.doesNotMatch(verifier,/I?LIKE\s+'%[^']*purpose[^']*%'|I?LIKE\s+'%[^']*habit[^']*%'/i,'the historical 0048 verifier asserts no Purpose Alignment or Habit Strength function-universe ceiling');
 // Frozen historical-verifier policy (the mandatory future-sibling
 // regression guard): verifier 0048 proves only its own durable Purpose
 // Alignment guarantees against the fully migrated latest schema. It must
 // never assert that future sibling HGS measurement authority functions
 // are ABSENT from the live database - the next legitimate HGS calibration
 // creates them - so to_regprocedure (or any other) absence checks against
 // future Habit Strength authority, later Purpose Alignment v2/helpers, or
 // later HGS Runtime Consumption authority can never be reintroduced.
 // Whether 0048 itself introduced sibling authority is proven statically
 // below against the frozen migration text only.
 assert.doesNotMatch(verifier,/to_regprocedure/i,'the historical 0048 verifier proves no live-schema function absence of any kind');
 assert.doesNotMatch(verifier,/(?:create|correct|calculate)_hgs_habit_strength_measurement/i,'the historical 0048 verifier never names a future Habit Strength authority function');
 assert.doesNotMatch(verifier,/hgs_purpose_alignment_measurement_v2|purpose_alignment_helper|hgs_runtime_consumption/i,'the historical 0048 verifier never names a future Purpose Alignment v2/helper or HGS Runtime Consumption function as required-to-be-absent');
 for(const fn of['create_hgs_purpose_alignment_measurement_v1','correct_hgs_purpose_alignment_measurement_v1','calculate_hgs_purpose_alignment_measurement_v1'])assert.match(verifier,new RegExp(`'?${fn}'?`),`the verifier names ${fn} exactly`);
});
test('freezes the exact metric, model, instrument, and scale identities',()=>{
 assert.match(sql,/hgs\.purpose-alignment\.direct-structured-current-purpose-congruence/);
 assert.match(sql,/hgs\.purpose-alignment\.direct-goal-bound-purpose-congruence-report/);
 assert.match(sql,/'hgs\.purpose-alignment\.congruence-5\.v1',1,'ORDINAL',true,false,false,ARRAY\[1,2,3,4,5\]/);
 assert.match(sql,/DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT/);
 assert.match(sql,/qandeel\.him\.purpose-alignment\.foundation-approval/);
 // The activated canonical target-bound evidence contract is reused
 // exactly - never renamed and never replaced by a parallel substrate.
 assert.match(sql,/FIRST_CLASS_TARGET_BOUND_HIM_MEASUREMENT_OBSERVATION_V1/);
 assert.equal((sql.match(/'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE'/g)??[]).length,1,'exactly one calibrated production model - never shared with a sibling');
 // The single ACTIVE binding wires exclusively the Purpose Alignment
 // model, instrument, scale, and approval: no artifact is shared with
 // Motivation, Self-Awareness, Resilience, or Consistency even though the
 // numeric shape is the same 1-5.
 assert.match(sql,/'hgs\.purpose-alignment',1,'GOAL',1,'ACTIVE','hgs\.purpose-alignment\.direct-structured-current-purpose-congruence',1,'hgs\.purpose-alignment\.direct-goal-bound-purpose-congruence-report',1,'hgs\.purpose-alignment\.congruence-5\.v1',1,'qandeel\.him\.purpose-alignment\.foundation-approval'/);
 assert.equal((sql.match(/external_validation_claimed/g)??[]).length,1);
 assert.match(sql,/'::jsonb,false,'2026-08-27T00:00:00Z','HIM_EXPANSION_HGS_PURPOSE_ALIGNMENT_CANONICAL_APPROVAL'/);
});
test('binds the exact response vocabulary with null special semantics as an explicit per-family union',()=>{
 assert.match(sql,/metric_key='hgs\.purpose-alignment' AND response_code=ANY\(ARRAY\['VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH','TOO_VALUE_CONFLICTED_TO_RATE','INSUFFICIENT_PERSONAL_DIRECTION_BASIS_TO_JUDGE','NOT_SURE'\]\)/);
 // The HSE, seven-day HBS, Reflection, Trust, Communication, Repair,
 // Emotional Safety, Self-Awareness, and Resilience vocabularies stay
 // bound to their exact metric families - never widened, never merged
 // into a shared list, and the union is rebuilt from the canonical 0047
 // definition (the 0014 DECISION kind and every prior branch survive).
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
 assert.match(sql,/ARRAY\['SITUATION','DECISION'\]/,'the 0014 DECISION observation branches survive the rebuilt union');
 assert.match(sql,/'SITUATION','CONVERSATION_SESSION','DECISION'/,'the Attention DECISION binding branch survives the rebuilt union');
 assert.equal((sql.match(/WHEN 'VERY_LOW' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MODERATE' THEN 3 WHEN 'HIGH' THEN 4 WHEN 'VERY_HIGH' THEN 5 ELSE NULL END/g)??[]).length,1,'the special codes and NOT_SURE map to NULL - never zero, never a midpoint, never a substituted value');
 // No zero substitution, motive subscales, autonomous-motivation weighted
 // formulas, value weights/hierarchies, purpose percentages, life-purpose
 // scores, moral/goal-quality scores, recommendation or safe/unsafe-goal
 // thresholds, rankings, or growth percentages exist; the only permitted
 // "moral"/"habit strength" tokens are the approval's explicit
 // independence basis entry, the only permitted "value ... weighting"
 // token is the approval's explicit no-formula basis entry, and the only
 // permitted "clinical"/"psychometric" tokens are the approval's explicit
 // no-external-validation basis entry.
 assert.equal((sql.match(/SECURITY_BINDING_NO_EXTERNAL_CLINICAL_OR_PSYCHOMETRIC_VALIDATION_CLAIM/g)??[]).length,1);
 assert.equal((sql.match(/PURPOSE_ALIGNMENT_NOT_MOTIVATION_SELF_AWARENESS_RESILIENCE_CONSISTENCY_HABIT_STRENGTH_GOAL_SUCCESS_OR_MORAL_APPROVAL/g)??[]).length,1);
 assert.equal((sql.match(/NO_AUTONOMOUS_MOTIVATION_OR_VALUE_WEIGHTING_FORMULA/g)??[]).length,1);
 assert.doesNotMatch(executable,/THEN 0|subscale|subdomain|intrinsic|introjected|identified_motiv|extrinsic|motive_weight|value_hierarchy|VALUE_WEIGHT(?!ING_FORMULA)|weighted|(?<!NO_)AUTONOMOUS_MOTIVATION|purpose_percent|percentage|life_purpose|values_fit_score|MORAL(?!_APPROVAL)|ethic|legal_score|recommend|endors|abandon|healthy|unhealthy|threshold|health_band|average|normali[sz]|ranking|growth_percent|CLINICAL(?!_OR_PSYCHOMETRIC)|PSYCHOMETRIC(?!_VALIDATION_CLAIM)|diagnos/i);
});
test('is GOAL-bound only and reuses the exact owned target substrate',()=>{
 for(const context of['GLOBAL','CONVERSATION_SESSION','DECISION','RELATIONSHIP','SITUATION'])assert.doesNotMatch(sql,new RegExp(`'hgs\\.purpose-alignment',1,'${context}',1,'ACTIVE'`),`hgs.purpose-alignment/${context} must remain unsupported`);
 // The metric reuses the existing owned GOAL target substrate: the
 // dedicated functions look up an existing owned target, and 0048 never
 // creates a table, a target-creation RPC, a target row, or any
 // HGS-specific or Purpose-Alignment-specific target model, and never
 // touches the target/event context-kind unions (GOAL is already valid
 // there).
 assert.match(sql,/Unknown, cross-user, or unsupported Purpose Alignment GOAL target/);
 assert.match(executable,/context_kind='GOAL'/);
 assert.doesNotMatch(executable,/CREATE TABLE/i,'0048 creates no table of any kind');
 assert.doesNotMatch(executable,/create_him_relationship_measurement_target_v1|create_him_motivation_measurement_target|create_him_attention_measurement_context|create_him_self_confidence_measurement_context|create_hgs_purpose_alignment_target/,'no target-creation RPC is added, rewritten, or broadened');
 assert.doesNotMatch(executable,/INSERT INTO public\.him_measurement_targets/,'0048 never fabricates a measurement target');
 assert.doesNotMatch(executable,/him_measurement_targets_context_kind_check|him_measurement_event_context_kind_check/,'the target and event context-kind unions are untouched');
});
test('preserves the ALREADY RESOLVED Foundation identity HGS / RESOLVED / ALIGNMENT and invents no semantic type',()=>{
 assert.equal((sql.match(/'RESOLVED','ALIGNMENT'/g)??[]).length,1,'the snapshot preserves RESOLVED with the ALIGNMENT semantic type');
 assert.match(sql,/metric_key='hgs\.purpose-alignment' AND definition_version=1 AND calculation_status='CALIBRATED' AND hif_owner='HGS' AND semantic_mapping_status='RESOLVED' AND semantic_type='ALIGNMENT'/);
 // The frozen Foundation identity is never downgraded to UNRESOLVED/NULL,
 // no PURPOSE or VALUES semantic type is invented, and no forced
 // STATE/TRAIT/CAPABILITY/READINESS/PROGRESS (or LOAD) remapping is made.
 assert.doesNotMatch(executable,/'UNRESOLVED',NULL/,'0048 never writes an UNRESOLVED\/NULL snapshot identity for Purpose Alignment');
 assert.doesNotMatch(executable,/semantic_type='PURPOSE'|semantic_type='VALUES'|'RESOLVED','STATE'|'RESOLVED','TRAIT'|'RESOLVED','READINESS'|'RESOLVED','CAPABILITY'|'RESOLVED','LOAD'|'RESOLVED','PROGRESS'/);
 // The definition activation names no semantic column: the ALREADY
 // RESOLVED mapping survives the UPDATE untouched.
 assert.doesNotMatch(executable,/UPDATE public\.him_metric_definitions[^;]*semantic/s,'the activation UPDATE never touches the semantic mapping');
});
test('is a direct structured goal-bound at-report congruence appraisal with a NULL temporal window - not a period, progress delta, or values-drift trajectory',()=>{
 assert.match(sql,/'DIRECT_STRUCTURED_USER_REPORT'/);
 // The create path inserts a bare event (the durable 0040 window pair stays
 // NULL), the calculation refuses any non-NULL window, and the snapshot
 // insert names no temporal_window columns at all - the metric never
 // encodes a retrospective period, a goal-progress delta, or a
 // before/after values analysis.
 assert.equal((sql.match(/INSERT INTO public\.him_measurement_events\(id,user_id,context_kind,context_id,created_at\)VALUES/g)??[]).length,1);
 assert.match(sql,/Purpose Alignment observation window must remain NULL/);
 assert.doesNotMatch(executable,/interval '7 days'|interval '14 days'|interval '30 days'|p_window|p_period|p_days|p_observation_window/);
 assert.doesNotMatch(executable,/temporal_window_start|temporal_window_end/,'the snapshot carries no temporal window');
 assert.match(sql,/p_client_reported_at_untrusted/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/'hgs\.purpose-alignment\.observation:'/);
 assert.match(sql,/him_energy_calculation_supersessions/);
 // The structured appraisal is supplied by the user: no LLM, Memory,
 // Evidence, or conversation analysis ever infers alignment, and no
 // alignment-detection artifact exists.
 assert.doesNotMatch(executable,/alignment_detect|value_detect|infer/i);
});
test('keeps Purpose Alignment fully independent of Motivation and every sibling with no composite, derivation, or formula',()=>{
 // The dedicated authority functions never read a sibling's rows: every
 // observation lookup filters hgs.purpose-alignment, and no inverse,
 // composite, autonomous-motivation formula, or sibling-derived value
 // exists. The approval's independence basis token is the only permitted
 // mention of the sibling concepts in executable SQL.
 assert.match(sql,/PURPOSE_ALIGNMENT_NOT_MOTIVATION_SELF_AWARENESS_RESILIENCE_CONSISTENCY_HABIT_STRENGTH_GOAL_SUCCESS_OR_MORAL_APPROVAL/);
 assert.match(sql,/VALUE_CONFLICT_AND_INSUFFICIENT_DIRECTION_BASIS_FAIL_TO_UNASSESSED/);
 assert.match(sql,/CURRENT_APPRAISAL_NULL_WINDOW/);
 // 0048 itself introduces no sibling HGS authority: proven statically
 // against the frozen migration text only - never against the live
 // function universe, which later HGS calibrations legitimately extend.
 assert.doesNotMatch(executable,/(?:create|correct|calculate)_hgs_(?!purpose_alignment_measurement_v1)/,'0048 introduces only the three Purpose Alignment authority functions');
 const authority=executable.slice(executable.indexOf('CREATE FUNCTION public.create_hgs_purpose_alignment_measurement_v1'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.ok(authority.includes('calculate_hgs_purpose_alignment_measurement_v1'),'the Purpose Alignment authority slice covers its three dedicated functions');
 assert.doesNotMatch(authority,/hgs\.self-awareness|hgs\.resilience|hgs\.habit-strength|hbs\.|hrs\.|hse\./,'no sibling HGS, HBS, HRS, or HSE metric is ever scored or read by the Purpose Alignment authority');
 // The static evidence-refs ledger columns are the calculation result's
 // own provenance shape; what is forbidden is reading a conversation
 // surface, Memory, Hypothesis, or canonical Evidence store.
 assert.doesNotMatch(authority,/conversation_sessions|FROM public\.memories|FROM public\.hypotheses|canonical_evidence|evidence_items/i,'the Purpose Alignment authority reads no conversation surface, Memory, or Evidence store');
 assert.doesNotMatch(executable,/6\s*-\s*score|composite|alignment_score|motivation_score|inverse_motivation|self_awareness_score|resilience_score|consistency_score|importance_score|success_score/i);
 assert.doesNotMatch(sql,/UPDATE public\.him_metric_definitions[^;]*hgs\.(?:self-awareness|resilience|habit-strength)|UPDATE public\.him_metric_definitions[^;]*hbs\.|UPDATE public\.him_metric_definitions[^;]*hrs\.|UPDATE public\.him_metric_definitions[^;]*hse\./s,'0048 never rewrites a sibling HGS, HBS, HRS, or HSE definition');
 assert.equal((sql.match(/UPDATE public\.him_metric_definitions/g)??[]).length,1,'exactly one definition update - the activated metric only');
 // The boundary survives in the other direction too: the historical 0047
 // Resilience authority functions remain untouched and never read Purpose
 // Alignment.
 const siblingExecutable=resilience.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 const siblingAuthority=siblingExecutable.slice(siblingExecutable.indexOf('CREATE FUNCTION public.create_hgs_resilience_measurement_v1'),siblingExecutable.indexOf('CREATE OR REPLACE VIEW'));
 assert.doesNotMatch(siblingAuthority,/hgs\.purpose-alignment/,'the frozen 0047 Resilience authority never reads Purpose Alignment');
});
test('adds no Trend v1, Intelligence Snapshot v1, moral/safety/recommendation output, or provider/LLM surface',()=>{
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|HimTrend|trend/i);
 assert.doesNotMatch(executable,/openai|anthropic|claude|gemini|llm|embedding|provider|prompt|model_router|fetch|http|keyword|classifier|telemetry|sentiment/i);
 // RESOLVED/ALIGNMENT does not make Purpose Alignment eligible for either
 // frozen v1 read surface: Trend v1 and Snapshot v1 stay five-HSE only
 // and never mention Purpose Alignment or any HGS metric - and no Safety
 // Runtime or Recommendation surface is ever invoked.
 assert.doesNotMatch(trend,/hgs\./);
 assert.doesNotMatch(snapshot,/hgs\./);
 assert.doesNotMatch(executable,/safety_runtime|recommendation/i);
});
test('activates the one-time sixteen/one phase inventory without touching other definitions',()=>{
 assert.match(sql,/calculation_status='CALIBRATED',scale_reference='hgs\.purpose-alignment\.congruence-5\.v1',required_input_contract='DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT_V1' WHERE metric_key='hgs\.purpose-alignment' AND definition_version=1/);
 // The 16/1 counts are a migration-time transition invariant inside 0048
 // only - the historical verifier never freezes them as a permanent
 // ceiling, so a later HIM Expansion phase can calibrate Habit Strength.
 assert.match(sql,/CALIBRATED'\)<>16/);
 assert.match(sql,/UNCALIBRATED'\)<>1/);
 assert.match(sql,/cardinality\(dependency_ids\)=0 AND cardinality\(consumers\)=0/);
 // The current structured view carries exactly the sixteen calibrated
 // routes - every HSE/HBS/HRS route, the Self-Awareness route, and the
 // Resilience route survive, and no other HGS metric is routed.
 assert.match(sql,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair','hrs\.emotional-safety','hgs\.self-awareness','hgs\.resilience','hgs\.purpose-alignment'\]\)/);
 const view=executable.slice(executable.indexOf('CREATE OR REPLACE VIEW'),executable.indexOf('REVOKE ALL ON FUNCTION'));
 assert.doesNotMatch(view,/hgs\.habit-strength/,'no other HGS metric enters the current structured view');
});
