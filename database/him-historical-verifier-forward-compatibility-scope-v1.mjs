// QHIM-002 historical ownership scope - the single frozen source of truth for
// what the QHIM-002 forward-compatibility guard governs.
//
// QHIM-002's policy is unchanged and remains fully enforced:
//
//   Historical verifier N may prove the durable artifacts and permanent
//   invariants introduced or owned by N, but must not prohibit later
//   legitimate extension.
//
// QHIM-006 was not a defect in those invariants; it was a defect in their
// SCOPE. Both the QHIM-002 static contract and its real-PostgreSQL harness
// discovered their subject universe with a live directory scan - effectively
// "every verify-*.mjs that happens to exist today" - and then applied
// historical-v1 semantics to all of it. A future verifier that legitimately
// owns hse.energy@2 would have been failed for querying definition_version=2,
// and a future separately reviewed background HIM reader would have been
// failed merely for naming itself. That turned a historical anti-regression
// guard into a permanent global policy over work QHIM-002 never reviewed.
//
// This module replaces that discovery with an explicit, frozen, reviewable
// ownership map. Ownership is historical provenance, never a directory
// listing, never a numeric migration cutoff, and never a name prefix. The map
// is an allowlist of what QHIM-002 owns, not a denylist of what the repository
// may someday contain: additional verifier files are expected and legal, and
// no rule below can observe them.
//
// PROVENANCE. Every entry is derived from the merged QHIM-002 remediation,
// PR #151 "HIM Historical Verifier Forward Compatibility Sweep v1"
// (head 9f25784d4a960f8c30b7dd9112c7fbde4eb4edcc, merge commit
// c919288858e8136c7c1651e5976947e5eec2bc60), cut from canonical main
// e1f6da9303e81d8cd781b5e57c9c95f1fd2df7d8. Two independent facts from that PR
// pin the map exactly and are asserted below rather than trusted:
//
//   * its stated repository-wide sweep - "All 50 historical verifiers were
//     classified against every mandated search term. Final sweep result: 0
//     QHIM-002 ceilings remain; 20 catalog reads, all version-scoped" - and
//   * the 21 verifier files it actually changed, whose per-rule remediation is
//     recorded rule by rule below.
//
// The 50 swept names are exactly the verify-*.mjs files present in PR #151's
// baseline tree. Everything introduced at or after QHIM-002 is therefore
// outside every scope by construction: the QHIM-002 proof harness itself
// (added by PR #151), verify-migration-0051.mjs (PR #152),
// verify-migration-0052.mjs (PR #153), and any later verifier.
import{readdirSync,readFileSync}from'node:fs';

// The stated PR #151 facts, asserted against the map at load time so the map
// cannot silently drift away from the remediation it claims to encode.
export const QHIM002_PROVENANCE=Object.freeze({pullRequest:151,title:'HIM Historical Verifier Forward Compatibility Sweep v1',head:'9f25784d4a960f8c30b7dd9112c7fbde4eb4edcc',mergeCommit:'c919288858e8136c7c1651e5976947e5eec2bc60',baselineCommit:'e1f6da9303e81d8cd781b5e57c9c95f1fd2df7d8',sweptHistoricalVerifiers:50,versionScopedCatalogReads:20,remediatedVerifierFiles:21});

// The QHIM-002 proof harness. It is never a historical subject: it is the one
// file that must create synthetic future definition versions and synthetic
// functions inside the formerly frozen namespaces in order to prove the
// ceilings are gone, and it carries its own separate forward-safety contract.
export const QHIM002_HARNESS='verify-him-historical-verifier-forward-compatibility-v1.mjs';

// The complete historical universe QHIM-002 swept and classified: the 50
// verify-*.mjs files that existed at PR #151's baseline. Frozen by name.
export const QHIM002_SWEPT_HISTORICAL_VERIFIERS=Object.freeze(['verify-exact-version-confidence.mjs','verify-him-intelligence-snapshot-v1.mjs','verify-him-trends-v1.mjs','verify-migration-0001.mjs','verify-migration-0002.mjs','verify-migration-0004.mjs','verify-migration-0005.mjs','verify-migration-0006.mjs','verify-migration-0007.mjs','verify-migration-0008.mjs','verify-migration-0009.mjs','verify-migration-0010.mjs','verify-migration-0011.mjs','verify-migration-0012.mjs','verify-migration-0013.mjs','verify-migration-0014.mjs','verify-migration-0015.mjs','verify-migration-0016.mjs','verify-migration-0021.mjs','verify-migration-0022.mjs','verify-migration-0023.mjs','verify-migration-0024.mjs','verify-migration-0025.mjs','verify-migration-0026.mjs','verify-migration-0027.mjs','verify-migration-0028.mjs','verify-migration-0029.mjs','verify-migration-0030.mjs','verify-migration-0031.mjs','verify-migration-0032.mjs','verify-migration-0033.mjs','verify-migration-0034.mjs','verify-migration-0035.mjs','verify-migration-0036.mjs','verify-migration-0037.mjs','verify-migration-0038.mjs','verify-migration-0039.mjs','verify-migration-0040.mjs','verify-migration-0041.mjs','verify-migration-0042.mjs','verify-migration-0043.mjs','verify-migration-0044.mjs','verify-migration-0045.mjs','verify-migration-0046.mjs','verify-migration-0047.mjs','verify-migration-0048.mjs','verify-migration-0049.mjs','verify-migration-0050.mjs','verify-runtime-event-outbox-v1.mjs','verify-supabase-auth.mjs']);

