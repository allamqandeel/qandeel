import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
import{QHIM002_ANTI_WEAKENING_SCOPE,QHIM002_BACKGROUND_NAMESPACE_SCOPE,QHIM002_BACKGROUND_READER_SCOPE,QHIM002_CANONICAL_V1_KEYS,QHIM002_CATALOG_V1_REMEDIATED,QHIM002_CATALOG_V1_SCOPE,QHIM002_DEFINITION_POPULATION_REMEDIATED,QHIM002_DEFINITION_POPULATION_SCOPE,QHIM002_EXCLUDED_BY_PROVENANCE,QHIM002_EXPECTED_CATALOG_QUERIES,QHIM002_HARNESS,QHIM002_MIGRATION_ENUMERATION_SCOPE,QHIM002_OWNED_BACKGROUND_SIGNATURES,QHIM002_OWNED_CATALOG_QUERY_COUNT,QHIM002_PROVENANCE,QHIM002_RULES,QHIM002_SWEPT_HISTORICAL_VERIFIERS,assertOwnedHistoricalArtifactsExist,collectOwnedCatalogQueries,executableSource,qhim002RulesGoverning,qhim002Violations,readVerifierSource}from'../him-historical-verifier-forward-compatibility-scope-v1.mjs';
// QHIM-002 forward-compatibility contract, owner-scoped (QHIM-006).
//
// The frozen policy is unchanged: historical verifier N may prove the durable
// artifacts and permanent invariants introduced or owned by migration N, but
// must not prohibit later legitimate extension merely because new rows,
// versions, helpers, functions, columns, or migrations exist in the fully
// migrated latest schema.
//
// What changed is scope. This contract used to build its subject universe with
// a live scan of every verify-*.mjs in database/ and then apply historical-v1
// semantics to all of it, which made QHIM-002 itself the ceiling: a future
// verifier owning hse.energy@2 would have failed for reading
// definition_version=2, and a future separately reviewed background HIM reader
// would have failed merely for naming itself. Every rule is now bound to the
// exact historical owners recorded in
// ../him-historical-verifier-forward-compatibility-scope-v1.mjs, the single
// source of truth this contract and the real-PostgreSQL harness both import.
//
// The tests below therefore prove BOTH directions for every rule class: a
// known-bad pattern inside an owned historical file is still rejected, and the
// same pattern in a file QHIM-002 does not own is ignored. Anything that
// merely deleted the guard logic would fail the first direction; anything that
// kept the old global scan would fail the second.
const dir=new URL('../',import.meta.url);
const scope=readFileSync(new URL('../him-historical-verifier-forward-compatibility-scope-v1.mjs',import.meta.url),'utf8');
const harness=readFileSync(new URL(QHIM002_HARNESS,dir),'utf8');
const harnessCode=executableSource(harness);
const source=Object.fromEntries(QHIM002_SWEPT_HISTORICAL_VERIFIERS.map(name=>[name,readVerifierSource(name)]));
const code=Object.fromEntries(QHIM002_SWEPT_HISTORICAL_VERIFIERS.map(name=>[name,executableSource(source[name])]));

// --- Synthetic future verifier sources -------------------------------------
// These are NOT written to disk. They are exactly the shapes a legitimate,
// separately reviewed future verifier is entitled to have, and each one would
// have been rejected by the pre-QHIM-006 global scan.
const FUTURE_V2_CATALOG='verify-migration-9000.mjs';
const FUTURE_BACKGROUND_READER='verify-migration-9001.mjs';
const FUTURE_INDEPENDENT='verify-him-future-consumption-v1.mjs';
// A. A future verifier that legitimately owns hse.energy@2.
const futureV2Source=`// Future HSE Energy definition version 2 measurement model.\nconst identity=await client.query("SELECT metric_key,calculation_status FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=2");\nif(identity.rowCount!==1)throw new Error('The hse.energy version 2 identity did not resolve');\nconst parameterised=await client.query('SELECT metric_key FROM public.him_metric_definitions WHERE metric_key=$1 AND definition_version=$2',[OWNED_KEY,OWNED_VERSION]);\nif(parameterised.rowCount!==1)throw new Error('The task-owned identity did not resolve');\n`;
// B. A future, separately reviewed background HIM reader.
const futureReaderSource=`// Future background HIM goal/relationship snapshot readers.\nconst owned=['background_read_him_goal_snapshot_v2(uuid,uuid)','background_read_him_relationship_snapshot_v1(uuid,uuid)'];\nfor(const signature of owned)await client.query("SELECT pg_get_functiondef($1::regprocedure) definition,has_function_privilege('service_role',$1,'EXECUTE') service",['public.'+signature]);\n`;
// C. An independent future contract carrying, in one file, every shape the old
// directory-wide scan would have rejected: a migration-directory enumeration,
// a live background namespace census, a signature-count equality, a future
// reader name, an unscoped catalog read, a non-v1 catalog read, an exact
// seventeen-row cardinality of its own task-owned result, and a permanent
// uncalibrated statement.
const futureIndependentSource=`// Future HIM consumption verifier owning its own cardinality contract.\nimport{readdirSync}from'node:fs';\nconst migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();\nconst rows=(await client.query("SELECT metric_key FROM public.him_metric_definitions")).rows;\nconst versioned=(await client.query("SELECT metric_key FROM public.him_metric_definitions WHERE definition_version=3")).rows;\nif(rows.length!==17)throw new Error('The future task-owned universe changed');\nconst census=await client.query("SELECT p.proname FROM pg_proc p WHERE p.proname LIKE 'background_%_v1'");\nif(census.rowCount!==signatures.length)throw new Error('The future task-owned signature set changed');\nconst reader='background_read_him_goal_snapshot_v2';\n// its final two appraisals must remain uncalibrated in this future phase\n`;
const FUTURE_SOURCES=Object.freeze({[FUTURE_V2_CATALOG]:futureV2Source,[FUTURE_BACKGROUND_READER]:futureReaderSource,[FUTURE_INDEPENDENT]:futureIndependentSource});

