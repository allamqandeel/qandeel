import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIA-006 static contract. Freezes the 0055 migration's OWN authority
// contract: public.him_session_context_bindings is the separate explicit
// Runtime relevance substrate - an authenticated exact binding between one
// owned conversation session and one exact owned cross-context measurement
// target - with an append-only protected lifecycle, one-ACTIVE-per-
// session-per-kind cardinality, authenticated-only narrow commands, and zero
// inference of relevance from conversation text, providers, labels, or any
// latest/first/only-target fallback.
//
// Forward-safe under the QHIM-002 policy: nothing here forbids a later
// migration, a later separately reviewed Runtime consumer of these bindings,
// or any future activation task. Every assertion runs against the 0055
// migration text itself (or this task's own wiring), never against the global
// schema, catalog, or function namespace.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0055_him_session_context_binding_relevance_v1.sql';
const MIGRATION_NUMBER=Number(MIGRATION.slice(0,4));
// Computed rather than written literally, so this contract can name "the next
// migration number" as a thing it must NOT freeze without itself containing it.
const NEXT_MIGRATION_NUMBER=String(MIGRATION_NUMBER+1).padStart(4,'0');
const sql=read(`migrations/${MIGRATION}`);
const verifier=read('verify-migration-0055.mjs');
// Every negative rule runs against executable SQL only: prose comments may
// legitimately name a concept while documenting its absence.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
// The migration's own final postcondition names forbidden substrate
// identifiers as DATA to prove their absence from installed definitions; the
// substrate-isolation negatives therefore run on the slice BEFORE it.
const postconditionStart=executable.lastIndexOf('DO $$DECLARE fn text');
assert.ok(postconditionStart>0,'the migration carries its installed-definition postcondition');
const authoritySlice=executable.slice(0,postconditionStart);

// Amendment 1 (lifecycle chronology). The two mutation authorities must derive
// every write-driving lifecycle timestamp AFTER the per-user/session/kind
// advisory serialization lock. A timestamp frozen at function entry survives a
// lost lock race and is then written as a retirement or creation instant that
// precedes history the winner already committed - append-only authority
// history that is version-correct but chronologically reversed. This is a
// POSITIONAL property, not a pattern one, so it is checked by slicing each
// function body out of the migration text and comparing the first advisory
// lock against the first database clock read.
const MUTATION_FUNCTIONS=['set_him_session_context_binding_v1','clear_him_session_context_binding_v1'];
const functionBodyOf=(text,name)=>{
 const start=text.indexOf(`CREATE FUNCTION public.${name}(`);
 if(start<0)return undefined;
 const end=text.indexOf('END$$;',start);
 return end<0?undefined:text.slice(start,end+'END$$;'.length);
};
function assertSerializedLifecycleClock(text){
 for(const name of MUTATION_FUNCTIONS){
  const body=functionBodyOf(text,name);
  if(body===undefined)throw new Error(`QHIA-006 binding authority contract violated: the mutation authority ${name} is missing`);
  const lockAt=body.indexOf('pg_advisory_xact_lock'),clockAt=body.indexOf('clock_timestamp');
  if(lockAt<0)throw new Error(`QHIA-006 binding authority contract violated: ${name} does not serialize under the advisory lock`);
  if(clockAt<0)throw new Error(`QHIA-006 binding authority contract violated: ${name} derives no database lifecycle time`);
  if(clockAt<lockAt)throw new Error(`QHIA-006 binding authority contract violated: ${name} captures a lifecycle timestamp before the serialization lock`);
 }
}

