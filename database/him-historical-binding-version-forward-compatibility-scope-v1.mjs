// QHIM-009 historical ownership scope - the single frozen source of truth for
// what the QHIM-009 ACTIVE-binding version forward-compatibility guard
// governs.
//
// The canonical uniqueness authority for ACTIVE bindings is versioned:
// (metric_key,definition_version,context_kind) WHERE status='ACTIVE'. A
// legitimate future state may therefore contain hse.energy@1 ACTIVE and
// hse.energy@2 ACTIVE simultaneously for the same context. QHIM-009 is the
// defect that historical verifiers read the ACTIVE-binding universe with
// metric_key + context_kind only, silently freezing "no later definition
// version may ever bind this metric/context" into history. The frozen rule
// after this remediation:
//
//   Every historical verifier assertion about a canonical HIM v1 ACTIVE
//   binding must select the exact v1 binding identity, including
//   definition_version=1. Historical proof means "v1 still has exactly the
//   binding(s) v1 owns" - never "no later version may exist".
//
// Like QHIM-002 after QHIM-006, ownership is explicit historical provenance -
// never a directory listing, never a migration-number cutoff, never a name
// prefix. The map below is an allowlist of the exact files and the exact
// ACTIVE-binding identity queries the QHIM-009 closure audit reviewed;
// additional verifier files are expected and legal, and no rule here can
// observe them. A future verifier that owns definition_version=2 is governed
// by no rule in this module merely because its file exists.
//
// PROVENANCE. Every entry derives from the QHIM-009 closure audit taken at
// the merged QHIM-006/QHIM-008 remediation, PR #154 "HIM Historical Guard
// Ownership Scoping & Trend Documentation Closure v1" (canonical main
// 129a43a7c6dac13c70b77ee183b7577c9a896616, tree
// b848ff2e8bdeedc41c742d5bc55533167a1b457b). The audit swept every
// him_canonical_model_bindings read in database/verify-*.mjs,
// database/tests/*.test.mjs, and tests/*.test.mjs and classified each read as
// exactly one of: (A) historical exact-v1 identity read - owned here and
// required to carry definition_version=1; (B) exact binding-ID read - selects
// by immutable binding UUID and cannot be confused with another definition
// version, unowned; (C) intentional cross-version / relative lifecycle read -
// unowned; (D) future-proof / synthetic fixture artifact - unowned. The
// eighteen files below are the complete class-A owner set; the nineteen
// queries below are the complete class-A query set.
import{readdirSync,readFileSync}from'node:fs';

export const QHIM009_PROVENANCE=Object.freeze({task:'QHIM-009',auditBaselinePullRequest:154,auditBaselineCommit:'129a43a7c6dac13c70b77ee183b7577c9a896616',auditBaselineTree:'b848ff2e8bdeedc41c742d5bc55533167a1b457b',ownerFiles:18,ownedBindingIdentityQueries:19,canonicalV1Metrics:17});

// The QHIM-009 proof harness. Never a historical subject: it is the one file
// that must create synthetic future definitions, calibrated models, approvals,
// and ACTIVE bindings to prove the historical queries are version-exact.
export const QHIM009_HARNESS='verify-him-historical-binding-version-forward-compatibility-v1.mjs';

// The complete class-A owner set: every current verifier whose ACTIVE-binding
// read asserts a historical canonical v1 metric/context/binding fact.
export const QHIM009_BINDING_V1_OWNER_FILES=Object.freeze(['verify-migration-0012.mjs','verify-migration-0013.mjs','verify-migration-0014.mjs','verify-migration-0015.mjs','verify-migration-0016.mjs','verify-migration-0037.mjs','verify-him-intelligence-snapshot-v1.mjs','verify-migration-0040.mjs','verify-migration-0041.mjs','verify-migration-0042.mjs','verify-migration-0043.mjs','verify-migration-0044.mjs','verify-migration-0045.mjs','verify-migration-0046.mjs','verify-migration-0047.mjs','verify-migration-0048.mjs','verify-migration-0049.mjs','verify-migration-0051.mjs']);

// The two owner files whose historical binding read feeds a `.rows[0]`
// selector. Each must be version-exact AND assert exactly one row before
// index 0 is used, so a future ACTIVE version can never be silently selected.
export const QHIM009_AMBIGUOUS_SELECTOR_OWNER_FILES=Object.freeze(['verify-migration-0037.mjs','verify-him-intelligence-snapshot-v1.mjs']);

