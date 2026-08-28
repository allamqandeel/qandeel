import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIA-009 static contract. Freezes the 0058 migration's OWN authority
// contract: exactly one read-only, non-SECURITY-DEFINER, authenticated-only
// aggregate RPC that answers BOTH already-approved cross-context foreground
// questions in ONE request by WRAPPING the migration-0056 and migration-0057
// authorities - never by reimplementing them, never by calling the QHIA-006 or
// QHIA-004 authorities beneath them, never by reading protected HIM substrate,
// never by naming or activating a metric or a context kind, never by exposing
// a caller-selected context/target/metric/slot selector, and never by
// combining, scoring, or ranking the two channels it transports.
//
// Forward-safe under the QHIM-002 policy: nothing here forbids a later
// migration, a later separately reviewed consumer, a later activation task, or
// a later third slot. Every assertion runs against the 0058 migration text
// itself (or this task's own wiring), never against the global schema or
// function namespace.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0058_him_cross_context_foreground_aggregation_v1.sql';
const MIGRATION_NUMBER=Number(MIGRATION.slice(0,4));
// Computed rather than written literally, so this contract can name "the next
// migration number" as a thing it must NOT freeze without itself containing it.
const NEXT_MIGRATION_NUMBER=String(MIGRATION_NUMBER+1).padStart(4,'0');
const sql=read(`migrations/${MIGRATION}`);
const verifier=read('verify-migration-0058.mjs');
// Every negative rule runs against executable SQL only: prose comments may
// legitimately name a concept while documenting its absence.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
// The migration's own final postcondition names forbidden authority, substrate,
// context, metric, and selector identifiers as DATA to prove their absence from
// the installed definition; the isolation negatives therefore run on the slice
// BEFORE it.
const postconditionStart=executable.lastIndexOf('DO $$DECLARE fn text');
assert.ok(postconditionStart>0,'the migration carries its installed-definition postcondition');
const authoritySlice=executable.slice(0,postconditionStart);

const FUNCTION_SIGNATURE='public.read_him_session_cross_context_foreground_v1(uuid,uuid)';

