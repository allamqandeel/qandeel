/**
 * W1A-01 — the visual-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes
 * an entry point only when `apps/mobile/scripts/select-w1a-proof-entry.mjs --apply` points `main` at it
 * for one proof build, which the W1A-01 visual-proof workflow records in its evidence.
 */
import { registerRootComponent } from 'expo';

import { W1AProofRoot } from './W1AProofRoot';

registerRootComponent(W1AProofRoot);
