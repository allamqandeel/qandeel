/**
 * A3-01 — the integrated in-app proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-a301-proof-entry.mjs --apply` points `main` at it for one proof build (with
 * `A301_INAPP_PROOF=1`), which the A3-01 proof workflow records in its evidence.
 */
import { registerRootComponent } from 'expo';

import { A301ProofRoot } from './A301ProofRoot';

registerRootComponent(A301ProofRoot);
