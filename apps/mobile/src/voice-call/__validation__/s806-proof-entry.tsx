/**
 * S8B-06 CP1 — the native audio engine proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s806-proof-entry.mjs --apply` points `main` at it for one proof build.
 */
import { registerRootComponent } from 'expo';

import { S806AudioProofRoot } from './S806AudioProofRoot';

registerRootComponent(S806AudioProofRoot);
