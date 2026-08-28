import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
// QHIM-013 cross-layer static contract. It connects three layers that were
// previously allowed to disagree:
//
//   1. the historical Foundation generic writer in frozen migration 0009;
//   2. its database retirement to a fail-closed no-write tombstone in 0051;
//   3. the final application-layer retirement of the generic write boundary.
//
// The defect was that (2) retired the database function while the application
// still exported HimService.observe -> HimRepository.createObservation ->
// the legacy generic snapshot RPC, so a caller of the advertised application
// write path was guaranteed to hit a retired database authority.
//
// WHAT THIS GUARD ASSERTS. Exactly one closure-state fact: at this Measurement
// Foundation closure state the retired legacy generic snapshot writer has no
// live application boundary, and QHIM-013 introduces no replacement GENERIC
// writer - no dynamic RPC construction, no metric-identity switch, no
// map/table from metric identities to write RPCs, no generic method that takes
// a metric identity and routes to different metric-owned writers, and no
// direct write to him_metric_snapshots.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT. It is independent of migration
// numbering: it reads no migration inventory to reach a verdict and asserts
// nothing about which migration is last or whether a later one may exist. It
// freezes no metric inventory and no metric version. And it does NOT forbid a
// future, separately reviewed, EXACT metric-specific application adapter that
// hardcodes its own single metric-owned RPC under its own reviewed contract -
// exact metric ownership is the opposite of generic routing. The conventional
// generic-method-name rules apply only to the two legacy surfaces QHIM-013
// retires; every other HIM production file is judged by routing semantics, so
// a future exact service is free to name its own submission method. A future
// GENERIC application submission API would be a separately reviewed runtime
// contract and would intentionally update this guard.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const APP_SRC='apps/api/src';
const HIM_DIR=`${APP_SRC}/human-model`;
const SERVICE=`${HIM_DIR}/him.service.ts`;
const REPOSITORY=`${HIM_DIR}/him.repository.ts`;
const TYPES=`${HIM_DIR}/him.types.ts`;
const LEGACY_RPC_PATH='rpc/create_him_metric_snapshot';
// The two legacy generic application surfaces this task retires. Conventional
// generic-write method names are forbidden here and only here.
const RETIRED_GENERIC_SURFACES=[SERVICE,REPOSITORY];
const GENERIC_WRITE_METHODS=['observe','observeMetric','createObservation','createMeasurement','createSnapshot','writeSnapshot','submitMeasurement'];
const WRITE_RPC=/['"`](?:rpc\/)?(?:create|correct|calculate)_[a-z0-9_]+_measurement['"`]/gi;
// A metric IDENTITY carried in application code (metricKey / metric_key as its
// own word). p_metric_key inside an RPC payload is not one: it has no word
// boundary before "metric" and is a parameter name, not a routing key.
const METRIC_IDENTITY=/\bmetric_?[Kk]ey\b/;
const MUTATING=`method\\s*:\\s*['"\`](?:POST|PUT|PATCH|DELETE)['"\`]`;
const methodDefinition=name=>new RegExp(`(^|[;{}]|\\*/)\\s*(?:public |private |protected |static |readonly )*(?:async\\s+)?${name}\\s*\\(`,'m');
const writeRpcsIn=code=>new Set([...code.matchAll(WRITE_RPC)].map(match=>match[0].replace(/['"`]/g,'').replace(/^rpc\//i,'').toLowerCase()));

// --- production source collection -------------------------------------------
// Production means tracked application source only: *.spec.ts is test source
// and is deliberately excluded, because a test may legitimately name a retired
// symbol while proving its absence.
const collectProduction=(dir,files=new Map())=>{
 for(const entry of readdirSync(new URL(`${dir}/`,root),{withFileTypes:true})){
  const path=`${dir}/${entry.name}`;
  if(entry.isDirectory())collectProduction(path,files);
  else if(entry.name.endsWith('.ts')&&!entry.name.endsWith('.spec.ts'))files.set(path,read(path));
 }
 return files;
};
const PRODUCTION=collectProduction(APP_SRC);
const himProduction=sources=>new Map([...sources].filter(([path])=>path.startsWith(`${HIM_DIR}/`)));

// --- the one real guard the anti-vacuity fixtures below drive ----------------
// A pure function of an application-source map: it consults no migration
// listing, no database state, and no metric inventory to reach a verdict.
function qhim013Violations(sources){
 const violations=[];
 for(const[path,code]of sources){
  // Whitespace- and newline-insensitive so a multiline request expression
  // cannot slip past, bounded to a single statement so a legitimate GET audit
  // read in a neighbouring statement is never blamed for someone else's POST.
  const flat=code.replace(/\s+/g,' ');
  if(code.includes(LEGACY_RPC_PATH))violations.push(`${path}: calls the retired legacy generic snapshot RPC`);
  if(/\bCreateHimMetricObservation\b/.test(code))violations.push(`${path}: references the retired generic HIM write DTO`);
  if(new RegExp(`him_metric_snapshots[^;]{0,400}?${MUTATING}`,'i').test(flat)||new RegExp(`${MUTATING}[^;]{0,400}?him_metric_snapshots`,'i').test(flat))violations.push(`${path}: issues a non-GET request against him_metric_snapshots`);
  if(/INSERT\s+INTO\s+(?:public\.)?him_metric_snapshots/i.test(flat))violations.push(`${path}: writes directly to him_metric_snapshots`);
  if(!path.startsWith(`${HIM_DIR}/`))continue;
  // --- GENERIC ROUTING, never exact metric ownership -------------------------
  const writeRpcs=writeRpcsIn(code);
  if(/rpc\/[^'"`\n]*\$\{/.test(code)||/['"`]rpc\/['"`]\s*\+/.test(code))violations.push(`${path}: constructs an RPC path dynamically`);
  if(/switch\s*\(\s*[A-Za-z_$][\w$.]*[Mm]etric_?[Kk]ey/.test(code))violations.push(`${path}: routes through a metric-identity switch`);
  if(writeRpcs.size>1)violations.push(`${path}: names ${writeRpcs.size} metric-owned write RPCs in one unit (a generic routing table)`);
  if(writeRpcs.size>0&&METRIC_IDENTITY.test(code))violations.push(`${path}: selects a metric-owned write RPC from a metric identity`);
  // --- the two retired legacy generic surfaces -------------------------------
  if(RETIRED_GENERIC_SURFACES.includes(path))for(const method of GENERIC_WRITE_METHODS){
   if(methodDefinition(method).test(code))violations.push(`${path}: redefines the retired generic measurement-write method ${method}(...)`);
  }
 }
 return violations;
}
const mutate=(sources,path,code)=>{const next=new Map(sources);next.set(path,code);return next;};
// Exported so the exact same guard implementation - never a re-typed copy of
// it - can be driven directly when reviewing a specific verdict.
export{qhim013Violations,HIM_DIR};

// --- synthetic, non-filesystem fixtures -------------------------------------
// A future separately reviewed EXACT metric-specific adapter: one hardcoded
// metric-owned RPC, no metric identity, no routing. Test-only - this PR adds
// no such production writer.
const EXACT_ENERGY_WRITER=`import { Injectable } from '@nestjs/common';
@Injectable()
export class HseEnergySubmissionService {
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  submitEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
}
`;
const GENERIC_DISPATCH_TABLE=`export class GenericHimSubmissionService {
  private static readonly WRITERS:Record<string,string>={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,GenericHimSubmissionService.WRITERS[metricKey],{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const GENERIC_DISPATCH_SWITCH=`export class RoutedHimSubmissionService {
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  submit(token:string,metricKey:string,body:object){
    switch(metricKey){
      case 'hse.energy': return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify(body)});
      default: return this.dataApi.request(token,'rpc/create_hse_stress_measurement',{method:'POST',body:JSON.stringify(body)});
    }
  }
}
`;
const LEGITIMATE_READ=`export class SyntheticHimReader {
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  history(token:string,userId:string){
    const q=new URLSearchParams({select:'*',user_id:\`eq.\${userId}\`,order:'snapshot_version.asc',limit:'128'});
    return this.dataApi.request(token,\`him_metric_snapshots?\${q}\`);
  }
}
`;

test('S1 - the historical generic writer really existed in frozen migration 0009',()=>{
 // Historical evidence only. Migration 0009 is an immutable artifact and this
 // test must never fail because it still contains the old generic writer.
 const historical=read('database/migrations/0009_human_model_him_runtime.sql');
 assert.match(historical,/CREATE FUNCTION public\.create_him_metric_snapshot\(p_observation jsonb\)/,'0009 created the generic snapshot writer');
 assert.match(historical,/RETURNS SETOF public\.him_metric_snapshots/,'it returned canonical snapshot rows');
 assert.match(historical,/INSERT INTO public\.him_metric_snapshots/,'it really wrote canonical snapshot state');
 assert.match(historical,/GRANT EXECUTE ON FUNCTION [^;]*create_him_metric_snapshot\(jsonb\) TO authenticated/,'authenticated could execute it');
 assert.match(historical,/SECURITY DEFINER/,'it ran as a definer');
});

test('S2 - the database retirement in migration 0051 is still real',()=>{
 const retirement=read('database/migrations/0051_him_legacy_snapshot_authority_energy_context_reconciliation_v1.sql');
 const executable=retirement.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 const tombstone=executable.slice(executable.indexOf('CREATE OR REPLACE FUNCTION public.create_him_metric_snapshot'),executable.indexOf('REVOKE ALL ON FUNCTION public.create_him_metric_snapshot'));
 assert.ok(tombstone.length>0,'0051 replaces the generic writer in place');
 assert.match(tombstone,/SECURITY INVOKER/,'the tombstone needs no definer authority');
 assert.match(tombstone,/RAISE EXCEPTION 'Generic HIM snapshot creation is retired[^']*' USING ERRCODE='42501'/,'it raises a deterministic retirement error');
 assert.doesNotMatch(tombstone,/INSERT|UPDATE|DELETE|TRUNCATE|COPY/i,'the tombstone performs no write of any kind');
 assert.doesNotMatch(tombstone,/EXECUTE\s+format|EXECUTE\s+'/i,'the tombstone runs no dynamic SQL');
 assert.match(executable,/REVOKE ALL ON FUNCTION public\.create_him_metric_snapshot\(jsonb\) FROM PUBLIC,anon,authenticated,service_role/,'EXECUTE is revoked from every application role');
 assert.match(executable,/has_function_privilege\('authenticated','public\.create_him_metric_snapshot\(jsonb\)','EXECUTE'\)/,'the migration proves the final ACL at install time');
 // The database half of the contract is not weakened or duplicated by QHIM-013.
 assert.ok(readdirSync(new URL('database/',root)).includes('verify-migration-0051.mjs'),'the 0051 real-PostgreSQL verifier is preserved');
 assert.ok(readdirSync(new URL('database/tests/',root)).includes('him-legacy-snapshot-authority-energy-context-reconciliation-v1.test.mjs'),'the 0051 static contract is preserved');
});

test('S3 - production application source calls the legacy generic snapshot RPC zero times',()=>{
 // Guard against searching the wrong files: the collected set must really be
 // the application production sources, must contain the three HIM files this
 // remediation owns, and must exclude test source.
 assert.ok(PRODUCTION.size>50,`expected a real production source set, collected ${PRODUCTION.size}`);
 for(const path of [SERVICE,REPOSITORY,TYPES])assert.ok(PRODUCTION.has(path),`the production set includes ${path}`);
 assert.equal([...PRODUCTION.keys()].filter(path=>path.endsWith('.spec.ts')).length,0,'test source is excluded from the production set');
 const occurrences=[...PRODUCTION].reduce((total,[,code])=>total+(code.split(LEGACY_RPC_PATH).length-1),0);
 assert.equal(occurrences,0,`expected zero ${LEGACY_RPC_PATH} references in ${APP_SRC}`);
});

test('S4 - the generic application write methods are gone',()=>{
 const service=read(SERVICE),repository=read(REPOSITORY);
 assert.doesNotMatch(service,/(^|[;{}])\s*(?:async\s+)?observe\s*\(/m,'HimService defines no observe(...)');
 assert.doesNotMatch(service,/validateObservation/,'the write-only observation validator is gone');
 assert.doesNotMatch(service,/randomUUID|node:crypto/,'the write-only client-side identifier generation is gone');
 assert.doesNotMatch(repository,/(^|[;{}])\s*(?:async\s+)?createObservation\s*\(/m,'HimRepository defines no createObservation(...)');
 assert.doesNotMatch(repository,/p_observation/,'no generic observation payload is posted anywhere');
 // The classes themselves are retained as legitimate read providers, and the
 // module still provides and exports them - the defect was the write method,
 // not the existence of the read services.
 assert.match(service,/export class HimService/,'HimService is retained');
 assert.match(repository,/export class HimRepository/,'HimRepository is retained');
 const module=read(`${HIM_DIR}/him.module.ts`);
 for(const provider of ['HimRepository','HimService'])assert.ok(module.includes(provider),`HimModule still wires ${provider}`);
 assert.match(module,/providers:\s*\[[^\]]*HimService[^\]]*\]/,'HimService remains a provider');
 assert.match(module,/exports:\s*\[[^\]]*HimService[^\]]*\]/,'HimService remains exported');
});

test('S5 - the generic write DTO is gone from the production HIM contract',()=>{
 const types=read(TYPES);
 assert.doesNotMatch(types,/export interface CreateHimMetricObservation/,'the generic write DTO is no longer exported');
 for(const[path,code]of PRODUCTION)assert.doesNotMatch(code,/\bCreateHimMetricObservation\b/,`${path} has no production use of the retired DTO`);
 // Shared read/domain types legitimate HIM code still needs are preserved.
 for(const kept of ['HimMetricDefinition','HimMetricSnapshot','HimContextKind','HIM_CONTEXT_KINDS','MAX_HIM_CONTEXT_ID_LENGTH'])assert.ok(types.includes(kept),`the read/domain type ${kept} is preserved`);
});

test('S6 - no direct snapshot-table write was substituted, and GET audit reads stay legal',()=>{
 assert.deepEqual(qhim013Violations(PRODUCTION),[],'the shipped production source performs no snapshot-table write');
 // Positive control: the legitimate raw history/audit GET reads must not be
 // rejected merely because they name the snapshot table - including a
 // synthetic one that is not the shipped repository.
 const repository=read(REPOSITORY);
 assert.match(repository,/him_metric_snapshots\?\$\{q\}/,'explicit history/context reads remain raw GET queries');
 assert.equal([...repository.matchAll(/him_metric_snapshots/g)].length,2,'exactly the two explicit audit reads name the snapshot table');
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/synthetic-reader.service.ts`,LEGITIMATE_READ)),[],'a GET audit read against the snapshot table is accepted');
});

test('S7 - generic routing is rejected while exact metric ownership stays legal',()=>{
 // The shipped HIM production source contains no routing construct at all.
 const him=himProduction(PRODUCTION);
 assert.ok(him.size>0,'the HIM production set is non-empty');
 for(const[path,code]of him){
  assert.doesNotMatch(code,/rpc\/[^'"`\n]*\$\{/,`${path} builds no RPC path by interpolation`);
  assert.doesNotMatch(code,/switch\s*\(\s*[A-Za-z_$][\w$.]*[Mm]etric_?[Kk]ey/,`${path} routes nothing through a metric-identity switch`);
  assert.ok(writeRpcsIn(code).size<=1,`${path} names at most one metric-owned write RPC`);
 }
 // FUTURE COMPATIBILITY: a separately reviewed EXACT metric-specific adapter
 // that hardcodes its own single metric-owned RPC is ACCEPTED. QHIM-013 retires
 // a generic write authority, not exact metric ownership, and it places no
 // ceiling on a future reviewed exact submission service or its method name.
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/hse-energy-submission.service.ts`,EXACT_ENERGY_WRITER)),[],'an exact Energy-specific application writer is accepted');
 // The same file placed at either retired legacy surface would still be
 // rejected, because those two surfaces may never regain a write boundary.
 assert.ok(qhim013Violations(mutate(PRODUCTION,REPOSITORY,`${read(REPOSITORY)}\n${EXACT_ENERGY_WRITER.replace('submitEnergyMeasurement','submitMeasurement')}`)).length>0,'the retired legacy surfaces may not regain a write boundary');
});

test('S8 - the legitimate read authority is intact',()=>{
 const repository=read(REPOSITORY),service=read(SERVICE);
 assert.match(repository,/rpc\/read_him_latest_measurement_v1/,'canonical latest still routes through the one canonical read RPC');
 assert.match(repository,/p_definition_version:definitionVersion/,'canonical latest still forwards the exact definition version');
 for(const readPath of ['rpc/get_him_metric_definition','rpc/list_him_metric_definitions','rpc/read_him_trend_source_v1','rpc/read_him_intelligence_snapshot_v1'])assert.ok(repository.includes(readPath),`${readPath} is preserved`);
 assert.match(repository,/history\(token:string[\s\S]*?him_metric_snapshots/,'history remains an explicit raw audit read');
 assert.match(repository,/snapshot_version\.asc/,'history keeps its ascending audit ordering');
 assert.match(repository,/listForContext\(token:string[\s\S]*?him_metric_snapshots/,'context listing remains an explicit raw audit read');
 // Read validation is not weakened and definition-version exactness stands.
 assert.match(service,/this\.repository\.getDefinition\(token,key,definitionVersion\)/,'the exact definition is still resolved before the read');
 assert.match(service,/validContextKinds\.includes\(kind\)/,'context eligibility is still validated');
 assert.match(service,/this\.repository\.getLatest\(token,userId,key,definitionVersion,kind,id\)/,'the exact definition version still reaches the repository');
 assert.doesNotMatch(service,/definitionVersion\s*\?\?|definitionVersion\s*\|\||definitionVersion\s*=\s*1/,'no implicit v1 default was introduced');
 assert.match(service,/validateContext/,'exact context validation needed by the read paths is preserved');
});

test('anti-vacuity - the real guard rejects every pre-remediation defect fixture',()=>{
 // Positive control first: the shipped read-only source is accepted.
 assert.deepEqual(qhim013Violations(PRODUCTION),[],'legitimate read code is accepted');
 const repository=read(REPOSITORY),service=read(SERVICE),types=read(TYPES);
 const MULTILINE_DIRECT_WRITE=`  writeSnapshotRow(token:string,row:object){
    return this.dataApi.request(
      token,
      'him_metric_snapshots',
      {
        method: 'POST',
        body: JSON.stringify(row),
      },
    );
  }
`;
 const fixtures=[
  ['a repository createObservation calling the legacy generic snapshot RPC',REPOSITORY,repository,
   repository.replace('  async getLatest(',`  async createObservation(token:string,value:CreateHimMetricObservation):Promise<HimMetricSnapshot>{return(await this.dataApi.request<HimMetricSnapshot[]>(token,'${LEGACY_RPC_PATH}',{method:'POST',body:JSON.stringify({p_observation:value})}))[0];}\n  async getLatest(`)],
  ['a service observe(...) forwarding to createObservation',SERVICE,service,
   service.replace('  async getLatest(','  async observe(userId:string,token:string,o:object){return this.repository.createObservation(token,o as never);}\n  async getLatest(')],
  ['a reintroduced generic write DTO',TYPES,types,
   `${types}\nexport interface CreateHimMetricObservation { id:string; metricKey:string; }\n`],
  ['a single-line direct write substituted against the snapshot table',REPOSITORY,repository,
   repository.replace('  async getLatest(',"  writeSnapshotRow(token:string,row:object){return this.dataApi.request(token,'him_metric_snapshots',{method:'POST',body:JSON.stringify(row)});}\n  async getLatest(")],
  ['a MULTILINE direct write substituted against the snapshot table',REPOSITORY,repository,
   repository.replace('  async getLatest(',`${MULTILINE_DIRECT_WRITE}  async getLatest(`)],
  ['a multiline direct PATCH against the snapshot table',REPOSITORY,repository,
   repository.replace('  async getLatest(',`${MULTILINE_DIRECT_WRITE.replace("'POST'","'PATCH'").replace('writeSnapshotRow','patchSnapshotRow')}  async getLatest(`)],
  ['a multiline direct DELETE against the snapshot table',REPOSITORY,repository,
   repository.replace('  async getLatest(',`${MULTILINE_DIRECT_WRITE.replace("'POST'","'DELETE'").replace('writeSnapshotRow','deleteSnapshotRow')}  async getLatest(`)],
  ['a generic metricKey-to-RPC dispatcher built by interpolation',REPOSITORY,repository,
   repository.replace('  async getLatest(','  submitMeasurement(token:string,metricKey:string,body:object){return this.dataApi.request(token,`rpc/create_${metricKey.split(\'.\')[1]}_measurement`,{method:\'POST\',body:JSON.stringify(body)});}\n  async getLatest(')],
  ['a generic metric-identity-to-write-RPC routing table',`${HIM_DIR}/generic-submission.service.ts`,'',GENERIC_DISPATCH_TABLE],
  ['a generic metric-identity switch selecting metric-owned writers',`${HIM_DIR}/routed-submission.service.ts`,'',GENERIC_DISPATCH_SWITCH],
 ];
 for(const[label,path,before,after]of fixtures){
  assert.notEqual(after,before,`the "${label}" mutation actually changed ${path}`);
  const violations=qhim013Violations(mutate(PRODUCTION,path,after));
  assert.ok(violations.length>0,`the guard rejects: ${label}`);
 }
 // A cosmetic, semantics-preserving rewrite of legitimate read code is still
 // accepted, so the guard proves architecture rather than formatting.
 const reformatted=repository.replace('  async getLatest(','\n  async getLatest(');
 assert.notEqual(reformatted,repository,'the cosmetic rewrite actually changed the source');
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,REPOSITORY,reformatted)),[],'formatting alone never fails the guard');
});

test('the QHIM-013 guard states no future ceiling and is independent of migration numbering',()=>{
 // 1. INDEPENDENT OF MIGRATION NUMBERING. The guard is a pure function of an
 //    application-source map: driven entirely by synthetic, non-filesystem
 //    sources it still reaches the correct verdicts, so no migration
 //    inventory, migration number, or future migration can influence it. This
 //    replaces a former next-migration-number check that was vacuous by
 //    construction - "the number after the highest present number is absent"
 //    is true whether or not this task added a migration. That QHIM-013
 //    changes zero migration files is a PR-diff fact, verified independently
 //    of this runtime guard and deliberately not frozen into it.
 const synthetic=new Map([[`${HIM_DIR}/synthetic-reader.service.ts`,LEGITIMATE_READ]]);
 assert.deepEqual(qhim013Violations(synthetic),[],'a purely synthetic legitimate source set is accepted');
 assert.ok(qhim013Violations(new Map([[`${HIM_DIR}/synthetic-writer.service.ts`,`export class X{ go(t:string){ return fetch('${LEGACY_RPC_PATH}',{method:'POST'}); } }`]])).length>0,'a purely synthetic defective source set is rejected');
 assert.ok(qhim013Violations(new Map([[`${HIM_DIR}/generic.service.ts`,GENERIC_DISPATCH_TABLE]])).length>0,'generic routing is rejected without consulting anything on disk');
 assert.deepEqual(qhim013Violations(new Map([[`${HIM_DIR}/exact.service.ts`,EXACT_ENERGY_WRITER]])),[],'exact metric ownership is accepted without consulting anything on disk');
 // 2. No metric-inventory or metric-version ceiling. A production source that
 //    introduces an eighteenth metric and a later definition version of an
 //    existing one is accepted by the real guard.
 const futureCatalog=`export const FUTURE={metricKey:'hse.energy',definitionVersion:2,validContextKinds:['CONVERSATION_SESSION']};\nexport const EIGHTEENTH={metricKey:'hse.future-construct',definitionVersion:1,validContextKinds:['SITUATION']};\n`;
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/future-metric.catalog.ts`,futureCatalog)),[],'a later metric version and an additional metric stay legal');
 // 3. No ceiling on future READ surfaces either: a new read RPC is accepted.
 const futureRead=`export class FutureHimReader{constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}\n read(token:string){return this.dataApi.request(token,'rpc/read_him_future_projection_v2',{method:'POST',body:'{}'});}}\n`;
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/future-read.service.ts`,futureRead)),[],'a future separately reviewed read authority stays legal');
 // 4. The one closure-state fact this guard does assert is named explicitly in
 //    its own header, together with the path a future generic API takes.
 const self=read('tests/him-generic-application-write-authority-retirement.test.mjs');
 assert.ok(self.includes('would intentionally update this guard'),'the guard names the separately reviewed future-API path');
 assert.ok(self.includes('at this Measurement Foundation closure state'),'the guard scopes its claim to this closure state');
});

test('the QHIM-013 contract is wired into CI before the expensive database gates',()=>{
 const packageJson=JSON.parse(read('package.json'));
 assert.equal(packageJson.scripts['test:him-generic-write-authority-retirement-contract'],'node --test tests/him-generic-application-write-authority-retirement.test.mjs');
 const ci=read('.github/workflows/api-ci.yml');
 const step=ci.indexOf('test:him-generic-write-authority-retirement-contract');
 assert.ok(step>0,'CI runs the QHIM-013 contract');
 assert.ok(step<ci.indexOf('Apply all migrations to fresh PostgreSQL'),'it runs before the database bootstrap');
 assert.ok(step<ci.indexOf('verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration'),'it runs before the 0051 verifier');
 assert.ok(step<ci.indexOf('verify:him-legacy-energy-current-authority-reconciliation:integration'),'it runs before the QHIM-012 verifier');
 // No existing gate is removed or replaced.
 for(const preserved of ['verify:him-measurement-preflight','verify:foundation-integration-gate','verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-legacy-energy-current-authority-reconciliation:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration','verify:a2-e2e-runtime-smoke','verify:full-intelligence-e2e-runtime'])
  assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the existing gate ${preserved} is preserved`);
});
