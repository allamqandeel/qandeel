/**
 * S8B-07 CP2-A.1 — the iOS Replay gate's proof build entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s807cp2a1-proof-entry.mjs --apply` points `main` at it for one proof build, which the
 * gate records in its evidence (.github/workflows/ios-replay-gate.yml).
 */
import { registerRootComponent } from 'expo';

import { S807Cp2a1ProofRoot } from './S807Cp2a1ProofRoot';

registerRootComponent(S807Cp2a1ProofRoot);
