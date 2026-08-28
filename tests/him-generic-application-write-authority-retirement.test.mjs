import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';import ts from'typescript';
// QHIM-013 cross-layer static contract, with the QHIM-014 semantic-completeness
// remediation. It connects three layers that were previously allowed to
// disagree:
//
//   1. the historical Foundation generic writer in frozen migration 0009;
//   2. its database retirement to a fail-closed no-write tombstone in 0051;
//   3. the final application-layer retirement of the generic write boundary.
//
// The QHIM-013 defect was that (2) retired the database function while the
// application still exported HimService.observe ->
// HimRepository.createObservation -> the legacy generic snapshot RPC.
//
// QHIM-014: the earlier revisions of this guard reasoned about SOURCE TEXT, so
// ordinary local syntax equivalences slipped through - an aliased table target,
// an inline object writer router, an aliased metric identity, and a retired RPC
// path computed with Array#join all returned zero violations. Accumulating more
// text patterns was the wrong abstraction. The write-authority half of this
// checker is now SYNTAX-AWARE: every governed production file is parsed with
// the TypeScript compiler's own parser (ts.createSourceFile) and the rules run
// over AST nodes, with narrow local constant/alias resolution on top.
//
// QHIM-014 AMENDMENT 1 (independent final review of the AST checker itself):
// binding resolution is LEXICAL and location-aware, never file-global - a
// reference resolves only to the declaration actually visible at its own
// location, so two unrelated methods reusing one local name never see each
// other's values; a metric identity reached through `this.<property>` follows
// the nearest containing class property initializer; dynamic-path write
// classification requires positive create/correct/calculate verb evidence in
// the RPC authority path (the `_measurement` noun alone is a legal dynamic
// READ shape, and a fully dynamic verb is never guessed at); and the direct
// snapshot-table rule applies only to the application request-call shape -
// callee member named `request`, target at argument index 1, options at
// argument index 2 - never to an arbitrary call that merely mentions a table
// name somewhere and a method object somewhere else.
//
// PROOF BOUNDARY - stated honestly. This is NOT a full static analyzer. There
// is no TypeScript Program, no type checker, no interprocedural or
// cross-module dataflow, no arbitrary computed-code evaluation, no reflection
// or generated-code detection, and no application source is ever executed.
// What it does understand is ordinary LOCAL syntax: string and template
// literals, parenthesized/as/non-null wrappers, identifiers and class
// properties initialized by a resolvable expression (including alias chains),
// `+` concatenation, array literals joined with a resolvable separator, and
// template expressions whose substitutions all resolve to constants. Anything
// it cannot classify safely is left alone rather than failed, because a guard
// that invents false positives to look thorough is worse than one that states
// its limits.
//
// WHAT THIS GUARD ASSERTS. Exactly one closure-state fact: at this Measurement
// Foundation closure state the retired legacy generic snapshot writer has no
// live application boundary, and no replacement GENERIC HIM measurement-write
// authority exists anywhere in the application. Each rule names a mechanism:
//
//   A. a request target that RESOLVES to the retired generic snapshot RPC;
//   B. a measurement-write RPC path assembled at runtime;
//   C. a metric identity switched on, where the switch body writes;
//   D. a metric identity indexing or map-keying a container that HOLDS
//      metric-owned write RPCs;
//   E. a metric identity compared against to choose between write RPCs;
//   F. the two retired legacy surfaces regaining a generic write method;
//   G. a request whose target RESOLVES to him_metric_snapshots with a mutating
//      method.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT. It reads no migration inventory. It
// freezes no metric inventory, no metric version, and no per-file count of
// exact write RPCs. It does NOT forbid a future, separately reviewed, EXACT
// metric-specific adapter: such an adapter may hardcode several exact RPCs for
// its one metric, may hold a metric-identity constant, may alias its own exact
// path through a local const, may keep an exact-Energy path container selected
// by a non-metric operation, and may name its methods as its reviewed contract
// sees fit. It does NOT forbid a dynamically assembled READ path, and it never
// treats HTTP POST as evidence of writing - RPC reads in this repository
// legitimately POST, so a metric identity feeding a READ registry stays legal
// even in a file that also contains an exact writer. The conventional
// generic-method-name rules apply only to the two legacy surfaces QHIM-013
// retires. A future GENERIC application submission API would be a separately
// reviewed runtime contract and would intentionally update this guard.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const APP_SRC='apps/api/src';
const HIM_DIR=`${APP_SRC}/human-model`;
const SERVICE=`${HIM_DIR}/him.service.ts`;
const REPOSITORY=`${HIM_DIR}/him.repository.ts`;
const TYPES=`${HIM_DIR}/him.types.ts`;
const LEGACY_RPC_PATH='rpc/create_him_metric_snapshot';
const LEGACY_RPC_NAME='create_him_metric_snapshot';
// The two legacy generic application surfaces this task retires. Conventional
// generic-write method names are forbidden here and only here.
const RETIRED_GENERIC_SURFACES=[SERVICE,REPOSITORY];
const GENERIC_WRITE_METHODS=['observe','observeMetric','createObservation','createMeasurement','createSnapshot','writeSnapshot','submitMeasurement'];
const MUTATING_METHODS=['POST','PUT','PATCH','DELETE'];
const METRIC_IDENTITY_NAME=/^metric_?[Kk]ey$/;
const isMetricOwnedWriteRpc=value=>/^(?:rpc\/)?(?:create|correct|calculate)_[a-z0-9_]+_measurement$/i.test(value);
const isRetiredGenericRpc=value=>/^\/?(?:rpc\/)?create_him_metric_snapshot$/i.test(value);
const isSnapshotTarget=value=>/^\/?him_metric_snapshots(?:\?|$)/i.test(value);
// Positive write-verb evidence for a dynamically assembled RPC authority
// path, tested against the path's skeleton (contiguous static pieces merged,
// one NUL HOLE per unresolvable substitution). The `_measurement` noun alone
// is deliberately NOT write evidence: dynamic READ paths are legal, and HTTP
// POST is never write evidence either.
const WRITE_VERB_EVIDENCE=/rpc\/\0?(?:create|correct|calculate)(?![a-z0-9])/i;
const MAX_DEPTH=16;

