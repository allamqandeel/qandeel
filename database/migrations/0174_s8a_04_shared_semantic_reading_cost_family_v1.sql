-- S8A-04 CP1 - Shared Social Understanding & Trusted Identity: the AI-COST-01 feature family of the Shared semantic reading.
--
-- The Product Owner's D3 (2026-10-24): the Shared semantic reading - QANDEEL's DeepSeek Flash reading of one Shared World's
-- conversation into its semantic places - is its own production provider path, so it is accounted under its own feature
-- family, SHARED_SEMANTIC_READING, through the existing AI-COST-01 boundary (no new client, no new ledger). Each reading is
-- charged to the member whose committed message started the pass, after the 0089 resolver names them its author.
--
-- This migration is exactly that one value: the 0171 list of the ai_provider_calls feature-family CHECK plus one name.
-- Nothing else changes; every earlier family, row and function is untouched.
--
-- No hosted application is authorized by this file: it is applied to the local verification database only until a
-- separate authorization says otherwise. Migrations 0001-0173 are byte-unchanged.

BEGIN;

ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING'));

COMMIT;
