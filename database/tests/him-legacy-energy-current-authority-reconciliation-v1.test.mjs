import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIM-012 static contract. Freezes the Legacy Energy Current Authority
// Reconciliation: public.him_current_energy_measurements is a narrow
// backward-compatibility PROJECTION over the canonical structured-current
// authority, pinned to exactly hse.energy@1, owning no currentness algorithm
// of its own and no latest-across-events semantics.
//
// Forward-safe under the QHIM-002 policy: nothing here forbids a later
// migration, a later Energy definition version, a larger metric catalog, or
// any separately reviewed future authority. The only version pin asserted is
// the one belonging to this historical v1 compatibility object.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0053_him_legacy_energy_current_authority_reconciliation_v1.sql';
const MIGRATION_NUMBER=Number(MIGRATION.slice(0,4));
// Computed rather than written literally, so this contract can name "the next
// migration number" as a thing it must NOT freeze without itself containing it.
const NEXT_MIGRATION_NUMBER=String(MIGRATION_NUMBER+1).padStart(4,'0');
const FROZEN_0012='0012_hse_energy_measurement_model_v1.sql';
const sql=read(`migrations/${MIGRATION}`);
const frozen=read(`migrations/${FROZEN_0012}`);
const verifier=read('verify-migration-0053.mjs');
// Every negative rule runs against executable SQL only: the prose comments
// legitimately name the removed defect tokens while documenting them.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const statement=(source,marker)=>{const start=source.indexOf(marker);assert.ok(start>=0,`expected ${marker}`);const end=source.indexOf(';',start);assert.ok(end>start,`expected a terminated ${marker} statement`);return source.slice(start,end+1);};
const COMPATIBILITY_VIEW=statement(executable,'CREATE OR REPLACE VIEW public.him_current_energy_measurements');
const LEGACY_0012_VIEW=statement(frozen,'CREATE VIEW public.him_current_energy_measurements');

