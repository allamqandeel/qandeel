/**
 * W3-01 (E2E-D-10) — the ONE appearance authority: P1 §12's semantics, the Dark default, per-identity
 * device-local persistence, restart recovery, isolation between identities, and the native declaration.
 *
 * Only the platform edges are doubles: the operating system's appearance (a switch the test flips) and the
 * native declaration (a recorder). The store is the production contract's in-memory implementation.
 */
import {
  APPEARANCE_KEY_PREFIX,
  appearanceKeyFor,
  createAppearanceAuthority,
  createEphemeralAppearancePreferenceStore,
  type AppearancePreference,
  type AppearancePreferenceStore,
  type EffectiveAppearance,
  type SystemAppearanceSource,
} from '..';

function systemDouble(initial: EffectiveAppearance) {
  let current = initial;
  const listeners = new Set<(next: EffectiveAppearance) => void>();
  const source: SystemAppearanceSource = {
    current: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    source,
    set(next: EffectiveAppearance) {
      current = next;
      for (const listener of Array.from(listeners)) listener(next);
    },
    listeners: () => listeners.size,
  };
}

function build(options: { system?: EffectiveAppearance; store?: AppearancePreferenceStore } = {}) {
  const system = systemDouble(options.system ?? 'LIGHT');
  const store = options.store ?? createEphemeralAppearancePreferenceStore();
  const declared: AppearancePreference[] = [];
  const authority = createAppearanceAuthority({ store, system: system.source, native: { apply: (preference) => declared.push(preference) } });
  let notifications = 0;
  authority.subscribe(() => {
    notifications += 1;
  });
  return { authority, system, store, declared, notifications: () => notifications };
}

describe('the default is Dark, and nobody signed in means Dark', () => {
  it('a new authority is unbound DARK even on a Light device, and declares nothing natively before a bind', () => {
    const { authority, declared } = build({ system: 'LIGHT' });
    expect(authority.getState()).toEqual({ bound: false, preference: 'DARK', effective: 'DARK' });
    // Until the auth owner settles, the platform keeps what it persisted at the last run (no cold-launch flip).
    expect(declared).toEqual([]);
  });

  it('a new identity with nothing stored is DARK, and that is declared natively', () => {
    const { authority, declared } = build({ system: 'LIGHT' });
    authority.bindAccount('user-a');
    expect(authority.getState()).toEqual({ bound: true, preference: 'DARK', effective: 'DARK' });
    expect(declared).toEqual(['DARK']);
  });

  it('signed out (bound to nobody) is DARK and cannot be changed', () => {
    const { authority, declared } = build({ system: 'LIGHT' });
    authority.bindAccount(null);
    expect(authority.getState()).toEqual({ bound: false, preference: 'DARK', effective: 'DARK' });
    expect(authority.setPreference('LIGHT')).toBe(false);
    expect(authority.getState().effective).toBe('DARK');
    expect(declared).toEqual(['DARK']);
  });
});

describe('Dark / Light / System, exactly as P1 §12.1 defines them', () => {
  it('Dark and Light are what they say, whatever the operating system is', () => {
    const { authority, system } = build({ system: 'LIGHT' });
    authority.bindAccount('user-a');
    expect(authority.setPreference('DARK')).toBe(true);
    expect(authority.getState().effective).toBe('DARK');
    system.set('DARK');
    expect(authority.setPreference('LIGHT')).toBe(true);
    expect(authority.getState().effective).toBe('LIGHT');
  });

  it('System follows the operating system LIVE', () => {
    const { authority, system, notifications } = build({ system: 'DARK' });
    authority.bindAccount('user-a');
    authority.setPreference('SYSTEM');
    expect(authority.getState()).toEqual({ bound: true, preference: 'SYSTEM', effective: 'DARK' });
    const before = notifications();
    system.set('LIGHT');
    expect(authority.getState().effective).toBe('LIGHT');
    system.set('DARK');
    expect(authority.getState().effective).toBe('DARK');
    expect(notifications() - before).toBe(2);
  });

  it('an explicit Dark or Light IGNORES operating-system changes', () => {
    const { authority, system, notifications } = build({ system: 'LIGHT' });
    authority.bindAccount('user-a');
    authority.setPreference('DARK');
    const before = notifications();
    system.set('DARK');
    system.set('LIGHT');
    expect(authority.getState().effective).toBe('DARK');
    authority.setPreference('LIGHT');
    system.set('DARK');
    expect(authority.getState().effective).toBe('LIGHT');
    // Non-vacuity: the OS DID change underneath, and only the two explicit choices notified.
    expect(notifications() - before).toBe(1);
  });

  it('the native declaration carries the PREFERENCE, so System can follow the device natively', () => {
    const { authority, declared } = build();
    authority.bindAccount('user-a');
    authority.setPreference('LIGHT');
    authority.setPreference('SYSTEM');
    authority.setPreference('DARK');
    expect(declared).toEqual(['DARK', 'LIGHT', 'SYSTEM', 'DARK']);
  });

  it('an unknown value is refused, and nothing changes', () => {
    const { authority } = build();
    authority.bindAccount('user-a');
    expect(authority.setPreference('SEPIA' as AppearancePreference)).toBe(false);
    expect(authority.getState().preference).toBe('DARK');
  });
});

