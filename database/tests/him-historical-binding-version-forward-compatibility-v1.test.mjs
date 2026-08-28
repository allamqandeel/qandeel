import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{QHIM009_AMBIGUOUS_SELECTOR_OWNER_FILES,QHIM009_BINDING_V1_OWNER_FILES,QHIM009_CANONICAL_V1_METRICS,QHIM009_EXCLUDED_FUTURE_CONTROLS,QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES,QHIM009_HARNESS,QHIM009_OWNED_QUERY_COUNT,QHIM009_PROVENANCE,QHIM009_RULES,QHIM009_VERSION_EXACT_AT_AUDIT,assertOwnedHistoricalArtifactsExist,bindingIdentityReads,collectOwnedBindingQueries,executableSource,qhim009RulesGoverning,qhim009Violations,readVerifierSource}from'../him-historical-binding-version-forward-compatibility-scope-v1.mjs';
// QHIM-009 historical ACTIVE-binding version forward-compatibility contract.
//
// The canonical ACTIVE-binding uniqueness authority is versioned -
// (metric_key,definition_version,context_kind) WHERE status='ACTIVE' - so a
// legitimate future hse.energy@2 ACTIVE binding may coexist with the
// canonical hse.energy@1 ACTIVE binding for the same context. Every
// historical verifier assertion about a canonical v1 ACTIVE binding must
// therefore select the exact v1 identity, including definition_version=1:
// historical proof means "v1 still has exactly the binding(s) v1 owns",
// never "no later definition version may ever bind this metric/context".
//
// Ownership is the explicit frozen map in
// ../him-historical-binding-version-forward-compatibility-scope-v1.mjs - the
// single source of truth this contract and the real-PostgreSQL harness both
// import - derived from the QHIM-009 closure audit at PR #154's canonical
// baseline, never from a directory listing, a migration-number cutoff, or a
// name prefix. The tests below prove BOTH directions for every rule: a
// known-bad pattern inside an owned historical file is rejected, and the same
// pattern in a file QHIM-009 does not own is ignored, so a future verifier
// that legitimately owns definition_version=2 is legal by construction.
const dir=new URL('../',import.meta.url);
const harnessSource=readFileSync(new URL(QHIM009_HARNESS,dir),'utf8');
const source=Object.fromEntries(QHIM009_BINDING_V1_OWNER_FILES.map(name=>[name,readVerifierSource(name)]));
const code=Object.fromEntries(QHIM009_BINDING_V1_OWNER_FILES.map(name=>[name,executableSource(source[name])]));
const rule=id=>QHIM009_RULES.find(candidate=>candidate.id===id);