// --- Known-bad and legitimate mutation samples ------------------------------
const UNSCOPED_CATALOG=`const{rows}=await client.query("SELECT metric_key FROM public.him_metric_definitions");`;
const V1_SCOPED_CATALOG=`const{rows}=await client.query("SELECT metric_key FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[])",[CANONICAL_V1]);`;
const V2_SCOPED_CATALOG=`const{rows}=await client.query("SELECT metric_key FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=2");`;
const INTERPOLATED_CATALOG='const{rows}=await client.query(`SELECT metric_key FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=${key}`);';
const GLOBAL_SEVENTEEN=`assert.equal(rows.length,17);`;
const OWNED_CARDINALITY=`assert.equal(rows.length,CANONICAL_V1.length);`;
const GLOBAL_DEFINITION_COUNT=`if(Number((await client.query("SELECT count(*)::int n FROM public.him_metric_definitions")).rows[0].n)!==17)throw new Error('definition population drift');`;
const PERMANENT_UNCALIBRATED=`// the final two HGS appraisals must remain uncalibrated\n`;
const NAMESPACE_CENSUS=`const census=await client.query("SELECT p.proname FROM pg_proc p WHERE p.proname LIKE 'background_%_v1'");`;
const PRONAME_PATTERN=`const census=await client.query("SELECT 1 FROM pg_proc p WHERE p.proname LIKE $1",['background\\\\_%']);`;
const EXACT_SIGNATURE=`await client.query("SELECT pg_get_functiondef($1::regprocedure) definition",['public.background_read_him_conversation_snapshot_v1(uuid,uuid)']);`;
const SIGNATURE_CENSUS=`if(definitions.rowCount!==signatures.length)throw new Error('background census drift');`;
const FUTURE_READER_NAME=`const owned=['background_read_him_goal_snapshot_v2(uuid,uuid)'];`;
const EXISTING_READER_NAME=`const owned=['background_read_him_conversation_snapshot_v1(uuid,uuid)'];`;
const MIGRATION_ENUMERATION=`const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();`;
// Which QHIM-002 rules a given (file, source) pair actually violates, computed
// through the same rule objects the contract and the harness use, so these
// proofs exercise the real checkers rather than a duplicate regex demo.
const violatedRules=(name,text)=>QHIM002_RULES.filter(rule=>rule.scope.includes(name)&&rule.detect(name,{source:text,code:executableSource(text)}).length).map(rule=>rule.id).sort();
const mutate=(name,injection)=>qhim002Violations(name,`${source[name]??''}\n${injection}\n`);
const CATALOG_OWNER='verify-migration-0010.mjs';
const CALIBRATION_OWNER='verify-migration-0011.mjs';
const BACKGROUND_SIGNATURE_OWNER='verify-migration-0021.mjs';
const BACKGROUND_READER_OWNER='verify-migration-0037.mjs';
const SWEPT_NON_CATALOG_OWNER='verify-migration-0050.mjs';

