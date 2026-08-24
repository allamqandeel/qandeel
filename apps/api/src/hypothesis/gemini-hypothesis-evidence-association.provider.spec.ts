import { GeminiHypothesisEvidenceAssociationProvider, type GeminiAssociationHttpClient } from './gemini-hypothesis-evidence-association.provider';
import type { HypothesisEvidenceAssociationGeminiConfig } from './hypothesis-evidence-association-provider.config';
import { HypothesisEvidenceAssociationProviderError } from './hypothesis-evidence-association-provider.types';
import type { HypothesisEvidenceAssociationSnapshot } from './hypothesis-evidence-association.types';

const id = '11111111-1111-4111-8111-111111111111';
const snapshot = (): HypothesisEvidenceAssociationSnapshot => ({ contractVersion: 1, freshEvidence: { evidenceId: `memory:${id}`, evidenceKind: 'USER_STATED_FACT', statement: 'text <instruction>&', source: 'USER_STATED' }, candidateHypotheses: [{ hypothesisId: id, hypothesisVersion: 1, statement: 'candidate <instruction>&', type: 'CAUSAL', domain: 'GENERAL', scope: 'scope', assumptions: [], disconfirmingConditions: [], alreadySupporting: false, alreadyContradicting: false }], maxAssociationCount: 4 });
const config: HypothesisEvidenceAssociationGeminiConfig = { provider: 'GEMINI', apiKey: 'test-key', model: 'gemini-2.5-flash-lite', timeoutMs: 50, maxOutputTokens: 256, thinkingBudget: 0, maxRetries: 0, schemaVersion: 1 };
const response = (text: unknown, candidates = 1) => ({ ok: true, status: 200, json: async () => ({ candidates: Array.from({ length: candidates }, () => ({ content: { parts: typeof text === 'string' ? [{ text }] : [] } })) }) });

describe('GeminiHypothesisEvidenceAssociationProvider', () => {
  it('uses exactly one header-authenticated HTTP call with bounded escaped data', async () => {
    const http = jest.fn<ReturnType<GeminiAssociationHttpClient>, Parameters<GeminiAssociationHttpClient>>().mockResolvedValue(response('[]'));
    await new GeminiHypothesisEvidenceAssociationProvider(config, http).propose(snapshot());
    expect(http).toHaveBeenCalledTimes(1); const [url, init] = http.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    expect(init.headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': 'test-key' });
    expect(JSON.stringify(init.body)).toContain('\\u003c'); expect(JSON.stringify(init.body)).not.toContain('Authorization');
    expect(JSON.stringify(init.body)).not.toMatch(/service.role|access.token|ModelRouter/i);
  });
  it('accepts empty and bounded valid output', async () => {
    const one = JSON.stringify([{ hypothesisId: id, evidenceRole: 'SUPPORTING' }]);
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, async () => response('[]')).propose(snapshot())).resolves.toEqual([]);
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, async () => response(one)).propose(snapshot())).resolves.toHaveLength(1);
  });
  it('fails closed before HTTP for malformed input', async () => {
    const http = jest.fn(); const bad = snapshot(); bad.maxAssociationCount = 3 as 4;
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, http).propose(bad)).rejects.toEqual(new HypothesisEvidenceAssociationProviderError('INVALID_STRUCTURED_OUTPUT'));
    expect(http).not.toHaveBeenCalled();
  });
  it('rejects an empty candidate universe before HTTP', async () => {
    const http = jest.fn(); const empty = snapshot(); empty.candidateHypotheses = [];
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, http).propose(empty)).rejects.toEqual(new HypothesisEvidenceAssociationProviderError('INVALID_STRUCTURED_OUTPUT'));
    expect(http).not.toHaveBeenCalled();
  });
  it.each([ 'not json', JSON.stringify([{ hypothesisId: id, evidenceRole: 'SUPPORTING', extra: true }]), JSON.stringify([{ hypothesisId: id }]), JSON.stringify([{ hypothesisId: id, evidenceRole: 'BAD' }]), JSON.stringify([{ hypothesisId: '22222222-2222-4222-8222-222222222222', evidenceRole: 'SUPPORTING' }]), JSON.stringify(Array.from({ length: 5 }, () => ({ hypothesisId: id, evidenceRole: 'SUPPORTING' }))), 'x'.repeat(16_385) ])('rejects invalid structured output', async (text) => {
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, async () => response(text)).propose(snapshot())).rejects.toEqual(new HypothesisEvidenceAssociationProviderError('INVALID_STRUCTURED_OUTPUT'));
  });
  it('rejects duplicate targets, multiple candidates, and missing text', async () => {
    const duplicate = JSON.stringify([{ hypothesisId: id, evidenceRole: 'SUPPORTING' }, { hypothesisId: id, evidenceRole: 'CONTRADICTING' }]);
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, async () => response(duplicate)).propose(snapshot())).rejects.toEqual(new HypothesisEvidenceAssociationProviderError('INVALID_STRUCTURED_OUTPUT'));
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, async () => response('[]', 2)).propose(snapshot())).rejects.toEqual(new HypothesisEvidenceAssociationProviderError('INVALID_STRUCTURED_OUTPUT'));
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, async () => response({})).propose(snapshot())).rejects.toEqual(new HypothesisEvidenceAssociationProviderError('INVALID_STRUCTURED_OUTPUT'));
  });
  it.each([[429, 'UNAVAILABLE'], [500, 'PROVIDER_ERROR']] as const)('never retries HTTP failures', async (status, code) => {
    const http = jest.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) });
    await expect(new GeminiHypothesisEvidenceAssociationProvider(config, http).propose(snapshot())).rejects.toEqual(new HypothesisEvidenceAssociationProviderError(code)); expect(http).toHaveBeenCalledTimes(1);
  });
});