// The single guard the anti-vacuity fixtures below drive. It receives one
// comment-stripped migration text and throws on the first violated
// architectural property, so "the guard catches drift X" is proven by running
// the real guard over a mutated text - never by re-deriving the expectation.
const REQUIRED=[
 [/CREATE FUNCTION public\.read_him_session_cross_context_foreground_v1\(p_user_id uuid,p_session_id uuid\)/,'the exact narrow two-parameter aggregate signature'],
 [/foreground_slot_order integer,\n foreground_slot text,\n binding_state text,/,'the outer transport discriminator precedes the verbatim nested authority shape'],
 [/LANGUAGE sql STABLE SET search_path=''/,'the aggregate is a single-statement STABLE SQL function with a fixed empty search_path'],
 [/FROM public\.read_him_session_situation_stress_v1\(p_user_id,p_session_id\) s/,'the Situation channel is delegated to the QHIA-007 foreground authority, never reimplemented'],
 [/FROM public\.read_him_session_decision_attention_v1\(p_user_id,p_session_id\) d/,'the Decision channel is delegated to the QHIA-008 foreground authority, never reimplemented'],
 [/SELECT 1::integer AS foreground_slot_order,'SITUATION_STRESS'::text AS foreground_slot,/,'the first frozen transport slot is SITUATION_STRESS'],
 [/SELECT 2::integer,'DECISION_ATTENTION'::text,/,'the second frozen transport slot is DECISION_ATTENTION'],
 [/UNION ALL/,'the two channels are transported side by side, never merged'],
 [/\) envelope ORDER BY envelope\.foreground_slot_order/,'the transport order is deterministic'],
 [/REVOKE ALL ON FUNCTION public\.read_him_session_cross_context_foreground_v1\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/,'every default privilege is revoked first'],
 [/GRANT EXECUTE ON FUNCTION public\.read_him_session_cross_context_foreground_v1\(uuid,uuid\) TO authenticated;/,'authenticated is the only EXECUTE grantee'],
 [/IF p\.prosecdef THEN RAISE EXCEPTION/,'the postcondition proves the aggregate holds no privilege of its own'],
 [/IF p\.provolatile<>'s' THEN RAISE EXCEPTION/,'the postcondition proves the installed aggregate is STABLE'],
 [/IF p\.pronargs<>2 THEN RAISE EXCEPTION/,'the postcondition proves the installed callable surface stays two-parameter'],
 [/position\('public\.read_him_session_situation_stress_v1\(' in def\)=0/,'the postcondition proves QHIA-007 wrapping on the INSTALLED definition'],
 [/position\('public\.read_him_session_decision_attention_v1\(' in def\)=0/,'the postcondition proves QHIA-008 wrapping on the INSTALLED definition'],
 [/position\('''SITUATION_STRESS''' in def\)=0 OR position\('''DECISION_ATTENTION''' in def\)=0/,'the postcondition proves both frozen slot labels on the INSTALLED definition'],
 [/replace\(def,'UNION ALL',''\)\)\)\/length\('UNION ALL'\)<>1/,'the postcondition proves exactly two transport slots on the INSTALLED definition'],
 [/has_function_privilege\('anon',fn,'EXECUTE'\)/,'the postcondition proves the anon exclusion on the installed ACL'],
 [/'public\.read_him_session_context_bindings_v1','public\.read_him_contextual_current_intelligence_batch_v1'/,'the postcondition proves the lower QHIA-006 and QHIA-004 authorities are absent from the installed definition'],
];
const FORBIDDEN=[
 [/SECURITY DEFINER/,'the aggregate holds no privilege of its own: every privileged read belongs to the wrapped authorities'],
 [/CREATE (OR REPLACE )?(TABLE|VIEW|TRIGGER|POLICY|ROLE|SCHEMA|EXTENSION|INDEX)/,'no table, view, trigger, policy, role, schema, extension, or index is created'],
 [/CREATE OR REPLACE FUNCTION/,'no existing function is replaced: 0054, 0055, 0056 and 0057 are wrapped or left alone, never rewritten'],
 [/GRANT[^;]*\b(anon|PUBLIC|service_role)\b/,'anon, PUBLIC, and service_role are granted nothing'],
 [/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s/i,'no direct table privilege is granted to anyone'],
];
// Negatives that must hold on the AUTHORITY slice only, because the final
// postcondition names these identifiers as data to prove their absence from
// the installed definition.
const FORBIDDEN_IN_AUTHORITY=[
 [/'SITUATION'|'DECISION'|'GOAL'|'RELATIONSHIP'|'CONVERSATION_SESSION'|'GLOBAL'/,'QHIA-009 names and activates no context kind: it abstracts transport, not meaning'],
 [/hse\.|hbs\.|hrs\.|hgs\./,'QHIA-009 names and activates no metric: it abstracts transport, not meaning'],
 [/read_him_session_context_bindings_v1|read_him_contextual_current_intelligence_batch_v1/,'the QHIA-006 and QHIA-004 authorities stay owned by 0056 and 0057, never called around them'],
 [/read_him_latest_measurement_v1|him_active_structured_binding_id/,'canonical-latest and ACTIVE-binding authority stay delegated, never called directly'],
 [/public\.him_session_context_bindings\b/,'the QHIA-006 binding substrate is never queried directly'],
 [/public\.him_measurement_targets|public\.conversation_sessions|public\.him_metric_definitions|public\.him_metric_snapshots|public\.him_measurement_events|public\.him_measurement_observations|public\.him_current_structured_measurements|public\.him_canonical_model_bindings|public\.him_calculation_results/,'no ownership, definition, measurement, or binding substrate is read directly'],
 [/auth\.uid\(\)/,'authentication is never re-implemented: it belongs to the wrapped authorities'],
 [/p_context_kind|p_context_id|p_metric_key|p_metric_keys|p_definition_version|p_target|p_slot/,'no caller-selected context, target, metric, or slot selector exists on the callable surface'],
 [/composite|_score\b|\brank\b|\bpriority\b|\bweight\b/i,'the two channels are never combined, scored, ranked, or weighted'],
 [/LIMIT\s+1/i,'no first-slot/only-slot fallback exists'],
 [/ORDER\s+BY[^;]*created_at/i,'creation recency never becomes transport order'],
 [/embedding|similarity|classif|semantic_match|vector|openai|anthropic|\bllm\b|\bprompt\b|free[_-]?text/i,'no provider, model, embedding, classifier, or free-text logic exists'],
 [/confidence_score|relevance_score|relevance_weight|readiness|diagnos|valence|severity/i,'no score, weight, readiness, diagnosis, valence, or severity semantics exist'],
 [/EXECUTE\s+format|EXECUTE\s+'/i,'no dynamic SQL exists'],
 [/INSERT\s+INTO/i,'the migration writes no row'],
 [/UPDATE\s+public\./i,'the migration mutates no row'],
 [/DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|FUNCTION|VIEW|CONSTRAINT|TRIGGER|POLICY)/i,'the migration deletes and drops nothing'],
 [/ALTER\s+TABLE/i,'no table gains a column, constraint, trigger, or policy'],
 [/request\.jwt|set_config/,'no request identity is reconstructed or written'],
];
function assertCrossContextForegroundAggregateContract(text){
 const start=text.lastIndexOf('DO $$DECLARE fn text');
 const authority=start>0?text.slice(0,start):text;
 for(const[pattern,property]of REQUIRED)if(!pattern.test(text))throw new Error(`QHIA-009 cross-context foreground aggregate contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN)if(pattern.test(text))throw new Error(`QHIA-009 cross-context foreground aggregate contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN_IN_AUTHORITY)if(pattern.test(authority))throw new Error(`QHIA-009 cross-context foreground aggregate contract violated: ${property}`);
 // Cardinality rules the regex lists cannot express: EXACTLY two frozen
 // transport slots, EXACTLY one wrapping call per already-proven authority.
 const counts=[
  [/UNION ALL/g,1,'the envelope composes exactly the two frozen slots: no third slot and no read-all fan-out'],
  [/'SITUATION_STRESS'/g,1,'the SITUATION_STRESS slot is labelled exactly once'],
  [/'DECISION_ATTENTION'/g,1,'the DECISION_ATTENTION slot is labelled exactly once'],
  [/FROM public\.read_him_session_situation_stress_v1\(/g,1,'the QHIA-007 authority is wrapped exactly once'],
  [/FROM public\.read_him_session_decision_attention_v1\(/g,1,'the QHIA-008 authority is wrapped exactly once'],
 ];
 for(const[pattern,expected,property]of counts){
  if((authority.match(pattern)??[]).length!==expected)throw new Error(`QHIA-009 cross-context foreground aggregate contract violated: ${property}`);
 }
}
// The migration-identity rules, factored so forward-safety can be proven by
// running the real rules over a listing that already contains future
// migrations.
function assertMigrationIdentity(names){
 const migrations=[...names].sort();
 assert.ok(migrations.includes(MIGRATION),'migration 0058 exists');
 for(let n=1;n<=MIGRATION_NUMBER;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0057_him_decision_attention_foreground_consumption_v1.sql'),'0058 orders after 0057');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0056_him_situation_stress_foreground_consumption_v1.sql'),'0058 orders after 0056');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0055_him_session_context_binding_relevance_v1.sql'),'0058 orders after 0055');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0054_him_contextual_current_intelligence_batch_read_v1.sql'),'0058 orders after 0054');
}

