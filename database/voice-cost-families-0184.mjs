// S8B-02 CP1 (migration 0184): the four voice feature families 0184 admits, and the probe that tells an earlier verifier
// whether 0184 is applied. Every earlier verifier that pins the exact family list adds exactly these four, and nothing
// else, once the probe answers true (0184's own verifier pins the full list).
export const VOICE_FAMILIES = Object.freeze(['VOICE_NOTE_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION', 'SPEECH_SYNTHESIS', 'SPEECH_RENDERING']);

// One row, one boolean column `voice`: whether 0184's voice begin exists.
export const VOICE_COST_PROBE = "SELECT to_regprocedure('public.begin_ai_provider_call_v3(uuid,uuid,uuid,uuid,text,text,text,text,text)') IS NOT NULL AS voice";
