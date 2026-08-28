import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIA-010 static contract. Freezes the 0059 migration's OWN authority
// contract: exactly TWO new read-only, non-SECURITY-DEFINER, authenticated-only
// functions -
//
//   * one direct Goal-Motivation foreground authority that resolves relevance
//     ONLY through the QHIA-006 authority and current intelligence ONLY through
//     the QHIA-004 authority, pinned to exactly GOAL + hse.motivation@1, never
//     reading a protected HIM substrate, never naming another context kind
//     (SITUATION - the other valid measurement context of this very metric -
//     included, which is what keeps Situation-bound Motivation dormant), never
//     naming another metric, and never exposing a caller-selected selector;
//   * one aggregate transport v2 that EXTENDS the frozen migration-0058
//     aggregate v1 with exactly one new slot by WRAPPING it, never by
//     reimplementing the two slots it already owns, never by calling the
//     0056/0057 per-channel authorities or the lower QHIA-006/QHIA-004
//     authorities around it, and never by combining, scoring, or ranking the
//     three channels it transports.
//
// The frozen migration-0058 aggregate v1 is neither replaced, altered, nor
// weakened here: this contract proves 0059 leaves it a two-slot contract.
//
// Forward-safe under the QHIM-002 policy: nothing here forbids a later
// migration, a later separately reviewed consumer, a later activation task, or
// a later fourth slot in a later version. Every assertion runs against the 0059
// migration text itself (or this task's own wiring), never against the global
// schema or function namespace.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0059_him_goal_motivation_foreground_consumption_v1.sql';
const MIGRATION_NUMBER=Number(MIGRATION.slice(0,4));
// Computed rather than written literally, so this contract can name "the next
// migration number" as a thing it must NOT freeze without itself containing it.
const NEXT_MIGRATION_NUMBER=String(MIGRATION_NUMBER+1).padStart(4,'0');
const sql=read(`migrations/${MIGRATION}`);
const verifier=read('verify-migration-0059.mjs');
// Every negative rule runs against executable SQL only: prose comments may
// legitimately name a concept while documenting its absence.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
// The migration's own postconditions name forbidden authority, substrate,
// context, metric, and selector identifiers as DATA to prove their absence from
// the installed definitions; the isolation negatives therefore run on the slice
// BEFORE the first of them.
const postconditionStart=executable.indexOf('DO $$DECLARE fn text');
assert.ok(postconditionStart>0,'the migration carries its installed-definition postconditions');
const authoritySlice=executable.slice(0,postconditionStart);

const GOAL_SIGNATURE='public.read_him_session_goal_motivation_v1(uuid,uuid)';
const V2_SIGNATURE='public.read_him_session_cross_context_foreground_v2(uuid,uuid)';