// Named negative controls. These files exist today and must be provably
// ungoverned: they were introduced at or after QHIM-002 and were never part of
// its review. They stand for every future verifier as well.
export const QHIM002_EXCLUDED_BY_PROVENANCE=Object.freeze([QHIM002_HARNESS,'verify-migration-0051.mjs','verify-migration-0052.mjs']);

// ---------------------------------------------------------------------------
// Rule owners, derived rule by rule from PR #151
// ---------------------------------------------------------------------------

// The exact historical catalog owners, and the exact number of QHIM-002-owned
// him_metric_definitions reads each one contributes. Nineteen of these files
// had their catalog read version-scoped by PR #151; verify-migration-0049.mjs
// is the twentieth catalog read the same sweep classified as already scoped
// and therefore left byte-unchanged. The per-file counts are what fixes the
// harness's proof universe: the harness asks this map which files to read and
// how many owned queries each must yield, so no present or future verifier
// file can add to, remove from, or reorder its historical query set.
export const QHIM002_EXPECTED_CATALOG_QUERIES=Object.freeze({'verify-him-intelligence-snapshot-v1.mjs':1,'verify-him-trends-v1.mjs':1,'verify-migration-0010.mjs':1,'verify-migration-0011.mjs':1,'verify-migration-0012.mjs':1,'verify-migration-0013.mjs':1,'verify-migration-0014.mjs':1,'verify-migration-0015.mjs':1,'verify-migration-0016.mjs':1,'verify-migration-0037.mjs':1,'verify-migration-0040.mjs':1,'verify-migration-0041.mjs':1,'verify-migration-0042.mjs':1,'verify-migration-0043.mjs':1,'verify-migration-0044.mjs':1,'verify-migration-0045.mjs':1,'verify-migration-0046.mjs':1,'verify-migration-0047.mjs':1,'verify-migration-0048.mjs':1,'verify-migration-0049.mjs':1});

// RULE 1 owner set: the historical verifiers whose him_metric_definitions
// reads QHIM-002 scoped to the canonical v1 identity. definition_version=1 is
// a historical v1 identity rule for exactly these queries - it is not, and
// after QHIM-006 cannot become, a statement about anyone else's catalog read.
export const QHIM002_CATALOG_V1_SCOPE=Object.freeze(Object.keys(QHIM002_EXPECTED_CATALOG_QUERIES));

// The subset PR #151 physically edited, kept separately so the provenance of
// each name stays reviewable and the "already scoped" classification of
// verify-migration-0049.mjs is not silently reclassified as a remediation.
export const QHIM002_CATALOG_V1_REMEDIATED=Object.freeze(QHIM002_CATALOG_V1_SCOPE.filter(name=>name!=='verify-migration-0049.mjs'));

// RULES 2 and 3 owner set: freezing the live definition population - a literal
// seventeen-row universe, a global definition count, or a permanent
// uncalibrated list - is a ceiling only for the historical verifiers that read
// that population. Those are exactly the historical catalog owners above, so
// the two rules deliberately share one owner set rather than inventing a
// second list that could drift from it. PR #151 physically removed a
// population ceiling from eleven of them (0010's rows.length===17, 0011's
// calibrated/uncalibrated counts over every version, and 0040-0048's
// state.rows.length!==17) and rescoped 0037's global CALIBRATED census; the
// rule is enforced across the whole historical catalog-owner set because every
// file in it reads the same population and could regress into freezing it.
export const QHIM002_DEFINITION_POPULATION_SCOPE=QHIM002_CATALOG_V1_SCOPE;
export const QHIM002_DEFINITION_POPULATION_REMEDIATED=Object.freeze(['verify-migration-0010.mjs','verify-migration-0011.mjs','verify-migration-0037.mjs','verify-migration-0040.mjs','verify-migration-0041.mjs','verify-migration-0042.mjs','verify-migration-0043.mjs','verify-migration-0044.mjs','verify-migration-0045.mjs','verify-migration-0046.mjs','verify-migration-0047.mjs','verify-migration-0048.mjs']);

