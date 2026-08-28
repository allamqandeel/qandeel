import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{CANONICAL_V1_STRUCTURED_METRICS,HIM_CONTEXTS}from'./him-structured-measurement.manifest.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const CATALOG_PATH='apps/api/src/human-model/initial-him-metrics.catalog.ts';
const catalogSource=read(CATALOG_PATH);
const contextsFromModel=source=>{const match=source.match(/supportedContextKinds\s*:\s*\[([^\]]+)\]/);assert.ok(match,'model supportedContextKinds is explicit');return[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);};
const assertPositiveSqlPaths=(contract,sql)=>contract.sqlPositive.forEach(pattern=>assert.match(sql,pattern,`${contract.metricKey} approved SQL path ${pattern}`));

// --- QHIM-010: canonical v1 is a REQUIRED SUBSET, not the whole catalog ------
//
// Two permanently different concepts, never to be conflated again:
//
//   * CANONICAL_HIM_V1_METRICS - the frozen seventeen `metricKey@1` identities.
//     A closed historical/foundation set, so an EXACT claim about it is legal:
//     the assertion owns canonical v1 history, never the future catalog.
//   * HIM_METRIC_CATALOG - the complete application catalog and the sole
//     registry input, today AND in the future. It may legitimately gain a later
//     version of an existing metric (`hse.energy@2`), an entirely new reviewed
//     metric, and definitions that sit UNCALIBRATED while they wait for their
//     own separately reviewed calibration task.
//
// Formally CANONICAL_HIM_V1_IDENTITIES is a subset of the application catalog
// identities, where identity is (metricKey, definitionVersion) and NEVER
// metricKey alone. So nothing below may assert a complete-catalog length, an
// equality between the catalog's calibrated entries and this manifest, a global
// uncalibrated count, or versionless key uniqueness across the whole catalog.
//
// The three rules this replaces - `catalog length === 17`, exact equality
// between the catalog's calibrated metric KEYS and the manifest keys, and the
// manifest-global `EXPECTED_UNCALIBRATED_COUNT === 0` - each turned a true
// statement about today's population into a permanent ceiling on the future
// catalog. All three are driven in the anti-vacuity test below, which shows
// exactly which legitimate future states they would have rejected.
const identity=(metricKey,definitionVersion)=>`${metricKey}@${definitionVersion}`;
const MANIFEST_IDENTITIES=CANONICAL_V1_STRUCTURED_METRICS.map(contract=>identity(contract.metricKey,contract.definitionVersion));
// The preflight is plain Node and cannot import TypeScript, so it parses the
// catalog source - but version-awarely. An entry is recognised only when it
// names BOTH its metricKey and its definitionVersion, so two versions of one
// metric are two distinct identities and are never collapsed by key alone.
const parseDefinitions=block=>block.split('\n').map(line=>{const match=line.match(/metric\('([^']+)',(\d+),/);if(!match)return null;
 const contexts=line.match(/,\[((?:'[A-Z_]+',?)+)\],/),definitionVersion=Number(match[2]);
 return{metricKey:match[1],definitionVersion,identity:identity(match[1],definitionVersion),calibrated:line.includes("calculationStatus:'CALIBRATED'"),validContextKinds:contexts?[...contexts[1].matchAll(/'([A-Z_]+)'/g)].map(x=>x[1]):[]};}).filter(Boolean);
const collectionBlock=(source,name)=>{const open=`export const ${name} = Object.freeze([`,start=source.indexOf(open);
 if(start<0)throw new Error(`the catalog exports no ${name} collection`);
 const end=source.indexOf('\n] satisfies',start);
 if(end<0)throw new Error(`${name} is not a closed frozen collection`);
 return source.slice(start+open.length,end);};