// The single guard the anti-vacuity fixtures below drive. It receives one
// comment-stripped migration text and throws on the first violated
// architectural property, so "the guard catches drift X" is proven by running
// the real guard over a mutated text - never by re-deriving the expectation.
const REQUIRED=[
 [/CREATE TABLE public\.him_session_context_bindings\(/,'the separate relevance substrate is created'],
 [/context_kind=ANY\(ARRAY\['GOAL','SITUATION','DECISION','RELATIONSHIP'\]\)/,'exactly the four cross-context kinds are bound'],
 [/CHECK\(binding_version>0\)/,'binding_version is bound positive'],
 [/status=ANY\(ARRAY\['ACTIVE','RETIRED'\]\)/,'the lifecycle status bound is exactly ACTIVE/RETIRED'],
 [/binding_source='EXPLICIT_AUTHENTICATED_CONTEXT_BINDING'/,'the explicit authenticated source constant is pinned'],
 [/canonical_provenance='QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1'/,'the canonical provenance constant is pinned'],
 [/CHECK\(\(status='RETIRED'\)=\(retired_at IS NOT NULL\)\)/,'ACTIVE/RETIRED timestamp coherence is bound'],
 [/CONSTRAINT him_session_context_binding_chronology_check CHECK\(retired_at IS NULL OR retired_at>=created_at\)/,'row-level lifecycle chronology is bound'],
 [/transition_at:=GREATEST\(clock_timestamp\(\),latest_lifecycle_at\)/,'the lifecycle instant is derived from the database clock and the existing history endpoint'],
 [/SET status='RETIRED',retired_at=transition_at/,'retirement writes the serialized lifecycle instant'],
 [/'EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',transition_at,NULL/,'a new version is created at the serialized lifecycle instant'],
 [/UNIQUE\(user_id,conversation_session_id,context_kind,binding_version\)/,'per-session/kind version history uniqueness is bound'],
 [/CREATE UNIQUE INDEX him_one_active_session_context_binding ON public\.him_session_context_bindings\(user_id,conversation_session_id,context_kind\) WHERE status='ACTIVE'/,'at most one ACTIVE binding per user/session/kind'],
 [/FOREIGN KEY\(conversation_session_id,user_id\) REFERENCES public\.conversation_sessions\(id,user_id\) ON DELETE RESTRICT/,'the composite RESTRICT FK to exact conversation session ownership'],
 [/FOREIGN KEY\(context_id,user_id,context_kind\) REFERENCES public\.him_measurement_targets\(id,user_id,context_kind\) ON DELETE RESTRICT/,'the composite RESTRICT FK to the exact target owner+kind identity'],
 [/ALTER TABLE public\.him_session_context_bindings ENABLE ROW LEVEL SECURITY/,'RLS is enabled on the substrate'],
 [/REVOKE ALL ON public\.him_session_context_bindings FROM PUBLIC,anon,authenticated,service_role;/,'no request role receives direct table DML or SELECT'],
 [/IF TG_OP='DELETE' THEN RAISE EXCEPTION/,'the lifecycle guard always rejects DELETE'],
 [/qandeel\.session_context_binding_transition/,'the lifecycle guard requires internal transition authorization'],
 [/OLD\.status<>'ACTIVE' OR NEW\.status<>'RETIRED' OR NEW\.retired_at IS NULL/,'only ACTIVE to RETIRED with a database-owned retirement time is permitted'],
 [/\(to_jsonb\(OLD\)-'status'-'retired_at'\)<>\(to_jsonb\(NEW\)-'status'-'retired_at'\)/,'every non-lifecycle column must be unchanged through the transition'],
 [/CREATE FUNCTION public\.set_him_session_context_binding_v1\(p_user_id uuid,p_session_id uuid,p_context_kind text,p_context_id uuid\)/,'the exact set command signature'],
 [/CREATE FUNCTION public\.clear_him_session_context_binding_v1\(p_user_id uuid,p_session_id uuid,p_context_kind text\)/,'the exact clear command signature'],
 [/CREATE FUNCTION public\.read_him_session_context_bindings_v1\(p_user_id uuid,p_session_id uuid\)/,'the exact one-request read signature'],
 [/STABLE SECURITY DEFINER/,'the read is STABLE'],
 [/pg_advisory_xact_lock/,'set/clear serialize under a per-user/session/kind advisory transaction lock'],
 [/IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'/,'unauthenticated callers fail closed'],
 [/IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Session context bindings are owner-exact'/,'commands are owner-exact'],
 [/array_position\(ARRAY\['GOAL','SITUATION','DECISION','RELATIONSHIP'\],b\.context_kind\)/,'the read returns the canonical fixed kind order'],
 [/GRANT EXECUTE ON FUNCTION public\.set_him_session_context_binding_v1\(uuid,uuid,text,uuid\),public\.clear_him_session_context_binding_v1\(uuid,uuid,text\),public\.read_him_session_context_bindings_v1\(uuid,uuid\) TO authenticated;/,'authenticated is the only EXECUTE grantee'],
];
const FORBIDDEN=[
 [/CONVERSATION_SESSION/,'CONVERSATION_SESSION can never be an explicit cross-context binding kind'],
 [/\bGLOBAL\b/,'GLOBAL can never be an explicit cross-context binding kind'],
 [/display_text/,'no target display text is read, stored, or returned as relevance data'],
 [/embedding|similarity|classif|semantic_match|vector|openai|anthropic|\bllm\b|\bprompt\b|free[_-]?text/i,'no provider, model, embedding, classifier, or free-text relevance logic exists'],
 [/confidence|relevance_score|relevance_weight/i,'no confidence, score, or inferred relevance weight exists'],
 [/INSERT\s+INTO\s+public\.(?!him_session_context_bindings)/i,'the migration inserts into nothing but its own substrate'],
 [/UPDATE\s+public\.(?!him_session_context_bindings)/i,'the migration updates nothing but its own protected lifecycle'],
 [/DELETE\s+FROM/i,'the migration deletes nothing'],
 [/DROP\s+(TABLE|FUNCTION|VIEW|CONSTRAINT|TRIGGER|POLICY)/i,'the migration drops nothing'],
 [/TRUNCATE|COPY\s+public\./i,'the migration rewrites no durable data'],
 [/ALTER\s+TABLE\s+public\.(?!him_session_context_bindings)/i,'no other table - him_measurement_targets included - gains a column, constraint, trigger, or policy'],
 [/ORDER\s+BY[^;]*created_at/i,'creation recency never becomes relevance priority'],
 [/LIMIT\s+1/i,'no latest/first/only-target selection exists'],
 [/GRANT[^;]*\b(anon|PUBLIC|service_role)\b/,'anon, PUBLIC, and service_role are granted nothing'],
 [/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*ON\s+public\.him_session_context_bindings/i,'no direct table privilege is granted to anyone'],
];
function assertBindingAuthorityContract(text){
 for(const[pattern,property]of REQUIRED)if(!pattern.test(text))throw new Error(`QHIA-006 binding authority contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN)if(pattern.test(text))throw new Error(`QHIA-006 binding authority contract violated: ${property}`);
 assertSerializedLifecycleClock(text);
}
// The migration-identity rules, factored so forward-safety can be proven by
// running the real rules over a listing that already contains future
// migrations.
function assertMigrationIdentity(names){
 const migrations=[...names].sort();
 assert.ok(migrations.includes(MIGRATION),'migration 0055 exists');
 for(let n=1;n<=MIGRATION_NUMBER;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0054_him_contextual_current_intelligence_batch_read_v1.sql'),'0055 orders after 0054');
}

test('S1 - migration 0055 creates only the intended relevance substrate and satisfies the frozen authority contract',()=>{
 assertMigrationIdentity(readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')));
 assert.doesNotThrow(()=>assertBindingAuthorityContract(executable),'the shipped migration satisfies the frozen contract');
 // Exactly the intended objects: one table, one partial unique index, one
 // lifecycle guard trigger, and four functions (guard + set + clear + read) -
 // a count of this migration's own text, never of the live namespace.
 assert.equal((executable.match(/CREATE TABLE/g)??[]).length,1,'exactly one new table');
 assert.equal((executable.match(/CREATE UNIQUE INDEX/g)??[]).length,1,'exactly one new index');
 assert.equal((executable.match(/CREATE TRIGGER/g)??[]).length,1,'exactly one new trigger');
 assert.equal((executable.match(/CREATE FUNCTION/g)??[]).length,4,'exactly the guard, set, clear, and read functions');
 assert.doesNotMatch(executable,/CREATE (OR REPLACE )?(VIEW|POLICY|ROLE|SCHEMA|EXTENSION)/,'no view, policy, role, schema, or extension is created');
 // The write command receives exact IDs, not prose: every parameter of all
 // three commands is a uuid or the frozen kind, and no text payload column
 // exists on the substrate.
 assert.doesNotMatch(executable,/p_display|p_label|p_text|p_reason|p_prose/,'no free-text command parameter exists');
});

test('S2 - hard authority rule: relevance comes only from the explicit authenticated exact binding',()=>{
 // Ownership and runtime-state validation is exact and fail-closed.
 assert.match(executable,/FROM public\.conversation_sessions s WHERE s\.id=p_session_id AND s\.user_id=u/,'the session must exist and belong exactly to the caller');
 assert.match(executable,/RAISE EXCEPTION 'Unknown or cross-user conversation session'/,'unknown and cross-user sessions are indistinguishable');
 assert.match(executable,/RAISE EXCEPTION 'Conversation session is not active'/,'an owned inactive session is a distinct bounded runtime-state error');
 assert.match(executable,/WHERE t\.id=p_context_id AND t\.user_id=u AND t\.context_kind=p_context_kind/,'the target must exist exactly as (id, owner, kind)');
 assert.match(executable,/RAISE EXCEPTION 'Unknown, cross-user, or wrong-kind measurement target'/,'unknown, cross-user, and wrong-kind targets fail closed without substitution');
 // Idempotent same-target replay and monotonic replacement are both explicit.
 assert.match(executable,/IF has_active AND existing\.context_id=p_context_id THEN RETURN NEXT existing;RETURN;END IF;/,'repeating the same exact target returns the existing ACTIVE row untouched');
 // Amendment 1: the same-target idempotent path returns BEFORE any clock is
 // read, so a repeated identical binding is provably timestamp-neutral rather
 // than merely "not written".
 const setBody=functionBodyOf(executable,'set_him_session_context_binding_v1');
 assert.ok(setBody!==undefined,'the set authority body is extractable');
 assert.ok(setBody.indexOf('RETURN NEXT existing')<setBody.indexOf('clock_timestamp'),'the idempotent same-target return happens before any lifecycle clock is read');
 // The active-row test is captured into an explicit boolean, because the
 // intervening aggregate SELECT INTO would otherwise reset plpgsql FOUND and
 // make the retirement branch fire on a non-existent row.
 assert.match(executable,/has_active:=FOUND;/,'the ACTIVE-row test is captured before any later SELECT INTO can reset FOUND');
 assert.match(executable,/coalesce\(max\(b\.binding_version\),0\)\+1/,'replacement assigns the next monotonic version');
 // Server-derived identity only: uuid, source, provenance, and created_at all
 // originate inside the command.
 assert.match(executable,/VALUES\(gen_random_uuid\(\),u,p_session_id,p_context_kind,p_context_id,next_version,'ACTIVE','EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',transition_at,NULL,'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1'\)/,'the inserted row is fully server-derived');
 // The clear command is idempotent and never deletes history.
 assert.match(executable,/IF NOT FOUND THEN RETURN;END IF;/,'clearing an already-clear kind writes nothing and returns zero rows');
 // The only session mutation authority in this migration is none: sessions
 // are read, never written.
 assert.doesNotMatch(authoritySlice,/UPDATE public\.conversation_sessions|INSERT INTO public\.conversation_sessions/,'the commands never mutate the session');
 // The substrate-isolation slice (everything before the final
 // installed-definition postcondition, which names forbidden identifiers as
 // data) references no Measurement Foundation substrate beyond the target
 // ownership identity.
 assert.doesNotMatch(authoritySlice,/him_metric_snapshots|him_metric_definitions|him_calculation_models|him_calculation_results|him_canonical_model_bindings|him_measurement_events|him_measurement_observations|him_current_structured_measurements|him_governance_approvals|him_scale_contracts/,'no measurement definition, model, event, observation, snapshot, or binding substrate is touched');
 assert.match(executable,/position\(forbidden in def\)>0/,'the postcondition proves the forbidden-substrate absence on the INSTALLED definitions');
 assert.match(executable,/request\.jwt/,'the postcondition proves no JWT reconstruction on the installed definitions');
});

test('S2b - Amendment 1: lifecycle timestamps are derived after serialization, and the guard rejects a pre-lock capture',()=>{
 // The shipped migration satisfies the positional rule in both mutation
 // authorities.
 assert.doesNotThrow(()=>assertSerializedLifecycleClock(executable),'both mutation authorities derive lifecycle time after the advisory lock');
 for(const name of MUTATION_FUNCTIONS){
  const body=functionBodyOf(executable,name);
  assert.ok(body.indexOf('pg_advisory_xact_lock')<body.indexOf('clock_timestamp'),`${name} serializes before it reads the clock`);
  // No write-driving timestamp survives in the DECLARE section.
  const declareSection=body.slice(0,body.indexOf('BEGIN'));
  assert.doesNotMatch(declareSection,/clock_timestamp|now\(\)|CURRENT_TIMESTAMP/i,`${name} freezes no lifecycle time at function entry`);
  assert.match(body,/transition_at:=GREATEST\(clock_timestamp\(\),latest_lifecycle_at\)/,`${name} derives its instant from the clock and the existing history endpoint`);
  assert.match(body,/max\(GREATEST\(b\.created_at,b\.retired_at\)\)/,`${name} resolves the latest prior lifecycle endpoint under the lock`);
 }
 // Client/application time is never an input to lifecycle chronology.
 assert.doesNotMatch(executable,/p_now|p_created_at|p_retired_at|p_timestamp|p_client/i,'no caller-supplied time parameter exists');
 // The migration proves the same positional property on the INSTALLED
 // definitions, so a later CREATE OR REPLACE cannot silently regress it.
 assert.match(executable,/strpos\(def,'clock_timestamp'\)<strpos\(def,'pg_advisory_xact_lock'\)/,'the migration postcondition proves lock-before-clock on the installed definitions');
 assert.match(executable,/him_session_context_binding_chronology_check/,'the migration postcondition proves the chronology constraint exists');

 // Anti-vacuity: reintroducing the exact QHIA-006 pre-amendment defect - a
 // lifecycle timestamp captured in the DECLARE section, before the advisory
 // lock - must be REJECTED by the real guard, in each mutation authority
 // independently.
 const preLockDrifts=[
  ['set captures its lifecycle time at function entry (the original defect)',
   executable.replace('next_version integer;latest_lifecycle_at timestamptz;transition_at timestamptz;','next_version integer;latest_lifecycle_at timestamptz;transition_at timestamptz:=clock_timestamp();')],
  ['clear captures its lifecycle time at function entry (the original defect)',
   executable.replace('retired public.him_session_context_bindings;latest_lifecycle_at timestamptz;transition_at timestamptz;','retired public.him_session_context_bindings;latest_lifecycle_at timestamptz;transition_at timestamptz:=clock_timestamp();')],
 ];
 for(const[label,mutated]of preLockDrifts){
  assert.notEqual(mutated,executable,`the "${label}" mutation actually replaced its source text`);
  assert.throws(()=>assertSerializedLifecycleClock(mutated),/captures a lifecycle timestamp before the serialization lock/,`the guard rejects: ${label}`);
  assert.throws(()=>assertBindingAuthorityContract(mutated),/QHIA-006 binding authority contract violated/,`the full contract rejects: ${label}`);
 }
 // A mutation authority that drops serialization entirely, or stops deriving
 // a database time at all, is also rejected.
 const noLock=executable.replace("PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':session-context-binding:'||p_session_id::text||':'||p_context_kind,0));",'');
 assert.notEqual(noLock,executable,'the removed-lock mutation actually replaced its source text');
 assert.throws(()=>assertSerializedLifecycleClock(noLock),/does not serialize under the advisory lock/,'the guard rejects a mutation authority that stops serializing');
 const noClock=executable.replaceAll('transition_at:=GREATEST(clock_timestamp(),latest_lifecycle_at);','transition_at:=latest_lifecycle_at;');
 assert.notEqual(noClock,executable,'the removed-clock mutation actually replaced its source text');
 assert.throws(()=>assertSerializedLifecycleClock(noClock),/derives no database lifecycle time/,'the guard rejects a mutation authority that derives no database time');
});

test('S3 - anti-vacuity: the real guard rejects every named drift fixture',()=>{
 const drifts=[
  ['CONVERSATION_SESSION smuggled into the kind bound',executable.replace("ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP']))","ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP','CONVERSATION_SESSION']))")],
  ['the one-ACTIVE cardinality index dropped its partial predicate',executable.replace("(user_id,conversation_session_id,context_kind) WHERE status='ACTIVE'",'(user_id,conversation_session_id,context_kind,binding_version)')],
  ['the session FK weakened to CASCADE',executable.replace('REFERENCES public.conversation_sessions(id,user_id) ON DELETE RESTRICT','REFERENCES public.conversation_sessions(id,user_id) ON DELETE CASCADE')],
  ['the target FK dropped the exact kind identity',executable.replace('REFERENCES public.him_measurement_targets(id,user_id,context_kind) ON DELETE RESTRICT','REFERENCES public.him_measurement_targets(id) ON DELETE RESTRICT')],
  ['a service_role grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT EXECUTE ON FUNCTION public.set_him_session_context_binding_v1(uuid,uuid,text,uuid) TO service_role;')],
  ['a direct table grant appeared',executable.replace('ALTER TABLE public.him_session_context_bindings ENABLE ROW LEVEL SECURITY;','ALTER TABLE public.him_session_context_bindings ENABLE ROW LEVEL SECURITY;\nGRANT SELECT ON public.him_session_context_bindings TO authenticated;')],
  ['the source constant strengthened into an inference claim',executable.replaceAll('EXPLICIT_AUTHENTICATED_CONTEXT_BINDING','INFERRED_RELEVANCE')],
  ['a latest-target fallback appeared in the read',executable.replace("ORDER BY array_position(ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP'],b.context_kind)",'ORDER BY b.created_at DESC LIMIT 1')],
  ['the lifecycle guard stopped rejecting DELETE',executable.replace("IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Session context binding history is immutable' USING ERRCODE='55000';END IF;",'')],
  ['a target text read appeared in a command',executable.replace('WHERE t.id=p_context_id AND t.user_id=u AND t.context_kind=p_context_kind','WHERE t.id=p_context_id AND t.user_id=u AND t.context_kind=p_context_kind AND t.display_text IS NOT NULL')],
  ['the row-level chronology CHECK was dropped',executable.replace(' CONSTRAINT him_session_context_binding_chronology_check CHECK(retired_at IS NULL OR retired_at>=created_at),','')],
  ['retirement stopped writing the serialized lifecycle instant',executable.replaceAll("SET status='RETIRED',retired_at=transition_at","SET status='RETIRED',retired_at=clock_timestamp()")],
 ];
 for(const[label,mutated]of drifts){
  assert.notEqual(mutated,executable,`the ${label} mutation actually replaced its source text`);
  assert.throws(()=>assertBindingAuthorityContract(mutated),/QHIA-006 binding authority contract violated/,`the guard rejects: ${label}`);
 }
 // Positive control and formatting-insensitivity: cosmetic whitespace never
 // fails the guard.
 assert.doesNotThrow(()=>assertBindingAuthorityContract(executable));
 const reformatted=executable.replace('CREATE TABLE public.him_session_context_bindings(','CREATE TABLE public.him_session_context_bindings(\n');
 assert.notEqual(reformatted,executable,'the cosmetic rewrite actually changed the text');
 assert.doesNotThrow(()=>assertBindingAuthorityContract(reformatted),'formatting alone never fails the guard');
});

test('S4 - the guard creates no future ceiling',()=>{
 const listing=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql'));
 assert.doesNotThrow(()=>assertMigrationIdentity([...listing,`${NEXT_MIGRATION_NUMBER}_a_future_migration.sql`,'0099_a_much_later_migration.sql']),'future migrations are legal');
 assert.ok(!executable.includes(NEXT_MIGRATION_NUMBER),'0055 freezes no next-migration number');
 assert.ok(!verifier.includes(NEXT_MIGRATION_NUMBER),'the 0055 verifier freezes no next-migration number');
 for(const source of[executable,verifier]){
  assert.doesNotMatch(source,/(?:!==|===|<>|=)\s*17\b/,'no global metric count is frozen');
  assert.doesNotMatch(source,/is the last migration|can never exist|must never exist/i,'no permanent existence ceiling is stated');
 }
 // A future separately reviewed consumer stays legal: nothing asserts the
 // permanent absence of later readers of this substrate, and the verifier
 // proves absences only on this migration's own installed objects.
 assert.doesNotMatch(verifier,/to_regprocedure\([^)]*\)\s*(?:!==|===)\s*null[^;]*future/i,'the verifier asserts no future-function absence');
});

test('the 0055 verifier proves the required live-schema scenarios on real independent connections and stays non-destructive',()=>{
 for(const proof of['to_regprocedure','pg_get_functiondef','has_function_privilege','has_table_privilege','relrowsecurity','pg_get_constraintdef','him_one_active_session_context_binding','create_him_motivation_measurement_target','create_him_relationship_measurement_target_v1','read_him_latest_measurement_v1','read_him_contextual_current_intelligence_batch_v1','qandeel.session_context_binding_transition','cleanupVerifierUsers'])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 // Amendment 1: the verifier must prove lifecycle chronology, not merely that
 // retired_at is non-null.
 for(const proof of['him_session_context_binding_chronology_check','assertChronology','waitForConflictingAdvisoryLock','pg_locks'])assert.ok(verifier.includes(proof),`the verifier proves lifecycle chronology through ${proof}`);
 assert.match(verifier,/clockAt<lockAt/,'the verifier deterministically rejects a pre-lock lifecycle capture on the installed definitions');
 assert.match(verifier,/version-correct but time-reversed history/,'the verifier explicitly rejects version-correct but time-reversed history');
 assert.match(verifier,/at\(situationHistory\[1\]\.created_at\)<at\(situationHistory\[0\]\.retired_at\)/,'the real concurrent different-target race asserts forward chronology');
 assert.match(verifier,/chronoHistory/,'the deterministic blocked-replacement race asserts forward chronology');
 assert.match(verifier,/SET LOCAL ROLE authenticated/,'authority evidence uses a real authenticated identity');
 assert.match(verifier,/SET LOCAL ROLE anon/,'anon exclusion is exercised');
 assert.match(verifier,/SET LOCAL ROLE service_role/,'service_role exclusion is exercised');
 assert.match(verifier,/new Client\(\{connectionString:process\.env\.DATABASE_URL\}\)/,'the verifier opens real PostgreSQL connections');
 assert.match(verifier,/Promise\.all\(\[\s*raceClient/,'concurrency runs on independent connections in parallel');
 assert.match(verifier,/await client\.query\('ROLLBACK'\)/,'transactional fixtures roll back');
 assert.match(verifier,/DELETE FROM public\.him_session_context_bindings WHERE user_id=ANY/,'committed race fixtures are removed completely');
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings|UPDATE public\.him_metric_definitions/,'the verifier mutates no measurement history');
});

test('the 0055 verifier is wired after the 0054 batch verifier and before the downstream HIM consumption gates',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-session-context-binding:integration'],/--env-file-if-exists=\.env database\/verify-migration-0055\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-session-context-binding:integration');
 assert.ok(step>0,'CI runs the 0055 verifier');
 assert.ok(step>ci.indexOf('verify:him-contextual-current-intelligence-batch:integration'),'it runs after the 0054 batch verifier');
 assert.ok(step>ci.indexOf('verify:him-canonical-latest-measurement-read-semantics:integration'),'it runs after the 0052 canonical-latest verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
 for(const preserved of['verify:him-contextual-current-intelligence-batch:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration'])assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the prior gate ${preserved} is preserved`);
 assert.ok(readdirSync(root).includes('verify-migration-0054.mjs'),'the 0054 verifier is preserved');
});