// Named negative controls that exist today and are provably ungoverned.
// verify-migration-0050.mjs and verify-migration-0052.mjs were classified at
// the audit baseline as already version-exact (class B: every binding read is
// definition_version=1-scoped or selects by immutable binding UUID), so
// QHIM-009 owns no query in them and must never start governing them. The two
// proof harnesses create synthetic future state by design. They stand for
// every future verifier as well: anything outside the owner map is governed
// by no QHIM-009 rule by construction.
export const QHIM009_VERSION_EXACT_AT_AUDIT=Object.freeze(['verify-migration-0050.mjs','verify-migration-0052.mjs']);
export const QHIM009_EXCLUDED_FUTURE_CONTROLS=Object.freeze([QHIM009_HARNESS,'verify-him-historical-verifier-forward-compatibility-v1.mjs',...QHIM009_VERSION_EXACT_AT_AUDIT]);

export const QHIM009_CANONICAL_V1_METRICS=Object.freeze(['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength']);

// The complete owned historical query set, one entry per class-A read, in
// source order per file. `sql` is the exact corrected literal that must
// appear verbatim in the owner file. `metricKeys` names the canonical v1
// identities the query asserts; a parameterized query ($1) is executed once
// per key, exactly as the owner file historically does. `kind` records how
// the owner consumes the result: an exact count, an exact ordered context
// list, an exact single row fed to rows[0], or an exact-zero absence.
const q=(file,kind,sql,metricKeys)=>Object.freeze({file,kind,sql,metricKeys:Object.freeze(metricKeys),parameterized:sql.includes('$1')});
export const QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES=Object.freeze([
 q('verify-migration-0012.mjs','count',"SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE status='ACTIVE' AND metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION'",['hse.energy']),
 q('verify-migration-0013.mjs','context-list',"SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hse.motivation' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hse.motivation']),
 q('verify-migration-0014.mjs','context-list',"SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hse.attention' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hse.attention']),
 q('verify-migration-0015.mjs','context-list',"SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hse.self-confidence' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hse.self-confidence']),
 q('verify-migration-0016.mjs','context-list',"SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hse.stress']),
 q('verify-migration-0037.mjs','rows0',"SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND status='ACTIVE'",['hse.stress']),
 q('verify-him-intelligence-snapshot-v1.mjs','rows0',"SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND definition_version=1 AND context_kind='SITUATION' AND status='ACTIVE'",['hse.stress']),
 q('verify-migration-0040.mjs','context-list',"SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hbs.avoidance' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hbs.avoidance']),
 q('verify-migration-0041.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hbs.consistency','hbs.initiative']),
 q('verify-migration-0042.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key='hbs.reflection' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hbs.reflection']),
 q('verify-migration-0043.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key='hrs.relationship-trust' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hrs.relationship-trust']),
 q('verify-migration-0044.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hrs.communication','hrs.repair']),
 q('verify-migration-0045.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hrs.emotional-safety']),
 q('verify-migration-0046.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hgs.self-awareness']),
 q('verify-migration-0047.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hgs.resilience']),
 q('verify-migration-0048.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hgs.purpose-alignment']),
 q('verify-migration-0049.mjs','context-list',"SELECT context_kind,model_id,instrument_id,scale_contract_reference FROM public.him_canonical_model_bindings WHERE metric_key=$1 AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hgs.habit-strength']),
 q('verify-migration-0051.mjs','context-list',"SELECT context_kind FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND status='ACTIVE' ORDER BY context_kind",['hse.energy']),
 // 0051's "no SITUATION Energy binding" absence assertion is a historical v1
 // fact: Energy v1 never bound SITUATION. Without version scope it would
 // freeze every future Energy version out of SITUATION forever, which is not
 // a rule QHIM-003/004 ever made; the harness proves a future Energy
 // SITUATION binding leaves this exact query at zero.
 q('verify-migration-0051.mjs','absence',"SELECT count(*)::int n FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='SITUATION'",['hse.energy'])
]);
export const QHIM009_OWNED_QUERY_COUNT=QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES.length;