// RULES 4, 5 and 6 owner set: the three historical phases that owned the
// background function surface and from which PR #151 removed a live namespace
// census. 0021 lost its LIKE 'background_%_v1' census and its equality against
// the historical signature list; 0037 lost the LIKE 'background_read_him%'
// census that had converted its own CONVERSATION_SESSION context limit into a
// permanent ban on later reviewed readers; 0038 lost its background_%_v1
// count. Naming a background HIM reader other than the one 0037 owns can only
// be an assertion that a future reader must never exist - inside these three
// files. Outside them it is simply a future verifier naming its own function.
export const QHIM002_BACKGROUND_NAMESPACE_SCOPE=Object.freeze(['verify-migration-0021.mjs','verify-migration-0037.mjs','verify-migration-0038.mjs']);
export const QHIM002_BACKGROUND_READER_SCOPE=QHIM002_BACKGROUND_NAMESPACE_SCOPE;

// RULE 7 owner set: enumerating the migration directory from a verifier is the
// mechanism by which a next-migration-must-not-exist ceiling gets built. PR
// #151 classified all 50 swept verifiers against this term and found none, so
// the whole swept historical universe is this rule's exact owner: it is a
// permanent invariant of the reviewed history, and it says nothing at all
// about a future verifier, which may enumerate migrations freely.
export const QHIM002_MIGRATION_ENUMERATION_SCOPE=QHIM002_SWEPT_HISTORICAL_VERIFIERS;

// ---------------------------------------------------------------------------
// Shared measurement and authority identities
// ---------------------------------------------------------------------------

export const QHIM002_CANONICAL_V1_KEYS=Object.freeze(['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength']);
export const QHIM002_HSE_V1_KEYS=Object.freeze(['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress']);
export const QHIM002_OWNED_BACKGROUND_SIGNATURES=Object.freeze(['background_create_system_hypothesis_v1(uuid,uuid,text,text,text,text,text[],text[])','background_attach_hypothesis_evidence_v1(uuid,uuid,text,text)','background_link_competing_hypotheses_v1(uuid,uuid,uuid)','background_create_confidence_evaluation_v1(uuid,uuid,uuid,integer)','background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text)','background_read_him_conversation_snapshot_v1(uuid,uuid)']);

// RULE 8 owner set: the anti-weakening contract. QHIM-006 must not be
// "fixed" by deleting guard logic, so each removed ceiling's replacement is
// pinned to the exact file that owns it. These are per-file identities, never
// a scan.
export const QHIM002_ANTI_WEAKENING_SCOPE=Object.freeze({
 catalogIdentityOwners:Object.freeze(['verify-migration-0010.mjs','verify-migration-0040.mjs','verify-migration-0041.mjs','verify-migration-0042.mjs','verify-migration-0043.mjs','verify-migration-0044.mjs','verify-migration-0045.mjs','verify-migration-0046.mjs','verify-migration-0047.mjs','verify-migration-0048.mjs']),
 requiredCanonicalKeys:Object.freeze(['hse.energy','hbs.avoidance','hrs.relationship-trust','hgs.habit-strength']),
 calibrationScopeOwner:'verify-migration-0011.mjs',
 backgroundSignatureOwner:'verify-migration-0021.mjs',
 backgroundReaderOwner:'verify-migration-0037.mjs',
 backgroundPhaseOwner:'verify-migration-0038.mjs',
 v0038OwnedSignatures:Object.freeze(['public.create_information_gap(jsonb)','public.create_information_gap_core_v1(uuid,jsonb)','public.sync_post_response_information_gaps_v1(uuid)']),
 // The historical fact "0037 introduced exactly one background reader and 0038
 // introduced none" is proven from the frozen migration text, never from the
 // live function universe and never from a future verifier's source.
 frozenBackgroundMigrations:Object.freeze({'0037_background_him_runtime_consumption_v1.sql':Object.freeze(['background_read_him_conversation_snapshot_v1']),'0038_information_gap_question_integration_v1.sql':Object.freeze([])})
});

// ---------------------------------------------------------------------------
// Shared source helpers
// ---------------------------------------------------------------------------

