/**
 * S4-01 — the Shared World device-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s401-proof-entry.mjs --apply` points `main` at it for one proof build (with
 * `S401_SHARED_PROOF=1`), which the S4-01 proof workflow records in its evidence.
 */
import { registerRootComponent } from 'expo';

import { S401ProofRoot } from './S401ProofRoot';

registerRootComponent(S401ProofRoot);
