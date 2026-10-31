/**
 * S8B-03 (CP2) — the native-capability proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s803-proof-entry.mjs --apply` points `main` at it for one proof build, which the S8B-03
 * record names in its evidence.
 */
import { registerRootComponent } from 'expo';

import { S803ProofRoot } from './S803ProofRoot';

registerRootComponent(S803ProofRoot);