// Prose comments legitimately describe the ceilings they removed and reference
// neighbouring migrations descriptively, so every mechanical rule that looks
// for executable behaviour runs against executable text only.
export const executableSource=text=>text.split('\n').map(line=>{const at=line.indexOf('//');return at===-1?line:(/^\s*\/\//.test(line)?'':line.slice(0,at));}).join('\n');
export const sqlLiterals=text=>[...text.matchAll(/(['"`])((?:(?!\1)[\s\S])*?)\1/g)].map(match=>match[2]);
const catalogReads=code=>sqlLiterals(code).filter(sql=>/FROM public\.him_metric_definitions/.test(sql));

// ---------------------------------------------------------------------------
// The rules, each bound to its own historical owner set
// ---------------------------------------------------------------------------
//
// classification, as required by the QHIM-006 remediation:
//   A  PERMANENT HISTORICAL INVARIANT - kept, on its exact owner(s)
//   B  QHIM-002 ANTI-REGRESSION       - kept, on its exact remediated owner(s)
//   C  GLOBAL FUTURE POLICY           - removed from this historical guard
//
// No rule is class C: nothing was deleted. What was removed is the global
// APPLICATION of every rule - the dynamic verifier-directory universe both the
// contract and the harness used to run these rules against files QHIM-002 does
// not own. Each `detect` returns the violation messages for one owned file and
// is never consulted for a file outside `scope`.
export const QHIM002_RULES=Object.freeze([
 Object.freeze({id:'CATALOG_V1_SCOPE',classification:'B',title:'an owned historical catalog read stays scoped to definition_version=1',scope:QHIM002_CATALOG_V1_SCOPE,detect:(name,{code})=>catalogReads(code).filter(sql=>!/definition_version=1/.test(sql)).map(sql=>`${name} reads him_metric_definitions without definition_version=1 scoping: ${sql.slice(0,120)}`)}),
 Object.freeze({id:'CATALOG_QUERY_VERBATIM',classification:'B',title:'an owned historical catalog read is provable verbatim',scope:QHIM002_CATALOG_V1_SCOPE,detect:(name,{code})=>catalogReads(code).filter(sql=>sql.includes('${')).map(()=>`${name} builds an interpolated catalog query that cannot be proven verbatim`)}),
 Object.freeze({id:'DEFINITION_POPULATION_CEILING',classification:'B',title:'an owned historical catalog verifier does not freeze the live definition population',scope:QHIM002_DEFINITION_POPULATION_SCOPE,detect:(name,{code})=>[...(/\.(?:length|rowCount)\s*(?:,|!==|===|==|!=|<>)\s*17\b/.test(code)?[`${name} freezes the global seventeen-definition universe`]:[]),...(/count\(\*\)[^;]{0,200}FROM public\.him_metric_definitions[^;]{0,200}(?:!==|===)\s*\d+/.test(code)?[`${name} freezes a global definition count`]:[])]}),
 Object.freeze({id:'PERMANENT_UNCALIBRATED_LIST',classification:'B',title:'an owned historical catalog verifier does not freeze a permanent uncalibrated list',scope:QHIM002_DEFINITION_POPULATION_SCOPE,detect:(name,{source})=>/must (?:remain|stay) uncalibrated|remaining uncalibrated/i.test(source)?[`${name} freezes a permanent uncalibrated list`]:[]}),
 Object.freeze({id:'BACKGROUND_NAMESPACE_CENSUS',classification:'B',title:'an owned background phase inspects exact signatures, never the live namespace',scope:QHIM002_BACKGROUND_NAMESPACE_SCOPE,detect:(name,{code})=>[...(/LIKE\s+'background_/i.test(code)?[`${name} takes a background_% namespace census`]:[]),...(/proname\s+(?:I?LIKE|~)/i.test(code)?[`${name} matches the live function namespace by pattern`]:[])]}),
 Object.freeze({id:'SIGNATURE_LIST_CENSUS',classification:'B',title:'an owned background phase does not assert census equality against its signature list',scope:QHIM002_BACKGROUND_NAMESPACE_SCOPE,detect:(name,{code})=>/(?:rowCount|rows\.length)\s*(?:!==|===|==|!=)\s*\w*[sS]ignatures\w*\.length/.test(code)?[`${name} asserts census equality against a historical signature list`]:[]}),
 Object.freeze({id:'FUTURE_BACKGROUND_READER_BAN',classification:'B',title:'an owned background phase does not require a future background HIM reader to be absent',scope:QHIM002_BACKGROUND_READER_SCOPE,detect:(name,{source})=>/background_read_him_(?!conversation_snapshot_v1)/.test(source)?[`${name} names a future background HIM reader as required-to-be-absent`]:[]}),
 Object.freeze({id:'MIGRATION_DIRECTORY_ENUMERATION',classification:'A',title:'a swept historical verifier does not enumerate the migration directory',scope:QHIM002_MIGRATION_ENUMERATION_SCOPE,detect:(name,{code})=>/readdirSync|readdir\(|migrations\/\*/.test(code)?[`${name} enumerates the migration directory`]:[]})
]);

// The QHIM-006 predicate itself: which QHIM-002 rules govern this file at all.
// For anything outside the frozen map - a future verifier, a future background
// HIM reader's verifier, a future definition-version owner - this is empty,
// and qhim002Violations can therefore never report anything about it.
export const qhim002RulesGoverning=name=>QHIM002_RULES.filter(rule=>rule.scope.includes(name)).map(rule=>rule.id);
export const qhim002Violations=(name,source)=>{
 const context={source,code:executableSource(source)},found=[];
 for(const rule of QHIM002_RULES)if(rule.scope.includes(name))found.push(...rule.detect(name,context));
 return found;
};

// The harness's historical proof universe. `read` is asked only for the files
// the ownership map names, so the returned query set is fixed by historical
// provenance and is provably unaffected by anything else the repository
// contains now or later. Each owned file must yield exactly the number of
// owned catalog reads the map declares - an exact identity, never a floor.
export const QHIM002_OWNED_CATALOG_QUERY_COUNT=Object.values(QHIM002_EXPECTED_CATALOG_QUERIES).reduce((total,count)=>total+count,0);
export const collectOwnedCatalogQueries=read=>{
 const queries=[];
 for(const name of QHIM002_CATALOG_V1_SCOPE){
  const source=read(name),code=executableSource(source),owned=catalogReads(code),violations=qhim002Violations(name,source);
  if(violations.length)throw new Error(violations.join('; '));
  if(owned.length!==QHIM002_EXPECTED_CATALOG_QUERIES[name])throw new Error(`${name} contributes ${owned.length} QHIM-002-owned catalog reads; the frozen historical ownership map declares exactly ${QHIM002_EXPECTED_CATALOG_QUERIES[name]}`);
  for(const sql of owned)queries.push({name,sql});
 }
 if(queries.length!==QHIM002_OWNED_CATALOG_QUERY_COUNT)throw new Error(`The QHIM-002 owned catalog query set must contain exactly ${QHIM002_OWNED_CATALOG_QUERY_COUNT} historical reads`);
 return queries;
};

// Existence only. The scope module may require every artifact it owns to still
// be present; it may never compare the directory against the map, count it, or
// fail because an unrelated verifier was added.
export const assertOwnedHistoricalArtifactsExist=(present=readdirSync(new URL('./',import.meta.url)))=>{
 const missing=[...QHIM002_SWEPT_HISTORICAL_VERIFIERS,QHIM002_HARNESS].filter(name=>!present.includes(name));
 if(missing.length)throw new Error(`QHIM-002 owned historical artifact(s) missing: ${missing.join(', ')}`);
 return true;
};
export const readVerifierSource=name=>readFileSync(new URL(name,new URL('./',import.meta.url)),'utf8');

// Load-time self-consistency: the map must match the PR #151 facts it cites,
// must never name a post-QHIM-002 artifact, and must never be satisfiable by
// an emptied rule set.
if(QHIM002_SWEPT_HISTORICAL_VERIFIERS.length!==QHIM002_PROVENANCE.sweptHistoricalVerifiers)throw new Error('The QHIM-002 swept historical universe no longer matches the PR #151 sweep');
if(QHIM002_OWNED_CATALOG_QUERY_COUNT!==QHIM002_PROVENANCE.versionScopedCatalogReads)throw new Error('The QHIM-002 owned catalog read count no longer matches the PR #151 sweep');
if(new Set(QHIM002_SWEPT_HISTORICAL_VERIFIERS).size!==QHIM002_SWEPT_HISTORICAL_VERIFIERS.length)throw new Error('The QHIM-002 swept historical universe contains a duplicate');
for(const rule of QHIM002_RULES){
 if(!rule.scope.length)throw new Error(`QHIM-002 rule ${rule.id} has an empty owner set`);
 for(const name of rule.scope){
  if(QHIM002_EXCLUDED_BY_PROVENANCE.includes(name))throw new Error(`QHIM-002 rule ${rule.id} claims ownership of ${name}, which was introduced at or after QHIM-002`);
  if(!QHIM002_SWEPT_HISTORICAL_VERIFIERS.includes(name))throw new Error(`QHIM-002 rule ${rule.id} claims ownership of ${name}, which PR #151 never swept`);
 }
}
