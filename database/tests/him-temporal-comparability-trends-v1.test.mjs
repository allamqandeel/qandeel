import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';import{CALIBRATED_STRUCTURED_METRICS,EXPECTED_UNCALIBRATED_COUNT}from'../../tests/him-structured-measurement.manifest.mjs';const sql=readFileSync(new URL('../migrations/0017_him_temporal_comparability_trends_v1.sql',import.meta.url),'utf8');
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
// list in a test. Calibration is read three ways that must agree: the existing
// canonical structured-measurement manifest, the frozen measurement-model
// migrations that actually set calculation_status, and the frozen 0010
// identity insert. The five-metric Trend scope is read from 0017, the source
// resolver itself. The guard therefore cannot disagree with the canonical
// manifest or be satisfied by editing a list, and it protects the Trend *v1*
// document only - a future, separately reviewed Trend v2 contract is
// deliberately left possible.
const migrationsDir=new URL('../migrations/',import.meta.url);
const migrations=readdirSync(migrationsDir).filter(name=>name.endsWith('.sql')).sort();
const CANONICAL_V1=[...readFileSync(new URL('0010_initial_him_metrics_v1.sql',migrationsDir),'utf8').matchAll(/\('([a-z]{3}\.[a-z-]+)',1,/g)].map(match=>match[1]);
const CALIBRATED=migrations.flatMap(name=>[...readFileSync(new URL(name,migrationsDir),'utf8').matchAll(/UPDATE public\.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='([a-z]{3}\.[a-z-]+)\./g)].map(match=>match[1]));
const MANIFEST_CALIBRATED=CALIBRATED_STRUCTURED_METRICS.map(entry=>entry.metricKey).sort();
const TREND_V1=[...new Set([...sql.matchAll(/'(hse\.[a-z-]+)'/g)].map(match=>match[1]))].sort();
const doc=readFileSync(new URL('../../docs/him-temporal-comparability-trend-v1.md',import.meta.url),'utf8');

test('the canonical manifest calibrates all seventeen HIM v1 metrics, including both final HGS appraisals',()=>{
 assert.equal(CANONICAL_V1.length,17,'0010 declares the seventeen canonical v1 identities');
 assert.equal(new Set(CALIBRATED).size,17,'every canonical identity is calibrated exactly once by a measurement-model migration');
 for(const key of CANONICAL_V1)assert.ok(CALIBRATED.includes(key),`${key} is calibrated by a frozen measurement-model migration`);
 // The existing canonical structured-measurement manifest is the repository's
 // current-state calibrated inventory and must agree exactly, so this guard
 // has no independent list of its own to fall stale.
 assert.deepEqual(MANIFEST_CALIBRATED,[...CANONICAL_V1].sort(),'the canonical manifest and the frozen identity insert name the same seventeen metrics');
 assert.deepEqual(MANIFEST_CALIBRATED,[...CALIBRATED].sort(),'the canonical manifest and the frozen calibration migrations agree');
 assert.equal(EXPECTED_UNCALIBRATED_COUNT,0,'no canonical HIM v1 metric remains uncalibrated');
 for(const key of['hgs.purpose-alignment','hgs.habit-strength'])assert.ok(MANIFEST_CALIBRATED.includes(key)&&CALIBRATED.includes(key),`${key} is CALIBRATED, so the Trend document may not call it uncalibrated`);
});

test('the Trend v1 document never describes a canonical HIM v1 metric as uncalibrated or unsupported',()=>{
 // Every canonical v1 metric is calibrated (proved above from the manifest),
 // so no such claim can be true in this document.
 assert.doesNotMatch(doc,/\buncalibrated\b/i,'the Trend v1 document calls no canonical HIM v1 metric uncalibrated');
 assert.doesNotMatch(doc,/\bunsupported\b/i,'the Trend v1 document calls no canonical HIM v1 metric an unsupported measurement');
 assert.doesNotMatch(doc,/remaining two initial HIM metrics/i,'the stale two-metric remainder sentence is gone');
 assert.match(doc,/all seventeen canonical HIM v1 metrics are calibrated/,'the document states the current calibration state');
 for(const key of CANONICAL_V1.filter(key=>key.startsWith('hgs.')))assert.ok(doc.includes(key),`the document names the calibrated HGS metric ${key} explicitly`);
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