describe('device-local, per-identity persistence', () => {
  it('the same identity on the same device gets its saved choice back after a restart', () => {
    const store = createEphemeralAppearancePreferenceStore();
    const first = build({ store });
    first.authority.bindAccount('user-a');
    first.authority.setPreference('LIGHT');
    first.authority.dispose();

    // A new process: a new authority over the same device storage.
    const second = build({ store, system: 'DARK' });
    expect(second.authority.getState().effective).toBe('DARK');
    second.authority.bindAccount('user-a');
    expect(second.authority.getState()).toEqual({ bound: true, preference: 'LIGHT', effective: 'LIGHT' });
    expect(second.declared).toEqual(['LIGHT']);
  });

  it('identity B never receives identity A’s choice, and A’s survives B for A’s next sign-in', () => {
    const store = createEphemeralAppearancePreferenceStore();
    const { authority } = build({ store });
    authority.bindAccount('user-a');
    authority.setPreference('LIGHT');
    // Non-vacuity: A's choice is really stored.
    expect(store.read('user-a')).toBe('LIGHT');

    authority.bindAccount(null);
    expect(authority.getState().effective).toBe('DARK');
    authority.bindAccount('user-b');
    expect(authority.getState()).toEqual({ bound: true, preference: 'DARK', effective: 'DARK' });
    authority.setPreference('SYSTEM');
    expect(store.read('user-b')).toBe('SYSTEM');

    authority.bindAccount(null);
    authority.bindAccount('user-a');
    expect(authority.getState().preference).toBe('LIGHT');
  });

  it('a token refresh (the same identity bound again) changes nothing and re-reads nothing', () => {
    const reads: string[] = [];
    const inner = createEphemeralAppearancePreferenceStore({ 'user-a': 'LIGHT' });
    const store: AppearancePreferenceStore = { read: (id) => (reads.push(id), inner.read(id)), write: inner.write };
    const { authority, declared, notifications } = build({ store });
    authority.bindAccount('user-a');
    const after = notifications();
    authority.bindAccount('user-a');
    expect(reads).toEqual(['user-a']);
    expect(declared).toEqual(['LIGHT']);
    expect(notifications()).toBe(after);
  });

  it('keys are namespaced per identity and there is no anonymous namespace', () => {
    expect(appearanceKeyFor('user-a')).toBe(`${APPEARANCE_KEY_PREFIX}user-a`);
    expect(appearanceKeyFor('user-a')).not.toBe(appearanceKeyFor('user-b'));
    expect(() => appearanceKeyFor('')).toThrow(RangeError);
  });

  it('a storage that cannot answer is the Dark default, and a failed write still applies the choice now', () => {
    const broken: AppearancePreferenceStore = {
      read: () => {
        throw new Error('storage unavailable');
      },
      write: () => {
        throw new Error('storage unavailable');
      },
    };
    const { authority } = build({ store: broken });
    authority.bindAccount('user-a');
    expect(authority.getState().preference).toBe('DARK');
    expect(authority.setPreference('LIGHT')).toBe(true);
    expect(authority.getState().effective).toBe('LIGHT');
  });

  it('a stored value that is not a preference is ignored', () => {
    const inner = createEphemeralAppearancePreferenceStore();
    const store: AppearancePreferenceStore = { read: () => 'SEPIA' as AppearancePreference, write: inner.write };
    const { authority } = build({ store });
    authority.bindAccount('user-a');
    expect(authority.getState().preference).toBe('DARK');
  });
});

describe('lifecycle', () => {
  it('dispose stops following the operating system and refuses every later change', () => {
    const { authority, system } = build({ system: 'DARK' });
    authority.bindAccount('user-a');
    authority.setPreference('SYSTEM');
    expect(system.listeners()).toBe(1);
    authority.dispose();
    expect(system.listeners()).toBe(0);
    system.set('LIGHT');
    expect(authority.getState().effective).toBe('DARK');
    expect(authority.setPreference('LIGHT')).toBe(false);
  });

  it('a failing native declaration never breaks the app’s own appearance', () => {
    const system = systemDouble('LIGHT');
    const authority = createAppearanceAuthority({
      store: createEphemeralAppearancePreferenceStore(),
      system: system.source,
      native: {
        apply: () => {
          throw new Error('native module missing');
        },
      },
    });
    authority.bindAccount('user-a');
    expect(authority.setPreference('LIGHT')).toBe(true);
    expect(authority.getState().effective).toBe('LIGHT');
  });
});