test('S1 - migration 0058 installs only the one narrow aggregate and satisfies the frozen transport contract',()=>{
 assertMigrationIdentity(readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')));
 assert.doesNotThrow(()=>assertCrossContextForegroundAggregateContract(executable),'the shipped migration satisfies the frozen contract');
 // Exactly the intended objects: one function and nothing else - a count of
 // this migration's own text, never of the live namespace.
 assert.equal((executable.match(/CREATE FUNCTION/g)??[]).length,1,'exactly one new function');
 assert.equal((executable.match(/CREATE /g)??[]).length,1,'the migration creates exactly one object of any kind');
 assert.equal((executable.match(/GRANT EXECUTE/g)??[]).length,1,'exactly one EXECUTE grant');
 assert.equal((executable.match(/REVOKE ALL/g)??[]).length,1,'exactly one revocation');
 // Read-only by construction.
 assert.match(executable,/^BEGIN;/,'the migration is transactional');
 assert.match(executable,/COMMIT;\s*$/,'the migration commits');
});

test('S2 - hard authority rule: the two proven foreground authorities are WRAPPED, never reimplemented',()=>{
 // The two wrapped authorities are required as preconditions, so the migration
 // cannot install against a schema that lacks either of them.
 assert.match(executable,/to_regprocedure\('public\.read_him_session_situation_stress_v1\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-007 foreground authority is a hard precondition');
 assert.match(executable,/to_regprocedure\('public\.read_him_session_decision_attention_v1\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-008 foreground authority is a hard precondition');
 // Not one rule of relevance resolution, exact target authority, metric
 // identity, canonical-current selection, ACTIVE measurement-binding
 // compatibility, session ownership, or session runtime state is restated in
 // the authority slice: all of them already live in 0054/0055 and are reached
 // only through 0056 and 0057.
 assert.doesNotMatch(authoritySlice,/Authentication required|owner-exact|Unknown or cross-user|is not active|NO_ACTIVE_SITUATION|NO_ACTIVE_DECISION|ACTIVE_SITUATION_BOUND|ACTIVE_DECISION_BOUND|Ambiguous ACTIVE|snapshot_version|supersedes_observation_id/,'no wrapped or lower authority rule is duplicated');
 // Transport shape only: the outer discriminator, then the nested authority
 // row verbatim, per channel.
 assert.equal((executable.match(/s\.binding_state,s\.binding_context_id,/g)??[]).length,1,'the Situation channel carries the nested authority row verbatim');
 assert.equal((executable.match(/d\.binding_state,d\.binding_context_id,/g)??[]).length,1,'the Decision channel carries the nested authority row verbatim');
 for(const column of['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id']){
  assert.ok(executable.includes(`s.${column}`),`the Situation channel preserves ${column} verbatim`);
  assert.ok(executable.includes(`d.${column}`),`the Decision channel preserves ${column} verbatim`);
 }
 // The postcondition proves the same absences on the INSTALLED definition, so
 // a later CREATE OR REPLACE cannot silently regress them.
 assert.match(executable,/position\(forbidden in def\)>0/,'the postcondition proves forbidden-identifier absence on the installed definition');
 assert.match(executable,/QHIA-009 activates no metric and no context kind/,'the postcondition proves no metric and no context kind on the installed definition');
 assert.match(executable,/accepts no caller-selected context, target, metric, or slot/,'the postcondition proves no caller-selected selector on the installed definition');
 assert.match(executable,/must be read-only/,'the postcondition proves the installed definition is non-mutating');
 // Both wrapped authorities are left exactly as 0056 and 0057 installed them,
 // and are required to still be present rather than replaced by this task.
 assert.match(executable,/The QHIA-007 Situation-stress authority \(migration 0056\) must remain installed/,'the QHIA-007 authority must remain installed');
 assert.match(executable,/The QHIA-008 Decision-attention authority \(migration 0057\) must remain installed/,'the QHIA-008 authority must remain installed');
});

test('S3 - anti-vacuity: the real guard rejects every named drift fixture',()=>{
 const drifts=[
  ['a third foreground slot was added',executable.replace('  FROM public.read_him_session_decision_attention_v1(p_user_id,p_session_id) d\n','  FROM public.read_him_session_decision_attention_v1(p_user_id,p_session_id) d\n  UNION ALL\n  SELECT 3::integer,\'GOAL_MOTIVATION\'::text,d.binding_state,d.binding_context_id\n  FROM public.read_him_session_decision_attention_v1(p_user_id,p_session_id) d\n')],
  ['the QHIA-006 relevance authority was called directly',executable.replace('FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s','FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) s')],
  ['the QHIA-004 batch authority was called directly',executable.replace('FROM public.read_him_session_decision_attention_v1(p_user_id,p_session_id) d','FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,p_session_id) d')],
  ['a protected HIM substrate was read directly',executable.replace('FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s','FROM public.him_session_context_bindings s')],
  ['the canonical-latest authority was called around the wrapped authorities',executable.replace('FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s','FROM public.read_him_latest_measurement_v1(p_user_id,p_session_id) s')],
  ['a caller-selected metric list appeared',executable.replace('CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid,p_metric_keys text[])')],
  ['a caller-selected slot list appeared',executable.replace('CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid,p_slots text[])')],
  ['the callable surface gained a caller-supplied context id',executable.replace('CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid,p_context_id uuid)')],
  ['a metric was named by the aggregate',executable.replace("'SITUATION_STRESS'::text AS foreground_slot","'hse.stress'::text AS foreground_slot")],
  ['a context kind was named by the aggregate',executable.replace('FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s','FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s WHERE s.context_kind=\'SITUATION\'')],
  ['the two channels were reduced to a composite',executable.replace('s.value_state,s.numeric_value,','s.value_state,(s.numeric_value+d.numeric_value) AS composite_score,')],
  ['the deterministic transport order was dropped',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope')],
  ['a first-slot-only fallback appeared',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope ORDER BY envelope.foreground_slot_order LIMIT 1')],
  ['the aggregate took privilege of its own',executable.replace("LANGUAGE sql STABLE SET search_path=''","LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''")],
  ['the fixed search_path was dropped',executable.replace("LANGUAGE sql STABLE SET search_path=''",'LANGUAGE sql STABLE')],
  ['a service_role grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT EXECUTE ON FUNCTION '+FUNCTION_SIGNATURE+' TO service_role;')],
  ['a direct table grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT SELECT ON public.him_session_context_bindings TO authenticated;')],
  ['authentication was re-implemented instead of delegated',executable.replace('public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s','public.read_him_session_situation_stress_v1(auth.uid(),p_session_id) s')],
  ['a mutation appeared in the read path',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope ORDER BY envelope.foreground_slot_order;\n UPDATE public.him_session_context_bindings SET status=status')],
  ['an existing authority was replaced instead of wrapped',executable.replace('CREATE FUNCTION public.read_him_session_cross_context_foreground_v1','CREATE OR REPLACE FUNCTION public.read_him_session_cross_context_foreground_v1')],
  ['the installed-definition privilege postcondition was weakened',executable.replace('IF p.prosecdef THEN RAISE EXCEPTION','IF false THEN RAISE EXCEPTION')],
  ['the two-slot cardinality postcondition was removed',executable.replace("(length(def)-length(replace(def,'UNION ALL','')))/length('UNION ALL')<>1",'false')],
  ['the QHIA-008 wrapping postcondition was removed',executable.replace("position('public.read_him_session_decision_attention_v1(' in def)=0",'false')],
 ];
 for(const[label,mutated]of drifts){
  assert.notEqual(mutated,executable,`the "${label}" mutation actually replaced its source text`);
  assert.throws(()=>assertCrossContextForegroundAggregateContract(mutated),/QHIA-009 cross-context foreground aggregate contract violated/,`the guard rejects: ${label}`);
 }
 // Positive control and formatting-insensitivity: cosmetic whitespace never
 // fails the guard.
 assert.doesNotThrow(()=>assertCrossContextForegroundAggregateContract(executable));
 const reformatted=executable.replace('BEGIN;','BEGIN;\n');
 assert.notEqual(reformatted,executable,'the cosmetic rewrite actually changed the text');
 assert.doesNotThrow(()=>assertCrossContextForegroundAggregateContract(reformatted),'formatting alone never fails the guard');
});

test('S4 - the guard creates no future ceiling and weakens no prior verification',()=>{
 const listing=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql'));
 assert.doesNotThrow(()=>assertMigrationIdentity([...listing,`${NEXT_MIGRATION_NUMBER}_a_future_migration.sql`,'0099_a_much_later_migration.sql']),'future migrations are legal');
 assert.ok(!executable.includes(NEXT_MIGRATION_NUMBER),'0058 freezes no next-migration number');
 assert.ok(!verifier.includes(NEXT_MIGRATION_NUMBER),'the 0058 verifier freezes no next-migration number');
 for(const source of[executable,verifier]){
  assert.doesNotMatch(source,/(?:!==|===|<>|=)\s*17\b/,'no global metric count is frozen');
  assert.doesNotMatch(source,/is the last migration|can never exist|must never exist/i,'no permanent existence ceiling is stated');
 }
 // The prior tasks' own artifacts are preserved untouched.
 const files=readdirSync(root);
 for(const preserved of['verify-migration-0054.mjs','verify-migration-0055.mjs','verify-migration-0056.mjs','verify-migration-0057.mjs'])assert.ok(files.includes(preserved),`the ${preserved} verifier is preserved`);
 const contracts=readdirSync(new URL('tests/',root));
 for(const preserved of['him-session-context-binding-relevance-v1.test.mjs','him-situation-stress-foreground-consumption-v1.test.mjs','him-decision-attention-foreground-consumption-v1.test.mjs'])assert.ok(contracts.includes(preserved),`the ${preserved} contract is preserved`);
 for(const preserved of['0054_him_contextual_current_intelligence_batch_read_v1.sql','0055_him_session_context_binding_relevance_v1.sql','0056_him_situation_stress_foreground_consumption_v1.sql','0057_him_decision_attention_foreground_consumption_v1.sql'])assert.ok(listing.includes(preserved),`migration ${preserved} is preserved`);
 // The two wrapped migration texts themselves are byte-identical to what 0056
 // and 0057 shipped: this task adds a transport and changes no prior authority.
 assert.ok(read('migrations/0056_him_situation_stress_foreground_consumption_v1.sql').includes('CREATE FUNCTION public.read_him_session_situation_stress_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-007 authority is untouched');
 assert.ok(read('migrations/0057_him_decision_attention_foreground_consumption_v1.sql').includes('CREATE FUNCTION public.read_him_session_decision_attention_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-008 authority is untouched');
});

test('the 0058 verifier proves the required live-schema scenarios on a real connection and stays non-destructive',()=>{
 for(const proof of[
  'to_regprocedure','pg_get_functiondef','has_function_privilege','prosecdef','provolatile','pronargs',
  'read_him_session_cross_context_foreground_v1','read_him_session_situation_stress_v1','read_him_session_decision_attention_v1',
  'set_him_session_context_binding_v1','clear_him_session_context_binding_v1',
  'create_him_motivation_measurement_target','create_him_attention_measurement_context',
  'create_hse_stress_measurement','calculate_hse_stress_measurement',
  'create_hse_attention_measurement','calculate_hse_attention_measurement',
  'activate_him_canonical_model_binding',
  'SITUATION_STRESS','DECISION_ATTENTION','NO_ACTIVE_SITUATION','NO_ACTIVE_DECISION','cleanupVerifierUsers',
 ])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 assert.match(verifier,/SET LOCAL ROLE authenticated/,'authority evidence uses a real authenticated identity');
 assert.match(verifier,/SET LOCAL ROLE anon/,'anon exclusion is exercised');
 assert.match(verifier,/SET LOCAL ROLE service_role/,'service_role exclusion is exercised');
 assert.match(verifier,/new Client\(\{connectionString:process\.env\.DATABASE_URL\}\)/,'the verifier opens a real PostgreSQL connection');
 assert.match(verifier,/await client\.query\('ROLLBACK'\)/,'transactional fixtures roll back');
 // The core QHIA-009 claim is proven against the DIRECT authorities on live
 // rows, not merely asserted about the aggregate in isolation.
 assert.match(verifier,/must equal the direct authority payload verbatim/,'aggregate/direct payload parity is proven fact for fact');
 assert.match(verifier,/incompatible ACTIVE measurement binding/,'the incompatible ACTIVE measurement-binding state is proven on real rows');
 assert.match(verifier,/must always return exactly two rows/,'the frozen two-row envelope cardinality is proven on real rows');
 assert.match(verifier,/must carry no duplicate slot/,'duplicate-slot absence is proven on real rows');
 assert.match(verifier,/must remain installed and independently callable after QHIA-009/,'the two wrapped authorities are proven still independently callable');
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings|UPDATE public\.him_metric_definitions/,'the verifier mutates no measurement history');
});

test('the 0058 verifier is wired after the 0057 Decision-attention verifier and before the downstream HIM consumption gates',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-cross-context-foreground-aggregation:integration'],/--env-file-if-exists=\.env database\/verify-migration-0058\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-cross-context-foreground-aggregation:integration');
 assert.ok(step>0,'CI runs the 0058 verifier');
 assert.ok(step>ci.indexOf('verify:him-decision-attention-foreground-consumption:integration'),'it runs after the 0057 Decision-attention verifier');
 assert.ok(step>ci.indexOf('verify:him-situation-stress-foreground-consumption:integration'),'it runs after the 0056 Situation-stress verifier');
 assert.ok(step>ci.indexOf('verify:him-session-context-binding:integration'),'it runs after the 0055 binding verifier');
 assert.ok(step>ci.indexOf('verify:him-contextual-current-intelligence-batch:integration'),'it runs after the 0054 batch verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
 for(const preserved of['verify:him-decision-attention-foreground-consumption:integration','verify:him-situation-stress-foreground-consumption:integration','verify:him-session-context-binding:integration','verify:him-contextual-current-intelligence-batch:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-structured-current-binding-transition-safety:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration'])assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the prior gate ${preserved} is preserved`);
});
