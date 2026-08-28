import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIA-007 static contract. Freezes the 0056 migration's OWN authority
// contract: exactly one read-only, non-SECURITY-DEFINER, authenticated-only
// composition RPC that answers the Situation-bound hse.stress@1 question in
// ONE request by COMPOSING the QHIA-006 relevance authority (migration 0055)
// with the QHIA-004 contextual current-intelligence authority (migration
// 0054) - never by reimplementing, bypassing, or widening either, and never
// by activating a second context kind or a second metric.
//
// Forward-safe under the QHIM-002 policy: nothing here forbids a later
// migration, a later separately reviewed consumer, or any future activation
// task. Every assertion runs against the 0056 migration text itself (or this
// task's own wiring), never against the global schema or function namespace.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0056_him_situation_stress_foreground_consumption_v1.sql';
const MIGRATION_NUMBER=Number(MIGRATION.slice(0,4));
// Computed rather than written literally, so this contract can name "the next
// migration number" as a thing it must NOT freeze without itself containing it.
const NEXT_MIGRATION_NUMBER=String(MIGRATION_NUMBER+1).padStart(4,'0');
const sql=read(`migrations/${MIGRATION}`);
const verifier=read('verify-migration-0056.mjs');
// Every negative rule runs against executable SQL only: prose comments may
// legitimately name a concept while documenting its absence.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
// The migration's own final postcondition names forbidden substrate, context,
// and metric identifiers as DATA to prove their absence from the installed
// definition; the isolation negatives therefore run on the slice BEFORE it.
const postconditionStart=executable.lastIndexOf('DO $$DECLARE fn text');
assert.ok(postconditionStart>0,'the migration carries its installed-definition postcondition');
const authoritySlice=executable.slice(0,postconditionStart);

const FUNCTION_SIGNATURE='public.read_him_session_situation_stress_v1(uuid,uuid)';

