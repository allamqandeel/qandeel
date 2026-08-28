// Real-PostgreSQL forward-compatibility proof for QHIM-009: historical
// verifiers must not freeze the ACTIVE-binding universe across definition
// versions. The canonical uniqueness authority is versioned -
// (metric_key,definition_version,context_kind) WHERE status='ACTIVE' - so a
// legitimate future hse.energy@N ACTIVE binding may coexist with the
// canonical hse.energy@1 ACTIVE binding for the same context. Inside one
// rollback-safe transaction this harness instantiates, for EVERY canonical v1
// metric the owned historical selectors assert, the full future stack the old
// QHIM-002 proof never built (which is exactly why QHIM-009 stayed
// invisible): a future definition version, a future CALIBRATED PRODUCTION
// calculation model targeting that exact version, a future governance
// approval approving that exact model, and future ACTIVE bindings for every
// context the metric currently has ACTIVE at v1 - activated through the
// protected lifecycle path - then proves every owned historical binding query
// returns a byte-identical result, and that the same query with its
// definition_version=1 predicate removed demonstrably breaks.
//
// OWNER SCOPE. The proof universe is the explicit frozen ownership map in
// ./him-historical-binding-version-forward-compatibility-scope-v1.mjs,
// derived from the QHIM-009 closure audit at PR #154's canonical baseline -
// never a directory listing, never a migration-number cutoff, never a name
// prefix. The collector is asked only for the exact owner files, each must
// contribute exactly the owned queries the map declares verbatim, and both
// facts are proven here rather than assumed, so no present or future
// verifier file can add to, remove from, or reorder this harness's
// historical query set. A future verifier that owns definition_version=2 is
// governed by no rule here merely because its file exists.
//
// FIXTURE ENVIRONMENT. The production structured binding CHECK and the
// binding validator trigger are intentionally v1 unions today; a real future
// version migration would extend them. To instantiate later binding
// identities this harness transactionally widens the CHECK - derived from
// the LIVE canonical constraint definition, never from migration 0012's
// original - with one narrow non-v1 branch, and transactionally disables the
// v1-specific validator trigger during synthetic future insertion and
// activation only, while the generic protected lifecycle mutation guard
// (him_energy_binding_guard) stays enabled throughout, so every future
// binding still reaches ACTIVE exclusively through
// activate_him_canonical_model_binding's authorized transition. Everything
// is savepoint/rollback-scoped: the CHECK definition, the trigger enablement
// state, and every row are proven byte-identical to the captured pre-fixture
// baseline afterwards. Nothing durable is written and no migration changes.
//
// The harness obeys the policy it enforces: every synthetic future version is
// derived from the live per-metric maximum rather than hard-coded, every
// synthetic model/approval identity carries a suffix proven unused at
// generation time, and phase B re-runs the whole proof against a state that
// already contains a legitimate later Energy definition + calibrated model +
// approval + ACTIVE binding - which must be selected around, must survive the
// synthetic rollback untouched, and must leave the version-scoped historical
// queries byte-identical.
//
// RESULT NORMALIZATION: none. Every owned historical query result is
// compared as the exact JSON of its rows - definition_version, binding
// identity, context, model identity, timestamps, every column the historical
// assertion owns - because the owned queries read only durable canonical
// rows whose values are fixture-independent. No identity field is dropped.
import pg from'pg';import{randomUUID}from'node:crypto';
import{QHIM009_BINDING_V1_OWNER_FILES,QHIM009_CANONICAL_V1_METRICS,QHIM009_EXCLUDED_FUTURE_CONTROLS,QHIM009_OWNED_QUERY_COUNT,QHIM009_PROVENANCE,QHIM009_VERSION_EXACT_AT_AUDIT,assertOwnedHistoricalArtifactsExist,collectOwnedBindingQueries,qhim009RulesGoverning,qhim009Violations,readVerifierSource}from'./him-historical-binding-version-forward-compatibility-scope-v1.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
// Existence only: every historical artifact QHIM-009 owns must still be here.
// The directory is never compared against the map, counted, or required to
// contain nothing else - extra verifier files are expected and legal.
assertOwnedHistoricalArtifactsExist();
// Static gate: each owned file passes exactly the rules its history owns, and
// the historical proof universe is fixed by ownership rather than by
// directory contents.
for(const name of QHIM009_BINDING_V1_OWNER_FILES){
 const violations=qhim009Violations(name,readVerifierSource(name));
 if(violations.length)throw new Error(violations.join('; '));
}
const ownedQueries=collectOwnedBindingQueries(readVerifierSource);
const consulted=[];
const ownedOnly=name=>{
 if(!QHIM009_BINDING_V1_OWNER_FILES.includes(name))throw new Error(`The QHIM-009 harness read ${name}, which is outside its historical ownership map`);
 consulted.push(name);return readVerifierSource(name);
};
if(JSON.stringify(collectOwnedBindingQueries(ownedOnly))!==JSON.stringify(ownedQueries)||consulted.join('\n')!==QHIM009_BINDING_V1_OWNER_FILES.join('\n'))throw new Error('The QHIM-009 harness did not derive its proof universe from the historical ownership map');
if(ownedQueries.length!==QHIM009_OWNED_QUERY_COUNT)throw new Error('The QHIM-009 owned historical query set is not exactly the closure-audit result');
for(const name of[...QHIM009_EXCLUDED_FUTURE_CONTROLS,'verify-migration-9000.mjs'])if(qhim009RulesGoverning(name).length)throw new Error(`${name} is being governed by QHIM-009 historical rules`);
const METRICS=QHIM009_CANONICAL_V1_METRICS;
// hse.energy additionally receives a future-version SITUATION binding: 0051's
// historical "no SITUATION Energy binding" fact is owned by v1 only, and the
// anti-vacuity proof below requires a future Energy SITUATION binding to
// demonstrate that the unversioned form of that assertion would now fail.
const ENERGY='hse.energy';
// Every owned execution: a parameterized owned query runs once per historical
// metric key, exactly as its owner file does.
const executeOwned=async()=>{
 const out=[];
 for(const entry of ownedQueries)for(const key of entry.parameterized?entry.metricKeys:[null])out.push({file:entry.file,kind:entry.kind,key:key??entry.metricKeys[0],sql:entry.sql,rows:(await client.query(entry.sql,entry.parameterized?[key]:[])).rows});
 return out;
};
const one=async(sql,params=[])=>(await client.query(sql,params)).rows[0];
const metricVersions=async()=>{
 const versions={};
 for(const key of METRICS)versions[key]=(await client.query('SELECT definition_version FROM public.him_metric_definitions WHERE metric_key=$1 ORDER BY definition_version',[key])).rows.map(row=>row.definition_version);
 return versions;
};
const captureState=async()=>({
 historical:await executeOwned(),
 definitions:Number((await one('SELECT count(*)::int n FROM public.him_metric_definitions')).n),
 models:Number((await one('SELECT count(*)::int n FROM public.him_calculation_models')).n),
 approvals:Number((await one('SELECT count(*)::int n FROM public.him_governance_approvals')).n),
 bindings:Number((await one('SELECT count(*)::int n FROM public.him_canonical_model_bindings')).n),
 versions:await metricVersions(),
 bindingContract:(await one("SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='public.him_canonical_model_bindings'::regclass AND conname='him_structured_binding_contract'")).def,
 validatorEnabled:(await one("SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.him_canonical_model_bindings'::regclass AND tgname='him_energy_binding_validate'")).tgenabled,
 guardEnabled:(await one("SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.him_canonical_model_bindings'::regclass AND tgname='him_energy_binding_guard'")).tgenabled,
 validatorDefinition:(await one("SELECT pg_get_functiondef('public.validate_him_canonical_binding()'::regprocedure) def")).def,
 activateDefinition:(await one("SELECT pg_get_functiondef('public.activate_him_canonical_model_binding(uuid)'::regprocedure) def")).def
});
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const assertRestored=(actual,expected,label)=>{
 for(const key of Object.keys(expected))if(!same(actual[key],expected[key]))throw new Error(`${label}: ${key} did not return to the captured pre-fixture baseline`);
};
// A synthetic version that cannot collide with any live definition or binding
// version of the metric, derived from the live maximum rather than hard-coded.
const nextFutureVersion=async metric=>{
 const{v}=await one('SELECT greatest(coalesce((SELECT max(definition_version) FROM public.him_metric_definitions WHERE metric_key=$1),0),coalesce((SELECT max(definition_version) FROM public.him_canonical_model_bindings WHERE metric_key=$1),0))::int+1 v',[metric]);
 return Number(v);
};
// Collision-safe synthetic governance identities, proven unused at
// generation time - the harness stays valid whatever already exists.
const uniqueIdentities=async metric=>{
 for(let attempt=0;attempt<8;attempt++){
  const suffix=randomUUID().replace(/-/g,'').slice(0,8);
  const modelId=`qhim009.${metric}.future-model.${suffix}`,approvalId=`qhim009.${metric}.future-approval.${suffix}`,implementationId=`qhim009-${metric.replace(/[^a-z]+/g,'-')}-future-${suffix}`;
  const{n}=await one('SELECT ((SELECT count(*) FROM public.him_calculation_models WHERE model_id=$1)+(SELECT count(*) FROM public.him_governance_approvals WHERE approval_id=$2))::int n',[modelId,approvalId]);
  if(Number(n)===0)return{modelId,approvalId,implementationId,suffix};
 }
 throw new Error('Could not generate collision-free synthetic governance identities');
};
// Widen the LIVE structured binding CHECK - derived from the current
// canonical definition via pg_get_constraintdef, never from migration 0012 -
// with one narrow non-v1 branch. Idempotent per (sub)transaction; restored by
// rollback.
const widenBindingContract=async()=>{
 const{def}=await one("SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid='public.him_canonical_model_bindings'::regclass AND conname='him_structured_binding_contract'");
 if(/definition_version\s*<>\s*1/.test(def))return;
 const inner=def.replace(/^CHECK\s*/,'');
 await client.query('ALTER TABLE public.him_canonical_model_bindings DROP CONSTRAINT him_structured_binding_contract');
 await client.query(`ALTER TABLE public.him_canonical_model_bindings ADD CONSTRAINT him_structured_binding_contract CHECK(${inner} OR (definition_version<>1 AND instrument_version=1 AND scale_version=1))`);
};
// One complete synthetic future stack for one metric: definition + calibrated
// production model + approval + PENDING bindings activated through the
// protected lifecycle path. Returns the installed identity for later proofs.
const installFutureStack=async(metric,label)=>{
 const version=await nextFutureVersion(metric);
 const v1Bindings=(await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",[metric])).rows;
 if(!v1Bindings.length)throw new Error(`${label}: ${metric} has no ACTIVE v1 binding to extend`);
 const contexts=v1Bindings.map(row=>row.context_kind);
 const extraContexts=metric===ENERGY?['SITUATION'].filter(context=>!contexts.includes(context)):[];
 const identities=await uniqueIdentities(metric);
 // Future definition: clone the exact canonical v1 row, changing only the
 // identity/version fields the fixture requires. v1 is never mutated. This
 // does not claim future semantics equal v1; it instantiates a valid later
 // binding identity for forward-compatibility testing.
 await client.query("INSERT INTO public.him_metric_definitions SELECT (jsonb_populate_record(NULL::public.him_metric_definitions,to_jsonb(d)||jsonb_build_object('definition_version',$1::integer,'valid_context_kinds',to_jsonb($3::text[])))).* FROM public.him_metric_definitions d WHERE d.metric_key=$2 AND d.definition_version=1",[version,metric,[...contexts,...extraContexts]]);
 if((await client.query('SELECT 1 FROM public.him_metric_definitions WHERE metric_key=$1 AND definition_version=$2',[metric,version])).rowCount!==1)throw new Error(`${label}: the ${metric} future definition version ${version} was not created`);
 // Future model: clones the exact model the canonical v1 binding uses, but
 // targets the synthetic future definition version with a fresh identity. It
 // is genuinely CALIBRATED/PRODUCTION - never a reused v1-target model.
 await client.query("INSERT INTO public.him_calculation_models SELECT (jsonb_populate_record(NULL::public.him_calculation_models,to_jsonb(m)||jsonb_build_object('id',$1::uuid,'model_id',$2::text,'model_version',1,'target_definition_version',$3::integer,'implementation_id',$4::text,'supported_context_kinds',to_jsonb($5::text[])))).* FROM public.him_calculation_models m WHERE m.model_id=$6 AND m.model_version=$7",[randomUUID(),identities.modelId,version,identities.implementationId,[...contexts,...extraContexts],v1Bindings[0].model_id,v1Bindings[0].model_version]);
 const futureModel=await one('SELECT lifecycle,environment,target_metric_key,target_definition_version FROM public.him_calculation_models WHERE model_id=$1 AND model_version=1',[identities.modelId]);
 if(!futureModel||futureModel.lifecycle!=='CALIBRATED'||futureModel.environment!=='PRODUCTION'||futureModel.target_metric_key!==metric||futureModel.target_definition_version!==version)throw new Error(`${label}: the ${metric} future model is not a calibrated production model targeting version ${version}`);
 // Future approval: approves exactly the synthetic future model identity -
 // never a reused v1 approval, so no false authority is created.
 await client.query("INSERT INTO public.him_governance_approvals SELECT (jsonb_populate_record(NULL::public.him_governance_approvals,to_jsonb(a)||jsonb_build_object('id',$1::uuid,'approval_id',$2::text,'approval_version',1,'model_id',$3::text,'model_version',1))).* FROM public.him_governance_approvals a WHERE a.approval_id=$4 AND a.approval_version=$5",[randomUUID(),identities.approvalId,identities.modelId,v1Bindings[0].approval_id,v1Bindings[0].approval_version]);
 const futureApproval=await one('SELECT model_id,model_version FROM public.him_governance_approvals WHERE approval_id=$1 AND approval_version=1',[identities.approvalId]);
 if(!futureApproval||futureApproval.model_id!==identities.modelId||Number(futureApproval.model_version)!==1)throw new Error(`${label}: the ${metric} future approval does not approve the exact future model`);
 // Future bindings: PENDING first, then activated through the protected
 // lifecycle function, for every context ACTIVE at v1 (plus the Energy
 // SITUATION extension). Activation must NOT retire the v1 ACTIVE binding,
 // because retirement scope includes definition_version.
 const bindingIds=[];
 for(const context of[...contexts,...extraContexts]){
  const template=v1Bindings.find(row=>row.context_kind===context)??v1Bindings[0];
  const id=randomUUID();
  await client.query("INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,$2,$3,$4,1,'PENDING',$5,1,$6,$7,$8,$9,$10,1,clock_timestamp())",[id,metric,version,context,identities.modelId,template.instrument_id,template.instrument_version,template.scale_contract_reference,template.scale_version,identities.approvalId]);
  await client.query('SELECT public.activate_him_canonical_model_binding($1)',[id]);
  const{status}=await one('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[id]);
  if(status!=='ACTIVE')throw new Error(`${label}: the ${metric}@${version} ${context} binding did not activate`);
  const v1Row=v1Bindings.find(row=>row.context_kind===context);
  if(v1Row){
   const{status:v1Status}=await one('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[v1Row.id]);
   if(v1Status!=='ACTIVE')throw new Error(`${label}: activating ${metric}@${version} ${context} retired the canonical v1 binding - retirement scope lost definition_version`);
   const{n}=await one("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND context_kind=$2 AND status='ACTIVE' AND definition_version IN(1,$3)",[metric,context,version]);
   if(Number(n)!==2)throw new Error(`${label}: ${metric} ${context} does not hold v1 ACTIVE and version ${version} ACTIVE simultaneously`);
  }
  bindingIds.push(id);
 }
 return{metric,version,contexts,extraContexts,bindingIds,...identities};
};
// Anti-vacuity: with the future ACTIVE bindings present, every owned
// historical query re-executed WITHOUT its definition_version=1 predicate
// must demonstrably break - change its result, duplicate its context list,
// double its count, or make its rows[0] selector ambiguous. This proves the
// synthetic future state would have caught the original defect and the
// remediation is load-bearing, not decorative.
const proveAntiVacuity=async(reference,stacks,label)=>{
 const byMetric=Object.fromEntries(stacks.map(stack=>[stack.metric,stack]));
 for(const entry of reference.historical){
  const mutated=entry.sql.replace(' AND definition_version=1','');
  if(mutated===entry.sql)throw new Error(`${label}: could not strip the version predicate from an owned query of ${entry.file}`);
  const rows=(await client.query(mutated,entry.sql.includes('$1')?[entry.key]:[])).rows;
  if(same(rows,entry.rows))throw new Error(`${label}: the unversioned form of ${entry.file}'s ${entry.kind} query for ${entry.key} still returns the historical result - the future fixture is irrelevant to the defect`);
  const stack=byMetric[entry.key];
  if(entry.kind==='count'&&Number(rows[0].n)!==Number(entry.rows[0].n)+1)throw new Error(`${label}: the unversioned ${entry.file} count did not double-count the future ACTIVE binding`);
  if(entry.kind==='rows0'){
   if(rows.length!==2)throw new Error(`${label}: the unversioned ${entry.file} rows[0] selector is not ambiguous under a future ACTIVE binding`);
   const versions=rows.map(row=>row.definition_version).sort((a,b)=>a-b);
   if(versions[0]!==1||versions[1]!==stack.version)throw new Error(`${label}: the ambiguous ${entry.file} selector does not span v1 and version ${stack.version}`);
  }
  if(entry.kind==='absence'&&Number(rows[0].n)<1)throw new Error(`${label}: the unversioned ${entry.file} absence assertion still counts zero - the future Energy SITUATION binding is missing`);
  if(entry.kind==='context-list'&&rows.length<=entry.rows.length)throw new Error(`${label}: the unversioned ${entry.file} context list did not duplicate under future ACTIVE bindings`);
 }
};
// The full forward-compatibility proof: install the complete future stack for
// every canonical v1 metric the owned selectors assert, then prove exact
// historical parity and anti-vacuity. `reference` is always the true
// pre-fixture baseline.
const forwardCompatibilityProof=async(reference,label)=>{
 await widenBindingContract();
 await client.query('ALTER TABLE public.him_canonical_model_bindings DISABLE TRIGGER him_energy_binding_validate');
 const stacks=[];
 for(const metric of METRICS)stacks.push(await installFutureStack(metric,label));
 await client.query('ALTER TABLE public.him_canonical_model_bindings ENABLE TRIGGER him_energy_binding_validate');
 // The generic protected lifecycle guard stayed enabled the whole time.
 const{tgenabled}=await one("SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.him_canonical_model_bindings'::regclass AND tgname='him_energy_binding_guard'");
 if(tgenabled==='D')throw new Error(`${label}: the protected lifecycle mutation guard was disabled`);
 // Simultaneous coexistence, per metric and per historical context.
 for(const stack of stacks)for(const context of stack.contexts){
  const{n}=await one("SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND context_kind=$2 AND status='ACTIVE' AND definition_version IN(1,$3)",[stack.metric,context,stack.version]);
  if(Number(n)!==2)throw new Error(`${label}: ${stack.metric}@1 and ${stack.metric}@${stack.version} are not simultaneously ACTIVE for ${context}`);
 }
 // Baseline parity: the same corrected historical query set, executed while
 // every future ACTIVE binding exists, must return exact result parity.
 const after=await executeOwned();
 if(after.length!==reference.historical.length)throw new Error(`${label}: the owned historical query set changed size`);
 for(let index=0;index<after.length;index++){
  if(after[index].sql!==reference.historical[index].sql)throw new Error(`${label}: owned historical query drift between executions`);
  if(!same(after[index].rows,reference.historical[index].rows))throw new Error(`${label}: ${after[index].file} (${after[index].kind}, ${after[index].key}) changed its result once future ACTIVE bindings existed - the historical query is not version-exact`);
 }
 await proveAntiVacuity(reference,stacks,label);
 return stacks;
};
await client.connect();try{
 await client.query('BEGIN');
 const baseline=await captureState();
 if(baseline.validatorEnabled==='D'||baseline.guardEnabled==='D')throw new Error('The binding validator or lifecycle guard is not enabled at baseline');
 // Every owned historical query must already resolve its exact v1 fact.
 for(const entry of baseline.historical){
  if(entry.kind==='count'&&Number(entry.rows[0].n)!==1)throw new Error(`${entry.file}: the canonical v1 ACTIVE binding count is not exactly one`);
  if(entry.kind==='rows0'&&entry.rows.length!==1)throw new Error(`${entry.file}: the canonical v1 binding identity is not exactly one row`);
  if(entry.kind==='absence'&&Number(entry.rows[0].n)!==0)throw new Error(`${entry.file}: the historical v1 absence fact does not hold at baseline`);
  if(entry.kind==='context-list'&&!entry.rows.length)throw new Error(`${entry.file}: the historical v1 context list is empty at baseline`);
 }
 // --- Phase A: today's canonical state --------------------------------------
 await client.query('SAVEPOINT phase_a');
 const phaseA=await forwardCompatibilityProof(baseline,'phase A');
 if(phaseA.length!==METRICS.length)throw new Error('Phase A did not cover every canonical v1 metric');
 await client.query('ROLLBACK TO SAVEPOINT phase_a');
 assertRestored(await captureState(),baseline,'phase A rollback');
 // --- Phase B: a legitimate later Energy stack already exists ---------------
 // The harness must stay correct once canonical main itself carries a
 // reviewed hse.energy@2 (or later): the pre-existing future stack is
 // established first, the proof then chooses ANOTHER unused version, the
 // pre-existing stack survives the inner rollback untouched, and the
 // version-scoped historical queries still match the true pre-fixture
 // baseline throughout.
 await client.query('SAVEPOINT phase_b');
 await widenBindingContract();
 await client.query('ALTER TABLE public.him_canonical_model_bindings DISABLE TRIGGER him_energy_binding_validate');
 const legitimate=await installFutureStack(ENERGY,'phase B pre-existing');
 await client.query('ALTER TABLE public.him_canonical_model_bindings ENABLE TRIGGER him_energy_binding_validate');
 const canonicalFuture=await captureState();
 if(!same(canonicalFuture.historical,baseline.historical))throw new Error('A legitimate later Energy ACTIVE binding perturbed a version-exact historical query');
 if(!canonicalFuture.versions[ENERGY].includes(legitimate.version))throw new Error('The pre-existing legitimate future Energy definition was not established');
 await client.query('SAVEPOINT phase_b_proof');
 const phaseB=await forwardCompatibilityProof({...canonicalFuture,historical:baseline.historical},'phase B');
 const phaseBEnergy=phaseB.find(stack=>stack.metric===ENERGY);
 if(phaseBEnergy.version===legitimate.version)throw new Error('The harness selected the pre-existing legitimate future version as its synthetic fixture');
 if(phaseBEnergy.version<=legitimate.version)throw new Error('The harness did not select an unused version above the pre-existing future version');
 await client.query('ROLLBACK TO SAVEPOINT phase_b_proof');
 // The synthetic fixture is gone; the pre-existing legitimate stack survives.
 const afterProof=await captureState();
 assertRestored(afterProof,canonicalFuture,'phase B rollback');
 if(!afterProof.versions[ENERGY].includes(legitimate.version))throw new Error('The pre-existing legitimate future Energy stack did not survive the synthetic rollback');
 if(afterProof.versions[ENERGY].includes(phaseBEnergy.version))throw new Error('The synthetic future Energy version did not roll back');
 const survivors=await client.query("SELECT status FROM public.him_canonical_model_bindings WHERE id=ANY($1::uuid[])",[legitimate.bindingIds]);
 if(survivors.rowCount!==legitimate.bindingIds.length||survivors.rows.some(row=>row.status!=='ACTIVE'))throw new Error('A pre-existing legitimate future ACTIVE binding was overwritten or deleted');
 await client.query('ROLLBACK TO SAVEPOINT phase_b');
 assertRestored(await captureState(),baseline,'phase B outer rollback');
 await client.query('ROLLBACK');
 // --- Baseline-relative zero residue ----------------------------------------
 // Residue is measured against the captured pre-fixture state - row counts,
 // per-metric version populations, the live CHECK definition, trigger
 // enablement, and the validator/activation function definitions - never by
 // asserting that no legitimate non-v1 version may exist.
 assertRestored(await captureState(),baseline,'final rollback');
}finally{try{await client.query('ROLLBACK');}catch{}await client.end();}
console.log(`Verified HIM historical ACTIVE-binding version forward compatibility (QHIM-009), scoped to the ${QHIM009_BINDING_V1_OWNER_FILES.length} historical owner files of the closure audit at PR #${QHIM009_PROVENANCE.auditBaselinePullRequest}: the ${QHIM009_OWNED_QUERY_COUNT} owned historical binding identity queries are drawn verbatim from the explicit ownership map rather than from whatever verifier files exist, and each returns a byte-identical un-normalized result while every canonical v1 metric simultaneously carries a synthetic future definition version, a calibrated production model targeting that exact version, an approval approving that exact model, and ACTIVE bindings for every historically ACTIVE context - activated through the protected lifecycle path without retiring any v1 binding, because retirement scope includes definition_version. Every owned query stripped of definition_version=1 demonstrably breaks under the same fixtures - Energy count and context list, the 0037 and Intelligence Snapshot Stress rows[0] selectors (ambiguous across two versions), every HBS/HRS/HGS context list, and 0051's Energy SITUATION absence fact under a future Energy SITUATION binding - so the fixture provably catches the original defect. Ownership is provenance, not directory contents: verify-migration-0050.mjs and verify-migration-0052.mjs (version-exact at the audit baseline, ${QHIM009_VERSION_EXACT_AT_AUDIT.length} controls), both proof harnesses, and any future verifier - including one that correctly owns definition_version=2 - are governed by no QHIM-009 rule. The harness is forward-safe itself: synthetic versions derive from the live per-metric maximum, model/approval identities carry suffixes proven unused, the v1-union CHECK is widened transactionally from its LIVE canonical definition with the lifecycle mutation guard enabled throughout, and phase B re-runs the whole proof with a legitimate later Energy stack already present - selected around, surviving the synthetic rollback untouched, leaving the version-exact historical queries byte-identical - with zero residue measured against the captured pre-fixture baseline: row populations, per-metric version sets, the CHECK definition, trigger enablement, and the validator and activation function definitions all restored exactly.`);