// --- TypeScript AST layer ----------------------------------------------------
// The parser is the compiler's own. No Program, no type checker, no new
// dependency: typescript is already the repository's toolchain.
const unwrap=node=>{
 let current=node;
 for(let depth=0;current&&depth<MAX_DEPTH;depth++){
  if(ts.isParenthesizedExpression(current)||ts.isAsExpression(current)||ts.isNonNullExpression(current)||(ts.isSatisfiesExpression?.(current)??false)){current=current.expression;continue;}
  return current;
 }
 return current;
};
const declaredName=name=>{
 if(!name)return undefined;
 if(ts.isIdentifier(name)||ts.isPrivateIdentifier(name))return name.text;
 if(ts.isStringLiteral(name)||ts.isNumericLiteral(name))return name.text;
 return undefined;
};
// --- lexical binding resolution (QHIM-014 Amendment 1, defect 1) -------------
// Binding resolution is lexical and location-aware, never file-global. A
// reference resolves only to the declaration actually visible at its own
// location: nearest enclosing scope first, walking outward, with inner
// declarations, parameters, and destructured bindings shadowing outer names.
// Two methods legitimately reusing one local name never see each other's
// values. Class properties are never lexical names: they are reachable only
// through `this.<property>` (the nearest containing class) or through the
// declaring class's own lexically visible name for static members - never by
// property name alone across unrelated objects. Object-literal data keys are
// deliberately NOT bound, so a data key can never masquerade as an alias.
const isScopeBoundary=node=>ts.isSourceFile(node)||ts.isBlock(node)||ts.isModuleBlock(node)||ts.isCaseBlock(node)||ts.isFunctionLike(node)||ts.isForStatement(node)||ts.isForInStatement(node)||ts.isForOfStatement(node)||ts.isCatchClause(node);
const scopeDeclarationCache=new WeakMap();
// The declarations one scope node OWNS: its variables and destructured binding
// elements, its parameters when it is function-like, and the classes and
// functions declared directly in it. Nested scopes own their declarations
// themselves and are not entered; class bodies contribute no lexical names.
function localDeclarationsOf(scope){
 if(scopeDeclarationCache.has(scope))return scopeDeclarationCache.get(scope);
 const declarations=new Map();
 const declare=(name,record)=>{if(name)declarations.set(name,[...(declarations.get(name)??[]),record]);};
 const declarePattern=(name,initializer,bindingSource)=>{
  if(!name)return;
  if(ts.isIdentifier(name))declare(name.text,{initializer,bindingSource});
  // A destructured element declares its LOCAL name and remembers the source
  // property, so `const {metricKey: k}` stays a metric-identity alias.
  else if(ts.isObjectBindingPattern(name))for(const element of name.elements)declarePattern(element.name,element.initializer,declaredName(element.propertyName)??declaredName(element.name));
  else if(ts.isArrayBindingPattern(name))for(const element of name.elements)if(ts.isBindingElement(element))declarePattern(element.name,element.initializer,undefined);
 };
 const visit=node=>{
  if(node!==scope&&isScopeBoundary(node))return;
  if(ts.isClassDeclaration(node)||ts.isClassExpression(node)){if(node.name)declare(node.name.text,{classNode:node});return;}
  if(ts.isVariableDeclaration(node))declarePattern(node.name,node.initializer,undefined);
  else if(ts.isParameter(node))declarePattern(node.name,undefined,undefined);
  else if(ts.isFunctionDeclaration(node)&&node.name)declare(node.name.text,{});
  ts.forEachChild(node,visit);
 };
 visit(scope);
 scopeDeclarationCache.set(scope,declarations);
 return declarations;
}
// The declarations of `name` visible AT the reference: the nearest enclosing
// scope that declares the name wins outright, so a shadowed outer declaration
// can never leak inward - even when the outer value would have looked safer.
function visibleDeclarations(reference,name){
 for(let node=reference;node;node=node.parent){
  if(!isScopeBoundary(node))continue;
  const found=localDeclarationsOf(node).get(name);
  if(found?.length)return found;
 }
 return[];
}
// `this.<property>` denotes the NEAREST containing class and nothing else: an
// outer class's property never leaks into an inner one.
function nearestClassOf(node){
 for(let current=node;current;current=current.parent)if(ts.isClassDeclaration(current)||ts.isClassExpression(current))return current;
 return undefined;
}
const classPropertyInitializers=(classNode,propertyName)=>classNode.members.filter(member=>ts.isPropertyDeclaration(member)&&declaredName(member.name)===propertyName&&member.initializer).map(member=>member.initializer);
// The initializers a property access may resolve to: `this.<p>` follows the
// nearest containing class's property `<p>`; `<ClassName>.<p>` follows a
// lexically visible class declaration's own property `<p>`. Arbitrary
// `<object>.<property>` is never resolved by property name alone - that is
// exactly the cross-object confusion lexical resolution exists to prevent.
function propertyInitializersOf(access){
 const owner=unwrap(access.expression);
 if(!owner)return[];
 if(owner.kind===ts.SyntaxKind.ThisKeyword){
  const classNode=nearestClassOf(access);
  return classNode?classPropertyInitializers(classNode,access.name.text):[];
 }
 if(ts.isIdentifier(owner)){
  const out=[];
  for(const declaration of visibleDeclarations(owner,owner.text))if(declaration.classNode)out.push(...classPropertyInitializers(declaration.classNode,access.name.text));
  return out;
 }
 return[];
}
// Every initializer an identifier or supported property access may resolve to
// at this exact location.
const initializersOf=node=>ts.isIdentifier(node)?visibleDeclarations(node,node.text).map(declaration=>declaration.initializer).filter(Boolean):ts.isPropertyAccessExpression(node)?propertyInitializersOf(node):[];
// Resolve an expression to the nearest node of a wanted shape, following only
// lexically visible aliases. Bounded and cycle-safe.
function resolveNode(node,predicate,seen=new Set(),depth=0){
 const current=unwrap(node);
 if(!current||depth>MAX_DEPTH||seen.has(current))return undefined;
 seen.add(current);
 if(predicate(current))return current;
 for(const initializer of initializersOf(current)){
  const found=resolveNode(initializer,predicate,seen,depth+1);
  if(found)return found;
 }
 return undefined;
}
// Conservative, bounded, cycle-safe constant resolution. Returns undefined
// whenever the value is not an ordinary lexically visible constant - never a
// guess.
function resolveString(node,seen=new Set(),depth=0){
 const current=unwrap(node);
 if(!current||depth>MAX_DEPTH||seen.has(current))return undefined;
 seen.add(current);
 if(ts.isStringLiteral(current)||ts.isNoSubstitutionTemplateLiteral(current))return current.text;
 if(ts.isBinaryExpression(current)&&current.operatorToken.kind===ts.SyntaxKind.PlusToken){
  const left=resolveString(current.left,seen,depth+1),right=resolveString(current.right,seen,depth+1);
  return left===undefined||right===undefined?undefined:left+right;
 }
 if(ts.isTemplateExpression(current)){
  let out=current.head.text;
  for(const span of current.templateSpans){
   const value=resolveString(span.expression,seen,depth+1);
   if(value===undefined)return undefined;
   out+=value+span.literal.text;
  }
  return out;
 }
 if(ts.isCallExpression(current)&&ts.isPropertyAccessExpression(current.expression)&&current.expression.name.text==='join'){
  const parts=resolveStringArray(current.expression.expression,seen,depth+1);
  if(!parts)return undefined;
  const separator=current.arguments.length?resolveString(current.arguments[0],seen,depth+1):',';
  return separator===undefined?undefined:parts.join(separator);
 }
 for(const initializer of initializersOf(current)){
  const value=resolveString(initializer,seen,depth+1);
  if(value!==undefined)return value;
 }
 return undefined;
}
function resolveStringArray(node,seen=new Set(),depth=0){
 const array=resolveNode(node,ts.isArrayLiteralExpression,seen,depth);
 if(!array)return undefined;
 const out=[];
 for(const element of array.elements){
  const value=resolveString(element,new Set(),depth+1);
  if(value===undefined)return undefined;
  out.push(value);
 }
 return out;
}
// The skeleton of a partially dynamic path: resolvable pieces keep their exact
// text, every unresolvable substitution becomes exactly one NUL HOLE, and
// adjacent static pieces stay contiguous. Used only to classify what KIND of
// path is being assembled - never to pretend the value is known.
const HOLE='\u0000';
function pathSkeletonParts(node,out=[],depth=0){
 const current=unwrap(node);
 if(!current||depth>MAX_DEPTH){out.push(HOLE);return out;}
 const resolved=resolveString(current);
 if(resolved!==undefined){out.push(resolved);return out;}
 if(ts.isTemplateExpression(current)){
  out.push(current.head.text);
  for(const span of current.templateSpans){pathSkeletonParts(span.expression,out,depth+1);out.push(span.literal.text);}
  return out;
 }
 if(ts.isBinaryExpression(current)&&current.operatorToken.kind===ts.SyntaxKind.PlusToken){
  pathSkeletonParts(current.left,out,depth+1);pathSkeletonParts(current.right,out,depth+1);return out;
 }
 out.push(HOLE);
 return out;
}
const pathSkeleton=node=>pathSkeletonParts(node).join('');
const skeletonRuns=skeleton=>skeleton.split(HOLE);
// A metric identity: metricKey / metric_key as its own name, reached directly,
// through a direct property access, through a lexically visible alias chain,
// or through a `this.<property>` whose nearest-class initializer is itself a
// metric identity (Amendment 1, defect 2). An unrelated string identifier is
// never one, and arbitrary `<object>.<property>` never classifies by property
// name alone.
function isMetricIdentity(node,seen=new Set(),depth=0){
 const current=unwrap(node);
 if(!current||depth>MAX_DEPTH||seen.has(current))return false;
 seen.add(current);
 if(ts.isPropertyAccessExpression(current)){
  if(METRIC_IDENTITY_NAME.test(current.name.text))return true;
  return propertyInitializersOf(current).some(initializer=>isMetricIdentity(initializer,seen,depth+1));
 }
 if(ts.isElementAccessExpression(current)){
  const key=resolveString(current.argumentExpression);
  return key!==undefined&&METRIC_IDENTITY_NAME.test(key);
 }
 if(!ts.isIdentifier(current))return false;
 if(METRIC_IDENTITY_NAME.test(current.text))return true;
 for(const declaration of visibleDeclarations(current,current.text)){
  if(declaration.bindingSource!==undefined&&METRIC_IDENTITY_NAME.test(declaration.bindingSource))return true;
  if(declaration.initializer&&isMetricIdentity(declaration.initializer,seen,depth+1))return true;
 }
 return false;
}
// A container's candidate values, for object literals and Map constructors,
// reached directly or through a lexically visible alias. Classification is by
// CONTENTS, never by variable name.
const isMapConstruction=node=>ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Map'&&Boolean(node.arguments?.length);
function containerValues(node){
 const objectLiteral=resolveNode(node,ts.isObjectLiteralExpression);
 if(objectLiteral)return objectLiteral.properties.filter(ts.isPropertyAssignment).map(property=>property.initializer);
 const mapConstruction=resolveNode(node,isMapConstruction);
 if(!mapConstruction)return undefined;
 const entries=resolveNode(mapConstruction.arguments[0],ts.isArrayLiteralExpression);
 if(!entries)return undefined;
 return entries.elements.map(entry=>resolveNode(entry,ts.isArrayLiteralExpression)).filter(Boolean).map(pair=>pair.elements[1]).filter(Boolean);
}
const isWriterContainer=node=>{
 const values=containerValues(node);
 if(!values)return false;
 return values.some(value=>{const resolved=resolveString(value);return resolved!==undefined&&isMetricOwnedWriteRpc(resolved);});
};
const containsWriteRpc=node=>{
 let found=false;
 const walk=current=>{
  if(found||!current)return;
  const resolved=resolveString(current);
  if(resolved!==undefined&&isMetricOwnedWriteRpc(resolved)){found=true;return;}
  ts.forEachChild(current,walk);
 };
 walk(node);
 return found;
};
const comparesMetricIdentity=node=>{
 let found=false;
 const walk=current=>{
  if(found||!current)return;
  if(ts.isBinaryExpression(current)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken].includes(current.operatorToken.kind)
   &&(isMetricIdentity(current.left)||isMetricIdentity(current.right))){found=true;return;}
  ts.forEachChild(current,walk);
 };
 walk(node);
 return found;
};

