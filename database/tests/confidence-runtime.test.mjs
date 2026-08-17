import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../migrations/0006_confidence_runtime.sql', import.meta.url), 'utf8');

test('confidence evaluations are separate, immutable, versioned hypothesis snapshots', () => {
  assert.match(sql, /CREATE TABLE public\.confidence_evaluations/u);
  assert.match(sql, /FOREIGN KEY \(target_id, user_id\)[\s\S]*REFERENCES public\.hypotheses \(id, user_id\)/u);
  assert.match(sql, /target_version integer NOT NULL/u);
  assert.match(sql, /policy_version text NOT NULL/u);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE) ON TABLE/iu);
  assert.match(sql, /CREATE FUNCTION public\.create_confidence_evaluation/u);
  assert.match(sql, /target\.assumptions,target\.competing_hypothesis_ids,canonical_missing/u);
  assert.match(sql, /canonical_supporting,canonical_contradicting/u);
  assert.match(sql, /\(SELECT auth\.uid\(\)\),target\.id,'HYPOTHESIS',target\.version,1/u);
});

test('uncalibrated foundation cannot persist invented precision', () => {
  assert.match(sql, /numeric_score IS NULL/u);
  assert.match(sql, /confidence_band IS NULL/u);
  assert.match(sql, /calibration_state = 'UNCALIBRATED'/u);
  assert.match(sql, /supporting_evidence_ids/u);
  assert.match(sql, /contradicting_evidence_ids/u);
  assert.match(sql, /NOT supporting_evidence_ids && contradicting_evidence_ids/u);
});

test('confidence rows are default-deny and user isolated by RLS', () => {
  assert.match(sql, /ALTER TABLE public\.confidence_evaluations ENABLE ROW LEVEL SECURITY/u);
  assert.match(sql, /REVOKE ALL ON TABLE public\.confidence_evaluations FROM anon, authenticated/u);
  assert.ok((sql.match(/user_id=?(?:\s*)\(SELECT auth\.uid\(\)\)/gu) ?? []).length >= 3);
  assert.doesNotMatch(sql, /service_role/iu);
});

test('migration contains no provider, embedding, question, HIM, recommendation, transcript, or reasoning payload', () => {
  assert.doesNotMatch(sql, /claude|openai|gemini|embedding|question|recommendation|transcript|chain.of.thought|scratchpad/iu);
  assert.doesNotMatch(sql, /\bhim\b/iu);
});
