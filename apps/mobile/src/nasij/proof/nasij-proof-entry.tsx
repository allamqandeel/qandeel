/**
 * NASIJ (experimental, isolated) — the proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point
 * only when `apps/mobile/scripts/select-nasij-proof-entry.mjs --apply` points `main` at it for one proof build (with
 * `NASIJ_PROOF=1`). Everything it shows is a labelled synthetic fixture.
 */
import { registerRootComponent } from 'expo';

import { NasijProofRoot } from './NasijProofRoot';

registerRootComponent(NasijProofRoot);
