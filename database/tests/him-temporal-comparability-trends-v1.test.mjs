import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{CALIBRATED_STRUCTURED_METRICS}from'../../tests/him-structured-measurement.manifest.mjs';const sql=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
test('is a bounded read-only RLS-preserving source resolver',()=>{assert.match(sql,/SECURITY DEFINER STABLE/);assert.match(sql,/p_user_id IS DISTINCT FROM u/);assert.match(sql,/LIMIT 129/);assert.match(sql,/him_current_structured_measurements/);assert.match(sql,/JOIN public\.him_measurement_events e ON e\.id=s\.measurement_event_id/);assert.match(sql,/e\.created_at>=p_window_start AND e\.created_at<p_window_end/);assert.match(sql,/jsonb_build_object\('observed_at',c\.event_observed_at\)/);assert.match(sql,/ORDER BY c\.event_observed_at,c\.id/);assert.match(sql,/Unknown or unowned HIM trend context/);});
test('resolves exact binding identities without trend persistence',()=>{assert.match(sql,/canonical_binding_id/);assert.match(sql,/instrumentId/);assert.match(sql,/modelVersion/);assert.doesNotMatch(sql,/CREATE TABLE public\.him_trends|INSERT INTO|UPDATE public|DELETE FROM|openai|embedding/i);});

