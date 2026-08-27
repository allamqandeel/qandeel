import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIM-005 / QHIM-007 static contract. Freezes the canonical latest
// measurement read semantics: one database-owned, definition-exact,
// context-authorized, event-chronology read authority with no raw-history
// fallback. Forward-safe under the QHIM-002 policy: nothing here forbids a
// later migration, a later metric version, a future context kind, or any
// separately reviewed future function.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0052_him_canonical_latest_measurement_read_semantics_v1.sql';
const sql=read(`migrations/${MIGRATION}`);
// Prose comments legitimately describe the removed defect (including the
// retired snapshot-version ordering), so every negative rule runs against
// executable SQL only, and the RPC-body rules run against the function body
// alone because the migration's own postcondition names 'snapshot_version'
// as data while proving its absence.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const fnBody=executable.slice(executable.indexOf('CREATE FUNCTION public.read_him_latest_measurement_v1'),executable.indexOf('REVOKE ALL ON FUNCTION public.read_him_latest_measurement_v1'));
const repository=read('../apps/api/src/human-model/him.repository.ts');
const service=read('../apps/api/src/human-model/him.service.ts');
const verifier=read('verify-migration-0052.mjs');

test('0052 exists exactly once after 0051 and edits no earlier migration',()=>{
 // Historical phase guarantee only: this contract owns 0052's identity and
 // ordering, never a ceiling on later migrations. Nothing asserts that 0052
 // is the last migration or that 0053 may not exist.
 const migrations=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes(MIGRATION));
 assert.equal(migrations.filter(name=>name.startsWith('0052')).length,1,'exactly one migration 0052');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0051_him_legacy_snapshot_authority_energy_context_reconciliation_v1.sql'));
 for(let n=1;n<=51;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
});