// --- production source collection -------------------------------------------
// Production means tracked application source only: *.spec.ts is test source
// and is deliberately excluded, because a test may legitimately name a retired
// symbol while proving its absence.
const listSourceFiles=(dir,out=[])=>{
 for(const entry of readdirSync(new URL(`${dir}/`,root),{withFileTypes:true})){
  const path=`${dir}/${entry.name}`;
  if(entry.isDirectory())listSourceFiles(path,out);else out.push(path);
 }
 return out;
};
const isProductionPath=path=>path.endsWith('.ts')&&!path.endsWith('.spec.ts');
const PRODUCTION=new Map(listSourceFiles(APP_SRC).filter(isProductionPath).map(path=>[path,read(path)]));
const himProduction=sources=>new Map([...sources].filter(([path])=>path.startsWith(`${HIM_DIR}/`)));

// --- the one real guard the fixtures below drive -----------------------------
// A pure function of an application-source map: it consults no migration
// listing, no database state, and no metric inventory to reach a verdict.
const analysisCache=new Map();
function fileViolations(path,code){
 const key=`${path}\u0000${code}`;
 if(analysisCache.has(key))return analysisCache.get(key);
 const violations=[];
 const add=mechanism=>{const message=`${path}: ${mechanism}`;if(!violations.includes(message))violations.push(message);};
 const sourceFile=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 // The retired generic write DTO is a type identity, checked by name.
 if(/\bCreateHimMetricObservation\b/.test(code))add('references the retired generic HIM write DTO');
 const checkValue=node=>{
  if(!node)return;
  const resolved=resolveString(node);
  if(resolved!==undefined){
   if(isRetiredGenericRpc(resolved))add('resolves a target to the retired legacy generic snapshot RPC');
   return;
  }
  // Not a constant: classify what KIND of path is being assembled from its
  // skeleton (contiguous static pieces merged, one HOLE per unknown part).
  const skeleton=pathSkeleton(node);
  if(skeleton.includes(LEGACY_RPC_NAME))add('resolves a target to the retired legacy generic snapshot RPC');
  // Amendment 1, defect 3: positive write-verb evidence is required. The
  // measurement noun alone never classifies a dynamic path as a write.
  else if(WRITE_VERB_EVIDENCE.test(skeleton))add('constructs a measurement-write RPC path dynamically');
 };
 const targetNamesSnapshotTable=node=>{
  const resolved=resolveString(node);
  if(resolved!==undefined)return isSnapshotTarget(resolved);
  return skeletonRuns(pathSkeleton(node)).some(run=>isSnapshotTarget(run));
 };
 const mutatingMethodOf=node=>{
  const current=resolveNode(node,ts.isObjectLiteralExpression);
  if(!current)return undefined;
  for(const property of current.properties){
   if(!ts.isPropertyAssignment(property)||declaredName(property.name)!=='method')continue;
   const verb=resolveString(property.initializer);
   if(verb!==undefined&&MUTATING_METHODS.includes(verb.toUpperCase()))return verb.toUpperCase();
  }
  return undefined;
 };
 // Amendment 1, defect 4: the application boundary's request-call shape -
 // a callee whose member name is `request`, the request target at argument
 // index 1, the options object at argument index 2 when present. Only this
 // shape carries application data-request semantics.
 const isApplicationRequestCall=node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='request';
 const walk=node=>{
  if(ts.isCallExpression(node)){
   for(const argument of node.arguments)checkValue(argument);
   // G. an application request whose TARGET argument resolves to
   // him_metric_snapshots with a mutating method in its OPTIONS argument.
   // An arbitrary call that merely mentions the table name in one argument
   // and a method object in another is not an application data request and
   // is deliberately not matched.
   if(isApplicationRequestCall(node)&&node.arguments.length>=3&&targetNamesSnapshotTable(node.arguments[1])&&mutatingMethodOf(node.arguments[2])!==undefined)add('issues a non-GET request against him_metric_snapshots');
   // D. a metric identity map-keying a container that HOLDS write RPCs.
   if(ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='get'&&node.arguments.length===1
    &&isMetricIdentity(node.arguments[0])&&isWriterContainer(node.expression.expression))add('looks a writer up from a map keyed by a metric identity');
  }
  if((ts.isVariableDeclaration(node)||ts.isPropertyDeclaration(node)||ts.isPropertyAssignment(node))&&node.initializer)checkValue(node.initializer);
  // D. a metric identity indexing a container that HOLDS write RPCs.
  if(ts.isElementAccessExpression(node)&&isMetricIdentity(node.argumentExpression)&&isWriterContainer(node.expression))add('indexes a writer lookup by a metric identity');
  // C. a metric identity switched on, where the switch body writes.
  if(ts.isSwitchStatement(node)&&isMetricIdentity(node.expression)&&containsWriteRpc(node.caseBlock))add('switches write authority on a metric identity');
  // E. a metric identity compared against to choose between write RPCs.
  if(ts.isConditionalExpression(node)&&comparesMetricIdentity(node.condition)&&(containsWriteRpc(node.whenTrue)||containsWriteRpc(node.whenFalse)))add('chooses a metric-owned write RPC by comparing a metric identity');
  if(ts.isIfStatement(node)&&comparesMetricIdentity(node.expression)&&(containsWriteRpc(node.thenStatement)||(node.elseStatement&&containsWriteRpc(node.elseStatement))))add('chooses a metric-owned write RPC by comparing a metric identity');
  // F. the two retired legacy surfaces regaining a generic write member.
  if(RETIRED_GENERIC_SURFACES.includes(path)&&(ts.isMethodDeclaration(node)||ts.isPropertyDeclaration(node)||ts.isMethodSignature(node))){
   const member=declaredName(node.name);
   if(member&&GENERIC_WRITE_METHODS.includes(member))add(`redefines the retired generic measurement-write method ${member}(...)`);
  }
  ts.forEachChild(node,walk);
 };
 walk(sourceFile);
 analysisCache.set(key,violations);
 return violations;
}
function qhim013Violations(sources){
 const violations=[];
 for(const[path,code]of sources)violations.push(...fileViolations(path,code));
 return violations;
}
const mutate=(sources,path,code)=>{const next=new Map(sources);next.set(path,code);return next;};
// Exported so the exact same guard implementation - never a re-typed copy of
// it - can be driven directly when reviewing a specific verdict.
export{qhim013Violations,HIM_DIR};

// --- synthetic, non-filesystem fixtures (test-only; no production writer) ----
const API=`constructor(private readonly dataApi:{request:(t:string,p:string,i?:object)=>Promise<unknown>}){}`;
const FIXTURE=`${HIM_DIR}/qhim014-fixture.service.ts`;
const verdict=(code,path=FIXTURE)=>qhim013Violations(new Map([[path,code]]));
const accepts=(label,code,path=FIXTURE)=>assert.deepEqual(verdict(code,path),[],`${label} must be ACCEPTED`);
const rejects=(label,code,mechanism,path=FIXTURE)=>{
 const violations=verdict(code,path);
 assert.ok(violations.some(violation=>violation.includes(mechanism)),`${label} must be REJECTED as "${mechanism}" (got ${JSON.stringify(violations)})`);
};