// The single guard the anti-vacuity fixtures below drive. It receives one
// comment-stripped migration text and throws on the first violated
// architectural property, so "the guard catches drift X" is proven by running
// the real guard over a mutated text - never by re-deriving the expectation.
const REQUIRED=[
 [/CREATE FUNCTION public\.read_him_session_situation_stress_v1\(p_user_id uuid,p_session_id uuid\)/,'the exact narrow two-parameter composition signature'],
 [/LANGUAGE plpgsql STABLE SET search_path=''/,'the composition is STABLE with a fixed empty search_path'],
 [/FROM public\.read_him_session_context_bindings_v1\(p_user_id,p_session_id\) b/,'relevance is resolved through the QHIA-006 authority, never reconstructed'],
 [/WHERE b\.context_kind='SITUATION'/,'exactly the SITUATION kind is filtered out of the authoritative binding result'],
 [/IF situations IS NULL OR cardinality\(situations\)=0 THEN/,'an absent ACTIVE Situation binding is answered deterministically'],
 [/'NO_ACTIVE_SITUATION'::text/,'the deterministic unbound no-effect result exists'],
 [/'ACTIVE_SITUATION_BOUND'::text/,'the bound result is explicitly discriminated'],
 [/IF cardinality\(situations\)>1 THEN RAISE EXCEPTION 'Ambiguous ACTIVE Situation relevance binding'/,'more than one ACTIVE Situation fails closed instead of choosing one'],
 [/FROM public\.read_him_contextual_current_intelligence_batch_v1\(p_user_id,'SITUATION',bound_situation::text,ARRAY\['hse\.stress'\],ARRAY\[1\]\) c/,'current intelligence is delegated to the QHIA-004 authority for exactly SITUATION + hse.stress@1'],
 [/REVOKE ALL ON FUNCTION public\.read_him_session_situation_stress_v1\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/,'every default privilege is revoked first'],
 [/GRANT EXECUTE ON FUNCTION public\.read_him_session_situation_stress_v1\(uuid,uuid\) TO authenticated;/,'authenticated is the only EXECUTE grantee'],
 [/IF p\.prosecdef THEN RAISE EXCEPTION/,'the postcondition proves the composition holds no privilege of its own'],
 [/IF p\.provolatile<>'s' THEN RAISE EXCEPTION/,'the postcondition proves the installed composition is STABLE'],
 [/IF p\.pronargs<>2 THEN RAISE EXCEPTION/,'the postcondition proves the installed callable surface stays two-parameter'],
 [/position\('public\.read_him_session_context_bindings_v1\(' in def\)=0/,'the postcondition proves QHIA-006 delegation on the INSTALLED definition'],
 [/position\('public\.read_him_contextual_current_intelligence_batch_v1\(' in def\)=0/,'the postcondition proves QHIA-004 delegation on the INSTALLED definition'],
 [/has_function_privilege\('anon',fn,'EXECUTE'\)/,'the postcondition proves the anon exclusion on the installed ACL'],
];
const FORBIDDEN=[
 [/SECURITY DEFINER/,'the composition holds no privilege of its own: every privileged read belongs to the composed authorities'],
 [/CREATE (OR REPLACE )?(TABLE|VIEW|TRIGGER|POLICY|ROLE|SCHEMA|EXTENSION|INDEX)/,'no table, view, trigger, policy, role, schema, extension, or index is created'],
 [/CREATE OR REPLACE FUNCTION/,'no existing function is replaced: 0054 and 0055 are composed, never rewritten'],

 [/GRANT[^;]*\b(anon|PUBLIC|service_role)\b/,'anon, PUBLIC, and service_role are granted nothing'],
 [/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s/i,'no direct table privilege is granted to anyone'],
];
// Negatives that must hold on the AUTHORITY slice only, because the final
// postcondition names these identifiers as data to prove their absence from
// the installed definition.
const FORBIDDEN_IN_AUTHORITY=[
 [/'GOAL'|'DECISION'|'RELATIONSHIP'|'CONVERSATION_SESSION'|'GLOBAL'/,'QHIA-007 activates no context kind other than SITUATION'],
 [/hse\.energy|hse\.attention|hse\.motivation|hse\.self-confidence|hbs\.|hrs\.|hgs\./,'QHIA-007 activates no metric other than hse.stress'],
 [/public\.him_session_context_bindings\b/,'the QHIA-006 binding substrate is never queried directly'],
 [/public\.him_measurement_targets|public\.conversation_sessions|public\.him_metric_definitions|public\.him_metric_snapshots|public\.him_measurement_events|public\.him_measurement_observations|public\.him_current_structured_measurements|public\.him_canonical_model_bindings/,'no ownership, definition, or measurement substrate is read directly'],
 [/public\.read_him_latest_measurement_v1|public\.him_active_structured_binding_id/,'canonical-latest and ACTIVE-binding authority stay delegated through QHIA-004, never called around it'],
 [/auth\.uid\(\)/,'authentication is never re-implemented: it belongs to the composed authorities'],
 [/p_context_kind|p_context_id|p_metric_key|p_metric_keys|p_definition_version|p_target/,'no arbitrary context, metric, or target parameter exists on the callable surface'],
 [/LIMIT\s+1/i,'no latest/first/only-Situation fallback exists'],
 [/ORDER\s+BY[^;]*created_at/i,'creation recency never becomes relevance'],
 [/embedding|similarity|classif|semantic_match|vector|openai|anthropic|\bllm\b|\bprompt\b|free[_-]?text/i,'no provider, model, embedding, classifier, or free-text relevance logic exists'],
 [/confidence_score|relevance_score|relevance_weight|readiness|diagnos|valence|severity/i,'no score, weight, readiness, diagnosis, valence, or severity semantics exist'],
 [/EXECUTE\s+format|EXECUTE\s+'/i,'no dynamic SQL exists'],
 [/INSERT\s+INTO/i,'the migration writes no row'],
 [/UPDATE\s+public\./i,'the migration mutates no row'],
 [/DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|FUNCTION|VIEW|CONSTRAINT|TRIGGER|POLICY)/i,'the migration deletes and drops nothing'],
 [/ALTER\s+TABLE/i,'no table gains a column, constraint, trigger, or policy'],
 [/request\.jwt|set_config/,'no request identity is reconstructed or written'],
];
function assertSituationStressAuthorityContract(text){
 const start=text.lastIndexOf('DO $$DECLARE fn text');
 const authority=start>0?text.slice(0,start):text;
 for(const[pattern,property]of REQUIRED)if(!pattern.test(text))throw new Error(`QHIA-007 situation-stress authority contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN)if(pattern.test(text))throw new Error(`QHIA-007 situation-stress authority contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN_IN_AUTHORITY)if(pattern.test(authority))throw new Error(`QHIA-007 situation-stress authority contract violated: ${property}`);
}
// The migration-identity rules, factored so forward-safety can be proven by
// running the real rules over a listing that already contains future
// migrations.
function assertMigrationIdentity(names){
 const migrations=[...names].sort();
 assert.ok(migrations.includes(MIGRATION),'migration 0056 exists');
 for(let n=1;n<=MIGRATION_NUMBER;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0055_him_session_context_binding_relevance_v1.sql'),'0056 orders after 0055');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0054_him_contextual_current_intelligence_batch_read_v1.sql'),'0056 orders after 0054');
}

