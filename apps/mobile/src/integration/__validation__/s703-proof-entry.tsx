/**
 * S7-03 — the visual-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s703-proof-entry.mjs --apply` points `main` at it for one proof build, which the S7-03
 * record names in its evidence.
 */
import { registerRootComponent } from 'expo';

import { S703ProofRoot } from './S703ProofRoot';

registerRootComponent(S703ProofRoot);