// Positive controls - separately reviewed shapes that must stay legal.
const P1_EXACT_ENERGY_WRITER=`import { Injectable } from '@nestjs/common';
@Injectable()
export class HseEnergySubmissionService {
  ${API}
  submitEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
}
`;
const P2_EXACT_ENERGY_CREATE_AND_CORRECT=`export class HseEnergySubmissionService {
  ${API}
  createEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
  correctEnergyMeasurement(token:string,observationId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/correct_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_supersedes_observation_id:observationId,p_response_code:responseCode})});
  }
}
`;
const P3_EXACT_WRITER_WITH_IDENTITY_CONSTANT=`export class HseEnergySubmissionService {
  private readonly metricKey = 'hse.energy';
  private readonly definitionVersion = 1;
  ${API}
  describe(){ return \`\${this.metricKey}@\${this.definitionVersion}\`; }
  submitEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
}
`;
const P4_DYNAMIC_FUTURE_READ=`export class FutureHimProjectionReader {
  ${API}
  readProjection(token:string,projection:string){
    return this.dataApi.request(token,\`rpc/read_him_\${projection}_v2\`,{method:'POST',body:'{}'});
  }
}
`;
const P5_EXACT_WRITER_WITH_READ_LOOKUP=`export class HseEnergySubmissionService {
  private readonly readRegistry=new Map([['hse.energy','rpc/read_him_energy_projection_v2'],['hse.stress','rpc/read_him_stress_projection_v2']]);
  ${API}
  submitEnergyMeasurement(token:string,sessionId:string,responseCode:string){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify({p_context_id:sessionId,p_response_code:responseCode})});
  }
  readProjection(token:string,metricKey:string){
    return this.dataApi.request(token,this.readRegistry.get(metricKey)??'rpc/read_him_energy_projection_v2',{method:'POST',body:'{}'});
  }
}
`;
const P6_ALIASED_EXACT_WRITER=`export class HseEnergySubmissionService {
  ${API}
  submitEnergyMeasurement(token:string,body:object){
    const path = 'rpc/create_hse_energy_measurement';
    return this.dataApi.request(token,path,{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const P7_EXACT_CONTAINER_WITHOUT_METRIC_SELECTION=`export class HseEnergySubmissionService {
  private readonly energyPaths={create:'rpc/create_hse_energy_measurement',correct:'rpc/correct_hse_energy_measurement'};
  ${API}
  submitEnergy(token:string,mode:'create'|'correct',body:object){
    return this.dataApi.request(token,this.energyPaths[mode],{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const MULTILINE_GET_READ=`export class SyntheticHimReader {
  ${API}
  history(token:string,userId:string){
    const q=new URLSearchParams({select:'*',user_id:\`eq.\${userId}\`,order:'snapshot_version.asc',limit:'128'});
    return this.dataApi.request(
      token,
      \`him_metric_snapshots?\${q}\`,
    );
  }
}
`;
// Amendment 1 positive controls.
// P8: two methods legitimately reusing one local name - one read path, one
// exact metric-specific Energy writer - with no generic routing and no direct
// table mutation anywhere.
const P8_HARMLESS_LOCAL_SHADOWING=`export class ScopedTargets {
  ${API}
  readLatest(token:string) {
    const target = 'rpc/read_him_latest_measurement_v1';
    return this.dataApi.request(token,target,{method:'POST',body:'{}'});
  }
  submitEnergyMeasurement(token:string,body:object) {
    const target = 'rpc/create_hse_energy_measurement';
    return this.dataApi.request(token,target,{method:'POST',body:JSON.stringify(body)});
  }
}
`;
// P9: a class property holding an exact metric-identity constant used only as
// a descriptive constant, never to select a generic writer.
const P9_CLASS_PROPERTY_IDENTITY_CONSTANT=`export class HseEnergySubmissionService {
  private readonly key = 'hse.energy';
  ${API}
  describe(){ return this.key; }
  submitEnergyMeasurement(token:string,body:object){
    return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify(body)});
  }
}
`;
// P10: a legitimate dynamic READ whose path ends in the measurement noun. The
// known verb is `read`; HTTP POST is not write evidence.
const P10_DYNAMIC_MEASUREMENT_READ=`export class FutureReader {
  ${API}
  read(token:string,projection:string) {
    return this.dataApi.request(
      token,
      \`rpc/read_him_\${projection}_measurement\`,
      { method:'POST', body:'{}' },
    );
  }
}
`;
// P11: an unrelated call that mentions the snapshot table in one argument and
// a method object in another. It is not an application data request - the
// callee member is not \`request\` - so it carries no write semantics.
const P11_UNRELATED_AUDIT_CALL=`declare function audit(topic:string,detail:object):void;
export class SnapshotAuditLog {
  note() {
    audit(
      'him_metric_snapshots',
      { method: 'POST' },
    );
  }
}
`;
const POSITIVE_CONTROLS=[
 ['P1 one exact Energy writer',P1_EXACT_ENERGY_WRITER],
 ['P2 exact Energy create + correct adapter',P2_EXACT_ENERGY_CREATE_AND_CORRECT],
 ['P3 exact writer holding a metric-identity constant',P3_EXACT_WRITER_WITH_IDENTITY_CONSTANT],
 ['P4 dynamically assembled future READ path',P4_DYNAMIC_FUTURE_READ],
 ['P5 exact writer beside an unrelated POST read-side metric lookup',P5_EXACT_WRITER_WITH_READ_LOOKUP],
 ['P6 exact writer reached through a local const alias',P6_ALIASED_EXACT_WRITER],
 ['P7 exact-Energy path container selected by a non-metric operation',P7_EXACT_CONTAINER_WITHOUT_METRIC_SELECTION],
 ['P8 harmless same-name locals in different methods',P8_HARMLESS_LOCAL_SHADOWING],
 ['P9 class property holding an exact non-routing identity constant',P9_CLASS_PROPERTY_IDENTITY_CONSTANT],
 ['P10 dynamic measurement READ path',P10_DYNAMIC_MEASUREMENT_READ],
 ['P11 unrelated audit call naming the table and a method object',P11_UNRELATED_AUDIT_CALL],
 ['a multiline raw GET audit read',MULTILINE_GET_READ],
];

// The four Codex Round 2 bypasses this task exists to close, verbatim in shape.
const QHIM014_A_ALIASED_TABLE_WRITE=`export class AliasedTableWriter {
  ${API}
  writeSnapshotRow(token:string,row:object){
    const target = 'him_metric_snapshots';
    return this.dataApi.request(
      token,
      target,
      {
        method: 'POST',
        body: JSON.stringify(row),
      },
    );
  }
}
`;
const QHIM014_B_INLINE_OBJECT_ROUTER=`export class InlineObjectRouter {
  ${API}
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(
      token,
      ({
        'hse.energy': 'rpc/create_hse_energy_measurement',
        'hse.stress': 'rpc/create_hse_stress_measurement',
      })[metricKey],
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }
}
`;
const QHIM014_C_ALIASED_IDENTITY_ROUTER=`export class AliasedIdentityRouter {
  private readonly writers:Record<string,string>={
    'hse.energy': 'rpc/create_hse_energy_measurement',
    'hse.stress': 'rpc/create_hse_stress_measurement',
  };
  ${API}
  submit(token:string,input:{metricKey:string},body:object){
    const key = input.metricKey;
    const writers = this.writers;
    return this.dataApi.request(
      token,
      writers[key],
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }
}
`;
const QHIM014_D_COMPUTED_RETIRED_RPC=`export class ComputedRetiredWriter {
  ${API}
  submit(token:string,body:object){
    const path = ['rpc', 'create_him_metric_snapshot'].join('/');
    return this.dataApi.request(
      token,
      path,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }
}
`;
// Previously proven prohibited forms, preserved.
const N5_LITERAL_RETIRED_RPC=`export class LegacyWriter { ${API}
  submit(token:string,body:object){return this.dataApi.request(token,'${LEGACY_RPC_PATH}',{method:'POST',body:JSON.stringify(body)});} }
`;
const N6_DYNAMIC_WRITE_INTERPOLATION="export class D{ submit(token:string,metricKey:string,body:object){return this.dataApi.request(token,`rpc/create_${metricKey.split('.')[1]}_measurement`,{method:'POST',body:JSON.stringify(body)});} }\n";
const N7_IDENTITY_SWITCH=`export class RoutedHimSubmissionService { ${API}
  submit(token:string,metricKey:string,body:object){
    switch(metricKey){
      case 'hse.energy': return this.dataApi.request(token,'rpc/create_hse_energy_measurement',{method:'POST',body:JSON.stringify(body)});
      default: return this.dataApi.request(token,'rpc/create_hse_stress_measurement',{method:'POST',body:JSON.stringify(body)});
    }
  }
}
`;
const N8_WRITER_TABLE_INDEX=`export class GenericHimSubmissionService {
  private static readonly WRITERS:Record<string,string>={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,GenericHimSubmissionService.WRITERS[metricKey],{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const N9_WRITER_MAP_GET=`export class MappedHimSubmissionService {
  private static readonly WRITERS=new Map([['hse.energy','rpc/create_hse_energy_measurement'],['hse.stress','rpc/create_hse_stress_measurement']]);
  ${API}
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,MappedHimSubmissionService.WRITERS.get(metricKey),{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const N10_IDENTITY_TERNARY=`export class TernaryHimSubmissionService { ${API}
  submit(token:string,metricKey:string,body:object){
    return this.dataApi.request(token,metricKey==='hse.energy'?'rpc/create_hse_energy_measurement':'rpc/create_hse_stress_measurement',{method:'POST',body:JSON.stringify(body)});
  }
}
`;
const directWrite=verb=>`export class DirectWriter { ${API}
  writeSnapshotRow(token:string,row:object){
    return this.dataApi.request(
      token,
      'him_metric_snapshots',
      {
        /* explanation; a semicolon in here is not a statement terminator */
        headers: { Prefer: 'return=representation;resolution=merge-duplicates' },
        method: '${verb}',
        body: JSON.stringify(row),
      },
    );
  }
}
`;
const N16_ALIASED_ROUTING_RESULT=`export class AliasedRoutingResult {
  private readonly writers:Record<string,string>={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  submit(token:string,input:{metricKey:string},body:object){
    const key = input.metricKey;
    const writer = this.writers[key];
    return this.dataApi.request(token,writer,{method:'POST',body:JSON.stringify(body)});
  }
}
`;
// Amendment 1 negative controls.
// N17: the exact lexical-shadowing bypass from the independent final review -
// a safe method resolves its own local \`target\` to a read RPC while an
// unrelated method reuses the same local name for the snapshot table. Under
// file-global name lookup the bad request could resolve to the earlier safe
// initializer; under lexical resolution it must reject.
const N17_LEXICAL_SHADOWED_TABLE_WRITE=`export class ScopeSplitWriter {
  ${API}
  safe(token:string) {
    const target = 'rpc/read_him_x';
    return this.dataApi.request(
      token,
      target,
      { method: 'POST', body: '{}' },
    );
  }
  bad(token:string,row:object) {
    const target = 'him_metric_snapshots';
    return this.dataApi.request(
      token,
      target,
      { method: 'POST', body: JSON.stringify(row) },
    );
  }
}
`;
// N18: a class property aliasing a metric identity, then used to index a
// multi-metric writer container. The metric identity still chooses the
// writer, so this is prohibited generic write authority.
const N18_CLASS_PROPERTY_IDENTITY_ROUTER=`export class GenericWriter {
  private readonly input:{metricKey:string};
  private readonly key = this.input.metricKey;
  private readonly writers = {
    'hse.energy': 'rpc/create_hse_energy_measurement',
    'hse.stress': 'rpc/create_hse_stress_measurement',
  };
  ${API}
  submit(token:string,body:object) {
    return this.dataApi.request(
      token,
      this.writers[this.key],
      { method:'POST', body:JSON.stringify(body) },
    );
  }
}
`;
// N19: the real application request-call shape - callee member \`request\`,
// snapshot-table target at argument 1, mutating options at argument 2 - the
// exact construct P11's unrelated call must be distinguished from.
const N19_REQUEST_SHAPED_SNAPSHOT_POST=`export class DirectRequestWriter {
  ${API}
  write(token:string,row:object) {
    return this.dataApi.request(
      token,
      'him_metric_snapshots',
      { method:'POST', body:JSON.stringify(row) },
    );
  }
}
`;

// Control tables are exported alongside the checker so every P/N verdict in the
// review report can be reproduced against the exact shipped implementation.
export{POSITIVE_CONTROLS,NEGATIVE_CONTROLS};

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
 assert.ok(readdirSync(new URL('database/',root)).includes('verify-migration-0051.mjs'),'the 0051 real-PostgreSQL verifier is preserved');
 assert.ok(readdirSync(new URL('database/tests/',root)).includes('him-legacy-snapshot-authority-energy-context-reconciliation-v1.test.mjs'),'the 0051 static contract is preserved');
});

test('S3 - the analysed production set is the complete application source set',()=>{
 // Coverage completeness, not a language ceiling: every non-spec source file
 // under apps/api/src must be one the analyser actually parses. If a
 // production file of another kind is introduced, this reports it so the guard
 // can be extended - it does not silently ignore it, and it freezes no count.
 const onDisk=listSourceFiles(APP_SRC);
 const uncovered=onDisk.filter(path=>!path.endsWith('.spec.ts')&&!PRODUCTION.has(path));
 assert.deepEqual(uncovered,[],`every non-spec application source file must be analysed; uncovered: ${JSON.stringify(uncovered)}`);
 assert.ok(PRODUCTION.size>50,`expected a real production source set, collected ${PRODUCTION.size}`);
 for(const path of [SERVICE,REPOSITORY,TYPES])assert.ok(PRODUCTION.has(path),`the production set includes ${path}`);
 assert.equal([...PRODUCTION.keys()].filter(path=>path.endsWith('.spec.ts')).length,0,'test source is excluded from the production set');
 // And the closure fact itself: the retired RPC appears nowhere in production.
 const occurrences=[...PRODUCTION].reduce((total,[,code])=>total+(code.split(LEGACY_RPC_PATH).length-1),0);
 assert.equal(occurrences,0,`expected zero ${LEGACY_RPC_PATH} references in ${APP_SRC}`);
 assert.deepEqual(qhim013Violations(PRODUCTION),[],'the whole shipped application source set is accepted');
});

test('S4 - the generic application write methods are gone',()=>{
 const service=read(SERVICE),repository=read(REPOSITORY);
 assert.doesNotMatch(service,/(^|[;{}])\s*(?:async\s+)?observe\s*\(/m,'HimService defines no observe(...)');
 assert.doesNotMatch(service,/validateObservation/,'the write-only observation validator is gone');
 assert.doesNotMatch(service,/randomUUID|node:crypto/,'the write-only client-side identifier generation is gone');
 assert.doesNotMatch(repository,/(^|[;{}])\s*(?:async\s+)?createObservation\s*\(/m,'HimRepository defines no createObservation(...)');
 assert.doesNotMatch(repository,/p_observation/,'no generic observation payload is posted anywhere');
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
 for(const kept of ['HimMetricDefinition','HimMetricSnapshot','HimContextKind','HIM_CONTEXT_KINDS','MAX_HIM_CONTEXT_ID_LENGTH'])assert.ok(types.includes(kept),`the read/domain type ${kept} is preserved`);
});

test('S6 - the checker is syntax-aware: it parses TypeScript rather than matching source text',()=>{
 // Proof the AST layer is real and load-bearing, not decoration. Formatting
 // that a text-proximity guard depends on is irrelevant here: the same
 // construct is rejected however it is laid out, and a resolvable constant is
 // understood as a value rather than as a substring.
 assert.equal(typeof ts.createSourceFile,'function','the TypeScript parser is available');
 const oneLine="export class W{ w(t:string,r:object){const target='him_metric_snapshots';return this.dataApi.request(t,target,{method:'POST',body:JSON.stringify(r)});} }\n";
 rejects('an aliased table write written on one line',oneLine,'issues a non-GET request against him_metric_snapshots');
 rejects('the same construct spread over many lines',QHIM014_A_ALIASED_TABLE_WRITE,'issues a non-GET request against him_metric_snapshots');
 // The literal string never appears contiguously in this source, so only value
 // resolution over the AST can find it.
 assert.ok(!QHIM014_D_COMPUTED_RETIRED_RPC.includes(LEGACY_RPC_PATH),'the computed fixture never spells the retired path contiguously');
 rejects('a retired RPC computed by Array#join',QHIM014_D_COMPUTED_RETIRED_RPC,'resolves a target to the retired legacy generic snapshot RPC');
});

test('S7 - the four QHIM-014 audit reproductions now reject',()=>{
 // Each first proves it really carries the audited construct, then is put
 // through the same exported checker CI runs.
 assert.match(QHIM014_A_ALIASED_TABLE_WRITE,/const target = 'him_metric_snapshots';/,'A really aliases the table target');
 rejects('QHIM-014 A aliased direct snapshot-table write',QHIM014_A_ALIASED_TABLE_WRITE,'issues a non-GET request against him_metric_snapshots');
 assert.match(QHIM014_B_INLINE_OBJECT_ROUTER,/\}\)\[metricKey\]/,'B really indexes an inline object by the metric identity');
 rejects('QHIM-014 B inline object generic writer router',QHIM014_B_INLINE_OBJECT_ROUTER,'indexes a writer lookup by a metric identity');
 assert.match(QHIM014_C_ALIASED_IDENTITY_ROUTER,/const key = input\.metricKey;/,'C really aliases the metric identity');
 rejects('QHIM-014 C aliased metric-identity router',QHIM014_C_ALIASED_IDENTITY_ROUTER,'indexes a writer lookup by a metric identity');
 assert.match(QHIM014_D_COMPUTED_RETIRED_RPC,/\['rpc', 'create_him_metric_snapshot'\]\.join\('\/'\)/,'D really computes the retired path');
 rejects('QHIM-014 D computed retired generic RPC',QHIM014_D_COMPUTED_RETIRED_RPC,'resolves a target to the retired legacy generic snapshot RPC');
});

test('S8 - the legitimate read authority is intact',()=>{
 const repository=read(REPOSITORY),service=read(SERVICE);
 assert.match(repository,/rpc\/read_him_latest_measurement_v1/,'canonical latest still routes through the one canonical read RPC');
 assert.match(repository,/p_definition_version:definitionVersion/,'canonical latest still forwards the exact definition version');
 for(const readPath of ['rpc/get_him_metric_definition','rpc/list_him_metric_definitions','rpc/read_him_trend_source_v1','rpc/read_him_intelligence_snapshot_v1'])assert.ok(repository.includes(readPath),`${readPath} is preserved`);
 assert.match(repository,/history\(token:string[\s\S]*?him_metric_snapshots/,'history remains an explicit raw audit read');
 assert.match(repository,/snapshot_version\.asc/,'history keeps its ascending audit ordering');
 assert.match(repository,/listForContext\(token:string[\s\S]*?him_metric_snapshots/,'context listing remains an explicit raw audit read');
 assert.match(service,/this\.repository\.getDefinition\(token,key,definitionVersion\)/,'the exact definition is still resolved before the read');
 assert.match(service,/validContextKinds\.includes\(kind\)/,'context eligibility is still validated');
 assert.match(service,/this\.repository\.getLatest\(token,userId,key,definitionVersion,kind,id\)/,'the exact definition version still reaches the repository');
 assert.doesNotMatch(service,/definitionVersion\s*\?\?|definitionVersion\s*\|\||definitionVersion\s*=\s*1/,'no implicit v1 default was introduced');
 assert.match(service,/validateContext/,'exact context validation needed by the read paths is preserved');
});

test('P1-P11 - every separately reviewed exact-ownership shape stays accepted',()=>{
 for(const[label,fixture]of POSITIVE_CONTROLS)accepts(label,fixture);
 // The acceptances are non-vacuous: each control really carries the property a
 // broader guard would have wrongly rejected it for.
 assert.equal([...P2_EXACT_ENERGY_CREATE_AND_CORRECT.matchAll(/rpc\/(?:create|correct)_hse_energy_measurement/g)].length,2,'P2 names two exact Energy RPCs');
 assert.match(P3_EXACT_WRITER_WITH_IDENTITY_CONSTANT,/private readonly metricKey = 'hse\.energy'/,'P3 carries a metric identity');
 assert.match(P4_DYNAMIC_FUTURE_READ,/rpc\/read_him_\$\{/,'P4 really assembles its read path at runtime');
 assert.match(P5_EXACT_WRITER_WITH_READ_LOOKUP,/readRegistry\.get\(metricKey\)/,'P5 really looks a read path up by metric identity');
 assert.match(P5_EXACT_WRITER_WITH_READ_LOOKUP,/rpc\/create_hse_energy_measurement/,'P5 really contains an exact write RPC too');
 assert.match(P6_ALIASED_EXACT_WRITER,/const path = 'rpc\/create_hse_energy_measurement'/,'P6 really aliases its exact write path');
 assert.match(P7_EXACT_CONTAINER_WITHOUT_METRIC_SELECTION,/this\.energyPaths\[mode\]/,'P7 really selects from a write-path container by a non-metric key');
 assert.equal([...P8_HARMLESS_LOCAL_SHADOWING.matchAll(/const target = /g)].length,2,'P8 really declares the same local name in two methods');
 assert.match(P9_CLASS_PROPERTY_IDENTITY_CONSTANT,/private readonly key = 'hse\.energy'/,'P9 really carries an exact identity constant on a class property');
 assert.match(P10_DYNAMIC_MEASUREMENT_READ,/rpc\/read_him_\$\{projection\}_measurement/,'P10 really assembles a dynamic path ending in the measurement noun');
 assert.ok(!P11_UNRELATED_AUDIT_CALL.includes('.request('),'P11 really makes no application request call');
 // Also accepted: the shipped production source, including the legitimate
 // metric-keyed READ lookups in the definition registry, the Snapshot
 // projector, and the Trend slot table.
 assert.deepEqual(qhim013Violations(himProduction(PRODUCTION)),[],'every shipped HIM production file is accepted');
});

// The mandatory negative controls, at module scope so a reviewer can drive any
// single verdict through the exported checker without re-typing a fixture.
const NEGATIVE_CONTROLS=[
  ['N1 QHIM-014 A aliased direct snapshot-table write',QHIM014_A_ALIASED_TABLE_WRITE,'issues a non-GET request against him_metric_snapshots',FIXTURE],
  ['N2 QHIM-014 B inline object writer lookup',QHIM014_B_INLINE_OBJECT_ROUTER,'indexes a writer lookup by a metric identity',FIXTURE],
  ['N3 QHIM-014 C aliased metric identity indexing a writer container',QHIM014_C_ALIASED_IDENTITY_ROUTER,'indexes a writer lookup by a metric identity',FIXTURE],
  ['N4 QHIM-014 D computed retired RPC via Array#join',QHIM014_D_COMPUTED_RETIRED_RPC,'resolves a target to the retired legacy generic snapshot RPC',FIXTURE],
  ['N5 literal retired generic RPC',N5_LITERAL_RETIRED_RPC,'resolves a target to the retired legacy generic snapshot RPC',FIXTURE],
  ['N6 dynamic metric-owned measurement-write interpolation',N6_DYNAMIC_WRITE_INTERPOLATION,'constructs a measurement-write RPC path dynamically',FIXTURE],
  ['N7 metric-identity switch selecting write RPCs',N7_IDENTITY_SWITCH,'switches write authority on a metric identity',FIXTURE],
  ['N8 writer object indexed by metric identity',N8_WRITER_TABLE_INDEX,'indexes a writer lookup by a metric identity',FIXTURE],
  ['N9 writer map looked up by metric identity',N9_WRITER_MAP_GET,'looks a writer up from a map keyed by a metric identity',FIXTURE],
  ['N10 metric-identity comparison choosing a write RPC',N10_IDENTITY_TERNARY,'chooses a metric-owned write RPC by comparing a metric identity',FIXTURE],
  ['N11 direct snapshot POST',directWrite('POST'),'issues a non-GET request against him_metric_snapshots',FIXTURE],
  ['N12 direct snapshot PUT',directWrite('PUT'),'issues a non-GET request against him_metric_snapshots',FIXTURE],
  ['N13 direct snapshot PATCH',directWrite('PATCH'),'issues a non-GET request against him_metric_snapshots',FIXTURE],
  ['N14 direct snapshot DELETE',directWrite('DELETE'),'issues a non-GET request against him_metric_snapshots',FIXTURE],
  ['N15 retired legacy surface regaining a generic write method',`${read(REPOSITORY)}\n${P1_EXACT_ENERGY_WRITER.replace('submitEnergyMeasurement','submitMeasurement')}`,'redefines the retired generic measurement-write method submitMeasurement(...)',REPOSITORY],
  ['N16 routing result aliased before the request target',N16_ALIASED_ROUTING_RESULT,'indexes a writer lookup by a metric identity',FIXTURE],
  ['N17 lexically shadowed direct snapshot-table write',N17_LEXICAL_SHADOWED_TABLE_WRITE,'issues a non-GET request against him_metric_snapshots',FIXTURE],
  ['N18 class-property metric-identity alias indexing a writer container',N18_CLASS_PROPERTY_IDENTITY_ROUTER,'indexes a writer lookup by a metric identity',FIXTURE],
  ['N19 request-shaped direct snapshot POST',N19_REQUEST_SHAPED_SNAPSHOT_POST,'issues a non-GET request against him_metric_snapshots',FIXTURE],
];

test('N1-N19 - every prohibited generic write authority is rejected by its own named rule',()=>{
 for(const[label,fixture,mechanism,path]of NEGATIVE_CONTROLS){
  for(const[,control]of POSITIVE_CONTROLS)assert.notEqual(fixture,control,`${label} really differs from every accepted control`);
  rejects(label,fixture,mechanism,path);
 }
 // Formatting alone never decides a verdict.
 const repository=read(REPOSITORY);
 const reformatted=repository.replace('  async getLatest(','\n  async getLatest(');
 assert.notEqual(reformatted,repository,'the cosmetic rewrite actually changed the source');
 assert.deepEqual(qhim013Violations(mutate(PRODUCTION,REPOSITORY,reformatted)),[],'formatting alone never fails the guard');
});

test('same-class adversarial expansion - ordinary local equivalences of the same authority',()=>{
 // Written adversarially against this guard's own resolution model, then
 // proven. Each rejection names the mechanism; each acceptance proves the
 // read-side equivalent stays legal.
 rejects('a constant target chain (a -> b -> table)',`export class C { ${API}
  w(token:string,row:object){const a='him_metric_snapshots';const b=a;return this.dataApi.request(token,b,{method:'POST',body:JSON.stringify(row)});} }
`,'issues a non-GET request against him_metric_snapshots');
 rejects('the retired RPC built by concatenation',`export class C { ${API}
  w(token:string,body:object){const name='create_him_metric_snapshot';const path='rpc/'+name;return this.dataApi.request(token,path,{method:'POST',body:JSON.stringify(body)});} }
`,'resolves a target to the retired legacy generic snapshot RPC');
 rejects('a metric-identity alias chain (a -> b) indexing a writer container',`export class C {
  private readonly writers:Record<string,string>={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  w(token:string,input:{metricKey:string},body:object){const a=input.metricKey;const b=a;return this.dataApi.request(token,this.writers[b],{method:'POST',body:JSON.stringify(body)});} }
`,'indexes a writer lookup by a metric identity');
 rejects('an inline Map writer router used as the request target',`export class C { ${API}
  w(token:string,metricKey:string,body:object){return this.dataApi.request(token,new Map([['hse.energy','rpc/create_hse_energy_measurement'],['hse.stress','rpc/create_hse_stress_measurement']]).get(metricKey),{method:'POST',body:JSON.stringify(body)});} }
`,'looks a writer up from a map keyed by a metric identity');
 rejects('a nested parenthesized retired target',`export class C { ${API}
  w(token:string,body:object){return this.dataApi.request(token,((('${LEGACY_RPC_PATH}'))),{method:'POST',body:JSON.stringify(body)});} }
`,'resolves a target to the retired legacy generic snapshot RPC');
 rejects('a retired target reached through a template constant',`export class C { ${API}
  w(token:string,body:object){const verb='create_him_metric_snapshot';const path=\`rpc/\${verb}\`;return this.dataApi.request(token,path,{method:'POST',body:JSON.stringify(body)});} }
`,'resolves a target to the retired legacy generic snapshot RPC');
 rejects('a mutating verb reached through a constant alias',`export class C { ${API}
  w(token:string,row:object){const verb='PATCH';return this.dataApi.request(token,'him_metric_snapshots',{method:verb,body:JSON.stringify(row)});} }
`,'issues a non-GET request against him_metric_snapshots');
 rejects('a snake_case metric identity aliased into a writer index',`export class C {
  private readonly writers={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  w(token:string,input:{metric_key:string},body:object){const chosen=input.metric_key;return this.dataApi.request(token,this.writers[chosen],{method:'POST',body:JSON.stringify(body)});} }
`,'indexes a writer lookup by a metric identity');
 // The three forms the post-implementation hostile self-audit found open
 // against the first AST revision, kept here permanently so the repair is
 // proven by CI rather than by a one-off probe.
 rejects('a metric identity destructured under a renamed local binding',`export class C {
  private readonly writers={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  w(token:string,input:{metricKey:string},body:object){const{metricKey:k}=input;return this.dataApi.request(token,this.writers[k],{method:'POST',body:JSON.stringify(body)});} }
`,'indexes a writer lookup by a metric identity');
 rejects('a writer Map constructed from a separately declared entry array',`export class C {
  private readonly entries:[string,string][]=[['hse.energy','rpc/create_hse_energy_measurement'],['hse.stress','rpc/create_hse_stress_measurement']];
  private readonly writers=new Map(this.entries);
  ${API}
  w(token:string,metricKey:string,body:object){return this.dataApi.request(token,this.writers.get(metricKey),{method:'POST',body:JSON.stringify(body)});} }
`,'looks a writer up from a map keyed by a metric identity');
 rejects('a direct table write whose request options object is aliased',`export class C { ${API}
  w(token:string,row:object){const opts={method:'POST',body:JSON.stringify(row)};return this.dataApi.request(token,'him_metric_snapshots',opts);} }
`,'issues a non-GET request against him_metric_snapshots');
 rejects('an optional-chained writer index by a metric identity',`export class C {
  private readonly writers={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  w(token:string,metricKey:string,body:object){return this.dataApi.request(token,this.writers?.[metricKey],{method:'POST',body:JSON.stringify(body)});} }
`,'indexes a writer lookup by a metric identity');
 rejects('a writer container with computed keys and aliased values',`export class C {
  private readonly energy='rpc/create_hse_energy_measurement';
  private readonly stress='rpc/create_hse_stress_measurement';
  private readonly writers={['hse.energy']:this.energy,['hse.stress']:this.stress};
  ${API}
  w(token:string,metricKey:string,body:object){return this.dataApi.request(token,this.writers[metricKey],{method:'POST',body:JSON.stringify(body)});} }
`,'indexes a writer lookup by a metric identity');
 rejects('a lowercase mutating verb against an aliased table target',`export class C { ${API}
  w(token:string,row:object){const target='him_metric_snapshots?select=*';return this.dataApi.request(token,target,{method:'post',body:JSON.stringify(row)});} }
`,'issues a non-GET request against him_metric_snapshots');
 // The same closure fact holds outside the HIM folder: a generic writer cannot
 // escape by moving to another application directory.
 rejects('a generic writer relocated outside the HIM folder',`export class C {
  private readonly writers={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  w(token:string,metricKey:string,body:object){return this.dataApi.request(token,this.writers[metricKey],{method:'POST',body:JSON.stringify(body)});} }
`,'indexes a writer lookup by a metric identity',`${APP_SRC}/conversation/relocated-writer.service.ts`);
 // READ equivalents of every shape above must remain accepted.
 accepts('a constant target chain resolving to a GET audit read',`export class C { ${API}
  r(token:string){const a='him_metric_snapshots?select=*';const b=a;return this.dataApi.request(token,b);} }
`);
 accepts('a read RPC built by concatenation',`export class C { ${API}
  r(token:string){const name='read_him_latest_measurement_v1';const path='rpc/'+name;return this.dataApi.request(token,path,{method:'POST',body:'{}'});} }
`);
 accepts('a read registry indexed by an aliased metric identity',`export class C {
  private readonly readers:Record<string,string>={'hse.energy':'rpc/read_him_energy_projection_v2','hse.stress':'rpc/read_him_stress_projection_v2'};
  ${API}
  r(token:string,input:{metricKey:string}){const key=input.metricKey;return this.dataApi.request(token,this.readers[key],{method:'POST',body:'{}'});} }
`);
 accepts('an inline Map READ router used as the request target',`export class C { ${API}
  r(token:string,metricKey:string){return this.dataApi.request(token,new Map([['hse.energy','rpc/read_him_energy_projection_v2'],['hse.stress','rpc/read_him_stress_projection_v2']]).get(metricKey),{method:'POST',body:'{}'});} }
`);
 accepts('an exact write path aliased through a chain with no metric selection',`export class C { ${API}
  w(token:string,body:object){const a='rpc/create_hse_energy_measurement';const b=a;return this.dataApi.request(token,b,{method:'POST',body:JSON.stringify(body)});} }
`);
 accepts('a GET request whose table target is aliased',`export class C { ${API}
  r(token:string){const target='him_metric_snapshots';return this.dataApi.request(token,target,{method:'GET'});} }
`);
 accepts('a GET audit read whose request options object is aliased',`export class C { ${API}
  r(token:string){const opts={method:'GET'};return this.dataApi.request(token,'him_metric_snapshots?select=*',opts);} }
`);
 accepts('a read registry destructure-aliased by a metric identity',`export class C {
  private readonly readers={'hse.energy':'rpc/read_him_energy_projection_v2','hse.stress':'rpc/read_him_stress_projection_v2'};
  ${API}
  r(token:string,input:{metricKey:string}){const{metricKey:k}=input;return this.dataApi.request(token,this.readers[k],{method:'POST',body:'{}'});} }
`);
 accepts('a read Map constructed from a separately declared entry array',`export class C {
  private readonly entries:[string,string][]=[['hse.energy','rpc/read_him_energy_projection_v2']];
  private readonly readers=new Map(this.entries);
  ${API}
  r(token:string,metricKey:string){return this.dataApi.request(token,this.readers.get(metricKey),{method:'POST',body:'{}'});} }
`);
 accepts('indexing a writer container by a literal exact key, with no identity involved',`export class C {
  private readonly writers={'hse.energy':'rpc/create_hse_energy_measurement','hse.stress':'rpc/create_hse_stress_measurement'};
  ${API}
  w(token:string,body:object){return this.dataApi.request(token,this.writers['hse.energy'],{method:'POST',body:JSON.stringify(body)});} }
`);
});

test('Amendment 1 - lexical scoping, class-property identity, write-verb evidence, and the request-call shape',()=>{
 // Defect 1: binding resolution is lexical. The exact two-method shadowing
 // bypass from the independent final review must reject, and harmless
 // same-name locals must stay accepted. Each fixture first proves the
 // construct is really present.
 assert.equal([...N17_LEXICAL_SHADOWED_TABLE_WRITE.matchAll(/const target = /g)].length,2,'N17 really reuses one local name across two methods');
 assert.match(N17_LEXICAL_SHADOWED_TABLE_WRITE,/const target = 'rpc\/read_him_x';/,'N17 really binds the safe read path first');
 assert.match(N17_LEXICAL_SHADOWED_TABLE_WRITE,/const target = 'him_metric_snapshots';/,'N17 really aliases the table in the writing method');
 rejects('N17 lexically shadowed direct table write',N17_LEXICAL_SHADOWED_TABLE_WRITE,'issues a non-GET request against him_metric_snapshots');
 accepts('P8 harmless same-name locals in different methods',P8_HARMLESS_LOCAL_SHADOWING);
 // Inner block shadowing resolves to the inner declaration, and a parameter
 // shadows an outer constant rather than leaking its value inward.
 rejects('an inner block shadowing an outer safe constant',`export class C { ${API}
  w(token:string,row:object){const target='rpc/read_him_x';{const target='him_metric_snapshots';return this.dataApi.request(token,target,{method:'POST',body:JSON.stringify(row)});}} }
`,'issues a non-GET request against him_metric_snapshots');
 accepts('a parameter shadowing an outer table constant',`const target='him_metric_snapshots';
export class C { ${API}
  w(token:string,target:string,row:object){return this.dataApi.request(token,target,{method:'POST',body:JSON.stringify(row)});} }
`);
 // Defect 2: a class property aliasing a metric identity is followed through
 // the nearest containing class, while an exact identity CONSTANT on a class
 // property stays legal because it selects nothing.
 assert.match(N18_CLASS_PROPERTY_IDENTITY_ROUTER,/private readonly key = this\.input\.metricKey;/,'N18 really aliases the identity through a class property');
 assert.match(N18_CLASS_PROPERTY_IDENTITY_ROUTER,/this\.writers\[this\.key\]/,'N18 really indexes the writer container by the aliased identity');
 rejects('N18 class-property metric-identity alias router',N18_CLASS_PROPERTY_IDENTITY_ROUTER,'indexes a writer lookup by a metric identity');
 accepts('P9 class-property identity constant without routing',P9_CLASS_PROPERTY_IDENTITY_CONSTANT);
 // Defect 3: the paired proof that the WRITE VERB - not formatting and not
 // the measurement noun - decides the dynamic-path verdict. The two fixtures
 // differ only in the verb.
 const dynamicPath=verb=>`export class D { ${API}
  go(token:string,projection:string){return this.dataApi.request(token,\`rpc/${verb}_him_\${projection}_measurement\`,{method:'POST',body:'{}'});} }
`;
 assert.equal(dynamicPath('create').replace('create','read'),dynamicPath('read'),'the paired dynamic fixtures differ only in the verb');
 accepts('P10 dynamic measurement READ path',P10_DYNAMIC_MEASUREMENT_READ);
 accepts('the read-verb side of the pair',dynamicPath('read'));
 rejects('the create-verb side of the pair',dynamicPath('create'),'constructs a measurement-write RPC path dynamically');
 rejects('N6 still rejects on its write verb',N6_DYNAMIC_WRITE_INTERPOLATION,'constructs a measurement-write RPC path dynamically');
 // Defect 4: only the application request-call shape carries data-request
 // semantics - target at argument 1, options at argument 2.
 assert.match(P11_UNRELATED_AUDIT_CALL,/audit\(\s*'him_metric_snapshots',\s*\{ method: 'POST' \},?\s*\)/,'P11 really passes the table name and a method object to an unrelated call');
 accepts('P11 unrelated audit call',P11_UNRELATED_AUDIT_CALL);
 assert.match(N19_REQUEST_SHAPED_SNAPSHOT_POST,/\.request\(\s*token,\s*'him_metric_snapshots',/,'N19 really targets the table through the request-call shape');
 rejects('N19 request-shaped direct snapshot POST',N19_REQUEST_SHAPED_SNAPSHOT_POST,'issues a non-GET request against him_metric_snapshots');
});

test('the guard states no future ceiling and is independent of migration numbering',()=>{
 // The guard is a pure function of an application-source map: driven entirely
 // by synthetic, non-filesystem sources it still reaches the correct verdicts,
 // so no migration inventory, migration number, or future migration can
 // influence it. That QHIM-014 changes zero migration files is a PR-diff fact,
 // verified independently of this runtime guard.
 accepts('a purely synthetic legitimate source set',MULTILINE_GET_READ);
 assert.ok(verdict(N5_LITERAL_RETIRED_RPC).length>0,'a purely synthetic defective source set is rejected');
 // No metric-inventory or metric-version ceiling, and no per-file write-RPC
 // count ceiling.
 accepts('a later metric version and an eighteenth metric',`export const FUTURE={metricKey:'hse.energy',definitionVersion:2,validContextKinds:['CONVERSATION_SESSION']};
export const EIGHTEENTH={metricKey:'hse.future-construct',definitionVersion:1,validContextKinds:['SITUATION']};
`);
 accepts('a future separately reviewed read authority',`export class FutureHimReader{ ${API}
 read(token:string){return this.dataApi.request(token,'rpc/read_him_future_projection_v2',{method:'POST',body:'{}'});} }
`);
 // The proof boundary and the future-API path are stated in this guard's own
 // header rather than implied.
 const self=read('tests/him-generic-application-write-authority-retirement.test.mjs');
 assert.ok(self.includes('would intentionally update this guard'),'the guard names the separately reviewed future-API path');
 assert.ok(self.includes('at this Measurement Foundation closure state'),'the guard scopes its claim to this closure state');
 assert.ok(self.includes('PROOF BOUNDARY'),'the guard states its analysis limits honestly');
});

test('the contract is wired into CI before the expensive database gates',()=>{
 const packageJson=JSON.parse(read('package.json'));
 assert.equal(packageJson.scripts['test:him-generic-write-authority-retirement-contract'],'node --test tests/him-generic-application-write-authority-retirement.test.mjs');
 const ci=read('.github/workflows/api-ci.yml');
 const step=ci.indexOf('test:him-generic-write-authority-retirement-contract');
 assert.ok(step>0,'CI runs the contract');
 assert.ok(step<ci.indexOf('Apply all migrations to fresh PostgreSQL'),'it runs before the database bootstrap');
 assert.ok(step<ci.indexOf('verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration'),'it runs before the 0051 verifier');
 assert.ok(step<ci.indexOf('verify:him-legacy-energy-current-authority-reconciliation:integration'),'it runs before the QHIM-012 verifier');
 for(const preserved of ['verify:him-measurement-preflight','verify:foundation-integration-gate','verify:him-legacy-snapshot-authority-energy-context-reconciliation:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-legacy-energy-current-authority-reconciliation:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration','verify:a2-e2e-runtime-smoke','verify:full-intelligence-e2e-runtime'])
  assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the existing gate ${preserved} is preserved`);
});