// ---------------------------------------------------------------------------
// Shared source helpers
// ---------------------------------------------------------------------------

// Rules against executable text only: prose comments legitimately describe
// version semantics without being queries.
export const executableSource=text=>text.split('\n').map(line=>{const at=line.indexOf('//');return at===-1?line:(/^\s*\/\//.test(line)?'':line.slice(0,at));}).join('\n');
export const sqlLiterals=text=>[...text.matchAll(/(['"`])((?:(?!\1)[\s\S])*?)\1/g)].map(match=>match[2]);
// A class-A candidate: a read (never INSERT/UPDATE/DELETE/ALTER) of the
// binding table that names a metric identity (metric_key= over a literal or
// parameter). A read by immutable binding UUID (class B: WHERE id=..., ON
// b.id=..., id=ANY(...)) carries no metric_key equality and is therefore
// never a candidate; a relative cross-version read (class C) that owns no
// metric identity is likewise invisible here.
export const bindingIdentityReads=code=>sqlLiterals(code).filter(sql=>sql.includes('him_canonical_model_bindings')&&!/^\s*(INSERT|UPDATE|DELETE|ALTER)\b/i.test(sql)&&/\bmetric_key\s*=/.test(sql));

// ---------------------------------------------------------------------------
// The rules, each bound to its own historical owner set
// ---------------------------------------------------------------------------
//
// classification, mirroring the QHIM-006 scheme:
//   A  PERMANENT HISTORICAL INVARIANT - kept, on its exact owner(s)
//   B  QHIM-009 ANTI-REGRESSION       - kept, on its exact remediated owner(s)
//
// Each `detect` returns violation messages for one owned file and is never
// consulted for a file outside `scope` - qhim009RulesGoverning returns [] for
// anything unowned, so a future verifier reading definition_version=2, or no
// version at all, in its own file can never be reported here.
export const QHIM009_RULES=Object.freeze([
 Object.freeze({id:'BINDING_IDENTITY_V1_SCOPE',classification:'B',title:'an owned historical ACTIVE-binding identity read stays scoped to definition_version=1',scope:QHIM009_BINDING_V1_OWNER_FILES,detect:(name,{code})=>bindingIdentityReads(code).filter(sql=>!/\bdefinition_version=1(?!\d)/.test(sql)).map(sql=>`${name} reads a him_canonical_model_bindings metric identity without definition_version=1 scoping: ${sql.slice(0,140)}`)}),
 Object.freeze({id:'BINDING_QUERY_VERBATIM',classification:'B',title:'an owned historical binding identity read is provable verbatim',scope:QHIM009_BINDING_V1_OWNER_FILES,detect:(name,{code})=>bindingIdentityReads(code).filter(sql=>sql.includes('${')).map(()=>`${name} builds an interpolated binding identity query that cannot be proven verbatim`)}),
 Object.freeze({id:'AMBIGUOUS_ROWS0_SELECTOR',classification:'B',title:'an owned binding rows[0] selector is version-exact and row-count guarded',scope:QHIM009_AMBIGUOUS_SELECTOR_OWNER_FILES,detect:(name,{code})=>[...(/him_canonical_model_bindings[^"'`]*["'`]\)\)\.rows\[0\]/.test(code)?[`${name} indexes rows[0] directly on a him_canonical_model_bindings query without asserting its cardinality first`]:[]),...(/\.rowCount!==1\)throw/.test(code)?[]:[`${name} lacks an exact row-count assertion on its owned binding read`])]})
]);

export const qhim009RulesGoverning=name=>QHIM009_RULES.filter(rule=>rule.scope.includes(name)).map(rule=>rule.id);
export const qhim009Violations=(name,source)=>{
 const context={source,code:executableSource(source)},found=[];
 for(const rule of QHIM009_RULES)if(rule.scope.includes(name))found.push(...rule.detect(name,context));
 return found;
};

// The harness's historical proof universe. `read` is asked only for the files
// the ownership map names, so the returned query set is fixed by historical
// provenance and is provably unaffected by anything else the repository
// contains now or later. Each owned file must contribute exactly the owned
// queries the map declares, verbatim and in source order - an exact identity,
// never a floor.
export const collectOwnedBindingQueries=read=>{
 const queries=[];
 for(const name of QHIM009_BINDING_V1_OWNER_FILES){
  const source=read(name),violations=qhim009Violations(name,source);
  if(violations.length)throw new Error(violations.join('; '));
  const found=bindingIdentityReads(executableSource(source)),expected=QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES.filter(entry=>entry.file===name);
  if(found.length!==expected.length)throw new Error(`${name} contributes ${found.length} QHIM-009-owned binding identity reads; the frozen historical ownership map declares exactly ${expected.length}`);
  for(let index=0;index<expected.length;index++)if(found[index]!==expected[index].sql)throw new Error(`${name} owned binding identity read ${index+1} drifted from the frozen historical ownership map: ${found[index].slice(0,140)}`);
  queries.push(...expected);
 }
 if(queries.length!==QHIM009_OWNED_QUERY_COUNT)throw new Error(`The QHIM-009 owned binding query set must contain exactly ${QHIM009_OWNED_QUERY_COUNT} historical reads`);
 return queries;
};

// Existence only. The scope module may require every artifact it owns to
// still be present; it may never compare the directory against the map, count
// it, or fail because an unrelated verifier was added.
export const assertOwnedHistoricalArtifactsExist=(present=readdirSync(new URL('./',import.meta.url)))=>{
 const missing=[...QHIM009_BINDING_V1_OWNER_FILES,QHIM009_HARNESS].filter(name=>!present.includes(name));
 if(missing.length)throw new Error(`QHIM-009 owned historical artifact(s) missing: ${missing.join(', ')}`);
 return true;
};
export const readVerifierSource=name=>readFileSync(new URL(name,new URL('./',import.meta.url)),'utf8');

// Load-time self-consistency: the map must match the audit facts it cites,
// must never claim a control file, and must never drift into a directory
// census.
if(QHIM009_BINDING_V1_OWNER_FILES.length!==QHIM009_PROVENANCE.ownerFiles)throw new Error('The QHIM-009 owner set no longer matches the closure audit');
if(QHIM009_OWNED_QUERY_COUNT!==QHIM009_PROVENANCE.ownedBindingIdentityQueries)throw new Error('The QHIM-009 owned query count no longer matches the closure audit');
if(QHIM009_CANONICAL_V1_METRICS.length!==QHIM009_PROVENANCE.canonicalV1Metrics)throw new Error('The QHIM-009 canonical v1 metric set no longer matches the closure audit');
if(new Set(QHIM009_BINDING_V1_OWNER_FILES).size!==QHIM009_BINDING_V1_OWNER_FILES.length)throw new Error('The QHIM-009 owner set contains a duplicate');
for(const entry of QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES){
 if(!QHIM009_BINDING_V1_OWNER_FILES.includes(entry.file))throw new Error(`QHIM-009 owned query names ${entry.file}, which is not an owner`);
 if(!/\bdefinition_version=1(?!\d)/.test(entry.sql))throw new Error(`QHIM-009 owned query for ${entry.file} is not version-exact`);
 if(!entry.metricKeys.length||entry.metricKeys.some(key=>!QHIM009_CANONICAL_V1_METRICS.includes(key)))throw new Error(`QHIM-009 owned query for ${entry.file} names a non-canonical metric`);
 if(entry.parameterized!==entry.sql.includes('$1'))throw new Error(`QHIM-009 owned query for ${entry.file} misdeclares its parameterization`);
}
for(const name of QHIM009_BINDING_V1_OWNER_FILES)if(!QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES.some(entry=>entry.file===name))throw new Error(`QHIM-009 owner ${name} declares no owned query`);
for(const rule of QHIM009_RULES){
 if(!rule.scope.length)throw new Error(`QHIM-009 rule ${rule.id} has an empty owner set`);
 for(const name of rule.scope)if(QHIM009_EXCLUDED_FUTURE_CONTROLS.includes(name))throw new Error(`QHIM-009 rule ${rule.id} claims ownership of ${name}, which is a named negative control`);
}
{
 const owned=new Set(QHIM009_EXPECTED_BINDING_IDENTITY_QUERIES.flatMap(entry=>entry.metricKeys)),missing=QHIM009_CANONICAL_V1_METRICS.filter(key=>!owned.has(key));
 if(missing.length)throw new Error(`QHIM-009 owned queries never assert canonical v1 metric(s): ${missing.join(', ')}`);
}
