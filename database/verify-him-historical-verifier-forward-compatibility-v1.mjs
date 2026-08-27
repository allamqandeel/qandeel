// Real-PostgreSQL forward-extension proof for the QHIM-002 historical
// verifier sweep. Inside one rollback-safe transaction it creates synthetic
// FUTURE extension fixtures that would have broken the pre-remediation
// historical verifiers - a later definition version of an existing canonical
// metric, and two synthetic functions whose names deliberately enter the
// formerly frozen background_%_v1 and background_read_him% namespaces - and
// proves the remediated historical contracts still identify their exact owned
// canonical v1 definitions and their exact owned background functions without
// treating the extra objects as failure.
//
// OWNER SCOPE (QHIM-006). This harness proves QHIM-002's history, and only
// QHIM-002's history. Its proof universe is the explicit frozen ownership map
// in ./him-historical-verifier-forward-compatibility-scope-v1.mjs, derived
// from the merged PR #151 remediation - never a directory listing, never a
// migration-number cutoff, never a name prefix. It previously discovered its
// subject files with a live scan of every verify-*.mjs in this directory and
// then applied historical-v1 semantics to all of them, which meant a future
// verifier legitimately owning hse.energy@2 would have been failed for reading
// definition_version=2. The ownership map ends that: the collector below is
// asked only for the exact historical catalog owners, each must yield exactly
// the number of owned reads the map declares, and both facts are proven here
// rather than assumed, so no present or future verifier file can add to,
// remove from, or reorder this harness's historical query set.
//
// This harness must itself obey the QHIM-002 policy it exists to enforce, so
// every fixture is collision-safe and every residue check is baseline
// relative. The synthetic definition version is derived from the live maximum
// Energy version rather than hard-coded, the probe function names carry a
// unique suffix proven unused at generation time, and rollback is verified by
// comparing the captured pre-fixture state - never by asserting that no
// legitimate non-v1 Energy definition may exist. The proof therefore still
// passes once canonical main legitimately contains hse.energy@2 or @3, and
// phase B below establishes exactly that state and proves it.
//
// Method (as required when direct child execution is unsafe): the historical
// verifier scripts are NOT spawned as child processes, because their fixtures
// live inside this transaction and would be invisible to another connection,
// while committing them would pollute the shared CI database for every later
// verifier step. Instead this proof combines (1) exact static proof of every
// owned historical verifier query, extracted verbatim from the owned verifier
// sources, and (2) real-PostgreSQL execution of those exact extracted query
// strings against the fixture-extended database, comparing each result before
// and after the synthetic future objects exist.
import pg from'pg';import{randomUUID}from'node:crypto';
import{QHIM002_SWEPT_HISTORICAL_VERIFIERS,QHIM002_CATALOG_V1_SCOPE,QHIM002_OWNED_CATALOG_QUERY_COUNT,QHIM002_CANONICAL_V1_KEYS,QHIM002_HSE_V1_KEYS,QHIM002_OWNED_BACKGROUND_SIGNATURES,QHIM002_PROVENANCE,assertOwnedHistoricalArtifactsExist,collectOwnedCatalogQueries,qhim002RulesGoverning,qhim002Violations,readVerifierSource}from'./him-historical-verifier-forward-compatibility-scope-v1.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const CANONICAL_V1=QHIM002_CANONICAL_V1_KEYS;
const HSE_V1=QHIM002_HSE_V1_KEYS;
const OWNED_BACKGROUND=QHIM002_OWNED_BACKGROUND_SIGNATURES;
const EXTENDED_METRIC='hse.energy';
// Existence only: every historical artifact QHIM-002 owns must still be here.
// The directory is never compared against the map, counted, or required to
// contain nothing else - extra verifier files are expected and legal.
assertOwnedHistoricalArtifactsExist();
// Static proof, applied to each owned historical file under exactly the rules
// that file's history owns. A file outside the map is governed by no rule at
// all, so it cannot be inspected or failed here.
for(const name of QHIM002_SWEPT_HISTORICAL_VERIFIERS){
 const violations=qhim002Violations(name,readVerifierSource(name));
 if(violations.length)throw new Error(violations.join('; '));
}
// The historical proof universe, fixed by ownership rather than by directory
// contents: the collector is asked only for the exact catalog owners, in the
// map's order, and each must contribute exactly its declared owned read count.
const catalogQueries=collectOwnedCatalogQueries(readVerifierSource);
// Proof that the previous sentence is mechanically true rather than asserted:
// a reader that refuses anything outside the ownership map still produces the
// identical query set, and the exact sequence of files consulted is the map
// itself. Adding ten unrelated future verifier sources to this directory
// therefore cannot change catalogQueries at all - they would never be read.
const consulted=[];
const ownedOnly=name=>{
 if(!QHIM002_CATALOG_V1_SCOPE.includes(name))throw new Error(`The QHIM-002 harness read ${name}, which is outside its historical ownership map`);
 consulted.push(name);return readVerifierSource(name);
};
const ownershipFixed=collectOwnedCatalogQueries(ownedOnly);
if(consulted.join('\n')!==QHIM002_CATALOG_V1_SCOPE.join('\n'))throw new Error('The QHIM-002 harness did not derive its proof universe from the historical ownership map');
if(JSON.stringify(ownershipFixed)!==JSON.stringify(catalogQueries)||catalogQueries.length!==QHIM002_OWNED_CATALOG_QUERY_COUNT||catalogQueries.length!==QHIM002_PROVENANCE.versionScopedCatalogReads)throw new Error('The QHIM-002 owned historical catalog query set is not exactly the PR #151 sweep result');
if(qhim002RulesGoverning('verify-migration-0051.mjs').length||qhim002RulesGoverning('verify-migration-0052.mjs').length)throw new Error('A verifier introduced after QHIM-002 is being governed by QHIM-002 historical rules');
// Key-scoped historical queries are all executed with the canonical v1 key set
// (a superset of any narrower historical scope such as the five HSE keys), so
// every extracted query is compared under identical inputs.
const run=async({sql})=>(await client.query(sql,sql.includes('$1::text[]')?[CANONICAL_V1]:[])).rows;
const snapshotCatalog=async()=>{const out=[];for(const query of catalogQueries)out.push({name:query.name,sql:query.sql,rows:await run(query)});return out;};
const ownedBackgroundState=async()=>{const out=[];for(const signature of OWNED_BACKGROUND){const{rows:[row]}=await client.query("SELECT pg_get_functiondef($1::regprocedure) definition,has_function_privilege('service_role',$1,'EXECUTE') service,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('public',$1,'EXECUTE') public",[`public.${signature}`]);out.push({signature,...row});}return out;};
const census=async pattern=>Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND p.proname LIKE $1",[pattern])).rows[0].n);
const definitionCount=async()=>Number((await client.query('SELECT count(*)::int n FROM public.him_metric_definitions')).rows[0].n);
// The live version population of the extended metric, captured as data rather
// than assumed: any number of legitimate later versions may already exist.
const metricVersions=async()=>(await client.query('SELECT definition_version FROM public.him_metric_definitions WHERE metric_key=$1 ORDER BY definition_version',[EXTENDED_METRIC])).rows.map(row=>row.definition_version);
const captureState=async()=>({catalog:await snapshotCatalog(),owned:await ownedBackgroundState(),definitions:await definitionCount(),versions:await metricVersions(),background:await census('background\\_%\\_v1'),himReader:await census('background\\_read\\_him%')});
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const assertRestored=(actual,expected,label)=>{
 for(const key of ['definitions','versions','background','himReader','catalog','owned'])if(!same(actual[key],expected[key]))throw new Error(`${label}: ${key} did not return to the captured pre-fixture baseline`);
};
// A synthetic version that cannot collide with any legitimate version already
// present, derived from the live maximum rather than hard-coded.
const nextSyntheticVersion=versions=>versions.reduce((highest,version)=>Math.max(highest,version),0)+1;
// Probe names that deliberately enter the formerly frozen namespaces while
// being proven unused at generation time, so no fixed future function name is
// ever assumed to be permanently available.
const uniqueProbeNames=async()=>{
 for(let attempt=0;attempt<8;attempt++){
  const suffix=randomUUID().replace(/-/g,'').slice(0,8);
  const names=[`background_forward_compat_probe_${suffix}_v1`,`background_read_him_forward_compat_probe_${suffix}_v1`];
  if(names.some(name=>!/^[a-z][a-z0-9_]{0,62}$/.test(name)))continue;
  const taken=Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND p.proname=ANY($1::name[])",[names])).rows[0].n);
  if(taken===0)return names;
 }
 throw new Error('Could not generate collision-free synthetic probe function names');
};
const createFutureVersion=async version=>{
 await client.query("INSERT INTO public.him_metric_definitions SELECT (jsonb_populate_record(NULL::public.him_metric_definitions,to_jsonb(d)||jsonb_build_object('definition_version',$1::integer))).* FROM public.him_metric_definitions d WHERE d.metric_key=$2 AND d.definition_version=1",[version,EXTENDED_METRIC]);
 const created=await client.query('SELECT calculation_status FROM public.him_metric_definitions WHERE metric_key=$1 AND definition_version=$2',[EXTENDED_METRIC,version]);
 if(created.rowCount!==1)throw new Error(`The ${EXTENDED_METRIC} future definition version ${version} was not created`);
};
// The full forward-extension proof, run once against today's canonical state
// and once against a state that already contains a legitimate later Energy
// version. `reference` is always the true pre-fixture baseline, so the
// version-scoped historical queries must match it in both phases.
const forwardExtensionProof=async(baseline,reference,label)=>{
 const version=nextSyntheticVersion(baseline.versions);
 if(baseline.versions.includes(version))throw new Error(`${label}: the derived synthetic version collides with a live version`);
 await createFutureVersion(version);
 const versions=await metricVersions();
 const added=versions.filter(candidate=>!baseline.versions.includes(candidate));
 if(added.length!==1||added[0]!==version)throw new Error(`${label}: the synthetic future version did not add exactly one new version`);
 if(baseline.versions.some(candidate=>!versions.includes(candidate)))throw new Error(`${label}: a pre-existing legitimate version disappeared when the synthetic fixture was created`);
 if(await definitionCount()!==baseline.definitions+1)throw new Error(`${label}: the synthetic future version did not increase the definition population by exactly one`);
 const probes=await uniqueProbeNames();
 for(const name of probes)await client.query(`CREATE FUNCTION public.${name}() RETURNS integer LANGUAGE sql IMMUTABLE AS $probe$SELECT 1$probe$`);
 if(await census('background\\_%\\_v1')!==baseline.background+2||await census('background\\_read\\_him%')!==baseline.himReader+1)throw new Error(`${label}: the synthetic probes did not enter the formerly frozen namespaces`);
 // The fixtures are meaningful: each one changes exactly the global universe
 // the pre-remediation verifiers froze, so every proof below would have failed
 // before this remediation.
 // --- Proof 1: every owned historical catalog query is version scoped -------
 const catalog=await snapshotCatalog();
 if(catalog.length!==reference.catalog.length)throw new Error(`${label}: the owned historical catalog query set changed`);
 for(let index=0;index<catalog.length;index++){
  const expected=reference.catalog[index],actual=catalog[index];
  if(actual.sql!==expected.sql)throw new Error(`${label}: catalog query drift between snapshots`);
  if(!same(actual.rows,expected.rows))throw new Error(`${label}: ${actual.name} changed its result once a later ${EXTENDED_METRIC} definition version existed: the historical query is not version scoped`);
  if('metric_key'in(actual.rows[0]??{})&&actual.rows.filter(row=>row.metric_key===EXTENDED_METRIC).length>1)throw new Error(`${label}: ${actual.name} resolved more than one ${EXTENDED_METRIC} identity`);
 }
 // --- Proof 2: the owned background authority is unchanged by the probes -----
 const owned=await ownedBackgroundState();
 if(!same(owned,reference.owned))throw new Error(`${label}: the exact owned background function authority changed once synthetic future functions existed`);
 for(const row of owned){
  if(/auth\.uid\s*\(/i.test(row.definition))throw new Error(`${label}: ${row.signature} derives auth.uid()`);
  if(!row.service||row.authenticated||row.anon||row.public)throw new Error(`${label}: ${row.signature} ACL mismatch`);
 }
 // --- Proof 3: the canonical v1 inventory still resolves exactly -------------
 const inventory=(await client.query('SELECT metric_key,calculation_status FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[]) ORDER BY metric_key',[CANONICAL_V1])).rows;
 if(inventory.length!==CANONICAL_V1.length||CANONICAL_V1.some(key=>!inventory.some(row=>row.metric_key===key&&row.calculation_status==='CALIBRATED')))throw new Error(`${label}: the canonical v1 inventory no longer resolves exactly with a future version present`);
 if((await client.query('SELECT metric_key FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[])',[HSE_V1])).rowCount!==HSE_V1.length)throw new Error(`${label}: the five canonical HSE v1 calibration identities no longer resolve exactly`);
 // --- Proof 4: QHIM-001 structured currentness is untouched -------------------
 const view=(await client.query("SELECT pg_get_viewdef('public.him_current_structured_measurements'::regclass) def")).rows[0].def;
 if(!view.includes('DISTINCT ON')||!view.includes('him_active_structured_binding_id'))throw new Error(`${label}: QHIM-001 structured-current selection regressed`);
 if(CANONICAL_V1.some(key=>!view.includes(key)))throw new Error(`${label}: QHIM-001 seventeen-route structured-current view regressed`);
 return{version,probes};
};
await client.connect();try{
 await client.query('BEGIN');
 const baseline=await captureState();
 for(const entry of baseline.catalog){
  const keys=entry.rows.filter(row=>'metric_key'in row).map(row=>row.metric_key);
  if(keys.length&&CANONICAL_V1.some(key=>!keys.includes(key))&&/metric_key=ANY/.test(entry.sql))throw new Error(`${entry.name} does not resolve the canonical v1 inventory before the future fixtures exist`);
 }
 if(baseline.owned.some(row=>!row.definition||!row.service||row.authenticated||row.anon||row.public))throw new Error('Baseline owned background authority failed');
 // --- Phase A: today's canonical state ----------------------------------------
 await client.query('SAVEPOINT phase_a');
 const phaseA=await forwardExtensionProof(baseline,baseline,'phase A');
 await client.query('ROLLBACK TO SAVEPOINT phase_a');
 assertRestored(await captureState(),baseline,'phase A rollback');
 // --- Phase B: a legitimate later Energy definition already exists ------------
 // The harness must stay correct once canonical main itself carries a reviewed
 // hse.energy@2 (or @3). That state is established here as an outer fixture,
 // and the proof then runs against it: the synthetic version must be chosen
 // around the pre-existing one, the pre-existing one must survive the
 // synthetic rollback, and the version-scoped historical queries must still
 // match the true pre-fixture baseline.
 await client.query('SAVEPOINT phase_b');
 const legitimate=nextSyntheticVersion(baseline.versions);
 await createFutureVersion(legitimate);
 const canonicalFuture=await captureState();
 if(!canonicalFuture.versions.includes(legitimate)||canonicalFuture.versions.length!==baseline.versions.length+1)throw new Error('The pre-existing legitimate future Energy definition was not established');
 if(!same(canonicalFuture.catalog,baseline.catalog))throw new Error('A legitimate later Energy definition perturbed a version-scoped historical query');
 await client.query('SAVEPOINT phase_b_proof');
 const phaseB=await forwardExtensionProof(canonicalFuture,baseline,'phase B');
 if(phaseB.version===legitimate)throw new Error('The harness selected the pre-existing legitimate future version as its synthetic fixture');
 if(phaseB.version<=Math.max(...canonicalFuture.versions))throw new Error('The harness did not select a synthetic version above every live version');
 if(same(phaseB.probes,phaseA.probes))throw new Error('The synthetic probe names were not generated uniquely per run');
 await client.query('ROLLBACK TO SAVEPOINT phase_b_proof');
 // The synthetic fixture is gone; the pre-existing legitimate version survives.
 const afterProof=await captureState();
 assertRestored(afterProof,canonicalFuture,'phase B rollback');
 if(!afterProof.versions.includes(legitimate))throw new Error('The pre-existing legitimate future Energy definition did not survive the synthetic rollback');
 if(afterProof.versions.includes(phaseB.version))throw new Error('The synthetic future version did not roll back');
 await client.query('ROLLBACK TO SAVEPOINT phase_b');
 assertRestored(await captureState(),baseline,'phase B outer rollback');
 await client.query('ROLLBACK');
 // --- Baseline-relative zero residue -----------------------------------------
 // Residue is measured against the captured pre-fixture state, never by
 // asserting that no legitimate non-v1 Energy version may exist.
 const residual=await captureState();
 assertRestored(residual,baseline,'final rollback');
 for(const name of[...phaseA.probes,...phaseB.probes])if(Number((await client.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace WHERE nsp.nspname='public' AND p.proname=$1",[name])).rows[0].n)!==0)throw new Error(`Synthetic probe ${name} did not roll back`);
 for(const version of[phaseA.version,phaseB.version,legitimate])if(!baseline.versions.includes(version)&&residual.versions.includes(version))throw new Error(`Synthetic ${EXTENDED_METRIC} version ${version} did not roll back`);
}finally{try{await client.query('ROLLBACK');}catch{}await client.end();}
console.log(`Verified HIM historical verifier forward compatibility (QHIM-002), scoped to the ${QHIM002_SWEPT_HISTORICAL_VERIFIERS.length} historical verifiers PR #${QHIM002_PROVENANCE.pullRequest} actually swept: the ${QHIM002_OWNED_CATALOG_QUERY_COUNT} owned historical catalog queries are drawn from the explicit ownership map rather than from whatever verifier files exist, each is version scoped and returns a byte-identical result while a later Energy definition version exists, no owned background phase takes a live function-namespace census, the exact owned background command signatures keep their definitions and service-role-only ACLs with no auth.uid() while uniquely named synthetic functions occupy the formerly frozen background_%_v1 and background_read_him% namespaces, the canonical seventeen v1 identities and the five HSE v1 calibration identities still resolve exactly, and QHIM-001 structured-current selection is untouched. Ownership is provenance, not directory contents: the collector is proven to consult exactly the owned catalog files in map order, so later verifiers - verify-migration-0051.mjs and verify-migration-0052.mjs today, any future verifier tomorrow - are governed by no QHIM-002 rule and cannot alter this proof. The harness is forward-safe itself: the synthetic version is derived from the live maximum rather than hard-coded, probe names are generated unique and proven unused, and the proof is re-run against a state that already contains a legitimate later Energy definition - which is selected around, survives the synthetic rollback untouched, and leaves the version-scoped historical queries byte-identical - with zero residue measured against the captured pre-fixture baseline rather than by requiring every non-v1 version to be absent.`);
