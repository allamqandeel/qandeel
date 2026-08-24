import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sources=Object.fromEntries(await Promise.all(['0005','0007','0008','0009'].map(async number=>[number,await readFile(new URL(`../verify-migration-${number}.mjs`,import.meta.url),'utf8')])));

test('0005 verifier fails closed instead of applying or repairing the Hypothesis schema',()=>{
  assert.match(sources['0005'],/assert\.equal\(exists,true,'Required canonical Hypothesis schema is absent'\)/);
  assert.doesNotMatch(sources['0005'],/readFile|await client\.query\(migration\)|migration\.match|CREATE TABLE|CREATE FUNCTION|GRANT EXECUTE|REVOKE ALL/);
});

test('0007 verifier fails closed instead of applying or extracting canonical DDL',()=>{
  assert.match(sources['0007'],/Schema contract mismatch: create_validated_question_candidate/);
  assert.match(sources['0007'],/to_regprocedure\('public\.create_validated_question_candidate\(jsonb\)'\)/);
  assert.doesNotMatch(sources['0007'],/readFile|await client\.query\(migration\)|migration\.match|CREATE OR REPLACE FUNCTION/);
});

test('0008 verifier fails closed instead of replacing the update function or repairing grants',()=>{
  assert.match(sources['0008'],/Schema contract mismatch: apply_hypothesis_evidence_update/);
  assert.match(sources['0008'],/to_regprocedure\('public\.apply_hypothesis_evidence_update\(uuid,uuid,integer,text,text\)'\)/);
  assert.doesNotMatch(sources['0008'],/readFile|await client\.query\(migration\)|migration\.match|DROP FUNCTION|GRANT EXECUTE ON FUNCTION|REVOKE ALL ON FUNCTION/);
});

test('0009 verifier fails closed instead of applying migration or dependency-guard DDL',()=>{
  assert.match(sources['0009'],/Schema contract mismatch: validate_him_metric_dependencies/);
  assert.match(sources['0009'],/him_metric_dependencies_valid/);
  assert.doesNotMatch(sources['0009'],/readFile|await client\.query\(migration\)|migration\.match|CREATE FUNCTION|CREATE CONSTRAINT TRIGGER|REVOKE ALL ON FUNCTION/);
});
