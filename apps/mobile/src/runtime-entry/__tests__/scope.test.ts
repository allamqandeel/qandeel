/** T-12P adversarial matrix — Scope, P55…P60 (the runtime-provable half). */
import * as runtimeEntry from '..';
import {
  FOUNDATION_SHELL_STATUS,
  FOUNDATION_SHELL_TEST_ID,
  FOUNDATION_SHELL_TITLE,
  FoundationShell,
} from '../../shell/FoundationShell';
import { createMobileRuntimeEntry } from '../mobile-runtime-entry';
import { createManualForegroundSignal } from '../lifecycle/foreground-signal';
import { TEST_CONFIG, authPortDouble, httpDouble, serveHappyPath } from '../__fixtures__/runtime-entry';

test('§12 — the public barrel is exactly this surface, and the three private implementations are not on it', () => {
  // A census rather than a spot check: a new export has to be a deliberate act, because T-12 will
  // consume exactly this and nothing deeper.
  // W1A-01 added exactly two, deliberately: the Conversation turn transport (a plain class, like the
  // Session client) and the history page bound it asks for.
  // W1B-01 added exactly three, deliberately: the account transport and the signed-out Login ID
  // availability transport (plain classes, like the Session client), and the two sign-up metadata key
  // names migration 0123 reads — a pair of identifiers, not reader-facing copy.
  // W2-01 R1 added exactly one, deliberately: `isEmailIdentifier`, the auth authority's own rule for
  // whether a typed identifier is an Email or a Login ID, so the account layer routes an unconfirmed
  // reader's Verify Email by the same rule the credential was routed by — never by a second copy of it.
  // W3-MEGA-U added exactly one: UnderstandingApiClient, the QANDEEL Understanding transport (a plain class).
  // A3-01 added exactly one: ActivityApiClient, the Activity transport (a plain class).
  // A3-02 added exactly one: PushApiClient, the device-registration transport (a plain class).
  // S4-01 added exactly one: SharedWorldApiClient, the Shared World transport (a plain class).
  // S5-01 added exactly one: PublicWorldApiClient, the Public World transport (a plain class).
  expect(Object.keys(runtimeEntry).sort()).toEqual([
    'AccountApiClient',
    'ActivityApiClient',
    'CONVERSATION_HISTORY_PAGE_LIMIT',
    'ConversationSessionApiClient',
    'ConversationTurnApiClient',
    'FOREGROUND_CATCH_UP_INTERVAL_MS',
    'LoginIdAvailabilityClient',
    'MAX_CATCH_UP_BACKOFF_MS',
    'MOBILE_PUBLIC_CONFIG_KEYS',
    'PublicWorldApiClient',
    'PushApiClient',
    'SIGN_UP_METADATA_KEYS',
    'SUPABASE_AUTH_OPTIONS',
    'SharedWorldApiClient',
    'UnderstandingApiClient',
    'bootstrapCanonicalRuntime',
    'createAppStateForegroundSignal',
    'createEphemeralAuthSessionStorage',
    'createForegroundLiveDriver',
    'createManualForegroundSignal',
    'createMobileAuthAuthority',
    'createMobileRuntimeEntry',
    'describeConfigFailure',
    'isEmailIdentifier',
    'readMobilePublicConfig',
  ]);

  // The storage implementation, the Supabase client and the scheduler internals stay private and
  // are reachable only through `createMobileRuntimeEntry`.
  for (const forbidden of ['createAuthSessionStorage', 'createSupabaseAuthPort', 'createCatchUpSchedule']) {
    expect(forbidden in runtimeEntry).toBe(false);
  }
});

test('P56 — FoundationShell is untouched and remains the T-01 technical shell', () => {
  // T-12P mounts nothing. Replacing the shell with the integrated Product composition is T-12's
  // entire job, and doing any of it here would be exactly the scope creep the contract forbids.
  expect(FOUNDATION_SHELL_TEST_ID).toBe('qandeel-foundation-shell');
  expect(FOUNDATION_SHELL_TITLE).toBe('QANDEEL');
  expect(FOUNDATION_SHELL_STATUS).toBe('T-01 foundation shell');
  expect(typeof FoundationShell).toBe('function');
});

test('P55/P57 — the layer exports no React component and no reader-facing copy', () => {
  for (const [name, value] of Object.entries(runtimeEntry)) {
    if (typeof value !== 'function') continue;
    // A React component is conventionally PascalCase. Every function here is a factory, a reader or
    // a class, and `ConversationSessionApiClient` is a plain class with no render.
    // W1B-01's two account transports are plain classes too.
    // W3-MEGA-U's Understanding transport is a plain class too, and so are A3-01's Activity and A3-02's push transports,
    // and S4-01's Shared World transport, and S5-01's Public World transport.
    if (['ConversationSessionApiClient', 'ConversationTurnApiClient', 'AccountApiClient', 'LoginIdAvailabilityClient', 'UnderstandingApiClient', 'ActivityApiClient', 'PushApiClient', 'SharedWorldApiClient', 'PublicWorldApiClient'].includes(name)) continue;
    expect(name[0]).toBe(name[0].toLowerCase());
  }
  // The only strings the layer exports are config KEY NAMES and client option flags — never a
  // sentence a reader could see. Product copy belongs to VI-01 and is not T-12P's to write.
  for (const key of runtimeEntry.MOBILE_PUBLIC_CONFIG_KEYS) {
    expect(key).not.toMatch(/\s/u);
  }
});

test('P59 — nothing in the ready bundle offers a persistence route', async () => {
  const http = httpDouble();
  serveHappyPath(http);
  const built = createMobileRuntimeEntry({
    config: TEST_CONFIG,
    authPort: authPortDouble({ userId: 'alice', accessToken: 'token-alice-1' }),
    foreground: createManualForegroundSignal('ACTIVE'),
    httpFetch: http.fetch,
  });
  if (!built.ok) throw new Error('unreachable');
  await built.runtime.start();
  const result = await built.runtime.bootstrap();
  if (result.kind !== 'READY') throw new Error('unreachable');

  // The bundle is the handoff to T-12. Restart, recovery and Product persistence are T-13's, so the
  // bundle exposes no save, restore, hydrate or persist of any kind.
  expect(Object.keys(result.bundle).sort()).toEqual([
    'authGeneration',
    'cursors',
    'initialDisclosure',
    'projection',
    'runtimeGeneration',
    'sessionId',
    'store',
    'userId',
  ]);
  for (const forbidden of ['persist', 'save', 'restore', 'hydrate', 'rehydrate', 'snapshotToDisk']) {
    expect(forbidden in result.bundle).toBe(false);
  }
  built.runtime.dispose();
});

test('P58 — the layer implements no T-12 backlog item', () => {
  // The nine T-12 items stay T-12's. None of these concepts has a seam here: no journey origin, no
  // composite spatial cause, no Meaning Ignition, no locale provider, no responsive composition.
  const surface = Object.keys(runtimeEntry).join(' ').toLowerCase();
  for (const forbidden of ['exactreturn', 'ignition', 'locale', 'numeral', 'responsive', 'chrome']) {
    expect(surface).not.toContain(forbidden);
  }
});
