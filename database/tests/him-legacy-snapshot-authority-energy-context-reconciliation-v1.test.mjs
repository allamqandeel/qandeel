import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIM-003 / QHIM-004 static contract. Freezes the durable rules of the legacy
// generic snapshot authority retirement and the Energy context reconciliation,
// and stays forward-safe under the QHIM-002 policy: nothing here forbids a
// later migration, a later metric version, a separately reviewed future
// generic measurement API under its own name, or any future function.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0051_him_legacy_snapshot_authority_energy_context_reconciliation_v1.sql';
const sql=read(`migrations/${MIGRATION}`);
// Prose comments legitimately describe the retired behaviour and the removed
// SITUATION drift, so every negative rule runs against executable SQL only.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const catalog=read('../apps/api/src/human-model/initial-him-metrics.catalog.ts');
const model=read('../apps/api/src/human-model/hse-energy.model.ts');
const CANONICAL_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];

test('0051 exists exactly once after 0050 and edits no earlier migration',()=>{
 // Historical phase guarantee only: this contract owns 0051's identity and
 // ordering, never a ceiling on later migrations. Nothing asserts that 0051 is
 // the last migration or that 0052 may not exist.
 const migrations=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes(MIGRATION));
 assert.equal(migrations.filter(name=>name.startsWith('0051')).length,1,'exactly one migration 0051');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0050_him_structured_current_binding_transition_safety_v1.sql'));
 for(let n=1;n<=50;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
});