// --- QHIM-008: the authoritative Trend v1 document must not drift -----------
//
// The document used to close its eligibility paragraph with "The remaining two
// initial HIM metrics (both HGS) are uncalibrated and unsupported." That was a
// true statement about an earlier state and became false once migrations 0048
// and 0049 calibrated Purpose Alignment and Habit Strength: all seventeen
// canonical HIM v1 metrics are calibrated. Their absence from Trend v1 is a
// deliberate eligibility policy, not a calibration status.
//
// Every fact this guard rests on is DERIVED, never duplicated as a mutable
// list in a test, and every source is either frozen history or the repository's
// own current-state manifest:
//
//   * the seventeen canonical v1 identities, from the frozen 0010 insert;
//   * the calibrated identities of the existing canonical
//     structured-measurement manifest;
//   * the five-metric Trend scope, from frozen migration 0017 - the source
//     resolver itself, so the document cannot drift from the runtime.
//
// CANONICAL-V1 SCOPING. Two earlier revisions of this guard reached past what
// the Trend v1 document actually claims, and both were future ceilings of
// exactly the class QHIM-006 exists to remove:
//
//   1. it enumerated ALL migrations, extracted EVERY
//      calculation_status='CALIBRATED' update and asserted exact equality with
//      the seventeen-metric manifest - so a legitimate later calibration
//      migration, a reviewed hse.energy@2 or an eighteenth canonical metric,
//      would have failed this documentation test;
//   2. it required the manifest-global EXPECTED_UNCALIBRATED_COUNT to be zero -
//      so a future, separately reviewed metric or version sitting UNCALIBRATED
//      while it waits for its own calibration task would have failed it too.
//
// Green CI could expose neither, because canonical main contains no later
// calibration and nothing uncalibrated yet.
//
// Both are gone. The document owns exactly one claim about calibration - that
// the seventeen frozen canonical v1 identities are calibrated - so this guard
// owns `canonical HIM v1 calibration truth` and never `all calibration activity
// the repository may ever contain` or `the global state of the shared
// inventory`. The check below is therefore pure set inclusion, CANONICAL_V1
// subset of the calibrated manifest identities: extra calibrated entries and
// extra uncalibrated entries are equally legal and equally invisible. The only
// migration text still read is 0010, 0017, and the two exactly named frozen
// migrations that calibrated the metrics QHIM-008 is actually about, each
// matched on its exact metric_key / definition_version=1 contract.
//
// It protects the Trend *v1* document only - a future, separately reviewed
// Trend v2 contract is deliberately left possible.
const migrationsDir=new URL('../migrations/',import.meta.url);
const migration=name=>readFileSync(new URL(name,migrationsDir),'utf8');
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const CANONICAL_V1=[...migration('0010_initial_him_metrics_v1.sql').matchAll(/\('([a-z]{3}\.[a-z-]+)',1,/g)].map(match=>match[1]);
const MANIFEST_CALIBRATED=CALIBRATED_STRUCTURED_METRICS.map(entry=>entry.metricKey).sort();
const TREND_V1=[...new Set([...sql.matchAll(/'(hse\.[a-z-]+)'/g)].map(match=>match[1]))].sort();
const doc=readFileSync(new URL('../../docs/him-temporal-comparability-trend-v1.md',import.meta.url),'utf8');
// The checker, canonical-v1 scoped by construction: it asks one question only -
// is every frozen canonical v1 identity present in the current calibrated
// inventory? Set inclusion, CANONICAL_V1 subset of the calibrated identities.
//
// It deliberately takes no uncalibrated count, list, or total. The Trend v1
// document owns exactly one claim about calibration - that the seventeen frozen
// canonical v1 identities are calibrated - and a later, separately reviewed
// metric or metric version may legitimately sit UNCALIBRATED in the shared
// current manifest while waiting for its own calibration task without making
// that historical v1 statement any less true. Requiring a manifest-global zero
// would be this document governing unrelated future inventory: the same
// ownership error as QHIM-006, one level up. Extra calibrated entries and extra
// uncalibrated entries are both legal and both invisible here.
const canonicalV1CalibrationViolations=(canonicalV1,calibratedInventory)=>{
 const inventory=new Set(calibratedInventory);
 return canonicalV1.filter(key=>!inventory.has(key)).map(key=>`canonical v1 metric ${key} is missing from the current calibrated inventory`);
};
// Frozen per-metric corroboration for exactly the two metrics QHIM-008 is
// about, read from their own exactly named migrations and matched on the exact
// canonical v1 identity/version contract. This is set membership on two frozen
// files, never a scan: a later migration calibrating anything at all cannot
// participate.
const FROZEN_V1_CALIBRATION=Object.freeze({'hgs.purpose-alignment':'0048_hgs_purpose_alignment_measurement_model_v1.sql','hgs.habit-strength':'0049_hgs_habit_strength_measurement_model_v1.sql'});
const calibratesCanonicalV1=(text,key)=>new RegExp(`SET calculation_status='CALIBRATED',scale_reference='${escape(key)}\\.[a-z0-9-]+\\.v1'[^;]*WHERE metric_key='${escape(key)}' AND definition_version=1`).test(text);

test('the canonical v1 calibration inventory covers all seventeen HIM v1 identities, including both final HGS appraisals',()=>{
 assert.equal(CANONICAL_V1.length,17,'0010 declares the seventeen canonical v1 identities');
 assert.deepEqual(canonicalV1CalibrationViolations(CANONICAL_V1,MANIFEST_CALIBRATED),[],'every canonical v1 identity is in the current calibrated inventory');
 for(const key of CANONICAL_V1)assert.ok(MANIFEST_CALIBRATED.includes(key),`${key} is in the calibrated manifest identities`);
 for(const key of['hgs.purpose-alignment','hgs.habit-strength']){
  assert.ok(MANIFEST_CALIBRATED.includes(key),`${key} is CALIBRATED in the canonical manifest, so the Trend document may not call it uncalibrated`);
  assert.ok(calibratesCanonicalV1(migration(FROZEN_V1_CALIBRATION[key]),key),`${key} is calibrated at definition_version=1 by its own frozen migration`);
 }
});

test('later calibrated or uncalibrated work cannot invalidate this guard, and a missing canonical v1 metric still fails it',()=>{
 // Each fixture models what the shared current manifest would report once
 // later, separately reviewed work lands. `calibrated` is the only field the
 // checker consumes; `uncalibrated` is carried alongside it precisely to prove
 // that it is NOT an input to canonical v1 calibration truth.
 const state=(calibrated,uncalibrated=[])=>({calibrated,uncalibrated});
 const today=state(MANIFEST_CALIBRATED);
 const withEnergyV2=state([...MANIFEST_CALIBRATED,'hse.energy']);                       // a reviewed calibrated hse.energy@2
 const withNewMetric=state([...MANIFEST_CALIBRATED,'hxs.future-appraisal']);            // a calibrated eighteenth metric
 const withUncalibratedMetric=state(MANIFEST_CALIBRATED,['hxs.future-appraisal']);      // an eighteenth metric awaiting its own calibration task
 const withUncalibratedVersion=state(MANIFEST_CALIBRATED,['hse.energy']);               // a reviewed hse.energy@2 not yet calibrated
 const withEverything=state([...MANIFEST_CALIBRATED,'hse.energy'],['hxs.future-appraisal','hxs.second-future-appraisal']);
 const futures=[today,withEnergyV2,withNewMetric,withUncalibratedMetric,withUncalibratedVersion,withEverything];
 // PASS direction - the QHIM-006 class must not return, for later CALIBRATED
 // work or later UNCALIBRATED work.
 for(const fixture of futures)assert.deepEqual(canonicalV1CalibrationViolations(CANONICAL_V1,fixture.calibrated),[],'later inventory is outside canonical v1 calibration truth and must be invisible here');
 // The fixtures are meaningful: three of them really do model a non-zero
 // global uncalibrated count, and three really do grow the calibrated set.
 assert.equal(futures.filter(fixture=>fixture.uncalibrated.length>0).length,3,'the uncalibrated futures are non-empty');
 assert.equal(futures.filter(fixture=>fixture.calibrated.length>MANIFEST_CALIBRATED.length).length,3,'the calibrated futures really grew');
 // Both retired global rules would have failed on exactly those fixtures while
 // passing today - which is why green CI could not expose either of them.
 const retiredEqualityCensus=fixture=>fixture.calibrated.length===CANONICAL_V1.length;
 const retiredGlobalZeroUncalibrated=fixture=>fixture.uncalibrated.length===0;
 assert.ok(retiredEqualityCensus(today)&&retiredGlobalZeroUncalibrated(today),'both retired global rules passed on canonical main');
 for(const fixture of[withEnergyV2,withNewMetric])assert.ok(!retiredEqualityCensus(fixture),'the retired all-migrations census would have failed once a later calibration existed');
 for(const fixture of[withUncalibratedMetric,withUncalibratedVersion,withEverything])assert.ok(!retiredGlobalZeroUncalibrated(fixture),'the retired manifest-global zero-uncalibrated rule would have failed once any future metric entered uncalibrated');
 // FAIL direction - the guard is not vacuous. Dropping either metric QHIM-008
 // is about, or any other canonical v1 identity, is still caught, including
 // while later calibrated and uncalibrated work is present.
 for(const key of['hgs.purpose-alignment','hgs.habit-strength'])assert.deepEqual(canonicalV1CalibrationViolations(CANONICAL_V1,MANIFEST_CALIBRATED.filter(entry=>entry!==key)),[`canonical v1 metric ${key} is missing from the current calibrated inventory`],`${key} must remain covered`);
 for(const key of CANONICAL_V1){
  assert.equal(canonicalV1CalibrationViolations(CANONICAL_V1,MANIFEST_CALIBRATED.filter(entry=>entry!==key)).length,1,`${key} must remain covered`);
  assert.equal(canonicalV1CalibrationViolations(CANONICAL_V1,withEverything.calibrated.filter(entry=>entry!==key)).length,1,`${key} must remain covered even beside later calibrated and uncalibrated work`);
 }
 // The frozen per-metric corroboration is live too: it matches only the exact
 // canonical v1 identity/version contract, so a v2 calibration is not mistaken
 // for it and a wrong-key calibration does not satisfy it.
 for(const key of Object.keys(FROZEN_V1_CALIBRATION)){
  assert.ok(!calibratesCanonicalV1(`SET calculation_status='CALIBRATED',scale_reference='${key}.congruence-5.v2' WHERE metric_key='${key}' AND definition_version=2;`,key),'a later definition version does not satisfy the canonical v1 contract');
  assert.ok(!calibratesCanonicalV1(migration(FROZEN_V1_CALIBRATION[key]),'hse.energy'),'another metric’s migration does not satisfy this contract');
 }
});

test('the Trend v1 document documents every canonical v1 metric as calibrated',()=>{
 assert.match(doc,/all seventeen canonical HIM v1 metrics are calibrated/,'the document states the current canonical v1 calibration state');
 assert.doesNotMatch(doc,/remaining two initial HIM metrics/i,'the stale two-metric remainder sentence is gone');
 // A claim that anything is uncalibrated. This is a rule about the DOCUMENT's
 // wording, so no amount of later calibration work in the repository can trip
 // it - unlike the census this guard replaced.
 assert.doesNotMatch(doc,/\b(?:are|is|remain|remains|stay|stays)\s+uncalibrated\b/i,'the Trend v1 document asserts nothing is uncalibrated');
 // Per canonical v1 identity: named in the document, and - for every identity
 // outside Trend v1 - documented as calibrated with no uncalibrated or
 // unsupported claim attached. This is what actually catches the stale
 // sentence, which named neither metric at all. A future eighteenth metric is
 // simply not in this frozen set.
 for(const key of CANONICAL_V1){
  const anchor=doc.indexOf(`\`${key}\``);
  assert.ok(anchor>=0,`${key} is named in the Trend v1 document`);
  if(TREND_V1.includes(key))continue;
  const clause=doc.slice(anchor,anchor+500);
  assert.match(clause,/\bcalibrated\b/,`${key} is documented as calibrated`);
  assert.doesNotMatch(clause,/\buncalibrated\b|\bunsupported\b/i,`${key} is not documented as uncalibrated or unsupported`);
 }
});

test('Purpose Alignment and Habit Strength are calibrated yet deliberately outside Trend v1',()=>{
 assert.match(doc,/`hgs\.purpose-alignment` and `hgs\.habit-strength`[\s\S]{0,240}?are calibrated[\s\S]{0,240}?NOT eligible for Trend v1/,'both are documented as calibrated and NOT Trend eligible');
 assert.match(doc,/confers no Trend eligibility/,'calibration is explicitly separated from Trend eligibility');
 assert.match(doc,/GOAL-bound alignment appraisal, not an HSE STATE point/,'Purpose Alignment is documented as a GOAL-bound alignment appraisal');
 assert.match(doc,/target-bound cue-linked automaticity appraisal, not an HSE STATE point/,'Habit Strength is documented as a cue-linked automaticity appraisal');
 assert.match(doc,/no approved HGS temporal-comparability cadence or minimum-comparability policy/,'neither has an approved temporal-comparability policy');
 // Not a permanent ban: a future, separately reviewed HGS contract may admit
 // them. This guard governs the v1 document, never a future Trend v2.
 assert.match(doc,/may admit them deliberately after separate review/,'future admission stays possible through a separately reviewed contract');
});

test('Trend v1 remains exactly the five HSE metrics named by the frozen source resolver',()=>{
 assert.deepEqual(TREND_V1,['hse.attention','hse.energy','hse.motivation','hse.self-confidence','hse.stress']);
 const boundary=doc.indexOf('and only those five HSE metrics');
 assert.ok(boundary>0,'the document still states the five-metric Trend scope');
 const eligible=doc.slice(0,boundary);
 assert.deepEqual([...new Set([...eligible.matchAll(/`([a-z]{3}\.[a-z-]+)`/g)].map(match=>match[1]))].sort(),TREND_V1,'the eligible list names exactly the five HSE metrics');
 for(const key of CANONICAL_V1.filter(key=>!TREND_V1.includes(key)))assert.ok(doc.includes(key)&&!eligible.includes(key),`${key} appears in the document only as a deliberate exclusion`);
});

test('QHIM-008 is documentation drift only: the executable Trend contract is untouched',()=>{
 // Nothing above may be satisfied by widening or narrowing the runtime. The
 // resolver still names exactly the five HSE metrics and no other canonical
 // identity, and the document's Trend scope is read from it.
 assert.match(sql,/read_him_trend_source_v1/);
 for(const key of TREND_V1)assert.ok(sql.includes(key),`${key} is a Trend v1 source metric`);
 for(const key of CANONICAL_V1.filter(key=>!TREND_V1.includes(key)))assert.ok(!sql.includes(key),`${key} never enters the Trend v1 source resolver`);
});

// --- QHIM-011: documented semantic mappings must match executable truth -----
//
// The document used to close its HGS paragraph with ONE SHARED clause - "each
// has an unresolved/null semantic mapping" - covering both
// `hgs.purpose-alignment` and `hgs.habit-strength`. That is true of Habit
// Strength and FALSE of Purpose Alignment, whose Foundation semantic mapping
// has been RESOLVED to ALIGNMENT since the frozen 0010 seed and was never
// downgraded. A shared claim over identities whose real statuses differ is the
// exact drift QHIM-011 removes.
//
// Every fact below is DERIVED from that frozen seed - the persisted projection
// of the canonical v1 catalog - never duplicated as a mutable list here. Both
// rules are about the DOCUMENT's wording and iterate only the frozen canonical
// v1 identities, so no later metric, later definition version, or later
// calibration can trip them: an identity outside that frozen set is simply not
// iterated, and no global count, size, or zero-state of a shared inventory is
// taken. Neither rule grants, removes, or widens any Trend eligibility.
const CANONICAL_V1_SEMANTICS=Object.fromEntries(CANONICAL_V1.map(key=>{
 const row=migration('0010_initial_him_metrics_v1.sql').split('\n').find(line=>line.startsWith(`('${key}',1,`));
 if(!row)throw new Error(`0010 declares no canonical v1 row for ${key}`);
 const mapping=row.match(/,'(RESOLVED|UNRESOLVED)',(NULL|'[A-Z]+'),'UNCALIBRATED'/);
 if(!mapping)throw new Error(`0010 declares no semantic mapping for ${key}`);
 return[key,{status:mapping[1],type:mapping[2]==='NULL'?null:mapping[2].slice(1,-1)}];
}));
// The stretch of prose one backticked identity owns: from where it is named to
// the next canonical identity, sentence end, or clause end - whichever comes
// first. A metric key's own dots never end a clause because they are never
// followed by whitespace.
const ownedClause=(text,index)=>{const rest=text.slice(index+1),stop=rest.search(/[.;](?=\s|$)|`[a-z]{3}\.[a-z-]+(?:@\d+)?`/);
 return stop<0?text.slice(index):text.slice(index,index+stop+2);};
// Every place the document binds a semantic-mapping status to an EXACT
// canonical v1 identity. Versioned and unversioned mentions both count, and a
// later definition version is deliberately not one of them.
const semanticMappingClaims=text=>[...text.matchAll(/`([a-z]{3}\.[a-z-]+)(?:@(\d+))?`/g)]
 .filter(match=>match[2]===undefined||match[2]==='1')
 .map(match=>({key:match[1],clause:ownedClause(text,match.index)}))
 .filter(entry=>/semantic[- ]mapping/i.test(entry.clause)&&/\b(?:un)?resolved\b/i.test(entry.clause))
 .map(entry=>({key:entry.key,clause:entry.clause,claimed:/\bunresolved\b/i.test(entry.clause)?'UNRESOLVED':'RESOLVED'}));
// One semantic-mapping status asserted across several identities at once. That
// is legal wherever the identities really do share it - the HRS and the
// Self-Awareness/Resilience clauses genuinely do - so this rule is applied ONLY
// to the closing HGS paragraph, where the frozen seed proves the two identities
// do not, and therefore where no shared claim about them can ever be true.
const sharedSemanticMappingClaim=text=>/\b(?:each|both|either|they)\b[^.]{0,140}?semantic[- ]mapping/i.test(text);
const closingHgsParagraph=()=>{const start=doc.indexOf('`hgs.purpose-alignment`'),end=doc.indexOf('There is no controller',start);
 assert.ok(start>=0&&end>start,'the closing HGS paragraph is present');
 return doc.slice(start,end);};
const RETIRED_CLOSING='Purpose Alignment is a GOAL-bound alignment appraisal, not an HSE STATE point, and Habit Strength is a target-bound cue-linked automaticity appraisal, not an HSE STATE point; each has an unresolved/null semantic mapping and no approved HGS temporal-comparability cadence or minimum-comparability policy, so no "alignment improving/worsening" reading and no habit-formation, streak, or growth-trajectory reading of any kind exists.';

test('every documented canonical v1 semantic mapping matches the frozen executable truth',()=>{
 assert.equal(Object.keys(CANONICAL_V1_SEMANTICS).length,CANONICAL_V1.length,'0010 declares one semantic mapping per canonical v1 identity');
 assert.deepEqual(CANONICAL_V1_SEMANTICS['hgs.purpose-alignment'],{status:'RESOLVED',type:'ALIGNMENT'},'Purpose Alignment v1 is RESOLVED to ALIGNMENT in the frozen seed');
 assert.deepEqual(CANONICAL_V1_SEMANTICS['hgs.habit-strength'],{status:'UNRESOLVED',type:null},'Habit Strength v1 keeps an UNRESOLVED null mapping in the frozen seed');
 // Wherever the document binds a status to an exact identity, it must be the
 // frozen one. Per identity, never a census of the document.
 const claims=semanticMappingClaims(doc);
 for(const claim of claims)assert.equal(claim.claimed,CANONICAL_V1_SEMANTICS[claim.key].status,`${claim.key} is documented with its frozen semantic mapping`);
 // The rule is live, not vacuous: both closing HGS identities really are among
 // the identity-bound claims it inspects.
 for(const key of['hgs.purpose-alignment','hgs.habit-strength'])assert.ok(claims.some(claim=>claim.key===key),`${key} really is documented with an identity-bound semantic mapping`);
 // And it really would catch a drifted statement, in either direction.
 const drifted=doc.replace('`hgs.purpose-alignment@1` is semantic-mapping RESOLVED with the `ALIGNMENT` semantic type','`hgs.purpose-alignment@1` has an unresolved/null semantic mapping');
 assert.notEqual(drifted,doc,'the drift fixture really rewrote the Purpose Alignment statement');
 const driftedClaim=semanticMappingClaims(drifted).find(claim=>claim.key==='hgs.purpose-alignment');
 assert.equal(driftedClaim.claimed,'UNRESOLVED');
 assert.notEqual(driftedClaim.claimed,CANONICAL_V1_SEMANTICS['hgs.purpose-alignment'].status,'a re-grouped Purpose Alignment statement is caught');
 const flipped=doc.replace('`hgs.habit-strength@1` keeps an UNRESOLVED semantic mapping','`hgs.habit-strength@1` keeps a RESOLVED semantic mapping');
 assert.notEqual(flipped,doc,'the drift fixture really rewrote the Habit Strength statement');
 const flippedClaim=semanticMappingClaims(flipped).find(claim=>claim.key==='hgs.habit-strength');
 assert.notEqual(flippedClaim.claimed,CANONICAL_V1_SEMANTICS['hgs.habit-strength'].status,'a falsely resolved Habit Strength statement is caught');
});

test('the closing HGS semantic mappings are stated per identity and never as one shared status',()=>{
 const alignment=CANONICAL_V1_SEMANTICS['hgs.purpose-alignment'],habit=CANONICAL_V1_SEMANTICS['hgs.habit-strength'];
 assert.notEqual(alignment.status,habit.status,'the two closing HGS mappings genuinely differ, so no shared claim about them can be true');
 const closing=closingHgsParagraph();
 assert.match(closing,/`hgs\.purpose-alignment@1` is semantic-mapping RESOLVED with the `ALIGNMENT` semantic type/,'Purpose Alignment is stated exactly and per identity');
 assert.match(closing,/`hgs\.habit-strength@1` keeps an UNRESOLVED semantic mapping with a null semantic type/,'Habit Strength is stated exactly and per identity');
 assert.ok(!sharedSemanticMappingClaim(closing),'no shared semantic-mapping status covers both closing HGS identities');
 // Anti-vacuity: the retired wording really is caught by this rule, and really
 // did assert one shared unresolved mapping over both identities.
 assert.ok(sharedSemanticMappingClaim(RETIRED_CLOSING),'the retired grouped wording is caught by this rule');
 assert.match(RETIRED_CLOSING,/each has an unresolved\/null semantic mapping/,'the retired wording really asserted one shared unresolved mapping');
 // The correction moves no eligibility boundary. Both stay outside Trend v1, a
 // RESOLVED mapping is explicitly separated from Trend eligibility, and the
 // frozen executable resolver still names neither identity.
 assert.match(closing,/NOT eligible for Trend v1/,'both remain outside Trend v1');
 assert.match(closing,/confers no Trend eligibility/,'calibration stays separated from Trend eligibility');
 assert.match(closing,/confers no Trend v1 eligibility on Purpose Alignment/,'a RESOLVED semantic mapping is separated from Trend eligibility too');
 assert.match(closing,/may admit them deliberately after separate review/,'future admission stays possible through a separately reviewed contract');
 for(const key of['hgs.purpose-alignment','hgs.habit-strength']){
  assert.ok(!TREND_V1.includes(key),`${key} is not a Trend v1 source metric`);
  assert.ok(!sql.includes(key),`${key} never enters the Trend v1 source resolver`);
 }
});
