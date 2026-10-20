/**
 * S7-04 — the visual-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s704-proof-entry.mjs --apply` points `main` at it for one proof build, which the S7-04
 * record names in its evidence.
 */
import { registerRootComponent } from 'expo';

import { S704ProofRoot } from './S704ProofRoot';

registerRootComponent(S704ProofRoot);