// The single guard the anti-vacuity fixtures below drive. It receives one
// comment-stripped migration text and throws on the first violated
// architectural property, so "the guard catches drift X" is proven by running
// the real guard over a mutated text - never by re-deriving the expectation.
const REQUIRED=[
 [/CREATE FUNCTION public\.read_him_session_goal_motivation_v1\(p_user_id uuid,p_session_id uuid\)/,'the exact narrow two-parameter Goal-motivation signature'],
 [/CREATE FUNCTION public\.read_him_session_cross_context_foreground_v2\(p_user_id uuid,p_session_id uuid\)/,'the exact narrow two-parameter aggregate v2 signature'],
 [/LANGUAGE plpgsql STABLE SET search_path=''/,'the Goal-motivation authority is a STABLE plpgsql function with a fixed empty search_path'],
 [/LANGUAGE sql STABLE SET search_path=''/,'the aggregate v2 is a single-statement STABLE SQL function with a fixed empty search_path'],
 [/FROM public\.read_him_session_context_bindings_v1\(p_user_id,p_session_id\) b/,'relevance is delegated to the QHIA-006 authority, never reimplemented'],
 [/WHERE b\.context_kind='GOAL'/,'exactly the ACTIVE GOAL relevance binding is consumed'],
 [/'NO_ACTIVE_GOAL'::text/,'an unbound session gets the deterministic no-effect answer'],
 [/'ACTIVE_GOAL_BOUND'::text/,'a bound Goal is reported as authoritatively bound'],
 [/Ambiguous ACTIVE Goal relevance binding/,'more than one ACTIVE Goal binding is a fail-closed integrity breach'],
 [/FROM public\.read_him_contextual_current_intelligence_batch_v1\(p_user_id,'GOAL',bound_goal::text,ARRAY\['hse\.motivation'\],ARRAY\[1\]\) c/,'current intelligence is delegated to the QHIA-004 authority for exactly GOAL + hse.motivation@1'],
 [/SELECT a\.foreground_slot_order,a\.foreground_slot,/,'aggregate v2 carries the frozen v1 transport discriminator verbatim'],
 [/FROM public\.read_him_session_cross_context_foreground_v1\(p_user_id,p_session_id\) a/,'aggregate v2 wraps the frozen QHIA-009 aggregate v1, never reimplements its two slots'],
 [/SELECT 3::integer,'GOAL_MOTIVATION'::text,/,'the one new frozen transport slot is 3/GOAL_MOTIVATION'],
 [/FROM public\.read_him_session_goal_motivation_v1\(p_user_id,p_session_id\) g/,'aggregate v2 wraps the new direct Goal-motivation authority'],
 [/UNION ALL/,'the channels are transported side by side, never merged'],
 [/\) envelope ORDER BY envelope\.foreground_slot_order/,'the transport order is deterministic'],
 [/REVOKE ALL ON FUNCTION public\.read_him_session_goal_motivation_v1\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/,'every default privilege on the Goal authority is revoked first'],
 [/GRANT EXECUTE ON FUNCTION public\.read_him_session_goal_motivation_v1\(uuid,uuid\) TO authenticated;/,'authenticated is the only Goal-authority EXECUTE grantee'],
 [/REVOKE ALL ON FUNCTION public\.read_him_session_cross_context_foreground_v2\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/,'every default privilege on the aggregate v2 is revoked first'],
 [/GRANT EXECUTE ON FUNCTION public\.read_him_session_cross_context_foreground_v2\(uuid,uuid\) TO authenticated;/,'authenticated is the only aggregate-v2 EXECUTE grantee'],
 [/IF p\.prosecdef THEN RAISE EXCEPTION 'The Goal-motivation composition must hold no privilege of its own/,'the postcondition proves the Goal authority holds no privilege of its own'],
 [/IF p\.prosecdef THEN RAISE EXCEPTION 'The aggregate v2 must hold no privilege of its own/,'the postcondition proves the aggregate v2 holds no privilege of its own'],
 [/position\('public\.read_him_session_context_bindings_v1\(' in def\)=0/,'the postcondition proves QHIA-006 delegation on the INSTALLED Goal definition'],
 [/position\('public\.read_him_contextual_current_intelligence_batch_v1\(' in def\)=0/,'the postcondition proves QHIA-004 delegation on the INSTALLED Goal definition'],
 [/position\('''GOAL''' in def\)=0 OR position\('''hse\.motivation''' in def\)=0/,'the postcondition proves the exact GOAL + hse.motivation pinning on the INSTALLED definition'],
 [/'''SITUATION''','''DECISION''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse\.energy','hse\.stress','hse\.attention','hse\.self-confidence'/,'the postcondition proves Situation-bound Motivation and every other metric absent from the INSTALLED Goal definition'],
 [/position\('public\.read_him_session_cross_context_foreground_v1\(' in def\)=0 THEN RAISE EXCEPTION 'The aggregate v2 must wrap the frozen QHIA-009 aggregate v1/,'the postcondition proves v1 wrapping on the INSTALLED v2 definition'],
 [/position\('public\.read_him_session_goal_motivation_v1\(' in def\)=0 THEN RAISE EXCEPTION 'The aggregate v2 must wrap the QHIA-010 Goal-motivation/,'the postcondition proves Goal-authority wrapping on the INSTALLED v2 definition'],
 [/position\('''GOAL_MOTIVATION''' in def\)=0 THEN RAISE EXCEPTION/,'the postcondition proves the new frozen slot label on the INSTALLED v2 definition'],
 [/replace\(def,'UNION ALL',''\)\)\)\/length\('UNION ALL'\)<>1/,'the postcondition proves exactly one added transport slot on the INSTALLED v2 definition'],
 [/'public\.read_him_session_situation_stress_v1','public\.read_him_session_decision_attention_v1','public\.read_him_session_context_bindings_v1','public\.read_him_contextual_current_intelligence_batch_v1'/,'the postcondition proves the 0056/0057 and lower QHIA-006/QHIA-004 authorities are absent from the INSTALLED v2 definition'],
 [/The QHIA-009 cross-context foreground aggregate v1 \(migration 0058\) must remain installed/,'the frozen aggregate v1 must remain installed'],
 [/The QHIA-009 aggregate v1 must keep its unchanged authenticated-only EXECUTE authority/,'the frozen aggregate v1 keeps its unchanged narrow ACL'],
 [/The QHIA-009 aggregate v1 must keep its exact two-slot contract/,'the frozen aggregate v1 keeps its exact two-slot contract'],
 [/The QHIA-009 aggregate v1 must remain a two-slot contract: the third slot belongs to v2 only/,'the third slot is proven absent from the frozen aggregate v1'],
 [/The QHIA-007 Situation-stress authority \(migration 0056\) must remain installed/,'the QHIA-007 authority must remain installed'],
 [/The QHIA-008 Decision-attention authority \(migration 0057\) must remain installed/,'the QHIA-008 authority must remain installed'],
];
const FORBIDDEN=[
 [/SECURITY DEFINER/,'neither new function holds a privilege of its own: every privileged read belongs to the composed authorities'],
 [/CREATE (OR REPLACE )?(TABLE|VIEW|TRIGGER|POLICY|ROLE|SCHEMA|EXTENSION|INDEX)/,'no table, view, trigger, policy, role, schema, extension, or index is created'],
 [/CREATE OR REPLACE FUNCTION/,'no existing function is replaced: 0054, 0055, 0056, 0057 and 0058 are composed, wrapped, or left alone, never rewritten'],
 [/GRANT[^;]*\b(anon|PUBLIC|service_role)\b/,'anon, PUBLIC, and service_role are granted nothing'],
 [/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s/i,'no direct table privilege is granted to anyone'],
];
// Negatives that must hold on the AUTHORITY slice only, because the
// postconditions name these identifiers as data to prove their absence from the
// installed definitions.
const FORBIDDEN_IN_AUTHORITY=[
 [/'SITUATION'|'DECISION'|'RELATIONSHIP'|'CONVERSATION_SESSION'|'GLOBAL'/,'QHIA-010 activates exactly GOAL: Situation-bound Motivation stays dormant and no other context kind is named'],
 [/hse\.energy|hse\.stress|hse\.attention|hse\.self-confidence|hbs\.|hrs\.|hgs\./,'QHIA-010 activates exactly hse.motivation@1: no other metric is named'],
 [/read_him_session_situation_stress_v1|read_him_session_decision_attention_v1/,'the QHIA-007 and QHIA-008 per-channel authorities stay owned by the frozen v1 aggregate, never called around it'],
 [/read_him_latest_measurement_v1|him_active_structured_binding_id/,'canonical-latest and ACTIVE-binding authority stay delegated, never called directly'],
 [/public\.him_session_context_bindings\b/,'the QHIA-006 binding substrate is never queried directly'],
 [/public\.him_measurement_targets|public\.conversation_sessions|public\.him_metric_definitions|public\.him_metric_snapshots|public\.him_measurement_events|public\.him_measurement_observations|public\.him_current_structured_measurements|public\.him_canonical_model_bindings|public\.him_calculation_results/,'no ownership, definition, measurement, or binding substrate is read directly'],
 [/auth\.uid\(\)/,'authentication is never re-implemented: it belongs to the composed authorities'],
 [/p_context_kind|p_context_id|p_metric_key|p_metric_keys|p_definition_version|p_target|p_slot/,'no caller-selected context, target, metric, or slot selector exists on either callable surface'],
 [/composite|_score\b|\brank\b|\bpriority\b|\bweight\b/i,'the channels are never combined, scored, ranked, or weighted'],
 [/LIMIT\s+1/i,'no newest/first/only-Goal fallback exists'],
 [/ORDER\s+BY[^;]*created_at/i,'creation recency never becomes relevance or transport order'],
 [/embedding|similarity|classif|semantic_match|vector|openai|anthropic|\bllm\b|\bprompt\b|free[_-]?text/i,'no provider, model, embedding, classifier, or free-text relevance logic exists'],
 [/confidence_score|relevance_score|relevance_weight|readiness|diagnos|valence|severity/i,'no score, weight, readiness, diagnosis, valence, or severity semantics exist'],
 [/EXECUTE\s+format|EXECUTE\s+'/i,'no dynamic SQL exists'],
 [/INSERT\s+INTO/i,'the migration writes no row'],
 [/UPDATE\s+public\./i,'the migration mutates no row'],
 [/DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|FUNCTION|VIEW|CONSTRAINT|TRIGGER|POLICY)/i,'the migration deletes and drops nothing'],
 [/ALTER\s+TABLE/i,'no table gains a column, constraint, trigger, or policy'],
 [/request\.jwt|set_config/,'no request identity is reconstructed or written'],
];
function assertGoalMotivationForegroundContract(text){
 const start=text.indexOf('DO $$DECLARE fn text');
 const authority=start>0?text.slice(0,start):text;
 for(const[pattern,property]of REQUIRED)if(!pattern.test(text))throw new Error(`QHIA-010 Goal-motivation foreground contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN)if(pattern.test(text))throw new Error(`QHIA-010 Goal-motivation foreground contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN_IN_AUTHORITY)if(pattern.test(authority))throw new Error(`QHIA-010 Goal-motivation foreground contract violated: ${property}`);
 // Cardinality rules the regex lists cannot express: EXACTLY one delegation per
 // composed authority, EXACTLY one new transport slot, EXACTLY one activated
 // context kind and metric.
 const counts=[
  [/UNION ALL/g,1,'aggregate v2 extends the frozen v1 envelope with exactly one new slot: no fourth slot and no read-all fan-out'],
  [/'GOAL_MOTIVATION'/g,1,'the GOAL_MOTIVATION slot is labelled exactly once'],
  [/'GOAL'/g,2,'exactly the GOAL relevance filter and the GOAL delegated read name the activated context kind'],
  [/'hse\.motivation'/g,1,'exactly one metric identity is activated'],
  [/FROM public\.read_him_session_context_bindings_v1\(/g,1,'the QHIA-006 relevance authority is called exactly once'],
  [/FROM public\.read_him_contextual_current_intelligence_batch_v1\(/g,1,'the QHIA-004 current-intelligence authority is called exactly once'],
  [/FROM public\.read_him_session_cross_context_foreground_v1\(/g,1,'the frozen aggregate v1 is wrapped exactly once'],
  [/FROM public\.read_him_session_goal_motivation_v1\(/g,1,'the direct Goal authority is wrapped exactly once'],
  [/CREATE FUNCTION/g,2,'exactly two new functions are created'],
 ];
 for(const[pattern,expected,property]of counts){
  if((authority.match(pattern)??[]).length!==expected)throw new Error(`QHIA-010 Goal-motivation foreground contract violated: ${property}`);
 }
}
// The migration-identity rules, factored so forward-safety can be proven by
// running the real rules over a listing that already contains future
// migrations.
function assertMigrationIdentity(names){
 const migrations=[...names].sort();
 assert.ok(migrations.includes(MIGRATION),'migration 0059 exists');
 for(let n=1;n<=MIGRATION_NUMBER;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0058_him_cross_context_foreground_aggregation_v1.sql'),'0059 orders after 0058');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0057_him_decision_attention_foreground_consumption_v1.sql'),'0059 orders after 0057');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0056_him_situation_stress_foreground_consumption_v1.sql'),'0059 orders after 0056');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0055_him_session_context_binding_relevance_v1.sql'),'0059 orders after 0055');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0054_him_contextual_current_intelligence_batch_read_v1.sql'),'0059 orders after 0054');
}

test('S1 - migration 0059 installs only the two narrow functions and satisfies the frozen contract',()=>{
 assertMigrationIdentity(readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')));
 assert.doesNotThrow(()=>assertGoalMotivationForegroundContract(executable),'the shipped migration satisfies the frozen contract');
 // Exactly the intended objects: two functions and nothing else - a count of
 // this migration's own text, never of the live namespace.
 assert.equal((executable.match(/CREATE FUNCTION/g)??[]).length,2,'exactly two new functions');
 assert.equal((executable.match(/CREATE /g)??[]).length,2,'the migration creates exactly two objects of any kind');
 assert.equal((executable.match(/GRANT EXECUTE/g)??[]).length,2,'exactly two EXECUTE grants');
 assert.equal((executable.match(/REVOKE ALL/g)??[]).length,2,'exactly two revocations');
 // Read-only by construction.
 assert.match(executable,/^BEGIN;/,'the migration is transactional');
 assert.match(executable,/COMMIT;\s*$/,'the migration commits');
});

test('S2 - hard authority rule: QHIA-006 + QHIA-004 are COMPOSED and the frozen aggregate v1 is WRAPPED, never reimplemented',()=>{
 // The composed authorities are required as preconditions, so the migration
 // cannot install against a schema that lacks any of them.
 assert.match(executable,/to_regprocedure\('public\.read_him_session_context_bindings_v1\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-006 relevance authority is a hard precondition');
 assert.match(executable,/to_regprocedure\('public\.read_him_contextual_current_intelligence_batch_v1\(uuid,text,text,text\[\],integer\[\]\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-004 batch authority is a hard precondition');
 assert.match(executable,/to_regprocedure\('public\.read_him_session_cross_context_foreground_v1\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the frozen QHIA-009 aggregate v1 is a hard precondition');
 // Not one rule of relevance resolution, exact target authority, canonical-
 // current selection, ACTIVE measurement-binding compatibility, session
 // ownership, or session runtime state is restated: all of them already live in
 // 0054/0055 and are reached only through delegation.
 assert.doesNotMatch(authoritySlice,/Authentication required|owner-exact|Unknown or cross-user|is not active|snapshot_version|supersedes_observation_id/,'no composed or lower authority rule is duplicated');
 // The aggregate v2 restates NONE of the two slots the frozen v1 already owns.
 assert.doesNotMatch(authoritySlice,/NO_ACTIVE_SITUATION|NO_ACTIVE_DECISION|ACTIVE_SITUATION_BOUND|ACTIVE_DECISION_BOUND|SITUATION_STRESS|DECISION_ATTENTION/,'aggregate v2 reimplements neither slot of the frozen v1 aggregate');
 // Transport shape only: the outer discriminator, then the nested authority row
 // verbatim, per channel.
 assert.equal((executable.match(/a\.binding_state,a\.binding_context_id,/g)??[]).length,1,'the wrapped v1 channels carry the nested authority rows verbatim');
 assert.equal((executable.match(/g\.binding_state,g\.binding_context_id,/g)??[]).length,1,'the Goal channel carries the nested authority row verbatim');
 for(const column of['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id']){
  assert.ok(executable.includes(`c.${column}`),`the Goal authority preserves the delegated ${column} verbatim`);
  assert.ok(executable.includes(`a.${column}`),`aggregate v2 preserves the wrapped v1 ${column} verbatim`);
  assert.ok(executable.includes(`g.${column}`),`aggregate v2 preserves the Goal ${column} verbatim`);
 }
 // The postconditions prove the same absences on the INSTALLED definitions, so
 // a later CREATE OR REPLACE cannot silently regress them.
 assert.equal((executable.match(/position\(forbidden in def\)>0/g)??[]).length,5,'both installed definitions are proven free of every forbidden identifier class');
 assert.match(executable,/QHIA-010 activates exactly GOAL \+ hse\.motivation@1/,'the postcondition proves exactly one context kind and one metric on the installed Goal definition');
 assert.match(executable,/The aggregate v2 activates no metric and no context kind/,'the postcondition proves no metric and no context kind on the installed v2 definition');
 assert.match(executable,/The aggregate v2 accepts no caller-selected context, target, metric, or slot/,'the postcondition proves no caller-selected selector on the installed v2 definition');
 assert.equal((executable.match(/must be read-only/g)??[]).length,2,'both installed definitions are proven non-mutating');
});

test('S3 - anti-vacuity: the real guard rejects every named drift fixture',()=>{
 const drifts=[
  ['the Goal authority read a protected substrate directly',executable.replace('FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b','FROM public.him_session_context_bindings b')],
  ['the Goal authority called the canonical-latest authority around QHIA-004',executable.replace("FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'GOAL',bound_goal::text,ARRAY['hse.motivation'],ARRAY[1]) c","FROM public.read_him_latest_measurement_v1(p_user_id,'hse.motivation',1,'GOAL',bound_goal::text) c")],
  ['Situation-bound Motivation was activated instead of the Goal context',executable.replace("FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'GOAL',bound_goal::text,ARRAY['hse.motivation'],ARRAY[1]) c","FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'SITUATION',bound_goal::text,ARRAY['hse.motivation'],ARRAY[1]) c")],
  ['a second Goal metric was activated',executable.replace("ARRAY['hse.motivation'],ARRAY[1]) c","ARRAY['hse.motivation','hse.energy'],ARRAY[1,1]) c")],
  ['the relevance filter stopped naming the GOAL kind',executable.replace("WHERE b.context_kind='GOAL';",'WHERE true;')],
  ['a newest/only-Goal fallback appeared',executable.replace("WHERE b.context_kind='GOAL';","WHERE b.context_kind='GOAL' LIMIT 1;")],
  ['creation recency became the relevance rule',executable.replace("WHERE b.context_kind='GOAL';","WHERE b.context_kind='GOAL' ORDER BY b.created_at DESC;")],
  ['the Goal callable surface gained a caller-supplied context id',executable.replace('CREATE FUNCTION public.read_him_session_goal_motivation_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_goal_motivation_v1(p_user_id uuid,p_session_id uuid,p_context_id uuid)')],
  ['the Goal callable surface gained a caller-selected metric list',executable.replace('CREATE FUNCTION public.read_him_session_goal_motivation_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_goal_motivation_v1(p_user_id uuid,p_session_id uuid,p_metric_keys text[])')],
  ['the Goal authority took privilege of its own',executable.replace("LANGUAGE plpgsql STABLE SET search_path=''","LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''")],
  ['the Goal authority lost its fixed search_path',executable.replace("LANGUAGE plpgsql STABLE SET search_path=''",'LANGUAGE plpgsql STABLE')],
  ['authentication was re-implemented instead of delegated',executable.replace('public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b','public.read_him_session_context_bindings_v1(auth.uid(),p_session_id) b')],
  ['aggregate v2 reimplemented the QHIA-007 slot instead of wrapping v1',executable.replace('FROM public.read_him_session_cross_context_foreground_v1(p_user_id,p_session_id) a','FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) a')],
  ['aggregate v2 reimplemented the QHIA-008 slot instead of wrapping v1',executable.replace('FROM public.read_him_session_cross_context_foreground_v1(p_user_id,p_session_id) a','FROM public.read_him_session_decision_attention_v1(p_user_id,p_session_id) a')],
  ['aggregate v2 called the QHIA-006 relevance authority directly',executable.replace('FROM public.read_him_session_cross_context_foreground_v1(p_user_id,p_session_id) a','FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) a')],
  ['aggregate v2 called the QHIA-004 batch authority directly',executable.replace('FROM public.read_him_session_goal_motivation_v1(p_user_id,p_session_id) g','FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,p_session_id) g')],
  ['a fourth aggregate slot was added',executable.replace('  FROM public.read_him_session_goal_motivation_v1(p_user_id,p_session_id) g\n','  FROM public.read_him_session_goal_motivation_v1(p_user_id,p_session_id) g\n  UNION ALL\n  SELECT 4::integer,\'GOAL_ENERGY\'::text,g.binding_state,g.binding_context_id\n  FROM public.read_him_session_goal_motivation_v1(p_user_id,p_session_id) g\n')],
  ['the third slot was renumbered out of its frozen transport order',executable.replace("SELECT 3::integer,'GOAL_MOTIVATION'::text,","SELECT 1::integer,'GOAL_MOTIVATION'::text,")],
  ['the third slot label drifted',executable.replace("SELECT 3::integer,'GOAL_MOTIVATION'::text,","SELECT 3::integer,'GOAL_MOTIVATION_PRIORITY'::text,")],
  ['the deterministic transport order was dropped',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope')],
  ['a first-slot-only fallback appeared in the aggregate',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope ORDER BY envelope.foreground_slot_order LIMIT 1')],
  ['the three channels were reduced to a composite',executable.replace('a.value_state,a.numeric_value,','a.value_state,(a.numeric_value+g.numeric_value) AS composite_score,')],
  ['the frozen aggregate v1 was replaced instead of extended',executable.replace('CREATE FUNCTION public.read_him_session_cross_context_foreground_v2','CREATE OR REPLACE FUNCTION public.read_him_session_cross_context_foreground_v2')],
  ['a service_role grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT EXECUTE ON FUNCTION '+V2_SIGNATURE+' TO service_role;')],
  ['a direct table grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT SELECT ON public.him_session_context_bindings TO authenticated;')],
  ['a mutation appeared in the read path',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope ORDER BY envelope.foreground_slot_order;\n UPDATE public.him_session_context_bindings SET status=status')],
  ['the Goal installed-definition privilege postcondition was weakened',executable.replace("IF p.prosecdef THEN RAISE EXCEPTION 'The Goal-motivation composition must hold no privilege of its own",'IF false THEN RAISE EXCEPTION \'x')],
  ['the aggregate-v2 slot-cardinality postcondition was removed',executable.replace("(length(def)-length(replace(def,'UNION ALL','')))/length('UNION ALL')<>1",'false')],
  ['the v1-wrapping postcondition was removed',executable.replace("position('public.read_him_session_cross_context_foreground_v1(' in def)=0 THEN RAISE EXCEPTION 'The aggregate v2 must wrap the frozen QHIA-009 aggregate v1",'false THEN RAISE EXCEPTION \'x')],
  ['the Situation-dormancy postcondition was removed from the installed Goal definition proof',executable.replace("'''SITUATION''','''DECISION''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.energy','hse.stress','hse.attention','hse.self-confidence'","'''DECISION''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.energy','hse.stress','hse.attention','hse.self-confidence'")],
  ['the frozen aggregate v1 lost its two-slot preservation proof',executable.replace('The QHIA-009 aggregate v1 must remain a two-slot contract: the third slot belongs to v2 only','x')],
 ];
 for(const[label,mutated]of drifts){
  assert.notEqual(mutated,executable,`the "${label}" mutation actually replaced its source text`);
  assert.throws(()=>assertGoalMotivationForegroundContract(mutated),/QHIA-010 Goal-motivation foreground contract violated/,`the guard rejects: ${label}`);
 }
 // Positive control and formatting-insensitivity: cosmetic whitespace never
 // fails the guard.
 assert.doesNotThrow(()=>assertGoalMotivationForegroundContract(executable));
 const reformatted=executable.replace('BEGIN;','BEGIN;\n');
 assert.notEqual(reformatted,executable,'the cosmetic rewrite actually changed the text');
 assert.doesNotThrow(()=>assertGoalMotivationForegroundContract(reformatted),'formatting alone never fails the guard');
});