// The single guard the anti-vacuity fixtures below drive. It receives one
// compatibility-view statement and throws on the first violated architectural
// property, so "the guard catches drift X" is proven by running the real
// guard over a mutated body - never by re-deriving the expectation from the
// same source it is checking.
const REQUIRED=[
 [/^CREATE OR REPLACE VIEW public\.him_current_energy_measurements\b/,'the compatibility object is replaced in place, never dropped or renamed'],
 [/WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/,'security_invoker=true is preserved'],
 [/FROM public\.him_current_structured_measurements\b/,'selection delegates to the canonical structured-current authority'],
 [/SELECT \w+\.\*/,'the projection keeps the canonical him_metric_snapshots row shape'],
 [/\w+\.metric_key='hse\.energy'/,"the projection is restricted to metric_key='hse.energy'"],
 [/\w+\.definition_version=1(?!\d)/,'the projection is exact to definition version 1'],
];
const FORBIDDEN=[
 [/him_metric_snapshots/,'no direct raw snapshot access'],
 [/\bJOIN\b/i,'no independent join'],
 [/him_measurement_observations/,'no independent raw observation join'],
 [/him_measurement_events/,'no independent measurement-event join'],
 [/him_energy_calculation_supersessions/,'no independent supersession predicate'],
 [/supersedes_observation_id/,'no independent correction predicate'],
 [/NOT EXISTS/i,'no independent eligibility predicate'],
 [/him_active_structured_binding_id/,'no duplicated ACTIVE-binding resolver'],
 [/DISTINCT\s+ON/i,'no duplicated one-row-per-observation selection'],
 [/snapshot_version/,'no snapshot ordering'],
 [/ORDER\s+BY/i,'no ordering of any kind'],
 [/\bLIMIT\b/i,'no latest-across-events selection'],
];
function assertCompatibilityContract(view){
 for(const[pattern,property]of REQUIRED)if(!pattern.test(view))throw new Error(`QHIM-012 compatibility contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN)if(pattern.test(view))throw new Error(`QHIM-012 compatibility contract violated: ${property}`);
}
// The migration-identity rules, factored so forward-safety can be proven by
// running the real rules over a directory listing that already contains
// future migrations.
function assertMigrationIdentity(names){
 const migrations=[...names].sort();
 assert.ok(migrations.includes(MIGRATION),'migration 0053 exists');
 assert.equal(migrations.filter(name=>name.startsWith(String(MIGRATION_NUMBER).padStart(4,'0'))).length,1,'exactly one migration 0053');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0052_him_canonical_latest_measurement_read_semantics_v1.sql'),'0053 orders after 0052');
 for(let n=1;n<MIGRATION_NUMBER;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
}

test('S1 - the historical defect is real and stays historical in frozen migration 0012',()=>{
 // Historical evidence only. Migration 0012 is an immutable artifact: this
 // test must NEVER fail because the 0012 definition is still wrong - that is
 // precisely what it records. The remediation lives in 0053 and reconciles
 // final schema state instead of editing history.
 assert.match(LEGACY_0012_VIEW,/FROM public\.him_measurement_observations o JOIN public\.him_metric_snapshots s ON s\.measurement_observation_id=o\.id/,'0012 created an independent raw observation-to-snapshot join');
 assert.match(LEGACY_0012_VIEW,/NOT EXISTS\(SELECT 1 FROM public\.him_measurement_observations newer WHERE newer\.supersedes_observation_id=o\.id\)/,'0012 owned its own correction filter');
 assert.match(LEGACY_0012_VIEW,/NOT EXISTS\(SELECT 1 FROM public\.him_energy_calculation_supersessions x WHERE x\.snapshot_id=s\.id\)/,'0012 owned its own supersession filter');
 assert.doesNotMatch(LEGACY_0012_VIEW,/hse\.energy/,'0012 carried no Energy metric-key restriction at all');
 assert.doesNotMatch(LEGACY_0012_VIEW,/definition_version/,'0012 carried no exact definition-version restriction');
 assert.doesNotMatch(LEGACY_0012_VIEW,/him_current_structured_measurements/,'0012 delegated to no canonical current authority');
 assert.doesNotMatch(LEGACY_0012_VIEW,/DISTINCT ON|him_active_structured_binding_id/,'0012 had no one-row-per-observation or ACTIVE-binding contract');
 // The real guard confirms the historical shape is exactly what the
 // remediation rejects, which also proves 0012 was not edited in place.
 assert.throws(()=>assertCompatibilityContract(LEGACY_0012_VIEW),/QHIM-012 compatibility contract violated/);
});

test('S2 - migration 0053 redefines the compatibility view through the canonical authority and pins hse.energy@1',()=>{
 assertMigrationIdentity(readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')));
 assert.doesNotThrow(()=>assertCompatibilityContract(COMPATIBILITY_VIEW),'the shipped compatibility view satisfies the frozen contract');
 assert.match(COMPATIBILITY_VIEW,/FROM public\.him_current_structured_measurements canonical WHERE canonical\.metric_key='hse\.energy' AND canonical\.definition_version=1;$/,'the projection is exactly the canonical Energy v1 slice');
 // The migration proves the same facts against the installed object.
 assert.match(executable,/position\('him_current_structured_measurements' in def\)=0/,'the migration postcondition proves delegation on the live definition');
 assert.match(executable,/definition_version\\s\*=\\s\*1/,'the migration postcondition proves the exact v1 pin on the live definition');
 assert.match(executable,/security_invoker=true'=ANY\(coalesce\(reloptions/,'the migration postcondition proves security_invoker on the live object');
 // Exactly the intended read grant, restated explicitly.
 assert.match(executable,/REVOKE ALL ON public\.him_current_energy_measurements FROM PUBLIC,anon,authenticated;/,'every application role is revoked before the narrow grant');
 assert.match(executable,/GRANT SELECT ON public\.him_current_energy_measurements TO authenticated;/,'authenticated SELECT is the only grant');
 assert.doesNotMatch(executable,/GRANT[^;]*service_role/,'service_role gains no application-facing grant from this task');
 assert.doesNotMatch(executable,/GRANT[^;]*\b(anon|PUBLIC)\b/,'anon and PUBLIC gain nothing');
 assert.match(executable,/has_table_privilege\('service_role','public\.him_current_energy_measurements','SELECT'\)::text IS DISTINCT FROM current_setting/,'the migration proves the service_role privilege is unchanged rather than assumed');
});

test('S3 - 0053 duplicates no currentness algorithm and mutates no history',()=>{
 for(const[pattern,property]of FORBIDDEN)assert.doesNotMatch(COMPATIBILITY_VIEW,pattern,`the compatibility view body keeps ${property}`);
 // Selection-only and non-destructive: exactly one view rebuild, no new
 // object of any other kind, and no durable data change.
 assert.equal((executable.match(/CREATE OR REPLACE VIEW/g)??[]).length,1,'exactly one view rebuild');
 assert.doesNotMatch(executable,/CREATE (?:OR REPLACE )?FUNCTION|CREATE TABLE|CREATE INDEX|CREATE TRIGGER|CREATE (?:MATERIALIZED )?VIEW public\.(?!him_current_energy_measurements)/i,'0053 creates no function, table, index, trigger, or second view');
 assert.doesNotMatch(executable,/INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|COPY\s+public\.|DROP\s+(?:TABLE|VIEW|FUNCTION|CONSTRAINT)|ALTER TABLE|DISABLE TRIGGER/i,'0053 deletes, backfills, drops, and rewrites nothing');
 assert.doesNotMatch(executable,/UPDATE public\./,'0053 updates no persisted row');
 // No canonical semantics are altered or relocated.
 assert.doesNotMatch(executable,/him_scale_contracts|him_calculation_models|him_governance_approvals|him_canonical_model_bindings|response_code|approval_basis|calculation_status|semantic_mapping_status/,'0053 changes no metric definition, model, binding, approval, scale, calibration status, or semantic mapping');
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot|background_read_him|slots\(/,'0053 changes no Trend, Snapshot, or Runtime Consumption surface');
 assert.doesNotMatch(executable,/recommendation|safety_runtime|openai|anthropic|llm|provider|embedding/i,'0053 adds no provider, recommendation, safety, or UI surface');
 // QHIM-013 is a separate known blocker and is untouched here.
 assert.doesNotMatch(executable,/create_him_metric_snapshot|createObservation|HimService/,'0053 touches no QHIM-013 legacy write surface');
 // The canonical authorities keep their own semantics.
 const canonical=read('migrations/0050_him_structured_current_binding_transition_safety_v1.sql');
 assert.match(canonical,/SELECT DISTINCT ON\(s\.measurement_observation_id\)/,'per-observation currentness stays owned by 0050');
 assert.match(canonical,/him_active_structured_binding_id/,'the ACTIVE-binding preference stays owned by 0050');
 const latest=read('migrations/0052_him_canonical_latest_measurement_read_semantics_v1.sql');
 assert.match(latest,/CREATE FUNCTION public\.read_him_latest_measurement_v1/,'latest-across-events stays owned by 0052');
 assert.match(executable,/read_him_latest_measurement_v1\(uuid,text,integer,text,text\)'\) IS NULL/,'0053 proves the separate latest authority remains installed');
 assert.doesNotMatch(COMPATIBILITY_VIEW,/read_him_latest_measurement_v1|latest/i,'no latest-across-events semantics move into the compatibility view');
});

test('S4 - anti-vacuity: the real guard rejects every named drift fixture',()=>{
 // Each fixture proves the string replacement actually happened before the
 // guard is asked to catch it, so no assertion can pass vacuously.
 const drifts=[
  ['old raw-join definition reused',LEGACY_0012_VIEW,LEGACY_0012_VIEW.replace('CREATE VIEW','CREATE OR REPLACE VIEW')],
  ['Energy metric filter removed',COMPATIBILITY_VIEW,COMPATIBILITY_VIEW.replace("canonical.metric_key='hse.energy' AND ",'')],
  ['definition-version filter removed',COMPATIBILITY_VIEW,COMPATIBILITY_VIEW.replace(' AND canonical.definition_version=1','')],
  ['canonical delegation replaced with raw snapshots',COMPATIBILITY_VIEW,COMPATIBILITY_VIEW.replace('public.him_current_structured_measurements canonical','public.him_metric_snapshots canonical')],
  ['future-style key-only filter that would admit Energy v2',COMPATIBILITY_VIEW,COMPATIBILITY_VIEW.replace('canonical.definition_version=1','canonical.definition_version>=1')],
 ];
 for(const[label,base,mutated]of drifts){
  assert.notEqual(mutated,base,`the ${label} mutation actually replaced its source body`);
  assert.throws(()=>assertCompatibilityContract(mutated),/QHIM-012 compatibility contract violated/,`the guard rejects: ${label}`);
 }
 // Positive control: the guard is not simply throwing for everything.
 assert.doesNotThrow(()=>assertCompatibilityContract(COMPATIBILITY_VIEW));
 // A cosmetic, semantics-preserving rewrite is still accepted, so the guard
 // proves architecture rather than byte-exact formatting.
 const reformatted=COMPATIBILITY_VIEW.replace('WITH(security_invoker=true)AS SELECT','WITH (security_invoker = true)\n AS\n SELECT').replace(' WHERE canonical.metric_key','\n WHERE canonical.metric_key');
 assert.notEqual(reformatted,COMPATIBILITY_VIEW,'the cosmetic rewrite actually changed the body');
 assert.doesNotThrow(()=>assertCompatibilityContract(reformatted),'formatting alone never fails the guard');
});

test('S5 - the guard creates no future ceiling',()=>{
 // A later migration may exist: the real identity rules still pass over a
 // listing that already contains future migrations.
 const listing=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql'));
 assert.doesNotThrow(()=>assertMigrationIdentity([...listing,`${NEXT_MIGRATION_NUMBER}_a_future_migration.sql`,'0099_a_much_later_migration.sql']),'future migrations are legal');
 assert.ok(!executable.includes(NEXT_MIGRATION_NUMBER),'0053 freezes no next-migration number');
 assert.ok(!verifier.includes(NEXT_MIGRATION_NUMBER),'the 0053 verifier freezes no next-migration number');
 // No global catalog, calibration, or metric-count ceiling anywhere.
 for(const source of [executable,verifier]){
  assert.doesNotMatch(source,/(?:!==|===|<>|=)\s*17\b/,'no global metric count is frozen');
  assert.doesNotMatch(source,/forever|can never exist|must never exist|is the last migration/i,'no permanent existence ceiling is stated');
 }
 // A future hse.energy@2 stays legal: nothing globally prohibits a later
 // Energy definition version, and the verifier proves it by creating one.
 assert.doesNotMatch(executable,/definition_version\s*(?:<>|!=|>)\s*1/,'0053 prohibits no later Energy definition version');
 assert.doesNotMatch(executable,/calculation_status|CALIBRATED/,'0053 freezes no calibration state or catalog completeness');
 assert.ok(verifier.includes('a future Energy definition version must remain legal to create'),'the verifier proves a later Energy definition version can still be created');
 assert.match(verifier,/max\(definition_version\)::int\+1/,'the verifier derives its synthetic future version instead of hard-coding one');
 assert.match(verifier,/baselineEnergyVersions/,'the verifier proves rollback against a captured baseline, never against "no non-v1 Energy version may exist"');
 // The one pin that IS asserted belongs to this historical v1 object only.
 assert.ok(REQUIRED.some(([,property])=>/definition version 1/.test(property)),'the v1 pin is scoped to the compatibility object');
});

test('the 0053 verifier proves the required live-schema scenarios and stays non-destructive',()=>{
 for(const proof of ['pg_get_viewdef','has_table_privilege','reloptions','create_hse_energy_measurement','calculate_hse_energy_measurement','correct_hse_energy_measurement','activate_him_canonical_model_binding','create_hse_stress_measurement','calculate_hse_stress_measurement','him_current_energy_measurements','him_current_structured_measurements','read_him_latest_measurement_v1','cleanupVerifierUsers'])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 for(const scenario of ['V1 -','V2 -','V3 -','V4 -','V5 -','V6 -','V7 -','V8 -'])assert.ok(verifier.includes(scenario),`the verifier covers scenario ${scenario}`);
 assert.match(verifier,/SET LOCAL ROLE authenticated/,'isolation evidence uses a real authenticated identity, never a privileged connection');
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_calculation_results|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings/,'the verifier deletes no measurement or binding history');
 assert.match(verifier,/await client\.query\('ROLLBACK'\)/,'every fixture rolls back');
});

test('the Energy documentation states the final live authority',()=>{
 const doc=read('../docs/hse-energy-measurement-model-v1.md');
 for(const statement of [
  'him_current_energy_measurements',
  'him_current_structured_measurements',
  'read_him_latest_measurement_v1',
  'backward-compatibility read',
  'owns no independent currentness algorithm',
  'inherited',
  'exact to `hse.energy@1`',
  'does not enter this versionless legacy surface automatically',
  'never the latest-across-events authority',
  'No Trend, Intelligence Snapshot, or Runtime Consumption eligibility changes',
 ])assert.ok(doc.includes(statement),`the Energy document states: ${statement}`);
 // The stale claim that made the legacy view sound like the canonical current
 // authority is gone, so the correction is proven to have happened rather than
 // merely appended alongside the old wording.
 assert.ok(!doc.includes('excluded from `him_current_energy_measurements`; between correction and calculation of the replacement, the canonical current read returns no Energy value for that event'),'the stale canonical-current claim about the legacy view is removed');
});

test('the 0053 verifier is wired after the 0050/0051/0052 verifiers and before the HIM consumption gates',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-legacy-energy-current-authority-reconciliation:integration'],/--env-file-if-exists=\.env database\/verify-migration-0053\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-legacy-energy-current-authority-reconciliation:integration');
 assert.ok(step>0,'CI runs the 0053 verifier');
 assert.ok(step>ci.indexOf('verify:him-structured-current-binding-transition-safety:integration'),'it runs after the QHIM-001 verifier');
 assert.ok(step>ci.indexOf('verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration'),'it runs after the 0051 verifier');
 assert.ok(step>ci.indexOf('verify:him-canonical-latest-measurement-read-semantics:integration'),'it runs after the 0052 verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
 // No prior verifier is removed, weakened, or replaced by the new one.
 for(const preserved of ['verify:hse-energy:integration','verify:him-structured-current-binding-transition-safety:integration','verify:him-historical-verifier-forward-compatibility:integration','verify:him-historical-binding-version-forward-compatibility:integration','verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration','verify:him-canonical-latest-measurement-read-semantics:integration'])assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the prior verifier ${preserved} is preserved`);
 assert.ok(readdirSync(root).includes('verify-migration-0012.mjs'),'the historical 0012 verifier is preserved');
 assert.ok(readdirSync(root).includes('verify-migration-0050.mjs'),'the QHIM-001 verifier is preserved');
});
