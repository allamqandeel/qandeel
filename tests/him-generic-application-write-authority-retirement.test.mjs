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
// writer. "Generic" is judged by an actual routing CONSTRUCT, never by
// counting or by proximity:
//
//   A. any reference to the retired legacy generic snapshot RPC;
//   B. an RPC path constructed dynamically;
//   C. a metric identity switching between write authorities;
//   D. a metric identity used as the index/key that looks up the writer;
//   E. the two retired legacy surfaces regaining a generic write method;
//   F. a direct non-GET request to him_metric_snapshots.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT. It is independent of migration
// numbering: it reads no migration inventory to reach a verdict and asserts
// nothing about which migration is last or whether a later one may exist. It
// freezes no metric inventory and no metric version. It does NOT forbid a
// future, separately reviewed, EXACT metric-specific application adapter: such
// an adapter may hardcode SEVERAL exact RPCs for its ONE metric (create and
// correct, say), may hold a metric-identity constant of its own, and may name
// its methods as its reviewed contract sees fit. Neither the NUMBER of exact
// write RPCs in a file nor the mere PRESENCE of a metric identity beside one is
// evidence of routing - only a construct in which the identity actually selects
// the authority is. The conventional generic-method-name rules apply only to
// the two legacy surfaces QHIM-013 retires. A future GENERIC application
// submission API would be a separately reviewed runtime contract and would
// intentionally update this guard.
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
// A metric identity carried in application code, optionally property-accessed.
// p_metric_key inside an RPC payload is not one: it has no word boundary before
// "metric" and is a parameter name, not a selector.
const IDENTITY=String.raw`(?:[A-Za-z_$][\w$]*\.)*metric_?[Kk]ey`;
const WRITE_RPC=/['"`](?:rpc\/)?(?:create|correct|calculate)_[a-z0-9_]+_measurement['"`]/i;
const MUTATING=/method\s*:\s*['"`](?:POST|PUT|PATCH|DELETE)['"`]/i;
const SNAPSHOT_TABLE=/him_metric_snapshots/;
const SNAPSHOT_INSERT=/INSERT\s+INTO\s+(?:public\.)?him_metric_snapshots/i;
// Routing constructs. Each names a mechanism, not a count and not a distance.
//
// PATH_CONSTRUCTION is judged per file: an RPC path assembled at runtime is
// drift wherever it appears in HIM production, and an exact adapter hardcodes
// its path, so this places no ceiling on exact ownership.
const PATH_CONSTRUCTION=[
 [/rpc\/[^'"`\n]*\$\{/,'constructs an RPC path by interpolation'],
 [/['"`]rpc\/[^'"`\n]*['"`]\s*\+/,'constructs an RPC path by concatenation'],
];
// IDENTITY_SELECTORS are judged per statement AND only where the statement is
// actually selecting a WRITE target - either it names a metric-owned write RPC
// itself, or it issues a mutating request inside a file that names one. A
// metric identity indexing or keying a READ lookup (a definition registry, a
// Snapshot projector, a Trend slot table) is ordinary, legitimate code and is
// deliberately not governed here.
const IDENTITY_SELECTORS=[
 [new RegExp(String.raw`switch\s*\(\s*${IDENTITY}\s*\)`),'switches write authority on a metric identity'],
 [new RegExp(String.raw`\[\s*${IDENTITY}\s*\]`),'indexes a writer lookup by a metric identity'],
 [new RegExp(String.raw`\.get\s*\(\s*${IDENTITY}\s*\)`),'looks a writer up from a map keyed by a metric identity'],
];
// A metric identity COMPARED against, in the same statement that names a
// metric-owned write RPC: conditional dispatch. Assignment (metricKey = '...')
// is deliberately not a comparison and stays legal.
const IDENTITY_COMPARISON=new RegExp(String.raw`${IDENTITY}\s*(?:===|!==|==|!=)`);
const methodDefinition=name=>new RegExp(`(^|[;{}]|\\*/)\\s*(?:public |private |protected |static |readonly )*(?:async\\s+)?${name}\\s*\\(`,'m');
// Statement-bounded, whitespace/newline-insensitive segmentation. The statement
// terminator is the bound - there is no distance ceiling, so ordinary comments,
// typed payload construction, headers, and formatting can never push a direct
// write out of view, while a legitimate GET audit read in a neighbouring
// statement is never blamed for someone else's mutating verb.
const statementsOf=code=>code.replace(/\s+/g,' ').split(';');

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

// --- the one real guard the fixtures below drive -----------------------------
// A pure function of an application-source map: it consults no migration
// listing, no database state, and no metric inventory to reach a verdict.
function qhim013Violations(sources){
 const violations=[];
 for(const[path,code]of sources){
  if(code.includes(LEGACY_RPC_PATH))violations.push(`${path}: calls the retired legacy generic snapshot RPC`);
  if(/\bCreateHimMetricObservation\b/.test(code))violations.push(`${path}: references the retired generic HIM write DTO`);
  const him=path.startsWith(`${HIM_DIR}/`);
  const fileNamesWriteRpc=WRITE_RPC.test(code);
  for(const statement of statementsOf(code)){
   if(SNAPSHOT_TABLE.test(statement)&&MUTATING.test(statement))violations.push(`${path}: issues a non-GET request against him_metric_snapshots`);
   if(SNAPSHOT_INSERT.test(statement))violations.push(`${path}: writes directly to him_metric_snapshots`);
   if(!him)continue;
   if(WRITE_RPC.test(statement)&&IDENTITY_COMPARISON.test(statement))violations.push(`${path}: chooses a metric-owned write RPC by comparing a metric identity`);
   // The statement must actually be selecting a write target before a metric
   // identity in it can mean routing.
   if(!(WRITE_RPC.test(statement)||(fileNamesWriteRpc&&MUTATING.test(statement))))continue;
   for(const[pattern,mechanism]of IDENTITY_SELECTORS)if(pattern.test(statement))violations.push(`${path}: ${mechanism}`);
  }
  if(!him)continue;
  for(const[pattern,mechanism]of PATH_CONSTRUCTION)if(pattern.test(code))violations.push(`${path}: ${mechanism}`);
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

// --- synthetic, non-filesystem fixtures (test-only; no production writer) ----
// P1: one exact metric-owned RPC, no metric identity, no routing.
const P1_EXACT_ENERGY_WRITER=`import { Injectable } from '@nestjs/common';
@Injectable()
export class HseEnergySubmissionService {
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  submitEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
}
`;
// P2: SEVERAL exact RPCs owned by ONE metric - create and correct. Exact
// ownership, not routing.
const P2_EXACT_ENERGY_CREATE_AND_CORRECT=`export class HseEnergySubmissionService {
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  createEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
  correctEnergyMeasurement(token:string,observationId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/correct_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_supersedes_observation_id:observationId,p_response_code:responseCode})});
  }
}
`;
// P3: an exact writer that CARRIES a metric identity constant but never routes
// by it - presence is not selection.
const P3_EXACT_WRITER_WITH_IDENTITY_CONSTANT=`export class HseEnergySubmissionService {
  private readonly metricKey = 'hse.energy';
  private readonly definitionVersion = 1;
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  describe(){ return \`\${this.metricKey}@\${this.definitionVersion}\`; }
  submitEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
}
`;
const N1_DYNAMIC_INTERPOLATION="export class D{ submit(token:string,metricKey:string,body:object){return this.dataApi.request(token,`rpc/create_${metricKey.split('.')[1]}_measurement`,{method:'POST',body:JSON.stringify(body)});} }\n";
const N2_IDENTITY_SWITCH=`export class RoutedHimSubmissionService {
  submit(token:string,metricKey:string,body:object){
    switch(metricKey){
      case 'hse.energy': return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify(body)});
      default: return this.dataApi.request(token,'rpc/create_hse_stress_measurement',{method:'POST',body:JSON.stringify(body)});
    }
  }
}
`;
const N3_ROUTING_TABLE_INDEX=`export class GenericHimSubmissionService {
  private static readonly WRITERS:Record<string,string>={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,GenericHimSubmissionService.WRITERS[metricKey],{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const N4_ROUTING_MAP_GET=`export class MappedHimSubmissionService {
  private static readonly WRITERS=new Map([['hse.energy','rpc/create_hse_energy_measurement'],['hse.stress','rpc/create_hse_stress_measurement']]);
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,MappedHimSubmissionService.WRITERS.get(metricKey),{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const N5_IDENTITY_TERNARY=`export class TernaryHimSubmissionService {
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,metricKey==='hse.energy'?'rpc/create_hse_energy_measurement':'rpc/create_hse_stress_measurement',{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const directWrite=verb=>`export class DirectWriter {
  writeSnapshotRow(token:string,row:object){
    return this.dataApi.request(
      token,
      'him_metric_snapshots',
      {
        method: '${verb}',
        body: JSON.stringify(row),
      },
    );
  }
}
`;
// A direct write whose statement is far longer than the arbitrary window the
// previous guard used, through ordinary comments, headers, and formatting.
const LONG_DIRECT_WRITE=`export class LongDirectWriter {
  writeSnapshotRow(token:string,row:object){
    return this.dataApi.request(
      token,
      'him_metric_snapshots',
      /* A deliberately verbose request expression. This block comment, the
         header object below it, and the generously formatted payload push the
         distance between the canonical snapshot table path and the mutating
         verb far past four hundred characters, which is exactly the kind of
         perfectly ordinary formatting that an arbitrary character window would
         have silently allowed through. The invariant that matters is that this
         is ONE statement performing ONE direct write to canonical measurement
         state, and statement bounding - not distance - is what the guard is
         built on, so a reviewer may add as much typing, explanation, or
         formatting as they please without ever weakening the check. */
      {
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
        method: 'POST',
        body: JSON.stringify(row),
      },
    );
  }
}
`;
const MULTILINE_GET_READ=`export class SyntheticHimReader {
  constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}
  history(token:string,userId:string){
    const q=new URLSearchParams({select:'*',user_id:\`eq.\${userId}\`,order:'snapshot_version.asc',limit:'128'});
    return this.dataApi.request(
      token,
      \`him_metric_snapshots?\${q}\`,
    );
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
 const repository=read(REPOSITORY);
 assert.match(repository,/him_metric_snapshots\?\$\{q\}/,'explicit history/context reads remain raw GET queries');
 assert.equal([...repository.matchAll(/him_metric_snapshots/g)].length,2,'exactly the two explicit audit reads name the snapshot table');
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/synthetic-reader.service.ts`,MULTILINE_GET_READ)),[],'a multiline GET audit read against the snapshot table is accepted');
});

test('S7 - generic routing constructs are rejected while exact metric ownership stays legal',()=>{
 // The shipped HIM production source contains no routing construct at all.
 // Nothing here counts write RPCs or reacts to the presence of a metric
 // identity - those are not QHIM-013 invariants.
 const him=himProduction(PRODUCTION);
 assert.ok(him.size>0,'the HIM production set is non-empty');
 for(const[path,code]of him)for(const[pattern,mechanism]of PATH_CONSTRUCTION)assert.doesNotMatch(code,pattern,`${path} never ${mechanism}`);
 // No HIM production file names a metric-owned write RPC at all today, so no
 // identity selector in one can be selecting a write target. Legitimate READ
 // lookups keyed by a metric identity - the definition registry, the Snapshot
 // projector, the Trend slot table - remain untouched and are proven accepted
 // by the empty verdict below.
 for(const[path,code]of him)assert.doesNotMatch(code,WRITE_RPC,`${path} names no metric-owned write RPC today`);
 assert.deepEqual(qhim013Violations(him),[],'every shipped HIM production file, including its metric-identity read lookups, is accepted');
 // FUTURE COMPATIBILITY. Exact metric ownership is accepted in every shape the
 // reviewed architecture allows.
 for(const[label,fixture]of [['P1 one exact Energy writer',P1_EXACT_ENERGY_WRITER],['P2 exact Energy create + correct adapter',P2_EXACT_ENERGY_CREATE_AND_CORRECT],['P3 exact writer holding a metric-identity constant',P3_EXACT_WRITER_WITH_IDENTITY_CONSTANT]])
  assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/hse-energy-submission.service.ts`,fixture)),[],`${label} is accepted`);
 // P2 really does own more than one exact RPC, and P3 really does carry a
 // metric identity - so neither acceptance is vacuous.
 assert.ok([...P2_EXACT_ENERGY_CREATE_AND_CORRECT.matchAll(/rpc\/(?:create|correct)_hse_energy_measurement/g)].length===2,'P2 names two exact Energy RPCs');
 assert.match(P3_EXACT_WRITER_WITH_IDENTITY_CONSTANT,/\bmetricKey\b/,'P3 carries a metric identity');
 // The same exact writer is still rejected at either retired legacy surface,
 // which may never regain a write boundary.
 assert.ok(qhim013Violations(mutate(PRODUCTION,REPOSITORY,`${read(REPOSITORY)}\n${P1_EXACT_ENERGY_WRITER.replace('submitEnergyMeasurement','submitMeasurement')}`)).length>0,'the retired legacy surfaces may not regain a write boundary');
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

test('anti-vacuity - every generic routing construct is rejected by its own named rule',()=>{
 // Each negative control asserts WHICH mechanism fired, so a fixture can never
 // pass on an unrelated rule the way a count-based check once allowed.
 const routing=[
  ['N1 dynamic metric-identity interpolation',N1_DYNAMIC_INTERPOLATION,'constructs an RPC path by interpolation'],
  ['N2 metric-identity switch',N2_IDENTITY_SWITCH,'switches write authority on a metric identity'],
  ['N3 routing table indexed by metric identity',N3_ROUTING_TABLE_INDEX,'indexes a writer lookup by a metric identity'],
  ['N4 routing map looked up by metric identity',N4_ROUTING_MAP_GET,'looks a writer up from a map keyed by a metric identity'],
  ['N5 metric-identity conditional dispatch',N5_IDENTITY_TERNARY,'chooses a metric-owned write RPC by comparing a metric identity'],
 ];
 for(const[label,fixture,mechanism]of routing){
  assert.notEqual(fixture,P1_EXACT_ENERGY_WRITER,`${label} really differs from the accepted exact-ownership control`);
  const violations=qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/generic-submission.service.ts`,fixture));
  assert.ok(violations.some(violation=>violation.includes(mechanism)),`${label} is rejected as: ${mechanism} (got ${JSON.stringify(violations)})`);
 }
});

test('anti-vacuity - every mutating verb and a long multiline direct write are rejected',()=>{
 const repository=read(REPOSITORY);
 for(const verb of ['POST','PUT','PATCH','DELETE']){
  const fixture=directWrite(verb);
  assert.notEqual(fixture,MULTILINE_GET_READ,`the multiline ${verb} fixture differs from the accepted GET control`);
  assert.ok(fixture.split('\n').length>5,`the ${verb} fixture really is multiline`);
  const violations=qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/direct-writer.service.ts`,fixture));
  assert.ok(violations.some(violation=>violation.includes('issues a non-GET request against him_metric_snapshots')),`multiline ${verb} is rejected`);
 }
 // The long fixture genuinely exceeds the arbitrary window the guard no longer
 // uses, so its rejection proves the distance ceiling is really gone.
 const flat=LONG_DIRECT_WRITE.replace(/\s+/g,' ');
 const gap=flat.indexOf("method: 'POST'")-(flat.indexOf("'him_metric_snapshots'")+"'him_metric_snapshots'".length);
 assert.ok(gap>400,`the long fixture must separate path and verb by more than 400 characters, got ${gap}`);
 assert.ok(!flat.slice(flat.indexOf("'him_metric_snapshots'"),flat.indexOf("method: 'POST'")).includes(';'),'the long fixture is still one statement');
 assert.ok(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/long-direct-writer.service.ts`,LONG_DIRECT_WRITE)).some(violation=>violation.includes('issues a non-GET request against him_metric_snapshots')),'a long multiline direct POST is rejected');
 // Positive controls: multiline GET, the shipped repository, and a cosmetic
 // rewrite of it all stay accepted.
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/reader.service.ts`,MULTILINE_GET_READ)),[],'a multiline GET audit read is accepted');
 const reformatted=repository.replace('  async getLatest(','\n  async getLatest(');
 assert.notEqual(reformatted,repository,'the cosmetic rewrite actually changed the source');
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,REPOSITORY,reformatted)),[],'formatting alone never fails the guard');
});

test('anti-vacuity - the real guard rejects every pre-remediation defect fixture',()=>{
 // Positive control first: the shipped read-only source is accepted.
 assert.deepEqual(qhim013Violations(PRODUCTION),[],'legitimate read code is accepted');
 const repository=read(REPOSITORY),service=read(SERVICE),types=read(TYPES);
 const fixtures=[
  ['a repository createObservation calling the legacy generic snapshot RPC',REPOSITORY,repository,
   repository.replace('  async getLatest(',`  async createObservation(token:string,value:CreateHimMetricObservation):Promise<HimMetricSnapshot>{return(await this.dataApi.request<HimMetricSnapshot[]>(token,'${LEGACY_RPC_PATH}',{method:'POST',body:JSON.stringify({p_observation:value})}))[0];}\n  async getLatest(`)],
  ['a service observe(...) forwarding to createObservation',SERVICE,service,
   service.replace('  async getLatest(','  async observe(userId:string,token:string,o:object){return this.repository.createObservation(token,o as never);}\n  async getLatest(')],
  ['a reintroduced generic write DTO',TYPES,types,
   `${types}\nexport interface CreateHimMetricObservation { id:string; metricKey:string; }\n`],
  ['a single-line direct write substituted against the snapshot table',REPOSITORY,repository,
   repository.replace('  async getLatest(',"  writeSnapshotRow(token:string,row:object){return this.dataApi.request(token,'him_metric_snapshots',{method:'POST',body:JSON.stringify(row)});}\n  async getLatest(")],
 ];
 for(const[label,path,before,after]of fixtures){
  assert.notEqual(after,before,`the "${label}" mutation actually changed ${path}`);
  assert.ok(qhim013Violations(mutate(PRODUCTION,path,after)).length>0,`the guard rejects: ${label}`);
 }
});

test('the QHIM-013 guard states no future ceiling and is independent of migration numbering',()=>{
 // 1. INDEPENDENT OF MIGRATION NUMBERING. The guard is a pure function of an
 //    application-source map: driven entirely by synthetic, non-filesystem
 //    sources it still reaches the correct verdicts, so no migration
 //    inventory, migration number, or future migration can influence it. That
 //    QHIM-013 changes zero migration files is a PR-diff fact, verified
 //    independently of this runtime guard and deliberately not frozen into it.
 assert.deepEqual(qhim013Violations(new Map([[`${HIM_DIR}/synthetic-reader.service.ts`,MULTILINE_GET_READ]])),[],'a purely synthetic legitimate source set is accepted');
 assert.ok(qhim013Violations(new Map([[`${HIM_DIR}/synthetic-writer.service.ts`,`export class X{ go(t:string){ return fetch('${LEGACY_RPC_PATH}',{method:'POST'}); } }`]])).length>0,'a purely synthetic defective source set is rejected');
 assert.ok(qhim013Violations(new Map([[`${HIM_DIR}/generic.service.ts`,N3_ROUTING_TABLE_INDEX]])).length>0,'generic routing is rejected without consulting anything on disk');
 assert.deepEqual(qhim013Violations(new Map([[`${HIM_DIR}/exact.service.ts`,P2_EXACT_ENERGY_CREATE_AND_CORRECT]])),[],'exact metric ownership is accepted without consulting anything on disk');
 // 2. No metric-inventory or metric-version ceiling.
 const futureCatalog=`export const FUTURE={metricKey:'hse.energy',definitionVersion:2,validContextKinds:['CONVERSATION_SESSION']};\nexport const EIGHTEENTH={metricKey:'hse.future-construct',definitionVersion:1,validContextKinds:['SITUATION']};\n`;
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,`${HIM_DIR}/future-metric.catalog.ts`,futureCatalog)),[],'a later metric version and an additional metric stay legal');
 // 3. No ceiling on future READ surfaces either.
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