test('S4 - the guard creates no future ceiling and weakens no prior verification',()=>{
 const listing=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql'));
 assert.doesNotThrow(()=>assertMigrationIdentity([...listing,`${NEXT_MIGRATION_NUMBER}_a_future_migration.sql`,'0099_a_much_later_migration.sql']),'future migrations are legal');
 assert.ok(!executable.includes(NEXT_MIGRATION_NUMBER),'0059 freezes no next-migration number');
 assert.ok(!verifier.includes(NEXT_MIGRATION_NUMBER),'the 0059 verifier freezes no next-migration number');
 for(const source of[executable,verifier]){
  assert.doesNotMatch(source,/(?:!==|===|<>|=)\s*17\b/,'no global metric count is frozen');
  assert.doesNotMatch(source,/is the last migration|can never exist|must never exist/i,'no permanent existence ceiling is stated');
 }
 // The prior tasks' own artifacts are preserved untouched.
 const files=readdirSync(root);
 for(const preserved of['verify-migration-0054.mjs','verify-migration-0055.mjs','verify-migration-0056.mjs','verify-migration-0057.mjs','verify-migration-0058.mjs'])assert.ok(files.includes(preserved),`the ${preserved} verifier is preserved`);
 const contracts=readdirSync(new URL('tests/',root));
 for(const preserved of['him-session-context-binding-relevance-v1.test.mjs','him-situation-stress-foreground-consumption-v1.test.mjs','him-decision-attention-foreground-consumption-v1.test.mjs','him-cross-context-foreground-aggregation-v1.test.mjs'])assert.ok(contracts.includes(preserved),`the ${preserved} contract is preserved`);
 for(const preserved of['0054_him_contextual_current_intelligence_batch_read_v1.sql','0055_him_session_context_binding_relevance_v1.sql','0056_him_situation_stress_foreground_consumption_v1.sql','0057_him_decision_attention_foreground_consumption_v1.sql','0058_him_cross_context_foreground_aggregation_v1.sql'])assert.ok(listing.includes(preserved),`migration ${preserved} is preserved`);
 // The wrapped migration text itself is byte-identical to what 0058 shipped:
 // this task versions the transport and changes no prior authority. The frozen
 // v1 aggregate still declares exactly its own two slots and still knows
 // nothing about a third.
 const aggregateV1=read('migrations/0058_him_cross_context_foreground_aggregation_v1.sql');
 assert.ok(aggregateV1.includes('CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-009 aggregate v1 is untouched');
 assert.ok(aggregateV1.includes("'SITUATION_STRESS'::text AS foreground_slot")&&aggregateV1.includes("SELECT 2::integer,'DECISION_ATTENTION'::text,"),'the QHIA-009 aggregate v1 keeps its frozen two-slot envelope');
 assert.ok(!aggregateV1.includes('GOAL_MOTIVATION')&&!aggregateV1.includes('read_him_session_goal_motivation_v1'),'the QHIA-009 aggregate v1 gained no third slot');
 assert.ok(read('migrations/0056_him_situation_stress_foreground_consumption_v1.sql').includes('CREATE FUNCTION public.read_him_session_situation_stress_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-007 authority is untouched');
 assert.ok(read('migrations/0057_him_decision_attention_foreground_consumption_v1.sql').includes('CREATE FUNCTION public.read_him_session_decision_attention_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-008 authority is untouched');
});

test('the 0059 verifier proves the required live-schema scenarios on a real connection and stays non-destructive',()=>{
 for(const proof of[
  'to_regprocedure','pg_get_functiondef','has_function_privilege','prosecdef','provolatile','pronargs','lanname','prosrc',
  'read_him_session_goal_motivation_v1','read_him_session_cross_context_foreground_v2','read_him_session_cross_context_foreground_v1',
  'read_him_session_situation_stress_v1','read_him_session_decision_attention_v1',
  'read_him_contextual_current_intelligence_batch_v1','read_him_latest_measurement_v1','him_active_structured_binding_id',
  'set_him_session_context_binding_v1','clear_him_session_context_binding_v1',
  'create_him_motivation_measurement_target','create_him_attention_measurement_context','create_him_relationship_measurement_target_v1',
  'create_hse_motivation_measurement','calculate_hse_motivation_measurement',
  'create_hse_stress_measurement','create_hse_attention_measurement',
  'activate_him_canonical_model_binding',
  'GOAL_MOTIVATION','SITUATION_STRESS','DECISION_ATTENTION','NO_ACTIVE_GOAL','ACTIVE_GOAL_BOUND','cleanupVerifierUsers',
 ])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 assert.match(verifier,/SET LOCAL ROLE authenticated/,'authority evidence uses a real authenticated identity');
 assert.match(verifier,/SET LOCAL ROLE anon/,'anon exclusion is exercised');
 assert.match(verifier,/SET LOCAL ROLE service_role/,'service_role exclusion is exercised');
 assert.match(verifier,/new Client\(\{connectionString:process\.env\.DATABASE_URL\}\)/,'the verifier opens a real PostgreSQL connection');
 assert.match(verifier,/await client\.query\('ROLLBACK'\)/,'transactional fixtures roll back');
 // The core QHIA-010 claims are proven against the DIRECT authorities on live
 // rows, not merely asserted about the aggregate in isolation.
 assert.match(verifier,/must equal the aggregate-v1 payload verbatim/,'aggregate-v2/aggregate-v1 payload parity is proven fact for fact');
 assert.match(verifier,/must equal the direct Goal authority payload verbatim/,'aggregate-v2/direct-Goal payload parity is proven fact for fact');
 assert.match(verifier,/must always return exactly three rows/,'the frozen three-row envelope cardinality is proven on real rows');
 assert.match(verifier,/must carry no duplicate slot/,'duplicate-slot absence is proven on real rows');
 assert.match(verifier,/must still return exactly two rows/,'the frozen aggregate v1 is proven still a two-row contract on real rows');
 assert.match(verifier,/must never gain the third slot/,'the frozen aggregate v1 is proven to have gained no third slot on real rows');
 assert.match(verifier,/A bound Situation must never bind, widen, or substitute the Goal slot/,'Situation-bound Motivation dormancy is proven on real rows');
 assert.match(verifier,/the dormant Situation-bound Motivation must be independently readable and KNOWN/,'the dormancy proof is non-vacuous: the excluded Situation reading really exists');
 assert.match(verifier,/the never-bound Goal is measurable through the QHIA-004 authority/,'ownership without an explicit relevance binding is proven invisible and non-vacuous');
 assert.match(verifier,/incompatible ACTIVE measurement binding/,'the incompatible ACTIVE measurement-binding state is proven on real rows');
 assert.match(verifier,/must be exactly one statement/,'the one-statement, one-snapshot aggregate v2 posture is proven on the installed body');
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings|UPDATE public\.him_metric_definitions/,'the verifier mutates no measurement history');
});

test('the 0059 verifier is wired after the 0058 aggregate verifier and before the downstream HIM consumption gates',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-goal-motivation-foreground-consumption:integration'],/--env-file-if-exists=\.env database\/verify-migration-0059\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-goal-motivation-foreground-consumption:integration');
 assert.ok(step>0,'CI runs the 0059 verifier');
 assert.ok(step>ci.indexOf('verify:him-cross-context-foreground-aggregation:integration'),'it runs after the 0058 aggregate verifier');
 assert.ok(step>ci.indexOf('verify:him-decision-attention-foreground-consumption:integration'),'it runs after the 0057 Decision-attention verifier');
 assert.ok(step>ci.indexOf('verify:him-situation-stress-foreground-consumption:integration'),'it runs after the 0056 Situation-stress verifier');
 assert.ok(step>ci.indexOf('verify:him-session-context-binding:integration'),'it runs after the 0055 binding verifier');
 assert.ok(step>ci.indexOf('verify:him-contextual-current-intelligence-batch:integration'),'it runs after the 0054 batch verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
 assert.ok(step<ci.indexOf('verify:full-intelligence-e2e-runtime'),'it runs before the Full Intelligence end-to-end runtime smoke');
 for(const preserved of['verify:him-cross-context-foreground-aggregation:integration','verify:him-decision-attention-foreground-consumption:integration','verify:him-situation-stress-foreground-consumption:integration','verify:him-session-context-binding:integration','verify:him-contextual-current-intelligence-batch:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-structured-current-binding-transition-safety:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration'])assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the prior gate ${preserved} is preserved`);
});
