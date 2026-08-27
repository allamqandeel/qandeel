import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{CALIBRATED_STRUCTURED_METRICS,HIM_CONTEXTS,EXPECTED_UNCALIBRATED_COUNT}from'./him-structured-measurement.manifest.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const contextsFromModel=source=>{const match=source.match(/supportedContextKinds\s*:\s*\[([^\]]+)\]/);assert.ok(match,'model supportedContextKinds is explicit');return[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);};
const assertPositiveSqlPaths=(contract,sql)=>contract.sqlPositive.forEach(pattern=>assert.match(sql,pattern,`${contract.metricKey} approved SQL path ${pattern}`));
test('the manifest is the single current calibrated-inventory source and cannot drift from the catalog',()=>{const catalog=read('apps/api/src/human-model/initial-him-metrics.catalog.ts');
 // The calibrated keys are DERIVED from the application catalog (each entry
 // is one line; a calibrated entry overrides calculationStatus:'CALIBRATED')
 // and compared to the manifest, so the manifest stays the one current-state
 // calibrated inventory - no second literal key list exists to fall stale.
 const entries=catalog.split('\n').map(line=>{const m=line.match(/metric\('([^']+)'/);return m?{metricKey:m[1],calibrated:line.includes("calculationStatus:'CALIBRATED'")}:null;}).filter(Boolean);
 assert.equal(entries.length,17,'catalog registers exactly 17 canonical metric identities');
 const catalogCalibrated=entries.filter(x=>x.calibrated).map(x=>x.metricKey).sort();
 // Both drift directions stay fail-closed: a catalog-calibrated metric
 // missing from the manifest and a manifest metric that is absent or
 // uncalibrated in the catalog each break this exact-set equality.
 assert.deepEqual(catalogCalibrated,[...CALIBRATED_STRUCTURED_METRICS.map(x=>x.metricKey)].sort());
 assert.equal(new Set(CALIBRATED_STRUCTURED_METRICS.map(x=>x.metricKey)).size,CALIBRATED_STRUCTURED_METRICS.length,'manifest keys are unique');
 assert.equal(17-CALIBRATED_STRUCTURED_METRICS.length,EXPECTED_UNCALIBRATED_COUNT);});
test('model allowlists, ACTIVE bindings, positive SQL paths, and unsupported contexts cannot drift',()=>{for(const contract of CALIBRATED_STRUCTURED_METRICS){const model=read(`apps/api/src/human-model/${contract.model}`),sql=read(`database/migrations/${contract.migration}`);assert.deepEqual(contextsFromModel(model),contract.approved,`${contract.metricKey} model allowlist`);assertPositiveSqlPaths(contract,sql);for(const context of contract.approved)assert.match(sql,new RegExp(`'${contract.metricKey.replace('.','\\.')}',1,'${context}',1,'ACTIVE'`),`${contract.metricKey}/${context} binding`);for(const context of HIM_CONTEXTS.filter(x=>!contract.approved.includes(x)))assert.doesNotMatch(sql,new RegExp(`'${contract.metricKey.replace('.','\\.')}',1,'${context}',1,'ACTIVE'`),`${contract.metricKey}/${context} must remain unsupported`);assert.match(sql,/Unsupported|Unknown|cross-user/i,`${contract.metricKey} negative path`);}});
test('current-read routing covers exactly every calibrated structured context',()=>{const repository=read('apps/api/src/human-model/him.repository.ts');for(const contract of CALIBRATED_STRUCTURED_METRICS)assert.match(repository,contract.routing);assert.doesNotMatch(repository,/key==='hrs\.|key==='hgs\./);});
test('a reversed approved-context predicate fails before push',()=>{const contract=CALIBRATED_STRUCTURED_METRICS.find(x=>x.metricKey==='hse.self-confidence'),sql=read(`database/migrations/${contract.migration}`),reversed=sql.replace("IF p_context_kind=ANY(ARRAY['SITUATION','DECISION'])THEN","IF p_context_kind<>ALL(ARRAY['SITUATION','DECISION'])THEN");assert.notEqual(reversed,sql);assert.throws(()=>assertPositiveSqlPaths(contract,reversed),/approved SQL path/);});