test('the QHIM-002 ownership scope is explicit and its provenance is the merged PR #151, not current-directory discovery',()=>{
 assert.equal(QHIM002_PROVENANCE.pullRequest,151);
 assert.equal(QHIM002_PROVENANCE.head,'9f25784d4a960f8c30b7dd9112c7fbde4eb4edcc');
 assert.equal(QHIM002_PROVENANCE.mergeCommit,'c919288858e8136c7c1651e5976947e5eec2bc60');
 assert.equal(QHIM002_PROVENANCE.baselineCommit,'e1f6da9303e81d8cd781b5e57c9c95f1fd2df7d8');
 // The two independent PR #151 facts that pin the map: its stated sweep of 50
 // historical verifiers with 20 version-scoped catalog reads, and the 21
 // verifier files it actually changed (19 catalog owners + 0021 + 0038; 0037
 // is both a catalog owner and a background owner).
 assert.equal(QHIM002_SWEPT_HISTORICAL_VERIFIERS.length,QHIM002_PROVENANCE.sweptHistoricalVerifiers);
 assert.equal(QHIM002_SWEPT_HISTORICAL_VERIFIERS.length,50);
 assert.equal(QHIM002_OWNED_CATALOG_QUERY_COUNT,QHIM002_PROVENANCE.versionScopedCatalogReads);
 assert.equal(QHIM002_OWNED_CATALOG_QUERY_COUNT,20);
 assert.equal(QHIM002_CATALOG_V1_SCOPE.length,20);
 assert.equal(QHIM002_CATALOG_V1_REMEDIATED.length,19);
 assert.equal(new Set([...QHIM002_CATALOG_V1_REMEDIATED,BACKGROUND_SIGNATURE_OWNER,'verify-migration-0038.mjs']).size,QHIM002_PROVENANCE.remediatedVerifierFiles);
 // Every scope entry is a literal historical filename, and the map is
 // constructed from those literals rather than from the directory.
 for(const rule of QHIM002_RULES)for(const name of rule.scope)assert.ok(QHIM002_SWEPT_HISTORICAL_VERIFIERS.includes(name),`${rule.id} claims ${name}, which PR #151 never swept`);
 assert.deepEqual([...QHIM002_DEFINITION_POPULATION_SCOPE],[...QHIM002_CATALOG_V1_SCOPE],'the definition-population rules are owned by exactly the historical catalog owners, which is why they share one list rather than a second that could drift');
 assert.deepEqual([...QHIM002_BACKGROUND_READER_SCOPE],[...QHIM002_BACKGROUND_NAMESPACE_SCOPE],'the future-reader ban is owned by exactly the three historical background phases');
 assert.doesNotMatch(scope,/deepEqual|deepStrictEqual/,'ownership is never a directory equality');
 assert.doesNotMatch(scope,/startsWith\('verify-'\)/,'ownership is never a live name-prefix scan');
});

test('every owned historical artifact still exists, and additional verifier files are legal',()=>{
 // Existence only. The directory is never compared against the map.
 assert.equal(assertOwnedHistoricalArtifactsExist(),true);
 const present=readdirSync(dir).filter(name=>name.endsWith('.mjs'));
 for(const name of QHIM002_SWEPT_HISTORICAL_VERIFIERS)assert.ok(present.includes(name),`${name} is an owned historical artifact and must exist`);
 assert.ok(present.includes(QHIM002_HARNESS),'the forward-compatibility proof harness exists');
 // A directory that additionally contains ten unrelated future verifiers is
 // still valid: extra entries can never be a failure.
 const extended=[...present,...Object.keys(FUTURE_SOURCES),...Array.from({length:10},(unused,index)=>`verify-migration-${9100+index}.mjs`)];
 assert.equal(assertOwnedHistoricalArtifactsExist(extended),true);
 // A missing owned artifact is still a failure, so this is not a no-op.
 assert.throws(()=>assertOwnedHistoricalArtifactsExist(present.filter(name=>name!==CATALOG_OWNER)),/owned historical artifact\(s\) missing: verify-migration-0010\.mjs/);
});

test('QHIM-002 governs no verifier introduced at or after it, and ownership is not a migration-number cutoff',()=>{
 // The named negative controls: the harness itself, and the two verifiers
 // merged after QHIM-002 by PR #152 and PR #153.
 for(const name of QHIM002_EXCLUDED_BY_PROVENANCE){
  assert.deepEqual(qhim002RulesGoverning(name),[],`${name} must be outside every QHIM-002 historical rule`);
  assert.deepEqual(qhim002Violations(name,readVerifierSource(name)),[],`${name} must not be inspected by QHIM-002`);
 }
 // verify-migration-0052.mjs carries no QHIM-002-owned catalog read at all and
 // verify-migration-0051.mjs carries three of its own, none of which belong to
 // the QHIM-002 historical query set.
 assert.ok(!QHIM002_CATALOG_V1_SCOPE.includes('verify-migration-0051.mjs'));
 assert.ok(!QHIM002_CATALOG_V1_SCOPE.includes('verify-migration-0052.mjs'));
 assert.ok(!Object.keys(QHIM002_EXPECTED_CATALOG_QUERIES).includes('verify-migration-0052.mjs'));
 // Ownership is provenance, so it cannot be a numeric boundary: the verifier
 // numerically just after history is ungoverned, one far after it is
 // ungoverned, one in the middle of history is governed, and two owned
 // historical verifiers carry no migration number at all.
 assert.deepEqual(qhim002RulesGoverning('verify-migration-0053.mjs'),[]);
 assert.deepEqual(qhim002RulesGoverning(FUTURE_V2_CATALOG),[]);
 assert.ok(qhim002RulesGoverning('verify-migration-0049.mjs').includes('CATALOG_V1_SCOPE'));
 assert.deepEqual(qhim002RulesGoverning('verify-exact-version-confidence.mjs'),['MIGRATION_DIRECTORY_ENUMERATION']);
 assert.deepEqual(qhim002RulesGoverning('verify-supabase-auth.mjs'),['MIGRATION_DIRECTORY_ENUMERATION']);
});

