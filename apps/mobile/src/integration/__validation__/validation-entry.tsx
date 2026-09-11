/**
 * T-12 Phase M — the validation build's entry point.
 *
 * VALIDATION ONLY. This file is not referenced by `package.json`, by `app.config.js`, by the router,
 * or by any production module. It sits here inert, and it becomes an entry point only when a
 * validator points `main` at it for one build, exactly as the Phase-M runbook records.
 *
 * ## Why an alternate ENTRY rather than a route or a flag
 *
 * Three shapes were possible and two are wrong:
 *
 *   a second Expo Router route — refused. Five contracts census `src/app/` as exactly two files, and
 *   the two-file router root is a frozen architectural decision rather than an implementation detail;
 *
 *   a runtime flag on the Product root — refused. It would put a branch INSIDE the production import
 *   closure that mounts a credential-taking surface, which is precisely the reachability this whole
 *   preparation exists to make impossible;
 *
 *   a separate entry — this. The Product route is byte-identical in both builds, the production
 *   closure never references this directory, and the difference between the candidate binary and the
 *   validation binary is one line in `package.json` that the runbook states verbatim.
 *
 * ## What is and is not identical to the candidate
 *
 * IDENTICAL: every module under `runtime-entry/` — the Supabase client, the auth authority, the
 * `expo-sqlite` session storage, the config authority — plus the whole integration runtime. That is
 * the code path `QAN-BL-T12-04` is about, and it is the same code, in the same Release configuration,
 * on the same native project.
 *
 * DIFFERENT: which root component mounts. Nothing else. The evidence must record that difference
 * rather than imply the validated binary was the candidate.
 */

import { registerRootComponent } from 'expo';

import { AuthStorageValidationHarness } from './AuthStorageValidationHarness';

registerRootComponent(AuthStorageValidationHarness);
