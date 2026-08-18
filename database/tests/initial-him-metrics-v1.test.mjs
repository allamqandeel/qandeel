import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0010_initial_him_metrics_v1.sql',import.meta.url),'utf8');
const keys=[...sql.matchAll(/^\('([^']+)',1,/gm)].map(m=>m[1]);
const expected=['hse.stress','hse.energy','hse.motivation','hse.self-confidence','hse.attention','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
test('seeds exactly the canonical catalog',()=>assert.deepEqual(keys,expected));
test('keeps every initial metric uncalibrated without dependency edges',()=>{assert.equal((sql.match(/'UNCALIBRATED'/g)??[]).length,18);assert.equal((sql.match(/'UNCALIBRATED_NO_PRODUCTION_SCALE'/g)??[]).length,17);assert.equal((sql.match(/'UNRESOLVED_METRIC_CONFIDENCE_MODEL'/g)??[]).length,17);assert.equal((sql.match(/ARRAY\['HIF_PART_8_HUMAN_INTELLIGENCE_METRICS_V0_1'\],'\{\}'/g)??[]).length,17);});
test('direct RPC fails closed for uncalibrated definitions and rejects status forgery',()=>{assert.match(sql,/definition\.calculation_status<>'CALIBRATED'/);assert.match(sql,/Observation contains forbidden fields/);assert.doesNotMatch(sql,/calculationStatus.*ALL\(ARRAY/);});
test('does not introduce illustrative metrics, formulas, trends, providers, or mutations',()=>{assert.doesNotMatch(sql,/Decision Clarity|Action Readiness|Goal Alignment|Decision Quality|Relationship Health|Growth Momentum|Sleep/);assert.doesNotMatch(sql,/threshold|decay|band|openai|claude|gemini|embedding|UPDATE public\.(memories|hypotheses|confidence_evaluations|information_gaps)/i);});