// --- Known-bad and legitimate samples ---------------------------------------
// The pre-remediation selectors, reconstructed exactly as the closure audit
// found them at the canonical baseline.
const UNVERSIONED_ENERGY_COUNT=`const binding=await client.query("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE status='ACTIVE' AND metric_key='hse.energy' AND context_kind='CONVERSATION_SESSION'");`;
const VERSIONED_ENERGY_COUNT=`const binding=await client.query("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE status='ACTIVE' AND metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION'");`;
const UNVERSIONED_STRESS_ROWS0=`const oldBinding=(await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND context_kind='SITUATION' AND status='ACTIVE'")).rows[0];`;
const VERSIONED_STRESS_ROWS0=`const oldBindingRead=await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND definition_version=1 AND context_kind='SITUATION' AND status='ACTIVE'");if(oldBindingRead.rowCount!==1)throw new Error('cardinality');const oldBinding=oldBindingRead.rows[0];`;
const UNVERSIONED_PARAM_LIST=`const bindings=await client.query("SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND status='ACTIVE' ORDER BY context_kind",[key]);`;
const INTERPOLATED_IDENTITY='const bindings=await client.query(`SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key=${key} AND definition_version=1 AND status=\'ACTIVE\'`);';
// Class-B exact binding-ID reads, taken from the shapes 0012/0050/0041 really
// use: none carries a metric identity, so none is a QHIM-009 candidate.
const EXACT_ID_READS=[
 `const transitioned=await client.query("SELECT count(*) FILTER(WHERE status='ACTIVE' AND id='22000000-0000-4000-8000-000000000024')::int active FROM public.him_canonical_model_bindings");`,
 `const status=(await client.query('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[candidate])).rows[0].status;`,
 `const provenance=await client.query('SELECT r.metric_key,r.model_id,b.metric_key AS binding_metric FROM public.him_calculation_results r JOIN public.him_canonical_model_bindings b ON b.id=r.canonical_binding_id WHERE r.measurement_observation_id=$1',[obs.id]);`
];
// Class-C intentional relative reads: cross-version by design, no exact
// per-version cardinality, no metric identity equality.
const RELATIVE_LIFECYCLE_READ=`const routed=(await client.query("SELECT DISTINCT metric_key FROM public.him_canonical_model_bindings WHERE definition_version=1 AND status='ACTIVE'")).rows.map(row=>row.metric_key);`;
// A future verifier that legitimately owns a later definition version.
const FUTURE_V2_VERIFIER='verify-migration-9000.mjs';
const futureV2Source=`// Future Energy definition version 2 binding verifier.\nconst v2=await client.query("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=2 AND context_kind='CONVERSATION_SESSION' AND status='ACTIVE'");\nif(v2.rows[0].n!==1)throw new Error('The version 2 Energy binding did not resolve');\n`;
// An unrelated future verifier reading bindings its own way (even without a
// version predicate): QHIM-009 governs history, not the future.
const FUTURE_UNRELATED='verify-him-future-binding-consumption-v1.mjs';
const futureUnrelatedSource=UNVERSIONED_ENERGY_COUNT+UNVERSIONED_STRESS_ROWS0;

test('the explicit QHIM-009 ownership source is frozen provenance, not a directory scan',()=>{
 assert.equal(QHIM009_BINDING_V1_OWNER_FILES.length,QHIM009_PROVENANCE.ownerFiles);
 assert.equal(QHIM009_OWNED_QUERY_COUNT,QHIM009_PROVENANCE.ownedBindingIdentityQueries);
 assert.equal(QHIM009_CANONICAL_V1_METRICS.length,QHIM009_PROVENANCE.canonicalV1Metrics);
 assert.equal(QHIM009_PROVENANCE.auditBaselineCommit,'129a43a7c6dac13c70b77ee183b7577c9a896616');
 // The harness and this contract share the one scope module.
 assert.match(harnessSource,/from'\.\/him-historical-binding-version-forward-compatibility-scope-v1\.mjs'/);
 // The scope module never enumerates the verifier directory to build
 // ownership: readdirSync appears only inside the existence-only helper.
 const scopeSource=readFileSync(new URL('../him-historical-binding-version-forward-compatibility-scope-v1.mjs',import.meta.url),'utf8');
 assert.equal([...executableSource(scopeSource).matchAll(/readdirSync/g)].length,2,'readdirSync is limited to the import and the existence-only helper');
 // Existence is asserted, equality with the directory is not: extra files are
 // legal, a missing owned artifact is not.
 assert.equal(assertOwnedHistoricalArtifactsExist([...QHIM009_BINDING_V1_OWNER_FILES,QHIM009_HARNESS,'verify-migration-9000.mjs','some-unrelated-file.mjs']),true);
 assert.throws(()=>assertOwnedHistoricalArtifactsExist([...QHIM009_BINDING_V1_OWNER_FILES.slice(1),QHIM009_HARNESS]),/owned historical artifact/);
});

test('every owned historical exact-v1 ACTIVE-binding selector is version-exact and matches the frozen map verbatim',()=>{
 const queries=collectOwnedBindingQueries(readVerifierSource);
 assert.equal(queries.length,QHIM009_OWNED_QUERY_COUNT);
 for(const name of QHIM009_BINDING_V1_OWNER_FILES)assert.deepEqual(qhim009Violations(name,source[name]),[]);
 // Every owned query carries the exact v1 identity and appears verbatim.
 for(const entry of queries){
  assert.match(entry.sql,/\bdefinition_version=1(?!\d)/);
  assert.ok(source[entry.file].includes(entry.sql),`${entry.file} must contain its owned query verbatim`);
 }
 // The complete canonical v1 metric surface is asserted somewhere in the map.
 assert.deepEqual([...new Set(queries.flatMap(entry=>entry.metricKeys))].sort(),[...QHIM009_CANONICAL_V1_METRICS].sort());
});

