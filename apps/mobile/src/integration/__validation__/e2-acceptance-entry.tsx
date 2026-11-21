/**
 * COSMOS-FINAL-01 E-2 — the synthetic-data acceptance build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * for the one E-2 acceptance APK, whose build script points `main` at it and restores the Product entry afterwards.
 */
import { registerRootComponent } from 'expo';

import { E2AcceptanceRoot } from './E2AcceptanceRoot';

registerRootComponent(E2AcceptanceRoot);