// The complete application catalog: the frozen canonical v1 collection - proven
// to be spread into it, which is what makes the subset relation real - plus
// every later definition added to the extensible collection. No total is taken,
// and every future `metric(...)` call is simply another legal identity.
const applicationCatalogDefinitions=source=>{const canonical=parseDefinitions(collectionBlock(source,'CANONICAL_HIM_V1_METRICS')),extension=collectionBlock(source,'HIM_METRIC_CATALOG');
 if(!extension.includes('...CANONICAL_HIM_V1_METRICS'))throw new Error('the application catalog does not include the canonical v1 collection');
 return[...canonical,...parseDefinitions(extension)];};
// Duplicate means the EXACT same identity and version, mirroring the production
// registry. Same key at another version is not a duplicate here either.
const duplicateIdentities=definitions=>{const seen=new Set(),duplicates=[];for(const definition of definitions){if(seen.has(definition.identity))duplicates.push(definition.identity);seen.add(definition.identity);}return duplicates;};
// The repaired preflight rule: pure subset coverage. Every canonical v1
// manifest identity must exist in the application catalog under its EXACT
// (metricKey, definitionVersion) and be CALIBRATED. It takes no total, no size
// and no uncalibrated count, so additional catalog definitions - later
// versions, new metrics, calibrated or uncalibrated - are legal and invisible.
const canonicalV1CoverageViolations=(definitions,manifest)=>{const byIdentity=new Map(definitions.map(definition=>[definition.identity,definition]));
 return manifest.flatMap(contract=>{const wanted=identity(contract.metricKey,contract.definitionVersion),found=byIdentity.get(wanted);
  if(!found)return[`canonical v1 identity ${wanted} is missing from the application catalog`];
  if(!found.calibrated)return[`canonical v1 identity ${wanted} is not CALIBRATED`];
  return[];});};
// Future-state fixtures are real catalog SOURCES fed to the real checker above,
// never a disconnected demo that restates the desired answer.
const CANONICAL_ANCHOR='  ...CANONICAL_HIM_V1_METRICS,';
const futureDefinition=(metricKey,definitionVersion,calibrated)=>`  {...metric('${metricKey}',${definitionVersion},'Synthetic Future','HGS',null,['GOAL'],'Synthetic future definition fixture.')${calibrated?`,calculationStatus:'CALIBRATED',scaleReference:'${metricKey}.synthetic-5.v${definitionVersion}'`:''}},`;
const withFutureDefinitions=(source,...lines)=>{assert.ok(source.includes(CANONICAL_ANCHOR),'the extensible catalog spreads the canonical v1 collection');return source.replace(CANONICAL_ANCHOR,[CANONICAL_ANCHOR,...lines].join('\n'));};
const canonicalLineFor=(source,metricKey)=>{const line=source.split('\n').find(x=>x.includes(`metric('${metricKey}',1,`));assert.ok(line,`the catalog registers ${metricKey}@1 on one line`);return line;};
const withoutCanonical=(source,metricKey)=>source.split('\n').filter(line=>!line.includes(`metric('${metricKey}',1,`)).join('\n');
const canonicalUncalibrated=(source,metricKey)=>{const line=canonicalLineFor(source,metricKey),stripped=line.replace(",calculationStatus:'CALIBRATED'",'');assert.notEqual(stripped,line,`${metricKey}@1 is calibrated on one line`);return source.replace(line,stripped);};
const canonicalMovedToVersion=(source,metricKey,definitionVersion)=>{const line=canonicalLineFor(source,metricKey);return source.replace(line,line.replace(`metric('${metricKey}',1,`,`metric('${metricKey}',${definitionVersion},`));};

