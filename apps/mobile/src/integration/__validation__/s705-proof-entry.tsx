/**
 * S7-05 — the real-device proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s705-proof-entry.mjs --apply` points `main` at it for one proof build, which the S7-05
 * record names in its evidence.
 */
import { registerRootComponent } from 'expo';

import { S705ProofRoot } from './S705ProofRoot';

registerRootComponent(S705ProofRoot);
