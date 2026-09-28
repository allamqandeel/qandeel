/**
 * W1B-01 — the visual-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes
 * an entry point only when `apps/mobile/scripts/select-w1b-proof-entry.mjs --apply` points `main` at it
 * for one proof build, which the W1B-01 visual-proof workflow records in its evidence.
 */
import { registerRootComponent } from 'expo';

import { W1BProofRoot } from './W1BProofRoot';

registerRootComponent(W1BProofRoot);
