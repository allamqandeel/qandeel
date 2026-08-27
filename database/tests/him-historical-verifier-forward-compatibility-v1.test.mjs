import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIM-002 forward-compatibility contract.
//
// The frozen policy: historical verifier N may prove the durable artifacts and
// permanent invariants introduced or owned by migration N, but must not
// prohibit later legitimate extension merely because new rows, versions,
// helpers, functions, columns, or migrations exist in the fully migrated
// latest schema.
//
// This contract scans every historical verifier and fails if a future ceiling
// of the confirmed QHIM-002 classes is reintroduced. It deliberately excludes
// the dedicated forward-compatibility verifier, which is the proof harness for
// this remediation: it is the one file that must create synthetic future
// definition versions and synthetic functions inside the formerly frozen
// namespaces in order to prove the ceilings are gone.
const dir=new URL('../',import.meta.url);
const HARNESS='verify-him-historical-verifier-forward-compatibility-v1.mjs';
const files=readdirSync(dir).filter(name=>name.startsWith('verify-')&&name.endsWith('.mjs')&&name!==HARNESS).sort();
const source=Object.fromEntries(files.map(name=>[name,readFileSync(new URL(name,dir),'utf8')]));
// Prose comments legitimately describe the ceilings they removed and reference
// neighbouring migrations descriptively, so every mechanical rule runs against
// executable text only.
const executable=text=>text.split('\n').map(line=>{const at=line.indexOf('//');return at===-1?line:(/^\s*\/\//.test(line)?'':line.slice(0,at));}).join('\n');
const code=Object.fromEntries(files.map(name=>[name,executable(source[name])]));
const sqlLiterals=text=>[...text.matchAll(/(['"`])((?:(?!\1)[\s\S])*?)\1/g)].map(match=>match[2]);

test('the historical verifier set is non-empty and the proof harness is excluded from the ceiling scan',()=>{
 assert.ok(files.length>=40,'the sweep scans the whole historical verifier set');
 assert.ok(!files.includes(HARNESS),'the forward-compatibility proof harness is not scanned as a historical verifier');
 assert.ok(readdirSync(dir).includes(HARNESS),'the forward-compatibility proof harness exists');
});

test('no historical verifier reads the metric definition catalog without version scoping',()=>{
 // Forbidden: unscoped global him_metric_definitions reads, which silently
 // mis-resolve (or outright fail) once a legitimate hse.energy@2 or a new
 // metric version exists. Allowed: explicitly scoped canonical v1 identity
 // reads.
 for(const name of files)for(const literal of sqlLiterals(code[name])){
  if(!/FROM public\.him_metric_definitions/.test(literal))continue;
  assert.match(literal,/definition_version=1/,`${name} reads him_metric_definitions without definition_version=1 scoping`);
 }
});

test('no historical verifier freezes the global definition count or a permanent uncalibrated list',()=>{
 for(const name of files){
  assert.doesNotMatch(code[name],/\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/,`${name} freezes the global seventeen-definition universe`);
  assert.doesNotMatch(code[name],/count\(\*\)[^;]{0,200}FROM public\.him_metric_definitions[^;]{0,200}(?:!==|===)\s*\d+/,`${name} freezes a global definition count`);
  assert.doesNotMatch(source[name],/must (?:remain|stay) uncalibrated|remaining uncalibrated/i,`${name} freezes a permanent uncalibrated list`);
 }
});

test('no historical verifier takes a census of the live function namespace',()=>{
 // Forbidden: LIKE 'background_%' / LIKE 'background_read_him%' namespace
 // censuses and equality between all live matching functions and a historical
 // list. Allowed: exact owned function existence and ACL checks by name or
 // signature.
 for(const name of files){
  assert.doesNotMatch(code[name],/LIKE\s+'background_/i,`${name} takes a background_% namespace census`);
  assert.doesNotMatch(code[name],/proname\s+(?:I?LIKE|~)/i,`${name} matches the live function namespace by pattern`);
  assert.doesNotMatch(code[name],/(?:rowCount|rows\.length)\s*(?:!==|===|==|!=)\s*\w*[sS]ignatures\w*\.length/,`${name} asserts census equality against a historical signature list`);
 }
});

test('no historical verifier requires a future background HIM reader to be absent',()=>{
 // The one background HIM reader that exists may be proven exactly; naming any
 // other background HIM reader in a historical verifier can only be an
 // assertion that a later, separately reviewed reader must never exist.
 for(const name of files)assert.doesNotMatch(source[name],/background_read_him_(?!conversation_snapshot_v1)/,`${name} names a future background HIM reader as required-to-be-absent`);
});

test('no historical verifier enumerates the migration directory',()=>{
 // Enumerating migrations from a verifier is the mechanism by which a
 // next-migration-must-not-exist ceiling is built. Migration ordering and
 // identity belong to the static per-migration contracts.
 for(const name of files)assert.doesNotMatch(code[name],/readdirSync|readdir\(|migrations\/\*/,`${name} enumerates the migration directory`);
});

test('the removed ceilings are replaced by explicitly scoped canonical v1 identity proofs, not deleted',()=>{
 // Anti-weakening: the remediation must not be satisfiable by deleting the
 // assertion. Each remediated catalog verifier must still prove the canonical
 // v1 inventory it owned, scoped to definition_version=1.
 const catalog=['verify-migration-0010.mjs','verify-migration-0040.mjs','verify-migration-0041.mjs','verify-migration-0042.mjs','verify-migration-0043.mjs','verify-migration-0044.mjs','verify-migration-0045.mjs','verify-migration-0046.mjs','verify-migration-0047.mjs','verify-migration-0048.mjs'];
 for(const name of catalog){
  assert.match(code[name],/CANONICAL_V1/,`${name} must still prove the canonical v1 inventory`);
  assert.match(code[name],/definition_version=1/,`${name} must scope its catalog read to v1`);
  for(const key of ['hse.energy','hbs.avoidance','hrs.relationship-trust','hgs.habit-strength'])assert.ok(code[name].includes(key),`${name} must still enumerate the canonical v1 identity ${key}`);
 }
 assert.match(code['verify-migration-0010.mjs'],/metric_key=ANY\(\$1::text\[\]\)/,'0010 queries only the canonical v1 identities');
 assert.match(code['verify-migration-0010.mjs'],/RESOLVED'\)\.length,6/,'0010 still proves the v1 resolved semantic distribution within those identities');
 assert.match(code['verify-migration-0010.mjs'],/semantic_type===null\)\.length,11/,'0010 still proves the v1 unresolved semantic distribution within those identities');
 assert.match(code['verify-migration-0010.mjs'],/hrs\.relationship-trust/,'0010 keeps the Trust identity check');
 assert.match(code['verify-migration-0010.mjs'],/canonical_name,'Confidence'/,'0010 keeps the Self-Confidence identity check');
 assert.match(code['verify-migration-0010.mjs'],/create_him_metric_snapshot/,'0010 keeps the generic-RPC historical behavior checks');
 assert.match(code['verify-migration-0011.mjs'],/HSE_V1/,'0011 scopes its calibration proof to the five canonical HSE v1 identities');
 assert.match(code['verify-migration-0011.mjs'],/ordinal-5\.v1/,'0011 proves each exact v1 calibrated scale rather than a global count');
 assert.match(code['verify-migration-0011.mjs'],/role_table_grants/,'0011 keeps its RLS/privilege guarantees');
 assert.match(code['verify-migration-0011.mjs'],/him_calibration_evaluations/,'0011 keeps its calibration-table guarantee');
});

test('the owned background function authority contracts survive the census removal',()=>{
 const owned=['background_create_system_hypothesis_v1(uuid,uuid,text,text,text,text,text[],text[])','background_attach_hypothesis_evidence_v1(uuid,uuid,text,text)','background_link_competing_hypotheses_v1(uuid,uuid,uuid)','background_create_confidence_evaluation_v1(uuid,uuid,uuid,integer)','background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text)','background_read_him_conversation_snapshot_v1(uuid,uuid)'];
 const v0021=code['verify-migration-0021.mjs'];
 for(const signature of owned)assert.ok(v0021.includes(signature),`0021 must still inspect the exact owned signature ${signature}`);
 assert.match(v0021,/has_function_privilege\('service_role'/,'0021 keeps the service_role EXECUTE proof');
 assert.match(v0021,/row\.authenticated\|\|row\.anon\|\|row\.public/,'0021 keeps the authenticated/anon/PUBLIC denial proof');
 assert.match(v0021,/pg_get_functiondef\(\$1::regprocedure\)/,'0021 inspects each owned signature individually');
 assert.match(v0021,/auth\\\.uid/,'0021 keeps the explicit-service-authority (no auth.uid) proof per owned signature');
 const v0037=code['verify-migration-0037.mjs'];
 assert.match(v0037,/Expected exactly one public\./,'0037 keeps its exact owned function existence checks');
 assert.match(v0037,/read_him_intelligence_snapshot_core_v1\\\(p_user_id,'CONVERSATION_SESSION',p_session_id::text\\\)/,'0037 keeps the CONVERSATION_SESSION-only delegation proof');
 assert.match(v0037,/auth\\\.uid\|request\\\.jwt\|set_config\|current_setting/,'0037 keeps the no-JWT-reconstruction proof');
 assert.match(v0037,/routine_privileges/,'0037 keeps the exact ACL proofs');
 assert.match(v0037,/service_role'&&g\.privilege_type==='EXECUTE'/,'0037 keeps the service_role-only background grant proof');
 const v0038=code['verify-migration-0038.mjs'];
 for(const signature of ['public.create_information_gap(jsonb)','public.create_information_gap_core_v1(uuid,jsonb)','public.sync_post_response_information_gaps_v1(uuid)'])assert.ok(v0038.includes(signature),`0038 must still inspect the exact owned signature ${signature}`);
 assert.match(v0038,/has_function_privilege\('service_role'/,'0038 keeps its exact ACL proofs');
});

test('the phases that owned no new background command prove it from their frozen migration text, never from the live universe',()=>{
 // The true invariant behind the removed censuses: 0037 introduced exactly one
 // background HIM reader and 0038 introduced no background command at all.
 // Both are facts about the frozen migration text and are proven here.
 const migration=name=>readFileSync(new URL(`migrations/${name}`,dir),'utf8');
 const m0037=migration('0037_background_him_runtime_consumption_v1.sql');
 const created=[...m0037.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(background_[a-z0-9_]+)/g)].map(match=>match[1]);
 assert.deepEqual(created,['background_read_him_conversation_snapshot_v1'],'0037 creates exactly one background function');
 assert.doesNotMatch(migration('0038_information_gap_question_integration_v1.sql'),/CREATE (?:OR REPLACE )?FUNCTION public\.background_/,'0038 creates no background function');
});

test('every ceiling rule is live and none of them rejects a legitimate scoped or exact check',()=>{
 // False-positive discipline: each guard must reject its known-bad shape and
 // accept the legitimate future-safe shape it is meant to allow.
 const bad=[
  ["SELECT metric_key FROM public.him_metric_definitions",/FROM public\.him_metric_definitions/,/definition_version=1/],
 ];
 for(const[sample,applies,requires]of bad){assert.match(sample,applies);assert.doesNotMatch(sample,requires);}
 assert.match("SELECT metric_key FROM public.him_metric_definitions WHERE definition_version=1",/definition_version=1/,'scoped catalog reads stay legal');
 assert.match('assert.equal(rows.length,17)',/\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/,'the global definition-count guard is live');
 assert.doesNotMatch('assert.equal(rows.length,CANONICAL_V1.length)',/\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/,'an explicitly enumerated canonical identity count stays legal');
 assert.match("p.proname LIKE 'background_%_v1'",/LIKE\s+'background_/i,'the background namespace guard is live');
 assert.doesNotMatch("WHERE n.nspname='public' AND p.proname=$1",/proname\s+(?:I?LIKE|~)/i,'exact owned function lookups by name stay legal');
 assert.match('if(definitions.rowCount!==signatures.length)',/(?:rowCount|rows\.length)\s*(?:!==|===|==|!=)\s*\w*[sS]ignatures\w*\.length/,'the signature-census guard is live');
 assert.match('background_read_him_goal_snapshot_v1',/background_read_him_(?!conversation_snapshot_v1)/,'the future background HIM reader guard is live');
 assert.doesNotMatch('background_read_him_conversation_snapshot_v1',/background_read_him_(?!conversation_snapshot_v1)/,'the one existing background HIM reader stays nameable');
 assert.match("readdirSync(new URL('../migrations/',import.meta.url))",/readdirSync|readdir\(|migrations\/\*/,'the migration-enumeration guard is live');
});

test('the proof harness is itself forward-safe: collision-safe fixtures and baseline-relative residue',()=>{
 // The harness is excluded from the historical ceiling scan because it must
 // create synthetic future objects, so it carries its own guard: it may not
 // assume a fixed future definition version or a fixed future function name is
 // permanently available, and it may not measure residue by requiring every
 // non-v1 version of a metric to be absent. Those are the same future-ceiling
 // classes this task removes, and a legitimate canonical hse.energy@2 would
 // otherwise break the verifier.
 const harness=readFileSync(new URL(HARNESS,dir),'utf8');
 const harnessCode=executable(harness);
 assert.doesNotMatch(harnessCode,/definition_version"\s*:\s*\d/,'the harness must not hard-code a synthetic definition version');
 assert.doesNotMatch(harnessCode,/definition_version\s*(?:<>|!==|!=|=)\s*(?!1\b)\d/,'the harness must not pin a synthetic definition version literal');
 assert.doesNotMatch(harnessCode,/definition_version\s*(?:<>|!==|!=)\s*1\b/,'the harness must not measure residue by requiring every non-v1 version to be absent');
 assert.doesNotMatch(harnessCode,/CREATE FUNCTION public\.background_[a-z0-9_]/,'the harness must not create a fixed-name probe function');
 assert.doesNotMatch(harnessCode,/proname=ANY\(\$1::name\[\]\)[\s\S]{0,200}FUTURE_PROBES/,'the harness must not assert the absence of fixed probe names');
 // The collision-safe mechanisms must actually be present, so the guard cannot
 // be satisfied by deleting the fixtures instead of deriving them.
 assert.match(harnessCode,/nextSyntheticVersion/,'the harness derives its synthetic version');
 assert.match(harnessCode,/nextSyntheticVersion=versions=>versions\.reduce\(\(highest,version\)=>Math\.max\(highest,version\),0\)\+1/,'the synthetic version is derived from the live maximum');
 assert.match(harnessCode,/uniqueProbeNames/,'the harness generates unique probe names');
 assert.match(harnessCode,/randomUUID/,'probe names carry a generated unique suffix');
 assert.match(harnessCode,/proname=ANY\(\$1::name\[\]\)/,'generated probe names are proven unused before creation');
 assert.match(harnessCode,/CREATE FUNCTION public\.\$\{name\}/,'probe functions are created under generated names');
 assert.match(harnessCode,/assertRestored/,'residue is measured against the captured pre-fixture baseline');
 // The mandated forward-safety proof: the harness re-runs against a state that
 // already contains a legitimate later Energy definition.
 assert.match(harnessCode,/SAVEPOINT phase_b/,'the harness proves itself against a pre-existing legitimate future version');
 assert.match(harnessCode,/selected the pre-existing legitimate future version/,'the harness proves it selects a different synthetic version');
 assert.match(harnessCode,/did not survive the synthetic rollback/,'the harness proves the pre-existing future version survives its own rollback');
 // Legitimate dynamic generation must stay possible: these samples are exactly
 // what the guard is required to allow.
 assert.doesNotMatch('const version=nextSyntheticVersion(baseline.versions);',/definition_version\s*(?:<>|!==|!=|=)\s*(?!1\b)\d/,'dynamic version derivation stays legal');
 assert.doesNotMatch('await client.query(`CREATE FUNCTION public.${name}() RETURNS integer`)',/CREATE FUNCTION public\.background_[a-z0-9_]/,'generated probe names stay legal');
 assert.match("WHERE metric_key='hse.energy' AND definition_version<>1",/definition_version\s*(?:<>|!==|!=)\s*1\b/,'the non-v1-absence residue guard is live');
 assert.match('to_jsonb(d)||\'{"definition_version":2}\'::jsonb',/definition_version"\s*:\s*\d/,'the hard-coded synthetic version guard is live');
 assert.match('CREATE FUNCTION public.background_read_him_future_probe_v1()',/CREATE FUNCTION public\.background_[a-z0-9_]/,'the fixed probe-name guard is live');
});

test('the forward-compatibility proof harness is wired after the historical chain and before HIM consumption checks',()=>{
 const packageJson=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
 assert.match(packageJson.scripts['verify:him-historical-verifier-forward-compatibility:integration'],new RegExp(`--env-file-if-exists=\\.env database/${HARNESS.replace(/[.]/g,'\\.')}`));
 const ci=readFileSync(new URL('../../.github/workflows/api-ci.yml',import.meta.url),'utf8');
 const step=ci.indexOf('verify:him-historical-verifier-forward-compatibility:integration');
 assert.ok(step>0,'CI runs the forward-compatibility verifier');
 assert.ok(step>ci.indexOf('verify:him-structured-current-binding-transition-safety:integration'),'it runs after the 0050 verifier');
 assert.ok(step>ci.indexOf('verify:hgs-habit-strength:integration'),'it runs after the historical measurement verifier chain');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend consumption check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot consumption check');
});

test('the remediation is verifier-only: no migration is added and QHIM-001 stays intact',()=>{
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0050_him_structured_current_binding_transition_safety_v1.sql'),'the QHIM-001 migration is preserved');
 for(let n=1;n<=50;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 // QHIM-001's selection contract is untouched by this verifier-only sweep.
 const view=readFileSync(new URL('../migrations/0050_him_structured_current_binding_transition_safety_v1.sql',import.meta.url),'utf8');
 assert.match(view,/SELECT DISTINCT ON\(s\.measurement_observation_id\)/,'the QHIM-001 one-row-per-observation selection is preserved');
 assert.match(view,/him_active_structured_binding_id/,'the QHIM-001 ACTIVE-binding preference is preserved');
 assert.match(code['verify-migration-0050.mjs'],/him_active_structured_binding_id/,'the QHIM-001 verifier is preserved');
});
