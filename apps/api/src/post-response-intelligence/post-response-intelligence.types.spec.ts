import{INTELLIGENCE_EFFECTS,type GenericIntelligenceEffect,type IntelligenceEffect}from'./post-response-intelligence.types';

describe('post-response intelligence effect registry',()=>{
 it('exposes the exact six independent durable effect keys',()=>{expect(INTELLIGENCE_EFFECTS).toEqual(['MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH']);expect(new Set(INTELLIGENCE_EFFECTS).size).toBe(INTELLIGENCE_EFFECTS.length);expect(INTELLIGENCE_EFFECTS.indexOf('ASSOCIATION_PROVIDER')).not.toBe(INTELLIGENCE_EFFECTS.indexOf('CANDIDATE_PROVIDER'));});
 it('keeps the association key a first-class effect while excluding every typed-result effect from generic completion',()=>{
  const effect:IntelligenceEffect='ASSOCIATION_PROVIDER';expect(effect).toBe('ASSOCIATION_PROVIDER');
  const generic:GenericIntelligenceEffect='CONFIDENCE_BATCH';expect(generic).toBe('CONFIDENCE_BATCH');
  // @ts-expect-error MEMORY_WRITE carries a typed durable result (migration 0024).
  const memory:GenericIntelligenceEffect='MEMORY_WRITE';expect(memory).toBe('MEMORY_WRITE');
  // @ts-expect-error INTENT_PROVIDER carries a typed durable result (migration 0029).
  const intent:GenericIntelligenceEffect='INTENT_PROVIDER';expect(intent).toBe('INTENT_PROVIDER');
  // @ts-expect-error ASSOCIATION_PROVIDER carries a typed durable result (migration 0031).
  const association:GenericIntelligenceEffect='ASSOCIATION_PROVIDER';expect(association).toBe('ASSOCIATION_PROVIDER');
  // @ts-expect-error CANDIDATE_PROVIDER carries a typed durable result (migration 0033).
  const candidate:GenericIntelligenceEffect='CANDIDATE_PROVIDER';expect(candidate).toBe('CANDIDATE_PROVIDER');
  // @ts-expect-error HYPOTHESIS_PERSISTENCE is completed only by the atomic persistence command (migration 0033).
  const persistence:GenericIntelligenceEffect='HYPOTHESIS_PERSISTENCE';expect(persistence).toBe('HYPOTHESIS_PERSISTENCE');
 });
});