test('the canonical v1 manifest is a required version-exact subset of the extensible application catalog',()=>{
 const definitions=applicationCatalogDefinitions(catalogSource);
 // Subset coverage, never equality against the complete future catalog.
 assert.deepEqual(canonicalV1CoverageViolations(definitions,CANONICAL_V1_STRUCTURED_METRICS),[],'every canonical v1 identity exists in the application catalog and is CALIBRATED');
 // Manifest identities are unique by (metricKey, definitionVersion) and every
 // one of them carries its version explicitly.
 assert.equal(new Set(MANIFEST_IDENTITIES).size,MANIFEST_IDENTITIES.length,'manifest identities are unique by metricKey and definitionVersion');
 for(const contract of CANONICAL_V1_STRUCTURED_METRICS)assert.equal(contract.definitionVersion,1,`${contract.metricKey} is a canonical v1 identity`);
 // The frozen canonical v1 collection is exactly the seventeen historical @1
 // identities and all of them are CALIBRATED. This exactness is legal because
 // it owns a closed foundation set on both sides - the frozen catalog block and
 // the frozen manifest - and makes no claim about the application catalog.
 const canonical=parseDefinitions(collectionBlock(catalogSource,'CANONICAL_HIM_V1_METRICS'));
 assert.deepEqual([...canonical.map(entry=>entry.identity)].sort(),[...MANIFEST_IDENTITIES].sort(),'the frozen canonical v1 collection is exactly the manifest identities');
 assert.ok(canonical.every(entry=>entry.definitionVersion===1&&entry.calibrated),'every canonical v1 definition is version 1 and CALIBRATED');
 // Exact duplicate identity/version is rejected across the whole catalog, while
 // versionless key uniqueness deliberately is NOT required of it.
 assert.deepEqual(duplicateIdentities(definitions),[],'no exact duplicate metricKey@definitionVersion exists in the application catalog');
});
test('canonical v1 model allowlists, ACTIVE bindings, positive SQL paths, and unsupported contexts cannot drift',()=>{for(const contract of CANONICAL_V1_STRUCTURED_METRICS){const model=read(`apps/api/src/human-model/${contract.model}`),sql=read(`database/migrations/${contract.migration}`),key=contract.metricKey.replace('.','\\.'),version=contract.definitionVersion;assert.deepEqual(contextsFromModel(model),contract.approved,`${contract.metricKey} model allowlist`);assertPositiveSqlPaths(contract,sql);for(const context of contract.approved)assert.match(sql,new RegExp(`'${key}',${version},'${context}',1,'ACTIVE'`),`${contract.metricKey}@${version}/${context} binding`);for(const context of HIM_CONTEXTS.filter(x=>!contract.approved.includes(x)))assert.doesNotMatch(sql,new RegExp(`'${key}',${version},'${context}',1,'ACTIVE'`),`${contract.metricKey}@${version}/${context} must remain unsupported`);assert.match(sql,/Unsupported|Unknown|cross-user/i,`${contract.metricKey} negative path`);}});
test('canonical current-read routing is definition-authoritative with no per-metric repository expression',()=>{const repository=read('apps/api/src/human-model/him.repository.ts');
 // QHIM-005 / QHIM-007: canonical latest goes through the one database read
 // authority. The repository must carry NO hand-coded metric/context routing
 // expression and no snapshot-version or raw-history latest path - context
 // eligibility is owned by the exact persisted metric definition.
 assert.match(repository,/rpc\/read_him_latest_measurement_v1/,'canonical latest calls the canonical RPC');
 assert.match(repository,/p_definition_version/,'canonical latest forwards the exact definition version');
 assert.equal([...repository.matchAll(/key==='([a-z.-]+)'/g)].length,0,'no hand-coded metric routing expression survives in the repository');
 assert.doesNotMatch(repository,/snapshot_version\.desc/,'no snapshot-version latest ordering survives in the repository');
 const getLatest=repository.slice(repository.indexOf('async getLatest'),repository.indexOf('listForContext'));
 assert.doesNotMatch(getLatest,/him_metric_snapshots|him_current_structured_measurements/,'canonical latest queries no table or view directly');
 // The manifest's approved contexts stay drift-proof against the application
 // catalog, which mirrors the persisted definition authority - resolved by
 // EXACT identity, so a later version of one of these metrics carries its own
 // context list and can never answer for the canonical v1 one.
 const catalogContexts=new Map(applicationCatalogDefinitions(catalogSource).map(definition=>[definition.identity,definition.validContextKinds]));
 for(const contract of CANONICAL_V1_STRUCTURED_METRICS){const owned=catalogContexts.get(identity(contract.metricKey,contract.definitionVersion));assert.ok(owned,`${contract.metricKey}@${contract.definitionVersion} exists in the application catalog`);assert.deepEqual([...owned].sort(),[...contract.approved].sort(),`${contract.metricKey}@${contract.definitionVersion} catalog contexts match the approved manifest contexts`);}});
