import { resolve } from 'node:path';

// This file is four directory levels below the repository root in both src and dist.
export const REPOSITORY_ROOT = resolve(__dirname, '..', '..', '..', '..');
export const EVALUATION_ARTIFACT_DIRECTORY = resolve(REPOSITORY_ROOT, 'artifacts', 'evals');
/** ACE-01 (WP3): the Golden Conversations suite writes beside, never over, the Brain Bake-off artifacts (still git-ignored). */
export const GOLDEN_CONVERSATION_ARTIFACT_DIRECTORY = resolve(EVALUATION_ARTIFACT_DIRECTORY, 'golden-conversations');
/** S8A-02: the extended Golden suite and its DeepSeek-only runs, beside the others (still git-ignored). */
export const GOLDEN_EXTENDED_ARTIFACT_DIRECTORY = resolve(EVALUATION_ARTIFACT_DIRECTORY, 'golden-conversations-extended');
// S8A-02 Round 2: the targeted suite and the FAST / DEEP pairs (git-ignored, like every evaluation artifact).
export const GOLDEN_ROUND2_ARTIFACT_DIRECTORY = resolve(EVALUATION_ARTIFACT_DIRECTORY, 'golden-round2');
export const GOLDEN_ROUND2_PATHS_ARTIFACT_DIRECTORY = resolve(EVALUATION_ARTIFACT_DIRECTORY, 'golden-round2-paths');