test('the canonical latest RPC exists with the exact definition-versioned identity and safe properties',()=>{
 assert.match(executable,/CREATE FUNCTION public\.read_him_latest_measurement_v1\(p_user_id uuid,p_metric_key text,p_definition_version integer,p_context_kind text,p_context_id text\)/,'the RPC takes the exact five-part identity including the definition version');
 assert.match(executable,/RETURNS SETOF public\.him_metric_snapshots/,'the RPC returns canonical snapshot rows');
 assert.match(fnBody,/STABLE SECURITY DEFINER SET search_path=''/,'the RPC is a stable definer with a fixed empty search_path');
 assert.doesNotMatch(fnBody,/EXECUTE\s+format|EXECUTE\s+'/i,'the RPC runs no dynamic SQL');
 assert.doesNotMatch(fnBody,/set_config|request\.jwt/,'the RPC reconstructs no JWT');
 assert.doesNotMatch(fnBody,/INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|TRUNCATE\s/i,'the RPC writes no state');
});

test('the RPC checks authenticated exact-user authority and fails closed',()=>{
 assert.match(fnBody,/u uuid:=auth\.uid\(\)/,'caller identity comes from auth.uid()');
 assert.match(fnBody,/IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'/,'unauthenticated calls fail closed');
 assert.match(fnBody,/IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION/,'a caller may not read another user by supplying a different p_user_id');
 assert.match(fnBody,/IF NOT owned THEN RAISE EXCEPTION 'Unknown or unowned HIM measurement context' USING ERRCODE='42501'/,'unknown and cross-user contexts fail closed');
});

test('the RPC resolves the exact persisted definition and its valid_context_kinds authority',()=>{
 assert.match(fnBody,/FROM public\.him_metric_definitions d WHERE d\.metric_key=p_metric_key AND d\.definition_version=p_definition_version/,'the exact persisted definition is the eligibility authority');
 assert.match(fnBody,/IF NOT FOUND THEN RAISE EXCEPTION 'Unknown exact HIM metric definition'/,'a missing exact definition fails closed');
 assert.match(fnBody,/NOT\(p_context_kind=ANY\(valid_kinds\)\) THEN RAISE EXCEPTION 'Unsupported context kind for the exact HIM metric definition'/,'the requested context kind must be in the exact definition');
 // Exact-version discipline: no implicit v1, no latest-version inference.
 assert.doesNotMatch(fnBody,/definition_version=1/,'the RPC pins no definition version');
 assert.doesNotMatch(fnBody,/max\(\s*(?:d\.)?definition_version\s*\)/i,'the RPC infers no latest definition version');
});

test('the RPC verifies exact context ownership on the canonical substrates',()=>{
 assert.match(fnBody,/FROM public\.conversation_sessions c WHERE c\.id::text=p_context_id AND c\.user_id=u/,'CONVERSATION_SESSION ownership uses conversation_sessions');
 assert.match(fnBody,/p_context_kind=ANY\(ARRAY\['SITUATION','DECISION','GOAL','RELATIONSHIP'\]\)/,'target-bound kinds cover all canonical target contexts');
 assert.match(fnBody,/FROM public\.him_measurement_targets t WHERE t\.id::text=p_context_id AND t\.user_id=u AND t\.context_kind=p_context_kind/,'target ownership is user- and kind-exact');
 assert.match(fnBody,/ELSE RAISE EXCEPTION 'Unsupported HIM context ownership authority'/,'kinds without a canonical ownership substrate fail closed');
});

test('the RPC reads through the QHIM-001 structured-current state with immutable event chronology',()=>{
 assert.match(fnBody,/FROM public\.him_current_structured_measurements cs/,'canonical latest reads through the structured-current view');
 assert.match(fnBody,/ORDER BY me\.created_at DESC,me\.id DESC LIMIT 1/,'cross-event ordering is event created_at DESC then event id DESC');
 assert.match(fnBody,/ORDER BY mo\.created_at DESC,mo\.id DESC LIMIT 1/,'same-event observation tie-breaking is deterministic');
 assert.match(fnBody,/NOT EXISTS\(SELECT 1 FROM public\.him_measurement_observations newer WHERE newer\.supersedes_observation_id=mo\.id\)/,'superseded observations never win');
 assert.match(fnBody,/eo\.metric_key=p_metric_key AND eo\.definition_version=p_definition_version/,'an event qualifies only through an observation of the exact requested definition');
 assert.match(fnBody,/cs\.measurement_event_id=lo\.measurement_event_id/,'the returned snapshot chain is anchored to the selected event');
 // The event is resolved BEFORE snapshot availability, so a newest event
 // with no current snapshot yields zero rows instead of backtracking.
 assert.ok(fnBody.indexOf('latest_event')<fnBody.indexOf('him_current_structured_measurements'),'the newest event is selected before the snapshot join');
 // No cross-event ordering by calculation/snapshot chronology of any kind.
 assert.doesNotMatch(fnBody,/snapshot_version/,'snapshot version is never used for cross-event latest ordering');
 assert.doesNotMatch(fnBody,/ORDER BY (?:cs|s)\.created_at/,'snapshot created_at is never a cross-event ordering term');
 // The migration itself proves the same fact at install time.
 assert.match(executable,/position\('snapshot_version' in def\)>0/,'the migration postcondition proves the absence of snapshot-version ordering');
});

test('the RPC authority grants are narrow and asserted by the migration',()=>{
 assert.match(executable,/REVOKE ALL ON FUNCTION public\.read_him_latest_measurement_v1\(uuid,text,integer,text,text\) FROM PUBLIC,anon,authenticated,service_role/,'every application role is revoked before the narrow grant');
 assert.match(executable,/GRANT EXECUTE ON FUNCTION public\.read_him_latest_measurement_v1\(uuid,text,integer,text,text\) TO authenticated;/,'authenticated is the only EXECUTE grantee');
 assert.doesNotMatch(executable,/GRANT EXECUTE[^;]*service_role/,'service_role receives no new grant');
 assert.doesNotMatch(executable,/GRANT (?:ALL|SELECT|INSERT|UPDATE|DELETE)/i,'0052 grants no table privilege');
 assert.match(executable,/has_function_privilege\('authenticated'/,'the migration asserts the exact final ACL');
 assert.equal((executable.match(/CREATE (?:OR REPLACE )?FUNCTION/g)??[]).length,1,'0052 defines exactly one function');
 assert.doesNotMatch(executable,/CREATE (?:OR REPLACE )?FUNCTION public\.(?!read_him_latest_measurement_v1)/,'0052 creates no other function');
});

test('0052 is narrow: no view rebuild, no new state, no history mutation, no consumption change',()=>{
 assert.doesNotMatch(executable,/CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW|CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE TRIGGER/i,'0052 rebuilds no view and creates no table, index, or trigger');
 assert.doesNotMatch(executable,/INSERT\s+INTO|DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?\w|COPY\s+public\.|DROP\s+(?:TABLE|FUNCTION|VIEW)/i,'0052 deletes, backfills, and rewrites nothing');
 assert.doesNotMatch(executable,/UPDATE public\./,'0052 updates no persisted row');
 assert.doesNotMatch(executable,/is_latest/,'latest stays a derived read - no mutable latest state');
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot|background_read_him|slots\(/,'0052 changes no Trend, Snapshot, or Runtime Consumption surface');
 assert.doesNotMatch(executable,/recommendation|safety_runtime|openai|anthropic|llm|provider|embedding/i,'0052 adds no provider, recommendation, safety, or UI surface');
 // QHIM-001 stays authoritative and untouched underneath this layer.
 const view=read('migrations/0050_him_structured_current_binding_transition_safety_v1.sql');
 assert.match(view,/SELECT DISTINCT ON\(s\.measurement_observation_id\)/,'the QHIM-001 one-row-per-observation selection is preserved');
 assert.match(view,/him_active_structured_binding_id/,'the QHIM-001 ACTIVE-binding preference is preserved');
 assert.match(view,/snapshot_version DESC/,'the legitimate within-one-observation 0050 fallback ordering is preserved');
 // QHIM-002 remains intact and QHIM-006/QHIM-008 are deliberately not
 // implemented here: the forward-compatibility contract and harness survive,
 // and 0052 names neither of them.
 assert.ok(readdirSync(new URL('tests/',root)).includes('him-historical-verifier-forward-compatibility-v1.test.mjs'),'the QHIM-002 contract is preserved');
 assert.ok(readdirSync(root).includes('verify-him-historical-verifier-forward-compatibility-v1.mjs'),'the QHIM-002 harness is preserved');
 assert.doesNotMatch(executable,/forward.compatibility|him-temporal-comparability/i,'0052 touches no QHIM-006/QHIM-008 surface');
});

test('the repository canonical getLatest is the RPC and nothing else',()=>{
 assert.match(repository,/rpc\/read_him_latest_measurement_v1/,'canonical getLatest calls the canonical RPC');
 assert.match(repository,/p_definition_version:definitionVersion/,'the exact definition version is forwarded');
 const getLatest=repository.slice(repository.indexOf('async getLatest'),repository.indexOf('listForContext'));
 assert.doesNotMatch(getLatest,/him_metric_snapshots|him_current_structured_measurements/,'canonical getLatest contains no raw-history fallback and no direct view read');
 assert.doesNotMatch(getLatest,/structuredCurrent|key==='/,'canonical getLatest contains no hard-coded structured-route expression');
 assert.doesNotMatch(repository,/snapshot_version\.desc/,'no snapshot-version latest ordering survives anywhere in the repository');
 assert.equal([...repository.matchAll(/key==='/g)].length,0,'no per-metric routing predicate survives in the repository');
 // Explicit history/audit reads stay distinct raw paths under their existing
 // authority - they are not canonical current reads and are not redesigned.
 assert.match(repository,/history\(token:string[\s\S]*?him_metric_snapshots/,'history remains an explicit raw history path');
 assert.match(repository,/snapshot_version\.asc/,'history keeps its legitimate ascending history ordering');
});

test('the service resolves the exact definition and validates context eligibility before the repository read',()=>{
 const getLatest=service.slice(service.indexOf('async getLatest'),service.indexOf('listForContext'));
 assert.match(getLatest,/this\.repository\.getDefinition\(token,key,definitionVersion\)/,'the service resolves the exact definition');
 assert.match(getLatest,/HIM metric definition not found/,'a missing definition fails closed');
 assert.match(getLatest,/validContextKinds\.includes\(kind\)/,'context eligibility is validated against the exact definition');
 assert.match(getLatest,/does not support this exact context kind/,'an unsupported context rejects before the repository latest call');
 assert.match(getLatest,/this\.repository\.getLatest\(token,userId,key,definitionVersion,kind,id\)/,'the exact definition version reaches the repository');
 assert.doesNotMatch(getLatest,/definitionVersion\s*\?\?|definitionVersion\s*\|\||definitionVersion\s*=\s*1/,'no implicit v1 default is inserted');
});

test('the 0052 verifier proves the frozen chronology scenarios against real PostgreSQL and stays forward-safe',()=>{
 for(const proof of ['read_him_latest_measurement_v1','create_hse_energy_measurement','calculate_hse_energy_measurement','correct_hse_energy_measurement','activate_him_canonical_model_binding','read_him_intelligence_snapshot_v1','cleanupVerifierUsers'])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 for(const scenario of ['event chronology','recalculation','historical fallback','correction','equal','no current snapshot','legacy','ownership'])assert.match(verifier,new RegExp(scenario,'i'),`the verifier covers the ${scenario} scenario`);
 assert.match(verifier,/has_function_privilege/,'the verifier proves the exact ACL');
 assert.match(verifier,/prosecdef/,'the verifier proves the definer/search_path properties');
 // Forward-safe under the QHIM-002 policy.
 assert.doesNotMatch(verifier,/0053/,'the 0052 verifier asserts no next-migration ceiling');
 assert.doesNotMatch(verifier,/can never exist|must never exist/i,'the 0052 verifier states no permanent existence ceiling');
 assert.doesNotMatch(verifier,/\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/,'the 0052 verifier freezes no global definition count');
 assert.doesNotMatch(verifier,/LIKE\s+'background_|proname\s+(?:I?LIKE|~)/i,'the 0052 verifier takes no function-namespace census');
 for(const literal of verifier.matchAll(/(['"`])((?:(?!\1)[\s\S])*?)\1/g))if(/FROM public\.him_metric_definitions/.test(literal[2]))assert.match(literal[2],/definition_version=1/,'every catalog read in the 0052 verifier is version scoped');
});

test('the canonical latest document states the frozen contract',()=>{
 const doc=read('../docs/him-canonical-latest-measurement-read-v1.md');
 for(const statement of ['canonical latest','history','valid_context_kinds','ownership','created_at DESC','id DESC','correction','never falls back to raw snapshot history','zero rows','Trend','Intelligence Snapshot','audit history'])assert.ok(doc.includes(statement),`the document states ${statement}`);
 assert.doesNotMatch(doc,/Runtime Consumption approval is granted|consumption is expanded/i,'the document claims no consumption approval');
});

test('the 0052 verifier is wired after the 0051 verifier and before HIM consumption checks',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-canonical-latest-measurement-read-semantics:integration'],/--env-file-if-exists=\.env database\/verify-migration-0052\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-canonical-latest-measurement-read-semantics:integration');
 assert.ok(step>0,'CI runs the 0052 verifier');
 assert.ok(step>ci.indexOf('verify:him-structured-current-binding-transition-safety:integration'),'it runs after the QHIM-001 verifier');
 assert.ok(step>ci.indexOf('verify:him-historical-verifier-forward-compatibility:integration'),'it runs after the QHIM-002 forward-compatibility verifier');
 assert.ok(step>ci.indexOf('verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration'),'it runs after the 0051 verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
});
