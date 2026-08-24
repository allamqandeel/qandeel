BEGIN;

ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_effect_key_check,
  ADD CONSTRAINT post_response_intelligence_effects_effect_key_check
    CHECK(effect_key IN('MEMORY_WRITE','INTENT_PROVIDER','CANDIDATE_PROVIDER','ASSOCIATION_PROVIDER','HYPOTHESIS_PERSISTENCE','CONFIDENCE_BATCH'));

COMMIT;
