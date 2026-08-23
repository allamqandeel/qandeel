import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const orchestrator = read('apps/api/src/conversation/conversation-orchestrator.service.ts');
const router = read('apps/api/src/model-router/model-router.types.ts');
const policy = read('apps/api/src/human-model/him-fast-deep-consumption.service.ts');
const modelTypes = read('apps/api/src/human-model/him-fast-deep-consumption.types.ts');
const selector = read('apps/api/src/human-model/him-turn-context-selection.service.ts');

test('preserves Safety short-circuit and the ordered HIM pipeline before routing', () => {
  const ordered = ['safety.disposition === \'BLOCK\'', 'himContextSelector.select(claimed)', 'himSnapshot.getSnapshot', 'himReasoningConsumption.transform', 'himFastDeepConsumption.project', 'router.generate'];
  for (let i = 1; i < ordered.length; i += 1) assert.ok(orchestrator.indexOf(ordered[i - 1]) < orchestrator.indexOf(ordered[i]));
});

test('keeps dedicated model-facing HIM and Memory containers with no provider divergence', () => {
  assert.match(router, /himContext\?: HimModelContext/);
  assert.match(router, /<user_memory_context>/); assert.match(router, /<him_reasoning_context>/);
  for (const path of ['apps/api/src/model-router/providers/openai/openai-model-router.ts','apps/api/src/model-router/providers/anthropic/claude-model-router.ts']) assert.doesNotMatch(read(path), /himContext|him_reasoning_context/);
});

test('keeps projection free of trends/provenance and selector free of content inference', () => {
  assert.doesNotMatch(policy, /HimTrend|TrendService|TrendRepository/);
  for (const field of ['measurementEventId','measurementObservationId','calculationResultId','canonicalBindingId','scaleReference','scaleVersion','instrumentId','instrumentVersion','modelId','modelVersion']) assert.doesNotMatch(modelTypes, new RegExp(field));
  assert.doesNotMatch(selector, /\.content|SITUATION|DECISION|GOAL/);
  assert.match(selector, /contextKind: 'CONVERSATION_SESSION'/);
});