test('the legacy generic snapshot writer becomes a no-write fail-closed tombstone',()=>{
 assert.match(executable,/CREATE OR REPLACE FUNCTION public\.create_him_metric_snapshot\(p_observation jsonb\)/,'the legacy identity and argument name are preserved');
 assert.match(executable,/RETURNS SETOF public\.him_metric_snapshots/,'the legacy result identity is preserved');
 assert.match(executable,/SET search_path=''/,'the tombstone keeps a fixed empty search_path');
 const tombstone=executable.slice(executable.indexOf('CREATE OR REPLACE FUNCTION public.create_him_metric_snapshot'),executable.indexOf('REVOKE ALL ON FUNCTION public.create_him_metric_snapshot'));
 assert.match(tombstone,/RAISE EXCEPTION 'Generic HIM snapshot creation is retired/,'the tombstone raises a stable sanitized retirement error');
 assert.match(tombstone,/metric-owned structured measurement RPC/,'the retirement error names the supported replacement');
 assert.doesNotMatch(tombstone,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bCOPY\b|\bRETURN QUERY\b/i,'the tombstone performs no write');
 assert.doesNotMatch(tombstone,/EXECUTE\s+format|EXECUTE\s+'/i,'the tombstone runs no dynamic SQL');
 assert.doesNotMatch(tombstone,/http|openai|anthropic|provider/i,'the tombstone has no provider or network behaviour');
});

test('application-role EXECUTE on the legacy writer is revoked and no replacement generic writer is created',()=>{
 assert.match(executable,/REVOKE ALL ON FUNCTION public\.create_him_metric_snapshot\(jsonb\) FROM PUBLIC,anon,authenticated,service_role/,'every application role loses EXECUTE');
 assert.doesNotMatch(executable,/GRANT EXECUTE/,'0051 grants execution to nobody');
 assert.doesNotMatch(executable,/GRANT (?:ALL|SELECT|INSERT|UPDATE|DELETE)/i,'0051 grants no table privilege');
 // Exactly one function is touched, and it is the retired one: no replacement
 // generic direct-snapshot writer is introduced under any name.
 assert.equal((executable.match(/CREATE (?:OR REPLACE )?FUNCTION/g)??[]).length,1,'0051 defines exactly one function');
 assert.doesNotMatch(executable,/CREATE (?:OR REPLACE )?FUNCTION public\.(?!create_him_metric_snapshot)/,'0051 creates no other function');
 // A separately reviewed future generic measurement API under a different
 // name is deliberately NOT prohibited by this contract.
});

test('0051 reconciles Energy v1 to CONVERSATION_SESSION only and touches nothing else',()=>{
 assert.match(executable,/UPDATE public\.him_metric_definitions SET valid_context_kinds=ARRAY\['CONVERSATION_SESSION'\] WHERE metric_key='hse\.energy' AND definition_version=1;/,'exactly the Energy v1 context list is updated');
 assert.equal((executable.match(/UPDATE public\./g)??[]).length,1,'0051 issues exactly one UPDATE');
 // The exact expected precondition and postcondition are asserted, so an
 // unexpected catalog shape fails closed instead of being silently reconciled.
 assert.match(executable,/valid_context_kinds=ARRAY\['SITUATION','CONVERSATION_SESSION'\]/,'0051 asserts the exact pre-remediation Energy shape');
 assert.match(executable,/Unexpected hse\.energy v1 catalog shape before context reconciliation/);
 assert.match(executable,/hse\.energy v1 CONVERSATION_SESSION-only reconciliation failed/);
 // Nothing else about Energy changes.
 for(const preserved of ["calculation_status='CALIBRATED'","semantic_mapping_status='RESOLVED'","semantic_type='STATE'","scale_reference='hse\\.energy\\.ordinal-5\\.v1'","required_input_contract='DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1'","confidence_requirement_reference='UNRESOLVED_METRIC_CONFIDENCE_MODEL'"])assert.match(executable,new RegExp(preserved),`the reconciliation asserts ${preserved} is preserved`);
 assert.match(executable,/A sibling canonical v1 metric context list changed/,'the sixteen sibling context lists are asserted unchanged');
 assert.match(executable,/A canonical v1 metric left CALIBRATED/,'all seventeen canonical v1 metrics stay calibrated');
});

test('0051 deletes, backfills, and reinterprets no history and adds no consumption eligibility',()=>{
 // Statement-shaped, because the migration's own postcondition guard names
 // those keywords as data when it proves the tombstone contains no write.
 assert.doesNotMatch(executable,/INSERT\s+INTO|DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?\w|COPY\s+public\.|DROP\s+(?:TABLE|FUNCTION|VIEW)|ALTER\s+TABLE/i,'0051 performs no destructive or history-writing operation');
 assert.doesNotMatch(executable,/UPDATE public\.him_metric_snapshots|UPDATE public\.him_calculation_results|UPDATE public\.him_measurement_observations|UPDATE public\.him_measurement_events|UPDATE public\.him_canonical_model_bindings/i,'0051 rewrites no measurement history or binding');
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot|background_read_him|him_current_structured_measurements|slots\(/,'0051 changes no Trend, Snapshot, or Runtime Consumption surface');
 assert.doesNotMatch(executable,/recommendation|safety_runtime|openai|anthropic|llm|provider|embedding/i,'0051 adds no provider, recommendation, safety, or UI surface');
 // QHIM-001 and QHIM-002 remain intact and are not re-litigated here.
 const currentView=read('migrations/0050_him_structured_current_binding_transition_safety_v1.sql');
 assert.match(currentView,/SELECT DISTINCT ON\(s\.measurement_observation_id\)/,'QHIM-001 one-row-per-observation selection is preserved');
 assert.match(currentView,/him_active_structured_binding_id/,'QHIM-001 ACTIVE-binding preference is preserved');
 assert.ok(readdirSync(new URL('.',new URL('tests/',root))).includes('him-historical-verifier-forward-compatibility-v1.test.mjs'),'the QHIM-002 forward-compatibility contract is preserved');
});

// QHIM-010. The application catalog is EXTENSIBLE: it may legitimately gain a
// later version of a canonical metric (`hse.energy@2`) or an entirely new
// reviewed metric, calibrated or uncalibrated. So every catalog claim below is
// resolved by EXACT `metricKey@definitionVersion` identity and asserts only
// canonical v1 coverage - never a complete-catalog size, and never an equality
// between the whole parsed catalog and today's population.
const canonicalIdentity=(metricKey,definitionVersion=1)=>`${metricKey}@${definitionVersion}`;
const CANONICAL_V1_CONTEXTS=Object.freeze({'hse.stress@1':'SITUATION,CONVERSATION_SESSION','hse.energy@1':'CONVERSATION_SESSION','hse.motivation@1':'SITUATION,GOAL','hse.self-confidence@1':'SITUATION,DECISION','hse.attention@1':'SITUATION,CONVERSATION_SESSION,DECISION','hbs.avoidance@1':'SITUATION,GOAL','hbs.consistency@1':'SITUATION,GOAL','hbs.initiative@1':'SITUATION,GOAL','hbs.reflection@1':'SITUATION,CONVERSATION_SESSION','hrs.relationship-trust@1':'RELATIONSHIP','hrs.communication@1':'RELATIONSHIP','hrs.repair@1':'RELATIONSHIP','hrs.emotional-safety@1':'RELATIONSHIP','hgs.self-awareness@1':'GOAL,SITUATION','hgs.resilience@1':'GOAL,SITUATION','hgs.purpose-alignment@1':'GOAL','hgs.habit-strength@1':'GOAL,SITUATION'});

test('the application catalog and the Energy model agree on CONVERSATION_SESSION only',()=>{
 // Version-exact: `hse.energy@1` is located by its own identity, so a future
 // `hse.energy@2` line can never be mistaken for the reconciled v1 definition.
 const energy=catalog.split('\n').find(line=>line.includes("metric('hse.energy',1,"));
 assert.ok(energy,'the catalog registers hse.energy@1 on one line');
 assert.match(energy,/'STATE',\['CONVERSATION_SESSION'\]/,'the TypeScript Energy catalog is CONVERSATION_SESSION-only');
 assert.doesNotMatch(energy,/'SITUATION'/,'the contradictory SITUATION catalog entry is gone');
 assert.match(energy,/calculationStatus:'CALIBRATED'/,'the Energy calibration is preserved on one line for the preflight parser');
 assert.match(energy,/scaleReference:'hse\.energy\.ordinal-5\.v1'/,'the Energy scale is preserved');
 assert.match(energy,/requiredInputContract:'DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1'/,'the Energy input contract is preserved');
 assert.match(model,/supportedContextKinds\s*:\s*\['CONVERSATION_SESSION'\]/,'the Energy model stays CONVERSATION_SESSION-only');
 // The other sixteen canonical v1 context lists are unchanged. Parsed by exact
 // identity and checked as COVERAGE of the frozen canonical v1 map, so a later
 // definition added to the extensible catalog is simply invisible here instead
 // of failing this historical contract.
 const contexts=Object.fromEntries(catalog.split('\n').map(line=>{const key=line.match(/metric\('([^']+)',(\d+),/),list=line.match(/,\[((?:'[A-Z_]+',?)+)\],/);return key&&list?[canonicalIdentity(key[1],key[2]),list[1].replace(/'/g,'')]:null;}).filter(Boolean));
 for(const[id,approved]of Object.entries(CANONICAL_V1_CONTEXTS))assert.equal(contexts[id],approved,`${id} keeps its canonical v1 context list, so only the Energy context list changed`);
 // The frozen expectation itself covers every canonical v1 identity. This is a
 // claim about the two frozen sets, never about the size of the catalog.
 assert.deepEqual(Object.keys(CANONICAL_V1_CONTEXTS).sort(),CANONICAL_V1.map(key=>canonicalIdentity(key)).sort(),'every canonical v1 identity is covered');
});