test('context-list and count assertions are version-scoped before aggregation or list formation',()=>{
 for(const entry of QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES){
  const at=entry.sql.indexOf('definition_version=1');
  assert.ok(at>-1);
  if(entry.kind==='context-list'){
   const order=entry.sql.indexOf('ORDER BY context_kind');
   assert.ok(order>at,`${entry.file} scopes by v1 before the context list is formed`);
  }
  if(entry.kind==='count'||entry.kind==='absence')assert.match(entry.sql,/count\(\*\)[\s\S]*definition_version=1/,`${entry.file} scopes by v1 inside the counted predicate`);
  if(entry.kind==='rows0')assert.match(entry.sql,/definition_version=1[\s\S]*status='ACTIVE'|status='ACTIVE'[\s\S]*definition_version=1/);
 }
});

test('no owned ACTIVE-binding rows[0] selector remains version-ambiguous or count-unguarded',()=>{
 for(const name of QHIM009_AMBIGUOUS_SELECTOR_OWNER_FILES){
  assert.ok(QHIM009_BINDING_V1_OWNER_FILES.includes(name));
  assert.doesNotMatch(code[name],/him_canonical_model_bindings[^"'`]*["'`]\)\)\.rows\[0\]/,`${name} never indexes rows[0] directly on a binding query`);
  assert.match(code[name],/\.rowCount!==1\)throw/,`${name} asserts exact cardinality before using index 0`);
 }
 // Two directions, driven by the real rule object: the reconstructed
 // pre-remediation selector fails on version scope AND on direct indexing;
 // the corrected selector passes completely.
 const ambiguous=rule('AMBIGUOUS_ROWS0_SELECTOR'),identity=rule('BINDING_IDENTITY_V1_SCOPE');
 const bad={code:executableSource(UNVERSIONED_STRESS_ROWS0)};
 assert.ok(identity.detect('verify-him-intelligence-snapshot-v1.mjs',bad).length,'the unversioned Stress selector is rejected inside its owner');
 assert.ok(ambiguous.detect('verify-him-intelligence-snapshot-v1.mjs',bad).length,'the direct rows[0] selector is rejected inside its owner');
 const good={code:executableSource(VERSIONED_STRESS_ROWS0)};
 assert.deepEqual(identity.detect('verify-him-intelligence-snapshot-v1.mjs',good),[]);
 assert.deepEqual(ambiguous.detect('verify-him-intelligence-snapshot-v1.mjs',good),[]);
});

test('the audit-identified affected cases are all covered by the ownership map',()=>{
 const byFile=name=>QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES.filter(entry=>entry.file===name);
 assert.equal(byFile('verify-migration-0012.mjs')[0].kind,'count');
 assert.deepEqual(byFile('verify-migration-0051.mjs').map(entry=>entry.kind),['context-list','absence']);
 assert.equal(byFile('verify-migration-0037.mjs')[0].kind,'rows0');
 assert.equal(byFile('verify-him-intelligence-snapshot-v1.mjs')[0].kind,'rows0');
 // The 0051 Energy context assertions - the list and the "no SITUATION
 // Energy binding" absence - are both v1-scoped, so no future Energy version
 // is frozen out of any context by history.
 for(const entry of byFile('verify-migration-0051.mjs'))assert.match(entry.sql,/metric_key='hse\.energy' AND definition_version=1/);
 // Every family named by the closure audit is covered: Energy, Stress, HBS,
 // HRS, HGS.
 const metrics=new Set(QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES.flatMap(entry=>entry.metricKeys));
 for(const key of['hse.energy','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'])assert.ok(metrics.has(key),`${key} is covered`);
 // The eighteen audit-identified files are exactly the owner set.
 assert.deepEqual([...QHIM009_BINDING_V1_OWNER_FILES].sort(),['verify-him-intelligence-snapshot-v1.mjs','verify-migration-0012.mjs','verify-migration-0013.mjs','verify-migration-0014.mjs','verify-migration-0015.mjs','verify-migration-0016.mjs','verify-migration-0037.mjs','verify-migration-0040.mjs','verify-migration-0041.mjs','verify-migration-0042.mjs','verify-migration-0043.mjs','verify-migration-0044.mjs','verify-migration-0045.mjs','verify-migration-0046.mjs','verify-migration-0047.mjs','verify-migration-0048.mjs','verify-migration-0049.mjs','verify-migration-0051.mjs']);
});

test('exact binding-ID reads are never falsely rejected',()=>{
 // Class-B reads select by immutable binding UUID (or join on it) and carry
 // no metric identity: they are not candidates even inside an owned file.
 for(const sample of EXACT_ID_READS){
  assert.deepEqual(bindingIdentityReads(executableSource(sample)),[]);
  assert.deepEqual(qhim009Violations('verify-migration-0012.mjs',sample),[]);
 }
 // The real 0041 provenance join lives inside an owned file today and passes.
 assert.deepEqual(qhim009Violations('verify-migration-0041.mjs',source['verify-migration-0041.mjs']),[]);
 // 0050 and 0052 were classified version-exact at the audit baseline: they
 // are named negative controls, owned by no rule, and stay that way.
 for(const name of QHIM009_VERSION_EXACT_AT_AUDIT)assert.deepEqual(qhim009RulesGoverning(name),[]);
});

test('intentional cross-version relative lifecycle reads are not falsely rewritten',()=>{
 // 0051's v1-coverage inclusion read spans the whole v1 binding population by
 // design; it owns no single metric identity and is not a candidate.
 assert.deepEqual(bindingIdentityReads(executableSource(RELATIVE_LIFECYCLE_READ)),[]);
 assert.deepEqual(qhim009Violations('verify-migration-0051.mjs',RELATIVE_LIFECYCLE_READ),[]);
 assert.ok(code['verify-migration-0051.mjs'].includes("SELECT DISTINCT metric_key FROM public.him_canonical_model_bindings WHERE definition_version=1 AND status='ACTIVE'"),'the relative coverage read is preserved unchanged');
});

test('a future verifier is outside historical ownership: unrelated files are ignored and a definition_version=2 owner is legal',()=>{
 assert.deepEqual(qhim009RulesGoverning(FUTURE_V2_VERIFIER),[]);
 assert.deepEqual(qhim009RulesGoverning(FUTURE_UNRELATED),[]);
 assert.deepEqual(qhim009RulesGoverning(QHIM009_HARNESS),[]);
 // verify-migration-9000 correctly checking its own definition_version=2
 // binding: legal, outside scope.
 assert.deepEqual(qhim009Violations(FUTURE_V2_VERIFIER,futureV2Source),[]);
 // Even a future verifier reading bindings with no version predicate at all
 // is governed by no QHIM-009 rule merely because its file exists.
 assert.deepEqual(qhim009Violations(FUTURE_UNRELATED,futureUnrelatedSource),[]);
 for(const name of QHIM009_EXCLUDED_FUTURE_CONTROLS)for(const governed of QHIM009_RULES)assert.ok(!governed.scope.includes(name),`${name} is owned by no rule`);
});

test('injecting an unversioned historical-v1 selector into an owned file fails in both mechanisms',()=>{
 for(const[name,bad]of[['verify-migration-0012.mjs',UNVERSIONED_ENERGY_COUNT],['verify-migration-0016.mjs',UNVERSIONED_PARAM_LIST],['verify-migration-0041.mjs',UNVERSIONED_PARAM_LIST]]){
  const patched=source[name]+'\n'+bad;
  assert.ok(qhim009Violations(name,patched).length,`${name} rejects an injected unversioned selector`);
  assert.throws(()=>collectOwnedBindingQueries(file=>file===name?patched:readVerifierSource(file)));
 }
 // Interpolated identity queries cannot be proven verbatim and are rejected.
 assert.ok(qhim009Violations('verify-migration-0042.mjs',source['verify-migration-0042.mjs']+'\n'+INTERPOLATED_IDENTITY).length);
 // The owned set is an exact identity, never a floor: even a correctly
 // versioned EXTRA identity read in an owned file is drift, not growth.
 assert.throws(()=>collectOwnedBindingQueries(file=>file==='verify-migration-0012.mjs'?source[file]+'\n'+VERSIONED_ENERGY_COUNT:readVerifierSource(file)),/contributes 2/);
});

test('mandatory two-direction mutation proofs drive the real checker',()=>{
 const identity=rule('BINDING_IDENTITY_V1_SCOPE');
 // owned Energy ACTIVE query without definition_version=1 => FAIL
 assert.ok(identity.detect('verify-migration-0012.mjs',{code:executableSource(UNVERSIONED_ENERGY_COUNT)}).length);
 // owned Energy ACTIVE query with definition_version=1 => PASS
 assert.deepEqual(identity.detect('verify-migration-0012.mjs',{code:executableSource(VERSIONED_ENERGY_COUNT)}),[]);
 // owned Stress rows[0] selector without version => FAIL
 assert.ok(identity.detect('verify-migration-0037.mjs',{code:executableSource(UNVERSIONED_STRESS_ROWS0)}).length);
 // same selector with definition_version=1 => PASS
 assert.deepEqual(identity.detect('verify-migration-0037.mjs',{code:executableSource(VERSIONED_STRESS_ROWS0)}),[]);
 // future verify-migration-9000 checking definition_version=2 => PASS,
 // outside scope: no rule governs it at all.
 assert.deepEqual(qhim009RulesGoverning(FUTURE_V2_VERIFIER),[]);
 assert.deepEqual(qhim009Violations(FUTURE_V2_VERIFIER,futureV2Source),[]);
});

test('adding future verifier files does not change the historical owned query set',()=>{
 const consulted=[];
 const ownedOnly=name=>{
  if(!QHIM009_BINDING_V1_OWNER_FILES.includes(name))throw new Error(`read outside the ownership map: ${name}`);
  consulted.push(name);return readVerifierSource(name);
 };
 const fixed=collectOwnedBindingQueries(ownedOnly);
 assert.deepEqual(consulted,[...QHIM009_BINDING_V1_OWNER_FILES]);
 assert.equal(JSON.stringify(fixed),JSON.stringify(collectOwnedBindingQueries(readVerifierSource)));
 // A directory that additionally contains ten future verifiers yields the
 // identical query set, because they are never read.
 const withFuture=name=>QHIM009_BINDING_V1_OWNER_FILES.includes(name)?readVerifierSource(name):(()=>{throw new Error('a future verifier was consulted');})();
 assert.equal(JSON.stringify(collectOwnedBindingQueries(withFuture)),JSON.stringify(fixed));
});

test('the real-PostgreSQL harness is wired into CI between QHIM-002 and the 0051 legacy-authority verifier',()=>{
 const packageJson=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
 assert.equal(packageJson.scripts['verify:him-historical-binding-version-forward-compatibility:integration'],`node --env-file-if-exists=.env database/${QHIM009_HARNESS}`);
 const workflow=readFileSync(new URL('../../.github/workflows/api-ci.yml',import.meta.url),'utf8');
 const qhim002=workflow.indexOf('Verify HIM historical verifier forward compatibility against real PostgreSQL');
 const qhim009=workflow.indexOf('Verify HIM historical ACTIVE-binding version forward compatibility against real PostgreSQL');
 const legacy=workflow.indexOf('Verify HIM legacy snapshot authority retirement and Energy context reconciliation against real PostgreSQL');
 const canonicalLatest=workflow.indexOf('Verify HIM canonical latest measurement read semantics against real PostgreSQL');
 const trend=workflow.indexOf('Verify HIM temporal trend source against real PostgreSQL');
 const snapshot=workflow.indexOf('Verify HIM Intelligence Snapshot against real PostgreSQL');
 assert.ok(qhim002>-1&&qhim009>-1&&legacy>-1&&canonicalLatest>-1&&trend>-1&&snapshot>-1,'no existing verifier step was removed');
 assert.ok(qhim002<qhim009&&qhim009<legacy&&legacy<canonicalLatest&&canonicalLatest<trend&&trend<snapshot,'the QHIM-009 harness runs after QHIM-002 and before the later Measurement Foundation read verifiers');
 assert.match(workflow,/npm run verify:him-historical-binding-version-forward-compatibility:integration/);
});