test('a reversed approved-context predicate fails before push',()=>{const contract=CANONICAL_V1_STRUCTURED_METRICS.find(x=>x.metricKey==='hse.self-confidence'),sql=read(`database/migrations/${contract.migration}`),reversed=sql.replace("IF p_context_kind=ANY(ARRAY['SITUATION','DECISION'])THEN","IF p_context_kind<>ALL(ARRAY['SITUATION','DECISION'])THEN");assert.notEqual(reversed,sql);assert.throws(()=>assertPositiveSqlPaths(contract,reversed),/approved SQL path/);});

test('legitimate future catalog growth passes while a broken canonical v1 identity still fails',()=>{
 // PASS fixtures P1-P6. Each is a real application catalog source driven
 // through the real parser, the real subset checker and the real duplicate
 // rule above - not a restatement of the expected answer.
 const P1=catalogSource;
 const P2=withFutureDefinitions(catalogSource,futureDefinition('hse.energy',2,true));
 const P3=withFutureDefinitions(catalogSource,futureDefinition('hse.energy',2,false));
 const P4=withFutureDefinitions(catalogSource,futureDefinition('hgs.future-appraisal',1,true));
 const P5=withFutureDefinitions(catalogSource,futureDefinition('hgs.future-appraisal',1,false));
 const P6=withFutureDefinitions(catalogSource,futureDefinition('hse.energy',2,true),futureDefinition('hse.stress',2,false),futureDefinition('hgs.future-appraisal',1,true),futureDefinition('hgs.second-future-appraisal',1,false));
 const PASS=[['P1 today',P1],['P2 calibrated later version',P2],['P3 uncalibrated later version',P3],['P4 calibrated eighteenth metric',P4],['P5 uncalibrated eighteenth metric',P5],['P6 mixed future inventory',P6]];
 for(const[label,source]of PASS){const definitions=applicationCatalogDefinitions(source);
  assert.deepEqual(canonicalV1CoverageViolations(definitions,CANONICAL_V1_STRUCTURED_METRICS),[],`${label} must keep the canonical v1 preflight green`);
  assert.deepEqual(duplicateIdentities(definitions),[],`${label} declares no exact duplicate identity/version`);}
 // The PASS fixtures are meaningful, not empty: they really do enlarge the
 // catalog beyond the frozen seventeen, really do add a later version of an
 // existing metric, and really do carry uncalibrated definitions.
 const canonicalCount=parseDefinitions(collectionBlock(catalogSource,'CANONICAL_HIM_V1_METRICS')).length;
 const grown=[P2,P3,P4,P5,P6].map(applicationCatalogDefinitions);
 for(const definitions of grown)assert.ok(definitions.length>canonicalCount,'the future fixtures really enlarge the application catalog');
 assert.ok(grown.some(definitions=>definitions.some(x=>x.metricKey==='hse.energy'&&x.definitionVersion===2)),'a later version of an existing metric is really present');
 assert.ok(grown.some(definitions=>definitions.some(x=>!x.calibrated)),'an uncalibrated future definition is really present');
 // F5 - same metric key at another definition version is legal, never a
 // duplicate, and both identities coexist.
 const bothEnergyVersions=applicationCatalogDefinitions(P2).filter(x=>x.metricKey==='hse.energy');
 assert.deepEqual(bothEnergyVersions.map(x=>x.definitionVersion).sort(),[1,2],'hse.energy@1 and hse.energy@2 coexist');
 assert.deepEqual(duplicateIdentities(applicationCatalogDefinitions(P2)),[],'same key at a different definition version is not a duplicate');
 // F1 - a missing canonical v1 identity still fails.
 assert.deepEqual(canonicalV1CoverageViolations(applicationCatalogDefinitions(withoutCanonical(catalogSource,'hse.energy')),CANONICAL_V1_STRUCTURED_METRICS),['canonical v1 identity hse.energy@1 is missing from the application catalog'],'a missing canonical v1 identity fails');
 // F2 - a later version cannot substitute for a missing canonical v1 identity.
 const replaced=applicationCatalogDefinitions(canonicalMovedToVersion(catalogSource,'hse.energy',2));
 assert.ok(replaced.some(x=>x.identity==='hse.energy@2'&&x.calibrated),'the fixture really provides a calibrated hse.energy@2');
 assert.ok(!replaced.some(x=>x.identity==='hse.energy@1'),'the fixture really removed hse.energy@1');
 assert.deepEqual(canonicalV1CoverageViolations(replaced,CANONICAL_V1_STRUCTURED_METRICS),['canonical v1 identity hse.energy@1 is missing from the application catalog'],'hse.energy@2 cannot satisfy the hse.energy@1 requirement');
 // F3 - an uncalibrated canonical v1 identity is not rescued by a calibrated
 // later version of the same metric.
 const downgraded=applicationCatalogDefinitions(withFutureDefinitions(canonicalUncalibrated(catalogSource,'hse.energy'),futureDefinition('hse.energy',2,true)));
 assert.ok(downgraded.some(x=>x.identity==='hse.energy@2'&&x.calibrated),'the fixture really provides a calibrated hse.energy@2');
 assert.ok(downgraded.some(x=>x.identity==='hse.energy@1'&&!x.calibrated),'the fixture really left hse.energy@1 uncalibrated');
 assert.deepEqual(canonicalV1CoverageViolations(downgraded,CANONICAL_V1_STRUCTURED_METRICS),['canonical v1 identity hse.energy@1 is not CALIBRATED'],'a calibrated later version cannot rescue an uncalibrated canonical v1 identity');
 // F4 - an exact duplicate identity/version is still rejected.
 assert.deepEqual(duplicateIdentities(applicationCatalogDefinitions(withFutureDefinitions(catalogSource,futureDefinition('hse.energy',1,true)))),['hse.energy@1'],'an exact duplicate metricKey@definitionVersion is rejected');
 // Every canonical v1 identity stays individually required, including while
 // legitimate later catalog growth is present.
 for(const contract of CANONICAL_V1_STRUCTURED_METRICS)assert.equal(canonicalV1CoverageViolations(applicationCatalogDefinitions(withoutCanonical(P6,contract.metricKey)),CANONICAL_V1_STRUCTURED_METRICS).length,1,`${contract.metricKey}@1 stays required beside later catalog growth`);
});

