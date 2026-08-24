import{INTELLIGENCE_EFFECTS,type IntelligenceEffect}from'./post-response-intelligence.types';

describe('post-response intelligence effect registry',()=>{
 it('exposes the exact six independent durable effect keys',()=>{expect(INTELLIGENCE_EFFECTS).toEqual(['MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH']);expect(new Set(INTELLIGENCE_EFFECTS).size).toBe(INTELLIGENCE_EFFECTS.length);expect(INTELLIGENCE_EFFECTS.indexOf('ASSOCIATION_PROVIDER')).not.toBe(INTELLIGENCE_EFFECTS.indexOf('CANDIDATE_PROVIDER'));});
 it('allows the association key through the generic effect contract',()=>{const effect:IntelligenceEffect='ASSOCIATION_PROVIDER';expect(effect).toBe('ASSOCIATION_PROVIDER');});
});
