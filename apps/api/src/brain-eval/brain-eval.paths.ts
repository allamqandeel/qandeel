import { resolve } from 'node:path';

// This file is four directory levels below the repository root in both src and dist.
export const REPOSITORY_ROOT = resolve(__dirname, '..', '..', '..', '..');
export const EVALUATION_ARTIFACT_DIRECTORY = resolve(REPOSITORY_ROOT, 'artifacts', 'evals');