test('the retired complete-catalog rules really would have rejected legitimate future definitions',()=>{
 // The three retired rules, driven in memory against the same real fixtures.
 // Each passed on canonical main - which is exactly why green CI could never
 // expose any of them - and each fails on legitimate future catalog growth.
 const retiredExactSeventeen=definitions=>definitions.length===17;
 const retiredVersionlessCalibratedEquality=(definitions,manifest)=>{const catalogKeys=definitions.filter(x=>x.calibrated).map(x=>x.metricKey).sort(),manifestKeys=manifest.map(x=>x.metricKey).sort();return catalogKeys.length===manifestKeys.length&&catalogKeys.every((key,index)=>key===manifestKeys[index]);};
 const retiredGlobalUncalibratedZero=definitions=>definitions.filter(x=>!x.calibrated).length===0;
 const today=applicationCatalogDefinitions(catalogSource);
 const withCalibratedLaterVersion=applicationCatalogDefinitions(withFutureDefinitions(catalogSource,futureDefinition('hse.energy',2,true)));
 const withUncalibratedFutureMetric=applicationCatalogDefinitions(withFutureDefinitions(catalogSource,futureDefinition('hgs.future-appraisal',1,false)));
 assert.ok(retiredExactSeventeen(today),'the retired exact-17 rule passed on canonical main');
 assert.ok(retiredVersionlessCalibratedEquality(today,CANONICAL_V1_STRUCTURED_METRICS),'the retired versionless calibrated-key equality passed on canonical main');
 assert.ok(retiredGlobalUncalibratedZero(today),'the retired global uncalibrated-zero rule passed on canonical main');
 // A reviewed, calibrated hse.energy@2 breaks the exact-17 ceiling and the
 // versionless calibrated-key equality - the latter because `hse.energy`
 // appears twice as a KEY while the manifest names it once.
 assert.ok(!retiredExactSeventeen(withCalibratedLaterVersion),'the retired exact-17 rule would have rejected a calibrated later version');
 assert.ok(!retiredVersionlessCalibratedEquality(withCalibratedLaterVersion,CANONICAL_V1_STRUCTURED_METRICS),'the retired versionless calibrated-key equality would have rejected a calibrated later version');
 // A future metric awaiting its own calibration task breaks the exact-17
 // ceiling and the manifest-global zero-uncalibrated rule.
 assert.ok(!retiredExactSeventeen(withUncalibratedFutureMetric),'the retired exact-17 rule would have rejected an uncalibrated future metric');
 assert.ok(!retiredGlobalUncalibratedZero(withUncalibratedFutureMetric),'the retired global uncalibrated-zero rule would have rejected an uncalibrated future metric');
 // The repaired checker accepts exactly those states, which is the point of
 // the replacement, while the canonical v1 regressions above still fail.
 for(const definitions of[today,withCalibratedLaterVersion,withUncalibratedFutureMetric])assert.deepEqual(canonicalV1CoverageViolations(definitions,CANONICAL_V1_STRUCTURED_METRICS),[],'the repaired canonical v1 subset checker accepts legitimate future catalogs');
 // The manifest itself no longer exports a global future-universe count, and
 // it is named for the canonical v1 subset it actually owns.
 const manifestSource=read('tests/him-structured-measurement.manifest.mjs');
 assert.match(manifestSource,/export const CANONICAL_V1_STRUCTURED_METRICS=Object\.freeze\(\[/,'the manifest is named for the canonical v1 subset it owns');
 assert.doesNotMatch(manifestSource,/^export const EXPECTED_UNCALIBRATED_COUNT/m,'the manifest-global uncalibrated-count ceiling is gone');
 // The production registry initializes from the EXTENSIBLE catalog surface, so
 // legitimate future definitions actually reach the runtime registry instead of
 // being frozen out by a canonical-v1-named symbol.
 const registry=read('apps/api/src/human-model/him-definition.registry.ts');
 assert.match(registry,/HIM_METRIC_CATALOG\.forEach\(definition=>this\.register\(definition\)\)/,'the registry consumes the extensible application catalog');
 assert.doesNotMatch(registry,/INITIAL_HIM_METRICS/,'no ambiguous initial-catalog symbol survives in the registry');
 assert.match(registry,/`\$\{definition\.metricKey\}@\$\{definition\.definitionVersion\}`/,'the registry keys storage by exact metricKey@definitionVersion');
 assert.doesNotMatch(catalogSource,/INITIAL_HIM_METRICS/,'the ambiguous INITIAL_HIM_METRICS symbol is retired from the catalog');
});
