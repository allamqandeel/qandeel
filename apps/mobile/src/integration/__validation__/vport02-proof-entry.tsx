/**
 * VPORT-02 — the visual-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes
 * an entry point only when `apps/mobile/scripts/select-vport02-proof-entry.mjs --apply` points `main` at
 * it for one proof build, which the VPORT-02 visual-proof workflow records in its evidence.
 */
import { registerRootComponent } from 'expo';

import { Vport02ProofRoot } from './Vport02ProofRoot';

registerRootComponent(Vport02ProofRoot);