test('the 0051 verifier proves the retirement, the routes, and the Energy exactness, and stays forward-safe',()=>{
 const verifier=read('verify-migration-0051.mjs');
 for(const proof of ['has_function_privilege','service_role','retirement error','create_hse_energy_measurement','calculate_hse_energy_measurement','him_current_structured_measurements','cleanupVerifierUsers'])assert.ok(verifier.includes(proof),`the verifier proves ${proof}`);
 assert.match(verifier,/creates no snapshot|created a snapshot row/,'the verifier measures zero-write behaviour');
 assert.match(verifier,/lost its metric-owned structured measurement route/,'the verifier proves no canonical metric was orphaned');
 assert.match(verifier,/A SITUATION Energy binding exists/,'the verifier proves there is no SITUATION Energy authority');
 // Forward-safe under the QHIM-002 policy.
 assert.doesNotMatch(verifier,/0052/,'the 0051 verifier asserts no next-migration ceiling');
 assert.doesNotMatch(verifier,/forever|can never exist|cannot exist/i,'the 0051 verifier states no permanent existence ceiling');
 assert.doesNotMatch(verifier,/\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/,'the 0051 verifier freezes no global definition count');
 assert.doesNotMatch(verifier,/LIKE\s+'background_|proname\s+(?:I?LIKE|~)/i,'the 0051 verifier takes no function-namespace census');
 for(const literal of verifier.matchAll(/(['"`])((?:(?!\1)[\s\S])*?)\1/g))if(/FROM public\.him_metric_definitions/.test(literal[2]))assert.match(literal[2],/definition_version=1/,'every catalog read in the 0051 verifier is version scoped');
});

test('the Snapshot and Energy documents state current calibration and context truthfully',()=>{
 const snapshotDoc=read('../docs/him-intelligence-snapshot-v1.md');
 assert.doesNotMatch(snapshotDoc,/four HGS metrics remain uncalibrated|HGS metrics remain uncalibrated/i,'the stale uncalibrated-HGS statement is gone');
 assert.match(snapshotDoc,/All seventeen canonical HIM v1 metrics are calibrated/,'the doc states that all seventeen metrics are calibrated');
 assert.match(snapshotDoc,/Runtime Consumption eligibility decision and never a statement about calibration status/,'exclusion is stated as an eligibility decision, not calibration');
 assert.match(snapshotDoc,/never a safety signal or Safety Runtime authority/,'Emotional Safety stays subjective perceived openness safety');
 assert.match(snapshotDoc,/five-HSE STATE subset/,'Snapshot v1 slots remain the five-HSE STATE subset');
 const energyDoc=read('../docs/hse-energy-measurement-model-v1.md');
 assert.doesNotMatch(energyDoc,/catalog support for `SITUATION`/i,'the stale SITUATION catalog-support wording is gone');
 assert.match(energyDoc,/CONVERSATION_SESSION` as Energy's only valid context kind/,'the doc states the reconciled context');
 assert.match(energyDoc,/Generic authenticated snapshot creation is no longer an available write path/,'the doc records the retirement');
 assert.match(energyDoc,/Historical phase note/,'the obsolete post-0012 calibration statement is labelled historical');
 assert.match(energyDoc,/all seventeen canonical HIM v1 metrics are `CALIBRATED`/,'the doc states current calibration');
 for(const preserved of ['ar-EG','RIGHT_NOW','ordinal','correction','confidence'])assert.match(energyDoc,new RegExp(preserved,'i'),`the Energy document preserves its ${preserved} contract`);
 assert.match(energyDoc,/no external psychometric validation, clinical claim/,'the no-external-validation claim is preserved');
});

test('the 0051 verifier is wired after the QHIM-002 forward-compatibility check and before HIM consumption checks',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration'],/--env-file-if-exists=\.env database\/verify-migration-0051\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration');
 assert.ok(step>0,'CI runs the 0051 verifier');
 assert.ok(step>ci.indexOf('verify:him-historical-verifier-forward-compatibility:integration'),'it runs after the QHIM-002 forward-compatibility verifier');
 assert.ok(step>ci.indexOf('verify:him-structured-current-binding-transition-safety:integration'),'it runs after the QHIM-001 verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
});
