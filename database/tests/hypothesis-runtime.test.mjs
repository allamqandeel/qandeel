import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import test from 'node:test';
const sql = await readFile(new URL('../migrations/0005_hypothesis_runtime.sql', import.meta.url), 'utf8');
test('defines separate bounded hypothesis persistence without confidence or reasoning', () => {
  assert.match(sql,/CREATE TABLE public\.hypotheses/u); assert.doesNotMatch(sql,/CREATE TABLE[\s\S]*?(?:confidence|chain.of.thought|scratchpad|diagnosis)/iu);
  for (const value of ['CAUSAL','BEHAVIORAL','MOTIVATIONAL','SITUATIONAL','RELATIONAL','DECISION','PREDICTIVE','INTERPRETIVE','STRATEGIC','CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REJECTED','RETIRED','REOPENED']) assert.match(sql,new RegExp(`'${value}'`,'u'));
  assert.match(sql,/cardinality\(competing_hypothesis_ids\) <= 16/u); assert.match(sql,/assumptions, 8, 500/u); assert.match(sql,/disconfirming_conditions, 8, 500/u);
});
test('enforces owner RLS and authenticated identity inside atomic operations', () => {
  assert.match(sql,/ALTER TABLE public\.hypotheses ENABLE ROW LEVEL SECURITY/u); assert.doesNotMatch(sql,/service_role/iu);
  assert.equal((sql.match(/auth\.uid\(\)/gu)??[]).length >= 6,true); assert.match(sql,/user_id=\(SELECT auth\.uid\(\)\)/u);
  assert.doesNotMatch(sql,/p_user_id/u);
});
test('centralizes lifecycle, evidence eligibility, and symmetric competition', () => {
  assert.match(sql,/CREATE FUNCTION public\.transition_hypothesis/u); assert.match(sql,/WHEN 'REJECTED' THEN p_status='REOPENED'/u);
  assert.match(sql,/source IN \('USER_STATED','USER_CONFIRMED'\)/u); assert.match(sql,/expires_at>CURRENT_TIMESTAMP/u); assert.match(sql,/supporting_evidence_ids && contradicting_evidence_ids/u);
  assert.equal((sql.match(/array_append\(competing_hypothesis_ids/gu)??[]).length,2);
});