test('every owned historical verifier passes every rule its own history owns',()=>{
 for(const name of QHIM002_SWEPT_HISTORICAL_VERIFIERS)assert.deepEqual(qhim002Violations(name,source[name]),[],`${name} violates a QHIM-002 rule it owns`);
 // Each rule is live: it owns at least one real historical file and none of
 // them is an empty set that would make the contract vacuous.
 for(const rule of QHIM002_RULES)assert.ok(rule.scope.length>0,`${rule.id} has no owner`);
 assert.deepEqual(QHIM002_RULES.map(rule=>rule.id).sort(),['BACKGROUND_NAMESPACE_CENSUS','CATALOG_QUERY_VERBATIM','CATALOG_V1_SCOPE','DEFINITION_POPULATION_CEILING','FUTURE_BACKGROUND_READER_BAN','MIGRATION_DIRECTORY_ENUMERATION','PERMANENT_UNCALIBRATED_LIST','SIGNATURE_LIST_CENSUS']);
 assert.deepEqual(QHIM002_RULES.filter(rule=>rule.classification==='C'),[],'no rule was reclassified into deletion');
});

test('future verifier A: a legitimate hse.energy definition_version=2 catalog verifier is accepted',()=>{
 // The exact QHIM-006 acceptance proof. This source reads
 // him_metric_definitions at definition_version=2 and also with a fully
 // parameterised metric/version pair.
 assert.match(futureV2Source,/FROM public\.him_metric_definitions WHERE metric_key='hse\.energy' AND definition_version=2/);
 assert.match(futureV2Source,/WHERE metric_key=\$1 AND definition_version=\$2/);
 assert.deepEqual(qhim002RulesGoverning(FUTURE_V2_CATALOG),[]);
 assert.deepEqual(qhim002Violations(FUTURE_V2_CATALOG,futureV2Source),[]);
 // And the same source is still rejected inside a file QHIM-002 does own, so
 // the historical v1 identity proof was not weakened to achieve this.
 const owned=qhim002Violations(CATALOG_OWNER,futureV2Source);
 assert.ok(owned.some(message=>/without definition_version=1 scoping/.test(message)),'an owned historical catalog owner still requires v1 scoping');
});

test('future verifier B: a future separately reviewed background HIM reader verifier is accepted',()=>{
 assert.match(futureReaderSource,/background_read_him_goal_snapshot_v2/);
 assert.match(futureReaderSource,/background_read_him_relationship_snapshot_v1/);
 assert.deepEqual(qhim002RulesGoverning(FUTURE_BACKGROUND_READER),[]);
 assert.deepEqual(qhim002Violations(FUTURE_BACKGROUND_READER,futureReaderSource),[]);
 // 0037 still may not name a future reader: its own historical contract is
 // intact, it simply no longer speaks for the whole repository.
 assert.deepEqual(qhim002Violations(BACKGROUND_READER_OWNER,futureReaderSource),[`${BACKGROUND_READER_OWNER} names a future background HIM reader as required-to-be-absent`]);
});

