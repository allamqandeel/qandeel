/**
 * S8B-04 (CP2) — the Fast Voice Path feasibility proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s804-proof-entry.mjs --apply` points `main` at it for one proof build.
 */
import { registerRootComponent } from 'expo';

import { S804FastVoiceProofRoot } from './S804FastVoiceProofRoot';

registerRootComponent(S804FastVoiceProofRoot);
