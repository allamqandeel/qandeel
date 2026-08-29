import{CONFIDENCE_BATCH_COMMAND_STATUSES,HIM_BRAIN_CONTEXT_COMMAND_STATUSES,INTELLIGENCE_EFFECTS,type ClaimableIntelligenceEffect,type ConfidenceBatchCommandStatus,type HimBrainContextCommandStatus,type IntelligenceEffect,type ManagedIntelligenceEffect}from'./post-response-intelligence.types';

describe('post-response intelligence effect registry',()=>{
 it('exposes the exact eight independent durable effect keys',()=>{expect(INTELLIGENCE_EFFECTS).toEqual(['MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_UPDATE_BATCH','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH','HIM_BRAIN_CONTEXT_MATERIALIZATION']);expect(new Set(INTELLIGENCE_EFFECTS).size).toBe(INTELLIGENCE_EFFECTS.length);expect(INTELLIGENCE_EFFECTS.indexOf('ASSOCIATION_PROVIDER')).not.toBe(INTELLIGENCE_EFFECTS.indexOf('CANDIDATE_PROVIDER'));});
 it('keeps the association key a first-class effect while every effect now carries a typed durable result',()=>{
  const effect:IntelligenceEffect='ASSOCIATION_PROVIDER';expect(effect).toBe('ASSOCIATION_PROVIDER');
  // Migration 0035 removed the last generic result-less effect: there is no
  // GenericIntelligenceEffect type and no repository generic completion left.
  const managed:ManagedIntelligenceEffect='CONFIDENCE_BATCH';expect(managed).toBe('CONFIDENCE_BATCH');
  const a23c:ManagedIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH';expect(a23c).toBe('HYPOTHESIS_UPDATE_BATCH');
  // QHIA-012: the Brain Context materialization is managed too, and is the
  // strictest of the three - it is inserted DIRECTLY as COMPLETED, so no
  // CLAIMED Brain Context state exists even for an instant.
  const brain:ManagedIntelligenceEffect='HIM_BRAIN_CONTEXT_MATERIALIZATION';expect(brain).toBe('HIM_BRAIN_CONTEXT_MATERIALIZATION');
  // @ts-expect-error MEMORY_WRITE is claim-then-work with a typed completion, not a managed one-transaction effect.
  const memory:ManagedIntelligenceEffect='MEMORY_WRITE';expect(memory).toBe('MEMORY_WRITE');
  // @ts-expect-error HYPOTHESIS_PERSISTENCE is claimed ordinarily and completed by its atomic persistence command (migration 0033).
  const persistence:ManagedIntelligenceEffect='HYPOTHESIS_PERSISTENCE';expect(persistence).toBe('HYPOTHESIS_PERSISTENCE');
 });
 it('keeps every managed effect out of the ordinary claim path at compile time',()=>{
  const claimable:ClaimableIntelligenceEffect='HYPOTHESIS_PERSISTENCE';expect(claimable).toBe('HYPOTHESIS_PERSISTENCE');
  const provider:ClaimableIntelligenceEffect='CANDIDATE_PROVIDER';expect(provider).toBe('CANDIDATE_PROVIDER');
  // @ts-expect-error HYPOTHESIS_UPDATE_BATCH is managed: claim + mutations + receipt are one database transaction (migration 0034).
  const updateBatch:ClaimableIntelligenceEffect='HYPOTHESIS_UPDATE_BATCH';expect(updateBatch).toBe('HYPOTHESIS_UPDATE_BATCH');
  // @ts-expect-error CONFIDENCE_BATCH is managed: the item plan, every evaluation and the typed completion are one database transaction (migration 0035).
  const confidence:ClaimableIntelligenceEffect='CONFIDENCE_BATCH';expect(confidence).toBe('CONFIDENCE_BATCH');
  // @ts-expect-error HIM_BRAIN_CONTEXT_MATERIALIZATION is managed: it is inserted directly as COMPLETED, so claiming it would create the exact stranded state QHIA-012 exists to avoid (migration 0061).
  const brain:ClaimableIntelligenceEffect='HIM_BRAIN_CONTEXT_MATERIALIZATION';expect(brain).toBe('HIM_BRAIN_CONTEXT_MATERIALIZATION');
 });
 it('exposes the exact managed Brain Context command status vocabulary',()=>{
  expect(HIM_BRAIN_CONTEXT_COMMAND_STATUSES).toEqual(['COMPLETED','ALREADY_COMPLETED','QUARANTINED','NO_OP']);
  const status:HimBrainContextCommandStatus='ALREADY_COMPLETED';expect(status).toBe('ALREADY_COMPLETED');
  // @ts-expect-error there is deliberately no partial, retryable, or overwriting Brain Context completion status.
  const partial:HimBrainContextCommandStatus='RETRY_PENDING';expect(partial).toBe('RETRY_PENDING');
 });
 it('exposes the exact managed Confidence-batch command status vocabulary',()=>{
  expect(CONFIDENCE_BATCH_COMMAND_STATUSES).toEqual(['COMPLETED','RETRY_PENDING','QUARANTINED','NO_OP']);
  const status:ConfidenceBatchCommandStatus='RETRY_PENDING';expect(status).toBe('RETRY_PENDING');
  // @ts-expect-error there is deliberately no partial/failed completed batch status.
  const partial:ConfidenceBatchCommandStatus='PARTIAL';expect(partial).toBe('PARTIAL');
 });
});