test('future verifier C: an independent future contract carrying every previously scanned shape is accepted',()=>{
 // Each shape below would have been rejected by the old directory-wide scan.
 assert.match(futureIndependentSource,/readdirSync/);
 assert.match(futureIndependentSource,/LIKE 'background_%_v1'/);
 assert.match(futureIndependentSource,/rowCount!==signatures\.length/);
 assert.match(futureIndependentSource,/background_read_him_goal_snapshot_v2/);
 assert.match(futureIndependentSource,/FROM public\.him_metric_definitions"/);
 assert.match(futureIndependentSource,/definition_version=3/);
 assert.match(futureIndependentSource,/rows\.length!==17/);
 assert.match(futureIndependentSource,/must remain uncalibrated/);
 assert.deepEqual(qhim002RulesGoverning(FUTURE_INDEPENDENT),[]);
 assert.deepEqual(qhim002Violations(FUTURE_INDEPENDENT,futureIndependentSource),[]);
 assert.deepEqual(violatedRules(FUTURE_INDEPENDENT,futureIndependentSource),[]);
 // The identical source inside owned historical files is still rejected, once
 // per rule class that file's own history owns - and each owned file is
 // judged only by its own classes, which is precisely the QHIM-006 fix.
 assert.deepEqual(violatedRules(CATALOG_OWNER,futureIndependentSource),['CATALOG_V1_SCOPE','DEFINITION_POPULATION_CEILING','MIGRATION_DIRECTORY_ENUMERATION','PERMANENT_UNCALIBRATED_LIST']);
 assert.deepEqual(violatedRules(BACKGROUND_READER_OWNER,futureIndependentSource),['BACKGROUND_NAMESPACE_CENSUS','CATALOG_V1_SCOPE','DEFINITION_POPULATION_CEILING','FUTURE_BACKGROUND_READER_BAN','MIGRATION_DIRECTORY_ENUMERATION','PERMANENT_UNCALIBRATED_LIST','SIGNATURE_LIST_CENSUS']);
 assert.deepEqual(violatedRules(BACKGROUND_SIGNATURE_OWNER,futureIndependentSource),['BACKGROUND_NAMESPACE_CENSUS','FUTURE_BACKGROUND_READER_BAN','MIGRATION_DIRECTORY_ENUMERATION','SIGNATURE_LIST_CENSUS']);
 assert.deepEqual(violatedRules(SWEPT_NON_CATALOG_OWNER,futureIndependentSource),['MIGRATION_DIRECTORY_ENUMERATION']);
 assert.deepEqual(qhim002Violations(SWEPT_NON_CATALOG_OWNER,futureIndependentSource),[`${SWEPT_NON_CATALOG_OWNER} enumerates the migration directory`]);
});

test('owner-scope mutation: the historical v1 catalog rule fails inside its owners and passes outside them',()=>{
 assert.ok(mutate(CATALOG_OWNER,UNSCOPED_CATALOG).some(message=>/without definition_version=1 scoping/.test(message)));
 assert.deepEqual(mutate(CATALOG_OWNER,V1_SCOPED_CATALOG),[]);
 assert.ok(mutate(CATALOG_OWNER,V2_SCOPED_CATALOG).some(message=>/without definition_version=1 scoping/.test(message)));
 assert.ok(mutate(CATALOG_OWNER,INTERPOLATED_CATALOG).some(message=>/interpolated catalog query/.test(message)));
 for(const injection of[UNSCOPED_CATALOG,V2_SCOPED_CATALOG,INTERPOLATED_CATALOG]){
  assert.deepEqual(qhim002Violations(FUTURE_V2_CATALOG,injection),[]);
  assert.deepEqual(qhim002Violations(SWEPT_NON_CATALOG_OWNER,injection),[],'a swept historical verifier that never owned a catalog read is not governed by the catalog rule');
 }
 // Every owned catalog file is really covered, not just the sample.
 for(const name of QHIM002_CATALOG_V1_SCOPE)assert.ok(qhim002Violations(name,`${source[name]}\n${UNSCOPED_CATALOG}\n`).some(message=>/without definition_version=1 scoping/.test(message)),`${name} must still reject an unscoped catalog read`);
});

test('owner-scope mutation: definition-population ceilings fail inside their owners and exact owned cardinality stays legal',()=>{
 assert.ok(mutate(CATALOG_OWNER,GLOBAL_SEVENTEEN).some(message=>/freezes the global seventeen-definition universe/.test(message)));
 assert.ok(mutate(CATALOG_OWNER,GLOBAL_DEFINITION_COUNT).some(message=>/freezes a global definition count/.test(message)));
 assert.ok(mutate(CALIBRATION_OWNER,PERMANENT_UNCALIBRATED).some(message=>/freezes a permanent uncalibrated list/.test(message)));
 assert.deepEqual(mutate(CATALOG_OWNER,OWNED_CARDINALITY),[],'an explicitly enumerated canonical identity count stays legal inside history');
 for(const injection of[GLOBAL_SEVENTEEN,GLOBAL_DEFINITION_COUNT,PERMANENT_UNCALIBRATED])assert.deepEqual(qhim002Violations(FUTURE_V2_CATALOG,injection),[],'a future verifier may own its own exact cardinality and calibration statements');
 for(const name of QHIM002_DEFINITION_POPULATION_REMEDIATED)assert.ok(qhim002Violations(name,`${source[name]}\n${GLOBAL_SEVENTEEN}\n`).some(message=>/seventeen-definition universe/.test(message)),`${name} must still reject a global seventeen-row freeze`);
});

test('owner-scope mutation: background namespace census rules fail inside 0021/0037/0038 and pass outside them',()=>{
 for(const name of QHIM002_BACKGROUND_NAMESPACE_SCOPE){
  assert.ok(qhim002Violations(name,`${source[name]}\n${NAMESPACE_CENSUS}\n`).some(message=>/background_% namespace census/.test(message)),`${name} must still reject a namespace census`);
  assert.ok(qhim002Violations(name,`${source[name]}\n${PRONAME_PATTERN}\n`).some(message=>/matches the live function namespace by pattern/.test(message)),`${name} must still reject a proname pattern match`);
  assert.ok(qhim002Violations(name,`${source[name]}\n${SIGNATURE_CENSUS}\n`).some(message=>/census equality against a historical signature list/.test(message)),`${name} must still reject signature census equality`);
  assert.deepEqual(qhim002Violations(name,`${source[name]}\n${EXACT_SIGNATURE}\n`),[],`${name} may still inspect its exact owned signatures`);
  assert.deepEqual(qhim002Violations(name,`${source[name]}\n${EXISTING_READER_NAME}\n`),[],`${name} may still name the one reader 0037 owns`);
 }
 for(const injection of[NAMESPACE_CENSUS,PRONAME_PATTERN,SIGNATURE_CENSUS])for(const name of[FUTURE_BACKGROUND_READER,FUTURE_INDEPENDENT])assert.deepEqual(qhim002Violations(name,injection),[],'a future verifier may census its own function surface');
});

test('owner-scope mutation: the future-background-reader ban applies only to the background phases that owned it',()=>{
 for(const name of QHIM002_BACKGROUND_READER_SCOPE)assert.deepEqual(qhim002Violations(name,`${source[name]}\n${FUTURE_READER_NAME}\n`),[`${name} names a future background HIM reader as required-to-be-absent`]);
 assert.deepEqual(qhim002Violations(FUTURE_BACKGROUND_READER,FUTURE_READER_NAME),[]);
 assert.deepEqual(qhim002Violations('verify-migration-0053.mjs',FUTURE_READER_NAME),[]);
 // The rule is a ban on declaring future readers absent, never a ban on the
 // one reader that exists.
 for(const name of QHIM002_BACKGROUND_READER_SCOPE)assert.deepEqual(qhim002Violations(name,`${source[name]}\n${EXISTING_READER_NAME}\n`),[]);
});

test('owner-scope mutation: migration-directory enumeration stays banned across the swept history and legal beyond it',()=>{
 for(const name of[CATALOG_OWNER,BACKGROUND_SIGNATURE_OWNER,SWEPT_NON_CATALOG_OWNER,'verify-supabase-auth.mjs'])assert.ok(qhim002Violations(name,`${source[name]}\n${MIGRATION_ENUMERATION}\n`).some(message=>/enumerates the migration directory/.test(message)),`${name} must still reject migration enumeration`);
 assert.equal(QHIM002_MIGRATION_ENUMERATION_SCOPE.length,50);
 for(const name of[FUTURE_V2_CATALOG,FUTURE_INDEPENDENT,'verify-migration-0053.mjs',...QHIM002_EXCLUDED_BY_PROVENANCE])assert.deepEqual(qhim002Violations(name,MIGRATION_ENUMERATION),[],`${name} may enumerate migrations freely`);
});

test('the harness derives its historical query set from the same ownership map, never from the directory',()=>{
 // One shared scope source: both this contract and the harness import the same
 // module, and the harness performs no directory discovery at all.
 assert.match(harness,/from'\.\/him-historical-verifier-forward-compatibility-scope-v1\.mjs'/,'the harness imports the shared ownership map');
 assert.doesNotMatch(harnessCode,/readdirSync|readdir\(/,'the harness no longer enumerates the verifier directory');
 assert.doesNotMatch(harnessCode,/catalogQueries\.length\s*<\s*\d/,'the harness no longer defines ownership by a minimum query count');
 assert.match(harnessCode,/collectOwnedCatalogQueries/,'the harness collects only owned historical queries');
 assert.match(harnessCode,/QHIM002_OWNED_CATALOG_QUERY_COUNT/,'the harness pins its query set to the exact owned identity count');
 assert.match(harnessCode,/is outside its historical ownership map/,'the harness proves it never reads an unowned file');
 // The mechanical proof, run here against the real sources: the collector is
 // asked for exactly the owned catalog files, in map order, and nothing else.
 const consulted=[];
 const collected=collectOwnedCatalogQueries(name=>{consulted.push(name);return readVerifierSource(name);});
 assert.deepEqual(consulted,[...QHIM002_CATALOG_V1_SCOPE]);
 assert.equal(collected.length,QHIM002_OWNED_CATALOG_QUERY_COUNT);
 for(const query of collected)assert.match(query.sql,/definition_version=1/);
 // Adding unrelated future verifier sources - including ones whose catalog
 // reads are deliberately non-v1 - cannot change the harness's query set,
 // because those files are never consulted.
 const withFutureFiles={...Object.fromEntries(QHIM002_SWEPT_HISTORICAL_VERIFIERS.map(name=>[name,source[name]])),...FUTURE_SOURCES,'verify-migration-0053.mjs':futureV2Source};
 const afterFutureFiles=collectOwnedCatalogQueries(name=>withFutureFiles[name]);
 assert.deepEqual(afterFutureFiles,collected,'a future verifier source cannot alter the owned historical query set');
 // And the collector still fails closed if an owned file drifts.
 assert.throws(()=>collectOwnedCatalogQueries(name=>name===CATALOG_OWNER?`${source[name]}\n${UNSCOPED_CATALOG}\n`:source[name]),/without definition_version=1 scoping/);
 assert.throws(()=>collectOwnedCatalogQueries(name=>name===CATALOG_OWNER?'// no catalog read at all\n':source[name]),/declares exactly 1/);
});

test('the removed ceilings are replaced by explicitly scoped canonical v1 identity proofs, not deleted',()=>{
 // Anti-weakening: the remediation must not be satisfiable by deleting the
 // assertion. Each remediated catalog verifier must still prove the canonical
 // v1 inventory it owned, scoped to definition_version=1.
 for(const name of QHIM002_ANTI_WEAKENING_SCOPE.catalogIdentityOwners){
  assert.match(code[name],/CANONICAL_V1/,`${name} must still prove the canonical v1 inventory`);
  assert.match(code[name],/definition_version=1/,`${name} must scope its catalog read to v1`);
  for(const key of QHIM002_ANTI_WEAKENING_SCOPE.requiredCanonicalKeys)assert.ok(code[name].includes(key),`${name} must still enumerate the canonical v1 identity ${key}`);
 }
 assert.match(code[CATALOG_OWNER],/metric_key=ANY\(\$1::text\[\]\)/,'0010 queries only the canonical v1 identities');
 assert.match(code[CATALOG_OWNER],/RESOLVED'\)\.length,6/,'0010 still proves the v1 resolved semantic distribution within those identities');
 assert.match(code[CATALOG_OWNER],/semantic_type===null\)\.length,11/,'0010 still proves the v1 unresolved semantic distribution within those identities');
 assert.match(code[CATALOG_OWNER],/hrs\.relationship-trust/,'0010 keeps the Trust identity check');
 assert.match(code[CATALOG_OWNER],/canonical_name,'Confidence'/,'0010 keeps the Self-Confidence identity check');
 // 0010 must still assert something exact about the generic RPC it introduced.
 // Its authority was later retired (QHIM-003), so what it proves is now the
 // retirement contract rather than a successful write - later security
 // hardening is deliberately allowed here, while the QHIM-002 future-ceiling
 // rules above stay fully enforced for this file.
 assert.match(code[CATALOG_OWNER],/create_him_metric_snapshot/,'0010 keeps an exact generic-RPC authority check');
 const calibration=code[QHIM002_ANTI_WEAKENING_SCOPE.calibrationScopeOwner];
 assert.match(calibration,/HSE_V1/,'0011 scopes its calibration proof to the five canonical HSE v1 identities');
 assert.match(calibration,/ordinal-5\.v1/,'0011 proves each exact v1 calibrated scale rather than a global count');
 assert.match(calibration,/role_table_grants/,'0011 keeps its RLS/privilege guarantees');
 assert.match(calibration,/him_calibration_evaluations/,'0011 keeps its calibration-table guarantee');
 // The canonical identity set the historical proofs share is itself frozen.
 assert.equal(QHIM002_CANONICAL_V1_KEYS.length,17);
});

test('the owned background function authority contracts survive the census removal',()=>{
 const v0021=code[QHIM002_ANTI_WEAKENING_SCOPE.backgroundSignatureOwner];
 for(const signature of QHIM002_OWNED_BACKGROUND_SIGNATURES)assert.ok(v0021.includes(signature),`0021 must still inspect the exact owned signature ${signature}`);
 assert.match(v0021,/has_function_privilege\('service_role'/,'0021 keeps the service_role EXECUTE proof');
 assert.match(v0021,/row\.authenticated\|\|row\.anon\|\|row\.public/,'0021 keeps the authenticated/anon/PUBLIC denial proof');
 assert.match(v0021,/pg_get_functiondef\(\$1::regprocedure\)/,'0021 inspects each owned signature individually');
 assert.match(v0021,/auth\\\.uid/,'0021 keeps the explicit-service-authority (no auth.uid) proof per owned signature');
 const v0037=code[QHIM002_ANTI_WEAKENING_SCOPE.backgroundReaderOwner];
 assert.match(v0037,/Expected exactly one public\./,'0037 keeps its exact owned function existence checks');
 assert.match(v0037,/read_him_intelligence_snapshot_core_v1\\\(p_user_id,'CONVERSATION_SESSION',p_session_id::text\\\)/,'0037 keeps the CONVERSATION_SESSION-only delegation proof');
 assert.match(v0037,/auth\\\.uid\|request\\\.jwt\|set_config\|current_setting/,'0037 keeps the no-JWT-reconstruction proof');
 assert.match(v0037,/routine_privileges/,'0037 keeps the exact ACL proofs');
 assert.match(v0037,/service_role'&&g\.privilege_type==='EXECUTE'/,'0037 keeps the service_role-only background grant proof');
 const v0038=code[QHIM002_ANTI_WEAKENING_SCOPE.backgroundPhaseOwner];
 for(const signature of QHIM002_ANTI_WEAKENING_SCOPE.v0038OwnedSignatures)assert.ok(v0038.includes(signature),`0038 must still inspect the exact owned signature ${signature}`);
 assert.match(v0038,/has_function_privilege\('service_role'/,'0038 keeps its exact ACL proofs');
});

test('the phases that owned no new background command prove it from their frozen migration text, never from the live universe',()=>{
 // The true invariant behind the removed censuses: 0037 introduced exactly one
 // background HIM reader and 0038 introduced no background command at all.
 // Both are facts about the frozen migration text and are proven here.
 for(const[name,expected]of Object.entries(QHIM002_ANTI_WEAKENING_SCOPE.frozenBackgroundMigrations)){
  const migration=readFileSync(new URL(`migrations/${name}`,dir),'utf8');
  const created=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(background_[a-z0-9_]+)/g)].map(match=>match[1]);
  assert.deepEqual(created,[...expected],`${name} creates exactly its owned background functions`);
 }
});

test('the proof harness is itself forward-safe: collision-safe fixtures and baseline-relative residue',()=>{
 // The harness is excluded from the historical rule set because it must create
 // synthetic future objects, so it carries its own guard: it may not assume a
 // fixed future definition version or a fixed future function name is
 // permanently available, and it may not measure residue by requiring every
 // non-v1 version of a metric to be absent.
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
 assert.match(packageJson.scripts['verify:him-historical-verifier-forward-compatibility:integration'],new RegExp(`--env-file-if-exists=\\.env database/${QHIM002_HARNESS.replace(/[.]/g,'\\.')}`));
 const ci=readFileSync(new URL('../../.github/workflows/api-ci.yml',import.meta.url),'utf8');
 const step=ci.indexOf('verify:him-historical-verifier-forward-compatibility:integration');
 assert.ok(step>0,'CI runs the forward-compatibility verifier');
 assert.ok(step>ci.indexOf('verify:him-structured-current-binding-transition-safety:integration'),'it runs after the 0050 verifier');
 assert.ok(step>ci.indexOf('verify:hgs-habit-strength:integration'),'it runs after the historical measurement verifier chain');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend consumption check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot consumption check');
});

test('the remediation is verifier-only: no migration is added and QHIM-001 stays intact',()=>{
 const migrations=readdirSync(new URL('migrations/',dir)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0050_him_structured_current_binding_transition_safety_v1.sql'),'the QHIM-001 migration is preserved');
 // Historical prefix uniqueness through the canonical latest migration. This
 // is an ordering statement about migrations that exist, never a ceiling on
 // later ones: nothing here asserts that 0053 must not exist.
 for(let n=1;n<=52;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 // QHIM-001's selection contract is untouched by this verifier-only sweep.
 const view=readFileSync(new URL('migrations/0050_him_structured_current_binding_transition_safety_v1.sql',dir),'utf8');
 assert.match(view,/SELECT DISTINCT ON\(s\.measurement_observation_id\)/,'the QHIM-001 one-row-per-observation selection is preserved');
 assert.match(view,/him_active_structured_binding_id/,'the QHIM-001 ACTIVE-binding preference is preserved');
 assert.match(code[SWEPT_NON_CATALOG_OWNER],/him_active_structured_binding_id/,'the QHIM-001 verifier is preserved');
 // QHIM-005/QHIM-007: migration 0052 and its verifier are outside this task
 // and outside QHIM-002 ownership; their canonical-latest read semantics are
 // untouched here.
 assert.ok(migrations.includes('0052_him_canonical_latest_measurement_read_semantics_v1.sql'),'the QHIM-005/QHIM-007 migration is preserved');
 assert.match(readVerifierSource('verify-migration-0052.mjs'),/read_him_latest_measurement_v1/,'the QHIM-005/QHIM-007 verifier is preserved unchanged');
});