test('S1 - migration 0056 installs only the one narrow composition and satisfies the frozen authority contract',()=>{
 assertMigrationIdentity(readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')));
 assert.doesNotThrow(()=>assertSituationStressAuthorityContract(executable),'the shipped migration satisfies the frozen contract');
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

test('S2 - hard authority rule: relevance and current intelligence are COMPOSED, never reimplemented',()=>{
 // The two composed authorities are required as preconditions, so the
 // migration cannot install against a schema that lacks either of them.
 assert.match(executable,/to_regprocedure\('public\.read_him_session_context_bindings_v1\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-006 authority is a hard precondition');
 assert.match(executable,/to_regprocedure\('public\.read_him_contextual_current_intelligence_batch_v1\(uuid,text,text,text\[\],integer\[\]\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-004 authority is a hard precondition');
 // Not one rule of session ownership, session runtime state, target
 // ownership, ACTIVE-binding selection, runtime matrix eligibility,
 // persisted-definition validation, canonical-latest selection, or ACTIVE
 // measurement-binding compatibility is restated in the authority slice.
 assert.doesNotMatch(authoritySlice,/Authentication required|owner-exact|Unknown or cross-user|is not active|Unknown, cross-user, or wrong-kind|snapshot_version|supersedes_observation_id/,'no composed authority rule is duplicated');
 // The bound Situation is server-resolved and typed: the application never
 // supplies it and never picks between candidates.
 assert.match(executable,/bound_situation:=situations\[1\];/,'the single ACTIVE Situation is taken only after the cardinality guard');
 assert.match(executable,/SELECT array_agg\(b\.context_id\) INTO situations/,'the authoritative binding result is aggregated so its cardinality is explicit');
 // Exactly one delegated slot is requested.
 assert.equal((executable.match(/ARRAY\['hse\.stress'\]/g)??[]).length,1,'exactly one metric slot is requested');
 assert.equal((executable.match(/ARRAY\[1\]/g)??[]).length,1,'exactly the frozen definition version 1 is requested');
 // The postcondition proves the same absences on the INSTALLED definition, so
 // a later CREATE OR REPLACE cannot silently regress them.
 assert.match(executable,/position\(forbidden in def\)>0/,'the postcondition proves forbidden-identifier absence on the installed definition');
 assert.match(executable,/QHIA-007 activates exactly SITUATION \+ hse\.stress@1/,'the postcondition proves no other context or metric on the installed definition');
 assert.match(executable,/must be read-only/,'the postcondition proves the installed definition is non-mutating');
});

test('S3 - anti-vacuity: the real guard rejects every named drift fixture',()=>{
 const drifts=[
  ['a second context kind was activated',executable.replace("WHERE b.context_kind='SITUATION'","WHERE b.context_kind=ANY(ARRAY['SITUATION','GOAL'])")],
  ['a second metric was activated',executable.replace("ARRAY['hse.stress']","ARRAY['hse.stress','hse.motivation']")],
  ['the callable surface gained a caller-supplied context id',executable.replace('CREATE FUNCTION public.read_him_session_situation_stress_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_situation_stress_v1(p_user_id uuid,p_session_id uuid,p_context_id uuid)')],
  ['the QHIA-006 authority was bypassed for a direct table read',executable.replace('FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b','FROM public.him_session_context_bindings b')],
  ['the QHIA-004 authority was bypassed for the canonical latest authority',executable.replace("FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'SITUATION',bound_situation::text,ARRAY['hse.stress'],ARRAY[1]) c","FROM public.read_him_latest_measurement_v1(p_user_id,'hse.stress',1,'SITUATION',bound_situation::text) c")],
  ['a latest-Situation fallback replaced the authoritative binding filter',executable.replace("WHERE b.context_kind='SITUATION'",'ORDER BY b.created_at DESC LIMIT 1')],
  ['the unbound no-effect answer was removed',executable.replace("'NO_ACTIVE_SITUATION'::text","'UNKNOWN'::text")],
  ['the ambiguity guard was removed',executable.replace("IF cardinality(situations)>1 THEN RAISE EXCEPTION 'Ambiguous ACTIVE Situation relevance binding' USING ERRCODE='55000';END IF;",'')],
  ['the composition took privilege of its own',executable.replace("LANGUAGE plpgsql STABLE SET search_path=''","LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''")],
  ['a service_role grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT EXECUTE ON FUNCTION '+FUNCTION_SIGNATURE+' TO service_role;')],
  ['a direct table grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT SELECT ON public.him_session_context_bindings TO authenticated;')],
  ['authentication was re-implemented instead of delegated',executable.replace('DECLARE situations uuid[];bound_situation uuid;','DECLARE situations uuid[];bound_situation uuid;u uuid:=auth.uid();')],
  ['a mutation appeared in the read path',executable.replace('bound_situation:=situations[1];','bound_situation:=situations[1];\n UPDATE public.him_session_context_bindings SET status=status;')],
  ['the fixed search_path was dropped',executable.replace("LANGUAGE plpgsql STABLE SET search_path=''",'LANGUAGE plpgsql STABLE')],
  ['the installed-definition privilege postcondition was weakened',executable.replace('IF p.prosecdef THEN RAISE EXCEPTION','IF false THEN RAISE EXCEPTION')],
 ];
 for(const[label,mutated]of drifts){
  assert.notEqual(mutated,executable,`the "${label}" mutation actually replaced its source text`);
  assert.throws(()=>assertSituationStressAuthorityContract(mutated),/QHIA-007 situation-stress authority contract violated/,`the guard rejects: ${label}`);
 }
 // Positive control and formatting-insensitivity: cosmetic whitespace never
 // fails the guard.
 assert.doesNotThrow(()=>assertSituationStressAuthorityContract(executable));
 const reformatted=executable.replace('BEGIN;','BEGIN;\n');
 assert.notEqual(reformatted,executable,'the cosmetic rewrite actually changed the text');
 assert.doesNotThrow(()=>assertSituationStressAuthorityContract(reformatted),'formatting alone never fails the guard');
});

test('S4 - the guard creates no future ceiling and weakens no prior verification',()=>{
 const listing=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql'));
 assert.doesNotThrow(()=>assertMigrationIdentity([...listing,`${NEXT_MIGRATION_NUMBER}_a_future_migration.sql`,'0099_a_much_later_migration.sql']),'future migrations are legal');
 assert.ok(!executable.includes(NEXT_MIGRATION_NUMBER),'0056 freezes no next-migration number');
 assert.ok(!verifier.includes(NEXT_MIGRATION_NUMBER),'the 0056 verifier freezes no next-migration number');
 for(const source of[executable,verifier]){
  assert.doesNotMatch(source,/(?:!==|===|<>|=)\s*17\b/,'no global metric count is frozen');
  assert.doesNotMatch(source,/is the last migration|can never exist|must never exist/i,'no permanent existence ceiling is stated');
 }
 // The prior tasks' own artifacts are preserved untouched.
 const files=readdirSync(root);
 for(const preserved of['verify-migration-0054.mjs','verify-migration-0055.mjs'])assert.ok(files.includes(preserved),`the ${preserved} verifier is preserved`);
 for(const preserved of['him-contextual-current-intelligence-batch-read','him-session-context-binding-relevance-v1.test.mjs']){
  if(preserved.endsWith('.mjs'))assert.ok(readdirSync(new URL('tests/',root)).includes(preserved),`the ${preserved} contract is preserved`);
 }
 assert.ok(readdirSync(new URL('migrations/',root)).includes('0054_him_contextual_current_intelligence_batch_read_v1.sql'),'migration 0054 is preserved');
 assert.ok(readdirSync(new URL('migrations/',root)).includes('0055_him_session_context_binding_relevance_v1.sql'),'migration 0055 is preserved');
});

test('the 0056 verifier proves the required live-schema scenarios on a real connection and stays non-destructive',()=>{
 for(const proof of[
  'to_regprocedure','pg_get_functiondef','has_function_privilege','prosecdef','provolatile','pronargs',
  'read_him_session_situation_stress_v1','set_him_session_context_binding_v1','clear_him_session_context_binding_v1',
  'read_him_contextual_current_intelligence_batch_v1','read_him_latest_measurement_v1','him_active_structured_binding_id',
  'create_him_motivation_measurement_target','create_hse_stress_measurement','calculate_hse_stress_measurement',
  'NO_ACTIVE_SITUATION','ACTIVE_SITUATION_BOUND','cleanupVerifierUsers',
 ])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 assert.match(verifier,/SET LOCAL ROLE authenticated/,'authority evidence uses a real authenticated identity');
 assert.match(verifier,/SET LOCAL ROLE anon/,'anon exclusion is exercised');
 assert.match(verifier,/SET LOCAL ROLE service_role/,'service_role exclusion is exercised');
 assert.match(verifier,/new Client\(\{connectionString:process\.env\.DATABASE_URL\}\)/,'the verifier opens a real PostgreSQL connection');
 assert.match(verifier,/await client\.query\('ROLLBACK'\)/,'transactional fixtures roll back');
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings|UPDATE public\.him_metric_definitions/,'the verifier mutates no measurement history');
});

test('the 0056 verifier is wired after the 0055 binding verifier and before the downstream HIM consumption gates',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-situation-stress-foreground-consumption:integration'],/--env-file-if-exists=\.env database\/verify-migration-0056\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-situation-stress-foreground-consumption:integration');
 assert.ok(step>0,'CI runs the 0056 verifier');
 assert.ok(step>ci.indexOf('verify:him-session-context-binding:integration'),'it runs after the 0055 binding verifier');
 assert.ok(step>ci.indexOf('verify:him-contextual-current-intelligence-batch:integration'),'it runs after the 0054 batch verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
 for(const preserved of['verify:him-session-context-binding:integration','verify:him-contextual-current-intelligence-batch:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration'])assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the prior gate ${preserved} is preserved`);
});
