import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import test from 'node:test';
const sql = await readFile(new URL('../migrations/0005_hypothesis_runtime.sql', import.meta.url), 'utf8');
const acl = await readFile(new URL('../migrations/0020_hypothesis_constraint_function_acl.sql', import.meta.url), 'utf8');
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
test('forward migration 0020 grants only the bounded-array constraint helper execution', () => {
  assert.match(acl,/REVOKE ALL ON FUNCTION public\.bounded_nonempty_text_array\(text\[\],integer,integer\) FROM PUBLIC,anon/u);
  assert.match(acl,/GRANT EXECUTE ON FUNCTION public\.bounded_nonempty_text_array\(text\[\],integer,integer\) TO authenticated/u);
  assert.doesNotMatch(acl,/ALTER TABLE|CREATE POLICY|GRANT (?:INSERT|UPDATE|DELETE)|SECURITY DEFINER|provider|openai|claude|gemini/iu);
});
// Migrations 0005 and 0020 stay historical source-of-truth text: the direct
// authenticated INSERT grant and hypotheses_insert_own policy they created are
// asserted here as history, and are revoked/dropped by the forward migration
// 0027 whose hardened effective state is asserted in
// hypothesis-authority-hardening-v1.test.mjs.
test('directs the effective Hypothesis write authority to the forward hardening migration', async () => {
  const hardening = await readFile(new URL('../migrations/0027_hypothesis_authority_hardening_v1.sql', import.meta.url), 'utf8');
  assert.match(sql,/GRANT SELECT, INSERT ON TABLE public\.hypotheses TO authenticated/u);
  assert.match(hardening,/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.hypotheses FROM authenticated/u);
  assert.match(hardening,/DROP POLICY IF EXISTS hypotheses_insert_own ON public\.hypotheses/u);
});
